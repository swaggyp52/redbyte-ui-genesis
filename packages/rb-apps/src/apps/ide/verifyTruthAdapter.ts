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
  type VerifyTimingAuthority,
  type VerifyTimingClockSource,
  type VerifyTimingResetMode,
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
  scheduleContract?: VerifyScheduleContract | null;
  clockPolicy?: VerifyClockPolicy | null;
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
  staleReasonCode: VerifyTruthState['staleReason'];
  staleReason: string | null;
  staleRecoveryAction: string | null;
  projectVerifyState: ProjectVerifyState;
  projectVerifyStatus: ProjectVerifyState;
  projectStatusText: string;
  exportReadiness: VerifyTruthExportReadiness;
  resultValidity: VerifyTruthState['resultValidity'];
  timingMode: VerifySequentialTimingMode;
  timingModeLabel: string;
  timingModeHint: string;
  timingActiveEdge: VerifyTimingAuthority['activeEdge'];
  timingActiveEdgeLabel: string;
  timingClockSource: VerifyTimingClockSource;
  timingResetMode: VerifyTimingResetMode;
  timingResetSummary: string;
  timingSummary: string;
  clockLaneEditable: boolean;
  clockLaneReadOnlyReason: string | null;
  sequentialRunEligibility: boolean;
  timingStaleReason: VerifyTruthState['staleReason'];
  canRunObserve: boolean;
  canRunCompare: boolean;
  canExportTrusted: boolean;
  selectedFailure: VerifyFailure | null;
  repairActions: ReturnType<typeof deriveFailureRepairActions>;
  selectedFailureRepair: ReturnType<typeof deriveFailureRepairActions>;
  selectedFailureRepairLabel: string | null;
  selectedFailureRepairHint: string | null;
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
  const currentTiming = deriveTimingAuthority(
    input.lastRun,
    input.scheduleContract,
    input.clockPolicy
  );
  const runTiming = input.lastRun
    ? deriveTimingAuthority(input.lastRun, input.lastRun.scheduleContract, input.lastRun.clockPolicy)
    : currentTiming;
  const revisions = deriveRuntimeRevisions(input, checks);
  let state = createVerifyTruthInitialState({
    hasDesign: input.hasDesign,
    checks,
    revisions,
    sequentialTimingMode: runTiming.mode,
    timing: runTiming,
  });

  if (input.lastRun) {
    const mode = deriveRunMode(input.lastRun);
    const runId = deriveRunId(input.lastRun);
    const requested = verifyTruthReducer(state, {
      type: 'RUN_REQUESTED',
      runId,
      mode,
      sequentialTimingMode: runTiming.mode,
      timing: runTiming,
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
  const timingStaleEvent = deriveRuntimeTimingStaleEvent(input, state, currentTiming, runTiming);
  if (timingStaleEvent) {
    state = verifyTruthReducer(state, timingStaleEvent);
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
    staleReasonCode: state.staleReason,
    staleReason: deriveStaleReasonText(state),
    staleRecoveryAction: deriveStaleRecoveryAction(state),
    projectVerifyState,
    projectVerifyStatus: projectVerifyState,
    projectStatusText: deriveProjectStatusText(state, projectVerifyState),
    exportReadiness: deriveExportReadiness(state, projectVerifyState),
    resultValidity: state.resultValidity,
    timingMode: state.sequentialTimingMode,
    timingModeLabel: deriveTimingModeLabel(state.sequentialTimingMode),
    timingModeHint: deriveTimingModeHint(state.sequentialTimingMode),
    timingActiveEdge: state.timing.activeEdge,
    timingActiveEdgeLabel: state.timing.activeEdge === 'rising' ? 'Rising edge' : 'Unsupported edge',
    timingClockSource: state.timing.clockSource,
    timingResetMode: state.timing.resetMode,
    timingResetSummary: deriveTimingResetSummary(state.timing.resetMode),
    timingSummary: state.timing.timingSummary,
    clockLaneEditable: state.timing.clockLaneEditable,
    clockLaneReadOnlyReason: state.timing.clockLaneEditable
      ? null
      : deriveClockLaneReadOnlyReason(state.timing),
    sequentialRunEligibility: state.timing.sequentialRunEligibility,
    timingStaleReason: state.timing.timingStaleReason,
    canRunObserve,
    canRunCompare: canRunCompare && state.timing.sequentialRunEligibility,
    canExportTrusted,
    selectedFailure,
    repairActions: selectedFailureRepair,
    selectedFailureRepair,
    selectedFailureRepairLabel: deriveFailureRepairLabel(selectedFailureRepair),
    selectedFailureRepairHint: deriveFailureRepairHint(selectedFailureRepair),
    invariantProblems: assertVerifyTruthInvariants(state),
  };
}

export function deriveVerifyTruthProjectState(state: VerifyTruthState): ProjectVerifyState {
  if (state.status === 'runtimeError') return 'verify-error';
  if (!state.lastRun) return 'not-run';
  if (state.status === 'staleDesign' || state.status === 'staleTestbench' || state.status === 'staleTiming') return 'stale';
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
    const resolved = resolveReportCheck(row, checks);
    if (!resolved) continue;
    const { caseId, checkId, tick, valueKey } = resolved;
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
        tick,
        expected: normalizeSignalValue(row.expected),
        observed: normalizeSignalValue(row.actual),
      });
    }
  }

  if (mode === 'compare' && run.status === 'fail' && failures.length === 0) {
    return {
      type: 'RUN_FAILED',
      runId,
      message: 'Verify comparison failed, but no matching V2 check could be resolved.',
    };
  }

  return {
    type: 'RUN_COMPLETED',
    runId,
    mode,
    observedValuesByCheck,
    failures,
  };
}

