export type VerifyTruthStatus =
  | 'unavailable'
  | 'needsTestbench'
  | 'ready'
  | 'running'
  | 'passed'
  | 'failed'
  | 'staleDesign'
  | 'staleTestbench'
  | 'staleTiming'
  | 'runtimeError';

export type VerifyRunMode = 'observe' | 'compare';
export type VerifyCheckProvenance = 'course' | 'student';
export type VerifyCheckEditability = 'locked' | 'editable';
export type VerifySignalValue = '0' | '1' | 'X' | null;
export type VerifyResultValidity = 'none' | 'running' | 'current' | 'stale' | 'runtime-error';
export type VerifyStaleReason = 'design-changed' | 'scenario-changed' | 'check-set-changed' | 'timing-changed';
export type VerifySequentialTimingMode =
  | 'combinational'
  | 'auto-board-clock'
  | 'manual-clock'
  | 'custom-pattern';
export type VerifyTimingActiveEdge = 'rising';
export type VerifyTimingClockSource = 'none' | 'board-clock' | 'manual-pulses' | 'sim-clock' | 'custom-pattern';
export type VerifyTimingResetMode = 'none' | 'auto-sequence' | 'custom';

export interface VerifyTimingAuthority {
  mode: VerifySequentialTimingMode;
  activeEdge: VerifyTimingActiveEdge;
  clockSource: VerifyTimingClockSource;
  clockPatternRevision: number;
  resetMode: VerifyTimingResetMode;
  currentCycle: number;
  timingSummary: string;
  clockLaneEditable: boolean;
  sequentialRunEligibility: boolean;
  timingStaleReason: VerifyStaleReason | null;
  unsupportedReason: string | null;
}

export interface VerifyRevisionSet {
  designRevision: number;
  scenarioRevision: number;
  checkSetRevision: number;
}

export interface VerifyCheck {
  id: string;
  label: string;
  provenance: VerifyCheckProvenance;
  editability: VerifyCheckEditability;
  lockedReason?: string;
  expectedValues: Record<string, VerifySignalValue>;
  observedValues?: Record<string, VerifySignalValue>;
}

export interface VerifyFailure {
  id: string;
  checkId: string;
  signal: string;
  caseId: string;
  tick: number;
  expected: VerifySignalValue;
  observed: VerifySignalValue;
}

export interface VerifyRunRecord {
  runId: string;
  mode: VerifyRunMode;
  revisions: VerifyRevisionSet;
  sequentialTimingMode: VerifySequentialTimingMode;
  timing: VerifyTimingAuthority;
  status: 'observe' | 'pass' | 'fail' | 'error';
  observedValuesByCheck: Record<string, Record<string, VerifySignalValue>>;
  failures: VerifyFailure[];
}

export interface VerifyPendingRun {
  runId: string;
  mode: VerifyRunMode;
  revisions: VerifyRevisionSet;
  sequentialTimingMode: VerifySequentialTimingMode;
  timing: VerifyTimingAuthority;
}

export interface VerifyRejectedEvent {
  event: VerifyTruthEventType;
  reason: string;
}

export interface VerifyTruthState {
  hasDesign: boolean;
  status: VerifyTruthStatus;
  revisions: VerifyRevisionSet;
  checks: VerifyCheck[];
  lastRun: VerifyRunRecord | null;
  pendingRun: VerifyPendingRun | null;
  resultValidity: VerifyResultValidity;
  staleReason: VerifyStaleReason | null;
  selectedFailureId: string | null;
  sequentialTimingMode: VerifySequentialTimingMode;
  timing: VerifyTimingAuthority;
  lastRuntimeError: string | null;
  lastRejectedEvent: VerifyRejectedEvent | null;
}

