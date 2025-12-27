// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { ChipDefinition } from './chipStore';

export interface HierarchyLevel {
  name: string;
  circuit: Circuit;
  chipId?: string; // If this is a chip's internals
  chipDefinition?: ChipDefinition; // The chip being viewed
  parentNodeId?: string; // The node ID in parent that represents this chip
}

interface HierarchyState {
  // The stack of circuits from top-level down to current
  stack: HierarchyLevel[];

  // The currently active circuit being edited/viewed
  currentCircuit: Circuit;

  // The current chip being viewed (if inside a chip)
  currentChip: ChipDefinition | null;

  // Whether we're in edit mode (can modify chip internals)
  isEditMode: boolean;

  // Probed signals for oscilloscope
  probedSignals: Set<string>; // "nodeId.portName" format

  // Actions
  enterChip: (chip: ChipDefinition, parentNodeId: string) => void;
  exitToParent: () => void;
  exitToTop: () => void;
  setCurrentCircuit: (circuit: Circuit) => void;
  toggleEditMode: () => void;
  addProbe: (signalPath: string) => void;
  removeProbe: (signalPath: string) => void;
  clearProbes: () => void;
  reset: () => void;
}

export const useHierarchyStore = create<HierarchyState>((set, get) => ({
  stack: [],
  currentCircuit: { nodes: [], connections: [] },
  currentChip: null,
  isEditMode: false,
  probedSignals: new Set(),

  enterChip: (chip, parentNodeId) => {
    const current = get().currentCircuit;
    const currentChipDef = get().currentChip;
    set((state) => ({
      stack: [
        ...state.stack,
        {
          name: state.stack.length === 0 ? 'Top Circuit' : state.stack[state.stack.length - 1].name,
          circuit: current,
          chipDefinition: currentChipDef || undefined,
          parentNodeId,
        },
      ],
      currentCircuit: chip.subcircuit,
      currentChip: chip,
      isEditMode: false, // Start in view mode
    }));
  },

  exitToParent: () => {
    const { stack } = get();
    if (stack.length === 0) return;

    const parent = stack[stack.length - 1];
    set({
      stack: stack.slice(0, -1),
      currentCircuit: parent.circuit,
      currentChip: parent.chipDefinition || null,
      isEditMode: false,
    });
  },

  exitToTop: () => {
    const { stack } = get();
    if (stack.length === 0) return;

    const top = stack[0];
    set({
      stack: [],
      currentCircuit: top.circuit,
      currentChip: null,
      isEditMode: false,
    });
  },

  setCurrentCircuit: (circuit) => set({ currentCircuit: circuit }),

  toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode })),

  addProbe: (signalPath) =>
    set((state) => ({
      probedSignals: new Set([...state.probedSignals, signalPath]),
    })),

  removeProbe: (signalPath) =>
    set((state) => {
      const newProbes = new Set(state.probedSignals);
      newProbes.delete(signalPath);
      return { probedSignals: newProbes };
    }),

  clearProbes: () => set({ probedSignals: new Set() }),

  reset: () =>
    set({
      stack: [],
      currentCircuit: { nodes: [], connections: [] },
      currentChip: null,
      isEditMode: false,
      probedSignals: new Set(),
    }),
}));
