export type VerifyTruthStatus =
  | 'unavailable'
  | 'needsTestbench'
  | 'ready'
  | 'running'
  | 'passed'
  | 'failed'
  | 'staleDesign'
  | 'staleTestbench'
  | 'runtimeError';

export type VerifyRunMode = 'observe' | 'compare';
export type VerifyCheckProvenance = 'course' | 'student';
export type VerifyCheckEditability = 'locked' | 'editable';
export type VerifySignalValue = '0' | '1' | 'X' | null;
export type VerifyResultValidity = 'none' | 'running' | 'current' | 'stale' | 'runtime-error';
export type VerifyStaleReason = 'design-changed' | 'scenario-changed' | 'check-set-changed';
export type VerifySequentialTimingMode =
  | 'combinational'
  | 'auto-board-clock'
  | 'manual-clock'
  | 'custom-pattern';

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
  status: 'observe' | 'pass' | 'fail' | 'error';
  observedValuesByCheck: Record<string, Record<string, VerifySignalValue>>;
  failures: VerifyFailure[];
}

export interface VerifyPendingRun {
  runId: string;
  mode: VerifyRunMode;
  revisions: VerifyRevisionSet;
  sequentialTimingMode: VerifySequentialTimingMode;
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
  lastRuntimeError: string | null;
  lastRejectedEvent: VerifyRejectedEvent | null;
}

export type VerifyTruthEvent =
  | { type: 'RESET'; hasDesign?: boolean; checks?: VerifyCheck[]; sequentialTimingMode?: VerifySequentialTimingMode }
  | { type: 'DESIGN_CHANGED'; designRevision?: number }
  | { type: 'SCENARIO_CHANGED'; scenarioRevision?: number }
  | { type: 'CHECK_SET_CHANGED'; checks?: VerifyCheck[]; checkSetRevision?: number }
  | { type: 'COURSE_CHECK_DUPLICATED'; sourceCheckId: string; newCheckId: string; label?: string }
  | { type: 'STUDENT_CHECK_EDITED'; checkId: string; expectedValues: Record<string, VerifySignalValue> }
  | { type: 'RUN_REQUESTED'; runId: string; mode: VerifyRunMode; sequentialTimingMode?: VerifySequentialTimingMode }
  | {
      type: 'RUN_COMPLETED';
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
    from: ['unavailable', 'needsTestbench', 'ready', 'running', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'runtimeError'],
    to: ['unavailable', 'needsTestbench', 'ready'],
  },
  DESIGN_CHANGED: {
    from: ['unavailable', 'needsTestbench', 'ready', 'running', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'runtimeError'],
    to: ['needsTestbench', 'ready', 'staleDesign'],
  },
  SCENARIO_CHANGED: {
    from: ['needsTestbench', 'ready', 'running', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'runtimeError'],
    to: ['needsTestbench', 'ready', 'staleTestbench'],
  },
  CHECK_SET_CHANGED: {
    from: ['needsTestbench', 'ready', 'running', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'runtimeError'],
    to: ['needsTestbench', 'ready', 'staleTestbench'],
  },
  COURSE_CHECK_DUPLICATED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'runtimeError'],
    to: ['ready', 'staleTestbench'],
  },
  STUDENT_CHECK_EDITED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'runtimeError'],
    to: ['ready', 'staleTestbench'],
  },
  RUN_REQUESTED: {
    from: ['ready', 'passed', 'failed', 'staleDesign', 'staleTestbench', 'runtimeError'],
    to: ['running'],
  },
  RUN_COMPLETED: {
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
} = {}): VerifyTruthState {
  const hasDesign = input.hasDesign ?? true;
  const checks = normalizeChecks(input.checks ?? []);
  const revisions = normalizeRevisions(input.revisions);
  const sequentialTimingMode = input.sequentialTimingMode ?? 'combinational';

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
        sequentialTimingMode: event.sequentialTimingMode,
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

    case 'RUN_REQUESTED': {
      if (!state.hasDesign) return rejectEvent(state, event.type, 'Verify needs a circuit before running.');
      if (event.mode === 'compare' && state.checks.length === 0) {
        return rejectEvent(state, event.type, 'Verify needs at least one check before a run can be trusted.');
      }
      const sequentialTimingMode = event.sequentialTimingMode ?? state.sequentialTimingMode;
      return {
        ...state,
        status: 'running',
        pendingRun: {
          runId: event.runId,
          mode: event.mode,
          revisions: { ...state.revisions },
          sequentialTimingMode,
        },
        resultValidity: 'running',
        staleReason: null,
        selectedFailureId: null,
        sequentialTimingMode,
        lastRuntimeError: null,
        lastRejectedEvent: null,
      };
    }

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
  if ((state.status === 'staleDesign' || state.status === 'staleTestbench') && state.resultValidity !== 'stale') {
    problems.push('stale statuses require stale result validity');
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
  status: 'staleDesign' | 'staleTestbench',
  staleReason: VerifyStaleReason
): VerifyTruthState {
  return {
    ...state,
    status,
    resultValidity: 'stale',
    staleReason,
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
