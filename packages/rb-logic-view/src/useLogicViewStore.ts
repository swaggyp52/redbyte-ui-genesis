// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';
import type { PortRef } from '@redbyte/rb-logic-core';

// Global view state sync (optional import for apps that use it)
let globalViewStateStore: any = null;

export function setGlobalViewStateSync(store: any) {
  globalViewStateStore = store;
}

export function getGlobalViewStateStore() {
  return globalViewStateStore;
}

// Helper to check if two Sets have the same contents
function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (!a || !b || !a.size || !b.size) return a === b;
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

// Helper to safely clone a Set even if input is malformed (e.g. plain object from JSON)
function safeSet<T>(input: any): Set<T> {
  if (input instanceof Set) return new Set(input);
  if (Array.isArray(input)) return new Set(input);
  return new Set();
}

// Helper to create a new Set only if contents differ
function createSetIfDifferent<T>(current: Set<T>, newItems: T[]): Set<T> {
  const newSet = new Set(newItems);
  if (current instanceof Set && setsEqual(current, newSet)) {
    return current; // Return same reference if contents match
  }
  return newSet;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Selection {
  nodes: Set<string>;
  wires: Set<string>;
}

export type ToolMode = 'select' | 'wire' | 'pan';

/**
 * Interaction mode is the single source of truth for what the user is currently doing.
 * Only ONE mode can be active at a time. This prevents conflicting handlers.
 */
export type InteractionMode =
  | 'idle'
  | 'placing'
  | 'draggingNode'
  | 'boxSelecting'
  | 'wiring'
  | 'panning';

export interface EditingState {
  wireStartPort?: PortRef;
  isDragging: boolean;
  dragStart?: { x: number; y: number };
  marquee?: { x1: number; y1: number; x2: number; y2: number };
}

export interface LogicViewState {
  // Camera
  camera: Camera;
  setCamera: (camera: Partial<Camera>) => void;
  pan: (dx: number, dy: number) => void;
  zoom: (delta: number, centerX?: number, centerY?: number) => void;

  // Selection
  selection: Selection;
  selectNode: (nodeId: string, addToSelection?: boolean) => void;
  selectWire: (wireId: string, addToSelection?: boolean) => void;
  clearSelection: () => void;
  selectMultipleNodes: (nodeIds: string[], syncToGlobal?: boolean) => void;

  // Tool mode (legacy, kept for toolbar compatibility)
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;

  // Interaction mode - THE source of truth for current user interaction
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;

  // Helper to check if an interaction can start
  canStartInteraction: (mode: InteractionMode) => boolean;

  // Editing state
  editingState: EditingState;
  setEditingState: (state: Partial<EditingState>) => void;
  startWire: (port: PortRef) => void;
  endWire: () => void;

  // Hover state (wire hover — drives endpoint affordance handles)
  hoveredWireId: string | null;
  setHoveredWireId: (id: string | null) => void;

  // Settings
  snapToGrid: boolean;
  toggleSnapToGrid: () => void;
  gridSize: number;
}

// Lazy-init singleton to prevent TDZ crash from circular imports
let _storeInternal: ReturnType<typeof createLogicViewStore> | null = null;

function createLogicViewStore() {
  return create<LogicViewState>((set, get) => ({
    // Initial camera state
    camera: {
      x: 0,
      y: 0,
      zoom: 1,
    },

    setCamera: (camera) =>
      set((state) => ({
        camera: { ...state.camera, ...camera },
      })),

    pan: (dx, dy) =>
      set((state) => ({
        camera: {
          ...state.camera,
          x: state.camera.x + dx,
          y: state.camera.y + dy,
        },
      })),

    zoom: (delta, centerX = 0, centerY = 0) =>
      set((state) => {
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

    selectNode: (nodeId, addToSelection = false) =>
      set((state) => {
        const nodes = addToSelection ? safeSet<string>(state.selection.nodes) : new Set<string>();
        if (nodes.has(nodeId)) {
          nodes.delete(nodeId);
        } else {
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

    selectWire: (wireId, addToSelection = false) =>
      set((state) => {
        const wires = addToSelection ? safeSet<string>(state.selection.wires) : new Set<string>();
        if (wires.has(wireId)) {
          wires.delete(wireId);
        } else {
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

    clearSelection: () =>
      set((state) => {
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

    selectMultipleNodes: (nodeIds, syncToGlobal = true) =>
      set((state) => {
        const newNodes = new Set(nodeIds);

        // Check if selection actually changed
        if (setsEqual(newNodes, safeSet<string>(state.selection.nodes)) && safeSet<string>(state.selection.wires).size === 0) {
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
    interactionMode: 'idle' as InteractionMode,
    setInteractionMode: (mode: InteractionMode) => set({ interactionMode: mode }),

    // Helper to check if an interaction can start (only when idle)
    canStartInteraction: (mode: InteractionMode) => {
      const current = get().interactionMode;
      // Can always transition to idle
      if (mode === 'idle') return true;
      // Can only start a new interaction from idle
      return current === 'idle';
    },

    // Editing state
    editingState: {
      isDragging: false,
    },

    setEditingState: (state) =>
      set((prev) => ({
        editingState: { ...prev.editingState, ...state },
      })),

    startWire: (port) =>
      set((state) => ({
        toolMode: 'wire',
        interactionMode: 'wiring' as InteractionMode,
        editingState: {
          ...state.editingState,
          wireStartPort: port,
        },
      })),

    endWire: () =>
      set((state) => ({
        toolMode: 'select',
        interactionMode: 'idle' as InteractionMode,
        editingState: {
          ...state.editingState,
          wireStartPort: undefined,
        },
      })),

    // Hover state
    hoveredWireId: null,
    setHoveredWireId: (id) => set({ hoveredWireId: id }),

    // Settings
    snapToGrid: true,
    toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
    gridSize: 16,
  }));
}

// Dev-only storm detector to surface runaway store updates.
// Dev-only storm detector to surface runaway store updates.
function getStore() {
  if (!_storeInternal) _storeInternal = createLogicViewStore();
  const api = _storeInternal as any;

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    if (!window.__rbLogicViewStorePatched) {
      window.__rbLogicViewStorePatched = true;
      const originalSetState = api.setState.bind(api);
      let tickStart = performance.now();
      let updateCount = 0;
      api.setState = (partial: any, replace?: boolean) => {
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

// Explicitly type the store to preserve inference
import type { StoreApi, UseBoundStore } from 'zustand';

// In Zustand v5, we should expose the hook directly.
// The manual proxy approach was causing signature mismatches (0-1 args vs 2).
export const useLogicViewStore = ((selector?: any) => {
  return getStore()(selector);
}) as UseBoundStore<StoreApi<LogicViewState>>;

// Copy static methods to the hook to maintain compatibility
Object.assign(useLogicViewStore, {
  getState: () => getStore().getState(),
  setState: (...args: [any]) => getStore().setState(...args),
  subscribe: (listener: any) => getStore().subscribe(listener),
  destroy: () => { }, // mock destroy to satisfy interface
});

declare global {
  interface Window {
    __rbLogicViewStorePatched?: boolean;
    __rbLogicViewStoreStorm?: boolean;
    __RB_LOGIC_VIEW_STORE__?: typeof useLogicViewStore;
  }
}

if (typeof window !== 'undefined') {
  window.__RB_LOGIC_VIEW_STORE__ = useLogicViewStore;
}
