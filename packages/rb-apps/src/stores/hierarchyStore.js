// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createHierarchyStore() {
    return create((set, get) => ({
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
            if (stack.length === 0)
                return;
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
            if (stack.length === 0)
                return;
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
        addProbe: (signalPath) => set((state) => ({
            probedSignals: new Set([...state.probedSignals, signalPath]),
        })),
        removeProbe: (signalPath) => set((state) => {
            const newProbes = new Set(state.probedSignals);
            newProbes.delete(signalPath);
            return { probedSignals: newProbes };
        }),
        clearProbes: () => set({ probedSignals: new Set() }),
        reset: () => set({
            stack: [],
            currentCircuit: { nodes: [], connections: [] },
            currentChip: null,
            isEditMode: false,
            probedSignals: new Set(),
        }),
    }));
}
export const useHierarchyStore = ((...args) => {
    if (!_store)
        _store = createHierarchyStore();
    return _store(...args);
});
useHierarchyStore.getState = () => {
    if (!_store)
        _store = createHierarchyStore();
    return _store.getState();
};
useHierarchyStore.setState = (...a) => {
    if (!_store)
        _store = createHierarchyStore();
    return _store.setState(...a);
};
useHierarchyStore.subscribe = (...a) => {
    if (!_store)
        _store = createHierarchyStore();
    return _store.subscribe(...a);
};
