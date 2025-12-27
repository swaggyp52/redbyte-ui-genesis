// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Node } from '@redbyte/rb-logic-core';

export interface PortPosition {
  nodeId: string;
  portName: string;
  x: number;
  y: number;
}

/**
 * Calculate port positions for schematic symbols
 * Input ports on left, output ports on right
 */
export function getPortPositions(node: Node, nodeX: number, nodeY: number): PortPosition[] {
  const positions: PortPosition[] = [];

  // Standard gate dimensions
  const nodeHeight = 40;
  const nodeWidth = 50;

  // For most gates: 2 inputs on left, 1 output on right
  switch (node.type) {
    case 'AND':
    case 'OR':
    case 'NAND':
    case 'NOR':
    case 'XOR':
    case 'XNOR':
      // Input ports (left side)
      positions.push({
        nodeId: node.id,
        portName: 'in1',
        x: nodeX - 5,
        y: nodeY + 13,
      });
      positions.push({
        nodeId: node.id,
        portName: 'in2',
        x: nodeX - 5,
        y: nodeY + 27,
      });
      // Output port (right side)
      positions.push({
        nodeId: node.id,
        portName: 'output',
        x: nodeX + nodeWidth + 5,
        y: nodeY + 20,
      });
      break;

    case 'NOT':
    case 'Inverter':
      // Single input (left)
      positions.push({
        nodeId: node.id,
        portName: 'input',
        x: nodeX - 5,
        y: nodeY + 20,
      });
      // Output (right)
      positions.push({
        nodeId: node.id,
        portName: 'output',
        x: nodeX + 45,
        y: nodeY + 20,
      });
      break;

    case 'PowerSource':
    case 'Switch':
    case 'Clock':
      // No inputs, single output
      positions.push({
        nodeId: node.id,
        portName: 'output',
        x: nodeX + nodeWidth + 5,
        y: nodeY + 20,
      });
      break;

    case 'Lamp':
    case 'Probe':
      // Single input, no output
      positions.push({
        nodeId: node.id,
        portName: 'input',
        x: nodeX - 5,
        y: nodeY + 20,
      });
      break;

    default:
      // Generic: assume 1 input and 1 output
      positions.push({
        nodeId: node.id,
        portName: 'input',
        x: nodeX - 5,
        y: nodeY + 20,
      });
      positions.push({
        nodeId: node.id,
        portName: 'output',
        x: nodeX + nodeWidth + 5,
        y: nodeY + 20,
      });
      break;
  }

  return positions;
}

/**
 * Find the nearest port to a given point
 */
export function findNearestPort(
  x: number,
  y: number,
  portPositions: PortPosition[],
  maxDistance: number = 20
): PortPosition | null {
  let nearest: PortPosition | null = null;
  let minDistance = maxDistance;

  for (const port of portPositions) {
    const dx = port.x - x;
    const dy = port.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = port;
    }
  }

  return nearest;
}
