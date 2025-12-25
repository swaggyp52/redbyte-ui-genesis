// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RecognizedPattern } from '../patterns/patternMatcher';

/**
 * Port definition for a chip
 */
export interface ChipPort {
  id: string;
  name: string;
  type: 'input' | 'output';
  nodeRef: string; // "nodeId.portName" in the subcircuit
}

/**
 * A saved chip definition
 */
export interface ChipDefinition {
  id: string;
  name: string;
  description: string;
  layer: number;
  subcircuit: Circuit;
  inputs: ChipPort[];
  outputs: ChipPort[];
  iconColor?: string; // Optional color for visual distinction
  createdAt: string;
}

const STORAGE_KEY = 'rb:chips';

interface ChipStorageEnvelope {
  version: 1;
  chips: Record<string, ChipDefinition>;
}

interface ChipStoreState {
  chips: Record<string, ChipDefinition>;
  nextId: number;

  // Actions
  saveChip: (
    name: string,
    description: string,
    layer: number,
    subcircuit: Circuit,
    inputs: ChipPort[],
    outputs: ChipPort[],
    iconColor?: string
  ) => ChipDefinition;
  saveChipFromPattern: (
    pattern: RecognizedPattern,
    subcircuit: Circuit,
    inputs: ChipPort[],
    outputs: ChipPort[]
  ) => ChipDefinition;
  deleteChip: (chipId: string) => void;
  getChip: (chipId: string) => ChipDefinition | null;
  getAllChips: () => ChipDefinition[];
  getChipsByLayer: (layer: number) => ChipDefinition[];
  exportJson: () => string;
  importJson: (json: string) => void;
  resetAll: () => void;
}

/**
 * Load persisted chips from localStorage
 */
function loadPersistedChips(): Record<string, ChipDefinition> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const envelope = JSON.parse(raw) as ChipStorageEnvelope;
    if (envelope.version !== 1) return {};

    return envelope.chips;
  } catch (error) {
    console.error('Failed to load chips from localStorage:', error);
    return {};
  }
}

/**
 * Save chips to localStorage
 */
function persistChips(chips: Record<string, ChipDefinition>): void {
  if (typeof window === 'undefined') return;

  try {
    const envelope: ChipStorageEnvelope = {
      version: 1,
      chips,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch (error) {
    console.error('Failed to save chips to localStorage:', error);
  }
}

/**
 * Generate a unique chip ID
 */
function generateChipId(nextId: number): string {
  return `chip-${nextId}`;
}

/**
 * Get current timestamp for chip creation
 */
function getCurrentTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Chip store for managing saved composite nodes
 */
export const useChipStore = create<ChipStoreState>((set, get) => {
  const initialChips = loadPersistedChips();

  // Calculate next ID based on existing chips
  const existingIds = Object.keys(initialChips).map((id) => {
    const match = id.match(/^chip-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const initialNextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

  return {
    chips: initialChips,
    nextId: initialNextId,

    saveChip: (name, description, layer, subcircuit, inputs, outputs, iconColor) => {
      const { chips, nextId } = get();
      const chipId = generateChipId(nextId);

      const newChip: ChipDefinition = {
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
      const layerColors: Record<number, string> = {
        0: '#6B7280', // gray
        1: '#3B82F6', // blue
        2: '#10B981', // green
        3: '#F59E0B', // amber
        4: '#EF4444', // red
        5: '#8B5CF6', // purple
        6: '#EC4899', // pink
      };

      return saveChip(
        pattern.name,
        pattern.description,
        pattern.layer,
        subcircuit,
        inputs,
        outputs,
        layerColors[pattern.layer] || '#6B7280'
      );
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
      const envelope: ChipStorageEnvelope = {
        version: 1,
        chips: get().chips,
      };
      return JSON.stringify(envelope, null, 2);
    },

    importJson: (json) => {
      try {
        const envelope = JSON.parse(json) as ChipStorageEnvelope;
        if (envelope.version !== 1) {
          throw new Error('Unsupported chip storage version');
        }

        set({ chips: envelope.chips });
        persistChips(envelope.chips);
      } catch (error) {
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
  };
});
