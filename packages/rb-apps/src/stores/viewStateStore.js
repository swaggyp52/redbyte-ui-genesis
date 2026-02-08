// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
// Helper to check if two Sets have the same contents
function setsEqual(a, b) {
    if (a.size !== b.size)
        return false;
    for (const item of a) {
        if (!b.has(item))
            return false;
    }
    return true;
}
// Helper to create a new Set only if contents differ
function createSetIfDifferent(current, newItems) {
    const newSet = new Set(newItems);
    if (setsEqual(current, newSet)) {
        return current; // Return same reference if contents match
    }
    return newSet;
}
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createViewStateStore() {
    return create((set, get) => ({
        // Initial state
        selectedNodeIds: new Set(),
        selectedWireIds: new Set(),
        hoveredNodeId: null,
        highlightedNodeId: null,
        focusNodeId: null,
        focusRequestId: 0,
        autoProbedNodes: new Set(),
        autoProbeEnabled: true,
        highlightProbePaths: true,
        splitScreenMode: 'single',
        activeViews: ['circuit'],
        circuitViewSize: null,
        // Selection actions
        selectNodes: (nodeIds, additive = false) => set((state) => {
            const targetItems = additive
                ? [...state.selectedNodeIds, ...nodeIds]
                : nodeIds;
            const newNodeIds = createSetIfDifferent(state.selectedNodeIds, targetItems);
            // Only clear wires if not additive and actually changing nodes
            const newWireIds = additive
                ? state.selectedWireIds
                : (state.selectedWireIds.size === 0 ? state.selectedWireIds : new Set());
            // Return same state if nothing changed
            if (newNodeIds === state.selectedNodeIds && newWireIds === state.selectedWireIds) {
                return state;
            }
            return {
                selectedNodeIds: newNodeIds,
                selectedWireIds: newWireIds,
            };
        }),
        selectWires: (wireIds, additive = false) => set((state) => {
            const targetItems = additive
                ? [...state.selectedWireIds, ...wireIds]
                : wireIds;
            const newWireIds = createSetIfDifferent(state.selectedWireIds, targetItems);
            // Only clear nodes if not additive and actually changing wires
            const newNodeIds = additive
                ? state.selectedNodeIds
                : (state.selectedNodeIds.size === 0 ? state.selectedNodeIds : new Set());
            // Return same state if nothing changed
            if (newWireIds === state.selectedWireIds && newNodeIds === state.selectedNodeIds) {
                return state;
            }
            return {
                selectedWireIds: newWireIds,
                selectedNodeIds: newNodeIds,
            };
        }),
        clearSelection: () => set((state) => {
            // Return same state if already empty
            if (state.selectedNodeIds.size === 0 && state.selectedWireIds.size === 0) {
                return state;
            }
            return {
                selectedNodeIds: new Set(),
                selectedWireIds: new Set(),
            };
        }),
        setHoveredNode: (nodeId) => set({
            hoveredNodeId: nodeId,
        }),
        setHighlightedNode: (nodeId, durationMs = 1200) => {
            set({ highlightedNodeId: nodeId });
            if (nodeId && durationMs > 0) {
                const current = nodeId;
                window.setTimeout(() => {
                    if (get().highlightedNodeId === current) {
                        set({ highlightedNodeId: null });
                    }
                }, durationMs);
            }
        },
        requestFocusNode: (nodeId) => set((state) => ({
            focusNodeId: nodeId,
            focusRequestId: state.focusRequestId + 1,
        })),
        // Auto-probe actions
        toggleAutoProbe: (nodeId) => set((state) => {
            const newProbes = new Set(state.autoProbedNodes);
            if (newProbes.has(nodeId)) {
                newProbes.delete(nodeId);
            }
            else {
                newProbes.add(nodeId);
            }
            return { autoProbedNodes: newProbes };
        }),
        setAutoProbeEnabled: (enabled) => set((state) => {
            if (state.autoProbeEnabled === enabled)
                return state;
            return { autoProbeEnabled: enabled };
        }),
        setHighlightProbePaths: (enabled) => set((state) => {
            if (state.highlightProbePaths === enabled)
                return state;
            return { highlightProbePaths: enabled };
        }),
        clearAutoProbes: () => set((state) => {
            if (state.autoProbedNodes.size === 0)
                return state;
            return { autoProbedNodes: new Set() };
        }),
        // Split-screen actions
        setSplitScreenMode: (mode) => set({
            splitScreenMode: mode,
        }),
        setActiveViews: (views) => set({
            activeViews: views,
        }),
        setCircuitViewSize: (size) => set({
            circuitViewSize: size,
        }),
    }));
}
export const useViewStateStore = ((...args) => {
    if (!_store)
        _store = createViewStateStore();
    return _store(...args);
});
useViewStateStore.getState = () => {
    if (!_store)
        _store = createViewStateStore();
    return _store.getState();
};
useViewStateStore.setState = (...a) => {
    if (!_store)
        _store = createViewStateStore();
    return _store.setState(...a);
};
useViewStateStore.subscribe = (...a) => {
    if (!_store)
        _store = createViewStateStore();
    return _store.subscribe(...a);
};
