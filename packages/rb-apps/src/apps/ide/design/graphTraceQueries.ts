// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Unified PURE graph-trace query surface over the canonical in-memory
 * Circuit shape ({ nodes[], connections[] with from/to PortRefs }).
 *
 * The existing cone walkers in ../pathTrace.ts (getFaninCone / getFanoutCone)
 * remain the single implementation of fan-in/fan-out reachability — this
 * module re-exports and wraps them, and adds ONLY what was missing:
 *
 *   - pathBetween: directed BFS shortest path (node ids + wire ids) or null
 *   - neighbors:   undirected bounded-depth neighborhood with per-node depth
 *
 * Wire identity is the canonical derived string
 * `${fromNodeId}.${fromPort}-${toNodeId}.${toPort}` (utils/wireId.ts) — the
 * same identity pathTrace and LogicCanvas use. In-memory connections carry no
 * id field; never invent one.
 */

import type { Circuit, Connection } from '@redbyte/rb-logic-core';
import { getFaninCone, getFanoutCone } from '../pathTrace';
import { encodeWireId } from '../../../utils/wireId';

export { getFaninCone, getFanoutCone } from '../pathTrace';

export interface GraphTraceCone {
  nodeIds: Set<string>;
  wireIds: Set<string>;
}

export interface GraphTracePath {
  /** Node ids along the path, source first, target last. */
  nodeIds: string[];
  /** Derived wire ids for each hop, in path order (nodeIds.length - 1 entries). */
  wireIds: string[];
}

export interface GraphTraceNeighborhood {
  nodeIds: Set<string>;
  /** Wires of the induced subgraph: both endpoints inside nodeIds. */
  wireIds: Set<string>;
  /** Undirected hop distance from the seed node for every included node. */
  depthByNodeId: Map<string, number>;
}

/**
 * Every node and wire upstream of nodeId (inclusive of nodeId).
 * Thin alias over pathTrace.getFaninCone for the unified query surface.
 */
export function fanIn(circuit: Circuit, nodeId: string): GraphTraceCone {
  return getFaninCone(circuit, nodeId);
}

/**
 * Every node and wire downstream of nodeId (inclusive of nodeId).
 * Thin alias over pathTrace.getFanoutCone for the unified query surface.
 */
export function fanOut(circuit: Circuit, nodeId: string): GraphTraceCone {
  return getFanoutCone(circuit, nodeId);
}

/**
 * Endpoint resolution mirroring pathTrace's private resolveEndpoint:
 * tolerates legacy string endpoints and the deprecated `port` alias.
 */
function resolveEndpoint(raw: Connection['from'] | Connection['to']): {
  nodeId: string;
  portName: string;
} {
  if (typeof raw === 'string') return { nodeId: raw, portName: 'out' };
  return {
    nodeId: (raw as { nodeId: string }).nodeId,
    portName:
      (raw as { portName?: string }).portName ??
      (raw as { port?: string }).port ??
      'out',
  };
}

interface DirectedEdge {
  toNodeId: string;
  wireId: string;
}

function buildDirectedAdjacency(circuit: Circuit): Map<string, DirectedEdge[]> {
  const adjacency = new Map<string, DirectedEdge[]>();
  for (const connection of circuit.connections) {
    const from = resolveEndpoint(connection.from);
    const to = resolveEndpoint(connection.to);
    const wireId = encodeWireId(from.nodeId, from.portName, to.nodeId, to.portName);
    const edges = adjacency.get(from.nodeId);
    if (edges) {
      edges.push({ toNodeId: to.nodeId, wireId });
    } else {
      adjacency.set(from.nodeId, [{ toNodeId: to.nodeId, wireId }]);
    }
  }
  return adjacency;
}

/**
 * Directed BFS shortest path (fewest hops) from fromNodeId to toNodeId,
 * following signal flow (connection.from -> connection.to).
 *
 * Returns null when either node is absent from circuit.nodes or when no
 * directed path exists. A query from a node to itself returns the trivial
 * single-node path. Deterministic: ties resolve in circuit.connections order.
 */
export function pathBetween(
  circuit: Circuit,
  fromNodeId: string,
  toNodeId: string,
): GraphTracePath | null {
  const knownNodeIds = new Set(circuit.nodes.map((node) => node.id));
  if (!knownNodeIds.has(fromNodeId) || !knownNodeIds.has(toNodeId)) return null;
  if (fromNodeId === toNodeId) return { nodeIds: [fromNodeId], wireIds: [] };

  const adjacency = buildDirectedAdjacency(circuit);
  const previous = new Map<string, { nodeId: string; wireId: string }>();
  const visited = new Set<string>([fromNodeId]);
  const queue: string[] = [fromNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const edge of adjacency.get(currentId) ?? []) {
      if (visited.has(edge.toNodeId)) continue;
      visited.add(edge.toNodeId);
      previous.set(edge.toNodeId, { nodeId: currentId, wireId: edge.wireId });
      if (edge.toNodeId === toNodeId) {
        const nodeIds: string[] = [toNodeId];
        const wireIds: string[] = [];
        let cursor = toNodeId;
        while (cursor !== fromNodeId) {
          const step = previous.get(cursor)!;
          wireIds.push(step.wireId);
          nodeIds.push(step.nodeId);
          cursor = step.nodeId;
        }
        nodeIds.reverse();
        wireIds.reverse();
        return { nodeIds, wireIds };
      }
      queue.push(edge.toNodeId);
    }
  }

  return null;
}

/**
 * Undirected bounded-depth neighborhood of nodeId. Includes the seed node at
 * depth 0 (matching the cone walkers' inclusive behavior), every node within
 * `depth` hops ignoring signal direction, and the wires of the induced
 * subgraph. depth is floored at 0; non-finite depth is treated as 0.
 */
export function neighbors(
  circuit: Circuit,
  nodeId: string,
  depth: number,
): GraphTraceNeighborhood {
  const maxDepth = Number.isFinite(depth) ? Math.max(0, Math.floor(depth)) : 0;

  const undirected = new Map<string, string[]>();
  const link = (a: string, b: string): void => {
    const list = undirected.get(a);
    if (list) {
      list.push(b);
    } else {
      undirected.set(a, [b]);
    }
  };
  for (const connection of circuit.connections) {
    const from = resolveEndpoint(connection.from);
    const to = resolveEndpoint(connection.to);
    link(from.nodeId, to.nodeId);
    link(to.nodeId, from.nodeId);
  }

  const depthByNodeId = new Map<string, number>([[nodeId, 0]]);
  const queue: string[] = [nodeId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentDepth = depthByNodeId.get(currentId)!;
    if (currentDepth >= maxDepth) continue;
    for (const nextId of undirected.get(currentId) ?? []) {
      if (depthByNodeId.has(nextId)) continue;
      depthByNodeId.set(nextId, currentDepth + 1);
      queue.push(nextId);
    }
  }

  const nodeIds = new Set(depthByNodeId.keys());
  const wireIds = new Set<string>();
  for (const connection of circuit.connections) {
    const from = resolveEndpoint(connection.from);
    const to = resolveEndpoint(connection.to);
    if (nodeIds.has(from.nodeId) && nodeIds.has(to.nodeId)) {
      wireIds.add(encodeWireId(from.nodeId, from.portName, to.nodeId, to.portName));
    }
  }

  return { nodeIds, wireIds, depthByNodeId };
}
