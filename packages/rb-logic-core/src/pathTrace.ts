// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection } from './types';

/** Normalize a connection endpoint (legacy string or PortRef) to { nodeId, portName }. */
function resolveEndpoint(raw: Connection['from'] | Connection['to']): { nodeId: string; portName: string } {
  if (typeof raw === 'string') {
    return { nodeId: raw, portName: 'out' };
  }
  return {
    nodeId: (raw as { nodeId: string }).nodeId,
    portName:
      (raw as { portName?: string }).portName ??
      (raw as { port?: string }).port ??
      'out',
  };
}

/** Produce the canonical wire ID string used by LogicCanvas / WireView. */
function wireIdFromConn(conn: Connection): string {
  const from = resolveEndpoint(conn.from);
  const to = resolveEndpoint(conn.to);
  return `${from.nodeId}.${from.portName}-${to.nodeId}.${to.portName}`;
}

/**
 * Compute the full combinational fanin cone of a node.
 *
 * Starting from `targetNodeId`, walks backwards through `circuit.connections`
 * to collect every upstream node and wire that transitively feeds into the
 * target (all the way back to source / Switch / PowerSource nodes).
 *
 * @returns
 *   `nodeIds` – every node in the cone (including the target itself)
 *   `wireIds` – every wire ID (format: "fromNodeId.fromPort-toNodeId.toPort")
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
    if (nodeIds.has(currentId)) continue; // cycle guard
    nodeIds.add(currentId);

    for (const conn of circuit.connections) {
      const to = resolveEndpoint(conn.to);
      if (to.nodeId !== currentId) continue;

      wireIds.add(wireIdFromConn(conn));

      const from = resolveEndpoint(conn.from);
      if (!nodeIds.has(from.nodeId)) {
        queue.push(from.nodeId);
      }
    }
  }

  return { nodeIds, wireIds };
}
