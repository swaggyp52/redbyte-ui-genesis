// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';

export interface SuspectSet {
  nodeIds: Set<string>;
  wireIds: Set<string>;
}

interface TargetPort {
  nodeId: string;
  portName: string;
}

export const buildSuspectSet = (
  circuit: Circuit,
  targets: TargetPort[],
  maxDepth: number
): SuspectSet => {
  const nodeIds = new Set<string>();
  const wireIds = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number }> = [];

  targets.forEach((target) => {
    nodeIds.add(target.nodeId);
    queue.push({ nodeId: target.nodeId, depth: 0 });
  });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.depth >= maxDepth) continue;

    circuit.connections.forEach((connection) => {
      if (connection.to.nodeId !== current.nodeId) return;
      const wireId = `${connection.from.nodeId}.${connection.from.portName}-${connection.to.nodeId}.${connection.to.portName}`;
      wireIds.add(wireId);
      if (!nodeIds.has(connection.from.nodeId)) {
        nodeIds.add(connection.from.nodeId);
        queue.push({ nodeId: connection.from.nodeId, depth: current.depth + 1 });
      }
    });
  }

  return { nodeIds, wireIds };
};
