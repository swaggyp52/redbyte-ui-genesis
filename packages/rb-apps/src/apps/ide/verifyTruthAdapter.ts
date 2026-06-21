import type { TestVector } from '@redbyte/rb-utils';
import type { ProjectVerifyState } from './projectHealth';
import { getRuntimeVerifyRunKind, type RuntimeVerifyRun, type VerifyRunLedgerEntry } from './projectRuntime';
import type { ProjectKind, ScenarioAuthority } from './projectIdentity';
import {
  computeScenarioContentHash,
  computeScenarioStimulusHash,
  type VerifyScenario,
} from './verifyScenario';
import type { VerifyClockPolicy } from './verifyClockPolicy';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import {
  assertVerifyTruthInvariants,
  createVerifyTruthInitialState,
  deriveFailureRepairActions,
  verifyTruthReducer,
  type VerifyCheck,
  type VerifyCheckProvenance,
  type VerifyFailure,
  type VerifyRevisionSet,
  type VerifyRunMode,
  type VerifySequentialTimingMode,
  type VerifySignalValue,
  type VerifyTruthState,
} from './verifyTruthState';

export type VerifyTruthExportReadiness =
  | 'blocked-no-design'
  | 'blocked-no-checks'
  | 'draft-not-run'
  | 'draft-observe-only'
  | 'draft-stale'
  | 'draft-failed'
  | 'trusted-ready'
  | 'verify-error';

export type VerifyTruthActiveWorkspace = 'testbench' | 'results';
export type VerifyTruthCheckSetProvenance = VerifyCheckProvenance | 'mixed' | 'none';
export type VerifyTruthResultStatus =
  | 'not-run'
  | 'observe'
  | 'pass'
  | 'fail'
  | 'stale'
  | 'error';

export interface VerifyTruthRuntimeInput {
  hasDesign: boolean;
  vectors: readonly TestVector[];
  checkProvenance?: VerifyCheckProvenance;
  designRevision?: number;
  activeScenario?: VerifyScenario | null;
  lastRun?: RuntimeVerifyRun | null;
  latestVerifyLedgerEntry?: Pick<VerifyRunLedgerEntry, 'projectHash'> | null;
  currentVerifyProjectHash?: string | null;
  dirtySinceVerify?: boolean;
}

export interface VerifyTruthSelectors {
  activeWorkspace: VerifyTruthActiveWorkspace;
  canRun: boolean;
  selectedCheckSet: string;
  selectedCheckProvenance: VerifyTruthCheckSetProvenance;
  canEditExpected: boolean;
  lockedReason: string | null;
  resultStatus: VerifyTruthResultStatus;
  resultIsCurrent: boolean;
  staleReason: string | null;
  projectVerifyState: ProjectVerifyState;
  projectVerifyStatus: ProjectVerifyState;
  projectStatusText: string;
  exportReadiness: VerifyTruthExportReadiness;
  resultValidity: VerifyTruthState['resultValidity'];
  timingMode: VerifySequentialTimingMode;
  canRunObserve: boolean;
  canRunCompare: boolean;
  canExportTrusted: boolean;
  selectedFailure: VerifyFailure | null;
  repairActions: ReturnType<typeof deriveFailureRepairActions>;
  selectedFailureRepair: ReturnType<typeof deriveFailureRepairActions>;
  invariantProblems: string[];
}

export interface VerifyTruthRuntimeModel {
  state: VerifyTruthState;
  selectors: VerifyTruthSelectors;
}

const COURSE_LOCKED_REASON =
  'Course check: duplicate it into My checks before editing expected values.';

export function deriveVerifyCheckProvenanceFromProject(input: {
  projectKind?: ProjectKind | null;
  sourceExampleId?: string | null;
  activeExampleId?: string | null;
  scenarioAuthority?: ScenarioAuthority | null;
}): VerifyCheckProvenance {
  if (
    input.projectKind === 'example' ||
    Boolean(input.activeExampleId) ||
    input.scenarioAuthority === 'starter'
  ) {
    return 'course';
  }
  return 'student';
}

