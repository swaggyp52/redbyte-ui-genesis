import type { CircuitNode } from '@redbyte/rb-logic-core';

/**
 * Distance in world units within which the dragged node's position is considered
 * "aligned" with another node. Smaller than half a grid cell (16/2=8) so guides
 * fire only when genuinely close, not on every drag step.
 */
export const ALIGNMENT_THRESHOLD_WORLD = 6;

export interface AlignmentGuides {
  /** World-space X values where the dragged node's X matches another node's X */
  verticals: number[];
  /** World-space Y values where the dragged node's Y matches another node's Y */
  horizontals: number[];
}

/**
 * Scans all other nodes and returns alignment matches for the currently dragged
 * node's center position. Both vertical (same X) and horizontal (same Y) guides
 * are returned so the canvas can render guide lines.
 *
 * Pure function — no side effects.
 */
export function computeAlignmentGuides(
  draggedNodeId: string,
  dragPos: { x: number; y: number },
  nodes: readonly CircuitNode[],
  threshold = ALIGNMENT_THRESHOLD_WORLD,
): AlignmentGuides {
  const verticals: number[] = [];
  const horizontals: number[] = [];

  for (const node of nodes) {
    if (node.id === draggedNodeId) continue;
    if (!node.position) continue;

    if (Math.abs(dragPos.x - node.position.x) <= threshold) {
      verticals.push(node.position.x);
    }
    if (Math.abs(dragPos.y - node.position.y) <= threshold) {
      horizontals.push(node.position.y);
    }
  }

  return { verticals, horizontals };
}
