/**
 * Lab Session Store (Zustand)
 * Manages session lifecycle, autosave to localStorage, checkpoint tracking
 */

import { create } from 'zustand';
import {
  LabSessionState,
  ILabSession,
  CheckpointResult,
  createEmptySession,
  createCheckpointResult,
  generateSessionId,
} from './LabSession';

const STORAGE_PREFIX = 'redbyte.lab.session';

function getStorageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}.${sessionId}`;
}

interface LabSessionStore extends ILabSession {
  // Store methods
  _setState(state: LabSessionState): void;
}

/** Create lab session store with autosave */
export function createLabSessionStore() {
  return create<LabSessionStore>((set, get) => {
    // Auto-save on state changes (500ms debounce)
    let autosaveTimeout: NodeJS.Timeout | null = null;

    const scheduleAutosave = () => {
      if (autosaveTimeout) clearTimeout(autosaveTimeout);
      autosaveTimeout = setTimeout(() => {
        get().saveToLocalStorage();
      }, 500);
    };

    return {
      // Initial state
      state: createEmptySession(''),

      // Internal setState for all mutations
      _setState(newState: LabSessionState) {
        set({ state: newState });
        scheduleAutosave();
      },

      // === LIFECYCLE ===

      createSession(labId: string) {
        const newState = createEmptySession(labId);
        get()._setState(newState);
      },

      loadSession(sessionId: string): boolean {
        const loaded = get().loadFromLocalStorage(sessionId);
        return loaded;
      },

      clearSession() {
        const newState = createEmptySession('');
        get()._setState(newState);
        localStorage.removeItem(getStorageKey(get().state.sessionId));
      },

      // === CIRCUIT ===

      setCircuit(circuit: string) {
        const state = { ...get().state };
        state.currentCircuit = circuit;
        state.updatedAt = Date.now();
        get()._setState(state);
      },

      getCircuit(): string {
        return get().state.currentCircuit;
      },

      // === CHECKPOINT RESULTS ===

      setCheckpointResult(checkpointId: string, result: CheckpointResult) {
        const state = { ...get().state };
        state.checkpointResults[checkpointId] = result;
        state.updatedAt = Date.now();
        get()._setState(state);
        get().updateCheckpointSummary();
      },

      getCheckpointResult(checkpointId: string): CheckpointResult | undefined {
        return get().state.checkpointResults[checkpointId];
      },

      getAllCheckpointResults(): Record<string, CheckpointResult> {
        return { ...get().state.checkpointResults };
      },

      isCheckpointPassed(checkpointId: string): boolean {
        const result = get().getCheckpointResult(checkpointId);
        return result?.status === 'passed';
      },

      // === SUMMARY ===

      updateCheckpointSummary() {
        const state = get().state;
        const results = Object.values(state.checkpointResults);
        const passed = results.filter((r) => r.status === 'passed').length;
        state.passedCheckpoints = passed;
      },

      // === PERSISTENCE ===

      saveToLocalStorage() {
        const state = get().state;
        const key = getStorageKey(state.sessionId);
        try {
          localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {
          console.error(`Failed to save session ${state.sessionId} to localStorage:`, e);
        }
      },

      loadFromLocalStorage(sessionId: string): boolean {
        const key = getStorageKey(sessionId);
        try {
          const saved = localStorage.getItem(key);
          if (!saved) return false;

          const state = JSON.parse(saved) as LabSessionState;
          set({ state });
          return true;
        } catch (e) {
          console.error(`Failed to load session ${sessionId} from localStorage:`, e);
          return false;
        }
      },
    };
  });
}

export type LabSessionStoreType = ReturnType<typeof createLabSessionStore>;

/** Global session store instance (singleton per app) */
let globalSessionStore: LabSessionStoreType | null = null;

export function getGlobalLabSessionStore(): LabSessionStoreType {
  if (!globalSessionStore) {
    globalSessionStore = createLabSessionStore();
  }
  return globalSessionStore;
}

export function resetGlobalLabSessionStore() {
  globalSessionStore = null;
}