export function buildVerifyTruthChecksFromVectors(
  vectors: readonly TestVector[],
  input: {
    provenance?: VerifyCheckProvenance;
  } = {}
): VerifyCheck[] {
  const provenance = input.provenance ?? 'student';
  const checks: VerifyCheck[] = [];

  vectors.forEach((vector, index) => {
    const tick = normalizeTick(vector.tick, index);
    const caseId = readVectorCaseId(vector, index);
    for (const [signal, rawExpected] of Object.entries(vector.expected ?? {}).sort(compareEntries)) {
      const normalizedSignal = normalizeSignalToken(signal);
      const valueKey = buildCheckValueKey(caseId, tick, normalizedSignal);
      checks.push({
        id: buildCheckId(caseId, tick, normalizedSignal),
        label:
          provenance === 'course'
            ? `Course check: ${signal} at t${tick}`
            : `My check: ${signal} at t${tick}`,
        provenance,
        editability: provenance === 'course' ? 'locked' : 'editable',
        lockedReason: provenance === 'course' ? COURSE_LOCKED_REASON : undefined,
        expectedValues: {
          [valueKey]: normalizeSignalValue(rawExpected),
        },
      });
    }
  });

  return checks;
}

export function buildVerifyTruthStateFromRuntime(
  input: VerifyTruthRuntimeInput
): VerifyTruthRuntimeModel {
  const defaultCheckProvenance = input.checkProvenance ?? 'student';
  const checks = buildVerifyTruthChecksFromVectors(input.vectors, {
    provenance: defaultCheckProvenance,
  });
  const sequentialTimingMode = deriveSequentialTimingMode(input.lastRun);
  const revisions = deriveRuntimeRevisions(input, checks);
  let state = createVerifyTruthInitialState({
    hasDesign: input.hasDesign,
    checks,
    revisions,
    sequentialTimingMode,
  });

  if (input.lastRun) {
    const mode = deriveRunMode(input.lastRun);
    const runId = deriveRunId(input.lastRun);
    const requested = verifyTruthReducer(state, {
      type: 'RUN_REQUESTED',
      runId,
      mode,
      sequentialTimingMode,
    });
    state = requested.lastRejectedEvent?.event === 'RUN_REQUESTED' ? requested : requested;

    if (!requested.pendingRun) {
      return {
        state: requested,
        selectors: deriveVerifyTruthSelectors(requested, {
          defaultCheckProvenance,
        }),
      };
    }

    if (isVerifyErrorRun(input.lastRun, mode)) {
      state = verifyTruthReducer(requested, {
        type: 'RUN_FAILED',
        runId,
        message: 'Verify produced no comparison rows.',
      });
    } else {
      const completed = buildRunCompletedPayload(input.lastRun, checks, mode, runId);
      state = verifyTruthReducer(requested, completed);
    }
  }

  const staleEvent = deriveRuntimeStaleEvent(input, state);
  if (staleEvent) {
    state = verifyTruthReducer(state, staleEvent);
  }

  return {
    state,
    selectors: deriveVerifyTruthSelectors(state, {
      defaultCheckProvenance,
    }),
  };
}

