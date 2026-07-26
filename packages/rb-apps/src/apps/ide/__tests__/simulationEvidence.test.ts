import { describe, expect, it } from 'vitest';
import type { RuntimeVerifyRun } from '../projectRuntime';
import {
  buildSimulationEvidenceSummary,
  deriveBehavioralEvidenceTier,
  deriveBehavioralEvidenceTierFromResult,
} from '../simulationEvidence';

function makeRun(overrides: Partial<RuntimeVerifyRun> = {}): RuntimeVerifyRun {
  return {
    scenarioId: 'scenario',
    scenarioName: 'Scenario',
    runKind: 'trace',
    status: 'pass',
    simulationStatus: 'complete',
    assertionStatus: 'not-configured',
    deterministicHash: 'circuit',
    reportHash: 'report',
    generatedAtIso: '2026-07-26T00:00:00.000Z',
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report: {
      vectors: [],
      inputsAtTick: {},
      inputsByVectorId: {},
      signalRoles: {},
      rows: [],
    } as RuntimeVerifyRun['report'],
    waveform: [],
    ...overrides,
  };
}

describe('simulation evidence semantics', () => {
  it('reports a no-check run as completed simulation rather than a pass/fail check', () => {
    const summary = buildSimulationEvidenceSummary(makeRun());

    expect(summary.simulationLabel).toBe('Simulation complete');
    expect(summary.assertionLabel).toBe('No checks configured');
    expect(summary.tier).toBe('simulated');
  });

  it('keeps simulation complete when optional checks fail', () => {
    const summary = buildSimulationEvidenceSummary(makeRun({
      runKind: 'verify',
      status: 'fail',
      assertionStatus: 'failing',
    }));

    expect(summary.simulationLabel).toBe('Simulation complete');
    expect(summary.assertionLabel).toBe('Checks failing');
    expect(summary.tier).toBe('simulated');
  });

  it('promotes only a current passing checked run to validated', () => {
    const run = makeRun({
      runKind: 'verify',
      assertionStatus: 'passing',
    });

    expect(deriveBehavioralEvidenceTier(run)).toBe('validated');
    expect(deriveBehavioralEvidenceTier(run, true)).toBe('draft');
  });

  it('normalizes legacy trace runs without inventing check evidence', () => {
    const legacy = makeRun({
      simulationStatus: undefined,
      assertionStatus: undefined,
    });

    expect(buildSimulationEvidenceSummary(legacy)).toMatchObject({
      simulationStatus: 'complete',
      assertionStatus: 'not-configured',
      tier: 'simulated',
    });
  });

  it('derives the same three tiers from compact Project health evidence', () => {
    expect(deriveBehavioralEvidenceTierFromResult(undefined)).toBe('draft');
    expect(deriveBehavioralEvidenceTierFromResult({ runKind: 'trace', status: 'pass' })).toBe('simulated');
    expect(deriveBehavioralEvidenceTierFromResult({ runKind: 'verify', status: 'fail' })).toBe('simulated');
    expect(deriveBehavioralEvidenceTierFromResult({ runKind: 'verify', status: 'pass' })).toBe('validated');
    expect(deriveBehavioralEvidenceTierFromResult({ runKind: 'verify', status: 'pass' }, true)).toBe('draft');
  });
});
