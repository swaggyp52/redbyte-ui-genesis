import { LabPartDefinition, Vector3 } from './types';

export const PART_DEFINITIONS: Record<string, LabPartDefinition> = {
    'arduino-nano': {
        type: 'arduino-nano',
        name: 'Arduino Nano',
        dimensions: { x: 1.8, y: 0.5, z: 4.5 }, // Approximate units (cm or arbitrary)
        pins: [
            { id: 'D13', type: 'digital', direction: 'io', position: { x: -0.8, y: 0.2, z: -1.0 } },
            { id: 'GND', type: 'ground', position: { x: -0.8, y: 0.2, z: -0.5 } },
            { id: '5V', type: 'power', position: { x: -0.8, y: 0.2, z: 0.0 } },
            // ... more pins for full MVP later
        ],
    },
    'breadboard-half': {
        type: 'breadboard-half',
        name: 'Half Breadboard',
        dimensions: { x: 8.2, y: 0.9, z: 5.5 },
        pins: [], // Breadboard logic is special, pins are rows/rails
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
};
