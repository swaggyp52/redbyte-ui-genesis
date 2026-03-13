import { describe, it, expect } from 'vitest';
import { computeAlignmentGuides, ALIGNMENT_THRESHOLD_WORLD } from '../tools/alignmentGuides';
import type { CircuitNode } from '@redbyte/rb-logic-core';

const node = (id: string, x: number, y: number): CircuitNode =>
  ({ id, type: 'AND', position: { x, y }, rotation: 0, config: {}, state: {} } as CircuitNode);

const THRESHOLD = ALIGNMENT_THRESHOLD_WORLD; // 6

describe('computeAlignmentGuides', () => {
  it('returns empty guides when there are no other nodes', () => {
    const guides = computeAlignmentGuides('a', { x: 50, y: 50 }, [node('a', 50, 50)]);
    expect(guides.verticals).toHaveLength(0);
    expect(guides.horizontals).toHaveLength(0);
  });

  it('detects vertical alignment (same X, within threshold)', () => {
    const nodes = [node('a', 50, 50), node('b', 52, 100)]; // within threshold 6
    const guides = computeAlignmentGuides('a', { x: 50, y: 50 }, nodes);
    expect(guides.verticals).toContain(52);
  });

  it('detects horizontal alignment (same Y, within threshold)', () => {
    const nodes = [node('a', 50, 50), node('b', 120, 53)]; // within threshold 6
    const guides = computeAlignmentGuides('a', { x: 50, y: 50 }, nodes);
    expect(guides.horizontals).toContain(53);
  });

  it('does not detect alignment beyond threshold', () => {
    const nodes = [node('a', 50, 50), node('b', 57, 57)]; // 7 > threshold 6
    const guides = computeAlignmentGuides('a', { x: 50, y: 50 }, nodes);
    expect(guides.verticals).toHaveLength(0);
    expect(guides.horizontals).toHaveLength(0);
  });

  it('detects alignment at exactly the threshold boundary', () => {
    const nodes = [node('a', 50, 50), node('b', 56, 56)]; // exactly 6 = threshold
    const guides = computeAlignmentGuides('a', { x: 50, y: 50 }, nodes);
    expect(guides.verticals).toContain(56);
    expect(guides.horizontals).toContain(56);
  });

  it('skips the dragged node itself', () => {
    const nodes = [node('a', 50, 50)];
    const guides = computeAlignmentGuides('a', { x: 50, y: 50 }, nodes);
    expect(guides.verticals).toHaveLength(0);
    expect(guides.horizontals).toHaveLength(0);
  });

  it('detects multiple alignment candidates', () => {
    const nodes = [
      node('dragged', 50, 50),
      node('b', 51, 100), // aligns X
      node('c', 52, 200), // aligns X
      node('d', 100, 51), // aligns Y
    ];
    const guides = computeAlignmentGuides('dragged', { x: 50, y: 50 }, nodes);
    expect(guides.verticals).toContain(51);
    expect(guides.verticals).toContain(52);
    expect(guides.horizontals).toContain(51);
  });
});
