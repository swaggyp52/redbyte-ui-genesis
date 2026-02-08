// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
const STORAGE_KEY = 'rb:chips';
/**
 * Load persisted chips from localStorage
 */
function loadPersistedChips() {
    if (typeof window === 'undefined')
        return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return {};
        const envelope = JSON.parse(raw);
        if (envelope.version !== 1)
            return {};
        return envelope.chips;
    }
    catch (error) {
        console.error('Failed to load chips from localStorage:', error);
        return {};
    }
}
/**
 * Save chips to localStorage
 */
function persistChips(chips) {
    if (typeof window === 'undefined')
        return;
    try {
        const envelope = {
            version: 1,
            chips,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    }
    catch (error) {
        console.error('Failed to save chips to localStorage:', error);
    }
}
/**
 * Generate a unique chip ID
 */
function generateChipId(nextId) {
    return `chip-${nextId}`;
}
/**
 * Get current timestamp for chip creation
 */
function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createChipStore() {
    const initialChips = loadPersistedChips();
    // Calculate next ID based on existing chips
    const existingIds = Object.keys(initialChips).map((id) => {
        const match = id.match(/^chip-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
    });
    const initialNextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    return create((set, get) => ({
        chips: initialChips,
        nextId: initialNextId,
        saveChip: (name, description, layer, subcircuit, inputs, outputs, iconColor) => {
            const { chips, nextId } = get();
            const chipId = generateChipId(nextId);
            const newChip = {
                id: chipId,
                name,
                description,
                layer,
                subcircuit: JSON.parse(JSON.stringify(subcircuit)), // Deep clone
                inputs,
                outputs,
                iconColor,
                createdAt: getCurrentTimestamp(),
            };
            const updatedChips = {
                ...chips,
                [chipId]: newChip,
            };
            set({
                chips: updatedChips,
                nextId: nextId + 1,
            });
            persistChips(updatedChips);
            return newChip;
        },
        saveChipFromPattern: (pattern, subcircuit, inputs, outputs) => {
            const { saveChip } = get();
            // Generate color based on layer
            const layerColors = {
                0: '#6B7280', // gray
                1: '#3B82F6', // blue
                2: '#10B981', // green
                3: '#F59E0B', // amber
                4: '#EF4444', // red
                5: '#8B5CF6', // purple
                6: '#EC4899', // pink
            };
            return saveChip(pattern.name, pattern.description, pattern.layer, subcircuit, inputs, outputs, layerColors[pattern.layer] || '#6B7280');
        },
        deleteChip: (chipId) => {
            const { chips } = get();
            const { [chipId]: _, ...remainingChips } = chips;
            set({ chips: remainingChips });
            persistChips(remainingChips);
        },
        getChip: (chipId) => {
            return get().chips[chipId] || null;
        },
        getAllChips: () => {
            return Object.values(get().chips);
        },
        getChipsByLayer: (layer) => {
            return Object.values(get().chips).filter((chip) => chip.layer === layer);
        },
        exportJson: () => {
            const envelope = {
                version: 1,
                chips: get().chips,
            };
            return JSON.stringify(envelope, null, 2);
        },
        importJson: (json) => {
            try {
                const envelope = JSON.parse(json);
                if (envelope.version !== 1) {
                    throw new Error('Unsupported chip storage version');
                }
                set({ chips: envelope.chips });
                persistChips(envelope.chips);
            }
            catch (error) {
                console.error('Failed to import chips:', error);
                throw error;
            }
        },
        resetAll: () => {
            set({ chips: {}, nextId: 1 });
            if (typeof window !== 'undefined') {
                localStorage.removeItem(STORAGE_KEY);
            }
        },
    }));
}
/**
 * Chip store for managing saved composite nodes.
 * Lazy-initialized to prevent TDZ crash from circular imports.
 */
export const useChipStore = ((...args) => {
    if (!_store)
        _store = createChipStore();
    return _store(...args);
});
useChipStore.getState = () => {
    if (!_store)
        _store = createChipStore();
    return _store.getState();
};
useChipStore.setState = (...a) => {
    if (!_store)
        _store = createChipStore();
    return _store.setState(...a);
};
useChipStore.subscribe = (...a) => {
    if (!_store)
        _store = createChipStore();
    return _store.subscribe(...a);
};
