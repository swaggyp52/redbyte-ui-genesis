import { LabPartDefinition, Vector3 } from './types';

/**
 * Breadboard pin coordinate system:
 * - X axis: columns (1-N), long axis of breadboard
 * - Z axis: rows (A-J), short axis
 * - Y axis: height (pins at y=0.05 above board surface)
 * 
 * Layout: A-E top half, F-J bottom half, trench between E and F
 * Rails run along X at Z extremes
 */
const buildBreadboardPins = (columns: number) => {
    const pins = [];
    const colSpacing = 0.254; // 2.54mm / 10 in "units" (standard breadboard pitch)

    // Row Z offsets: A-E on one side of trench, F-J on other
    const rowOffsets: Record<string, number> = {
        A: -1.0, B: -0.75, C: -0.5, D: -0.25, E: 0,      // Top half
        F: 0.4, G: 0.65, H: 0.9, I: 1.15, J: 1.4,        // Bottom half (gap for trench)
    };

    for (let col = 1; col <= columns; col += 1) {
        const x = (col - columns / 2) * colSpacing; // X = column position

        (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const).forEach((row) => {
            const z = rowOffsets[row]; // Z = row position
            pins.push({
                id: `${row}${col}`,
                type: 'digital' as const,
                position: { x, y: 0.05, z },
            });
        });

        // Power rails at Z extremes
        pins.push({
            id: `RAIL_TOP_${col}`,
            type: 'power' as const,
            position: { x, y: 0.05, z: -1.5 },
        });
        pins.push({
            id: `RAIL_BOTTOM_${col}`,
            type: 'ground' as const,
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
            type: 'digital' as const,
            direction: 'output' as const,
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
            type: 'digital' as const,
            direction: 'input' as const,
            position: { x, y: 0.18, z: -2.30 },
            hitRadius: 0.35
        });
    }

    // Buttons: Centered around Z=1.2
    const btnZ = 1.2;
    const btnY = 0.18;
    const btnRadius = 0.45;

    // BTNC (Center)
    pins.push({ id: 'BTNC', type: 'digital' as const, direction: 'output' as const, position: { x: 0, y: btnY, z: btnZ }, hitRadius: btnRadius });
    // BTNU (Up -> Top -> +Z relative to switches? No, switches are at -3.05 (Bottom). So Top is +Z??)
    // User Spec: "Place user IO on the “bottom” edge (negative Z)". So -Z is Bottom. +Z is Top.
    // User Spec: "BTNU: (0, btnZ + 0.65)". This moves BTNU towards +Z (Top). Correct.
    pins.push({ id: 'BTNU', type: 'digital' as const, direction: 'output' as const, position: { x: 0, y: btnY, z: btnZ + 0.65 }, hitRadius: btnRadius });
    // BTND (Down -> Bottom -> -Z)
    pins.push({ id: 'BTND', type: 'digital' as const, direction: 'output' as const, position: { x: 0, y: btnY, z: btnZ - 0.65 }, hitRadius: btnRadius });
    // BTNL (Left -> -X)
    pins.push({ id: 'BTNL', type: 'digital' as const, direction: 'output' as const, position: { x: -0.9, y: btnY, z: btnZ }, hitRadius: btnRadius });
    // BTNR (Right -> +X)
    pins.push({ id: 'BTNR', type: 'digital' as const, direction: 'output' as const, position: { x: 0.9, y: btnY, z: btnZ }, hitRadius: btnRadius });

    // Extra Pins
    pins.push({ id: 'CLK100', type: 'digital' as const, direction: 'output' as const, position: { x: 4.6, y: 0.1, z: 3.0 }, hitRadius: 0.35 });
    pins.push({ id: 'RESET', type: 'digital' as const, direction: 'output' as const, position: { x: 3.9, y: 0.1, z: 3.0 }, hitRadius: 0.35 });

    return pins;
};

export const PART_DEFINITIONS: Record<string, LabPartDefinition> = {
    'arduino-nano': {
        type: 'arduino-nano',
        name: 'Arduino Nano',
        dimensions: { x: 1.8, y: 0.5, z: 4.5 }, // Approximate units (cm or arbitrary)
        pins: [
            { id: 'D13', type: 'digital', direction: 'io', position: { x: -0.8, y: 0.2, z: -1.0 } },
            { id: 'D2', type: 'digital', direction: 'io', position: { x: -0.8, y: 0.2, z: -1.3 } },
            { id: 'GND', type: 'ground', position: { x: -0.8, y: 0.2, z: -0.5 } },
            { id: '5V', type: 'power', position: { x: -0.8, y: 0.2, z: 0.0 } },
            // ... more pins for full MVP later
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
