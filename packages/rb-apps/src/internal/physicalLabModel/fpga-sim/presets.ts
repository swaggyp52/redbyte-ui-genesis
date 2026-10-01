export interface FpgaSimState {
    // Current pin outputs
    outputs: Record<string, number>;
    // Internal state (registers, counters)
    internal: Record<string, number>;
}

export interface FpgaSimInputs {
    // Pin inputs (SW, BTN, etc.)
    pins: Record<string, number>;
}

export type FpgaPresetFn = (inputs: FpgaSimInputs, state: FpgaSimState) => FpgaSimState;

export const FPGA_PRESETS: Record<string, FpgaPresetFn> = {
    'passthrough': (inputs, state) => {
        const nextOutputs = { ...state.outputs };

        // Map SW0-15 to LED0-15
        for (let i = 0; i < 16; i++) {
            const swVal = inputs.pins[`SW${i}`] ?? 0;
            nextOutputs[`LED${i}`] = swVal;
        }

        return {
            ...state,
            outputs: nextOutputs
        };
    },

    'blink': (inputs, state) => {
        const nextOutputs = { ...state.outputs };
        let counter = state.internal.counter ?? 0;

        // Blink LED0 every 20 ticks (1 sec at 50ms tick)
        // 0-9: ON, 10-19: OFF
        const phase = counter % 20;
        nextOutputs['LED0'] = phase < 10 ? 1 : 0;

        // Also map SW1 to LED1 just for interactivity check
        nextOutputs['LED1'] = inputs.pins['SW1'] ?? 0;

        return {
            outputs: nextOutputs,
            internal: { ...state.internal, counter: counter + 1 }
        };
    },

    'counter': (inputs, state) => {
        const nextOutputs = { ...state.outputs };
        let count = state.internal.count ?? 0;
        const lastBtn = state.internal.lastBtn0 ?? 0;
        const currentBtn = inputs.pins['BTN0'] ?? 0;

        // Rising edge detection on BTN0
        if (currentBtn === 1 && lastBtn === 0) {
            count = (count + 1) & 0xFFFF; // 16-bit wrap
        }

        // Display count on LEDs
        for (let i = 0; i < 16; i++) {
            nextOutputs[`LED${i}`] = ((count >> i) & 1);
        }

        return {
            outputs: nextOutputs,
            internal: {
                ...state.internal,
                count,
                lastBtn0: currentBtn
            }
        };
    }
};

// Basys3 preset aliases (UI presets use basys3-* ids)
FPGA_PRESETS['basys3-passthrough'] = FPGA_PRESETS['passthrough'];
FPGA_PRESETS['basys3-counter'] = FPGA_PRESETS['counter'];
FPGA_PRESETS['basys3-blink'] = FPGA_PRESETS['blink'];

export { FPGA_PRESET_DEFS, type FpgaPresetDefinition } from '../../../panels/fpgaPresetCatalog';
