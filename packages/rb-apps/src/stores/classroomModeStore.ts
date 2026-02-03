// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Classroom-ready runtime flags and Safe Mode management

import { create } from 'zustand';

interface ClassroomModeState {
  // Safe Mode: disables expensive features for reliability
  safeMode: boolean;
  setSafeMode: (enabled: boolean) => void;

  // Crash/recovery snapshot
  lastKnownGoodSnapshot: { circuit?: unknown; layoutState?: unknown; timestamp?: number } | null;
  setSnapshot: (snapshot: { circuit?: unknown; layoutState?: unknown; timestamp?: number } | null) => void;

  // Node count for guardrails
  nodeCount: number;
  edgeCount: number;
  maxFanOut: number;
  setComplexity: (nodeCount: number, edgeCount: number, maxFanOut: number) => void;

  // Complexity thresholds
  isComplexityWarning: boolean; // >=15 nodes
  isComplexityBlocked: boolean; // >=20 nodes

  // Auto-degrade state
  isStepOnlyMode: boolean;
  setStepOnlyMode: (enabled: boolean) => void;

  // Error state for recovery banner
  lastErrorCode: string | null;
  setLastErrorCode: (code: string | null) => void;

  // Metrics for classroom tracking (non-invasive)
  metrics: {
    resetCount: number;
    saveCount: number;
    loadCount: number;
    nodeCountWarningTriggered: boolean;
    timeToFirstSim: number | null;
  };
  recordReset: () => void;
  recordSave: () => void;
  recordLoad: () => void;
  recordNodeCountWarning: () => void;
  recordTimeToFirstSim: (ms: number) => void;
}

// Lazy-init singleton to prevent TDZ crash from circular imports
let _store: ReturnType<typeof createClassroomModeStore> | null = null;

function createClassroomModeStore() {
  return create<ClassroomModeState>((set, get) => ({
    safeMode: (() => {
      if (typeof window === 'undefined') return false;
      const param = new URLSearchParams(window.location.search).get('safe');
      if (param === '1') return true;
      if (param === '0') return false;
      return localStorage.getItem('rb_safe_mode') === '1';
    })(),

    setSafeMode: (enabled: boolean) => {
      localStorage.setItem('rb_safe_mode', enabled ? '1' : '0');
      set({ safeMode: enabled });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rb:safe-mode', { detail: { enabled } }));
      }
    },

    lastKnownGoodSnapshot: null,
    setSnapshot: (snapshot) => set({ lastKnownGoodSnapshot: snapshot }),

    nodeCount: 0,
    edgeCount: 0,
    maxFanOut: 0,
    isComplexityWarning: false,
    isComplexityBlocked: false,

    setComplexity: (nodeCount: number, edgeCount: number, maxFanOut: number) => {
      const isWarning = nodeCount >= 15;
      const isBlocked = nodeCount >= 20;
      const exceeds = nodeCount > 20; // Can happen via undo/redo or old saved circuits

      set({
        nodeCount,
        edgeCount,
        maxFanOut,
        isComplexityWarning: isWarning,
        isComplexityBlocked: isBlocked,
      });

      // Auto-degrade: force Safe Mode + Step-only when workspace exceeds hard limit
      // (happens when undoing into old state or loading pre-guardrail saves)
      if (exceeds) {
        const currentState = get();

        if (!currentState.safeMode || !currentState.isStepOnlyMode) {
          console.warn(`[ClassroomMode] Auto-degrading: workspace has ${nodeCount} nodes (limit: 20)`);

          set({
            safeMode: true,
            isStepOnlyMode: true,
          });

          // Persist Safe Mode so it stays on across page reloads
          localStorage.setItem('rb_safe_mode', '1');
        }
      }

      // Auto-enable step-only mode at warning threshold
      if (isWarning && !get().isStepOnlyMode) {
        set({ isStepOnlyMode: true });
        if (!get().metrics.nodeCountWarningTriggered) {
          get().recordNodeCountWarning();
        }
      }
    },

    isStepOnlyMode: false,
    setStepOnlyMode: (enabled: boolean) => set({ isStepOnlyMode: enabled }),

    lastErrorCode: null,
    setLastErrorCode: (code: string | null) => set({ lastErrorCode: code }),

    metrics: {
      resetCount: 0,
      saveCount: 0,
      loadCount: 0,
      nodeCountWarningTriggered: false,
      timeToFirstSim: null,
    },

    recordReset: () => {
      set((state) => ({
        metrics: { ...state.metrics, resetCount: state.metrics.resetCount + 1 },
      }));
    },

    recordSave: () => {
      set((state) => ({
        metrics: { ...state.metrics, saveCount: state.metrics.saveCount + 1 },
      }));
    },

    recordLoad: () => {
      set((state) => ({
        metrics: { ...state.metrics, loadCount: state.metrics.loadCount + 1 },
      }));
    },

    recordNodeCountWarning: () => {
      set((state) => ({
        metrics: { ...state.metrics, nodeCountWarningTriggered: true },
      }));
    },

    recordTimeToFirstSim: (ms: number) => {
      set((state) => ({
        metrics: { ...state.metrics, timeToFirstSim: ms },
      }));
    },
  }));
}

/**
 * Classroom mode store for runtime flags and Safe Mode management.
 * Lazy-initialized to prevent TDZ crash from circular imports.
 */
export const useClassroomModeStore: ReturnType<typeof createClassroomModeStore> = ((...args: any[]) => {
  if (!_store) _store = createClassroomModeStore();
  return (_store as any)(...args);
}) as any;

(useClassroomModeStore as any).getState = () => {
  if (!_store) _store = createClassroomModeStore();
  return (_store as any).getState();
};

(useClassroomModeStore as any).setState = (...a: any[]) => {
  if (!_store) _store = createClassroomModeStore();
  return (_store as any).setState(...a);
};

(useClassroomModeStore as any).subscribe = (...a: any[]) => {
  if (!_store) _store = createClassroomModeStore();
  return (_store as any).subscribe(...a);
};

// Expose metrics to window for classroom tracking (non-invasive)
// Uses lazy-init to ensure store is created first
if (typeof window !== 'undefined') {
  Object.defineProperty(window, '__RB_CLASSROOM_METRICS__', {
    get: () => useClassroomModeStore.getState().metrics,
    configurable: true,
  });
}

// Helper to check safe mode
export function isSafeMode(): boolean {
  return useClassroomModeStore.getState().safeMode;
}

// Helper to check if auto-degrade active
export function isStepOnlyMode(): boolean {
  return useClassroomModeStore.getState().isStepOnlyMode;
}

// E2E test hook: expose store for programmatic access (always, safe for E2E testing)
// Uses lazy-init wrapper so store is created on first access
if (typeof window !== 'undefined') {
  (window as any).__RB_CLASSROOM_MODE_STORE__ = useClassroomModeStore;
}
