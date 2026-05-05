// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { IDE_EXAMPLES } from '../examplesCatalog';
import { LAB_STARTERS } from '../labStarters';

// All examples reachable through the catalog (lab starters are included via spread)
const ALL_EXAMPLES = IDE_EXAMPLES;

describe('learning path metadata', () => {
  const pathItems = ALL_EXAMPLES
    .filter((ex) => ex.learningPath != null)
    .sort((a, b) => a.learningPath!.order - b.learningPath!.order);

  it('has exactly 6 items in the learning path', () => {
    expect(pathItems).toHaveLength(6);
  });

  it('path items have orders 1-6 with no gaps', () => {
    const orders = pathItems.map((ex) => ex.learningPath!.order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('all 6 expected example IDs are in the path', () => {
    const pathIds = new Set(pathItems.map((ex) => ex.id));
    expect(pathIds.has('logic-gates')).toBe(true);
    expect(pathIds.has('half-adder')).toBe(true);
    expect(pathIds.has('full-adder')).toBe(true);
    expect(pathIds.has('signal-tour')).toBe(true);
    expect(pathIds.has('two-bit-counter')).toBe(true);
    expect(pathIds.has('23_lab8-fsm-lock-starter-basys3')).toBe(true);
  });

  it('signal-tour is marked flagship', () => {
    const signalTour = ALL_EXAMPLES.find((ex) => ex.id === 'signal-tour');
    expect(signalTour?.learningPath?.flagship).toBe(true);
  });

  it('two-bit-counter has openProof noting E3 is not yet closed', () => {
    const counter = ALL_EXAMPLES.find((ex) => ex.id === 'two-bit-counter');
    expect(typeof counter?.learningPath?.openProof).toBe('string');
    expect(counter!.learningPath!.openProof!.length).toBeGreaterThan(0);
  });

  it('half-adder has category showcase (not course)', () => {
    const ha = ALL_EXAMPLES.find((ex) => ex.id === 'half-adder');
    expect(ha?.category).toBe('showcase');
  });

  it('full-adder has category showcase (not course)', () => {
    const fa = ALL_EXAMPLES.find((ex) => ex.id === 'full-adder');
    expect(fa?.category).toBe('showcase');
  });

  it('each nextExampleId points to an existing example, or is undefined for the last item', () => {
    const allIds = new Set(ALL_EXAMPLES.map((ex) => ex.id));
    for (const item of pathItems) {
      const next = item.learningPath!.nextExampleId;
      if (next !== undefined) {
        expect(allIds.has(next)).toBe(true);
      }
    }
  });

  it('path items are in non-decreasing tier order', () => {
    const tiers = pathItems.map((ex) => ex.learningPath!.tier);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]).toBeGreaterThanOrEqual(tiers[i - 1]);
    }
  });

  it('lab8 fsm starter is in the path at tier 4', () => {
    const starter = LAB_STARTERS.find((s) => s.id === 'lab8-security-lock-fsm');
    expect(starter?.example?.learningPath?.tier).toBe(4);
  });
});
