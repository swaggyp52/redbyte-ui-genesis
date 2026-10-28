import type { TestVector } from '@redbyte/rb-utils';
import { resolveActiveScheduleContract } from './clockAuthority';
import type { RBProject } from '../../export/projectFormat';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import {
  buildIdeExportProject,
  deriveIdeLiveScheduleContract,
  type IdeBlockingDesignIssue,
  type IdeExportState,
} from './ideExportProject';
import { deriveIoSignalRoles } from './ioSignalRoles';
import { elaborateProjectHierarchy } from './projectHierarchy';
import type { ProjectRuntimeState, RunVerificationInput } from './projectRuntime';
import {
  detectVerifyClockPolicy,
  isAutomaticClockPolicyAvailable,
  resolveEffectiveVerifyClockPolicy,
  type VerifyClockPolicy,
} from './verifyClockPolicy';
import { buildCurrentVerifyReplayHash } from './verifyReplayHash';
import { computeExecutionStimulusHash, computeScenarioContentHash, getActiveScenario } from './verifyScenario';

/**
 * The Run request a student's "Run" makes for the active scenario, built from runtime state
 * alone. It follows the derivation the workbench performs (IdeApp's live schedule contract
 * from the export project, Simulate's clock-signal roles, saved-or-detected clock policy,
 * replay hash, and the Run owner's injected `scheduleContract`) so that one experiment
 * produces one recording identity whichever surface asked for it. Like the workbench, it
 * turns checks off while a Design issue blocks checked runs; the Run still records.
 * The Run owner (projectRuntime.startVerification) resolves, normalizes and executes.
 *
 * Parity with Simulate is asserted in the browser (`ide-meridian-counter-slice`) and on eleven
 * fixtures in `exportDerivation.parity.test.tsx`: both Runs of the same project must carry the
 * same schedule contract and record the same RunIdentity and output digest.
 */
export type StudioRunState = IdeExportState & Pick<ProjectRuntimeState, 'customVectors' | 'verifyLastRun'>;

/**
 * The workbench's blocking-design check (`deriveIdeBlockingDesignIssue` from
 * `@redbyte/rb-apps/runtime`). Required, so no caller can skip it; asked only when the scenario
 * holds checks. It lives outside this pure module because it needs the export view model.
 */
export type StudioBlockingResolver = (
  state: StudioRunState,
  project: RBProject,
  liveSchedule: VerifyScheduleContract,
) => IdeBlockingDesignIssue | null;

export interface StudioRunPlan {
  readonly input: RunVerificationInput;
  readonly clockPolicy: VerifyClockPolicy | null;
  readonly checkCount: number;
  readonly vectorCount: number;
  /** A Design issue that forbids checked runs; the Run records without checks. */
  readonly blockingIssue: IdeBlockingDesignIssue | null;
  /** Checks the authored scenario holds, including any turned off by a blocking issue. */
  readonly authoredCheckCount: number;
}

function hasAssertedValue(value: unknown): boolean {
  return value === 0 || value === 1 || value === '0' || value === '1' || value === true || value === false;
}

