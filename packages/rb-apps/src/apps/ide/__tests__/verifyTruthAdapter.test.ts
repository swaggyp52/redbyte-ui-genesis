import { describe, expect, it } from 'vitest';
import type { TestVector } from '@redbyte/rb-utils';
import { buildVerifyReport } from '../verifyReport';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { deriveProjectVerifyState, type ProjectHealthCore } from '../projectHealth';
import type { VerifyScheduleContract } from '../../../fpga/boards/basys3/verifySchedule';
import {
  computeScenarioContentHash,
  computeScenarioStimulusHash,
  type VerifyScenario,
} from '../verifyScenario';
import {
  buildVerifyTruthStateFromRuntime,
  deriveVerifyCheckProvenanceFromProject,
} from '../verifyTruthAdapter';

const BASE_VECTOR: TestVector = {
  tick: 0,
  inputs: { a: 1, b: 0 },
  expected: { sum: 1 },
};

const BASE_SCENARIO: VerifyScenario = {
  id: 'default',
  name: 'Default',
  vectors: [BASE_VECTOR],
  version: 1,
  createdAt: '2026-06-21T12:00:00.000Z',
  updatedAt: '2026-06-21T12:00:00.000Z',
};

function makeRun(input: {
  runKind: 'trace' | 'verify';
  status: 'pass' | 'fail';
  rows?: Array<{
    tick: number;
    signal: string;
    expected: string;
    actual: string;
    caseIndex?: number;
  }>;
  scenario?: VerifyScenario;
}): RuntimeVerifyRun {
  const scenario = input.scenario ?? BASE_SCENARIO;
  const report = buildVerifyReport({
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    status: input.status,
    deterministicHash: `det-${input.runKind}-${input.status}`,
    rows: input.rows ?? [],
    vectors: scenario.vectors.map((vector, index) => ({
      id: `vec-${String(index + 1).padStart(2, '0')}`,
      tick: vector.tick,
      inputs: normalizeBitRecord(vector.inputs),
      expected: normalizeBitRecord(vector.expected),
      caseIndex: index,
    })),
    generatedAtIso: '2026-06-21T12:05:00.000Z',
  });

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    runKind: input.runKind,
    scenarioVersion: scenario.version,
    scenarioContentHash: computeScenarioContentHash(scenario),
    scenarioStimulusHash: computeScenarioStimulusHash(scenario),
    status: input.status,
    deterministicHash: report.deterministicHash,
    reportHash: report.reportHash,
    firstFailingTick: report.firstFailingTick,
    generatedAtIso: report.generatedAtIso,
    schedule: 'combinational',
    meta: {
      circuitKind: 'combinational',
      clockingProtocol: null,
      samplePoint: 'steady-state',
      tick0Meaning: null,
      clockSignalName: null,
    },
    report,
    waveform: [],
  };
}

function normalizeBitRecord(record: Record<string, boolean | number>): Record<string, 0 | 1> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value === true || Number(value) === 1 ? 1 : 0])
  );
}

function expectNoInvariantProblems(run: ReturnType<typeof buildVerifyTruthStateFromRuntime>) {
  expect(run.selectors.invariantProblems).toEqual([]);
  return run;
}

