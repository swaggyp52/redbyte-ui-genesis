// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';

export type SplitScreenMode = 'single' | 'horizontal' | 'vertical' | 'quad';
export type ViewMode = 'circuit' | 'schematic' | 'oscilloscope' | '3d';

// Helper to check if two Sets have the same contents
function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

// Helper to create a new Set only if contents differ
function createSetIfDifferent<T>(current: Set<T>, newItems: T[]): Set<T> {
  const newSet = new Set(newItems);
  if (setsEqual(current, newSet)) {
    return current; // Return same reference if contents match
  }
  return newSet;
}

interface ViewStateStore {
  // Selection state
  selectedNodeIds: Set<string>;
  selectedWireIds: Set<string>;
  hoveredNodeId: string | null;
  highlightedNodeId: string | null;
  focusNodeId: string | null;
  focusRequestId: number;

  // Auto-probe state
  autoProbedNodes: Set<string>;
  autoProbeEnabled: boolean;
  highlightProbePaths: boolean;

  // Split-screen configuration
  splitScreenMode: SplitScreenMode;
  activeViews: ViewMode[];

  // Circuit view bounds (for fit/reset commands)
  circuitViewSize: { width: number; height: number } | null;
  setCircuitViewSize: (size: { width: number; height: number } | null) => void;

  // Selection actions
  selectNodes: (nodeIds: string[], additive?: boolean) => void;
  selectWires: (wireIds: string[], additive?: boolean) => void;
  clearSelection: () => void;
  setHoveredNode: (nodeId: string | null) => void;
  setHighlightedNode: (nodeId: string | null, durationMs?: number) => void;
  requestFocusNode: (nodeId: string) => void;

  // Auto-probe actions
  toggleAutoProbe: (nodeId: string) => void;
  setAutoProbeEnabled: (enabled: boolean) => void;
  setHighlightProbePaths: (enabled: boolean) => void;
  clearAutoProbes: () => void;

  // Split-screen actions
  setSplitScreenMode: (mode: SplitScreenMode) => void;
  setActiveViews: (views: ViewMode[]) => void;
}

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createViewStateStore> | null = null;

function createViewStateStore() {
  return create<ViewStateStore>((set, get) => ({
    // Initial state
    selectedNodeIds: new Set<string>(),
    selectedWireIds: new Set<string>(),
    hoveredNodeId: null,
    highlightedNodeId: null,
    focusNodeId: null,
    focusRequestId: 0,
    autoProbedNodes: new Set<string>(),
    autoProbeEnabled: true,
    highlightProbePaths: true,
    splitScreenMode: 'single',
    activeViews: ['circuit'],
    circuitViewSize: null,

    // Selection actions
    selectNodes: (nodeIds: string[], additive = false) =>
      set((state) => {
        const targetItems = additive
          ? [...state.selectedNodeIds, ...nodeIds]
          : nodeIds;
        const newNodeIds = createSetIfDifferent(state.selectedNodeIds, targetItems);

        // Only clear wires if not additive and actually changing nodes
        const newWireIds = additive
          ? state.selectedWireIds
          : (state.selectedWireIds.size === 0 ? state.selectedWireIds : new Set<string>());

        // Return same state if nothing changed
        if (newNodeIds === state.selectedNodeIds && newWireIds === state.selectedWireIds) {
          return state;
        }

        return {
          selectedNodeIds: newNodeIds,
          selectedWireIds: newWireIds,
        };
      }),

    selectWires: (wireIds: string[], additive = false) =>
      set((state) => {
        const targetItems = additive
          ? [...state.selectedWireIds, ...wireIds]
          : wireIds;
        const newWireIds = createSetIfDifferent(state.selectedWireIds, targetItems);

        // Only clear nodes if not additive and actually changing wires
        const newNodeIds = additive
          ? state.selectedNodeIds
          : (state.selectedNodeIds.size === 0 ? state.selectedNodeIds : new Set<string>());

        // Return same state if nothing changed
        if (newWireIds === state.selectedWireIds && newNodeIds === state.selectedNodeIds) {
          return state;
        }

        return {
          selectedWireIds: newWireIds,
          selectedNodeIds: newNodeIds,
        };
      }),

    clearSelection: () =>
      set((state) => {
        // Return same state if already empty
        if (state.selectedNodeIds.size === 0 && state.selectedWireIds.size === 0) {
          return state;
        }
        return {
          selectedNodeIds: new Set(),
          selectedWireIds: new Set(),
        };
      }),

    setHoveredNode: (nodeId: string | null) =>
      set({
        hoveredNodeId: nodeId,
      }),

    setHighlightedNode: (nodeId: string | null, durationMs: number = 1200) => {
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

    requestFocusNode: (nodeId: string) =>
      set((state) => ({
        focusNodeId: nodeId,
        focusRequestId: state.focusRequestId + 1,
      })),

    // Auto-probe actions
    toggleAutoProbe: (nodeId: string) =>
      set((state) => {
        const newProbes = new Set(state.autoProbedNodes);
        if (newProbes.has(nodeId)) {
          newProbes.delete(nodeId);
        } else {
          newProbes.add(nodeId);
        }
        return { autoProbedNodes: newProbes };
      }),

    setAutoProbeEnabled: (enabled: boolean) =>
      set((state) => {
        if (state.autoProbeEnabled === enabled) return state;
        return { autoProbeEnabled: enabled };
      }),

    setHighlightProbePaths: (enabled: boolean) =>
      set((state) => {
        if (state.highlightProbePaths === enabled) return state;
        return { highlightProbePaths: enabled };
      }),

    clearAutoProbes: () =>
      set((state) => {
        if (state.autoProbedNodes.size === 0) return state;
        return { autoProbedNodes: new Set() };
      }),

    // Split-screen actions
    setSplitScreenMode: (mode: SplitScreenMode) =>
      set({
        splitScreenMode: mode,
      }),

    setActiveViews: (views: ViewMode[]) =>
      set({
        activeViews: views,
      }),

    setCircuitViewSize: (size) =>
      set({
        circuitViewSize: size,
      }),
  }));
}

export const useViewStateStore: ReturnType<typeof createViewStateStore> = ((...args: any[]) => {
  if (!_store) _store = createViewStateStore();
  return (_store as any)(...args);
}) as any;

(useViewStateStore as any).getState = () => {
  if (!_store) _store = createViewStateStore();
  return (_store as any).getState();
};

(useViewStateStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createViewStateStore();
  return (_store as any).setState(...a);
};

(useViewStateStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createViewStateStore();
  return (_store as any).subscribe(...a);
};
