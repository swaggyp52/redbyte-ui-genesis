// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { Macro, MacroStep } from './macroTypes';

interface MacroState {
  macros: Macro[];
}

interface MacroActions {
  createMacro: (name: string, steps: MacroStep[]) => string;
  deleteMacro: (id: string) => void;
  renameMacro: (id: string, name: string) => void;
  updateMacroSteps: (id: string, steps: MacroStep[]) => void;
  getMacro: (id: string) => Macro | null;
  listMacros: () => Macro[];
}

type MacroStore = MacroState & MacroActions;

const STORAGE_KEY = 'rb:macros';

interface PersistedMacroData {
  macros: Macro[];
}

function saveMacros(macros: Macro[]): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const data: PersistedMacroData = { macros };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // Silently ignore localStorage errors
  }
}

export function loadMacros(): PersistedMacroData | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.macros)) return null;

    return parsed as PersistedMacroData;
  } catch (error) {
    // Silently ignore corrupted data
    return null;
  }
}

function loadInitialState(): MacroState {
  const data = loadMacros();
  if (!data) {
    return {
      macros: [],
    };
  }

  return {
    macros: data.macros,
  };
}

export const useMacroStore = create<MacroStore>((set, get) => ({
  ...loadInitialState(),

  createMacro: (name, steps) => {
    const id = crypto.randomUUID();
    const macro: Macro = {
      id,
      name,
      steps,
    };

    set((state) => {
      const newMacros = [...state.macros, macro];
      saveMacros(newMacros);
      return {
        macros: newMacros,
      };
    });

    return id;
  },

  deleteMacro: (id) => {
    set((state) => {
      const newMacros = state.macros.filter((m) => m.id !== id);
      saveMacros(newMacros);
      return {
        macros: newMacros,
      };
    });
  },

  renameMacro: (id, name) => {
    set((state) => {
      const newMacros = state.macros.map((m) => (m.id === id ? { ...m, name } : m));
      saveMacros(newMacros);
      return {
        macros: newMacros,
      };
    });
  },

  updateMacroSteps: (id, steps) => {
    set((state) => {
      const newMacros = state.macros.map((m) => (m.id === id ? { ...m, steps } : m));
      saveMacros(newMacros);
      return {
        macros: newMacros,
      };
    });
  },

  getMacro: (id) => {
    return get().macros.find((m) => m.id === id) || null;
  },

  listMacros: () => {
    return get().macros;
  },
}));
