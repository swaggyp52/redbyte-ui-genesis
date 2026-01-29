import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { BridgeDevice } from '@redbyte/rb-fpga-bridge-contract';
import { hardwareClient } from '../services/hardwareClient';
import type { ConnectionState } from '../services/hardwareClient';

// ============================================================================
// Types
// ============================================================================

export type Target = 'basys3' | 'arduino-uno';

export type BridgeStatus = 'disconnected' | 'connecting' | 'online';

export interface BridgeState {
    status: BridgeStatus;
    version: string | null;
    sessionId: string | null;
    lastSeenAt: number | null;
}

export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface HardwareSession {
    status: SessionStatus;
    deviceId: string | null;
    port: string | null;
    verified: boolean;
    capabilities: string[];
    connectedAt: number | null;
    error: string | null;
}

export interface HardwareStoreState {
    // Bridge State (The Pipe)
    bridge: BridgeState;

    // Available Hardware (The Menu)
    devices: BridgeDevice[];

    // Active Sessions (The Connection)
    sessions: Record<Target, HardwareSession>;

    // Actions
    boot: () => void;
    shutdown: () => void;

    refreshDevices: () => Promise<void>;
    ensureSession: (target: Target) => Promise<void>;
    disconnect: (target: Target) => Promise<void>;
    autoAdopt: () => Promise<void>;
}

// ============================================================================
// Constants & Config
// ============================================================================

const DEFAULT_SESSION: HardwareSession = {
    status: 'idle',
    deviceId: null,
    port: null,
    verified: false,
    capabilities: [],
    connectedAt: null,
    error: null,
};

let booted = false;

// ============================================================================
// Store Implementation
// ============================================================================

export const useHardwareSessionStore = create<HardwareStoreState>()(
    devtools(
        immer((set, get) => {

            // Sync logic from HardwareClient state to Store state
            const syncState = (clientState: ConnectionState) => {
                set((state) => {
                    if (clientState.status === 'connected') {
                        state.bridge.status = 'online';
                        state.bridge.version = clientState.bridge.version;
                        state.bridge.lastSeenAt = Date.now();
                        // Map internal Device[] to BridgeDevice[]
                        // They are largely compatible, but let's be safe
                        state.devices = clientState.devices.map(d => ({
                            model: d.boardModel,
                            description: d.boardFamily,
                            deviceId: d.deviceId,
                            serial: d.serial,
                            target: (d.deviceId === 'uno' ? 'arduino-uno' : d.deviceId) as any, // mapping hack
                            transport: { type: 'serial', port: d.runtime?.port || 'unknown' },
                        }));
                    } else if (clientState.status === 'connecting') {
                        state.bridge.status = 'connecting';
                    } else {
                        state.bridge.status = 'disconnected';
                        // Reset devices on disconnect? Maybe keep last known for UI flicker prevention
                    }
                });
            };

            return {
                bridge: {
                    status: 'disconnected',
                    version: null,
                    sessionId: null,
                    lastSeenAt: null,
                },
                devices: [],
                sessions: {
                    basys3: { ...DEFAULT_SESSION },
                    'arduino-uno': { ...DEFAULT_SESSION },
                },

                // Lifecycle
                boot: () => {
                    if (booted) return;
                    booted = true;

                    // Subscribe to global singleton
                    hardwareClient.subscribe((state) => {
                        syncState(state);
                    });

                    // Initial connect
                    hardwareClient.setMode('auto');
                },

                shutdown: () => {
                    // No-op for singleton, or could setMode('off')
                    // hardwareClient.setMode('off');
                },

                // Commands
                refreshDevices: async () => {
                    // Client polls, but maybe we can force it?
                    // HardwareClient doesn't expose force refresh publicly yet, 
                    // but it polls every 10s. For now, rely on polling.
                },

                ensureSession: async (target: Target) => {
                    const s = get().sessions[target];

                    // IDEMPOTENCY CHECK
                    if (s.status === 'connected' || s.status === 'connecting') {
                        console.log(`[HardwareStore] ${target} check: already ${s.status}, ignoring request.`);
                        return;
                    }

                    // 1. FIND THE DEVICE
                    // The "hard rule": Payload must be derived from the discovered Device object.
                    const devices = hardwareClient.getDevices();
                    let candidate: any = null;

                    if (target === 'basys3') {
                        candidate = devices.find(d => d.deviceId === 'basys3' || d.boardModel.toLowerCase().includes('basys'));
                    } else if (target === 'arduino-uno') {
                        candidate = devices.find(d => d.deviceId === 'uno' || d.boardModel.toLowerCase().includes('uno'));
                    }

                    if (!candidate) {
                        console.error(`[HardwareStore] Cannot connect to ${target}: Device not found in discovery list.`);
                        set(state => {
                            state.sessions[target].status = 'error';
                            state.sessions[target].error = 'Device not found';
                        });
                        return;
                    }

                    console.log(`[HardwareStore] Requesting session for ${target} using deviceId: ${candidate.deviceId}`);

                    set((state) => {
                        state.sessions[target].status = 'connecting';
                        state.sessions[target].error = null;
                    });

                    // 2. USE SINGLETON TO CONNECT
                    const success = await hardwareClient.selectDevice(candidate.deviceId);

                    if (success) {
                        set((state) => {
                            state.sessions[target].status = 'connected';
                            state.sessions[target].deviceId = candidate.deviceId;
                            state.sessions[target].port = candidate.runtime?.port;
                            state.sessions[target].verified = true;
                            state.sessions[target].connectedAt = Date.now();
                        });
                    } else {
                        set((state) => {
                            state.sessions[target].status = 'error';
                            state.sessions[target].error = 'Connection refused';
                        });
                    }
                },

                disconnect: async (target: Target) => {
                    // Singleton doesn't support specific disconnect yet, 
                    // but we can at least reset local state
                    set(state => {
                        state.sessions[target] = { ...DEFAULT_SESSION };
                    });
                },

                autoAdopt: async () => {
                    // DISABLED PER INSTRUCTION
                    console.log('[HardwareStore] Auto-adopt disabled for stability.');
                },
            };
        }),
        { name: 'HardwareSessionStore' }
    )
);