interface ResolvedReportCheck {
  caseId: string;
  checkId: string;
  tick: number;
  valueKey: string;
}

interface ParsedCheckReference {
  check: VerifyCheck;
  caseToken: string;
  tick: number;
  signalToken: string;
  valueKey: string;
}

function resolveReportCheck(
  row: RuntimeVerifyRun['report']['rows'][number],
  checks: readonly VerifyCheck[]
): ResolvedReportCheck | null {
  const caseIds = deriveReportCaseIdCandidates(row);
  const tick = normalizeTick(row.tick, 0);
  const signalToken = normalizeSignalToken(row.signal);

  for (const caseId of caseIds) {
    const exactCheckId = buildCheckId(caseId, tick, signalToken);
    const exact = checks.find((check) => check.id === exactCheckId);
    if (exact) {
      return {
        caseId,
        checkId: exact.id,
        tick,
        valueKey: buildCheckValueKey(caseId, tick, signalToken),
      };
    }
  }

  const caseTokens = new Set(caseIds.map(normalizeSignalToken));
  const sameSlotMatches = checks
    .map(parseCheckReference)
    .filter((reference): reference is ParsedCheckReference => Boolean(reference))
    .filter((reference) => caseTokens.has(reference.caseToken) && reference.tick === tick)
    .filter((reference) => signalTokensCanAlias(signalToken, reference.signalToken));

  if (sameSlotMatches.length !== 1) return null;
  const [match] = sameSlotMatches;
  return {
    caseId: match.caseToken,
    checkId: match.check.id,
    tick,
    valueKey: match.valueKey,
  };
}

function deriveReportCaseIdCandidates(row: RuntimeVerifyRun['report']['rows'][number]): string[] {
  const candidates = [
    deriveReportCaseId(row.vectorId, row.caseIndex, row.tick),
  ];
  if (Number.isFinite(row.caseIndex)) {
    candidates.push(`case-${Math.max(0, Math.floor(Number(row.caseIndex))) + 1}`);
  }
  candidates.push(`tick-${Math.max(0, Math.floor(row.tick))}`);
  return Array.from(new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean)));
}

function parseCheckReference(check: VerifyCheck): ParsedCheckReference | null {
  const valueKey = Object.keys(check.expectedValues)[0];
  const parsedValueKey = valueKey ? parseCheckValueKey(valueKey) : null;
  if (parsedValueKey) {
    return {
      check,
      ...parsedValueKey,
      valueKey,
    };
  }

  const parsedId = parseCheckId(check.id);
  if (!parsedId) return null;
  return {
    check,
    ...parsedId,
    valueKey: buildCheckValueKey(parsedId.caseToken, parsedId.tick, parsedId.signalToken),
  };
}

function parseCheckValueKey(
  valueKey: string
): Pick<ParsedCheckReference, 'caseToken' | 'tick' | 'signalToken'> | null {
  const [caseToken, tickToken, ...signalParts] = valueKey.split(':');
  const tick = Number(String(tickToken ?? '').replace(/^t/, ''));
  const signalToken = normalizeSignalToken(signalParts.join(':'));
  if (!caseToken || !Number.isFinite(tick) || signalParts.length === 0) return null;
  return {
    caseToken: normalizeSignalToken(caseToken),
    tick: normalizeTick(tick, 0),
    signalToken,
  };
}

function parseCheckId(
  checkId: string
): Pick<ParsedCheckReference, 'caseToken' | 'tick' | 'signalToken'> | null {
  const [prefix, caseToken, tickToken, ...signalParts] = checkId.split(':');
  const tick = Number(String(tickToken ?? '').replace(/^t/, ''));
  const signalToken = normalizeSignalToken(signalParts.join(':'));
  if (prefix !== 'check' || !caseToken || !Number.isFinite(tick) || signalParts.length === 0) {
    return null;
  }
  return {
    caseToken: normalizeSignalToken(caseToken),
    tick: normalizeTick(tick, 0),
    signalToken,
  };
}

