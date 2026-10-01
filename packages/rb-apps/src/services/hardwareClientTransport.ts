import { hardwareClient, type IOSnapshot, type ConnectionState } from './hardwareClient';

export interface HardwareClientTransportOptions {
    nodeId?: string;
}

export interface HardwareClientTransportStatus {
    type: 'bridge';
    connected: boolean;
}

/** Polling and interaction methods implemented by this retained adapter. */
export interface HardwareClientTransportApi {
    readonly type: 'bridge';
    connect(options?: HardwareClientTransportOptions): Promise<void>;
    disconnect(): Promise<void>;
    getStatus(): HardwareClientTransportStatus;
    poll(): Record<string, number>;
    pushInteraction(nodeId: string, pinId: string, value: number): void;
    loadPreset(nodeId: string, presetId: string): void;
}

/**
 * HardwareClientTransport bridges the global HardwareClient singleton
 * to a polling and interaction API without opening redundant WebSockets.
 * This adapter owns no graph, timeline, simulation store, or scene.
 */
export class HardwareClientTransport implements HardwareClientTransportApi {
    public readonly type = 'bridge';
    private lastOutputs: Record<string, number> = {};
    private isConnected: boolean = false;
    private unsubscribeIO: (() => void) | null = null;
    private unsubscribeStatus: (() => void) | null = null;
    private activeNodeId: string | null = null;

    constructor() {
        const state = hardwareClient.getState();
        this.isConnected = state.status === 'connected';
    }

    async connect(options?: HardwareClientTransportOptions): Promise<void> {
        if (options?.nodeId) {
            this.activeNodeId = options.nodeId;
        }

        this.unsubscribeIO = hardwareClient.subscribeIO((snapshot: IOSnapshot) => {
            // Map inputs/outputs to "nodeId:pinId"
            if (this.activeNodeId) {
                const mapped: Record<string, number> = {};

                // Combine inputs and outputs from snapshot
                const allPins = { ...snapshot.inputs, ...snapshot.outputs };

                Object.entries(allPins).forEach(([signalName, value]) => {
                    // For Lab 0 / Basys3, we map signals like SW/LED to specific pins
                    // if needed, but the DUT protocol often sends them as-is.
                    // Bridge format: msg.changes.SW -> snapshot.inputs.SW

                    if (typeof value === 'number') {
                        mapped[`${this.activeNodeId}:${signalName}`] = value;
                    } else if (Array.isArray(value)) {
                        // Handle bus types (SW/LED)
                        value.forEach((v, i) => {
                            mapped[`${this.activeNodeId}:${signalName}${i}`] = v;
                        });
                    }
                });

                this.lastOutputs = mapped;
            }
        });

        this.unsubscribeStatus = hardwareClient.subscribe((state: ConnectionState) => {
            this.isConnected = state.status === 'connected';
        });

        return Promise.resolve();
    }

    async disconnect(): Promise<void> {
        this.unsubscribeIO?.();
        this.unsubscribeStatus?.();
        this.unsubscribeIO = null;
        this.unsubscribeStatus = null;
    }

    getStatus(): HardwareClientTransportStatus {
        return {
            type: 'bridge',
            connected: this.isConnected,
        };
    }

    poll(): Record<string, number> {
        return this.lastOutputs;
    }

    pushInteraction(nodeId: string, pinId: string, value: number): void {
        this.activeNodeId = nodeId;
        if (!this.isConnected) return;

        // HardwareClient.setOutputs expects { signalName: value }
        // We strip the nodeId prefix if present
        const signal = pinId.includes(':') ? pinId.split(':')[1] : pinId;
        void hardwareClient.setOutputs({ [signal]: value });
    }

    loadPreset(nodeId: string, presetId: string): void {
        this.activeNodeId = nodeId;
        // Optional: Trigger FPGA bitstream reload via bridge if supported
    }
}