export type VerifyTruthEvent =
  | { type: 'RESET'; hasDesign?: boolean; checks?: VerifyCheck[]; sequentialTimingMode?: VerifySequentialTimingMode; timing?: Partial<VerifyTimingAuthority> }
  | { type: 'DESIGN_CHANGED'; designRevision?: number }
  | { type: 'SCENARIO_CHANGED'; scenarioRevision?: number }
  | { type: 'CHECK_SET_CHANGED'; checks?: VerifyCheck[]; checkSetRevision?: number }
  | { type: 'COURSE_CHECK_DUPLICATED'; sourceCheckId: string; newCheckId: string; label?: string }
  | { type: 'STUDENT_CHECK_EDITED'; checkId: string; expectedValues: Record<string, VerifySignalValue> }
  | { type: 'TIMING_MODE_CHANGED'; sequentialTimingMode: VerifySequentialTimingMode; timing?: Partial<VerifyTimingAuthority> }
  | { type: 'MANUAL_PULSE_ADDED'; timing?: Partial<VerifyTimingAuthority> }
  | { type: 'MANUAL_PULSE_REMOVED'; timing?: Partial<VerifyTimingAuthority> }
  | { type: 'CLOCK_PATTERN_CHANGED'; timing?: Partial<VerifyTimingAuthority> }
  | { type: 'RESET_PATTERN_CHANGED'; timing?: Partial<VerifyTimingAuthority> }
  | { type: 'RUN_REQUESTED'; runId: string; mode: VerifyRunMode; sequentialTimingMode?: VerifySequentialTimingMode; timing?: Partial<VerifyTimingAuthority> }
  | { type: 'SEQUENTIAL_RUN_REQUESTED'; runId: string; mode: VerifyRunMode; sequentialTimingMode?: VerifySequentialTimingMode; timing?: Partial<VerifyTimingAuthority> }
  | {
      type: 'RUN_COMPLETED';
      runId: string;
      mode: VerifyRunMode;
      observedValuesByCheck?: Record<string, Record<string, VerifySignalValue>>;
      failures?: VerifyFailure[];
    }
  | {
      type: 'SEQUENTIAL_RUN_COMPLETED';
      runId: string;
      mode: VerifyRunMode;
      observedValuesByCheck?: Record<string, Record<string, VerifySignalValue>>;
      failures?: VerifyFailure[];
    }
  | { type: 'RUN_FAILED'; runId: string; message: string }
  | { type: 'FAILURE_SELECTED'; failureId: string };

export type VerifyTruthEventType = VerifyTruthEvent['type'];

export const VERIFY_TRUTH_STATECHART: Record<
  VerifyTruthEventType,
  { from: VerifyTruthStatus[]; to: VerifyTruthStatus[] }
> = {
  RESET: {
    from: ['unavailable', 'needsTestbench', 'ready', 'running', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['unavailable', 'needsTestbench', 'ready'],
  },
  DESIGN_CHANGED: {
    from: ['unavailable', 'needsTestbench', 'ready', 'running', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['needsTestbench', 'ready', 'staleDesign'],
  },
  SCENARIO_CHANGED: {
    from: ['needsTestbench', 'ready', 'running', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['needsTestbench', 'ready', 'staleTestbench'],
  },
  CHECK_SET_CHANGED: {
    from: ['needsTestbench', 'ready', 'running', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['needsTestbench', 'ready', 'staleTestbench'],
  },
  COURSE_CHECK_DUPLICATED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['ready', 'staleTestbench'],
  },
  STUDENT_CHECK_EDITED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['ready', 'staleTestbench'],
  },
  TIMING_MODE_CHANGED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['ready', 'staleTiming'],
  },
  MANUAL_PULSE_ADDED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['ready', 'staleTiming'],
  },
  MANUAL_PULSE_REMOVED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['ready', 'staleTiming'],
  },
  CLOCK_PATTERN_CHANGED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['ready', 'staleTiming'],
  },
  RESET_PATTERN_CHANGED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['ready', 'staleTiming'],
  },
  RUN_REQUESTED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['running'],
  },
  SEQUENTIAL_RUN_REQUESTED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'staleTiming', 'runtimeError'],
    to: ['running'],
  },
  RUN_COMPLETED: {
    from: ['running'],
    to: ['ready', 'passed', 'failed'],
  },
  SEQUENTIAL_RUN_COMPLETED: {
    from: ['running'],
    to: ['ready', 'passed', 'failed'],
  },
  RUN_FAILED: {
    from: ['running'],
    to: ['runtimeError'],
  },
  FAILURE_SELECTED: {
    from: ['failed'],
    to: ['failed'],
  },
};

