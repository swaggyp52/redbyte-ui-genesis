// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Node, Connection } from '@redbyte/rb-logic-core';

/**
 * Calculate port position based on node position and rotation
 */
export function calculatePortPosition(
  node: Node,
  portName: string,
  nodeWidth: number,
  nodeHeight: number
): { x: number; y: number } {
  const { x, y } = node.position;
  const rotation = node.rotation || 0;

  // Default ports: input on left, output on right
  let portX = portName === 'in' ? x - nodeWidth / 2 : x + nodeWidth / 2;
  let portY = y;

  // Apply rotation (simplified - assumes 90° increments)
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const relX = portX - x;
  const relY = portY - y;

  return {
    x: x + relX * cos - relY * sin,
    y: y + relX * sin + relY * cos,
  };
}

/**
 * Manhattan routing - creates orthogonal path between two points
 */
export function manhattanRoute(
  from: { x: number; y: number },
  to: { x: number; y: number }
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];

  points.push(from);

  // Simple L-shaped routing
  const midX = (from.x + to.x) / 2;

  if (Math.abs(from.y - to.y) > 10) {
    // Vertical then horizontal
    points.push({ x: midX, y: from.y });
    points.push({ x: midX, y: to.y });
  } else {
    // Direct horizontal
    points.push({ x: to.x, y: from.y });
  }

  points.push(to);

  return points;
}

/**
 * Snap coordinate to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Get node dimensions based on type
 */
export function getNodeDimensions(nodeType: string): { width: number; height: number } {
  // Default dimensions for different node types
  const dimensions: Record<string, { width: number; height: number }> = {
    PowerSource: { width: 40, height: 40 },
    Switch: { width: 40, height: 40 },
    Lamp: { width: 40, height: 40 },
    Wire: { width: 20, height: 20 },
    AND: { width: 48, height: 48 },
    OR: { width: 48, height: 48 },
    NOT: { width: 40, height: 40 },
    NAND: { width: 48, height: 48 },
    XOR: { width: 48, height: 48 },
    Clock: { width: 48, height: 48 },
    Delay: { width: 48, height: 48 },
  };

  return dimensions[nodeType] || { width: 48, height: 48 };
}
