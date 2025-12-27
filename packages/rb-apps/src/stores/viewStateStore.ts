// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { create } from 'zustand';

export type SplitScreenMode = 'single' | 'horizontal' | 'vertical' | 'quad';
export type ViewMode = 'circuit' | 'schematic' | 'oscilloscope' | '3d';

interface ViewStateStore {
  // Selection state
  selectedNodeIds: Set<string>;
  selectedWireIds: Set<string>;
  hoveredNodeId: string | null;

  // Auto-probe state
  autoProbedNodes: Set<string>;
  autoProbeEnabled: boolean;

  // Split-screen configuration
  splitScreenMode: SplitScreenMode;
  activeViews: ViewMode[];

  // Selection actions
  selectNodes: (nodeIds: string[], additive?: boolean) => void;
  selectWires: (wireIds: string[], additive?: boolean) => void;
  clearSelection: () => void;
  setHoveredNode: (nodeId: string | null) => void;

  // Auto-probe actions
  toggleAutoProbe: (nodeId: string) => void;
  setAutoProbeEnabled: (enabled: boolean) => void;
  clearAutoProbes: () => void;

  // Split-screen actions
  setSplitScreenMode: (mode: SplitScreenMode) => void;
  setActiveViews: (views: ViewMode[]) => void;
}

export const useViewStateStore = create<ViewStateStore>((set) => ({
  // Initial state
  selectedNodeIds: new Set<string>(),
  selectedWireIds: new Set<string>(),
  hoveredNodeId: null,
  autoProbedNodes: new Set<string>(),
  autoProbeEnabled: true,
  splitScreenMode: 'single',
  activeViews: ['circuit'],

  // Selection actions
  selectNodes: (nodeIds: string[], additive = false) =>
    set((state) => {
      const newSelection = additive
        ? new Set([...state.selectedNodeIds, ...nodeIds])
        : new Set(nodeIds);

      return {
        selectedNodeIds: newSelection,
        selectedWireIds: additive ? state.selectedWireIds : new Set(),
      };
    }),

  selectWires: (wireIds: string[], additive = false) =>
    set((state) => {
      const newSelection = additive
        ? new Set([...state.selectedWireIds, ...wireIds])
        : new Set(wireIds);

      return {
        selectedWireIds: newSelection,
        selectedNodeIds: additive ? state.selectedNodeIds : new Set(),
      };
    }),

  clearSelection: () =>
    set({
      selectedNodeIds: new Set(),
      selectedWireIds: new Set(),
    }),

  setHoveredNode: (nodeId: string | null) =>
    set({
      hoveredNodeId: nodeId,
    }),

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
    set({
      autoProbeEnabled: enabled,
    }),

  clearAutoProbes: () =>
    set({
      autoProbedNodes: new Set(),
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
}));
