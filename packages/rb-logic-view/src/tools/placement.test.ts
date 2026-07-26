import { describe, expect, it } from 'vitest';
import type { Node } from '@redbyte/rb-logic-core';
import {
  GRID_SIZE,
  NODE_SIZE,
  findSmartSpawnPosition,
} from './placement';

const nodeAt = (id: string, x: number, y: number, type = 'XOR'): Node => ({
  id,
  type,
  position: { x, y },
});

const hasNodeFootprintClearance = (
  candidate: { x: number; y: number },
  node: Node,
  clearance = GRID_SIZE
) => {
  const position = node.position;
  if (!position) return true;
  const minimumCenterSeparation = NODE_SIZE + clearance;
  return (
    Math.abs(candidate.x - position.x) >= minimumCenterSeparation ||
    Math.abs(candidate.y - position.y) >= minimumCenterSeparation
  );
};

describe('findSmartSpawnPosition', () => {
  it('keeps a full grid cell between standard node footprints', () => {
    const existing = [nodeAt('xor', 0, 0)];

    const candidate = findSmartSpawnPosition(existing, { x: 0, y: 0 });

    expect(hasNodeFootprintClearance(candidate, existing[0])).toBe(true);
  });

  it('keeps cascading until every nearby footprint is clear', () => {
    const existing = [
      nodeAt('xor', 0, 0),
      nodeAt('input', 96, 96, 'INPUT'),
      nodeAt('output', 192, 192, 'OUTPUT'),
    ];

    const candidate = findSmartSpawnPosition(existing, { x: 0, y: 0 });

    expect(existing.every((node) => hasNodeFootprintClearance(candidate, node))).toBe(true);
  });

  it('is translation invariant for a panned world-space center', () => {
    const baseNodes = [nodeAt('xor', 0, 0), nodeAt('and', 96, 96, 'AND')];
    const shift = { x: 416, y: -272 };
    const shiftedNodes = baseNodes.map((node) =>
      nodeAt(
        node.id,
        (node.position?.x ?? 0) + shift.x,
        (node.position?.y ?? 0) + shift.y,
        node.type
      )
    );

    const baseCandidate = findSmartSpawnPosition(baseNodes, { x: 0, y: 0 });
    const shiftedCandidate = findSmartSpawnPosition(shiftedNodes, shift);

    expect(shiftedCandidate).toEqual({
      x: baseCandidate.x + shift.x,
      y: baseCandidate.y + shift.y,
    });
  });
});