export function deriveVerifyTruthSelectors(
  state: VerifyTruthState,
  context: {
    defaultCheckProvenance?: VerifyCheckProvenance;
  } = {}
): VerifyTruthSelectors {
  const projectVerifyState = deriveVerifyTruthProjectState(state);
  const selectedCheckProvenance = deriveSelectedCheckProvenance(
    state.checks,
    context.defaultCheckProvenance ?? 'student'
  );
  const selectedFailure =
    state.selectedFailureId && state.lastRun
      ? state.lastRun.failures.find((failure) => failure.id === state.selectedFailureId) ?? null
      : null;
  const selectedFailureRepair = deriveFailureRepairActions(state);
  const canRunObserve = state.hasDesign;
  const canRunCompare = state.hasDesign && state.checks.length > 0;
  const canExportTrusted = projectVerifyState === 'assertions-match';
  const canEditExpected = selectedCheckProvenance !== 'course';
  const lockedReason = canEditExpected
    ? null
    : state.checks.find((check) => check.editability === 'locked')?.lockedReason ??
      COURSE_LOCKED_REASON;
  return {
    activeWorkspace: state.lastRun ? 'results' : 'testbench',
    canRun: canRunObserve,
    selectedCheckSet: deriveSelectedCheckSetLabel(state.checks, selectedCheckProvenance),
    selectedCheckProvenance,
    canEditExpected,
    lockedReason,
    resultStatus: deriveResultStatus(state, projectVerifyState),
    resultIsCurrent: Boolean(state.lastRun) && state.resultValidity === 'current',
    staleReason: deriveStaleReasonText(state),
    projectVerifyState,
    projectVerifyStatus: projectVerifyState,
    projectStatusText: deriveProjectStatusText(state, projectVerifyState),
    exportReadiness: deriveExportReadiness(state, projectVerifyState),
    resultValidity: state.resultValidity,
    timingMode: state.sequentialTimingMode,
    canRunObserve,
    canRunCompare,
    canExportTrusted,
    selectedFailure,
    repairActions: selectedFailureRepair,
    selectedFailureRepair,
    invariantProblems: assertVerifyTruthInvariants(state),
  };
}

export function deriveVerifyTruthProjectState(state: VerifyTruthState): ProjectVerifyState {
  if (state.status === 'runtimeError') return 'verify-error';
  if (!state.lastRun) return 'not-run';
  if (state.status === 'staleDesign' || state.status === 'staleTestbench') return 'stale';
  if (state.lastRun.status === 'observe') return 'trace';
  if (state.status === 'passed') return 'assertions-match';
  if (state.status === 'failed') return 'assertions-differ';
  return 'not-run';
}

function buildRunCompletedPayload(
  run: RuntimeVerifyRun,
  checks: readonly VerifyCheck[],
  mode: VerifyRunMode,
  runId: string
): Parameters<typeof verifyTruthReducer>[1] {
  const observedValuesByCheck: Record<string, Record<string, VerifySignalValue>> = {};
  const failures: VerifyFailure[] = [];

  for (const row of run.report.rows) {
    const caseId = deriveReportCaseId(row.vectorId, row.caseIndex, row.tick);
    const signal = normalizeSignalToken(row.signal);
    const checkId = buildCheckId(caseId, row.tick, signal);
    if (!checks.some((check) => check.id === checkId)) continue;
    const valueKey = buildCheckValueKey(caseId, row.tick, signal);
    observedValuesByCheck[checkId] = {
      ...(observedValuesByCheck[checkId] ?? {}),
      [valueKey]: normalizeSignalValue(row.actual),
    };
    if (row.status === 'fail') {
      failures.push({
        id: `fail:${checkId}`,
        checkId,
        signal: row.signal,
        caseId,
        tick: row.tick,
        expected: normalizeSignalValue(row.expected),
        observed: normalizeSignalValue(row.actual),
      });
    }
  }

  return {
    type: 'RUN_COMPLETED',
    runId,
    mode,
    observedValuesByCheck,
    failures,
  };
}

function deriveRuntimeStaleEvent(
  input: VerifyTruthRuntimeInput,
  state: VerifyTruthState
): Parameters<typeof verifyTruthReducer>[1] | null {
  if (!input.lastRun || !state.lastRun) return null;
  const isHashStale =
    input.latestVerifyLedgerEntry &&
    input.currentVerifyProjectHash &&
    input.latestVerifyLedgerEntry.projectHash !== input.currentVerifyProjectHash;
  const isDirty = input.dirtySinceVerify === true;
  if (!isHashStale && !isDirty) return null;

  const scenario = input.activeScenario;
  if (scenario) {
    const sameScenario = input.lastRun.scenarioId === scenario.id;
    const contentChanged =
      Boolean(input.lastRun.scenarioContentHash) &&
      input.lastRun.scenarioContentHash !== computeScenarioContentHash(scenario);
    const stimulusChanged =
      Boolean(input.lastRun.scenarioStimulusHash) &&
      input.lastRun.scenarioStimulusHash !== computeScenarioStimulusHash(scenario);

    if (!sameScenario || stimulusChanged) {
      return {
        type: 'SCENARIO_CHANGED',
        scenarioRevision: scenario.version,
      };
    }
    if (contentChanged) {
      return {
        type: 'CHECK_SET_CHANGED',
        checkSetRevision: scenario.version,
        checks: state.checks,
      };
    }
  }

  return {
    type: 'DESIGN_CHANGED',
    designRevision: state.revisions.designRevision + 1,
  };
}

