// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

// Main component
export { LogicCanvas, FIT_ZOOM_STEPS } from './LogicCanvas';
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
export { findSmartSpawnPosition, measureNodeSize, type SpawnFootprint } from './tools/placement';
export {
  describePortRefForStudents,
  describeWireRejectionForStudents,
  describeWireSourceCue,
  wirePortState,
  wireRejectionMessage,
} from './tools/wireGuidance';

// Schematic instrument: symbol geometry, ANSI outlines, orthogonal routing.
export {
  GRID as SCHEMATIC_GRID,
  PIN_PITCH as SCHEMATIC_PIN_PITCH,
  blockBodySize,
  buildGeometryIndex,
  findPin,
  pinWorldPoint,
  resolvePortGeometry,
  symbolKindForNode,
  unionBounds,
  type GeometryIndexEntry,
  type SymbolGeometry,
  type SymbolKind,
  type SymbolPin,
} from './symbols/portGeometry';
export { outlineFor, type SymbolOutline } from './symbols/ansiSymbols';
export {
  connectionEndpoints,
  polylinePath,
  routeBounds,
  routeCircuit,
  type RoutedNet,
  type RoutedWire,
} from './routing/orthogonalRouter';
export { SchematicNodeView, schematicLodForZoom, DEFAULT_SCHEMATIC_LAYERS, type SchematicLod, type SchematicLayers, type SchematicNodeViewProps } from './components/SchematicNodeView';
export { SchematicBusBrackets, layoutBusBrackets, type SchematicBusGroup, type BusBracketLayout } from './components/SchematicBusBrackets';
export { SchematicWireView, type SchematicWireViewProps } from './components/SchematicWireView';
