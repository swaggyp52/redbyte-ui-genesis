// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
// Default mappings
export const DEFAULT_MAPPINGS = {
    // Basys3 Default Mapping
    'basys3': {
        // Switches 0-15
        ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`SW${i}`, { group: 'SW', bit: i }])),
        // LEDs 0-15
        ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`LED${i}`, { group: 'LED', bit: i }])),
        // Buttons (0:C, 1:U, 2:L, 3:R, 4:D - logical mapping)
        'BTN_C': { group: 'BTN', bit: 0 },
        'BTN_U': { group: 'BTN', bit: 1 },
        'BTN_L': { group: 'BTN', bit: 2 },
        'BTN_R': { group: 'BTN', bit: 3 },
        'BTN_D': { group: 'BTN', bit: 4 },
    },
    // Spartan-3E Starter Kit Default Mapping
    'spartan3e-starter': {
        // Switches 0-3
        ...Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`SW${i}`, { group: 'SW', bit: i }])),
        // LEDs 0-7
        ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`LED${i}`, { group: 'LED', bit: i }])),
        // Buttons (0:N, 1:E, 2:S, 3:W)
        'BTN_NORTH': { group: 'BTN', bit: 0 },
        'BTN_EAST': { group: 'BTN', bit: 1 },
        'BTN_SOUTH': { group: 'BTN', bit: 2 },
        'BTN_WEST': { group: 'BTN', bit: 3 },
    },
};
export function getSignalMap(boardId) {
    const normalizedId = boardId.toLowerCase();
    return DEFAULT_MAPPINGS[normalizedId] || {};
}
