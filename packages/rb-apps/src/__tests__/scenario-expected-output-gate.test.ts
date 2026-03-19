/**
 * Contract gate: Expected-output authoring + mismatch navigation.
 *
 * Tests the pure data-structure algorithms used by VerifySurface for:
 *
 *   1. handleToggleVectorExpected — toggles v.expected[field] 0↔1, immutable
 *   2. handleFixExpectation — sets expected directly to actual (NOT a blind toggle)
 *   3. runResultByVecAndSignal — (vecId, signal) → 'pass'|'fail'|absent
 *   4. applyFailureSelection navigation contract — selectedVectorId + selectedTick
 *   5. Same-tick disambiguation — vectorId targets the right row when tick collides
 *   6. Missing vectorId fallback — selectedVectorId=null when no identity available
 */

import { describe, expect, it } from 'vitest';

// ─── Shared types ─────────────────────────────────────────────────────────────

interface AuthorVector {
  id: string;
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
}

interface RunRow {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
  status: 'pass' | 'fail';
  vectorId?: string;
}

// ─── Algorithm mirrors ────────────────────────────────────────────────────────

function normalizeFieldId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/** Toggle v.expected[field] between 0 and 1, returns new array (immutable). */
function toggleVectorExpected(
  vectors: AuthorVector[],
  vectorId: string,
  fieldId: string
): AuthorVector[] {
  return vectors.map((v) => {
    if (v.id !== vectorId) return v;
    const current = v.expected[fieldId] ?? 0;
    return { ...v, expected: { ...v.expected, [fieldId]: (current === 1 ? 0 : 1) as 0 | 1 } };
  });
}

/** Set v.expected[signal] directly to the given actual value.
 *  This is NOT a blind toggle — it is an explicit "accept this actual as correct" action.
 *  Only updates the specific (vectorId, signal) pair; leaves all other rows unchanged. */
function fixExpectation(
  vectors: AuthorVector[],
  vectorId: string,
  signal: string,
  actualValue: '0' | '1'
): AuthorVector[] {
  const normalizedSignal = normalizeFieldId(signal);
  return vectors.map((v) => {
    if (v.id !== vectorId) return v;
    return { ...v, expected: { ...v.expected, [normalizedSignal]: (actualValue === '1' ? 1 : 0) as 0 | 1 } };
  });
}

/** Build a (vecId::signal) → status lookup from run rows.
 *  Only rows with vectorId are indexed (rows without vectorId are excluded). */
function buildRunResultMap(runRows: RunRow[]): Map<string, 'pass' | 'fail'> {
  const map = new Map<string, 'pass' | 'fail'>();
  for (const row of runRows) {
    if (row.vectorId) {
      map.set(`${row.vectorId}::${normalizeFieldId(row.signal)}`, row.status);
    }
  }
  return map;
}

/** Simulate applyFailureSelection: returns selectedTick + selectedVectorId.
 *  When vectorId is absent, selectedVectorId is null (no row pinpointing). */
