/** Workspace preferences, scoped to one project and one scenario. Never run evidence. */
export interface ScenarioViewState {
  selectedTick: number | null;
  selectedSignal: string | null;
  cursorA: number | null;
  cursorB: number | null;
  authoredRepresentation: 'timeline' | 'table' | null;
  studioMode: 'scenario' | 'bench' | 'replay' | 'checks' | 'testbench';
}

export interface ScenarioViewScope { projectId: string; scenarioId: string }
export interface ScenarioViewStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function scenarioViewStorageKey(scope: ScenarioViewScope): string {
  // JSON encodes the pair without delimiter collisions or confusing a repeated scenario id
  // in another project with the previous project's experiment.
  return `rb.simulate.scenario-view.v1:${JSON.stringify([scope.projectId, scope.scenarioId])}`;
}

export function defaultScenarioViewState(): ScenarioViewState {
  return {
    selectedTick: null, selectedSignal: null, cursorA: null, cursorB: null,
    authoredRepresentation: null, studioMode: 'scenario',
  };
}

export function normalizeScenarioViewState(value: unknown): ScenarioViewState {
  const result = defaultScenarioViewState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  for (const field of ['selectedTick', 'cursorA', 'cursorB'] as const) {
    const tick = input[field];
    if (typeof tick === 'number' && Number.isFinite(tick) && tick >= 0 && Number.isInteger(tick)) {
      result[field] = tick;
    }
  }
  if (typeof input.selectedSignal === 'string' && input.selectedSignal.length > 0) {
    result.selectedSignal = input.selectedSignal;
  }
  if (input.authoredRepresentation === 'timeline' || input.authoredRepresentation === 'table') {
    result.authoredRepresentation = input.authoredRepresentation;
  }
  if (['scenario', 'bench', 'replay', 'checks', 'testbench'].includes(String(input.studioMode))) {
    result.studioMode = input.studioMode as ScenarioViewState['studioMode'];
  }
  return result;
}

export function readScenarioViewState(storage: ScenarioViewStorage | null, key: string | null): ScenarioViewState {
  if (!storage || !key) return defaultScenarioViewState();
  try {
    const raw = storage.getItem(key);
    return raw ? normalizeScenarioViewState(JSON.parse(raw)) : defaultScenarioViewState();
  } catch { return defaultScenarioViewState(); }
}

export function writeScenarioViewState(
  storage: ScenarioViewStorage | null, key: string | null, state: ScenarioViewState,
): void {
  if (!storage || !key) return;
  try { storage.setItem(key, JSON.stringify(normalizeScenarioViewState(state))); }
  catch { /* Preferences must not block the experiment when browser storage is unavailable. */ }
}
