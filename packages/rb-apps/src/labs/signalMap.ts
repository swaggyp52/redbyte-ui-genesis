// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export interface HardwareMapping {
    // e.g., 'SW' or 'LED'
    group: string;
    // bit index, e.g., 0 for SW0
    bit: number;
}

// Map: Sim Signal Name -> Hardware Location
export type SignalMap = Record<string, HardwareMapping>;

// Default mappings
export const DEFAULT_MAPPINGS: Record<string, SignalMap> = {
    // Basys3 Default Mapping
    'basys3': {
        'input_0': { group: 'SW', bit: 0 },
        'input_1': { group: 'SW', bit: 1 },
        'input_2': { group: 'SW', bit: 2 },
        'input_3': { group: 'SW', bit: 3 },
        'output_0': { group: 'LED', bit: 0 },
        'output_1': { group: 'LED', bit: 1 },
        'output_2': { group: 'LED', bit: 2 },
        'output_3': { group: 'LED', bit: 3 },
    },
    // Spartan-3E Default Mapping
    'spartan3e-starter': {
        'input_0': { group: 'SW', bit: 0 },
        'input_1': { group: 'SW', bit: 1 },
        'output_0': { group: 'LED', bit: 0 },
        'output_1': { group: 'LED', bit: 1 },
    },
};

export function getSignalMap(boardId: string): SignalMap {
    const normalizedId = boardId.toLowerCase();
    return DEFAULT_MAPPINGS[normalizedId] || {};
}