function applyFailureSelection(failure: RunRow | null): {
  selectedTick: number | null;
  selectedVectorId: string | null;
  drawerOpen: boolean;
  sideTab: string;
} {
  if (!failure) return { selectedTick: null, selectedVectorId: null, drawerOpen: false, sideTab: 'mismatches' };
  return {
    selectedTick: failure.tick,
    selectedVectorId: failure.vectorId ?? null,
    drawerOpen: true,
    sideTab: 'vectors',
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVectors(): AuthorVector[] {
  return [
    { id: 'vec-01', tick: 0, inputs: { clk: 0, rst: 1 }, expected: { q: 0 } },
    { id: 'vec-02', tick: 1, inputs: { clk: 1, rst: 0 }, expected: { q: 1 } },
    { id: 'vec-03', tick: 2, inputs: { clk: 0, rst: 0 }, expected: { q: 1 } },
    // Same-tick pair at tick 3
    { id: 'vec-04', tick: 3, inputs: { clk: 1, rst: 0 }, expected: { q: 0 } },
    { id: 'vec-05', tick: 3, inputs: { clk: 0, rst: 1 }, expected: { q: 1 } },
  ];
}

function makeRunRows(): RunRow[] {
  return [
    { tick: 0, signal: 'q', expected: '0', actual: '0', status: 'pass', vectorId: 'vec-01' },
    { tick: 1, signal: 'q', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-02' },
    { tick: 2, signal: 'q', expected: '1', actual: '1', status: 'pass', vectorId: 'vec-03' },
    { tick: 3, signal: 'q', expected: '0', actual: '1', status: 'fail', vectorId: 'vec-04' },
    { tick: 3, signal: 'q', expected: '1', actual: '1', status: 'pass', vectorId: 'vec-05' },
  ];
}

// ─── toggleVectorExpected ─────────────────────────────────────────────────────

describe('toggleVectorExpected', () => {
  it('toggles 0 → 1 on the target row', () => {
    const vectors = makeVectors();
    const result = toggleVectorExpected(vectors, 'vec-01', 'q');
    expect(result.find((v) => v.id === 'vec-01')!.expected['q']).toBe(1);
  });

  it('toggles 1 → 0 on the target row', () => {
    const vectors = makeVectors();
    const result = toggleVectorExpected(vectors, 'vec-02', 'q');
    expect(result.find((v) => v.id === 'vec-02')!.expected['q']).toBe(0);
  });

  it('does not touch other rows', () => {
    const vectors = makeVectors();
    const result = toggleVectorExpected(vectors, 'vec-01', 'q');
    expect(result.find((v) => v.id === 'vec-02')!.expected['q']).toBe(1);
    expect(result.find((v) => v.id === 'vec-03')!.expected['q']).toBe(1);
  });

  it('does not touch inputs — only expected', () => {
    const vectors = makeVectors();
    const before = { ...vectors.find((v) => v.id === 'vec-01')!.inputs };
    const result = toggleVectorExpected(vectors, 'vec-01', 'q');
    expect(result.find((v) => v.id === 'vec-01')!.inputs).toEqual(before);
  });

  it('returns a new array — does not mutate original', () => {
    const vectors = makeVectors();
    const original = vectors[0]!.expected['q'];
    toggleVectorExpected(vectors, 'vec-01', 'q');
    expect(vectors[0]!.expected['q']).toBe(original);
  });

  it('correctly toggles same-tick rows independently', () => {
    const vectors = makeVectors();
    // Toggle vec-04 (tick 3) — vec-05 (also tick 3) must be unaffected
    const result = toggleVectorExpected(vectors, 'vec-04', 'q');
    expect(result.find((v) => v.id === 'vec-04')!.expected['q']).toBe(1);
    expect(result.find((v) => v.id === 'vec-05')!.expected['q']).toBe(1); // unchanged
  });
});

// ─── fixExpectation ───────────────────────────────────────────────────────────

describe('fixExpectation — set to actual, not blind toggle', () => {
  it('sets expected to the provided actual value (0)', () => {
    const vectors = makeVectors(); // vec-02.expected.q = 1
    const result = fixExpectation(vectors, 'vec-02', 'q', '0');
    expect(result.find((v) => v.id === 'vec-02')!.expected['q']).toBe(0);
  });

  it('sets expected to the provided actual value (1)', () => {
    const vectors = makeVectors(); // vec-01.expected.q = 0
    const result = fixExpectation(vectors, 'vec-01', 'q', '1');
    expect(result.find((v) => v.id === 'vec-01')!.expected['q']).toBe(1);
  });

  it('is idempotent: applying same actual twice leaves expected unchanged', () => {
    const vectors = makeVectors();
    const r1 = fixExpectation(vectors, 'vec-02', 'q', '0');
    const r2 = fixExpectation(r1, 'vec-02', 'q', '0');
    expect(r2.find((v) => v.id === 'vec-02')!.expected['q']).toBe(0);
  });

  it('is NOT a blind toggle: applying actual=1 twice gives 1, not 0', () => {
    const vectors = makeVectors(); // vec-01.expected.q = 0
    const r1 = fixExpectation(vectors, 'vec-01', 'q', '1');
    const r2 = fixExpectation(r1, 'vec-01', 'q', '1');
    // If it were a toggle, second call would flip back to 0. It must not.
    expect(r2.find((v) => v.id === 'vec-01')!.expected['q']).toBe(1);
  });

  it('only updates the specific (vectorId, signal) pair', () => {
    const vectors = makeVectors();
    const result = fixExpectation(vectors, 'vec-04', 'q', '1');
    // vec-05 at same tick must be unaffected
    expect(result.find((v) => v.id === 'vec-05')!.expected['q']).toBe(1); // originally 1, unchanged
    // Other rows must also be unchanged
    expect(result.find((v) => v.id === 'vec-01')!.expected['q']).toBe(0);
  });

  it('normalizes signal name before setting expected', () => {
    // Signal names may come from the run report with mixed case or spaces
    const vectors: AuthorVector[] = [
      { id: 'vec-01', tick: 0, inputs: {}, expected: { out_q: 0 } },
    ];
    // 'OUT_Q' should normalize to 'out_q' and match
    const result = fixExpectation(vectors, 'vec-01', 'OUT_Q', '1');
    expect(result.find((v) => v.id === 'vec-01')!.expected['out_q']).toBe(1);
  });

  it('returns a new array — does not mutate original', () => {
    const vectors = makeVectors();
    const before = vectors[1]!.expected['q'];
    fixExpectation(vectors, 'vec-02', 'q', '0');
    expect(vectors[1]!.expected['q']).toBe(before);
  });
});

// ─── runResultByVecAndSignal ──────────────────────────────────────────────────

describe('runResultByVecAndSignal lookup', () => {
  it('returns pass for a passing (vecId, signal) pair', () => {
    const map = buildRunResultMap(makeRunRows());
    expect(map.get('vec-01::q')).toBe('pass');
  });

  it('returns fail for a failing (vecId, signal) pair', () => {
    const map = buildRunResultMap(makeRunRows());
    expect(map.get('vec-02::q')).toBe('fail');
  });

  it('returns undefined for (vecId, signal) not in run results', () => {
    const map = buildRunResultMap(makeRunRows());
    expect(map.get('vec-99::q')).toBeUndefined();
  });

  it('excludes rows without vectorId — no spurious entries', () => {
    const rows: RunRow[] = [
      { tick: 0, signal: 'q', expected: '1', actual: '0', status: 'fail' }, // no vectorId
    ];
    const map = buildRunResultMap(rows);
    expect(map.size).toBe(0);
  });

  it('distinguishes same-tick rows by vectorId', () => {
    const map = buildRunResultMap(makeRunRows());
    // vec-04 at tick 3 → fail; vec-05 at tick 3 → pass
    expect(map.get('vec-04::q')).toBe('fail');
    expect(map.get('vec-05::q')).toBe('pass');
  });

  it('normalizes signal name in the key', () => {
    const rows: RunRow[] = [
      { tick: 0, signal: 'OUT Q', expected: '1', actual: '0', status: 'fail', vectorId: 'vec-01' },
    ];
    const map = buildRunResultMap(rows);
    // Signal 'OUT Q' → normalized 'out_q'
    expect(map.get('vec-01::out_q')).toBe('fail');
  });
});

// ─── applyFailureSelection navigation contract ────────────────────────────────

describe('applyFailureSelection navigation contract', () => {
  it('sets selectedTick to the failure tick', () => {
    const failure = makeRunRows().find((r) => r.vectorId === 'vec-02')!;
    const { selectedTick } = applyFailureSelection(failure);
    expect(selectedTick).toBe(1);
  });

  it('sets selectedVectorId when vectorId is present', () => {
    const failure = makeRunRows().find((r) => r.vectorId === 'vec-02')!;
    const { selectedVectorId } = applyFailureSelection(failure);
    expect(selectedVectorId).toBe('vec-02');
  });

  it('opens the drawer and switches to vectors tab', () => {
    const failure = makeRunRows()[1]!;
    const { drawerOpen, sideTab } = applyFailureSelection(failure);
    expect(drawerOpen).toBe(true);
    expect(sideTab).toBe('vectors');
  });

  it('selectedVectorId is null when failure has no vectorId — no false pinpointing', () => {
    const failure: RunRow = {
      tick: 5, signal: 'q', expected: '1', actual: '0', status: 'fail',
      // no vectorId
    };
    const { selectedVectorId, selectedTick } = applyFailureSelection(failure);
    expect(selectedVectorId).toBeNull();
    // selectedTick still set correctly (tick-only fallback works)
    expect(selectedTick).toBe(5);
  });

  it('null failure → all state fields remain null/closed', () => {
    const { selectedTick, selectedVectorId, drawerOpen } = applyFailureSelection(null);
    expect(selectedTick).toBeNull();
    expect(selectedVectorId).toBeNull();
    expect(drawerOpen).toBe(false);
  });
});

// ─── Same-tick disambiguation ──────────────────────────────────────────────────

describe('same-tick disambiguation via vectorId', () => {
  it('failure for vec-04 (tick 3) targets vec-04, not vec-05', () => {
    const failure = makeRunRows().find((r) => r.vectorId === 'vec-04')!;
    const { selectedVectorId, selectedTick } = applyFailureSelection(failure);
    expect(selectedTick).toBe(3);
    expect(selectedVectorId).toBe('vec-04');
  });

  it('failure for vec-05 (tick 3) targets vec-05, not vec-04', () => {
    const failure = makeRunRows().find((r) => r.vectorId === 'vec-05')!;
    const { selectedVectorId, selectedTick } = applyFailureSelection(failure);
    expect(selectedTick).toBe(3);
    expect(selectedVectorId).toBe('vec-05');
  });

  it('fixExpectation on vec-04 leaves vec-05 untouched at same tick', () => {
    const vectors = makeVectors();
    // vec-04.expected.q = 0, vec-05.expected.q = 1
    const result = fixExpectation(vectors, 'vec-04', 'q', '1');
    expect(result.find((v) => v.id === 'vec-04')!.expected['q']).toBe(1);
    expect(result.find((v) => v.id === 'vec-05')!.expected['q']).toBe(1); // unchanged
  });
});

// ─── Pass/fail cell colorization contract ─────────────────────────────────────

describe('expected-output cell colorization contract', () => {
  it('cell for a passing (vecId, signal) pair returns pass', () => {
    const map = buildRunResultMap(makeRunRows());
    const status = map.get('vec-01::q') ?? null;
    expect(status).toBe('pass');
  });

  it('cell for a failing (vecId, signal) pair returns fail', () => {
    const map = buildRunResultMap(makeRunRows());
    const status = map.get('vec-02::q') ?? null;
    expect(status).toBe('fail');
  });

  it('cell for a vector with no run result returns none (absent)', () => {
    const map = buildRunResultMap(makeRunRows());
    const status = map.get('vec-99::q') ?? null;
    expect(status).toBeNull();
  });

  it('pass/fail are independently determined per (vecId, signal) at same tick', () => {
    const map = buildRunResultMap(makeRunRows());
    // tick 3: vec-04 → fail, vec-05 → pass
    expect(map.get('vec-04::q')).toBe('fail');
    expect(map.get('vec-05::q')).toBe('pass');
  });
});
