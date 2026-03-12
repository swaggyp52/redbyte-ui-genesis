// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection } from '@redbyte/rb-logic-core';

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
