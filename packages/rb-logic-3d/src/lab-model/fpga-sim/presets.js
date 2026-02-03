export const FPGA_PRESETS = {
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
export const FPGA_PRESET_DEFS = [
    {
        id: 'basys3-passthrough',
        name: 'Passthrough (SW->LED)',
        description: 'Connects corresponding Switches to LEDs directly.',
        targetType: 'fpga-basys3',
        program: 'passthrough'
    },
    {
        id: 'basys3-counter',
        name: 'Binary Counter (1Hz)',
        description: '8-bit binary counter on LEDs.',
        targetType: 'fpga-basys3',
        program: 'counter'
    },
    {
        id: 'basys3-blink',
        name: 'Blink (LED0 @ 2Hz)',
        description: 'Simple blink on LED0.',
        targetType: 'fpga-basys3',
        program: 'blink'
    }
];
