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
import { hardwareClient, } from '../services/hardwareClient';
import { createTrace } from '../hardware/traceFormat';
import { createV2Bundle } from '../hardware/v2Export';
// Default max trace size (5000 samples @ 50Hz = ~100 seconds)
const DEFAULT_MAX_TRACE_SIZE = 5000;
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
let _unsubscribeConnection = null;
let _unsubscribeIO = null;
let _unsubscribeStatus = null;
function createHardwareStore() {
    const store = create((set, get) => ({
        // Initial state
        connectionState: 'disconnected',
        lastError: null,
        activeDevice: null,
        capabilities: null,
        availableDevices: [],
        runState: { runId: null, status: 'idle' },
        ioSnapshot: null,
        traceBuffer: [],
        maxTraceSize: DEFAULT_MAX_TRACE_SIZE,
        isRecording: false,
        recordingStartTick: null,
        recordingBoardId: null,
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
        selectDevice: async (deviceId) => {
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
            }
            else {
                set({
                    connectionState: 'error',
                    lastError: `Failed to connect to device: ${deviceId}`,
                });
                return false;
            }
        },
        // Recording actions
        startRecording: () => {
            const { ioSnapshot, capabilities } = get();
            if (!capabilities) {
                console.warn('[HardwareStore] Cannot record: no board capabilities/connected');
                return;
            }
            set({
                isRecording: true,
                traceBuffer: [],
                recordingStartTick: ioSnapshot?.tick ?? 0,
                recordingBoardId: capabilities.boardId,
            });
        },
        stopRecording: () => {
            const { traceBuffer, recordingStartTick, recordingBoardId } = get();
            let trace = null;
            if (recordingBoardId && recordingStartTick !== null) {
                trace = createTrace(recordingBoardId, recordingStartTick, [...traceBuffer]);
            }
            set({ isRecording: false, recordingStartTick: null, recordingBoardId: null });
            return trace;
        },
        exportV2Bundle: async (metadata = {}) => {
            const { traceBuffer, recordingStartTick, recordingBoardId, isRecording, capabilities } = get();
            // If currently recording, stop temporarily or just use current buffer?
            // Contract: export does not stop recording, but captures current state.
            // But for consistency we need a boardId and startTick.
            if (!recordingBoardId || recordingStartTick === null || traceBuffer.length === 0) {
                return null;
            }
            // Inject board profile if available
            const finalMetadata = {
                ...metadata,
                boardProfile: metadata.boardProfile ?? capabilities
            };
            const trace = createTrace(recordingBoardId, recordingStartTick, [...traceBuffer]);
            return await createV2Bundle(trace, finalMetadata);
        },
        clearTrace: () => {
            set({ traceBuffer: [], recordingStartTick: null, recordingBoardId: null });
        },
        setMaxTraceSize: (size) => {
            set({ maxTraceSize: Math.max(100, Math.min(50000, size)) });
        },
        // Internal: update connection state from hardwareClient subscription
        _updateConnectionState: (state) => {
            if (state.status === 'connected') {
                set({
                    connectionState: 'ready',
                    availableDevices: state.devices,
                    lastError: null,
                });
            }
            else if (state.status === 'connecting') {
                set({ connectionState: 'connecting' });
            }
            else if (state.status === 'offline') {
                set({
                    connectionState: state.reason === 'failed' ? 'error' : 'disconnected',
                    lastError: state.reason === 'failed' ? state.message : null,
                    availableDevices: [],
                });
            }
        },
        // Internal: update I/O snapshot from hardwareClient subscription
        _updateIOSnapshot: (snapshot) => {
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
        // Internal: update run state from hardwareClient
        _updateRunState: (state) => {
            set({ runState: state });
        }
    }));
    // Subscribe to hardwareClient state changes
    _unsubscribeConnection = hardwareClient.subscribe((state) => {
        store.getState()._updateConnectionState(state);
    });
    // Subscribe to I/O updates
    _unsubscribeIO = hardwareClient.subscribeIO((snapshot) => {
        store.getState()._updateIOSnapshot(snapshot);
    });
    // Subscribe to Status updates
    _unsubscribeStatus = hardwareClient.subscribeStatus((state) => {
        store.getState()._updateRunState(state);
    });
    return store;
}
// Export hook with lazy initialization
export const useHardwareStore = ((...args) => {
    if (!_store)
        _store = createHardwareStore();
    return _store(...args);
});
// Export getState for use outside React components
useHardwareStore.getState = () => {
    if (!_store)
        _store = createHardwareStore();
    return _store.getState();
};
// Export setState for testing
useHardwareStore.setState = (...a) => {
    if (!_store)
        _store = createHardwareStore();
    return _store.setState(...a);
};
// Export subscribe for external listeners
useHardwareStore.subscribe = (...a) => {
    if (!_store)
        _store = createHardwareStore();
    return _store.subscribe(...a);
};
// Cleanup function (for testing)
export function _cleanupHardwareStore() {
    if (_unsubscribeConnection)
        _unsubscribeConnection();
    if (_unsubscribeIO)
        _unsubscribeIO();
    _unsubscribeConnection = null;
    _unsubscribeIO = null;
    if (_unsubscribeStatus)
        _unsubscribeStatus();
    _unsubscribeStatus = null;
    _store = null;
}