const DEFAULT_LOCKED_REASON = 'Course check: duplicate it into My checks before editing expected values.';

export function createVerifyTruthInitialState(input: {
  hasDesign?: boolean;
  checks?: VerifyCheck[];
  revisions?: Partial<VerifyRevisionSet>;
  sequentialTimingMode?: VerifySequentialTimingMode;
  timing?: Partial<VerifyTimingAuthority>;
} = {}): VerifyTruthState {
  const hasDesign = input.hasDesign ?? true;
  const checks = normalizeChecks(input.checks ?? []);
  const revisions = normalizeRevisions(input.revisions);
  const timing = normalizeTimingAuthority({
    mode: input.sequentialTimingMode ?? 'combinational',
    ...input.timing,
  });
  const sequentialTimingMode = timing.mode;

  return {
    hasDesign,
    status: deriveReadyStatus(hasDesign, checks),
    revisions,
    checks,
    lastRun: null,
    pendingRun: null,
    resultValidity: 'none',
    staleReason: null,
    selectedFailureId: null,
    sequentialTimingMode,
    timing,
    lastRuntimeError: null,
    lastRejectedEvent: null,
  };
}

export function verifyTruthReducer(
  state: VerifyTruthState,
  event: VerifyTruthEvent
): VerifyTruthState {
  switch (event.type) {
    case 'RESET':
      return createVerifyTruthInitialState({
        hasDesign: event.hasDesign,
        checks: event.checks,
        sequentialTimingMode: event.sequentialTimingMode ?? event.timing?.mode,
        timing: event.timing,
      });

    case 'DESIGN_CHANGED': {
      const revisions = {
        ...state.revisions,
        designRevision: event.designRevision ?? state.revisions.designRevision + 1,
      };
      const next = {
        ...state,
        hasDesign: true,
        revisions,
        pendingRun: null,
        selectedFailureId: null,
        lastRuntimeError: null,
        lastRejectedEvent: null,
      };
      return state.lastRun
        ? markStale(next, 'staleDesign', 'design-changed')
        : { ...next, status: deriveReadyStatus(true, state.checks), resultValidity: 'none', staleReason: null };
    }

    case 'SCENARIO_CHANGED': {
      const revisions = {
        ...state.revisions,
        scenarioRevision: event.scenarioRevision ?? state.revisions.scenarioRevision + 1,
      };
      const next = {
        ...state,
        revisions,
        pendingRun: null,
        selectedFailureId: null,
        lastRuntimeError: null,
        lastRejectedEvent: null,
      };
      return state.lastRun
        ? markStale(next, 'staleTestbench', 'scenario-changed')
        : { ...next, status: deriveReadyStatus(state.hasDesign, state.checks), resultValidity: 'none', staleReason: null };
    }

    case 'CHECK_SET_CHANGED': {
      const checks = normalizeChecks(event.checks ?? state.checks);
      const revisions = {
        ...state.revisions,
        checkSetRevision: event.checkSetRevision ?? state.revisions.checkSetRevision + 1,
      };
      const next = {
        ...state,
        checks,
        revisions,
        pendingRun: null,
        selectedFailureId: null,
        lastRuntimeError: null,
        lastRejectedEvent: null,
      };
      return state.lastRun
        ? markStale(next, 'staleTestbench', 'check-set-changed')
        : { ...next, status: deriveReadyStatus(state.hasDesign, checks), resultValidity: 'none', staleReason: null };
    }

    case 'COURSE_CHECK_DUPLICATED': {
      const source = state.checks.find((check) => check.id === event.sourceCheckId);
      if (!source) return rejectEvent(state, event.type, `Unknown course check "${event.sourceCheckId}".`);
      if (source.provenance !== 'course') {
        return rejectEvent(state, event.type, `Check "${event.sourceCheckId}" is not a course check.`);
      }
      const duplicate: VerifyCheck = {
        ...source,
        id: event.newCheckId,
        label: event.label ?? `${source.label} copy`,
        provenance: 'student',
        editability: 'editable',
        lockedReason: undefined,
        expectedValues: { ...source.expectedValues },
        observedValues: source.observedValues ? { ...source.observedValues } : undefined,
      };
      return verifyTruthReducer(
        state,
        {
          type: 'CHECK_SET_CHANGED',
          checks: [...state.checks, duplicate],
        }
      );
    }

    case 'STUDENT_CHECK_EDITED': {
      const target = state.checks.find((check) => check.id === event.checkId);
      if (!target) return rejectEvent(state, event.type, `Unknown check "${event.checkId}".`);
      if (target.provenance !== 'student' || target.editability !== 'editable') {
        return rejectEvent(state, event.type, target.lockedReason ?? DEFAULT_LOCKED_REASON);
      }
      const checks = state.checks.map((check) =>
        check.id === event.checkId
          ? { ...check, expectedValues: { ...event.expectedValues } }
          : check
      );
      return verifyTruthReducer(state, { type: 'CHECK_SET_CHANGED', checks });
    }

    case 'TIMING_MODE_CHANGED':
    case 'MANUAL_PULSE_ADDED':
    case 'MANUAL_PULSE_REMOVED':
    case 'CLOCK_PATTERN_CHANGED':
    case 'RESET_PATTERN_CHANGED': {
      const timing = normalizeTimingAuthority({
        ...state.timing,
        ...event.timing,
        mode:
          event.type === 'TIMING_MODE_CHANGED'
            ? event.sequentialTimingMode
            : event.timing?.mode ?? state.timing.mode,
        clockPatternRevision:
          event.timing?.clockPatternRevision ??
          (event.type === 'TIMING_MODE_CHANGED'
            ? state.timing.clockPatternRevision
            : state.timing.clockPatternRevision + 1),
        timingStaleReason: state.lastRun ? 'timing-changed' : null,
      });
      if (timing.mode === 'custom-pattern') {
        return rejectEvent(
          state,
          event.type,
          timing.unsupportedReason ?? 'Custom clock patterns are not supported in trusted novice Verify yet.'
        );
      }
      const next = {
        ...state,
        timing,
        sequentialTimingMode: timing.mode,
        pendingRun: null,
        selectedFailureId: null,
        lastRuntimeError: null,
        lastRejectedEvent: null,
      };
      return state.lastRun
        ? markStale(next, 'staleTiming', 'timing-changed')
        : { ...next, status: deriveReadyStatus(state.hasDesign, state.checks), resultValidity: 'none', staleReason: null };
    }

    case 'SEQUENTIAL_RUN_REQUESTED':
    case 'RUN_REQUESTED': {
      if (!state.hasDesign) return rejectEvent(state, event.type, 'Verify needs a circuit before running.');
      if (event.mode === 'compare' && state.checks.length === 0) {
        return rejectEvent(state, event.type, 'Verify needs at least one check before a run can be trusted.');
      }
      const timing = normalizeTimingAuthority({
        ...state.timing,
        ...event.timing,
        mode: event.sequentialTimingMode ?? event.timing?.mode ?? state.timing.mode,
        timingStaleReason: null,
      });
      if (!timing.sequentialRunEligibility) {
        return rejectEvent(
          state,
          event.type,
          timing.unsupportedReason ?? 'The selected timing mode is not supported for trusted Verify.'
        );
      }
      const sequentialTimingMode = timing.mode;
      return {
        ...state,
        status: 'running',
        pendingRun: {
          runId: event.runId,
          mode: event.mode,
          revisions: { ...state.revisions },
          sequentialTimingMode,
          timing,
        },
        resultValidity: 'running',
        staleReason: null,
        selectedFailureId: null,
        sequentialTimingMode,
        timing,
        lastRuntimeError: null,
        lastRejectedEvent: null,
      };
    }

    case 'SEQUENTIAL_RUN_COMPLETED':
    case 'RUN_COMPLETED': {
      if (!state.pendingRun) return rejectEvent(state, event.type, 'No pending Verify run exists.');
      if (state.pendingRun.runId !== event.runId) {
        return rejectEvent(state, event.type, `Run "${event.runId}" does not match the pending run.`);
      }
      if (state.pendingRun.mode !== event.mode) {
        return rejectEvent(state, event.type, `Run "${event.runId}" completed with the wrong mode.`);
      }
      const observedValuesByCheck = cloneObserved(event.observedValuesByCheck ?? {});
      const failures = (event.failures ?? []).map(cloneFailure);
      const status = event.mode === 'observe' ? 'observe' : failures.length > 0 ? 'fail' : 'pass';
      const lastRun: VerifyRunRecord = {
        runId: event.runId,
        mode: event.mode,
        revisions: { ...state.pendingRun.revisions },
        sequentialTimingMode: state.pendingRun.sequentialTimingMode,
        timing: state.pendingRun.timing,
        status,
        observedValuesByCheck,
        failures,
      };
      const checks = state.checks.map((check) => ({
        ...check,
        observedValues: observedValuesByCheck[check.id]
          ? { ...observedValuesByCheck[check.id] }
          : check.observedValues ? { ...check.observedValues } : undefined,
      }));
      return {
        ...state,
        status: status === 'observe' ? deriveReadyStatus(state.hasDesign, checks) : status === 'pass' ? 'passed' : 'failed',
        checks,
        lastRun,
        pendingRun: null,
        resultValidity: 'current',
        staleReason: null,
        selectedFailureId: failures.length > 0 ? failures[0].id : null,
        timing: {
          ...state.pendingRun.timing,
          timingStaleReason: null,
        },
        sequentialTimingMode: state.pendingRun.sequentialTimingMode,
        lastRuntimeError: null,
        lastRejectedEvent: null,
      };
    }

    case 'RUN_FAILED': {
      if (!state.pendingRun) return rejectEvent(state, event.type, 'No pending Verify run exists.');
      if (state.pendingRun.runId !== event.runId) {
        return rejectEvent(state, event.type, `Run "${event.runId}" does not match the pending run.`);
      }
      return {
        ...state,
        status: 'runtimeError',
        pendingRun: null,
        resultValidity: 'runtime-error',
        staleReason: null,
        selectedFailureId: null,
        lastRuntimeError: event.message,
        lastRejectedEvent: null,
      };
    }

    case 'FAILURE_SELECTED': {
      const failures = state.lastRun?.failures ?? [];
      if (state.status !== 'failed' || !failures.some((failure) => failure.id === event.failureId)) {
        return rejectEvent(state, event.type, `Failure "${event.failureId}" is not available in the current result.`);
      }
      return {
        ...state,
        selectedFailureId: event.failureId,
        lastRejectedEvent: null,
      };
    }

    default:
      return state;
  }
}

