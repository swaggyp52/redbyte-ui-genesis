import { hardwareClient } from './hardwareClient';
/**
 * HardwareClientTransport bridges the global HardwareClient singleton
 * to the rb-logic-3d LabStore. This allows the 3D lab to consume
 * real-time I/O from the bridge without opening redundant WebSockets.
 */
export class HardwareClientTransport {
    type = 'bridge';
    lastOutputs = {};
    isConnected = false;
    unsubscribeIO = null;
    unsubscribeStatus = null;
    activeNodeId = null;
    constructor() {
        const state = hardwareClient.getState();
        this.isConnected = state.status === 'connected';
    }
    async connect(options) {
        if (options?.nodeId) {
            this.activeNodeId = options.nodeId;
        }
        this.unsubscribeIO = hardwareClient.subscribeIO((snapshot) => {
            // Map inputs/outputs to "nodeId:pinId"
            if (this.activeNodeId) {
                const mapped = {};
                // Combine inputs and outputs from snapshot
                const allPins = { ...snapshot.inputs, ...snapshot.outputs };
                Object.entries(allPins).forEach(([signalName, value]) => {
                    // For Lab 0 / Basys3, we map signals like SW/LED to specific pins
                    // if needed, but the DUT protocol often sends them as-is.
                    // Bridge format: msg.changes.SW -> snapshot.inputs.SW
                    if (typeof value === 'number') {
                        mapped[`${this.activeNodeId}:${signalName}`] = value;
                    }
                    else if (Array.isArray(value)) {
                        // Handle bus types (SW/LED)
                        value.forEach((v, i) => {
                            mapped[`${this.activeNodeId}:${signalName}${i}`] = v;
                        });
                    }
                });
                this.lastOutputs = mapped;
            }
        });
        this.unsubscribeStatus = hardwareClient.subscribe((state) => {
            this.isConnected = state.status === 'connected';
        });
        return Promise.resolve();
    }
    async disconnect() {
        this.unsubscribeIO?.();
        this.unsubscribeStatus?.();
        this.unsubscribeIO = null;
        this.unsubscribeStatus = null;
    }
    getStatus() {
        return {
            type: 'bridge',
            connected: this.isConnected,
        };
    }
    poll() {
        return this.lastOutputs;
    }
    pushInteraction(nodeId, pinId, value) {
        this.activeNodeId = nodeId;
        if (!this.isConnected)
            return;
        // HardwareClient.setOutputs expects { signalName: value }
        // We strip the nodeId prefix if present
        const signal = pinId.includes(':') ? pinId.split(':')[1] : pinId;
        void hardwareClient.setOutputs({ [signal]: value });
    }
    loadPreset(nodeId, presetId) {
        this.activeNodeId = nodeId;
        // Optional: Trigger FPGA bitstream reload via bridge if supported
    }
}