function signalTokensCanAlias(reportSignal: string, checkSignal: string): boolean {
  const reportBoardSignal = extractBoardSignalPrefix(reportSignal);
  const checkBoardSignal = extractBoardSignalPrefix(checkSignal);
  return (
    reportSignal === checkSignal ||
    reportSignal.startsWith(checkSignal) ||
    checkSignal.startsWith(reportSignal) ||
    (reportBoardSignal !== null && reportBoardSignal === checkBoardSignal)
  );
}

function extractBoardSignalPrefix(signal: string): string | null {
  const match = /^(sw|ld|btn|led|clk)(?:-|_|\.)?([a-z]|\d+)?/i.exec(signal);
  if (!match) return null;
  const suffix = match[2] ?? '';
  return `${match[1].toLowerCase()}${suffix.toLowerCase()}`;
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
  run: RuntimeVerifyRun | null | undefined,
  scheduleContract?: VerifyScheduleContract | null,
  clockPolicy?: VerifyClockPolicy | null
): VerifySequentialTimingMode {
  if (clockPolicy) return deriveSequentialTimingModeFromClockPolicy(clockPolicy);
  if (!run) return deriveSequentialTimingModeFromSchedule(scheduleContract ?? undefined, undefined);
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
  fallbackSchedule: RuntimeVerifyRun['schedule'] | undefined
): VerifySequentialTimingMode {
  const schedule = scheduleContract?.schedule ?? fallbackSchedule;
  if (schedule !== 'clocked_macro') return 'combinational';
  return scheduleContract?.timingMode === 'manual_event_driven_lab'
    ? 'manual-clock'
    : 'auto-board-clock';
}

function deriveTimingAuthority(
  run: RuntimeVerifyRun | null | undefined,
  scheduleContract?: VerifyScheduleContract | null,
  clockPolicy?: VerifyClockPolicy | null
): VerifyTimingAuthority {
  const mode = deriveSequentialTimingMode(run, scheduleContract, clockPolicy);
  const policy = clockPolicy ?? run?.clockPolicy ?? null;
  const resetMode = deriveTimingResetMode(policy);
  const clockSource = deriveTimingClockSource(mode, policy);
  const runCycles = normalizeOptionalRevision(policy?.runCycles) ?? 0;
  const timingSummary = deriveTimingSummary(mode, policy, resetMode, runCycles);
  const clockLaneEditable = mode === 'manual-clock' && clockSource === 'manual-pulses';
  const unsupportedReason =
    mode === 'custom-pattern'
      ? 'Custom clock patterns are not supported in trusted novice Verify yet.'
      : null;
  return {
    mode,
    activeEdge: 'rising',
    clockSource,
    clockPatternRevision: runCycles,
    resetMode,
    currentCycle: runCycles,
    timingSummary,
    clockLaneEditable,
    sequentialRunEligibility: mode !== 'custom-pattern',
    timingStaleReason: null,
    unsupportedReason,
  };
}

function deriveRuntimeTimingStaleEvent(
  input: VerifyTruthRuntimeInput,
  state: VerifyTruthState,
  currentTiming: VerifyTimingAuthority,
  runTiming: VerifyTimingAuthority
): Parameters<typeof verifyTruthReducer>[1] | null {
  if (!input.lastRun || !state.lastRun || state.resultValidity !== 'current') return null;
  if (currentTiming.mode !== runTiming.mode || currentTiming.clockSource !== runTiming.clockSource) {
    return {
      type: 'TIMING_MODE_CHANGED',
      sequentialTimingMode: currentTiming.mode,
      timing: currentTiming,
    };
  }
  if (
    currentTiming.clockPatternRevision !== runTiming.clockPatternRevision ||
    currentTiming.resetMode !== runTiming.resetMode
  ) {
    return {
      type: 'CLOCK_PATTERN_CHANGED',
      timing: currentTiming,
    };
  }
  return null;
}

function deriveTimingClockSource(
  mode: VerifySequentialTimingMode,
  policy: VerifyClockPolicy | null
): VerifyTimingClockSource {
  if (mode === 'combinational') return 'none';
  if (mode === 'custom-pattern') return 'custom-pattern';
  if (mode === 'manual-clock') return 'manual-pulses';
  if (policy?.sourceType === 'board-clock') return 'board-clock';
  return policy?.sourceType === 'explicit-clock-component' ? 'sim-clock' : 'board-clock';
}

function deriveTimingResetMode(policy: VerifyClockPolicy | null): VerifyTimingResetMode {
  if (!policy) return 'none';
  if (policy.resetBehavior === 'auto-sequence') return 'auto-sequence';
  if (policy.resetBehavior === 'custom') return 'custom';
  return 'none';
}

