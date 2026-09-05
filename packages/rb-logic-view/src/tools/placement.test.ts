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

  // A bus creates one symbol per bit, stacked downwards from the returned position, so
  // clearing only the first slot left the remaining bits sitting on top of whatever was
  // already on the canvas - a pile the student then had to untangle by hand.
  it('clears every slot a multi-slot spawn will fill, not just the first', () => {
    const spacing = 72;
    // A column of four symbols directly below the requested centre. The first slot at the
    // centre is free; slots 2-4 are not.
    const existing = [
      nodeAt('bit0', 0, spacing),
      nodeAt('bit1', 0, spacing * 2),
      nodeAt('bit2', 0, spacing * 3),
    ];

    const single = findSmartSpawnPosition(existing, { x: 0, y: 0 });
    expect(single, 'a one-slot spawn is still happy at the free centre').toEqual({ x: 0, y: 0 });

    const stacked = findSmartSpawnPosition(existing, { x: 0, y: 0 }, undefined, {
      slots: 4,
      spacing,
    });

    for (let slot = 0; slot < 4; slot += 1) {
      const occupied = { x: stacked.x, y: stacked.y + slot * spacing };
      expect(
        existing.every((node) => hasNodeFootprintClearance(occupied, node)),
        `slot ${slot} at ${occupied.x},${occupied.y} must not land on an existing symbol`
      ).toBe(true);
    }
  });

  it('ignores a footprint that describes a single slot', () => {
    const existing = [nodeAt('xor', 96, 0)];
    const plain = findSmartSpawnPosition(existing, { x: 0, y: 0 });
    const oneSlot = findSmartSpawnPosition(existing, { x: 0, y: 0 }, undefined, {
      slots: 1,
      spacing: 72,
    });
    expect(oneSlot).toEqual(plain);
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
