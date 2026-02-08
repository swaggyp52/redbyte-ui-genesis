// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
const STORAGE_KEY = 'rb:macros';
function saveMacros(macros) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        const data = { macros };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    catch (error) {
        // Silently ignore localStorage errors
    }
}
export function loadMacros() {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return null;
        if (!Array.isArray(parsed.macros))
            return null;
        return parsed;
    }
    catch (error) {
        // Silently ignore corrupted data
        return null;
    }
}
function loadInitialState() {
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
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createMacroStore() {
    return create((set, get) => ({
        ...loadInitialState(),
        createMacro: (name, steps) => {
            const id = crypto.randomUUID();
            const macro = {
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
}
export const useMacroStore = ((...args) => {
    if (!_store)
        _store = createMacroStore();
    return _store(...args);
});
useMacroStore.getState = () => {
    if (!_store)
        _store = createMacroStore();
    return _store.getState();
};
useMacroStore.setState = (...a) => {
    if (!_store)
        _store = createMacroStore();
    return _store.setState(...a);
};
useMacroStore.subscribe = (...a) => {
    if (!_store)
        _store = createMacroStore();
    return _store.subscribe(...a);
};
