export type FirstRunStepId =
  | 'bridge_check'
  | 'board_detect'
  | 'programmer_check'
  | 'known_good_program'
  | 'sample_capture'
  | 'doctor_export'
  | 'done';

export type FirstRunStepStatus = 'pending' | 'running' | 'pass' | 'fail';

export interface FirstRunStepState {
  status: FirstRunStepStatus;
  errorCode?: string;
  logs: string[];
}

export interface FirstRunState {
  schemaVersion: 'rb_first_run_v1';
  completedAt: string | null;
  lastFailureCode: string | null;
  lastStep: FirstRunStepId;
  lastRunId: string | null;
  steps: Record<FirstRunStepId, FirstRunStepState>;
}

export const FIRST_RUN_STATE_KEY = 'rb:first-run:v1';
export const FIRST_RUN_KNOWN_GOOD_BITSTREAM_KEY = 'rb:first-run:known-good-bitstream:b64';

const MAX_STEP_LOGS = 40;

const STEP_IDS: FirstRunStepId[] = [
  'bridge_check',
  'board_detect',
  'programmer_check',
  'known_good_program',
  'sample_capture',
  'doctor_export',
  'done',
];

function createStepState(): FirstRunStepState {
  return {
    status: 'pending',
    logs: [],
  };
}

export function createInitialFirstRunState(): FirstRunState {
  return {
    schemaVersion: 'rb_first_run_v1',
    completedAt: null,
    lastFailureCode: null,
    lastStep: 'bridge_check',
    lastRunId: null,
    steps: {
      bridge_check: createStepState(),
      board_detect: createStepState(),
      programmer_check: createStepState(),
      known_good_program: createStepState(),
      sample_capture: createStepState(),
      doctor_export: createStepState(),
      done: createStepState(),
    },
  };
}

export function loadFirstRunState(): FirstRunState {
  try {
    const raw = localStorage.getItem(FIRST_RUN_STATE_KEY);
    if (!raw) return createInitialFirstRunState();
    const parsed = JSON.parse(raw) as Partial<FirstRunState>;
    if (parsed?.schemaVersion !== 'rb_first_run_v1') return createInitialFirstRunState();
    const fallback = createInitialFirstRunState();
    const merged: FirstRunState = {
      ...fallback,
      ...parsed,
      steps: {
        ...fallback.steps,
        ...(parsed.steps ?? {}),
      },
      lastStep: STEP_IDS.includes(parsed.lastStep as FirstRunStepId)
        ? (parsed.lastStep as FirstRunStepId)
        : 'bridge_check',
    };
    for (const stepId of STEP_IDS) {
      const step = merged.steps[stepId];
      const status = step?.status;
      merged.steps[stepId] = {
        status: status === 'pending' || status === 'running' || status === 'pass' || status === 'fail' ? status : 'pending',
        errorCode: typeof step?.errorCode === 'string' ? step.errorCode : undefined,
        logs: Array.isArray(step?.logs) ? step.logs.map((entry) => String(entry)).slice(-MAX_STEP_LOGS) : [],
      };
    }
    return merged;
  } catch {
    return createInitialFirstRunState();
  }
}

export function saveFirstRunState(state: FirstRunState): void {
  try {
    localStorage.setItem(FIRST_RUN_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function appendStepLog(state: FirstRunState, stepId: FirstRunStepId, message: string): FirstRunState {
  const nextLogs = [...state.steps[stepId].logs, message].slice(-MAX_STEP_LOGS);
  return {
    ...state,
    steps: {
      ...state.steps,
      [stepId]: {
        ...state.steps[stepId],
        logs: nextLogs,
      },
    },
  };
}

export function markStepRunning(state: FirstRunState, stepId: FirstRunStepId): FirstRunState {
  return {
    ...state,
    lastStep: stepId,
    steps: {
      ...state.steps,
      [stepId]: {
        ...state.steps[stepId],
        status: 'running',
        errorCode: undefined,
      },
    },
  };
}

export function markStepPass(state: FirstRunState, stepId: FirstRunStepId): FirstRunState {
  return {
    ...state,
    lastFailureCode: null,
    steps: {
      ...state.steps,
      [stepId]: {
        ...state.steps[stepId],
        status: 'pass',
        errorCode: undefined,
      },
    },
  };
}

export function markStepFail(state: FirstRunState, stepId: FirstRunStepId, errorCode: string): FirstRunState {
  return {
    ...state,
    lastFailureCode: errorCode,
    lastStep: stepId,
    steps: {
      ...state.steps,
      [stepId]: {
        ...state.steps[stepId],
        status: 'fail',
        errorCode,
      },
    },
  };
}

export function markWizardComplete(state: FirstRunState): FirstRunState {
  const nowIso = new Date().toISOString();
  return {
    ...state,
    completedAt: nowIso,
    lastFailureCode: null,
    lastStep: 'done',
    steps: {
      ...state.steps,
      done: {
        ...state.steps.done,
        status: 'pass',
      },
    },
  };
}

export function isWizardComplete(state: FirstRunState): boolean {
  return typeof state.completedAt === 'string' && state.completedAt.length > 0;
}

function envFlagEnabled(name: string): boolean {
  try {
    const processEnv = (process as { env?: Record<string, string | undefined> }).env;
    if (processEnv?.[name] === '1') return true;
  } catch {
    // ignore
  }
  try {
    const importMetaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
    if (importMetaEnv?.[`VITE_${name}`] === '1') return true;
  } catch {
    // ignore
  }
  return false;
}

export function shouldBypassWizardGate(): boolean {
  if (envFlagEnabled('RB_DEV_BYPASS_WIZARD')) return true;
  try {
    const search = new URLSearchParams(window.location.search);
    return search.get('allow') === '1';
  } catch {
    return false;
  }
}

export function shouldGateStudioEntry(state: FirstRunState): boolean {
  if (shouldBypassWizardGate()) return false;
  return !isWizardComplete(state);
}

export function resolveFirstRunTargetApp(appId: string, state: FirstRunState): string {
  if (appId !== 'home' && appId !== 'lab-workspace') return appId;
  return shouldGateStudioEntry(state) ? 'first-run-wizard' : appId;
}
