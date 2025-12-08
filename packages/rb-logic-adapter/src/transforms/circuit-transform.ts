// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit, Connection } from '@redbyte/rb-logic-core';
import type { ViewState, ViewNode, ViewWire } from '../types';
import { calculatePortPosition, getNodeDimensions } from './shared-helpers';

/**
 * Circuit transform - nodes positioned exactly as in engine
 */
export function circuitTransform(circuit: Circuit): ViewState {
  const nodes: ViewNode[] = circuit.nodes.map((node) => {
    const { width, height } = getNodeDimensions(node.type);

    const ports: Record<string, { x: number; y: number }> = {};

    // Input port
    if (!['PowerSource', 'Clock'].includes(node.type)) {
      ports.in = calculatePortPosition(node, 'in', width, height);
    }

    // Output port
    if (!['Lamp'].includes(node.type)) {
      ports.out = calculatePortPosition(node, 'out', width, height);
    }

    return {
      id: node.id,
      type: node.type,
      view: {
        x: node.position.x,
        y: node.position.y,
        w: width,
        h: height,
      },
      ports,
    };
  });

  const wires: ViewWire[] = circuit.connections.map((conn, idx) => {
    const fromNode = circuit.nodes.find((n) => n.id === conn.from.nodeId);
    const toNode = circuit.nodes.find((n) => n.id === conn.to.nodeId);

    if (!fromNode || !toNode) {
      return {
        id: `wire_${idx}`,
        from: { x: 0, y: 0 },
        to: { x: 0, y: 0 },
      };
    }

    const fromNodeView = nodes.find((n) => n.id === fromNode.id)!;
    const toNodeView = nodes.find((n) => n.id === toNode.id)!;

    return {
      id: `${conn.from.nodeId}.${conn.from.portName}-${conn.to.nodeId}.${conn.to.portName}`,
      from: fromNodeView.ports[conn.from.portName] || { x: fromNode.position.x, y: fromNode.position.y },
      to: toNodeView.ports[conn.to.portName] || { x: toNode.position.x, y: toNode.position.y },
    };
  });

  return { nodes, wires };
}
