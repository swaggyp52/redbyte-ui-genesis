import { describe, expect, it } from 'vitest';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { buildVerifyStudentViewModel } from '../viewmodels/buildVerifyStudentViewModel';

function makeFailRun(): RuntimeVerifyRun {
  return {
    scenarioId: 'scenario-1',
    scenarioName: 'Scenario 1',
    status: 'fail',
    deterministicHash: 'hash-1',
    reportHash: 'report-1',
    firstFailingTick: 3,
    generatedAtIso: '2026-03-23T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'scenario-1',
      scenarioName: 'Scenario 1',
      status: 'fail',
      deterministicHash: 'hash-1',
      firstFailingTick: 3,
      rows: [
        {
          tick: 3,
          signal: 'ld0',
          expected: '1',
          actual: '0',
          status: 'fail',
          vectorId: 'vec-02',
          caseIndex: 1,
        },
      ],
      vectors: [],
      inputsAtTick: {},
      inputsByVectorId: {},
      signalRoles: { sw0: 'input', ld0: 'output' },
      generatedAtIso: '2026-03-23T00:00:00.000Z',
      reportHash: 'report-1',
    },
    waveform: [],
    evidence: {
      circuitHash: 'circuit-1',
      ioRows: [],
      vectors: [],
      normalizationMap: [],
      preflight: [],
      failures: [
        {
          tick: 3,
          signal: 'ld0',
          expected: '1',
          actual: '0',
          vectorId: 'vec-02',
          caseIndex: 1,
          expectedSourceKey: 'ld0',
          expectedMatchedSignal: 'ld0',
          actualSourceKey: 'ld0_node.in',
          actualReason: 'matched',
        },
      ],
    },
  };
}

describe('buildVerifyStudentViewModel', () => {
  it('keeps student-facing labels separate from technical mismatch keys', () => {
    const model = buildVerifyStudentViewModel({
      lastRun: makeFailRun(),
      mappedSignals: [
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
    });

    expect(model.failureRows).toHaveLength(1);
    expect(model.failureRows[0]?.signalLabel).toBe('LD0');
    expect(model.failureRows[0]?.rawSignal).toBe('ld0');
    expect(model.failureRows[0]?.technical?.sampledSignalKey).toBe('ld0_node.in');
  });

  it('tracks the selected failure without exposing internal debug fields in the student label', () => {
    const model = buildVerifyStudentViewModel({
      lastRun: makeFailRun(),
      mappedSignals: [
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
      selectedFailureKey: '3:ld0:ld0:vec-02:1',
    });

    expect(model.selectedFailure?.signalLabel).toBe('LD0');
    expect(model.selectedFailure?.signalLabel.includes('node')).toBe(false);
    expect(model.selectedFailure?.signalLabel.includes('sampled')).toBe(false);
  });
});
