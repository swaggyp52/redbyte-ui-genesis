/**
 * Contract gate: Scenario timeline authoring hardening.
 *
 * Tests the pure authoring invariants — all logic is data-structure-level,
 * independent of React. These tests exercise the same algorithms that
 * VerifySurface.tsx uses for its handlers.
 *
 *   1. Carry-forward: after adding a vector, draft values match the added row
 *   2. Delete by id: exactly one row removed, same-tick peers untouched
 *   3. Duplicate-row: creates row at tick+1, new id, sorted, same-tick allowed
 *   4. Hold × N: appends N rows from draft, ticks increment, draft advances
 *   5. Pulse: two rows (high then low), one signal toggled, others carry forward
 *   6. Same-tick regression: two rows with identical tick but distinct ids are
 *      independently editable and independently deletable
 */

import { describe, expect, it } from 'vitest';

// ─── Shared types (mirrors VerifyAuthorVector) ────────────────────────────────

interface AuthorVector {
  id: string;
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
}

// ─── Pure algorithm helpers — mirrors VerifySurface.tsx handlers ──────────────

/** Add a vector and derive the next draft state (carry-forward). */
function addVector(
  vectors: AuthorVector[],
  draft: { tick: number; inputs: Record<string, '0' | '1'>; expected: Record<string, '0' | '1'> },
  inputFieldIds: string[],
  outputFieldIds: string[]
): {
  nextVectors: AuthorVector[];
  nextTick: number;
  nextInputs: Record<string, '0' | '1'>;
  nextExpected: Record<string, '0' | '1'>;
} {
  const newVec: AuthorVector = {
    id: `vec-${String(vectors.length + 1).padStart(2, '0')}`,
    tick: draft.tick,
    inputs: inputFieldIds.reduce<Record<string, 0 | 1>>((acc, id) => {
      acc[id] = draft.inputs[id] === '1' ? 1 : 0;
      return acc;
    }, {}),
    expected: outputFieldIds.reduce<Record<string, 0 | 1>>((acc, id) => {
      acc[id] = draft.expected[id] === '1' ? 1 : 0;
      return acc;
    }, {}),
  };
  const nextVectors = [...vectors, newVec].sort((a, b) => a.tick - b.tick);
  // Carry-forward: draft advances to tick+1, preserves values from added vector
  const nextInputs = inputFieldIds.reduce<Record<string, '0' | '1'>>((acc, id) => {
    acc[id] = newVec.inputs[id] === 1 ? '1' : '0';
    return acc;
  }, {});
  const nextExpected = outputFieldIds.reduce<Record<string, '0' | '1'>>((acc, id) => {
    acc[id] = newVec.expected[id] === 1 ? '1' : '0';
    return acc;
  }, {});
  return { nextVectors, nextTick: newVec.tick + 1, nextInputs, nextExpected };
}

/** Delete by vector id (not by tick). */
function deleteById(vectors: AuthorVector[], vectorId: string): AuthorVector[] {
  return vectors.filter((v) => v.id !== vectorId);
}

/** Duplicate a row at tick + 1 with a new id, sorted. */
function duplicateVector(vectors: AuthorVector[], vectorId: string): AuthorVector[] {
  const source = vectors.find((v) => v.id === vectorId);
  if (!source) return vectors;
  const copy: AuthorVector = {
    id: `vec-copy-${Date.now()}`,
    tick: source.tick + 1,
    inputs: { ...source.inputs },
    expected: { ...source.expected },
  };
  return [...vectors, copy].sort((a, b) => a.tick - b.tick);
}

/** Hold × N: append N copies of draft at consecutive ticks. */
function holdN(
  vectors: AuthorVector[],
  n: number,
  draftTick: number,
  draftInputs: Record<string, '0' | '1'>,
  draftExpected: Record<string, '0' | '1'>,
  inputFieldIds: string[],
  outputFieldIds: string[]
): { nextVectors: AuthorVector[]; nextTick: number } {
  const clampedN = Math.max(1, Math.min(64, n));
  const newRows: AuthorVector[] = Array.from({ length: clampedN }, (_, i) => ({
    id: `vec-h${i}`,
    tick: draftTick + i,
    inputs: inputFieldIds.reduce<Record<string, 0 | 1>>((acc, id) => {
      acc[id] = draftInputs[id] === '1' ? 1 : 0;
      return acc;
    }, {}),
    expected: outputFieldIds.reduce<Record<string, 0 | 1>>((acc, id) => {
      acc[id] = draftExpected[id] === '1' ? 1 : 0;
      return acc;
    }, {}),
  }));
  const nextVectors = [...vectors, ...newRows].sort((a, b) => a.tick - b.tick);
  return { nextVectors, nextTick: draftTick + clampedN };
}

