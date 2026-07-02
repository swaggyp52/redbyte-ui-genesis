// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection } from '@redbyte/rb-logic-core';

export interface DesignDebugTraceNode {
  nodeId: string;
  label: string;
  typeLabel: string;
  depth: number;
  incomingWireIds: string[];
  upstreamNodeIds: string[];
  upstreamLabels: string[];
  openInputPorts: string[];
}

export interface DesignDebugSignalTrace {
  targetSignalKey: string;
  targetNodeId: string;
  targetPortName: string;
  targetLabel: string;
  nodes: DesignDebugTraceNode[];
  wireIds: string[];
  hasOpenInputs: boolean;
}

function resolveEndpoint(raw: Connection['from'] | Connection['to']): { nodeId: string; portName: string } {
  if (typeof raw === 'string') return { nodeId: raw, portName: 'out' };
  return {
    nodeId: (raw as { nodeId: string }).nodeId,
    portName:
      (raw as { portName?: string }).portName ??
      (raw as { port?: string }).port ??
      'out',
  };
}

function wireIdFromConn(conn: Connection): string {
  const from = resolveEndpoint(conn.from);
  const to = resolveEndpoint(conn.to);
  return `${from.nodeId}.${from.portName}-${to.nodeId}.${to.portName}`;
}

function parseSignalKey(signalKey: string): { nodeId: string; portName: string } | null {
  const dotIndex = signalKey.indexOf('.');
  if (dotIndex === -1) return null;
  const nodeId = signalKey.slice(0, dotIndex).trim();
  const portName = signalKey.slice(dotIndex + 1).trim();
  if (!nodeId || !portName) return null;
  return { nodeId, portName };
}

function defaultNodeLabel(node: Circuit['nodes'][number] | undefined, nodeId: string): string {
  const label = node?.label?.trim();
  if (label) return label;
  return node?.id ?? nodeId;
}

function defaultNodeTypeLabel(node: Circuit['nodes'][number] | undefined): string {
  return node?.type ?? 'Signal';
}

function expectedInputPortsForType(type: string | undefined): string[] {
  switch (type) {
    case 'AND':
    case 'OR':
    case 'NAND':
    case 'NOR':
    case 'XOR':
    case 'XNOR':
      return ['a', 'b'];
    case 'AND3':
    case 'OR3':
    case 'NAND3':
    case 'NOR3':
    case 'XOR3':
      return ['a', 'b', 'c'];
    case 'NOT':
    case 'BUFFER':
    case 'OUTPUT':
    case 'Lamp':
      return ['in'];
    case 'HALFADDER':
      return ['a', 'b'];
    case 'FULLADDER':
      return ['a', 'b', 'cin'];
    case 'MUX':
      return ['a', 'b', 'sel'];
    case 'DFlipFlop':
      return ['D', 'CLK'];
    case 'TFlipFlop':
      return ['T', 'CLK'];
    case 'JKFlipFlop':
      return ['J', 'K', 'CLK'];
    default:
      return [];
  }
}

function compareTraceNodes(left: DesignDebugTraceNode, right: DesignDebugTraceNode): number {
  if (left.depth !== right.depth) return left.depth - right.depth;
  return 0;
}

/**
 * Compute the full combinational fanout cone of a node.
 * Walks forwards from sourceNodeId through circuit.connections.
 * Returns every downstream nodeId and wireId driven by the source.
 */
export function getFanoutCone(
  circuit: Circuit,
  sourceNodeId: string,
): { nodeIds: Set<string>; wireIds: Set<string> } {
  const nodeIds = new Set<string>();
  const wireIds = new Set<string>();
  const queue: string[] = [sourceNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (nodeIds.has(currentId)) continue;
    nodeIds.add(currentId);

    for (const conn of circuit.connections) {
      const from = resolveEndpoint(conn.from);
      if (from.nodeId !== currentId) continue;
      wireIds.add(wireIdFromConn(conn));
      const to = resolveEndpoint(conn.to);
      if (!nodeIds.has(to.nodeId)) queue.push(to.nodeId);
    }
  }

  return { nodeIds, wireIds };
}

/**
 * Compute the full combinational fanin cone of a node.
 * Walks backwards from targetNodeId through circuit.connections.
 * Returns every upstream nodeId and wireId that feeds into the target.
 */
