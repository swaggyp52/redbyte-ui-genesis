// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Node, Connection } from '../types';
import { getClockPortName } from './nodeMetaRegistry';

/**
 * Inject an internal simulation clock into a cloned circuit
 *
 * Creates a "__sim_clk__" node that drives the clock ports of all sequential nodes.
 * Used only in Verify mode when no external clock is available.
 * Never mutates the original circuit or RBProject.
 */
export function injectSimClock(
  circuitClone: Circuit,
  sequentialNodeIds: string[]
): void {
  if (sequentialNodeIds.length === 0) {
    return; // No sequential nodes, no need to inject
  }

  // Create the simulation clock input node
  const simClkNode: Node = {
    id: '__sim_clk__',
    type: 'Switch', // Use Switch as a simple input source
    label: 'sim_clk (internal)',
    position: { x: -100, y: -100 }, // Off-screen
    rotation: 0,
    config: {},
    state: { isOn: 0 },
  };

  // Add to circuit nodes
  circuitClone.nodes.push(simClkNode);

  // For each sequential node, wire its clock port to __sim_clk__
  for (const seqNodeId of sequentialNodeIds) {
    const seqNode = circuitClone.nodes.find((n) => n.id === seqNodeId);
    if (!seqNode) continue;

    // Get the clock port name for this node type
    const clockPort = getClockPortName(seqNode.type);
    if (!clockPort) continue;

    // Create connection from sim_clk to this node's clock port
    const conn: Connection = {
      from: { nodeId: '__sim_clk__', portName: 'out' },
      to: { nodeId: seqNodeId, portName: clockPort },
    };

    circuitClone.connections.push(conn);
  }
}
