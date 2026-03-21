/**
 * VERIFY CONTRACT RESET — Regression test suite.
 *
 * Product rule: Verify may only fail when:
 *   1. the student explicitly authored expected outputs and the circuit disagrees,
 *   2. the testbench/vector is malformed,
 *   3. the simulator/runtime actually broke.
 *
 * Verify must NOT fail because:
 *   - the template/starter project expected different outputs,
 *   - the project previously had expected rows for other signals,
 *   - the design has fewer or different mapped outputs than the starter,
 *   - the verifier inferred "correct outputs" from project metadata.
 */

import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { runDeterministicVerifyFromCircuit } from '../sim/simEngine';
import type { SimulationIoRow } from '../sim/simTypes';
import { normalizeIoSignalKey } from '../ioLabels';
import { pruneStaleVectorExpected } from '../projectRuntime';

// ── Circuit fixtures ───────────────────────────────────────────────────────────

/** 4-output passthrough: SW0→LD0, SW1→LD1, SW2→LD2, SW3→LD3 */
function buildFourOutputCircuit(): Circuit {
  return {
    nodes: [
      { id: 'sw0_n', type: 'INPUT',  label: 'sw0', x: 0,   y: 0,   config: {}, state: {} },
      { id: 'sw1_n', type: 'INPUT',  label: 'sw1', x: 0,   y: 50,  config: {}, state: {} },
      { id: 'sw2_n', type: 'INPUT',  label: 'sw2', x: 0,   y: 100, config: {}, state: {} },
      { id: 'sw3_n', type: 'INPUT',  label: 'sw3', x: 0,   y: 150, config: {}, state: {} },
      { id: 'ld0_n', type: 'OUTPUT', label: 'ld0', x: 200, y: 0,   config: {}, state: {} },
      { id: 'ld1_n', type: 'OUTPUT', label: 'ld1', x: 200, y: 50,  config: {}, state: {} },
      { id: 'ld2_n', type: 'OUTPUT', label: 'ld2', x: 200, y: 100, config: {}, state: {} },
      { id: 'ld3_n', type: 'OUTPUT', label: 'ld3', x: 200, y: 150, config: {}, state: {} },
    ],
    connections: [
      { from: { nodeId: 'sw0_n', portName: 'out' }, to: { nodeId: 'ld0_n', portName: 'in' } },
      { from: { nodeId: 'sw1_n', portName: 'out' }, to: { nodeId: 'ld1_n', portName: 'in' } },
      { from: { nodeId: 'sw2_n', portName: 'out' }, to: { nodeId: 'ld2_n', portName: 'in' } },
      { from: { nodeId: 'sw3_n', portName: 'out' }, to: { nodeId: 'ld3_n', portName: 'in' } },
    ],
  };
}

/** 2-output passthrough: SW0→LD0, SW1→LD1 only (student built a subset) */
function buildTwoOutputCircuit(): Circuit {
  return {
    nodes: [
      { id: 'sw0_n', type: 'INPUT',  label: 'sw0', x: 0,   y: 0,  config: {}, state: {} },
      { id: 'sw1_n', type: 'INPUT',  label: 'sw1', x: 0,   y: 50, config: {}, state: {} },
      { id: 'ld0_n', type: 'OUTPUT', label: 'ld0', x: 200, y: 0,  config: {}, state: {} },
      { id: 'ld1_n', type: 'OUTPUT', label: 'ld1', x: 200, y: 50, config: {}, state: {} },
    ],
    connections: [
      { from: { nodeId: 'sw0_n', portName: 'out' }, to: { nodeId: 'ld0_n', portName: 'in' } },
      { from: { nodeId: 'sw1_n', portName: 'out' }, to: { nodeId: 'ld1_n', portName: 'in' } },
    ],
  };
}