export function deriveFailureRepairActions(
  state: VerifyTruthState,
  failureId: string | null = state.selectedFailureId
): {
  canFixCircuit: boolean;
  canEditExpected: boolean;
  checkProvenance: VerifyCheckProvenance | null;
  lockedReason: string | null;
} {
  const failure = failureId ? state.lastRun?.failures.find((item) => item.id === failureId) : null;
  const check = failure ? state.checks.find((item) => item.id === failure.checkId) : null;
  if (!failure || !check) {
    return { canFixCircuit: false, canEditExpected: false, checkProvenance: null, lockedReason: null };
  }

  const canEditExpected = check.provenance === 'student' && check.editability === 'editable';
  return {
    canFixCircuit: true,
    canEditExpected,
    checkProvenance: check.provenance,
    lockedReason: canEditExpected ? null : check.lockedReason ?? DEFAULT_LOCKED_REASON,
  };
}

export function assertVerifyTruthInvariants(state: VerifyTruthState): string[] {
  const problems: string[] = [];
  const currentRunMatchesRevisions = state.lastRun
    ? revisionsEqual(state.revisions, state.lastRun.revisions)
    : false;

  if (state.status === 'running' && !state.pendingRun) {
    problems.push('running status requires a pending run');
  }
  if (state.status !== 'running' && state.pendingRun) {
    problems.push('pending run must not outlive running status');
  }
  if ((state.status === 'passed' || state.status === 'failed') && !state.lastRun) {
    problems.push('pass/fail status requires a run record');
  }
  if (state.status === 'passed' && state.lastRun) {
    if (state.lastRun.mode !== 'compare') problems.push('passed status requires compare mode');
    if (state.lastRun.status !== 'pass') problems.push('passed status requires pass run status');
    if (state.lastRun.failures.length !== 0) problems.push('passed status must not carry failures');
    if (!currentRunMatchesRevisions || state.resultValidity !== 'current') {
      problems.push('passed status requires current matching revisions');
    }
  }
  if (state.status === 'failed' && state.lastRun) {
    if (state.lastRun.mode !== 'compare') problems.push('failed status requires compare mode');
    if (state.lastRun.status !== 'fail') problems.push('failed status requires fail run status');
    if (state.lastRun.failures.length === 0) problems.push('failed status requires at least one failure');
    if (!currentRunMatchesRevisions || state.resultValidity !== 'current') {
      problems.push('failed status requires current matching revisions');
    }
    if (state.selectedFailureId && !state.lastRun.failures.some((failure) => failure.id === state.selectedFailureId)) {
      problems.push('selected failure must exist in current run failures');
    }
  }
  if (state.status === 'staleDesign' && state.staleReason !== 'design-changed') {
    problems.push('staleDesign requires design-changed stale reason');
  }
  if (state.status === 'staleTestbench' && state.staleReason !== 'scenario-changed' && state.staleReason !== 'check-set-changed') {
    problems.push('staleTestbench requires scenario or check-set stale reason');
  }
  if (state.status === 'staleTiming' && state.staleReason !== 'timing-changed') {
    problems.push('staleTiming requires timing-changed stale reason');
  }
  if ((state.status === 'staleDesign' || state.status === 'staleTestbench' || state.status === 'staleTiming') && state.resultValidity !== 'stale') {
    problems.push('stale statuses require stale result validity');
  }
  if (state.timing.mode !== state.sequentialTimingMode) {
    problems.push('timing mode and sequential timing mode must match');
  }
  if (state.timing.activeEdge !== 'rising') {
    problems.push('only rising-edge timing is supported');
  }
  if (state.timing.mode === 'auto-board-clock' && state.timing.clockLaneEditable) {
    problems.push('auto board clock lane must be read-only');
  }
  if (state.timing.mode === 'custom-pattern' && state.timing.sequentialRunEligibility) {
    problems.push('custom timing pattern must not be eligible for trusted Verify');
  }
  if (state.status === 'unavailable' && state.hasDesign) {
    problems.push('unavailable status requires no design');
  }
  if (state.status === 'needsTestbench' && state.checks.length > 0) {
    problems.push('needsTestbench status requires zero checks');
  }
  for (const check of state.checks) {
    if (check.provenance === 'course' && check.editability !== 'locked') {
      problems.push(`course check "${check.id}" must be locked`);
    }
    if (check.provenance === 'course' && !check.lockedReason) {
      problems.push(`course check "${check.id}" needs a locked reason`);
    }
  }

  return problems;
}

