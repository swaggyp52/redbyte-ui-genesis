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
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
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

  // Tool mode
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;

  // Editing state
  editingState: EditingState;
  setEditingState: (state: Partial<EditingState>) => void;
  startWire: (port: PortRef) => void;
  endWire: () => void;

  // Settings
  snapToGrid: boolean;
  toggleSnapToGrid: () => void;
  gridSize: number;
}

export const useLogicViewStore = create<LogicViewState>((set, get) => ({
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
      const nodes = addToSelection ? new Set(state.selection.nodes) : new Set<string>();
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
      const wires = addToSelection ? new Set(state.selection.wires) : new Set<string>();
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
      if (setsEqual(newNodes, state.selection.nodes) && state.selection.wires.size === 0) {
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

  // Tool mode
  toolMode: 'select',
  setToolMode: (mode) => set({ toolMode: mode }),

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
      editingState: {
        ...state.editingState,
        wireStartPort: port,
      },
    })),

  endWire: () =>
    set((state) => ({
      toolMode: 'select',
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