function deriveRuntimeRevisions(
  input: VerifyTruthRuntimeInput,
  checks: readonly VerifyCheck[]
): VerifyRevisionSet {
  const activeScenarioVersion = input.activeScenario?.version;
  const runScenarioVersion = input.lastRun?.scenarioVersion;
  const scenarioRevision =
    normalizeOptionalRevision(activeScenarioVersion) ?? normalizeOptionalRevision(runScenarioVersion) ?? 0;
  return {
    designRevision: normalizeOptionalRevision(input.designRevision) ?? 0,
    scenarioRevision,
    checkSetRevision: checks.length > 0 ? scenarioRevision : 0,
  };
}

function deriveRunMode(run: RuntimeVerifyRun): VerifyRunMode {
  return getRuntimeVerifyRunKind(run) === 'trace' ? 'observe' : 'compare';
}

function deriveSequentialTimingMode(
  run: RuntimeVerifyRun | null | undefined
): VerifySequentialTimingMode {
  if (!run) return 'combinational';
  if (run.clockPolicy) return deriveSequentialTimingModeFromClockPolicy(run.clockPolicy);
  return deriveSequentialTimingModeFromSchedule(run.scheduleContract, run.schedule);
}

function deriveSequentialTimingModeFromClockPolicy(
  policy: VerifyClockPolicy
): VerifySequentialTimingMode {
  if (policy.overrideMode === 'custom-pattern') return 'custom-pattern';
  if (policy.overrideMode === 'manual-pulses' || policy.executionModel === 'manual') {
    return 'manual-clock';
  }
  return 'auto-board-clock';
}

function deriveSequentialTimingModeFromSchedule(
  scheduleContract: VerifyScheduleContract | undefined,
  fallbackSchedule: RuntimeVerifyRun['schedule']
): VerifySequentialTimingMode {
  const schedule = scheduleContract?.schedule ?? fallbackSchedule;
  if (schedule !== 'clocked_macro') return 'combinational';
  return scheduleContract?.timingMode === 'manual_event_driven_lab'
    ? 'manual-clock'
    : 'auto-board-clock';
}

function isVerifyErrorRun(run: RuntimeVerifyRun, mode: VerifyRunMode): boolean {
  return mode === 'compare' && run.status === 'fail' && run.report.rows.length === 0;
}

function deriveRunId(run: RuntimeVerifyRun): string {
  return run.reportHash || run.deterministicHash || `${run.scenarioId}:${run.generatedAtIso}`;
}

function deriveProjectStatusText(
  state: VerifyTruthState,
  projectVerifyState: ProjectVerifyState
): string {
  if (!state.hasDesign) return 'Build a design before Verify.';
  if (state.checks.length === 0) return 'Add checks before trusting results.';
  if (projectVerifyState === 'not-run') return 'Ready to run checks.';
  if (projectVerifyState === 'trace') return 'Observed only. Add or run checks for a trusted result.';
  if (projectVerifyState === 'stale') return 'Checks need rerun for the current work.';
  if (projectVerifyState === 'assertions-match') return 'Checks passed for the current work.';
  if (projectVerifyState === 'assertions-differ') return 'Checks need review.';
  return 'Verify needs repair before it can be trusted.';
}