/** Pulse: signal HIGH at tick, LOW at tick+1, others carry forward. */
function pulse(
  vectors: AuthorVector[],
  signalId: string,
  draftTick: number,
  draftInputs: Record<string, '0' | '1'>,
  draftExpected: Record<string, '0' | '1'>,
  inputFieldIds: string[],
  outputFieldIds: string[]
): { nextVectors: AuthorVector[]; nextTick: number } {
  const baseInputs = inputFieldIds.reduce<Record<string, 0 | 1>>((acc, id) => {
    acc[id] = draftInputs[id] === '1' ? 1 : 0;
    return acc;
  }, {});
  const baseExpected = outputFieldIds.reduce<Record<string, 0 | 1>>((acc, id) => {
    acc[id] = draftExpected[id] === '1' ? 1 : 0;
    return acc;
  }, {});
  const rowHigh: AuthorVector = {
    id: `vec-ph`,
    tick: draftTick,
    inputs: { ...baseInputs, [signalId]: 1 },
    expected: { ...baseExpected },
  };
  const rowLow: AuthorVector = {
    id: `vec-pl`,
    tick: draftTick + 1,
    inputs: { ...baseInputs, [signalId]: 0 },
    expected: { ...baseExpected },
  };
  const nextVectors = [...vectors, rowHigh, rowLow].sort((a, b) => a.tick - b.tick);
  return { nextVectors, nextTick: draftTick + 2 };
}

/** Inline toggle: flip a scalar binary input cell. */
function toggleVectorCell(
  vectors: AuthorVector[],
  vectorId: string,
  fieldId: string
): AuthorVector[] {
  return vectors.map((v) => {
    if (v.id !== vectorId) return v;
    const current = v.inputs[fieldId] ?? 0;
    return { ...v, inputs: { ...v.inputs, [fieldId]: (current === 1 ? 0 : 1) as 0 | 1 } };
  });
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INPUT_FIELDS = ['clk', 'rst', 'en'];
const OUTPUT_FIELDS = ['q'];

function makeDraft(tick = 0, clk: '0' | '1' = '0', rst: '0' | '1' = '0', en: '0' | '1' = '0', q: '0' | '1' = '0') {
  return {
    tick,
    inputs: { clk, rst, en },
    expected: { q },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('carry-forward on addVector', () => {
  it('draft tick advances to tick + 1 after add', () => {
    const { nextTick } = addVector([], makeDraft(5, '1', '0', '1', '1'), INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextTick).toBe(6);
  });

  it('draft inputs carry forward from the added vector', () => {
    const draft = makeDraft(0, '1', '0', '1', '0');
    const { nextInputs } = addVector([], draft, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextInputs['clk']).toBe('1');
    expect(nextInputs['rst']).toBe('0');
    expect(nextInputs['en']).toBe('1');
  });

  it('draft expected outputs carry forward from the added vector', () => {
    const draft = makeDraft(0, '0', '0', '0', '1');
    const { nextExpected } = addVector([], draft, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextExpected['q']).toBe('1');
  });

  it('vectors are sorted by tick after add', () => {
    const existing: AuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
      { id: 'vec-02', tick: 3, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
    ];
    // Add at tick 1 — should be inserted between 0 and 3
    const { nextVectors } = addVector(existing, makeDraft(1, '1', '0', '0', '0'), INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextVectors.map((v) => v.tick)).toEqual([0, 1, 3]);
  });
});

describe('delete by id — not by tick', () => {
  it('deletes exactly the vector with the matching id', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 5, inputs: { clk: 1, rst: 0, en: 1 }, expected: { q: 1 } },
      { id: 'vec-02', tick: 5, inputs: { clk: 0, rst: 1, en: 0 }, expected: { q: 0 } },
      { id: 'vec-03', tick: 7, inputs: { clk: 1, rst: 0, en: 0 }, expected: { q: 0 } },
    ];
    const result = deleteById(vectors, 'vec-01');
    expect(result).toHaveLength(2);
    expect(result.some((v) => v.id === 'vec-01')).toBe(false);
    // Same-tick peer must survive
    expect(result.some((v) => v.id === 'vec-02')).toBe(true);
  });

  it('leaves all vectors intact when id is not found', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
    ];
    expect(deleteById(vectors, 'vec-99')).toHaveLength(1);
  });
});

