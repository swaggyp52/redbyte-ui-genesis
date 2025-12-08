// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';
import type { ViewState, ViewNode, ViewWire } from '../types';
import { getNodeDimensions } from './shared-helpers';

/**
 * Isometric projection formula
 */
function toIsometric(x: number, y: number, z: number = 0): { x: number; y: number } {
  return {
    x: (x - y),
    y: (x + y) * 0.5 - z,
  };
}

/**
 * Isometric transform - 2.5D projection
 */
export function isometricTransform(circuit: Circuit): ViewState {
  const nodes: ViewNode[] = circuit.nodes.map((node) => {
    const { width, height } = getNodeDimensions(node.type);

    // Convert to isometric coordinates
    const iso = toIsometric(node.position.x, node.position.y, 0);

    const ports: Record<string, { x: number; y: number }> = {};

    // Input port (isometric)
    if (!['PowerSource', 'Clock'].includes(node.type)) {
      const inputIso = toIsometric(node.position.x - width / 2, node.position.y, 0);
      ports.in = inputIso;
    }

    // Output port (isometric)
    if (!['Lamp'].includes(node.type)) {
      const outputIso = toIsometric(node.position.x + width / 2, node.position.y, 0);
      ports.out = outputIso;
    }

    return {
      id: node.id,
      type: node.type,
      view: {
        x: iso.x,
        y: iso.y,
        z: 0,
        w: width,
        h: height,
      },
      ports,
    };
  });

  // Sort nodes by depth (back to front rendering)
  nodes.sort((a, b) => (a.view.y + (a.view.z || 0)) - (b.view.y + (b.view.z || 0)));

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
      from: fromNodeView.ports[conn.from.portName] || { x: fromNodeView.view.x, y: fromNodeView.view.y },
      to: toNodeView.ports[conn.to.portName] || { x: toNodeView.view.x, y: toNodeView.view.y },
    };
  });

  return { nodes, wires };
}
