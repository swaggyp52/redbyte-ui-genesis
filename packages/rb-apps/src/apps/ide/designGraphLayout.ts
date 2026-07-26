// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection, Node } from '@redbyte/rb-logic-core';
import { getComponentSupport } from '@redbyte/rb-logic-core';

const INPUT_TYPES = new Set(['INPUT', 'Switch', 'Clock', 'CLOCK']);
const OUTPUT_TYPES = new Set(['OUTPUT', 'Lamp']);

function endpoint(raw: Connection['from'] | Connection['to']): { nodeId: string; portName: string } {
  if (typeof raw === 'string') return { nodeId: raw, portName: 'out' };
  return {
    nodeId: raw.nodeId,
    portName: ('portName' in raw ? raw.portName : undefined) ?? ('port' in raw ? raw.port : undefined) ?? 'out',
  };
}

function positionOf(node: Node): { x: number; y: number } {
  return {
    x: node.position?.x ?? node.x ?? 0,
    y: node.position?.y ?? node.y ?? 0,
  };
}

function stableNodeOrder(left: Node, right: Node): number {
  const a = positionOf(left);
  const b = positionOf(right);
  return a.y - b.y || a.x - b.x || left.id.localeCompare(right.id);
}

export function hasRunnableBoundaryPath(circuit: Circuit): boolean {
  const nodeById = new Map(circuit.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, string[]>();
  for (const connection of circuit.connections) {
    const from = endpoint(connection.from).nodeId;
    const to = endpoint(connection.to).nodeId;
    const next = adjacency.get(from) ?? [];
    next.push(to);
    adjacency.set(from, next);
  }

  const queue = circuit.nodes.filter((node) => INPUT_TYPES.has(node.type)).map((node) => node.id);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) continue;
    if (OUTPUT_TYPES.has(node.type)) return true;
    if (!INPUT_TYPES.has(node.type) && !getComponentSupport(node.type)?.capabilities.simulation) continue;
    for (const target of adjacency.get(nodeId) ?? []) {
      if (!visited.has(target)) queue.push(target);
    }
  }
  return false;
}

/**
 * Deterministic dependency-layer layout for the student schematic.
 * Only coordinates change; node ids, labels, config, state, and connections stay untouched.
 */
export function arrangeCircuitByDependency(
  circuit: Circuit,
  options: { columnGap?: number; rowGap?: number } = {},
): Circuit {
  if (circuit.nodes.length < 2) return circuit;

  const columnGap = options.columnGap ?? 210;
  const rowGap = options.rowGap ?? 132;
  const nodes = [...circuit.nodes].sort(stableNodeOrder);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const predecessors = new Map<string, Set<string>>();
  const successors = new Map<string, Set<string>>();
  const indegree = new Map(nodes.map((node) => [node.id, 0]));

  for (const connection of circuit.connections) {
    const from = endpoint(connection.from).nodeId;
    const to = endpoint(connection.to).nodeId;
    if (!nodeById.has(from) || !nodeById.has(to) || from === to) continue;
    const targetPredecessors = predecessors.get(to) ?? new Set<string>();
    if (targetPredecessors.has(from)) continue;
    targetPredecessors.add(from);
    predecessors.set(to, targetPredecessors);
    const sourceSuccessors = successors.get(from) ?? new Set<string>();
    sourceSuccessors.add(to);
    successors.set(from, sourceSuccessors);
    indegree.set(to, (indegree.get(to) ?? 0) + 1);
  }

  const layer = new Map<string, number>();
  const ready = nodes
    .filter((node) => (indegree.get(node.id) ?? 0) === 0)
    .sort(stableNodeOrder);
  for (const node of ready) layer.set(node.id, 0);

  let processed = 0;
  while (ready.length > 0) {
    const node = ready.shift();
    if (!node) break;
    processed += 1;
    const nextLayer = (layer.get(node.id) ?? 0) + 1;
    for (const successorId of successors.get(node.id) ?? []) {
      layer.set(successorId, Math.max(layer.get(successorId) ?? 0, nextLayer));
      const remaining = (indegree.get(successorId) ?? 1) - 1;
      indegree.set(successorId, remaining);
      if (remaining === 0) {
        const successor = nodeById.get(successorId);
        if (successor) {
          ready.push(successor);
          ready.sort(stableNodeOrder);
        }
      }
    }
  }

  // A cycle is still laid out safely and visibly. Its semantic diagnostic remains authoritative.
  if (processed < nodes.length) {
    let fallbackLayer = Math.max(0, ...layer.values());
    for (const node of nodes) {
      if (layer.has(node.id)) continue;
      fallbackLayer += 1;
      layer.set(node.id, fallbackLayer);
    }
  }

  const nonOutputMax = Math.max(
    0,
    ...nodes.filter((node) => !OUTPUT_TYPES.has(node.type)).map((node) => layer.get(node.id) ?? 0),
  );
  const outputLayer = nonOutputMax + 1;
  for (const node of nodes) {
    if (INPUT_TYPES.has(node.type)) layer.set(node.id, 0);
    if (OUTPUT_TYPES.has(node.type)) layer.set(node.id, outputLayer);
  }

  const grouped = new Map<number, Node[]>();
  for (const node of nodes) {
    const index = layer.get(node.id) ?? 0;
    const group = grouped.get(index) ?? [];
    group.push(node);
    grouped.set(index, group);
  }

  const orderIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const layers = [...grouped.keys()].sort((a, b) => a - b);
  for (const layerIndex of layers) {
    const group = grouped.get(layerIndex) ?? [];
    group.sort((left, right) => {
      const barycenter = (node: Node): number => {
        const upstream = [...(predecessors.get(node.id) ?? [])];
        if (upstream.length === 0) return orderIndex.get(node.id) ?? 0;
        return upstream.reduce((sum, id) => sum + (orderIndex.get(id) ?? 0), 0) / upstream.length;
      };
      return barycenter(left) - barycenter(right) || stableNodeOrder(left, right);
    });
    group.forEach((node, index) => orderIndex.set(node.id, index));
  }

  const minX = Math.min(...nodes.map((node) => positionOf(node).x));
  const minY = Math.min(...nodes.map((node) => positionOf(node).y));
  const widestLayer = Math.max(...layers.map((index) => grouped.get(index)?.length ?? 0));
  const targetHeight = Math.max(0, (widestLayer - 1) * rowGap);
  const nextPosition = new Map<string, { x: number; y: number }>();

  for (const layerIndex of layers) {
    const group = grouped.get(layerIndex) ?? [];
    const layerHeight = Math.max(0, (group.length - 1) * rowGap);
    const yOffset = (targetHeight - layerHeight) / 2;
    group.forEach((node, row) => {
      nextPosition.set(node.id, {
        x: minX + layerIndex * columnGap,
        y: minY + yOffset + row * rowGap,
      });
    });
  }

  return {
    ...circuit,
    nodes: circuit.nodes.map((node) => {
      const next = nextPosition.get(node.id);
      if (!next) return node;
      return { ...node, x: next.x, y: next.y, position: next };
    }),
  };
}
