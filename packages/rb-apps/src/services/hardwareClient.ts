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
}

interface IOSnapshot {
  timestamp: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
}

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
  private retryAttempts = 0;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 2000;
  private readonly HEALTH_CHECK_INTERVAL_MS = 10000;
  private readonly DEMO_MODE_ENABLED = typeof process !== 'undefined' && process.env.RB_DEMO_MODE === '1';
  private readonly FETCH_TIMEOUT_MS = this.DEMO_MODE_ENABLED ? 500 : 2000; // Fast fail in demo mode

  constructor(config?: Partial<HardwareClientConfig>) {
    this.config = {
      httpUrl: config?.httpUrl ?? 'http://127.0.0.1:3002/api/v1',
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
      const devices: Device[] = devicesRes.ok ? await devicesRes.json() : [];

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
        console.log('[HardwareClient] Bridge unavailable, entering offline mode');
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
      const devices: Device[] = devicesRes.ok ? await devicesRes.json() : [];
      
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

  // Safe contract getters - never return undefined
  getDevices(): Device[] {
    if (this.state.status === 'connected') {
      return this.state.devices ?? [];
    }
    return [];
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
}

// Singleton instance
export const hardwareClient = new HardwareClient();

