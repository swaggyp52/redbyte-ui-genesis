// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Unified Project Store — Single source of truth for current project
 *
 * This store holds the canonical LabProjectV1 and provides it to all apps.
 * Apps (Logic Playground, Lab, Virtual Lab) render FROM this project,
 * not the other way around.
 *
 * Design principles:
 * - Project is canonical, apps are views
 * - Apps use adapters to transform project → app-specific render models
 * - Apps dispatch actions to mutate project
 * - Export/import work from this single store
 */
import { create } from 'zustand';
// ============================================================================
// Initial State
// ============================================================================
const INITIAL_STATE = {
    currentProject: null,
    currentCircuitId: null,
    viewConfig: {
        selectedNodes: [],
        viewportCenter: { x: 0, y: 0 },
        viewportZoom: 1,
    },
    currentRecording: null,
    isDirty: false,
};
// ============================================================================
// Store Implementation
// ============================================================================
let _store = null;
function createUnifiedProjectStore() {
    return create((set, get) => ({
        ...INITIAL_STATE,
        loadProject: (project) => {
            set({
                currentProject: project,
                currentCircuitId: project.circuit ? 'main' : null,
                isDirty: false,
            });
        },
        createNewProject: (name = 'Untitled Project') => {
            const newProject = {
                schemaVersion: '1.0',
                projectId: crypto.randomUUID?.() ?? `proj-${Date.now()}`,
                name,
                description: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                circuit: {
                    schemaVersion: '1.0',
                    nodes: [],
                    connections: [],
                    customChips: [],
                },
                simulation: {
                    tickRate: 1,
                    currentTick: 0,
                    probes: [],
                },
                evidence: {
                    actions: [],
                    snapshots: [],
                },
            };
            set({
                currentProject: newProject,
                currentCircuitId: 'main',
                isDirty: false,
            });
        },
        updateProject: (updater) => {
            const { currentProject } = get();
            if (!currentProject) {
                console.warn('[UnifiedProjectStore] Cannot update: no project loaded');
                return;
            }
            const updated = updater(currentProject);
            set({
                currentProject: {
                    ...updated,
                    updatedAt: new Date().toISOString(),
                },
                isDirty: true,
            });
        },
        markDirty: () => set({ isDirty: true }),
        markClean: () => set({ isDirty: false }),
        setSelectedNodes: (nodeIds) => set((state) => ({
            viewConfig: { ...state.viewConfig, selectedNodes: nodeIds },
        })),
        setViewport: (center, zoom) => set((state) => ({
            viewConfig: { ...state.viewConfig, viewportCenter: center, viewportZoom: zoom },
        })),
        setCurrentCircuitId: (circuitId) => set({ currentCircuitId: circuitId }),
        setCurrentRecording: (recording) => set({ currentRecording: recording }),
        reset: () => set(INITIAL_STATE),
    }));
}
// ============================================================================
// Singleton Export (prevents TDZ crashes from circular imports)
// ============================================================================
export const useUnifiedProjectStore = ((...args) => {
    if (!_store)
        _store = createUnifiedProjectStore();
    return _store(...args);
});
useUnifiedProjectStore.getState = () => {
    if (!_store)
        _store = createUnifiedProjectStore();
    return _store.getState();
};
useUnifiedProjectStore.setState = (...a) => {
    if (!_store)
        _store = createUnifiedProjectStore();
    return _store.setState(...a);
};
useUnifiedProjectStore.subscribe = (...a) => {
    if (!_store)
        _store = createUnifiedProjectStore();
    return _store.subscribe(...a);
};