function deriveTimingSummary(
  mode: VerifySequentialTimingMode,
  policy: VerifyClockPolicy | null,
  resetMode: VerifyTimingResetMode,
  runCycles: number
): string {
  const cycleLabel = runCycles > 0 ? `${runCycles} cycle${runCycles === 1 ? '' : 's'}` : 'default cycles';
  const resetLabel =
    resetMode === 'auto-sequence'
      ? 'reset sequence applied'
      : resetMode === 'custom'
        ? 'student-authored reset'
        : 'no reset sequence';
  if (mode === 'auto-board-clock') {
    const source = policy?.boardAlias ? `${policy.boardAlias} / ${policy.packagePin ?? 'board clock pin'}` : 'board clock';
    return `Auto board clock from ${source}; rising edge; ${cycleLabel}; ${resetLabel}.`;
  }
  if (mode === 'manual-clock') {
    return `Manual pulses; rising edge; ${cycleLabel}; ${resetLabel}.`;
  }
  if (mode === 'custom-pattern') {
    return 'Custom clock pattern is outside trusted novice Verify.';
  }
  return 'Combinational checks use no clock lane.';
}

function deriveTimingResetSummary(mode: VerifyTimingResetMode): string {
  if (mode === 'auto-sequence') return 'Reset sequence applied automatically.';
  if (mode === 'custom') return 'Reset is student-authored in the testbench.';
  return 'No reset sequence detected.';
}

function deriveClockLaneReadOnlyReason(timing: VerifyTimingAuthority): string | null {
  if (timing.mode === 'auto-board-clock') {
    return 'Auto board clock is generated during Verify; the clock lane is read-only.';
  }
  if (timing.mode === 'custom-pattern') {
    return timing.unsupportedReason ?? 'Custom timing is not available in trusted novice Verify.';
  }
  if (timing.mode === 'combinational') {
    return 'Combinational checks do not use a clock lane.';
  }
  return null;
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
    return 'Design changed - rerun Compare for the current circuit.';
  }
  if (state.staleReason === 'check-set-changed') {
    return 'Saved checks changed - rerun Compare for the current testbench.';
  }
  if (state.staleReason === 'scenario-changed') {
    return 'Selected testbench changed - rerun Compare for the active scenario.';
  }
  if (state.staleReason === 'timing-changed') {
    return 'Timing changed - rerun Compare for the current clock setup.';
  }
  return 'Re-run Verify for the current work.';
}

function deriveStaleRecoveryAction(state: VerifyTruthState): string | null {
  if (state.resultValidity !== 'stale') return null;
  if (state.staleReason === 'design-changed') return 'Review Design if needed, then run Compare again.';
  if (state.staleReason === 'check-set-changed') return 'Review saved expected outputs, then run Compare again.';
  if (state.staleReason === 'scenario-changed') return 'Confirm the selected testbench, then run Compare again.';
  if (state.staleReason === 'timing-changed') return 'Confirm the clock and reset setup, then run Compare again.';
  return 'Run Compare again before trusting this evidence.';
}

function deriveTimingModeLabel(mode: VerifySequentialTimingMode): string {
  if (mode === 'auto-board-clock') return 'Auto board clock';
  if (mode === 'manual-clock') return 'Manual clock';
  if (mode === 'custom-pattern') return 'Custom pattern';
  return 'Combinational no clock';
}

function deriveTimingModeHint(mode: VerifySequentialTimingMode): string {
  if (mode === 'auto-board-clock') {
    return 'Verify generates the board clock activity; data inputs remain the editable testbench work.';
  }
  if (mode === 'manual-clock') {
    return 'Clock activity is part of the authored testbench and must be visible before Compare.';
  }
  if (mode === 'custom-pattern') {
    return 'The authored pattern defines the clock edges and sampled output checks.';
  }
  return 'Combinational checks use data inputs only; no clock lane is required.';
}

function deriveFailureRepairLabel(
  repair: ReturnType<typeof deriveFailureRepairActions>
): string | null {
  if (!repair.canFixCircuit && !repair.canEditExpected) return null;
  if (repair.canFixCircuit && repair.canEditExpected) return 'Fix circuit or update My expected output';
  if (repair.canFixCircuit) return 'Fix circuit in Design';
  return 'Update My expected output';
}

function deriveFailureRepairHint(
  repair: ReturnType<typeof deriveFailureRepairActions>
): string | null {
  if (repair.checkProvenance === 'course') {
    return repair.lockedReason ?? COURSE_LOCKED_REASON;
  }
  if (repair.canEditExpected) {
    return 'This mismatch belongs to My checks, so expected-output repair is available.';
  }
  return null;
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
