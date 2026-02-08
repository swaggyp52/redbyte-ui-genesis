import { FPGA_PRESETS } from './presets';
export class FpgaSimEngine {
    state;
    presetId;
    constructor(presetId = 'passthrough') {
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
    setPreset(presetId) {
        if (FPGA_PRESETS[presetId]) {
            this.presetId = presetId;
            this.reset();
            return;
        }
        const isTestEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
            !!import.meta.env.VITEST;
        if (!isTestEnv) {
            console.warn(`Unknown FPGA preset: ${presetId}`);
        }
        this.presetId = 'passthrough';
        this.reset();
    }
    tick(inputs) {
        const preset = FPGA_PRESETS[this.presetId];
        if (!preset)
            return {};
        // Run the preset logic
        const nextState = preset({ pins: inputs }, this.state);
        // Detect output changes
        const changed = {};
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
    setState(state) {
        this.state = state;
    }
}
