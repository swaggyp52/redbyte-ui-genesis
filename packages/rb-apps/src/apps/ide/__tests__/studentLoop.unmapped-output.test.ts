/**
 * Student Loop Truth Test — Trust-model gate (Commit 1)
 *
 * Scenario: SW0 → LD0 pass-through circuit.
 *   SW0 is mapped to pin V17.
 *   LD0 is intentionally left unmapped (no pin).
 *
 * Invariants that must hold:
 *  1. Logic is correct → runDeterministicVerifyFromCircuit returns pass.
 *  2. Incomplete pin mapping → detectIncompleteMappingQualification returns 'incomplete-mapping'.
 *  3. When all outputs are pinned → qualification is undefined (normal PASS).
 *  4. When verify fails → qualification is always undefined regardless of pin state.
 */
import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { runDeterministicVerifyFromCircuit } from '../sim/simEngine';
import type { SimulationIoRow } from '../sim/simTypes';
import { detectIncompleteMappingQualification } from '../projectRuntime';
import type { ProjectIoRow } from '../projectRuntime';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function buildPassthroughCircuit(): Circuit {
  return {
    nodes: [
      { id: 'sw0_node', type: 'INPUT', label: 'sw0', x: 0, y: 0, config: {}, state: {} },
      { id: 'ld0_node', type: 'OUTPUT', label: 'ld0', x: 160, y: 0, config: {}, state: {} },
    ],
    connections: [
      {
        from: { nodeId: 'sw0_node', portName: 'out' },
        to: { nodeId: 'ld0_node', portName: 'in' },
      },
    ],
  };
}

const simIoRows: SimulationIoRow[] = [
  { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
  { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_node' },
];

// LD0 has no pin — student-loop "incomplete mapping" scenario
const ioRowsUnmappedOutput: ProjectIoRow[] = [
  { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', direction: 'in', pin: 'V17', required: true },
  { id: 'ld0', nodeId: 'ld0_node', port: 'in',  label: 'ld0', direction: 'out', pin: '',    required: true },
];

// LD0 has a pin — normal "complete mapping" scenario
const ioRowsAllMapped: ProjectIoRow[] = [
  { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', direction: 'in', pin: 'V17', required: true },
  { id: 'ld0', nodeId: 'ld0_node', port: 'in',  label: 'ld0', direction: 'out', pin: 'U16', required: true },
];

const passThroughVectors = [
  { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
  { tick: 1, inputs: { sw0: 1 }, expected: { ld0: 1 } },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('studentLoop.unmapped-output — trust-model invariants', () => {
  it('logic is correct: SW→LD passthrough passes verification', () => {
    const result = runDeterministicVerifyFromCircuit(
      buildPassthroughCircuit(),
      simIoRows,
      passThroughVectors
    );

    expect(result.rows.every((row) => row.expected === row.actual)).toBe(true);
    expect(result.evidence.preflight).toEqual([]);
    expect(result.evidence.failures).toEqual([]);
  });

  it('detects incomplete mapping: output with no pin → qualification is incomplete-mapping', () => {
    const qualification = detectIncompleteMappingQualification(ioRowsUnmappedOutput, 'pass');

    expect(qualification).toBe('incomplete-mapping');
  });

  it('does not flag complete mapping: all outputs pinned → qualification is undefined', () => {
    const qualification = detectIncompleteMappingQualification(ioRowsAllMapped, 'pass');

    expect(qualification).toBeUndefined();
  });

  it('does not qualify a fail run: fail + unmapped output stays fail (no incomplete-mapping)', () => {
    const qualification = detectIncompleteMappingQualification(ioRowsUnmappedOutput, 'fail');

    expect(qualification).toBeUndefined();
  });

  it('does not flag incomplete mapping when only inputs are unmapped (outputs are the concern)', () => {
    const ioRowsUnmappedInput: ProjectIoRow[] = [
      { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'sw0', direction: 'in', pin: '', required: false },
      { id: 'ld0', nodeId: 'ld0_node', port: 'in',  label: 'ld0', direction: 'out', pin: 'U16', required: true },
    ];
    const qualification = detectIncompleteMappingQualification(ioRowsUnmappedInput, 'pass');

    expect(qualification).toBeUndefined();
  });
});
