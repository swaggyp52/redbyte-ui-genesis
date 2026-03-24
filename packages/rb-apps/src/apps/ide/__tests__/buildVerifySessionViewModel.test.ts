import { describe, expect, it } from 'vitest';
import { buildVerifySessionViewModel } from '../viewmodels/buildVerifySessionViewModel';

describe('buildVerifySessionViewModel', () => {
  it('treats trace-only runs without expected outputs as assertions incomplete', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 2,
      totalExpectedCaseCount: 0,
      runState: 'complete',
      lastRun: {
        scenarioId: 'trace-run',
        scenarioName: 'Trace Run',
        status: 'pass',
        deterministicHash: 'hash',
        reportHash: 'report-hash',
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
          rows: [],
          vectors: [],
          inputsAtTick: {},
          inputsByVectorId: {},
          signalRoles: {},
        },
        waveform: [{ tick: 0, signals: { sw0: '1', ld0: '1' }, mismatches: [] }],
      },
      assertionMode: false,
      isRunStale: false,
      isTraceOnly: true,
      hasResults: false,
      canSetOracle: true,
      failingRowCount: 0,
    });

    expect(model.mode).toBe('capture');
    expect(model.status).toBe('assertions-incomplete');
    expect(model.statusBadge).toBe('EXPECTED OUTPUTS INCOMPLETE');
    expect(model.recommendedNextAction).toBe('capture');
  });

  it('treats asserted mismatches as assertions differ', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 2,
      totalExpectedCaseCount: 2,
      runState: 'complete',
      lastRun: {
        scenarioId: 'fail-run',
        scenarioName: 'Fail Run',
        status: 'fail',
        deterministicHash: 'hash',
        reportHash: 'report-hash',
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
          rows: [{ tick: 0, signal: 'ld0', expected: '1', actual: '0', status: 'fail' }],
          vectors: [],
          inputsAtTick: {},
          inputsByVectorId: {},
          signalRoles: {},
        },
        waveform: [{ tick: 0, signals: { ld0: '0' }, mismatches: [{ signal: 'ld0', expected: '1', actual: '0' }] }],
      },
      assertionMode: true,
      isRunStale: false,
      isTraceOnly: false,
      hasResults: true,
      canSetOracle: true,
      failingRowCount: 1,
    });

    expect(model.mode).toBe('assertion');
    expect(model.status).toBe('assertions-differ');
    expect(model.runLabel).toBe('Re-run Verification');
    expect(model.recommendedNextAction).toBe('verify');
  });
});
