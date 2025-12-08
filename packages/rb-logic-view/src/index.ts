// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// Main component
export { LogicCanvas } from './LogicCanvas';
export type { LogicCanvasProps } from './LogicCanvas';

// Store
export { useLogicViewStore } from './useLogicViewStore';
export type {
  Camera,
  Selection,
  ToolMode,
  EditingState,
  LogicViewState,
} from './useLogicViewStore';

// Components
export { NodeView } from './components/NodeView';
export type { NodeViewProps } from './components/NodeView';
export { WireView } from './components/WireView';
export type { WireViewProps } from './components/WireView';
export { Toolbar } from './components/Toolbar';
export type { ToolbarProps } from './components/Toolbar';

// Tools
export { renderGrid } from './tools/grid';
export type { GridConfig } from './tools/grid';
export {
  usePanZoomHandlers,
  screenToWorld,
  worldToScreen,
  snapToGrid,
} from './tools/panzoom';
export type { PanZoomHandlers, PanZoomOptions } from './tools/panzoom';
