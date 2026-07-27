import { describe, expect, it } from 'vitest';
import { updateExpectedCellInVectorSets } from '../surfaces/VerifySurface';

describe('Verify per-cell optional checks', () => {
  it('changes only the selected signal at the selected event', () => {
    const projectVectors = [
      { id: 'vec-01', tick: 0, inputs: { a: 0 }, expected: { carry: 0 } },
      { id: 'vec-02', tick: 1, inputs: { a: 1 }, expected: { carry: 1 } },
    ];
    const result = updateExpectedCellInVectorSets({
      projectVectors,
      customVectors: [],
      tick: 1,
      vectorId: 'vec-02',
      signal: 'SUM',
      nextValue: 1,
    });

    expect(result.changed).toBe(true);
    expect(result.projectVectors).toEqual([
      projectVectors[0],
      { ...projectVectors[1], expected: { carry: 1, sum: 1 } },
    ]);
    expect(projectVectors[1]?.expected).toEqual({ carry: 1 });
  });

  it('does not mutate the collections when no confirmation update is applied', () => {
    const projectVectors = [
      { id: 'vec-01', tick: 0, inputs: { a: 0 }, expected: {} },
    ];

    expect(projectVectors).toEqual([
      { id: 'vec-01', tick: 0, inputs: { a: 0 }, expected: {} },
    ]);
  });
});
