import type { Circuit } from '@redbyte/rb-logic-core';
import type { ViewState, ViewNode, ViewWire } from '../types';
import { calculatePortPosition, getNodeDimensions, manhattanRoute } from './shared-helpers';

/**
 * Schematic transform - symbolic representation with Manhattan routing
 */
export function schematicTransform(circuit: Circuit): ViewState {
  const nodes: ViewNode[] = circuit.nodes.map((node) => {
    const { width, height } = getNodeDimensions(node.type);

    // Use symbolic sizes for schematic
    const schematicWidth = width * 1.2;
    const schematicHeight = height * 0.8;

    const ports: Record<string, { x: number; y: number }> = {};

    // Input port
    if (!['PowerSource', 'Clock'].includes(node.type)) {
      ports.in = { x: node.position.x - schematicWidth / 2, y: node.position.y };
    }

    // Output port
    if (!['Lamp'].includes(node.type)) {
      ports.out = { x: node.position.x + schematicWidth / 2, y: node.position.y };
    }

    return {
      id: node.id,
      type: node.type,
      view: {
        x: node.position.x,
        y: node.position.y,
        w: schematicWidth,
        h: schematicHeight,
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
        points: [],
      };
    }

    const fromNodeView = nodes.find((n) => n.id === fromNode.id)!;
    const toNodeView = nodes.find((n) => n.id === toNode.id)!;

    const from = fromNodeView.ports[conn.from.portName] || { x: fromNode.position.x, y: fromNode.position.y };
    const to = toNodeView.ports[conn.to.portName] || { x: toNode.position.x, y: toNode.position.y };

    // Use Manhattan routing for schematic wires
    const points = manhattanRoute(from, to);

    return {
      id: `${conn.from.nodeId}.${conn.from.portName}-${conn.to.nodeId}.${conn.to.portName}`,
      from,
      to,
      points,
    };
  });

  return { nodes, wires };
}
