import { FpgaSimState, FPGA_PRESETS } from './presets';

export class FpgaSimEngine {
    private state: FpgaSimState;
    private presetId: string;

    constructor(presetId: string = 'passthrough') {
        this.presetId = presetId;
        this.state = {
            outputs: {},
            internal: {}
        };
    }

    reset() {
        this.state = {
            outputs: {},
            internal: {}
        };
    }

    setPreset(presetId: string) {
        if (FPGA_PRESETS[presetId]) {
            this.presetId = presetId;
            this.reset();
        } else {
            console.warn(`Unknown FPGA preset: ${presetId}`);
        }
    }

    tick(inputs: Record<string, 0 | 1>): Record<string, 0 | 1> {
        const preset = FPGA_PRESETS[this.presetId];
        if (!preset) return {};

        // Run the preset logic
        const nextState = preset({ pins: inputs }, this.state);

        // Detect output changes
        const changed: Record<string, 0 | 1> = {};
        for (const [pin, val] of Object.entries(nextState.outputs)) {
            if (this.state.outputs[pin] !== val) {
                changed[pin] = val;
            }
        }

        this.state = nextState;
        return changed;
    }

    // For serialization/snapshots if needed later
    getState() {
        return this.state;
    }

    setState(state: FpgaSimState) {
        this.state = state;
    }
}