describe('same-tick regression', () => {
  it('two rows at the same tick with different ids coexist and are independently deletable', () => {
    const base: AuthorVector[] = [
      { id: 'vec-01', tick: 2, inputs: { clk: 1, rst: 0, en: 1 }, expected: { q: 1 } },
      { id: 'vec-02', tick: 2, inputs: { clk: 0, rst: 1, en: 0 }, expected: { q: 0 } },
    ];
    // Delete vec-01 — vec-02 must survive
    const afterFirst = deleteById(base, 'vec-01');
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]!.id).toBe('vec-02');

    // Delete vec-02 — vec-01 must survive
    const afterSecond = deleteById(base, 'vec-02');
    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0]!.id).toBe('vec-01');
  });

  it('two rows at same tick can be independently toggled', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 2, inputs: { clk: 1, rst: 0, en: 1 }, expected: { q: 1 } },
      { id: 'vec-02', tick: 2, inputs: { clk: 0, rst: 1, en: 0 }, expected: { q: 0 } },
    ];
    // Toggle clk on vec-01 only
    const result = toggleVectorCell(vectors, 'vec-01', 'clk');
    expect(result.find((v) => v.id === 'vec-01')!.inputs['clk']).toBe(0);
    // vec-02 must be unaffected
    expect(result.find((v) => v.id === 'vec-02')!.inputs['clk']).toBe(0);
  });
});

describe('duplicate-row', () => {
  it('creates a copy at tick + 1 with a new id', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 3, inputs: { clk: 1, rst: 0, en: 1 }, expected: { q: 1 } },
    ];
    const result = duplicateVector(vectors, 'vec-01');
    expect(result).toHaveLength(2);
    const copy = result.find((v) => v.id !== 'vec-01');
    expect(copy).toBeDefined();
    expect(copy!.tick).toBe(4);
    expect(copy!.inputs).toEqual({ clk: 1, rst: 0, en: 1 });
  });

  it('result is sorted by tick', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
      { id: 'vec-02', tick: 2, inputs: { clk: 1, rst: 0, en: 1 }, expected: { q: 1 } },
    ];
    const result = duplicateVector(vectors, 'vec-01');
    expect(result.map((v) => v.tick)).toEqual([0, 1, 2]);
  });

  it('same-tick coexistence: original and copy can have same tick if copy tick equals existing', () => {
    // Source at tick 1, another vector at tick 2. Duplicate source → copy at tick 2.
    // Both tick-2 rows must exist.
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 1, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
      { id: 'vec-02', tick: 2, inputs: { clk: 1, rst: 0, en: 1 }, expected: { q: 1 } },
    ];
    const result = duplicateVector(vectors, 'vec-01');
    expect(result).toHaveLength(3);
    expect(result.filter((v) => v.tick === 2)).toHaveLength(2);
  });

  it('does not remove the original row', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 5, inputs: { clk: 1, rst: 0, en: 0 }, expected: { q: 0 } },
    ];
    const result = duplicateVector(vectors, 'vec-01');
    expect(result.some((v) => v.id === 'vec-01')).toBe(true);
  });
});

