// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Hardware Store (Zustand)
 *
 * Manages hardware connection state, device capabilities, and I/O traces.
 * Board-agnostic design - works with any board via capabilities model.
 *
 * Pattern: Lazy-init singleton to prevent TDZ crash from circular imports.
 */

import { create } from 'zustand';
import {
  hardwareClient,
  type ConnectionState,
  type Device,
  type IOSnapshot,
  type BoardCapabilities,
} from '../services/hardwareClient';

// Connection state machine
type HardwareConnectionState =
  | 'disconnected'
  | 'discovering'
  | 'connecting'
  | 'ready'
  | 'error';

interface HardwareState {
  // Connection state machine
  connectionState: HardwareConnectionState;
  lastError: string | null;

  // Device info (board-agnostic)
  activeDevice: Device | null;
  capabilities: BoardCapabilities | null;
  availableDevices: Device[];

  // Live I/O (tick-based)
  ioSnapshot: IOSnapshot | null;

  // Trace buffer (ring buffer for recording)
  traceBuffer: IOSnapshot[];
  maxTraceSize: number;
  isRecording: boolean;
  recordingStartTick: number | null;
}

interface HardwareActions {
  // Connection actions
  connect: () => Promise<void>;
  disconnect: () => void;
  selectDevice: (deviceId: string) => Promise<boolean>;

  // Recording actions
  startRecording: () => void;
  stopRecording: () => IOSnapshot[];
  clearTrace: () => void;
  setMaxTraceSize: (size: number) => void;

  // Internal actions (called by subscription)
  _updateConnectionState: (state: ConnectionState) => void;
  _updateIOSnapshot: (snapshot: IOSnapshot) => void;
}

type HardwareStore = HardwareState & HardwareActions;

// Default max trace size (5000 samples @ 50Hz = ~100 seconds)
const DEFAULT_MAX_TRACE_SIZE = 5000;

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createHardwareStore> | null = null;
let _unsubscribeConnection: (() => void) | null = null;
let _unsubscribeIO: (() => void) | null = null;

function createHardwareStore() {
  const store = create<HardwareStore>((set, get) => ({
    // Initial state
    connectionState: 'disconnected',
    lastError: null,
    activeDevice: null,
    capabilities: null,
    availableDevices: [],
    ioSnapshot: null,
    traceBuffer: [],
    maxTraceSize: DEFAULT_MAX_TRACE_SIZE,
    isRecording: false,
    recordingStartTick: null,

    // Connection actions
    connect: async () => {
      set({ connectionState: 'discovering', lastError: null });
      await hardwareClient.connect();
    },

    disconnect: () => {
      hardwareClient.disconnect();
      set({
        connectionState: 'disconnected',
        activeDevice: null,
        capabilities: null,
        ioSnapshot: null,
      });
    },

    selectDevice: async (deviceId: string) => {
      set({ connectionState: 'connecting' });
      const success = await hardwareClient.selectDevice(deviceId);

      if (success) {
        const device = hardwareClient.getActiveDevice();
        const capabilities = hardwareClient.getCapabilities();
        set({
          connectionState: 'ready',
          activeDevice: device,
          capabilities,
          lastError: null,
        });
        return true;
      } else {
        set({
          connectionState: 'error',
          lastError: `Failed to connect to device: ${deviceId}`,
        });
        return false;
      }
    },

    // Recording actions
    startRecording: () => {
      const { ioSnapshot } = get();
      set({
        isRecording: true,
        traceBuffer: [],
        recordingStartTick: ioSnapshot?.tick ?? 0,
      });
    },

    stopRecording: () => {
      const { traceBuffer } = get();
      set({ isRecording: false, recordingStartTick: null });
      return [...traceBuffer];
    },

    clearTrace: () => {
      set({ traceBuffer: [], recordingStartTick: null });
    },

    setMaxTraceSize: (size: number) => {
      set({ maxTraceSize: Math.max(100, Math.min(50000, size)) });
    },

    // Internal: update connection state from hardwareClient subscription
    _updateConnectionState: (state: ConnectionState) => {
      if (state.status === 'connected') {
        set({
          connectionState: 'ready',
          availableDevices: state.devices,
          lastError: null,
        });
      } else if (state.status === 'connecting') {
        set({ connectionState: 'connecting' });
      } else if (state.status === 'offline') {
        set({
          connectionState: state.reason === 'failed' ? 'error' : 'disconnected',
          lastError: state.reason === 'failed' ? state.message : null,
          availableDevices: [],
        });
      }
    },

    // Internal: update I/O snapshot from hardwareClient subscription
    _updateIOSnapshot: (snapshot: IOSnapshot) => {
      const { isRecording, traceBuffer, maxTraceSize } = get();

      // Update latest snapshot
      set({ ioSnapshot: snapshot });

      // Add to trace buffer if recording
      if (isRecording) {
        const newBuffer = [...traceBuffer, snapshot];
        // Ring buffer: drop oldest if over max size
        if (newBuffer.length > maxTraceSize) {
          newBuffer.shift();
        }
        set({ traceBuffer: newBuffer });
      }
    },
  }));

  // Subscribe to hardwareClient state changes
  _unsubscribeConnection = hardwareClient.subscribe((state) => {
    store.getState()._updateConnectionState(state);
  });

  // Subscribe to I/O updates
  _unsubscribeIO = hardwareClient.subscribeIO((snapshot) => {
    store.getState()._updateIOSnapshot(snapshot);
  });

  return store;
}

// Export hook with lazy initialization
export const useHardwareStore: ReturnType<typeof createHardwareStore> = ((
  ...args: any[]
) => {
  if (!_store) _store = createHardwareStore();
  return (_store as any)(...args);
}) as any;

// Export getState for use outside React components
(useHardwareStore as any).getState = () => {
  if (!_store) _store = createHardwareStore();
  return (_store as any).getState();
};

// Export setState for testing
(useHardwareStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createHardwareStore();
  return (_store as any).setState(...a);
};

// Export subscribe for external listeners
(useHardwareStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createHardwareStore();
  return (_store as any).subscribe(...a);
};

// Cleanup function (for testing)
export function _cleanupHardwareStore() {
  if (_unsubscribeConnection) _unsubscribeConnection();
  if (_unsubscribeIO) _unsubscribeIO();
  _unsubscribeConnection = null;
  _unsubscribeIO = null;
  _store = null;
}

// Export types
export type {
  HardwareConnectionState,
  HardwareState,
  HardwareActions,
};
