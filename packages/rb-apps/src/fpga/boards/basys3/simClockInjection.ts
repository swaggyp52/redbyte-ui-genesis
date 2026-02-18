// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Node, Connection } from '@redbyte/rb-logic-core';
import { getClockPortName } from './sequentialAnalysis';

/**
 * Inject an internal simulation clock into a cloned circuit
 */
export function injectSimClock(
  circuitClone: Circuit,
  sequentialNodeIds: string[]
): void {
  if (sequentialNodeIds.length === 0) {
    return;
  }

  // Create the simulation clock input node
  const simClkNode: Node = {
    id: '__sim_clk__',
    type: 'Switch',
    label: 'sim_clk (internal)',
    position: { x: -100, y: -100 },
    rotation: 0,
    config: {},
    state: { isOn: 0 },
  };

  circuitClone.nodes.push(simClkNode);

  // Wire sim_clk to each sequential node's clock port
  for (const seqNodeId of sequentialNodeIds) {
    const seqNode = circuitClone.nodes.find((n) => n.id === seqNodeId);
    if (!seqNode) continue;

    const clockPort = getClockPortName(seqNode.type);
    if (!clockPort) continue;

    const conn: Connection = {
      from: { nodeId: '__sim_clk__', portName: 'out' },
      to: { nodeId: seqNodeId, portName: clockPort },
    };

    circuitClone.connections.push(conn);
  }
}
