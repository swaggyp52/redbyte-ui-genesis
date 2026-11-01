import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import {
  readScenarioViewState, scenarioViewStorageKey, writeScenarioViewState,
  type ScenarioViewScope, type ScenarioViewState, type ScenarioViewStorage,
} from './scenarioViewState';

function sessionPreferences(): ScenarioViewStorage | null {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null; }
  catch { return null; }
}

/** A switch reads the new scope in the same render. No restore/save effect can copy A into B. */
export function useScenarioViewState(scope: ScenarioViewScope | null) {
  const storage = useMemo(sessionPreferences, []);
  const key = scope ? scenarioViewStorageKey(scope) : null;
  const cacheKey = key ?? 'unscoped-component';
  const restored = useMemo(() => readScenarioViewState(storage, key), [storage, key]);
  const [states, setStates] = useState<Record<string, ScenarioViewState>>({});
  const state = states[cacheKey] ?? restored;

  const setField = useCallback(<K extends keyof ScenarioViewState>(
    field: K, update: SetStateAction<ScenarioViewState[K]>,
  ) => {
    setStates((previous) => {
      const current = previous[cacheKey] ?? restored;
      const value = typeof update === 'function'
        ? (update as (value: ScenarioViewState[K]) => ScenarioViewState[K])(current[field])
        : update;
      if (Object.is(current[field], value)) return previous;
      return { ...previous, [cacheKey]: { ...current, [field]: value } };
    });
  }, [cacheKey, restored]);

  useEffect(() => {
    for (const [savedKey, value] of Object.entries(states)) {
      if (savedKey !== 'unscoped-component') writeScenarioViewState(storage, savedKey, value);
    }
  }, [storage, states]);

  const setters = useMemo(() => ({
    setSelectedTick: (value: SetStateAction<ScenarioViewState['selectedTick']>) => setField('selectedTick', value),
    setSelectedSignal: (value: SetStateAction<ScenarioViewState['selectedSignal']>) => setField('selectedSignal', value),
    setCursorA: (value: SetStateAction<ScenarioViewState['cursorA']>) => setField('cursorA', value),
    setCursorB: (value: SetStateAction<ScenarioViewState['cursorB']>) => setField('cursorB', value),
    setAuthoredRepresentation: (value: SetStateAction<ScenarioViewState['authoredRepresentation']>) => setField('authoredRepresentation', value),
    setStudioMode: (value: SetStateAction<ScenarioViewState['studioMode']>) => setField('studioMode', value),
  }), [setField]);
  return { state, setField, ...setters };
}
