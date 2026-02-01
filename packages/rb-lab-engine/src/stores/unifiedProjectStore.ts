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
import type { LabProjectV1 } from '@redbyte/rb-utils';

// ============================================================================
// Store State & Actions
// ============================================================================

export interface UnifiedProjectState {
  // Current project (null = no project loaded)
  currentProject: LabProjectV1 | null;

  // Which circuit/view is currently active (for multi-circuit projects)
  currentCircuitId: string | null;

  // View configuration (shared across apps)
  viewConfig: {
    selectedNodes: string[]; // Selected node IDs
    viewportCenter: { x: number; y: number };
    viewportZoom: number;
  };

  // Recording state (optional)
  currentRecording: unknown | null; // TODO: type this properly

  // Dirty flag (unsaved changes)
  isDirty: boolean;
}

export interface UnifiedProjectActions {
  // Load project (from import, example, or new)
  loadProject: (project: LabProjectV1) => void;

  // Create new blank project
  createNewProject: (name?: string) => void;

  // Update project (for app mutations)
  updateProject: (updater: (project: LabProjectV1) => LabProjectV1) => void;

  // Mark as dirty/clean
  markDirty: () => void;
  markClean: () => void;

  // View configuration
  setSelectedNodes: (nodeIds: string[]) => void;
  setViewport: (center: { x: number; y: number }, zoom: number) => void;

  // Circuit selection (for multi-circuit projects)
  setCurrentCircuitId: (circuitId: string | null) => void;

  // Recording
  setCurrentRecording: (recording: unknown | null) => void;

  // Reset store
  reset: () => void;
}

export type UnifiedProjectStore = UnifiedProjectState & UnifiedProjectActions;

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_STATE: UnifiedProjectState = {
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

let _store: ReturnType<typeof createUnifiedProjectStore> | null = null;

function createUnifiedProjectStore() {
  return create<UnifiedProjectStore>((set, get) => ({
    ...INITIAL_STATE,

    loadProject: (project) => {
      set({
        currentProject: project,
        currentCircuitId: project.circuit ? 'main' : null,
        isDirty: false,
      });
    },

    createNewProject: (name = 'Untitled Project') => {
      const newProject: LabProjectV1 = {
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

    setSelectedNodes: (nodeIds) =>
      set((state) => ({
        viewConfig: { ...state.viewConfig, selectedNodes: nodeIds },
      })),

    setViewport: (center, zoom) =>
      set((state) => ({
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

export const useUnifiedProjectStore: ReturnType<typeof createUnifiedProjectStore> = ((
  ...args: any[]
) => {
  if (!_store) _store = createUnifiedProjectStore();
  return (_store as any)(...args);
}) as any;

(useUnifiedProjectStore as any).getState = () => {
  if (!_store) _store = createUnifiedProjectStore();
  return (_store as any).getState();
};

(useUnifiedProjectStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createUnifiedProjectStore();
  return (_store as any).setState(...a);
};

(useUnifiedProjectStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createUnifiedProjectStore();
  return (_store as any).subscribe(...a);
};
