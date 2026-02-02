import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { BridgeDevice, BridgeHealth } from '@redbyte/rb-protocol';
import { hardwareClient } from '../services/hardwareClient';
import type { ConnectionState } from '../services/hardwareClient';
import { useRunRecorderStore } from './runRecorderStore';

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
    lastIoAt: number | null;
    messageCount: number;
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
    ensureSession: (target: Target, forcedPort?: string) => Promise<void>;
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
    lastIoAt: null,
    messageCount: 0,
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

                        // Use the devices directly from client if they match rb-protocol
                        state.devices = clientState.devices.map(d => ({
                            deviceId: d.deviceId,
                            target: d.deviceId as any, // Standardized as 'uno' | 'basys3'
                            port: d.runtime?.port || 'unknown',
                            manufacturer: 'unknown', // Fallback
                            serialNumber: d.serial
                        })) as any;

                        // Trigger auto-adopt after sync if bridge just came online
                        const wasOffline = state.bridge.status !== 'online';
                        if (wasOffline) {
                            setTimeout(() => get().autoAdopt(), 100);
                        }
                    } else if (clientState.status === 'connecting') {
                        state.bridge.status = 'connecting';
                    } else {
                        state.bridge.status = 'disconnected';
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

                    // Subscribe to IO for HUD heartbeat
                    hardwareClient.subscribeIO((snapshot: any) => {
                        set(state => {
                            // Find target associated with this snapshot
                            for (const target of Object.keys(state.sessions) as Target[]) {
                                const session = state.sessions[target];
                                if (session.status === 'connected') {
                                    session.lastIoAt = Date.now();
                                    session.messageCount++;
                                }
                            }

                            // RECORDING INTEGRITY
                            const recorder = useRunRecorderStore.getState();
                            if (recorder.mode === 'recording') {
                                recorder.recordEvent({
                                    tick: (window as any).rbTickCount || 0,
                                    type: 'hw_io',
                                    deviceId: 'bridge',
                                    inputs: snapshot.inputs,
                                    outputs: snapshot.outputs,
                                });
                            }
                        });
                    });
                },

                shutdown: () => {
                },

                // Commands
                refreshDevices: async () => {
                },

                ensureSession: async (target: Target, forcedPort?: string) => {
                    const s = get().sessions[target];

                    // IDEMPOTENCY CHECK
                    if (s.status === 'connected' || s.status === 'connecting') {
                        if (s.status === 'connected' && forcedPort && s.port !== forcedPort) {
                            console.log(`[HardwareStore] Reconnecting ${target} to forced port ${forcedPort}`);
                        } else {
                            console.log(`[HardwareStore] ${target} check: already ${s.status}, ignoring request.`);
                            return;
                        }
                    }

                    // 1. FIND THE DEVICE
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

                    const deviceId = candidate.deviceId;
                    const finalPort = forcedPort || candidate.runtime?.port;

                    console.log(`[HardwareStore] Requesting session for ${target} using deviceId: ${deviceId} on port: ${finalPort}`);

                    set((state) => {
                        state.sessions[target].status = 'connecting';
                        state.sessions[target].error = null;
                        state.sessions[target].port = finalPort;
                    });

                    // 2. USE CLIENT TO CONNECT
                    const success = await hardwareClient.selectDevice(deviceId);

                    if (success) {
                        set((state) => {
                            state.sessions[target].status = 'connected';
                            state.sessions[target].deviceId = deviceId;
                            state.sessions[target].port = finalPort;
                            state.sessions[target].verified = true;
                            state.sessions[target].connectedAt = Date.now();
                        });

                        // RECORD CONNECT
                        const recorder = useRunRecorderStore.getState();
                        if (recorder.mode === 'recording') {
                            recorder.recordEvent({
                                tick: (window as any).rbTickCount || 0,
                                type: 'hw_connect',
                                deviceId,
                                target: target
                            });
                        }
                    } else {
                        set((state) => {
                            state.sessions[target].status = 'error';
                            state.sessions[target].error = 'Connection refused';
                        });
                    }
                },

                disconnect: async (target: Target) => {
                    set(state => {
                        state.sessions[target] = { ...DEFAULT_SESSION };
                    });
                },

                autoAdopt: async () => {
                    const { bridge, devices, sessions, ensureSession } = get();
                    if (bridge.status !== 'online') return;

                    const targets: Target[] = ['basys3', 'arduino-uno'];
                    for (const target of targets) {
                        const session = sessions[target];
                        if (session.status === 'idle') {
                            // Find if there is a device available for this target
                            const hasDevice = devices.some(d => d.target === target);
                            if (hasDevice) {
                                await ensureSession(target);
                            }
                        }
                    }
                },
            };
        }),
        { name: 'HardwareSessionStore' }
    )
);
