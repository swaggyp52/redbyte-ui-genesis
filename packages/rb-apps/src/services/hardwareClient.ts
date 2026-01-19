// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Hardware Bridge Client
 * 
 * Centralized client for all hardware/ops communication with:
 * - Clean offline/demo mode handling
 * - No retry spam in console
 * - Single source of truth for connection state
 */

type ConnectionMode = 'auto' | 'on' | 'off';

interface HardwareClientConfig {
  httpUrl: string;
  wsUrl: string;
  mode: ConnectionMode;
}

interface BridgeStatus {
  ok: boolean;
  connected: boolean;
  port: string;
  baud: number;
  mode?: string;
}

type ConnectionState = 
  | { status: 'offline'; reason: 'disabled' | 'unavailable' | 'failed'; message: string }
  | { status: 'connecting'; message: string }
  | { status: 'connected'; bridge: BridgeStatus; ws: WebSocket | null };

export class HardwareClient {
  private config: HardwareClientConfig;
  private state: ConnectionState;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<(state: ConnectionState) => void> = new Set();
  private retryAttempts = 0;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 2000;
  private readonly HEALTH_CHECK_INTERVAL_MS = 10000; // Check every 10s when connected

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

    // Load mode from localStorage if available
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('rb-hardware-mode');
      if (savedMode === 'on' || savedMode === 'off' || savedMode === 'auto') {
        this.config.mode = savedMode;
      }
    }

    // Auto-connect if mode is 'auto' or 'on'
    if (this.config.mode !== 'off') {
      this.connect();
    }
  }

  getState(): ConnectionState {
    return this.state;
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state); // Immediate callback with current state
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

    // Disconnect if mode is 'off'
    if (mode === 'off') {
      this.disconnect();
      this.state = {
        status: 'offline',
        reason: 'disabled',
        message: 'Hardware integration disabled (demo mode)',
      };
      this.notifyListeners();
    } else {
      // Reconnect if mode is 'auto' or 'on'
      this.connect();
    }
  }

  async connect() {
    if (this.config.mode === 'off') {
      return; // Don't connect if disabled
    }

    if (this.state.status === 'connecting' || this.state.status === 'connected') {
      return; // Already connecting or connected
    }

    this.state = {
      status: 'connecting',
      message: 'Connecting to hardware bridge...',
    };
    this.notifyListeners();

    try {
      const res = await fetch(`${this.config.httpUrl}/api/health`, {
        signal: AbortSignal.timeout(2000), // 2s timeout
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const bridge: BridgeStatus = await res.json();

      this.state = {
        status: 'connected',
        bridge,
        ws: null,
      };
      this.retryAttempts = 0; // Reset retry counter on success
      this.notifyListeners();

      // Start health check polling
      if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = setInterval(() => this.checkHealth(), this.HEALTH_CHECK_INTERVAL_MS);

      // Connect WebSocket
      this.connectWS();

    } catch (error: any) {
      this.retryAttempts++;

      // If we've exceeded max retries or mode is 'auto', go offline
      if (this.retryAttempts >= this.MAX_RETRY_ATTEMPTS || this.config.mode === 'auto') {
        this.state = {
          status: 'offline',
          reason: 'unavailable',
          message: `Hardware bridge offline (expected in demo mode)`,
        };
        this.notifyListeners();
        console.log('[HardwareClient] Bridge unavailable, entering offline mode');
      } else {
        // Mode is 'on' and we haven't hit max retries - keep trying
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
      const res = await fetch(`${this.config.httpUrl}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const bridge: BridgeStatus = await res.json();
      this.state = {
        ...this.state,
        bridge,
      };
      this.notifyListeners();
    } catch {
      // Health check failed - disconnect
      console.warn('[HardwareClient] Health check failed, disconnecting');
      this.disconnect();
      this.state = {
        status: 'offline',
        reason: 'failed',
        message: 'Connection to hardware bridge lost',
      };
      this.notifyListeners();

      // Auto-reconnect if mode is 'on'
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
          this.state.ws = socket;
          this.notifyListeners();
        }
      };

      socket.onerror = (error) => {
        console.warn('[HardwareClient] WebSocket error:', error);
      };

      socket.onclose = () => {
        console.log('[HardwareClient] WebSocket closed');
        if (this.state.status === 'connected') {
          this.state.ws = null;
          this.notifyListeners();

          // Attempt reconnect after delay
          if (this.wsReconnectTimeout) clearTimeout(this.wsReconnectTimeout);
          this.wsReconnectTimeout = setTimeout(() => this.connectWS(), this.RETRY_DELAY_MS);
        }
      };

    } catch (error) {
      console.warn('[HardwareClient] Failed to create WebSocket:', error);
    }
  }

  disconnect() {
    // Clear intervals/timeouts
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }

    // Close WebSocket
    if (this.state.status === 'connected' && this.state.ws) {
      this.state.ws.close();
      this.state.ws = null;
    }

    this.retryAttempts = 0;
  }

  async exportProof(): Promise<Blob> {
    if (this.state.status !== 'connected') {
      throw new Error('Hardware bridge not connected');
    }

    const res = await fetch(`${this.config.httpUrl}/api/proof`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Failed to export proof: HTTP ${res.status}`);
    }

    const proof = await res.json();
    return new Blob([JSON.stringify(proof, null, 2)], { type: 'application/json' });
  }
}

// Singleton instance
export const hardwareClient = new HardwareClient();