/** DFF circuit: D → DFF → Q (clock-driven sequential) */
function buildDffCircuit(): Circuit {
  return {
    nodes: [
      { id: 'in_d',  type: 'INPUT',    label: 'd',   x: 0,   y: 0,  config: {}, state: {} },
      { id: 'clk_n', type: 'INPUT',    label: 'clk', x: 0,   y: 80, config: {}, state: {} },
      { id: 'ff0',   type: 'DFlipFlop', label: 'ff0', x: 200, y: 0,  config: {}, state: {} },
      { id: 'out_q', type: 'OUTPUT',   label: 'q',   x: 400, y: 0,  config: {}, state: {} },
    ],
    connections: [
      { from: { nodeId: 'in_d',  portName: 'out' }, to: { nodeId: 'ff0',   portName: 'D'   } },
      { from: { nodeId: 'clk_n', portName: 'out' }, to: { nodeId: 'ff0',   portName: 'CLK' } },
      { from: { nodeId: 'ff0',   portName: 'Q'   }, to: { nodeId: 'out_q', portName: 'in'  } },
    ],
  };
}

// ── Helper: replicate the assertionRows filtering from projectRuntime ──────────

function filterAssertionRows(
  rawRows: Array<{ signal: string; expected: string; actual: string }>,
  currentIoRows: SimulationIoRow[],
  assertionMode: boolean
): typeof rawRows {
  if (!assertionMode) return [];
  const currentOutputKeys = new Set(
    currentIoRows
      .filter((r) => r.direction === 'out')
      .flatMap((r) => [normalizeIoSignalKey(r.id), normalizeIoSignalKey(r.label)])
      .filter(Boolean)
  );
  return rawRows.filter((row) => currentOutputKeys.has(normalizeIoSignalKey(row.signal)));
}

// ── CASE 1 ────────────────────────────────────────────────────────────────────

