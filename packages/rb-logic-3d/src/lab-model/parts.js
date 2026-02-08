/**
 * Breadboard pin coordinate system:
 * - X axis: columns (1-N), long axis of breadboard
 * - Z axis: rows (A-J), short axis
 * - Y axis: height (pins at y=0.05 above board surface)
 *
 * Layout: A-E top half, F-J bottom half, trench between E and F
 * Rails run along X at Z extremes
 */
const buildBreadboardPins = (columns) => {
    const pins = [];
    const colSpacing = 0.254; // 2.54mm / 10 in "units" (standard breadboard pitch)
    // Row Z offsets: A-E on one side of trench, F-J on other
    const rowOffsets = {
        A: -1.0, B: -0.75, C: -0.5, D: -0.25, E: 0, // Top half
        F: 0.4, G: 0.65, H: 0.9, I: 1.15, J: 1.4, // Bottom half (gap for trench)
    };
    for (let col = 1; col <= columns; col += 1) {
        const x = (col - columns / 2) * colSpacing; // X = column position
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((row) => {
            const z = rowOffsets[row]; // Z = row position
            pins.push({
                id: `${row}${col}`,
                type: 'digital',
                position: { x, y: 0.05, z },
            });
        });
        // Power rails at Z extremes
        pins.push({
            id: `RAIL_TOP_${col}`,
            type: 'power',
            position: { x, y: 0.05, z: -1.5 },
        });
        pins.push({
            id: `RAIL_BOTTOM_${col}`,
            type: 'ground',
            position: { x, y: 0.05, z: 1.9 },
        });
    }
    return pins;
};
const buildBasys3Pins = () => {
    const pins = [];
    // Switch Row: SW0..SW15 at z = -3.05 (Bottom Edge)
    // X range: +4.1 (Right, SW0) to -4.1 (Left, SW15)
    // Step: 0.547
    for (let i = 0; i < 16; i++) {
        const x = 4.1 - (i * 0.547);
        pins.push({
            id: `SW${i}`,
            type: 'digital',
            direction: 'output',
            position: { x, y: 0.10, z: -3.05 },
            hitRadius: 0.35
        });
    }
    // LED Row: LED0..LED15 at z = -2.30 (Just above switches)
    // X range: SAME as switches
    for (let i = 0; i < 16; i++) {
        const x = 4.1 - (i * 0.547);
        pins.push({
            id: `LED${i}`,
            type: 'digital',
            direction: 'input',
            position: { x, y: 0.18, z: -2.30 },
            hitRadius: 0.35
        });
    }
    // Buttons: Centered around Z=1.2
    const btnZ = 1.2;
    const btnY = 0.18;
    const btnRadius = 0.45;
    // BTNC (Center)
    pins.push({ id: 'BTNC', type: 'digital', direction: 'output', position: { x: 0, y: btnY, z: btnZ }, hitRadius: btnRadius });
    pins.push({ id: 'BTNU', type: 'digital', direction: 'output', position: { x: 0, y: btnY, z: btnZ + 0.65 }, hitRadius: btnRadius });
    pins.push({ id: 'BTND', type: 'digital', direction: 'output', position: { x: 0, y: btnY, z: btnZ - 0.65 }, hitRadius: btnRadius });
    pins.push({ id: 'BTNL', type: 'digital', direction: 'output', position: { x: -0.9, y: btnY, z: btnZ }, hitRadius: btnRadius });
    pins.push({ id: 'BTNR', type: 'digital', direction: 'output', position: { x: 0.9, y: btnY, z: btnZ }, hitRadius: btnRadius });
    // Extra Pins
    pins.push({ id: 'CLK100', type: 'digital', direction: 'output', position: { x: 4.6, y: 0.1, z: 3.0 }, hitRadius: 0.35 });
    pins.push({ id: 'RESET', type: 'digital', direction: 'output', position: { x: 3.9, y: 0.1, z: 3.0 }, hitRadius: 0.35 });
    return pins;
};
export const PART_DEFINITIONS = {
    'arduino-uno': {
        type: 'arduino-uno',
        name: 'Arduino UNO',
        dimensions: { x: 6.86, y: 0.5, z: 5.34 },
        pins: [
            { id: 'D13', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: -2.3 } },
            { id: 'D12', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: -2.05 } },
            { id: 'D11', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: -1.8 } },
            { id: 'D10', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: -1.55 } },
            { id: 'D9', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: -1.3 } },
            { id: 'D8', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: -1.05 } },
            { id: 'GND1', type: 'ground', position: { x: 2.4, y: 0.2, z: -0.7 } },
            { id: 'AREF', type: 'digital', direction: 'input', position: { x: 2.4, y: 0.2, z: -0.45 } },
            { id: 'D7', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: 0.1 } },
            { id: 'D6', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: 0.35 } },
            { id: 'D5', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: 0.6 } },
            { id: 'D4', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: 0.85 } },
            { id: 'D3', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: 1.1 } },
            { id: 'D2', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: 1.35 } },
            { id: 'D1', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: 1.6 } },
            { id: 'D0', type: 'digital', direction: 'io', position: { x: 2.4, y: 0.2, z: 1.85 } },
            { id: '5V', type: 'power', position: { x: -2.0, y: 0.2, z: 1.25 } },
            { id: 'GND2', type: 'ground', position: { x: -2.0, y: 0.2, z: 1.5 } },
            { id: 'GND3', type: 'ground', position: { x: -2.0, y: 0.2, z: 1.75 } },
            { id: 'VIN', type: 'power', position: { x: -2.0, y: 0.2, z: 2.0 } },
        ],
    },
    'arduino-nano': {
        type: 'arduino-nano',
        name: 'Arduino Nano',
        dimensions: { x: 1.8, y: 0.5, z: 4.5 },
        pins: [
            { id: 'D13', type: 'digital', direction: 'io', position: { x: -0.8, y: 0.2, z: -1.0 } },
            { id: 'D2', type: 'digital', direction: 'io', position: { x: -0.8, y: 0.2, z: -1.3 } },
            { id: 'GND', type: 'ground', position: { x: -0.8, y: 0.2, z: -0.5 } },
            { id: '5V', type: 'power', position: { x: -0.8, y: 0.2, z: 0.0 } },
        ],
    },
    'fpga-basys3': {
        type: 'fpga-basys3',
        name: 'Basys3 FPGA',
        dimensions: { x: 10.2, y: 0.16, z: 7.6 },
        pins: buildBasys3Pins(),
    },
    'breadboard-half': {
        type: 'breadboard-half',
        name: 'Half Breadboard',
        dimensions: { x: 8.2, y: 0.9, z: 5.5 },
        pins: buildBreadboardPins(30),
    },
    'led-5mm': {
        type: 'led-5mm',
        name: 'Red LED',
        dimensions: { x: 0.5, y: 0.8, z: 0.5 },
        pins: [
            { id: 'anode', type: 'digital', position: { x: 0.1, y: -0.5, z: 0 } },
            { id: 'cathode', type: 'digital', position: { x: -0.1, y: -0.5, z: 0 } },
        ],
    },
    'resistor-dip': {
        type: 'resistor-dip',
        name: 'Resistor',
        dimensions: { x: 1.0, y: 0.2, z: 0.2 },
        pins: [
            { id: 'p1', type: 'digital', position: { x: -0.5, y: 0, z: 0 } },
            { id: 'p2', type: 'digital', position: { x: 0.5, y: 0, z: 0 } },
        ],
    },
    'button-momentary': {
        type: 'button-momentary',
        name: 'Push Button',
        dimensions: { x: 0.6, y: 0.3, z: 0.6 },
        pins: [
            { id: 'p1', type: 'digital', position: { x: -0.2, y: -0.1, z: 0 } },
            { id: 'p2', type: 'digital', position: { x: 0.2, y: -0.1, z: 0 } },
        ],
    },
};
