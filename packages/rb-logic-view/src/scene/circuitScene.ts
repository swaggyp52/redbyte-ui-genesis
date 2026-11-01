import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { ChipMetadata } from '../components/NodeView';
import {
  buildGeometryIndex,
  findPin,
  unionBounds,
  type GeometryIndexEntry,
  type SymbolGeometry,
} from '../symbols/portGeometry';
import { placeSchematicLabels, type SchematicLabel } from '../symbols/schematicLabels';
import { connectionEndpoints, routeBounds, routeCircuit, type Point, type RouteOptions, type RoutedNet, type RoutedWire } from '../routing/orthogonalRouter';

/**
 * CircuitScene: the one read-model every structural view draws from.
 *
 * Geometry, routed nets, junctions and label anchors are computed once per circuit and
 * shared. Nothing here knows about a camera, a value, a selection or React: a renderer
 * projects the scene, and the values of a moment are applied to it by net identity.
 *
 * Net identity is the driver endpoint (`${nodeId}.${port}`), the same key the router and
 * the engine signal cache already use. Labels never enter it, so renaming a part never
 * renames a net. Pure and byte-stable: identical input produces an identical scene.
 */

export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface SceneEndpoint {
  readonly nodeId: string;
  /** Port as the connection names it. */
  readonly port: string;
  /** Canonical pin id from the symbol geometry, or the raw port when the pin is unknown. */
  readonly pin: string;
}

export interface SceneSymbol {
  readonly nodeId: string;
  readonly node: Node;
  readonly geometry: SymbolGeometry;
  /** World position of the symbol origin. */
  readonly x: number;
  readonly y: number;
  /** World-space full bounds (body, stubs, bubble). */
  readonly bounds: Box;
  readonly label?: SchematicLabel;
}

export interface SceneNet {
  readonly netId: string;
  readonly driver: SceneEndpoint;
  readonly loads: readonly SceneEndpoint[];
  readonly wires: readonly RoutedWire[];
  readonly junctions: readonly Point[];
  readonly labelAnchor: Point | null;
  readonly bounds: Box | null;
}

export interface CircuitScene {
  readonly symbols: readonly SceneSymbol[];
  readonly symbolById: ReadonlyMap<string, SceneSymbol>;
  readonly nets: readonly SceneNet[];
  readonly netById: ReadonlyMap<string, SceneNet>;
  /** Every endpoint key (`node.port` and `node.pin`) to the net it belongs to. */
  readonly netByEndpoint: ReadonlyMap<string, string>;
  /** Geometry index shared with the existing schematic primitives. */
  readonly index: ReadonlyMap<string, GeometryIndexEntry>;
  readonly bounds: Box | null;
}

export type SceneMetadataResolver = (nodeType: string, node?: Node) => ChipMetadata | undefined;

function canonicalPin(index: ReadonlyMap<string, GeometryIndexEntry>, nodeId: string, port: string): string {
  const entry = index.get(nodeId);
  return entry ? findPin(entry.geometry, port)?.id ?? port : port;
}

function endpointOf(index: ReadonlyMap<string, GeometryIndexEntry>, nodeId: string, port: string): SceneEndpoint {
  return { nodeId, port, pin: canonicalPin(index, nodeId, port) };
}

function worldBounds(entry: GeometryIndexEntry): Box {
  const b = entry.geometry.bounds;
  return { minX: entry.x + b.minX, minY: entry.y + b.minY, maxX: entry.x + b.maxX, maxY: entry.y + b.maxY };
}

function netBounds(net: RoutedNet): Box | null {
  return routeBounds([net]);
}

function sceneNet(index: ReadonlyMap<string, GeometryIndexEntry>, net: RoutedNet): SceneNet {
  const loads = net.wires.map((wire) => endpointOf(index, wire.toNodeId, wire.toPort));
  return {
    netId: net.netId,
    driver: endpointOf(index, net.driver.nodeId, net.driver.port),
    loads,
    wires: net.wires,
    junctions: net.junctions,
    labelAnchor: net.labelAnchor,
    bounds: netBounds(net),
  };
}