function deriveExportReadiness(
  state: VerifyTruthState,
  projectVerifyState: ProjectVerifyState
): VerifyTruthExportReadiness {
  if (!state.hasDesign) return 'blocked-no-design';
  if (state.checks.length === 0) return 'blocked-no-checks';
  if (projectVerifyState === 'not-run') return 'draft-not-run';
  if (projectVerifyState === 'trace') return 'draft-observe-only';
  if (projectVerifyState === 'stale') return 'draft-stale';
  if (projectVerifyState === 'assertions-differ') return 'draft-failed';
  if (projectVerifyState === 'verify-error') return 'verify-error';
  return 'trusted-ready';
}

function deriveSelectedCheckProvenance(
  checks: readonly VerifyCheck[],
  fallback: VerifyCheckProvenance
): VerifyTruthCheckSetProvenance {
  if (checks.length === 0) return fallback;
  const provenances = new Set(checks.map((check) => check.provenance));
  if (provenances.size === 1) return checks[0]?.provenance ?? fallback;
  return 'mixed';
}

function deriveSelectedCheckSetLabel(
  checks: readonly VerifyCheck[],
  provenance: VerifyTruthCheckSetProvenance
): string {
  const count = checks.length;
  const countLabel = count === 1 ? '1 check' : `${count} checks`;
  if (provenance === 'course') return `Course checks (${countLabel})`;
  if (provenance === 'student') return `My checks (${countLabel})`;
  if (provenance === 'mixed') return `Course + My checks (${countLabel})`;
  return 'No checks saved';
}

function deriveResultStatus(
  state: VerifyTruthState,
  projectVerifyState: ProjectVerifyState
): VerifyTruthResultStatus {
  if (projectVerifyState === 'verify-error' || state.status === 'runtimeError') return 'error';
  if (projectVerifyState === 'stale') return 'stale';
  if (!state.lastRun) return 'not-run';
  if (state.lastRun.status === 'observe') return 'observe';
  if (projectVerifyState === 'assertions-match') return 'pass';
  if (projectVerifyState === 'assertions-differ') return 'fail';
  return 'not-run';
}

function deriveStaleReasonText(state: VerifyTruthState): string | null {
  if (state.resultValidity !== 'stale') return null;
  if (state.staleReason === 'design-changed') {
    return 'Design changed after the last run.';
  }
  if (state.staleReason === 'check-set-changed') {
    return 'Saved checks changed after the last run.';
  }
  if (state.staleReason === 'scenario-changed') {
    return 'Selected testbench changed after the last run.';
  }
  return 'Re-run Verify for the current work.';
}

function readVectorCaseId(vector: TestVector, index: number): string {
  const candidate = (vector as TestVector & { id?: unknown }).id;
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate.trim()
    : `case-${index + 1}`;
}

function deriveReportCaseId(
  vectorId: string | undefined,
  caseIndex: number | undefined,
  tick: number
): string {
  if (typeof vectorId === 'string' && vectorId.trim().length > 0) return vectorId.trim();
  if (Number.isFinite(caseIndex)) return `case-${Math.max(0, Math.floor(Number(caseIndex))) + 1}`;
  return `tick-${Math.max(0, Math.floor(tick))}`;
}

function buildCheckId(caseId: string, tick: number, signal: string): string {
  return `check:${normalizeSignalToken(caseId)}:t${normalizeTick(tick, 0)}:${normalizeSignalToken(signal)}`;
}

function buildCheckValueKey(caseId: string, tick: number, signal: string): string {
  return `${normalizeSignalToken(caseId)}:t${normalizeTick(tick, 0)}:${normalizeSignalToken(signal)}`;
}

function normalizeSignalToken(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
  return normalized.length > 0 ? normalized : 'signal';
}

function normalizeSignalValue(value: unknown): VerifySignalValue {
  if (value === null || value === undefined) return null;
  if (value === true || value === 1 || value === '1') return '1';
  if (value === false || value === 0 || value === '0') return '0';
  return 'X';
}

function normalizeTick(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(0, Math.floor(numeric))
    : Math.max(0, Math.floor(fallback));
}

function normalizeOptionalRevision(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.floor(numeric));
}

function compareEntries(
  left: [string, boolean | number],
  right: [string, boolean | number]
): number {
  return left[0].localeCompare(right[0]);
}