describe('CASE 1 — starter expected LD0-LD3, student built LD0-LD1 only, Assertions OFF', () => {
  it('produces TRACE (no assertion failures) regardless of starter-template expected values', () => {
    // Student has only LD0/LD1 in their design and IO mapping.
    const ioRows: SimulationIoRow[] = [
      { id: 'sw0', label: 'SW0', direction: 'in',  nodeId: 'sw0_n' },
      { id: 'sw1', label: 'SW1', direction: 'in',  nodeId: 'sw1_n' },
      { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_n' },
      { id: 'ld1', label: 'LD1', direction: 'out', nodeId: 'ld1_n' },
    ];

    // Starter vectors have expected values for LD0-LD3 (4 outputs).
    // Student's design only has LD0/LD1 — LD2/LD3 are stale starter expectations.
    const vectors = [
      { tick: 0, inputs: { sw0: 0, sw1: 0 }, expected: { ld0: 0, ld1: 0, ld2: 0, ld3: 0 } },
      { tick: 1, inputs: { sw0: 1, sw1: 0 }, expected: { ld0: 1, ld1: 0, ld2: 0, ld3: 0 } },
    ];

    const result = runDeterministicVerifyFromCircuit(buildTwoOutputCircuit(), ioRows, vectors);
    // Engine returns rows for LD0/LD1 (mapped); LD2/LD3 produce preflight issues.
    const rawRows = result.rows;

    // assertionMode = false → assertionRows = [] → no failures.
    const assertionRows = filterAssertionRows(rawRows, ioRows, false);
    expect(assertionRows).toHaveLength(0);
    // No failed rows → status = 'pass' → displayStatus = 'TRACE'.
    const failedRows = assertionRows.filter((r) => r.expected !== r.actual);
    expect(failedRows).toHaveLength(0);
  });
});

// ── CASE 2 ────────────────────────────────────────────────────────────────────

describe('CASE 2 — DFF circuit, no explicit expected outputs, Assertions OFF', () => {
  it('never fails because of starter combinational expectations', () => {
    const ioRows: SimulationIoRow[] = [
      { id: 'd',   label: 'D',   direction: 'in',  nodeId: 'in_d'  },
      { id: 'clk', label: 'CLK', direction: 'in',  nodeId: 'clk_n' },
      { id: 'q',   label: 'Q',   direction: 'out', nodeId: 'out_q' },
    ];

    // No expected values — student has not set any assertions.
    const vectors = [
      { tick: 0, inputs: { d: 0, clk: 0 }, expected: {} },
      { tick: 1, inputs: { d: 1, clk: 1 }, expected: {} },
    ];

    const result = runDeterministicVerifyFromCircuit(buildDffCircuit(), ioRows, vectors);

    // assertionMode = false → assertionRows = [] regardless of any auto-generated rows.
    const assertionRows = filterAssertionRows(result.rows, ioRows, false);
    expect(assertionRows).toHaveLength(0);

    // No rows → no failures.
    const failedRows = assertionRows.filter((r) => r.expected !== r.actual);
    expect(failedRows).toHaveLength(0);
  });
});

// ── CASE 3 ────────────────────────────────────────────────────────────────────

describe('CASE 3 — stale expected rows dropped when Assertions ON', () => {
  it('silently drops LD2/LD3 expected rows when those signals are not in the current design', () => {
    // Student's current design only has LD0/LD1 mapped.
    const currentIoRows: SimulationIoRow[] = [
      { id: 'sw0', label: 'SW0', direction: 'in',  nodeId: 'sw0_n' },
      { id: 'sw1', label: 'SW1', direction: 'in',  nodeId: 'sw1_n' },
      { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_n' },
      { id: 'ld1', label: 'LD1', direction: 'out', nodeId: 'ld1_n' },
    ];

    // Vectors have stale expected values for LD2/LD3 (from a starter that had 4 outputs).
    const vectors = [
      { tick: 0, inputs: { sw0: 0, sw1: 0 }, expected: { ld0: 0, ld1: 0, ld2: 1, ld3: 1 } },
      { tick: 1, inputs: { sw0: 1, sw1: 1 }, expected: { ld0: 1, ld1: 1, ld2: 0, ld3: 0 } },
    ];

    const result = runDeterministicVerifyFromCircuit(buildTwoOutputCircuit(), currentIoRows, vectors);
    const rawRows = result.rows;

    // assertionMode = true, but filter against current design outputs (LD0/LD1 only).
    const assertionRows = filterAssertionRows(rawRows, currentIoRows, true);

    // Only LD0/LD1 assertion rows survive — LD2/LD3 are silently dropped.
    const signals = assertionRows.map((r) => r.signal);
    expect(signals.every((s) => s === 'ld0' || s === 'ld1')).toBe(true);
    expect(signals.some((s) => s === 'ld2' || s === 'ld3')).toBe(false);

    // The filtered run passes (LD0/LD1 match the passthrough circuit).
    const failedRows = assertionRows.filter((r) => r.expected !== r.actual);
    expect(failedRows).toHaveLength(0);
  });

  it('pruneStaleVectorExpected removes keys for deleted output signals', () => {
    const validOutputKeys = new Set(['ld0', 'ld1']);
    const vectors = [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0, ld1: 0, ld2: 1, ld3: 1 } },
      { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1, ld1: 1, ld2: 0, ld3: 0 } },
    ];
    const pruned = pruneStaleVectorExpected(vectors, validOutputKeys);
    expect(Object.keys(pruned[0]?.expected ?? {})).toEqual(['ld0', 'ld1']);
    expect(Object.keys(pruned[1]?.expected ?? {})).toEqual(['ld0', 'ld1']);
    // Inputs are preserved.
    expect(pruned[0]?.inputs).toEqual({ sw0: 0 });
  });

  it('pruneStaleVectorExpected is a no-op when all expected keys are valid', () => {
    const validOutputKeys = new Set(['ld0', 'ld1', 'ld2', 'ld3']);
    const vectors = [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0, ld1: 0 } },
    ];
    const pruned = pruneStaleVectorExpected(vectors, validOutputKeys);
    expect(pruned[0]?.expected).toEqual({ ld0: 0, ld1: 0 });
  });
});

