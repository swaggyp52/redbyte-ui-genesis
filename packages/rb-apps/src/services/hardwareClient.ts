// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Hardware Bridge Client (MVP)
 * 
 * Centralized client for hardware bridge communication with:
 * - Clean offline/demo mode handling  
 * - Contract-safe defaults (never returns undefined)
 * - Single source of truth for connection state
 */

type ConnectionMode = 'auto' | 'on' | 'off';

interface HardwareClientConfig {
  httpUrl: string;
  wsUrl: string;
  mode: ConnectionMode;
}

interface BridgeHealth {
  ok: boolean;
  version: string;
  uptimeSec: number;
  build: string;
}

interface Device {
  deviceId: string;
  boardModel: string;
  boardFamily: string;
  serial: string;
  transport: string;
  toolchain: string;
  status: string;
  runtime?: {
    port?: string;
    baud_default?: number;
    status?: string;
  };
}

interface IOSnapshot {
  timestamp: string;
  tick?: number;
  inputs: Record<string, number | string>;
  outputs: Record<string, number | string>;
}

interface IOGroup {
  name: string;
  width: number;
  kind: 'switch' | 'button' | 'led' | '7segment';
  labels?: string[];
  pins?: string[];
  writable?: boolean;
}

interface BoardCapabilities {
  boardId: string;
  boardName: string;
  manufacturer?: string;
  inputs: IOGroup[];
  outputs: IOGroup[];
  features?: string[];
  clock?: { name: string; frequencyHz: number };
}

type RunStatus = 'idle' | 'starting' | 'running' | 'running_no_data' | 'stopping' | 'stopped' | 'error';

interface RunState {
  runId: string | null;
  status: RunStatus;
  hint?: string;
  error?: string;
}

type IOUpdateCallback = (snapshot: IOSnapshot) => void;
type StatusUpdateCallback = (state: RunState) => void;

type ConnectionState =
  | { status: 'offline'; reason: 'disabled' | 'unavailable' | 'failed'; message: string }
  | { status: 'connecting'; message: string }
  | { status: 'connected'; bridge: BridgeHealth; devices: Device[]; ws: WebSocket | null };

export class HardwareClient {
  private config: HardwareClientConfig;
  private state: ConnectionState;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<(state: ConnectionState) => void> = new Set();
  private ioListeners: Set<IOUpdateCallback> = new Set();
  private statusListeners: Set<StatusUpdateCallback> = new Set();
  private retryAttempts = 0;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 2000;
  private readonly HEALTH_CHECK_INTERVAL_MS = 10000;
  private readonly DEMO_MODE_ENABLED = typeof process !== 'undefined' && process.env.RB_DEMO_MODE === '1';
  private readonly FETCH_TIMEOUT_MS = this.DEMO_MODE_ENABLED ? 500 : 2000; // Fast fail in demo mode

  // Active device state
  private activeDevice: Device | null = null;
  private capabilities: BoardCapabilities | null = null;
  private latestIOSnapshot: IOSnapshot | null = null;
  private latestRunState: RunState = { runId: null, status: 'idle' };

  constructor(config?: Partial<HardwareClientConfig>) {
    this.config = {
      httpUrl: config?.httpUrl ?? 'http://127.0.0.1:4242',
      wsUrl: config?.wsUrl ?? 'ws://127.0.0.1:4243',
      mode: config?.mode ?? 'auto',
    };

    this.state = {
      status: 'offline',
      reason: 'disabled',
      message: 'Hardware integration disabled (demo mode)',
    };

    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('rb-hardware-mode');
      if (savedMode === 'on' || savedMode === 'off' || savedMode === 'auto') {
        this.config.mode = savedMode;
      }
    }

    if (this.config.mode !== 'off') {
      this.connect();
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  setMode(mode: ConnectionMode) {
    this.config.mode = mode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('rb-hardware-mode', mode);
    }

    if (mode === 'off') {
      this.disconnect();
      this.state = {
        status: 'offline',
        reason: 'disabled',
        message: 'Hardware integration disabled (demo mode)',
      };
      this.notifyListeners();
    } else {
      this.connect();
    }
  }

