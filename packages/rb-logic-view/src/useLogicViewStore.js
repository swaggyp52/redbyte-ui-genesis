// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
// Global view state sync (optional import for apps that use it)
let globalViewStateStore = null;
export function setGlobalViewStateSync(store) {
    globalViewStateStore = store;
}
export function getGlobalViewStateStore() {
    return globalViewStateStore;
}
// Helper to check if two Sets have the same contents
function setsEqual(a, b) {
    if (!a || !b || !a.size || !b.size)
        return a === b;
    if (a.size !== b.size)
        return false;
    for (const item of a) {
        if (!b.has(item))
            return false;
    }
    return true;
}
// Helper to safely clone a Set even if input is malformed (e.g. plain object from JSON)
function safeSet(input) {
    if (input instanceof Set)
        return new Set(input);
    if (Array.isArray(input))
        return new Set(input);
    return new Set();
}
// Helper to create a new Set only if contents differ
function createSetIfDifferent(current, newItems) {
    const newSet = new Set(newItems);
    if (current instanceof Set && setsEqual(current, newSet)) {
        return current; // Return same reference if contents match
    }
    return newSet;
}
// Lazy-init singleton to prevent TDZ crash from circular imports
let _storeInternal = null;
function createLogicViewStore() {
    return create((set, get) => ({
        // Initial camera state
        camera: {
            x: 0,
            y: 0,
            zoom: 1,
        },
        setCamera: (camera) => set((state) => ({
            camera: { ...state.camera, ...camera },
        })),
        pan: (dx, dy) => set((state) => ({
            camera: {
                ...state.camera,
                x: state.camera.x + dx,
                y: state.camera.y + dy,
            },
        })),
        zoom: (delta, centerX = 0, centerY = 0) => set((state) => {
            const oldZoom = state.camera.zoom;
            const newZoom = Math.max(0.25, Math.min(4, oldZoom * (1 + delta * 0.001)));
            // Zoom towards cursor position
            const zoomFactor = newZoom / oldZoom;
            const newX = centerX - (centerX - state.camera.x) * zoomFactor;
            const newY = centerY - (centerY - state.camera.y) * zoomFactor;
            return {
                camera: {
                    x: newX,
                    y: newY,
                    zoom: newZoom,
                },
            };
        }),
        // Selection state
        selection: {
            nodes: new Set(),
            wires: new Set(),
        },
        selectNode: (nodeId, addToSelection = false) => set((state) => {
            const nodes = addToSelection ? safeSet(state.selection.nodes) : new Set();
            if (nodes.has(nodeId)) {
                nodes.delete(nodeId);
            }
            else {
                nodes.add(nodeId);
            }
            // Check if selection actually changed
            if (setsEqual(nodes, state.selection.nodes)) {
                return state;
            }
            // Sync with global view state if available (async to break loop)
            if (globalViewStateStore) {
                const nodeArray = Array.from(nodes);
                queueMicrotask(() => {
                    globalViewStateStore.getState().selectNodes(nodeArray, false);
                });
            }
            return {
                selection: {
                    ...state.selection,
                    nodes,
                },
            };
        }),
        selectWire: (wireId, addToSelection = false) => set((state) => {
            const wires = addToSelection ? safeSet(state.selection.wires) : new Set();
            if (wires.has(wireId)) {
                wires.delete(wireId);
            }
            else {
                wires.add(wireId);
            }
            // Check if selection actually changed
            if (setsEqual(wires, state.selection.wires)) {
                return state;
            }
            // Sync with global view state if available (async to break loop)
            if (globalViewStateStore) {
                const wireArray = Array.from(wires);
                queueMicrotask(() => {
                    globalViewStateStore.getState().selectWires(wireArray, false);
                });
            }
            return {
                selection: {
                    ...state.selection,
                    wires,
                },
            };
        }),
        clearSelection: () => set((state) => {
            // Check if already empty
            if (state.selection.nodes.size === 0 && state.selection.wires.size === 0) {
                return state;
            }
            // Sync with global view state if available (async to break loop)
            if (globalViewStateStore) {
                queueMicrotask(() => {
                    globalViewStateStore.getState().clearSelection();
                });
            }
            return {
                selection: {
                    nodes: new Set(),
                    wires: new Set(),
                },
            };
        }),
        selectMultipleNodes: (nodeIds, syncToGlobal = true) => set((state) => {
            const newNodes = new Set(nodeIds);
            // Check if selection actually changed
            if (setsEqual(newNodes, safeSet(state.selection.nodes)) && safeSet(state.selection.wires).size === 0) {
                return state;
            }
            // Only sync with global view state if this is a local change (async to break loop)
            if (syncToGlobal && globalViewStateStore) {
                queueMicrotask(() => {
                    globalViewStateStore.getState().selectNodes(nodeIds, false);
                });
            }
            return {
                selection: {
                    nodes: newNodes,
                    wires: new Set(),
                },
            };
        }),
        // Tool mode (legacy, kept for toolbar compatibility)
        toolMode: 'select',
        setToolMode: (mode) => set({ toolMode: mode }),
        // Interaction mode - single source of truth
        interactionMode: 'idle',
        setInteractionMode: (mode) => set({ interactionMode: mode }),
        // Helper to check if an interaction can start (only when idle)
        canStartInteraction: (mode) => {
            const current = get().interactionMode;
            // Can always transition to idle
            if (mode === 'idle')
                return true;
            // Can only start a new interaction from idle
            return current === 'idle';
        },
        // Editing state
        editingState: {
            isDragging: false,
        },
        setEditingState: (state) => set((prev) => ({
            editingState: { ...prev.editingState, ...state },
        })),
        startWire: (port) => set((state) => ({
            toolMode: 'wire',
            interactionMode: 'wiring',
            editingState: {
                ...state.editingState,
                wireStartPort: port,
            },
        })),
        endWire: () => set((state) => ({
            toolMode: 'select',
            interactionMode: 'idle',
            editingState: {
                ...state.editingState,
                wireStartPort: undefined,
            },
        })),
        // Settings
        snapToGrid: true,
        toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
        gridSize: 16,
    }));
}
// Dev-only storm detector to surface runaway store updates.
// Dev-only storm detector to surface runaway store updates.
function getStore() {
    if (!_storeInternal)
        _storeInternal = createLogicViewStore();
    const api = _storeInternal;
    if (import.meta.env.DEV && typeof window !== 'undefined') {
        if (!window.__rbLogicViewStorePatched) {
            window.__rbLogicViewStorePatched = true;
            const originalSetState = api.setState.bind(api);
            let tickStart = performance.now();
            let updateCount = 0;
            api.setState = (partial, replace) => {
                const now = performance.now();
                if (now - tickStart > 1000) {
                    tickStart = now;
                    updateCount = 0;
                }
                updateCount += 1;
                if (updateCount > 5 && !window.__rbLogicViewStoreStorm) {
                    window.__rbLogicViewStoreStorm = true;
                    // eslint-disable-next-line no-console
                    console.warn('[logic-view] store update storm', { updateCount, stack: new Error().stack });
                    window.setTimeout(() => {
                        window.__rbLogicViewStoreStorm = false;
                    }, 1000);
                }
                return originalSetState(partial, replace);
            };
        }
    }
    return _storeInternal;
}
// In Zustand v5, we should expose the hook directly.
// The manual proxy approach was causing signature mismatches (0-1 args vs 2).
export const useLogicViewStore = ((selector) => {
    return getStore()(selector);
});
// Copy static methods to the hook to maintain compatibility
Object.assign(useLogicViewStore, {
    getState: () => getStore().getState(),
    setState: (...args) => getStore().setState(...args),
    subscribe: (listener) => getStore().subscribe(listener),
    destroy: () => { }, // mock destroy to satisfy interface
});
