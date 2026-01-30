import { LabTransport, TransportStatus, TransportType } from '@redbyte/rb-logic-3d';
import { hardwareClient, IOSnapshot, ConnectionState } from './hardwareClient';

/**
 * HardwareClientTransport bridges the global HardwareClient singleton
 * to the rb-logic-3d LabStore. This allows the 3D lab to consume
 * real-time I/O from the bridge without opening redundant WebSockets.
 */
export class HardwareClientTransport implements LabTransport {
    public readonly type: TransportType = 'bridge';
    private lastOutputs: Record<string, number> = {};
    private isConnected: boolean = false;
    private unsubscribeIO: (() => void) | null = null;
    private unsubscribeStatus: (() => void) | null = null;
    private activeNodeId: string | null = null;

    constructor() {
        const state = hardwareClient.getState();
        this.isConnected = state.status === 'connected';
    }

    async connect(options?: any): Promise<void> {
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

    getStatus(): TransportStatus {
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
