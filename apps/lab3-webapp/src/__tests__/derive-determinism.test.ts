import { describe, it, expect } from 'vitest';
import { recomputeDerived } from '../derive/recomputeDerived';
import { createEmptyLabDoc } from '../store/labStore';
import { DIGIT_PATTERNS } from '../types';

describe('recomputeDerived', () => {
  it('is deterministic: same input → same output', () => {
    const doc = createEmptyLabDoc();
    const r1 = recomputeDerived(doc);
    const r2 = recomputeDerived(doc);
    expect(r1.kMaps).toEqual(r2.kMaps);
    expect(r1.expressions).toEqual(r2.expressions);
    expect(r1.results).toEqual(r2.results);
  });

  it('produces 7 kMap entries (a-g)', () => {
    const doc = createEmptyLabDoc();
    const d = recomputeDerived(doc);
    expect(Object.keys(d.kMaps)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('produces 7 expression entries', () => {
    const doc = createEmptyLabDoc();
    const d = recomputeDerived(doc);
    expect(Object.keys(d.expressions)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('standard digits produce non-trivial expressions', () => {
    const doc = createEmptyLabDoc();
    const filled = {
      ...doc,
      truthTable: doc.truthTable.map((row, i) => {
        if (i < 10) return { ...row, seg: DIGIT_PATTERNS[i], isDontCare: false };
        return { ...row, isDontCare: true, seg: [1, 1, 1, 1, 1, 1, 1] as any };
      }),
    };
    const d = recomputeDerived(filled);
    expect(d.expressions['a']).not.toBe('0');
    expect(d.expressions['a']).not.toBe('');
  });

  it('single cell edit changes the affected segment kMap', () => {
    const doc = createEmptyLabDoc();
    const before = recomputeDerived(doc);

    const edited = {
      ...doc,
      truthTable: doc.truthTable.map((row, i) =>
        i === 0 ? { ...row, seg: [0, ...row.seg.slice(1)] as any } : row
      ),
    };
    const after = recomputeDerived(edited);
    expect(after.kMaps['a']).not.toEqual(before.kMaps['a']);
  });
});
