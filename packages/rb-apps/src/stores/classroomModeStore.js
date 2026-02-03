// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Classroom-ready runtime flags and Safe Mode management
import { create } from 'zustand';
// Lazy-init singleton to prevent TDZ crash from circular imports
let _store = null;
function createClassroomModeStore() {
    return create((set, get) => ({
        safeMode: (() => {
            if (typeof window === 'undefined')
                return false;
            const param = new URLSearchParams(window.location.search).get('safe');
            if (param === '1')
                return true;
            if (param === '0')
                return false;
            return localStorage.getItem('rb_safe_mode') === '1';
        })(),
        setSafeMode: (enabled) => {
            localStorage.setItem('rb_safe_mode', enabled ? '1' : '0');
            set({ safeMode: enabled });
        },
        lastKnownGoodSnapshot: null,
        setSnapshot: (snapshot) => set({ lastKnownGoodSnapshot: snapshot }),
        nodeCount: 0,
        edgeCount: 0,
        maxFanOut: 0,
        isComplexityWarning: false,
        isComplexityBlocked: false,
        setComplexity: (nodeCount, edgeCount, maxFanOut) => {
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
        setStepOnlyMode: (enabled) => set({ isStepOnlyMode: enabled }),
        lastErrorCode: null,
        setLastErrorCode: (code) => set({ lastErrorCode: code }),
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
        recordTimeToFirstSim: (ms) => {
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
export const useClassroomModeStore = ((...args) => {
    if (!_store)
        _store = createClassroomModeStore();
    return _store(...args);
});
useClassroomModeStore.getState = () => {
    if (!_store)
        _store = createClassroomModeStore();
    return _store.getState();
};
useClassroomModeStore.setState = (...a) => {
    if (!_store)
        _store = createClassroomModeStore();
    return _store.setState(...a);
};
useClassroomModeStore.subscribe = (...a) => {
    if (!_store)
        _store = createClassroomModeStore();
    return _store.subscribe(...a);
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
export function isSafeMode() {
    return useClassroomModeStore.getState().safeMode;
}
// Helper to check if auto-degrade active
export function isStepOnlyMode() {
    return useClassroomModeStore.getState().isStepOnlyMode;
}
// E2E test hook: expose store for programmatic access (always, safe for E2E testing)
// Uses lazy-init wrapper so store is created on first access
if (typeof window !== 'undefined') {
    window.__RB_CLASSROOM_MODE_STORE__ = useClassroomModeStore;
}
