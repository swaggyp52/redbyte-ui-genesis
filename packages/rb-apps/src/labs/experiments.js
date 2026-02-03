// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export const EXPERIMENTS = {
    'loopback': {
        id: 'loopback',
        name: 'LED Loopback',
        description: 'Direct connection: Switches control LEDs. Buttons control Decimal Point.',
        compute: (inputs) => ({
            outputs: {
                LED: inputs.SW,
                SEG: 0,
                AN: 0b1111, // All off (common anode)
                DP: inputs.BTN > 0 ? 0 : 1 // ON (0) if any button pressed
            }
        })
    },
    'invert': {
        id: 'invert',
        name: 'Inverter Demo',
        description: 'LEDs show the inverse of Switches. (LED = ~SW)',
        compute: (inputs) => ({
            outputs: {
                LED: (~inputs.SW) & 0xFFFF,
                SEG: 0,
                AN: 0b1111,
                DP: 1
            }
        })
    },
    'counter': {
        id: 'counter',
        name: 'Binary Counter',
        description: '8-bit counter running on clock tick. SW0 enables. BTNC resets.',
        initialState: { count: 0 },
        compute: (inputs, tick, state) => {
            const enable = (inputs.SW & 1) > 0;
            const reset = (inputs.BTN & 0b10000) > 0; // BTNC is usually bit 4 or 0, let's assume bit 0 for center? 
            // Basys3 BTN: Center, Up, Left, Right, Down. Usually mapped to bits 0..4.
            // Let's check BoardPanel... BTNC is 'btnBits[0]'. So bit 0 mask is 1.
            const btnC = (inputs.BTN & 1) > 0;
            let nextCount = state.count;
            if (btnC)
                nextCount = 0;
            else if (enable)
                nextCount = (state.count + 1) & 0xFF; // 8-bit wrap
            return {
                outputs: {
                    LED: nextCount,
                    SEG: 0,
                    AN: 0b1111,
                    DP: 1
                },
                nextState: { count: nextCount }
            };
        }
    },
    'traffic': {
        id: 'traffic',
        name: 'Traffic Light FSM',
        description: 'Simple Traffic Light. BTN(Center) advances state: Red -> Green -> Yellow.',
        initialState: { state: 0, lastBtn: 0 }, // 0: Red, 1: Green, 2: Yellow
        compute: (inputs, tick, state) => {
            const btnC = (inputs.BTN & 1);
            const risingEdge = btnC && !state.lastBtn;
            let nextFsm = state.state;
            if (risingEdge) {
                nextFsm = (nextFsm + 1) % 3;
            }
            // Map state to LEDs: Red=LED0, Green=LED1, Yellow=LED2
            // Or typically: R=4, Y=2, G=1
            let led = 0;
            if (nextFsm === 0)
                led = 0b100; // Red
            if (nextFsm === 1)
                led = 0b001; // Green
            if (nextFsm === 2)
                led = 0b010; // Yellow
            return {
                outputs: {
                    LED: led,
                    SEG: 0,
                    AN: 0b1111,
                    DP: 1
                },
                nextState: { state: nextFsm, lastBtn: btnC }
            };
        }
    },
    'hex': {
        id: 'hex',
        name: 'Hex Decoder',
        description: 'Displays the hex value of SW3-0 on the 7-segment display.',
        compute: (inputs) => {
            const val = inputs.SW & 0xF;
            const sevenSegMap = [
                0b11000000, // 0
                0b11111001, // 1
                0b10100100, // 2
                0b10110000, // 3
                0b10011001, // 4
                0b10010010, // 5
                0b10000010, // 6
                0b11111000, // 7
                0b10000000, // 8
                0b10010000, // 9
                0b10001000, // A
                0b10000011, // b
                0b11000110, // C
                0b10100001, // d
                0b10000110, // E
                0b10001110 // F
            ];
            return {
                outputs: {
                    LED: val,
                    SEG: sevenSegMap[val],
                    AN: 0b1110, // Enable digit 0 (active low)
                    DP: 1
                }
            };
        }
    },
    'logic': {
        id: 'logic',
        name: 'Logic Gates Demo',
        description: 'Visualizes gates: LED0=AND, LED1=OR, LED2=XOR of SW0/SW1.',
        compute: (inputs) => {
            const a = (inputs.SW & 1) > 0;
            const b = (inputs.SW & 2) > 0;
            const resAnd = a && b ? 1 : 0;
            const resOr = a || b ? 1 : 0;
            const resXor = a !== b ? 1 : 0;
            return {
                outputs: {
                    LED: (resXor << 2) | (resOr << 1) | resAnd,
                    SEG: 0,
                    AN: 0b1111,
                    DP: 1
                }
            };
        }
    }
};
export const DEFAULT_EXPERIMENT = EXPERIMENTS['loopback'];
