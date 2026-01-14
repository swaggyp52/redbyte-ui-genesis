// Copyright © 2025 Connor Angiel — RedByte OS Genesis
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
  setNodeCount: (count: number) => void;

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

export const useClassroomModeStore = create<ClassroomModeState>((set, get) => ({
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
  },

  lastKnownGoodSnapshot: null,
  setSnapshot: (snapshot) => set({ lastKnownGoodSnapshot: snapshot }),

  nodeCount: 0,
  setNodeCount: (count: number) => set({ nodeCount: count }),

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

// Expose metrics to window for classroom tracking (non-invasive)
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