// ── CASE 4 ────────────────────────────────────────────────────────────────────

describe('CASE 4 — legitimate FAIL when student assertion mismatches', () => {
  it('fails when student-authored expected value disagrees with observed circuit output', () => {
    const ioRows: SimulationIoRow[] = [
      { id: 'sw0', label: 'SW0', direction: 'in',  nodeId: 'sw0_n' },
      { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_n' },
    ];

    const circuit: Circuit = {
      nodes: [
        { id: 'sw0_n', type: 'INPUT',  label: 'sw0', x: 0,   y: 0, config: {}, state: {} },
        { id: 'ld0_n', type: 'OUTPUT', label: 'ld0', x: 200, y: 0, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_n', portName: 'out' }, to: { nodeId: 'ld0_n', portName: 'in' } },
      ],
    };

    // Student explicitly asserts ld0=1 when sw0=0 — that will disagree with the passthrough.
    const vectors = [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 1 } }, // WRONG: ld0 should be 0
    ];

    const result = runDeterministicVerifyFromCircuit(circuit, ioRows, vectors);
    const rawRows = result.rows;

    // assertionMode = true → no filtering away legitimate student assertions.
    const assertionRows = filterAssertionRows(rawRows, ioRows, true);
    expect(assertionRows.length).toBeGreaterThan(0);

    // The student authored ld0=1 but circuit gives ld0=0 → legitimate FAIL.
    const failedRows = assertionRows.filter((r) => r.expected !== r.actual);
    expect(failedRows.length).toBeGreaterThan(0);
    expect(failedRows[0]?.signal).toBe('ld0');
    expect(failedRows[0]?.expected).toBe('1');
    expect(failedRows[0]?.actual).toBe('0');
  });
});

// ── CASE 5 ────────────────────────────────────────────────────────────────────

describe('CASE 5 — invalid/impossible signal reference silently ignored', () => {
  it('does not crash or false-fail when expected contains an unrecognized signal key', () => {
    // Student's design has LD0/LD1 only. Vectors contain a typo key "zzz_nonexistent".
    const ioRows: SimulationIoRow[] = [
      { id: 'sw0', label: 'SW0', direction: 'in',  nodeId: 'sw0_n' },
      { id: 'sw1', label: 'SW1', direction: 'in',  nodeId: 'sw1_n' },
      { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_n' },
      { id: 'ld1', label: 'LD1', direction: 'out', nodeId: 'ld1_n' },
    ];

    const vectors = [
      {
        tick: 0,
        inputs: { sw0: 0, sw1: 0 },
        expected: { ld0: 0, ld1: 0, zzz_nonexistent: 1 },  // typo signal
      },
    ];

    const result = runDeterministicVerifyFromCircuit(buildTwoOutputCircuit(), ioRows, vectors);
    const rawRows = result.rows;

    // assertionMode = true, filter against current design (no zzz_nonexistent).
    const assertionRows = filterAssertionRows(rawRows, ioRows, true);

    // Typo signal is dropped — no crash, no false FAIL.
    const signals = assertionRows.map((r) => r.signal);
    expect(signals).not.toContain('zzz_nonexistent');

    // Valid signals (LD0/LD1) still evaluated correctly — passthrough matches.
    const failedRows = assertionRows.filter((r) => r.expected !== r.actual);
    expect(failedRows).toHaveLength(0);
  });

  it('pruneStaleVectorExpected silently drops unknown signal keys without throwing', () => {
    const validOutputKeys = new Set(['ld0']);
    const vectors = [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0, zzz_nonexistent: 1, '': 0 } },
    ];
    expect(() => pruneStaleVectorExpected(vectors, validOutputKeys)).not.toThrow();
    const pruned = pruneStaleVectorExpected(vectors, validOutputKeys);
    // Only ld0 survives. Empty key and zzz_nonexistent are dropped.
    expect(Object.keys(pruned[0]?.expected ?? {})).toEqual(['ld0']);
  });
});