/** The scene routes legs around symbol bodies; pass `{ avoidBodiesOnLegs: false }` for the legacy routes. */
export function buildCircuitScene(
  circuit: Circuit,
  getMetadata?: SceneMetadataResolver,
  routing: RouteOptions = { avoidBodiesOnLegs: true },
): CircuitScene {
  const index = buildGeometryIndex(circuit.nodes, getMetadata);
  const routed = routeCircuit(circuit, index, routing);
  const labels = placeSchematicLabels(index, routed);
  const symbols: SceneSymbol[] = [];
  for (const entry of index.values()) {
    symbols.push({
      nodeId: entry.node.id,
      node: entry.node,
      geometry: entry.geometry,
      x: entry.x,
      y: entry.y,
      bounds: worldBounds(entry),
      label: labels.get(entry.node.id),
    });
  }
  // Codepoint order: drawing order and fingerprints never depend on input array order.
  symbols.sort((a, b) => (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0));
  const nets = routed.map((net) => sceneNet(index, net));
  const netByEndpoint = new Map<string, string>();
  for (const net of nets) {
    for (const endpoint of [net.driver, ...net.loads]) {
      netByEndpoint.set(`${endpoint.nodeId}.${endpoint.port}`, net.netId);
      netByEndpoint.set(`${endpoint.nodeId}.${endpoint.pin}`, net.netId);
    }
  }
  const nodeBounds = unionBounds(index.values());
  const wireBounds = routeBounds(routed);
  const bounds = nodeBounds
    ? {
        minX: Math.min(nodeBounds.minX, wireBounds?.minX ?? nodeBounds.minX),
        minY: Math.min(nodeBounds.minY, wireBounds?.minY ?? nodeBounds.minY),
        maxX: Math.max(nodeBounds.maxX, wireBounds?.maxX ?? nodeBounds.maxX),
        maxY: Math.max(nodeBounds.maxY, wireBounds?.maxY ?? nodeBounds.maxY),
      }
    : null;
  return {
    symbols,
    symbolById: new Map(symbols.map((symbol) => [symbol.nodeId, symbol])),
    nets,
    netById: new Map(nets.map((net) => [net.netId, net])),
    netByEndpoint,
    index,
    bounds,
  };
}

/**
 * The value a net carries at a moment: its driver pin's recorded value, else the value any
 * of its loads recorded. Absent means unvalued, never zero.
 */
export function netValue<T>(net: SceneNet, values: ReadonlyMap<string, T>): T | undefined {
  const driven = values.get(`${net.driver.nodeId}.${net.driver.pin}`) ?? values.get(`${net.driver.nodeId}.${net.driver.port}`);
  if (driven !== undefined) return driven;
  for (const load of net.loads) {
    const read = values.get(`${load.nodeId}.${load.pin}`) ?? values.get(`${load.nodeId}.${load.port}`);
    if (read !== undefined) return read;
  }
  return undefined;
}

/** Nets that touch a node, split by role. */
export function netsOfNode(scene: CircuitScene, nodeId: string): { drives: SceneNet[]; reads: SceneNet[] } {
  const drives: SceneNet[] = [];
  const reads: SceneNet[] = [];
  for (const net of scene.nets) {
    if (net.driver.nodeId === nodeId) drives.push(net);
    if (net.loads.some((load) => load.nodeId === nodeId)) reads.push(net);
  }
  return { drives, reads };
}

/** Stable serialization for golden and determinism tests. */
export function sceneFingerprint(scene: CircuitScene): string {
  return JSON.stringify({
    symbols: scene.symbols.map((symbol) => [symbol.nodeId, symbol.geometry.kind, symbol.x, symbol.y, symbol.label?.y ?? null]),
    nets: scene.nets.map((net) => [
      net.netId,
      net.loads.map((load) => `${load.nodeId}.${load.pin}`),
      net.wires.map((wire) => wire.points.map((point) => `${point.x},${point.y}`).join(' ')),
      net.junctions.map((point) => `${point.x},${point.y}`),
    ]),
    bounds: scene.bounds,
  });
}

export { connectionEndpoints };
