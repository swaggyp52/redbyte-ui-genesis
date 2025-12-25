// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { Circuit } from '@redbyte/rb-logic-core';

interface HistoryState {
  past: Circuit[];
  present: Circuit | null;
  future: Circuit[];

  // Actions
  pushState: (circuit: Circuit) => void;
  undo: () => Circuit | null;
  redo: () => Circuit | null;
  clear: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const MAX_HISTORY_SIZE = 50;

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  present: null,
  future: [],

  pushState: (circuit: Circuit) => {
    const { past, present } = get();

    // Deep clone the circuit to prevent mutations
    const clonedCircuit = JSON.parse(JSON.stringify(circuit)) as Circuit;

    const newPast = present ? [...past, present] : past;

    // Limit history size
    const trimmedPast = newPast.length > MAX_HISTORY_SIZE
      ? newPast.slice(newPast.length - MAX_HISTORY_SIZE)
      : newPast;

    set({
      past: trimmedPast,
      present: clonedCircuit,
      future: [], // Clear future when new state is pushed
    });
  },

  undo: () => {
    const { past, present, future } = get();

    if (past.length === 0) {
      return null;
    }

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    const newFuture = present ? [present, ...future] : future;

    set({
      past: newPast,
      present: previous,
      future: newFuture,
    });

    return previous;
  },

  redo: () => {
    const { past, present, future } = get();

    if (future.length === 0) {
      return null;
    }

    const next = future[0];
    const newFuture = future.slice(1);
    const newPast = present ? [...past, present] : past;

    set({
      past: newPast,
      present: next,
      future: newFuture,
    });

    return next;
  },

  clear: () => {
    set({
      past: [],
      present: null,
      future: [],
    });
  },

  canUndo: () => {
    return get().past.length > 0;
  },

  canRedo: () => {
    return get().future.length > 0;
  },
}));
