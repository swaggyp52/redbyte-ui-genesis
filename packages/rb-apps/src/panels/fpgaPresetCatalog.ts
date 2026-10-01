// Exact historical display metadata owned by the retained FPGA preset selector.
// This catalog does not implement a simulation engine, preset loading, or hardware programming.
export interface FpgaPresetDefinition {
    id: string; // "basys3-blink"
    name: string; // "Blink Demo"
    description: string;
    targetType: string; // "fpga-basys3"
    program: string; // key in FPGA_PRESETS
}

export const FPGA_PRESET_DEFS: FpgaPresetDefinition[] = [
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
