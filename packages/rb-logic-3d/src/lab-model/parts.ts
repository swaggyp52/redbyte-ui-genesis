import { LabPartDefinition, Vector3 } from './types';

const buildBreadboardPins = (columns: number) => {
    const pins = [];
    const spacing = 0.3;
    const rowOffsets: Record<string, number> = {
        A: -0.6, B: -0.45, C: -0.3, D: -0.15, E: 0,
        F: 0.3, G: 0.45, H: 0.6, I: 0.75, J: 0.9,
    };

    for (let col = 1; col <= columns; col += 1) {
        const z = (col - columns / 2) * spacing;
        (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const).forEach((row) => {
            const x = rowOffsets[row];
            pins.push({
                id: `${row}${col}`,
                type: 'digital' as const,
                position: { x, y: 0, z },
            });
        });

        pins.push({
            id: `RAIL_TOP_${col}`,
            type: 'power' as const,
            position: { x: -1.2, y: 0, z },
        });
        pins.push({
            id: `RAIL_BOTTOM_${col}`,
            type: 'ground' as const,
            position: { x: 1.2, y: 0, z },
        });
    }

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