function deriveReadyStatus(hasDesign: boolean, checks: VerifyCheck[]): VerifyTruthStatus {
  if (!hasDesign) return 'unavailable';
  if (checks.length === 0) return 'needsTestbench';
  return 'ready';
}

function markStale(
  state: VerifyTruthState,
  status: 'staleDesign' | 'staleTestbench' | 'staleTiming',
  staleReason: VerifyStaleReason
): VerifyTruthState {
  return {
    ...state,
    status,
    resultValidity: 'stale',
    staleReason,
    timing: status === 'staleTiming'
      ? { ...state.timing, timingStaleReason: staleReason }
      : state.timing,
  };
}

function rejectEvent(
  state: VerifyTruthState,
  event: VerifyTruthEventType,
  reason: string
): VerifyTruthState {
  return {
    ...state,
    lastRejectedEvent: { event, reason },
  };
}

function normalizeChecks(checks: VerifyCheck[]): VerifyCheck[] {
  return checks.map((check) => {
    const provenance = check.provenance;
    const isCourse = provenance === 'course';
    return {
      ...check,
      label: check.label.trim() || check.id,
      provenance,
      editability: isCourse ? 'locked' : check.editability,
      lockedReason: isCourse ? check.lockedReason ?? DEFAULT_LOCKED_REASON : check.lockedReason,
      expectedValues: { ...check.expectedValues },
      observedValues: check.observedValues ? { ...check.observedValues } : undefined,
    };
  });
}