export function getFaninCone(
  circuit: Circuit,
  targetNodeId: string,
): { nodeIds: Set<string>; wireIds: Set<string> } {
  const nodeIds = new Set<string>();
  const wireIds = new Set<string>();
  const queue: string[] = [targetNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (nodeIds.has(currentId)) continue;
    nodeIds.add(currentId);

    for (const conn of circuit.connections) {
      const to = resolveEndpoint(conn.to);
      if (to.nodeId !== currentId) continue;
      wireIds.add(wireIdFromConn(conn));
      const from = resolveEndpoint(conn.from);
      if (!nodeIds.has(from.nodeId)) queue.push(from.nodeId);
    }
  }

  return { nodeIds, wireIds };
}

export function buildDesignDebugSignalTrace(
  circuit: Circuit,
  input: {
    targetSignalKey: string;
    maxDepth?: number;
    resolveNodeLabel?: (node: Circuit['nodes'][number] | undefined, nodeId: string) => string | null | undefined;
    resolveNodeTypeLabel?: (node: Circuit['nodes'][number] | undefined, nodeId: string) => string | null | undefined;
  },
): DesignDebugSignalTrace | null {
  const target = parseSignalKey(input.targetSignalKey);
  if (!target) return null;

  const nodeById = new Map(circuit.nodes.map((node) => [node.id, node]));
  const labelFor = (nodeId: string): string => {
    const node = nodeById.get(nodeId);
    return input.resolveNodeLabel?.(node, nodeId)?.trim() || defaultNodeLabel(node, nodeId);
  };
  const typeFor = (nodeId: string): string => {
    const node = nodeById.get(nodeId);
    return input.resolveNodeTypeLabel?.(node, nodeId)?.trim() || defaultNodeTypeLabel(node);
  };

  const maxDepth = input.maxDepth ?? 4;
  const rows = new Map<string, DesignDebugTraceNode>();
  const wireIds: string[] = [];
  const queued = new Set<string>();
  const queue: Array<{ nodeId: string; portName: string | null; depth: number }> = [
    { nodeId: target.nodeId, portName: target.portName, depth: 0 },
  ];

  const ensureRow = (nodeId: string, depth: number): DesignDebugTraceNode => {
    const existing = rows.get(nodeId);
    if (existing) {
      existing.depth = Math.min(existing.depth, depth);
      return existing;
    }
    const node = nodeById.get(nodeId);
    const row: DesignDebugTraceNode = {
      nodeId,
      label: labelFor(nodeId),
      typeLabel: typeFor(nodeId),
      depth,
      incomingWireIds: [],
      upstreamNodeIds: [],
      upstreamLabels: [],
      openInputPorts: [],
    };
    const expectedPorts = expectedInputPortsForType(node?.type);
    if (expectedPorts.length > 0) {
      const drivenPorts = new Set(
        circuit.connections
          .map((connection) => resolveEndpoint(connection.to))
          .filter((endpoint) => endpoint.nodeId === nodeId)
          .map((endpoint) => endpoint.portName),
      );
      row.openInputPorts = expectedPorts.filter((port) => !drivenPorts.has(port));
    }
    rows.set(nodeId, row);
    return row;
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const currentKey = `${current.nodeId}:${current.portName ?? '*'}:${current.depth}`;
    if (queued.has(currentKey)) continue;
    queued.add(currentKey);

    const row = ensureRow(current.nodeId, current.depth);
    const incoming = circuit.connections.filter((connection) => {
      const to = resolveEndpoint(connection.to);
      if (to.nodeId !== current.nodeId) return false;
      return current.portName == null || to.portName === current.portName;
    });

    for (const connection of incoming) {
      const from = resolveEndpoint(connection.from);
      const id = wireIdFromConn(connection);
      if (!row.incomingWireIds.includes(id)) row.incomingWireIds.push(id);
      if (!wireIds.includes(id)) wireIds.push(id);
      if (!row.upstreamNodeIds.includes(from.nodeId)) row.upstreamNodeIds.push(from.nodeId);
      const upstreamLabel = labelFor(from.nodeId);
      if (!row.upstreamLabels.includes(upstreamLabel)) row.upstreamLabels.push(upstreamLabel);
      if (current.depth < maxDepth) {
        queue.push({ nodeId: from.nodeId, portName: null, depth: current.depth + 1 });
      }
    }
  }

  if (rows.size === 0) return null;
  const nodes = Array.from(rows.values()).sort(compareTraceNodes);
  return {
    targetSignalKey: input.targetSignalKey,
    targetNodeId: target.nodeId,
    targetPortName: target.portName,
    targetLabel: labelFor(target.nodeId),
    nodes,
    wireIds,
    hasOpenInputs: nodes.some((node) => node.openInputPorts.length > 0),
  };
}