describe('Hold × N', () => {
  it('appends exactly N rows', () => {
    const draft = makeDraft(10, '1', '0', '1', '1');
    const { nextVectors } = holdN([], 4, draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextVectors).toHaveLength(4);
  });

  it('rows have consecutive ticks starting from draftTick', () => {
    const draft = makeDraft(3, '1', '0', '0', '0');
    const { nextVectors } = holdN([], 3, draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextVectors.map((v) => v.tick)).toEqual([3, 4, 5]);
  });

  it('all rows have the same input values as the draft', () => {
    const draft = makeDraft(0, '1', '1', '0', '0');
    const { nextVectors } = holdN([], 3, draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    for (const v of nextVectors) {
      expect(v.inputs['clk']).toBe(1);
      expect(v.inputs['rst']).toBe(1);
      expect(v.inputs['en']).toBe(0);
    }
  });

  it('draft tick advances to draftTick + N after hold', () => {
    const draft = makeDraft(5, '0', '0', '1', '0');
    const { nextTick } = holdN([], 4, draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextTick).toBe(9);
  });

  it('clamps N to minimum 1', () => {
    const draft = makeDraft(0);
    const { nextVectors } = holdN([], 0, draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextVectors).toHaveLength(1);
  });

  it('clamps N to maximum 64', () => {
    const draft = makeDraft(0);
    const { nextVectors } = holdN([], 100, draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextVectors).toHaveLength(64);
  });
});

describe('Pulse', () => {
  it('inserts exactly two rows', () => {
    const draft = makeDraft(7, '0', '0', '0', '0');
    const { nextVectors } = pulse([], 'clk', draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextVectors).toHaveLength(2);
  });

  it('first row has selected signal HIGH, second row LOW', () => {
    const draft = makeDraft(7, '0', '0', '0', '0');
    const { nextVectors } = pulse([], 'clk', draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextVectors[0]!.inputs['clk']).toBe(1);
    expect(nextVectors[1]!.inputs['clk']).toBe(0);
  });

  it('rows are at draftTick and draftTick + 1', () => {
    const draft = makeDraft(3);
    const { nextVectors } = pulse([], 'en', draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextVectors.map((v) => v.tick)).toEqual([3, 4]);
  });

  it('other signals carry forward from draft — unchanged by pulse', () => {
    const draft = makeDraft(0, '0', '1', '0', '0'); // rst=1, pulsing clk
    const { nextVectors } = pulse([], 'clk', draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    // In both rows, rst must remain 1 (carry-forward)
    expect(nextVectors[0]!.inputs['rst']).toBe(1);
    expect(nextVectors[1]!.inputs['rst']).toBe(1);
    // en must remain 0
    expect(nextVectors[0]!.inputs['en']).toBe(0);
    expect(nextVectors[1]!.inputs['en']).toBe(0);
  });

  it('draft tick advances to draftTick + 2 after pulse', () => {
    const draft = makeDraft(10);
    const { nextTick } = pulse([], 'clk', draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextTick).toBe(12);
  });

  it('existing vectors are preserved and result is sorted', () => {
    const existing: AuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
      { id: 'vec-02', tick: 5, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
    ];
    const draft = makeDraft(2);
    const { nextVectors } = pulse(existing, 'clk', draft.tick, draft.inputs, draft.expected, INPUT_FIELDS, OUTPUT_FIELDS);
    expect(nextVectors).toHaveLength(4);
    expect(nextVectors.map((v) => v.tick)).toEqual([0, 2, 3, 5]);
  });
});

describe('inline cell toggle', () => {
  it('toggles a 0 → 1', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
    ];
    const result = toggleVectorCell(vectors, 'vec-01', 'clk');
    expect(result[0]!.inputs['clk']).toBe(1);
  });

  it('toggles a 1 → 0', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: { clk: 1, rst: 0, en: 0 }, expected: { q: 0 } },
    ];
    const result = toggleVectorCell(vectors, 'vec-01', 'clk');
    expect(result[0]!.inputs['clk']).toBe(0);
  });

  it('does not mutate other vectors', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
      { id: 'vec-02', tick: 1, inputs: { clk: 1, rst: 1, en: 1 }, expected: { q: 1 } },
    ];
    const result = toggleVectorCell(vectors, 'vec-01', 'clk');
    // vec-02 must be unchanged
    expect(result[1]!.inputs['clk']).toBe(1);
    expect(result[1]!.inputs['rst']).toBe(1);
  });

  it('returns a new array — original is not mutated', () => {
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: { clk: 0, rst: 0, en: 0 }, expected: { q: 0 } },
    ];
    const original = vectors[0]!.inputs['clk'];
    toggleVectorCell(vectors, 'vec-01', 'clk');
    // Original must be unchanged
    expect(vectors[0]!.inputs['clk']).toBe(original);
  });
});