function normalizeRevisions(revisions: Partial<VerifyRevisionSet> = {}): VerifyRevisionSet {
  return {
    designRevision: normalizeRevision(revisions.designRevision),
    scenarioRevision: normalizeRevision(revisions.scenarioRevision),
    checkSetRevision: normalizeRevision(revisions.checkSetRevision),
  };
}

function normalizeRevision(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeTimingAuthority(input: Partial<VerifyTimingAuthority> = {}): VerifyTimingAuthority {
  const mode = input.mode ?? 'combinational';
  const clockSource = input.clockSource ?? deriveClockSource(mode);
  const unsupportedReason =
    mode === 'custom-pattern'
      ? input.unsupportedReason ?? 'Custom clock patterns are not supported in trusted novice Verify yet.'
      : null;
  return {
    mode,
    activeEdge: 'rising',
    clockSource,
    clockPatternRevision: normalizeRevision(input.clockPatternRevision),
    resetMode: input.resetMode ?? 'none',
    currentCycle: normalizeRevision(input.currentCycle),
    timingSummary: input.timingSummary ?? deriveTimingSummary(mode, clockSource, input.resetMode ?? 'none'),
    clockLaneEditable:
      input.clockLaneEditable ??
      (mode === 'manual-clock' && clockSource === 'manual-pulses'),
    sequentialRunEligibility:
      input.sequentialRunEligibility ?? (mode !== 'custom-pattern'),
    timingStaleReason: input.timingStaleReason ?? null,
    unsupportedReason,
  };
}

function deriveClockSource(mode: VerifySequentialTimingMode): VerifyTimingClockSource {
  if (mode === 'auto-board-clock') return 'board-clock';
  if (mode === 'manual-clock') return 'manual-pulses';
  if (mode === 'custom-pattern') return 'custom-pattern';
  return 'none';
}

function deriveTimingSummary(
  mode: VerifySequentialTimingMode,
  clockSource: VerifyTimingClockSource,
  resetMode: VerifyTimingResetMode
): string {
  if (mode === 'auto-board-clock') {
    return `Auto board clock, rising edge, ${resetMode === 'auto-sequence' ? 'reset sequence applied' : 'no reset sequence'}.`;
  }
  if (mode === 'manual-clock') {
    return `Manual pulses, rising edge, ${resetMode === 'custom' ? 'student-authored reset' : 'no reset sequence'}.`;
  }
  if (mode === 'custom-pattern') {
    return 'Custom clock pattern is outside trusted novice Verify.';
  }
  return clockSource === 'none' ? 'Combinational checks use no clock lane.' : 'Combinational timing.';
}

function cloneObserved(
  observedValuesByCheck: Record<string, Record<string, VerifySignalValue>>
): Record<string, Record<string, VerifySignalValue>> {
  return Object.fromEntries(
    Object.entries(observedValuesByCheck).map(([checkId, values]) => [checkId, { ...values }])
  );
}

function cloneFailure(failure: VerifyFailure): VerifyFailure {
  return { ...failure };
}

function revisionsEqual(left: VerifyRevisionSet, right: VerifyRevisionSet): boolean {
  return (
    left.designRevision === right.designRevision &&
    left.scenarioRevision === right.scenarioRevision &&
    left.checkSetRevision === right.checkSetRevision
  );
}
