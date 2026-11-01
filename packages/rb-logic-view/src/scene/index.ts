/**
 * React-free entry to the schematic geometry kernel. Pure modules only: no components, no
 * stores, no stylesheets, no `window`. Kernels, workers and node-environment tests import
 * this subpath instead of the package index, which also carries LogicCanvas and its store.
 */
export {
  GRID,
  PIN_PITCH,
  STUB,
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
} from '../symbols/portGeometry';
export { outlineFor, type SymbolOutline } from '../symbols/ansiSymbols';
export { placeSchematicLabels, type SchematicLabel } from '../symbols/schematicLabels';
export {
  connectionEndpoints,
  polylinePath,
  routeBounds,
  routeCircuit,
  type Point,
  type RouteOptions,
  type RoutedNet,
  type RoutedWire,
} from '../routing/orthogonalRouter';
export {
  buildCircuitScene,
  netValue,
  netsOfNode,
  sceneFingerprint,
  type Box,
  type CircuitScene,
  type SceneEndpoint,
  type SceneMetadataResolver,
  type SceneNet,
  type SceneSymbol,
} from './circuitScene';
export { boxesOverlap, cullScene, segmentIntersectsBox, type VisibleScene } from './cull';
export type { ChipMetadata } from '../components/NodeView';