describe('verifyTruthAdapter', () => {
  it('derives locked course checks for starter/example work and editable checks for student work', () => {
    expect(deriveVerifyCheckProvenanceFromProject({ projectKind: 'example' })).toBe('course');
    expect(deriveVerifyCheckProvenanceFromProject({ projectKind: 'blank' })).toBe('student');
    expect(deriveVerifyCheckProvenanceFromProject({ projectKind: 'custom', sourceExampleId: 'logic-gates' })).toBe(
      'student'
    );

    const starter = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: [BASE_VECTOR],
        checkProvenance: 'course',
        activeScenario: BASE_SCENARIO,
      })
    );
    const student = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: [BASE_VECTOR],
        checkProvenance: 'student',
        activeScenario: BASE_SCENARIO,
      })
    );

    expect(starter.state.checks[0]).toMatchObject({
      provenance: 'course',
      editability: 'locked',
    });
    expect(starter.state.checks[0].lockedReason).toContain('duplicate');
    expect(starter.selectors.selectedCheckSet).toBe('Course checks (1 check)');
    expect(starter.selectors.canEditExpected).toBe(false);
    expect(starter.selectors.lockedReason).toContain('duplicate');
    expect(student.state.checks[0]).toMatchObject({
      provenance: 'student',
      editability: 'editable',
    });
    expect(student.selectors.selectedCheckSet).toBe('My checks (1 check)');
    expect(student.selectors.canEditExpected).toBe(true);
    expect(student.selectors.lockedReason).toBeNull();
  });

  it('keeps observe-only runtime evidence out of trusted Project and Export states', () => {
    const run = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: [],
        lastRun: makeRun({ runKind: 'trace', status: 'pass' }),
        activeScenario: { ...BASE_SCENARIO, vectors: [] },
        dirtySinceVerify: false,
      })
    );

    expect(run.state.status).toBe('needsTestbench');
    expect(run.state.lastRun?.status).toBe('observe');
    expect(run.selectors.projectVerifyState).toBe('trace');
    expect(run.selectors.resultStatus).toBe('observe');
    expect(run.selectors.resultIsCurrent).toBe(true);
    expect(run.selectors.canExportTrusted).toBe(false);
    expect(run.selectors.exportReadiness).toBe('blocked-no-checks');
  });

  it('maps current compare PASS to Project ready and trusted export readiness', () => {
    const run = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: [BASE_VECTOR],
        checkProvenance: 'student',
        lastRun: makeRun({
          runKind: 'verify',
          status: 'pass',
          rows: [{ tick: 0, signal: 'sum', expected: '1', actual: '1', caseIndex: 0 }],
        }),
        activeScenario: BASE_SCENARIO,
        dirtySinceVerify: false,
      })
    );

    expect(run.state.status).toBe('passed');
    expect(run.selectors.projectVerifyState).toBe('assertions-match');
    expect(run.selectors.projectVerifyStatus).toBe('assertions-match');
    expect(run.selectors.resultStatus).toBe('pass');
    expect(run.selectors.canExportTrusted).toBe(true);
    expect(run.selectors.exportReadiness).toBe('trusted-ready');
  });

  it('maps compare FAIL to a selected failure and provenance-aware repair actions', () => {
    const run = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: [BASE_VECTOR],
        checkProvenance: 'course',
        lastRun: makeRun({
          runKind: 'verify',
          status: 'fail',
          rows: [{ tick: 0, signal: 'sum', expected: '1', actual: '0', caseIndex: 0 }],
        }),
        activeScenario: BASE_SCENARIO,
        dirtySinceVerify: false,
      })
    );

    expect(run.state.status).toBe('failed');
    expect(run.selectors.projectVerifyState).toBe('assertions-differ');
    expect(run.selectors.selectedFailure).toMatchObject({
      signal: 'sum',
      expected: '1',
      observed: '0',
    });
    expect(run.selectors.selectedFailureRepair).toMatchObject({
      canFixCircuit: true,
      canEditExpected: false,
      checkProvenance: 'course',
    });
    expect(run.selectors.selectedFailureRepairLabel).toBe('Fix circuit in Design');
    expect(run.selectors.selectedFailureRepairHint).toContain('duplicate');
    expect(run.selectors.repairActions).toMatchObject(run.selectors.selectedFailureRepair);
  });

  it('exposes My check failures as expected-output editable repair authority', () => {
    const run = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: [BASE_VECTOR],
        checkProvenance: 'student',
        lastRun: makeRun({
          runKind: 'verify',
          status: 'fail',
          rows: [{ tick: 0, signal: 'sum', expected: '1', actual: '0', caseIndex: 0 }],
        }),
        activeScenario: BASE_SCENARIO,
        dirtySinceVerify: false,
      })
    );

    expect(run.selectors.selectedFailureRepair).toMatchObject({
      canFixCircuit: true,
      canEditExpected: true,
      checkProvenance: 'student',
      lockedReason: null,
    });
    expect(run.selectors.selectedFailureRepairLabel).toBe('Fix circuit or update My expected output');
    expect(run.selectors.selectedFailureRepairHint).toContain('My checks');
  });

  it('keeps aliased report failures attached to the authored expected-output check', () => {
    const halfAdderVector: TestVector = {
      tick: 0,
      inputs: { sw0: 1, sw1: 1 },
      expected: { ld0_node: 1 },
    };
    const halfAdderScenario: VerifyScenario = {
      ...BASE_SCENARIO,
      vectors: [halfAdderVector],
    };

    const run = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: [halfAdderVector],
        checkProvenance: 'student',
        lastRun: makeRun({
          runKind: 'verify',
          status: 'fail',
          rows: [{ tick: 0, signal: 'ld0carry', expected: '1', actual: '0', caseIndex: 0 }],
          scenario: halfAdderScenario,
        }),
        activeScenario: halfAdderScenario,
        dirtySinceVerify: false,
      })
    );

    expect(run.state.status).toBe('failed');
    expect(run.selectors.resultStatus).toBe('fail');
    expect(run.selectors.projectVerifyState).toBe('assertions-differ');
    expect(run.selectors.selectedFailure).toMatchObject({
      signal: 'ld0carry',
      expected: '1',
      observed: '0',
    });
    expect(run.selectors.selectedFailureRepair).toMatchObject({
      canFixCircuit: true,
      canEditExpected: true,
      checkProvenance: 'student',
    });
  });

  it('classifies stale design separately from stale expected-output edits', () => {
    const passRun = makeRun({
      runKind: 'verify',
      status: 'pass',
      rows: [{ tick: 0, signal: 'sum', expected: '1', actual: '1', caseIndex: 0 }],
    });
    const staleDesign = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: [BASE_VECTOR],
        lastRun: passRun,
        activeScenario: BASE_SCENARIO,
        dirtySinceVerify: true,
      })
    );
    const editedScenario: VerifyScenario = {
      ...BASE_SCENARIO,
      vectors: [{ ...BASE_VECTOR, expected: { sum: 0 } }],
      version: 2,
      updatedAt: '2026-06-21T12:10:00.000Z',
    };
    const staleTestbench = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: editedScenario.vectors,
        lastRun: passRun,
        activeScenario: editedScenario,
        latestVerifyLedgerEntry: { projectHash: 'old-project' },
        currentVerifyProjectHash: 'new-project',
      })
    );

    expect(staleDesign.state.status).toBe('staleDesign');
    expect(staleDesign.state.staleReason).toBe('design-changed');
    expect(staleDesign.selectors.resultStatus).toBe('stale');
    expect(staleDesign.selectors.resultIsCurrent).toBe(false);
    expect(staleDesign.selectors.staleReasonCode).toBe('design-changed');
    expect(staleDesign.selectors.staleReason).toContain('Design changed');
    expect(staleDesign.selectors.staleRecoveryAction).toContain('Design');
    expect(staleTestbench.state.status).toBe('staleTestbench');
    expect(staleTestbench.state.staleReason).toBe('check-set-changed');
    expect(staleTestbench.selectors.staleReasonCode).toBe('check-set-changed');
    expect(staleTestbench.selectors.staleReason).toContain('Saved checks changed');
    expect(staleTestbench.selectors.staleRecoveryAction).toContain('expected outputs');
  });

  it('derives V2 timing labels from the live schedule contract before a run exists', () => {
    const clockedContract = {
      schedule: 'clocked_macro',
      timingMode: 'synchronous_board_clock',
      reason: 'circuit-sequential',
      needsSimClockInjection: false,
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      hasUnsupportedTemporal: false,
      temporalIssues: [],
      analysis: {},
    } as unknown as VerifyScheduleContract;

    const run = expectNoInvariantProblems(
      buildVerifyTruthStateFromRuntime({
        hasDesign: true,
        vectors: [BASE_VECTOR],
        checkProvenance: 'student',
        activeScenario: BASE_SCENARIO,
        scheduleContract: clockedContract,
      })
    );

    expect(run.state.sequentialTimingMode).toBe('auto-board-clock');
    expect(run.selectors.timingMode).toBe('auto-board-clock');
    expect(run.selectors.timingModeLabel).toBe('Auto board clock');
    expect(run.selectors.timingModeHint).toContain('board clock');
  });

  it('matches legacy Project health verify states during shadow migration', () => {
    const passRun = makeRun({
      runKind: 'verify',
      status: 'pass',
      rows: [{ tick: 0, signal: 'sum', expected: '1', actual: '1', caseIndex: 0 }],
    });
    const failRun = makeRun({
      runKind: 'verify',
      status: 'fail',
      rows: [{ tick: 0, signal: 'sum', expected: '1', actual: '0', caseIndex: 0 }],
    });
    const errorRun = makeRun({ runKind: 'verify', status: 'fail', rows: [] });
    const cases: Array<{
      name: string;
      core: ProjectHealthCore;
      lastRun?: RuntimeVerifyRun;
      vectors: TestVector[];
    }> = [
      {
        name: 'not-run',
        core: { dirtySinceVerify: false, dirtySinceExport: false },
        vectors: [BASE_VECTOR],
      },
      {
        name: 'trace',
        core: {
          lastVerify: {
            status: 'pass',
            hash: 'trace-hash',
            runKind: 'trace',
            ranAtIso: '2026-06-21T12:05:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
        lastRun: makeRun({ runKind: 'trace', status: 'pass' }),
        vectors: [],
      },
      {
        name: 'pass',
        core: {
          lastVerify: {
            status: 'pass',
            hash: 'pass-hash',
            runKind: 'verify',
            report: passRun.report,
            ranAtIso: '2026-06-21T12:05:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
        lastRun: passRun,
        vectors: [BASE_VECTOR],
      },
      {
        name: 'fail',
        core: {
          lastVerify: {
            status: 'fail',
            hash: 'fail-hash',
            runKind: 'verify',
            report: failRun.report,
            ranAtIso: '2026-06-21T12:05:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
        lastRun: failRun,
        vectors: [BASE_VECTOR],
      },
      {
        name: 'error',
        core: {
          lastVerify: {
            status: 'fail',
            hash: 'error-hash',
            runKind: 'verify',
            report: errorRun.report,
            ranAtIso: '2026-06-21T12:05:00.000Z',
          },
          dirtySinceVerify: false,
          dirtySinceExport: false,
        },
        lastRun: errorRun,
        vectors: [BASE_VECTOR],
      },
      {
        name: 'stale',
        core: {
          lastVerify: {
            status: 'pass',
            hash: 'stale-hash',
            runKind: 'verify',
            report: passRun.report,
            ranAtIso: '2026-06-21T12:05:00.000Z',
          },
          dirtySinceVerify: true,
          dirtySinceExport: false,
        },
        lastRun: passRun,
        vectors: [BASE_VECTOR],
      },
    ];

    for (const item of cases) {
      const adapter = expectNoInvariantProblems(
        buildVerifyTruthStateFromRuntime({
          hasDesign: true,
          vectors: item.vectors,
          lastRun: item.lastRun,
          activeScenario: item.vectors.length > 0 ? BASE_SCENARIO : null,
          dirtySinceVerify: item.core.dirtySinceVerify,
        })
      );
      expect(adapter.selectors.projectVerifyState, item.name).toBe(
        deriveProjectVerifyState(item.core)
      );
    }
  });
});
