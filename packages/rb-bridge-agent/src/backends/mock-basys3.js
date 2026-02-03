export class MockBasys3Backend {
    pins = {};
    nodeId = null;
    constructor() {
        // Initialize LEDs to 0
        for (let i = 0; i < 16; i++) {
            this.pins[`LED${i}`] = 0;
        }
    }
    setPins(payload) {
        this.nodeId = payload.nodeId;
        // Simple Logic: Echo Switches to LEDs if in passthrough mode
        // For the mock, we just apply the inputs to our local state.
        // And we'll simulate the "passthrough" logic here.
        Object.entries(payload.pins).forEach(([pinId, val]) => {
            this.pins[pinId] = val;
            // Passthrough logic: SW[i] -> LED[i]
            if (pinId.startsWith('SW')) {
                const index = pinId.substring(2);
                this.pins[`LED${index}`] = val;
            }
            // Counter logic: BTN0 increments LED0-15 as a binary count
            // (Simplified for mock: just toggle LED0 on BTN0)
            if (pinId === 'BTN0' && val === 1) {
                this.pins['LED0'] = (this.pins['LED0'] === 1) ? 0 : 1;
            }
        });
    }
    getPins() {
        // We only return the OUTPUT pins (LEDs)
        const outputs = {};
        for (let i = 0; i < 16; i++) {
            outputs[`LED${i}`] = this.pins[`LED${i}`] ?? 0;
        }
        return { pins: outputs };
    }
    loadPreset(presetId) {
        console.log(`[Mock] Loading preset: ${presetId}`);
        // Reset state for new preset if needed
        if (presetId === 'basys3-passthrough' || presetId === 'passthrough') {
            // Reset LEDs
            for (let i = 0; i < 16; i++) {
                this.pins[`LED${i}`] = 0;
            }
        }
    }
}
