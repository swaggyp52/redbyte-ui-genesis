import {
  getRuntimeVerifyRunKind,
  type RuntimeVerifyRun,
} from './projectRuntime';

export type SimulationRunStatus = 'complete' | 'blocked';
export type AssertionRunStatus = 'not-configured' | 'passing' | 'failing' | 'not-evaluated';
export type BehavioralEvidenceTier = 'draft' | 'simulated' | 'validated';

export interface SimulationEvidenceSummary {
  simulationStatus: SimulationRunStatus;
  assertionStatus: AssertionRunStatus;
  tier: BehavioralEvidenceTier;
  simulationLabel: 'Simulation complete' | 'Simulation blocked';
  assertionLabel: 'No checks configured' | 'Checks passing' | 'Checks failing' | 'Checks not evaluated';
}

type EvidenceRun = Pick<
  RuntimeVerifyRun,
  'runKind' | 'status' | 'report' | 'waveform' | 'evidence' | 'simulationStatus' | 'assertionStatus'
>;

export function getSimulationRunStatus(run: EvidenceRun): SimulationRunStatus {
  if (run.simulationStatus === 'complete' || run.simulationStatus === 'blocked') {
    return run.simulationStatus;
  }
  return run.report && run.waveform ? 'complete' : 'blocked';
}

export function getAssertionRunStatus(run: EvidenceRun): AssertionRunStatus {
  if (
    run.assertionStatus === 'not-configured' ||
    run.assertionStatus === 'passing' ||
    run.assertionStatus === 'failing' ||
    run.assertionStatus === 'not-evaluated'
  ) {
    return run.assertionStatus;
  }
  if (getRuntimeVerifyRunKind(run) === 'trace') return 'not-configured';
  if (
    (run.evidence?.preflight?.some((issue) => issue.blocking !== false) ?? false) &&
    run.report.rows.length === 0
  ) {
    return 'not-evaluated';
  }
  return run.status === 'pass' ? 'passing' : 'failing';
}

export function deriveBehavioralEvidenceTier(
  run: EvidenceRun | undefined | null,
  stale = false
): BehavioralEvidenceTier {
  if (!run || stale || getSimulationRunStatus(run) !== 'complete') return 'draft';
  if (run.evidence?.preflight?.some((issue) => issue.kind === 'floating-output')) return 'simulated';
  return getAssertionRunStatus(run) === 'passing' ? 'validated' : 'simulated';
}

export function deriveBehavioralEvidenceTierFromResult(
  result: { runKind?: 'trace' | 'verify'; status: 'pass' | 'fail' } | undefined | null,
  stale = false
): BehavioralEvidenceTier {
  if (!result || stale) return 'draft';
  return result.runKind === 'verify' && result.status === 'pass' ? 'validated' : 'simulated';
}

export function formatBehavioralEvidenceTier(tier: BehavioralEvidenceTier): 'Draft' | 'Simulated' | 'Validated' {
  return tier === 'validated' ? 'Validated' : tier === 'simulated' ? 'Simulated' : 'Draft';
}

export function buildSimulationEvidenceSummary(
  run: EvidenceRun,
  stale = false
): SimulationEvidenceSummary {
  const simulationStatus = getSimulationRunStatus(run);
  const assertionStatus = getAssertionRunStatus(run);
  return {
    simulationStatus,
    assertionStatus,
    tier: deriveBehavioralEvidenceTier(run, stale),
    simulationLabel: simulationStatus === 'complete' ? 'Simulation complete' : 'Simulation blocked',
    assertionLabel:
      assertionStatus === 'not-configured'
        ? 'No checks configured'
        : assertionStatus === 'passing'
          ? 'Checks passing'
          : assertionStatus === 'failing'
            ? 'Checks failing'
            : 'Checks not evaluated',
  };
}
