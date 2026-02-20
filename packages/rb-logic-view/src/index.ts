// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// Main component
export { LogicCanvas } from './LogicCanvas';
export type { LogicCanvasProps } from './LogicCanvas';

// Store
export { useLogicViewStore, setGlobalViewStateSync, getGlobalViewStateStore } from './useLogicViewStore';
export type {
  Camera,
  Selection,
  ToolMode,
  InteractionMode,
  EditingState,
  LogicViewState,
} from './useLogicViewStore';

// Components
export { NodeView } from './components/NodeView';
export type { NodeViewProps, ChipMetadata, NodeIoPresentation } from './components/NodeView';
export { WireView } from './components/WireView';
export type { WireViewProps } from './components/WireView';
export { Toolbar } from './components/Toolbar';
export type { ToolbarProps } from './components/Toolbar';

// Tools
export { renderGrid } from './tools/grid';
export type { GridConfig } from './tools/grid';
export { findSmartSpawnPosition } from './tools/placement';