  async connect() {
    if (this.config.mode === 'off') {
      return;
    }

    if (this.state.status === 'connecting' || this.state.status === 'connected') {
      return;
    }

    this.state = {
      status: 'connecting',
      message: 'Connecting to hardware bridge...',
    };
    this.notifyListeners();

    try {
      const res = await fetch(`${this.config.httpUrl}/health`, {
        signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const bridge: BridgeHealth = await res.json();

      const devicesRes = await fetch(`${this.config.httpUrl}/devices`, {
        signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
      });
      // Bridge returns { schema_version, devices: [...] } - extract the array
      const devicesData = devicesRes.ok ? await devicesRes.json() : { devices: [] };
      const devices: Device[] = Array.isArray(devicesData) ? devicesData : (devicesData.devices ?? []);

      this.state = {
        status: 'connected',
        bridge,
        devices,
        ws: null,
      };
      this.retryAttempts = 0;
      this.notifyListeners();

      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = setInterval(() => this.checkHealth(), this.HEALTH_CHECK_INTERVAL_MS);

      this.connectWS();

    } catch (error: any) {
      this.retryAttempts++;

      if (this.retryAttempts >= this.MAX_RETRY_ATTEMPTS || this.config.mode === 'auto') {
        this.state = {
          status: 'offline',
          reason: 'unavailable',
          message: 'Hardware bridge offline (expected in demo mode)',
        };
        this.notifyListeners();
        console.debug('[HardwareClient] Bridge unavailable, entering offline mode');
      } else {
        console.warn(`[HardwareClient] Connection attempt ${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS} failed, retrying in ${this.RETRY_DELAY_MS}ms...`);
        this.state = {
          status: 'connecting',
          message: `Retrying connection (${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS})...`,
        };
        this.notifyListeners();

        setTimeout(() => this.connect(), this.RETRY_DELAY_MS);
      }
    }
  }

  private async checkHealth() {
    if (this.state.status !== 'connected') return;

    try {
      const res = await fetch(`${this.config.httpUrl}/health`, {
        signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const bridge: BridgeHealth = await res.json();

      const devicesRes = await fetch(`${this.config.httpUrl}/devices`, {
        signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
      });
      // Bridge returns { schema_version, devices: [...] } - extract the array
      const devicesData = devicesRes.ok ? await devicesRes.json() : { devices: [] };
      const devices: Device[] = Array.isArray(devicesData) ? devicesData : (devicesData.devices ?? []);

      if (this.state.status === 'connected') {
        this.state = {
          status: 'connected',
          bridge,
          devices,
          ws: this.state.ws,
        };
        this.notifyListeners();
      }
    } catch {
      console.warn('[HardwareClient] Health check failed, disconnecting');
      this.disconnect();
      this.state = {
        status: 'offline',
        reason: 'failed',
        message: 'Connection to hardware bridge lost',
      };
      this.notifyListeners();

      if (this.config.mode === 'on') {
        setTimeout(() => this.connect(), this.RETRY_DELAY_MS);
      }
    }
  }

  private connectWS() {
    if (this.state.status !== 'connected' || this.state.ws) return;

    try {
      const socket = new WebSocket(this.config.wsUrl);

      socket.onopen = () => {
        console.log('[HardwareClient] WebSocket connected');
        if (this.state.status === 'connected') {
          this.state = {
            status: 'connected',
            bridge: this.state.bridge,
            devices: this.state.devices,
            ws: socket,
          };
          this.notifyListeners();
        }
      };

      socket.onmessage = (event) => {
        this.handleWSMessage(event.data);
      };

      socket.onerror = (error) => {
        console.warn('[HardwareClient] WebSocket error:', error);
      };

      socket.onclose = () => {
        console.log('[HardwareClient] WebSocket closed');
        if (this.state.status === 'connected') {
          this.state = {
            status: 'connected',
            bridge: this.state.bridge,
            devices: this.state.devices,
            ws: null,
          };
          this.notifyListeners();

          if (this.wsReconnectTimeout) clearTimeout(this.wsReconnectTimeout);
          this.wsReconnectTimeout = setTimeout(() => this.connectWS(), this.RETRY_DELAY_MS);
        }
      };

    } catch (error) {
      console.warn('[HardwareClient] Failed to create WebSocket:', error);
    }
  }

  disconnect() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }

    if (this.state.status === 'connected' && this.state.ws) {
      this.state.ws.close();
    }

    this.retryAttempts = 0;
  }

  // Handle WebSocket messages
  private handleWSMessage(data: string | Buffer) {
    try {
      const msg = JSON.parse(data.toString());

      // Handle io:update events
      if (msg.type === 'io:update' || msg.SW !== undefined || msg.io !== undefined) {
        const snapshot: IOSnapshot = {
          timestamp: msg.timestamp || new Date().toISOString(),
          tick: msg.tick ?? msg.TICK ?? msg.mono_seq ?? msg.hw_tick,
          inputs: {},
          outputs: {},
        };

        // Extract inputs/outputs from various message formats
        if (msg.changes) {
          // Bridge contract format: { changes: { SW, BTN, LED } }
          if (msg.changes.SW !== undefined) snapshot.inputs.SW = msg.changes.SW;
          if (msg.changes.BTN !== undefined) snapshot.inputs.BTN = msg.changes.BTN;
          if (msg.changes.LED !== undefined) snapshot.outputs.LED = msg.changes.LED;
        } else if (msg.io) {
          // Stream sample format: { io: { SW, BTN, LED } }
          if (msg.io.SW !== undefined) snapshot.inputs.SW = msg.io.SW;
          if (msg.io.BTN !== undefined) snapshot.inputs.BTN = msg.io.BTN;
          if (msg.io.LED !== undefined) snapshot.outputs.LED = msg.io.LED;
        } else {
          // Direct format: { SW, BTN, LED }
          if (msg.SW !== undefined) snapshot.inputs.SW = msg.SW;
          if (msg.BTN !== undefined) snapshot.inputs.BTN = msg.BTN;
          if (msg.LED !== undefined) snapshot.outputs.LED = msg.LED;
        }

        this.latestIOSnapshot = snapshot;
        this.ioListeners.forEach((listener) => listener(snapshot));
      } else if (msg.type === 'status' || msg.state !== undefined) {
        // Handle status update
        const newState: RunState = {
          runId: msg.run_id || this.latestRunState.runId,
          status: msg.state || 'idle',
          hint: msg.hint,
          error: msg.error
        };
        this.latestRunState = newState;
        this.statusListeners.forEach(l => l(newState));
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Safe contract getters - never return undefined
  getDevices(): Device[] {
    if (this.state.status === 'connected') {
      return this.state.devices ?? [];
    }
    return [];
  }

  /**
   * Get the active device (the one we're connected to)
   */
  getActiveDevice(): Device | null {
    return this.activeDevice;
  }

  /**
   * Get capabilities of the active device
   */
  getCapabilities(): BoardCapabilities | null {
    return this.capabilities;
  }

  /**
   * Get latest I/O snapshot (from WebSocket)
   */
  getLatestIO(): IOSnapshot | null {
    return this.latestIOSnapshot;
  }

  /**
   * Select and connect to a specific device
   */
  /**
   * Select and connect to a specific device
   */
  async selectDevice(deviceId: string): Promise<boolean> {
    if (this.state.status !== 'connected') {
      console.warn('[HardwareClient] Cannot select device: not connected to bridge');
      return false;
    }

    const device = this.state.devices.find(d => d.deviceId === deviceId);
    if (!device) {
      console.warn(`[HardwareClient] Device not found: ${deviceId}`);
      return false;
    }

    try {
      // Bridge expects { port: string } to connect
      // If device is a simulation/mock without a port, we might not need to "connect" via serial,
      // but the bridge convention is to POST /connect to set active target.
      const port = device.runtime?.port;

      // If it's a hardware device, we MUST have a port.
      // If it's a sim/mock, port might be null or "SIM".
      const payload = port ? { port } : { deviceId };

      const res = await fetch(`${this.config.httpUrl.replace('/api/v1', '')}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`Failed to connect: HTTP ${res.status}`);
      }

      this.activeDevice = device;
      this.capabilities = this.buildCapabilitiesFromDevice(device);
      console.log(`[HardwareClient] Selected device: ${device.boardModel} (${deviceId})`);
      return true;

    } catch (error: any) {
      console.error('[HardwareClient] Failed to select device:', error);
      return false;
    }
  }

  /**
   * Build capabilities from device info
   */
  private buildCapabilitiesFromDevice(device: Device): BoardCapabilities {
    // Default capabilities based on board model
    const boardId = device.boardModel?.toLowerCase() || 'unknown';

    if (boardId.includes('basys') || boardId === 'basys3') {
      return {
        boardId: 'basys3',
        boardName: 'Basys3',
        manufacturer: 'Digilent',
        inputs: [
          { name: 'SW', width: 16, kind: 'switch', labels: ['SW15', 'SW14', 'SW13', 'SW12', 'SW11', 'SW10', 'SW9', 'SW8', 'SW7', 'SW6', 'SW5', 'SW4', 'SW3', 'SW2', 'SW1', 'SW0'] },
          { name: 'BTN', width: 5, kind: 'button', labels: ['BTNC', 'BTNU', 'BTNL', 'BTNR', 'BTND'] },
        ],
        outputs: [
          { name: 'LED', width: 16, kind: 'led', labels: ['LD15', 'LD14', 'LD13', 'LD12', 'LD11', 'LD10', 'LD9', 'LD8', 'LD7', 'LD6', 'LD5', 'LD4', 'LD3', 'LD2', 'LD1', 'LD0'], writable: true },
        ],
        features: ['trace', 'program', 'vectors', 'uart', 'jtag'],
        clock: { name: 'CLK100MHZ', frequencyHz: 100000000 },
      };
    }

    if (boardId.includes('spartan') || boardId === 'spartan3e-starter') {
      return {
        boardId: 'spartan3e-starter',
        boardName: 'Spartan-3E Starter Kit',
        manufacturer: 'Digilent',
        inputs: [
          {
            name: 'SW',
            width: 4,
            kind: 'switch',
            labels: ['SW3', 'SW2', 'SW1', 'SW0'],
            pins: ['N17', 'H18', 'L14', 'L13']
          },
          {
            name: 'BTN',
            width: 4,
            kind: 'button',
            labels: ['BTN_EAST', 'BTN_NORTH', 'BTN_SOUTH', 'BTN_WEST'],
            pins: ['H13', 'V4', 'K17', 'D18']
          },
          {
            name: 'ROT',
            width: 3,
            kind: 'switch', // Treated as general input
            labels: ['ROT_A', 'ROT_B', 'ROT_CENTER'],
            pins: ['K18', 'G18', 'V16']
          }
        ],
        outputs: [
          {
            name: 'LED',
            width: 8,
            kind: 'led',
            labels: ['LD7', 'LD6', 'LD5', 'LD4', 'LD3', 'LD2', 'LD1', 'LD0'],
            pins: ['F9', 'E9', 'D11', 'C11', 'F11', 'E11', 'E12', 'F12'],
            writable: true
          },
        ],
        features: ['trace', 'program', 'vectors', 'uart', 'jtag'],
        clock: { name: 'CLK_50MHZ', frequencyHz: 50000000 },
      };
    }

    // Generic fallback
    return {
      boardId: boardId,
      boardName: device.boardModel || 'Unknown Board',
      manufacturer: 'Unknown',
      inputs: [
        { name: 'SW', width: 8, kind: 'switch' },
        { name: 'BTN', width: 4, kind: 'button' },
      ],
      outputs: [
        { name: 'LED', width: 8, kind: 'led', writable: true },
      ],
      features: [],
    };
  }

  /**
   * Subscribe to I/O updates from WebSocket
   */
  subscribeIO(callback: IOUpdateCallback): () => void {
    this.ioListeners.add(callback);
    // Send latest snapshot immediately if available
    if (this.latestIOSnapshot) {
      callback(this.latestIOSnapshot);
    }
    return () => this.ioListeners.delete(callback);
  }

  /**
   * Subscribe to Run Status updates
   */
  subscribeStatus(callback: StatusUpdateCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.latestRunState);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Set output values (e.g., LED state)
   * For simulation/testing mode only - real hardware outputs are driven by DUT
   */
  async setOutputs(outputs: Record<string, number>): Promise<boolean> {
    if (this.state.status !== 'connected') {
      console.warn('[HardwareClient] Cannot set outputs: not connected');
      return false;
    }

    try {
      // Try to set each output via the API
      for (const [signal, value] of Object.entries(outputs)) {
        const endpoint = `${this.config.httpUrl.replace('/api/v1', '')}/api/io/${signal.toLowerCase()}/0`;
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
          signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
        });
      }
      return true;
    } catch (error: any) {
      console.warn('[HardwareClient] Failed to set outputs:', error);
      return false;
    }
  }

  async getIO(sessionId: string): Promise<IOSnapshot> {
    if (this.state.status !== 'connected') {
      return {
        timestamp: new Date().toISOString(),
        inputs: {},
        outputs: {}
      };
    }

    try {
      const res = await fetch(`${this.config.httpUrl}/session/${sessionId}/io`, {
        signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.json();
    } catch (error) {
      console.warn('[HardwareClient] Failed to get IO:', error);
      return {
        timestamp: new Date().toISOString(),
        inputs: {},
        outputs: {}
      };
    }
  }

  /**
   * Export current session data as a proof capsule (JSON blob).
   * Used by HardwarePanelApp to export snapshots for submission.
   */
  async exportProof(): Promise<Blob> {
    if (this.state.status !== 'connected') {
      throw new Error('Hardware bridge not connected');
    }

    const capsule = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      bridge: this.state.bridge,
      devices: this.state.devices,
      snapshots: [],
    };

    const json = JSON.stringify(capsule, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Stream a series of test vectors to the hardware.
   * This sends a batch of inputs to the bridge for execution.
   */
  async streamVectors(vectors: Array<{ inputs: Record<string, number>; delayMs?: number }>): Promise<boolean> {
    if (this.state.status !== 'connected') {
      console.warn('[HardwareClient] Cannot stream vectors: not connected');
      return false;
    }

    try {
      const endpoint = `${this.config.httpUrl.replace('/api/v1', '')}/api/vectors/stream`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectors }),
        signal: AbortSignal.timeout(this.FETCH_TIMEOUT_MS * 5), // Longer timeout for batch
      });

      return res.ok;
    } catch (error) {
      console.warn('[HardwareClient] Failed to stream vectors:', error);
      // Fallback: send individually if stream endpoint not available
      for (const v of vectors) {
        await this.setOutputs(v.inputs);
        if (v.delayMs) await new Promise(r => setTimeout(r, v.delayMs));
      }
      return true;
    }
  }
}

// Singleton instance
export const hardwareClient = new HardwareClient();

// Export types for use in stores
export type {
  ConnectionState,
  ConnectionMode,
  Device,
  IOSnapshot,
  IOGroup,
  BoardCapabilities,
  IOUpdateCallback,
  StatusUpdateCallback,
  RunStatus,
  RunState,
  BridgeHealth,
};