export function planStudioRun(
  state: StudioRunState,
  options: { captureEvaluations: boolean; resolveBlockingIssue: StudioBlockingResolver },
): StudioRunPlan {
  const activeScenario = getActiveScenario(state.scenarios, state.activeScenarioId);
  const simulationCircuit = elaborateProjectHierarchy(state.circuit, state.hierarchy);
  const authored: TestVector[] = activeScenario?.vectors ?? [];
  const custom: TestVector[] = (state.customVectors ?? []).map((vector) => ({
    id: vector.id,
    tick: vector.tick,
    inputs: { ...(vector.inputs ?? {}) },
    expected: { ...(vector.expected ?? {}) },
  }));
  const vectors = [...authored, ...custom].map((vector) => ({
    id: vector.id,
    tick: vector.tick,
    inputs: { ...(vector.inputs ?? {}) },
    expected: { ...(vector.expected ?? {}) },
  }));
  const deterministicHash = buildCurrentVerifyReplayHash({
    circuit: simulationCircuit,
    projectVectors: authored,
    customVectors: custom,
    projectIoRows: state.projectIoRows,
  });

  // IdeApp: liveScheduleContract (export project: top circuit + generated HDL); Simulate
  // resolves its active contract from it, and the Run owner is handed the same contract.
  const exportProject = buildIdeExportProject(state);
  const liveSchedule = deriveIdeLiveScheduleContract(exportProject);
  const schedule = resolveActiveScheduleContract({ deterministicHash, liveScheduleContract: liveSchedule, lastRun: state.verifyLastRun ?? undefined }) ?? liveSchedule;
  const roles = deriveIoSignalRoles(state.projectIoRows, liveSchedule);
  const detected = detectVerifyClockPolicy({
    circuit: { nodes: [...simulationCircuit.nodes] },
    ioRows: state.projectIoRows.map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      direction: row.direction,
      pin: row.pin,
      nodeId: row.nodeId,
      timingRole: roles[row.id] === 'clock' ? ('clock' as const) : roles[row.id] === 'reset' ? ('reset' as const) : undefined,
    })),
    scheduleContract: schedule,
  });
  const saved = activeScenario?.sequentialPolicy;
  const savedAutoAvailable = Boolean(
    saved?.overrideMode === 'auto' &&
      saved.executionModel === 'external-input-auto-toggle' &&
      saved.sourceType !== 'manual' &&
      saved.sourceType !== 'explicit-clock-component',
  );
  const autoAvailable = detected ? isAutomaticClockPolicyAvailable(detected) : savedAutoAvailable;
  const requestedMode = saved?.overrideMode ?? detected?.overrideMode ?? 'manual-pulses';
  const overrideMode = requestedMode === 'auto' && !autoAvailable ? 'manual-pulses' : requestedMode;
  const runCycles = Math.max(1, saved?.runCycles ?? detected?.runCycles ?? 1);

  let clockPolicy: VerifyClockPolicy | null = null;
  if (schedule.schedule === 'clocked_macro') {
    const resolved = resolveEffectiveVerifyClockPolicy({
      savedPolicy: saved,
      detectedPolicy: detected,
      overrideMode,
      requestedRunCycles: runCycles,
      totalVectorCount: vectors.length,
    });
    clockPolicy = !resolved
      ? null
      : overrideMode === 'auto'
        ? resolved
        : {
            ...resolved,
            manualWarning:
              resolved.manualWarning ??
              'Manual clock source — use this only if your hardware design really clocks from a switch or button.',
          };
  }

  const rows = vectors.flatMap((vector) =>
    Object.entries(vector.expected)
      .filter(([, value]) => hasAssertedValue(value))
      .map(([signal, expected]) => ({ tick: vector.tick, signal, expected: String(Number(expected)), actual: '0' })),
  );
  // IdeApp.handleRunVerification refuses a checked run while Design is blocked and Simulate
  // then offers only an unchecked run; the studio records the same unchecked run.
  const blockingIssue = rows.length > 0 ? options.resolveBlockingIssue(state, exportProject, liveSchedule) : null;
  const useChecks = rows.length > 0 && !blockingIssue;
  const input: RunVerificationInput = {
    captureEvaluations: options.captureEvaluations,
    scenarioId: activeScenario?.id ?? `studio-${deterministicHash.slice(0, 8)}`,
    scenarioName: activeScenario?.name ?? (useChecks ? 'Project Vectors' : 'Stimulus Trace'),
    runKind: useChecks ? 'verify' : 'trace',
    scenarioVersion: activeScenario?.version,
    scenarioContentHash: activeScenario ? computeScenarioContentHash(activeScenario) : undefined,
    scenarioStimulusHash: computeExecutionStimulusHash(vectors, clockPolicy),
    deterministicHash,
    assertionMode: useChecks,
    vectors,
    clockPolicy,
    rows: useChecks ? rows : [],
    scheduleContract: liveSchedule,
  };
  return {
    input,
    clockPolicy,
    checkCount: useChecks ? rows.length : 0,
    vectorCount: vectors.length,
    blockingIssue,
    authoredCheckCount: rows.length,
  };
}
