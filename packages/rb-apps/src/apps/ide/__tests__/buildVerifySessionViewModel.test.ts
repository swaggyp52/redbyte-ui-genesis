import { describe, expect, it } from 'vitest';
import { buildVerifySessionViewModel } from '../viewmodels/buildVerifySessionViewModel';
import type { VerifyPreRunInventory } from '../viewmodels/buildVerifySessionViewModel';

function makeSignalInventory(
  tickCount: number,
  totalAssertionCount: number
): VerifyPreRunInventory {
  return {
    lanes: [
      { name: 'sw0', direction: 'input', isAsserted: false },
      { name: 'ld0', direction: 'output', isAsserted: totalAssertionCount > 0 },
    ],
    tickCount,
    assertedOutputCount: totalAssertionCount > 0 ? 1 : 0,
    totalAssertionCount,
    clockPolicy: 'combinational',
  };
}

describe('buildVerifySessionViewModel', () => {
  it('treats pre-run sessions as draft testbench work', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 1,
      totalExpectedCaseCount: 1,
      signalInventory: makeSignalInventory(1, 1),
      runState: 'idle',
      nextRunUsesAssertions: false,
      isRunStale: false,
      isTraceOnly: false,
      hasResults: false,
      canSetOracle: false,
      failingRowCount: 0,
    });

    expect(model.mode).toBe('simulation');
    expect(model.status).toBe('draft');
    expect(model.statusBadge).toBe('DRAFT');
    expect(model.title).toBe('Ready to run stimulus');
    expect(model.summary).toContain('Add output assertions only when you want explicit verification');
    expect(model.runLabel).toBe('Run stimulus');
  });

  it('treats first-run sessions with expected outputs armed as draft assertion work', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 1,
      totalExpectedCaseCount: 1,
      signalInventory: makeSignalInventory(1, 1),
      runState: 'idle',
      nextRunUsesAssertions: true,
      isRunStale: false,
      isTraceOnly: false,
      hasResults: false,
      canSetOracle: false,
      failingRowCount: 0,
    });

    expect(model.mode).toBe('assertion');
    expect(model.status).toBe('draft');
    expect(model.statusBadge).toBe('DRAFT');
    expect(model.title).toBe('Ready to run assertions');
    expect(model.runLabel).toBe('Run assertions');
    expect(model.recommendedNextAction).toBe('verify');
  });

  it('treats trace-only runs without expected outputs as stimulus-only capture work', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 2,
      totalExpectedCaseCount: 0,
      signalInventory: makeSignalInventory(2, 0),
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
      nextRunUsesAssertions: false,
      isRunStale: false,
      isTraceOnly: true,
      hasResults: false,
      canSetOracle: true,
      failingRowCount: 0,
    });

    expect(model.mode).toBe('capture');
    expect(model.status).toBe('stimulus-only');
    expect(model.statusBadge).toBe('STIMULUS ONLY');
    expect(model.title).toBe('Waveform recorded — stimulus evidence');
    expect(model.recommendedNextAction).toBe('capture');
  });

  it('treats asserted mismatches as assertions differ', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 2,
      totalExpectedCaseCount: 2,
      signalInventory: makeSignalInventory(2, 2),
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
      nextRunUsesAssertions: true,
      isRunStale: false,
      isTraceOnly: false,
      hasResults: true,
      canSetOracle: true,
      failingRowCount: 1,
    });

    expect(model.mode).toBe('assertion');
    expect(model.status).toBe('assertions-differ');
    expect(model.runLabel).toBe('Run assertions again');
    expect(model.recommendedNextAction).toBe('verify');
  });

  it('keeps compare failure status even if the next run is set back to simulation mode', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 2,
      totalExpectedCaseCount: 2,
      signalInventory: makeSignalInventory(2, 2),
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
      nextRunUsesAssertions: false,
      isRunStale: false,
      isTraceOnly: false,
      hasResults: true,
      canSetOracle: true,
      failingRowCount: 1,
    });

    expect(model.mode).toBe('simulation');
    expect(model.status).toBe('assertions-differ');
    expect(model.statusBadge).toBe('ASSERTIONS DIFFER');
  });

  it('keeps persisted compare evidence authoritative even if live vectors are currently absent', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 0,
      totalExpectedCaseCount: 0,
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
      nextRunUsesAssertions: false,
      isRunStale: false,
      isTraceOnly: false,
      hasResults: true,
      canSetOracle: false,
      failingRowCount: 1,
    });

    expect(model.status).toBe('assertions-differ');
    expect(model.statusBadge).toBe('ASSERTIONS DIFFER');
  });

  it('shows stimulus-only when a run exists but no outputs are asserted', () => {
    // A run happened (simulation trace), stimulus is defined, but zero expected outputs
    // are authored. This should surface as observation-only trace evidence, not
    // assertions-incomplete or
    // simulation-complete. The badge must not imply "success" or "failure".
    const model = buildVerifySessionViewModel({
      totalVectorCount: 3,
      totalExpectedCaseCount: 0,
      signalInventory: makeSignalInventory(3, 0),
      runState: 'complete',
      lastRun: {
        scenarioId: 'trace-run-with-assertions',
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
      nextRunUsesAssertions: false,
      isRunStale: false,
      isTraceOnly: true,
      hasResults: false,
      canSetOracle: true,
      failingRowCount: 0,
    });

    expect(model.status).toBe('stimulus-only');
    expect(model.statusBadge).toBe('STIMULUS ONLY');
    expect(model.tone).toBe('idle');
    expect(model.recommendedNextAction).toBe('capture');
  });

  it('keeps trace-only session meaning even when the next run is armed for compare intent', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 3,
      totalExpectedCaseCount: 1,
      signalInventory: makeSignalInventory(3, 1),
      runState: 'complete',
      lastRun: {
        scenarioId: 'trace-run-with-assertions',
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
      nextRunUsesAssertions: true,
      isRunStale: false,
      isTraceOnly: true,
      hasResults: false,
      canSetOracle: true,
      failingRowCount: 0,
    });

    expect(model.mode).toBe('capture');
    expect(model.status).toBe('stimulus-only');
    expect(model.statusBadge).toBe('STIMULUS ONLY');
  });

  it('marks outdated compare evidence as stale', () => {
    const model = buildVerifySessionViewModel({
      totalVectorCount: 2,
      totalExpectedCaseCount: 2,
      signalInventory: makeSignalInventory(2, 2),
      runState: 'complete',
      lastRun: {
        scenarioId: 'stale-run',
        scenarioName: 'Stale Run',
        status: 'pass',
        deterministicHash: 'hash-old',
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
        waveform: [{ tick: 0, signals: { sw0: '0', ld0: '0' }, mismatches: [] }],
      },
      nextRunUsesAssertions: true,
      isRunStale: true,
      isTraceOnly: false,
      hasResults: true,
      canSetOracle: true,
      failingRowCount: 0,
    });

    expect(model.status).toBe('stale');
    expect(model.statusBadge).toBe('STALE');
    expect(model.runLabel).toBe('Re-run stimulus');
  });
});
