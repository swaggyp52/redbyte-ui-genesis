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
                            // In Lab 0, we can assume if we have a session for basys3, 
                            // and the snapshot matches its deviceId, we update it.
                            for (const target of Object.keys(state.sessions) as Target[]) {
                                const session = state.sessions[target];
                                // We don't have deviceId in snapshot yet? 
                                // Actually snapshot doesn't have deviceId. 
                                // But and the bridge sends target in payload if we are lucky.
                                // Let's use a simpler heuristic for Lab 0: 
                                // if basys3 is connected, update it.
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

                    // Auto-Adopt trigger: when bridge goes online, try to adopt orphans
                    // This is moved to a subscription effect in the store or component
                    // for React-driven apps, but here we can trigger it manually on sync
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

                        // RECORD CONNECT
                        const recorder = useRunRecorderStore.getState();
                        if (recorder.mode === 'recording') {
                            recorder.recordEvent({
                                tick: (window as any).rbTickCount || 0,
                                type: 'hw_connect',
                                deviceId: candidate.deviceId,
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
                    // Singleton doesn't support specific disconnect yet, 
                    // but we can at least reset local state
                    set(state => {
                        state.sessions[target] = { ...DEFAULT_SESSION };
                    });
                },

                autoAdopt: async () => {
                    const { bridge, devices, sessions, ensureSession } = get();
                    if (bridge.status !== 'online') return;

                    console.log('[HardwareStore] Running Auto-Adopt...');

                    // Standard RedByte targets we care about
                    const targets: Target[] = ['basys3', 'arduino-uno'];

                    for (const target of targets) {
                        const session = sessions[target];
                        if (session.status === 'idle') {
                            // Find if there is a device available for this target
                            const hasDevice = devices.some(d => d.target === target);
                            if (hasDevice) {
                                console.log(`[HardwareStore] Auto-Adopting: ${target}`);
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
