// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { create } from 'zustand';
const DEFAULT_WINDOW_STATE = {
    status: 'clean',
    lastSavedAt: null,
    lastDirtyAt: null,
};
export const usePersistenceStore = create((set, get) => ({
    windows: {},
    markDirty: (windowId) => {
        set((state) => ({
            windows: {
                ...state.windows,
                [windowId]: {
                    ...(state.windows[windowId] ?? DEFAULT_WINDOW_STATE),
                    status: 'dirty',
                    lastDirtyAt: Date.now(),
                },
            },
        }));
    },
    markSaving: (windowId) => {
        set((state) => ({
            windows: {
                ...state.windows,
                [windowId]: {
                    ...(state.windows[windowId] ?? DEFAULT_WINDOW_STATE),
                    status: 'saving',
                },
            },
        }));
    },
    markClean: (windowId) => {
        set((state) => ({
            windows: {
                ...state.windows,
                [windowId]: {
                    ...(state.windows[windowId] ?? DEFAULT_WINDOW_STATE),
                    status: 'clean',
                    lastSavedAt: Date.now(),
                },
            },
        }));
    },
    markError: (windowId) => {
        set((state) => ({
            windows: {
                ...state.windows,
                [windowId]: {
                    ...(state.windows[windowId] ?? DEFAULT_WINDOW_STATE),
                    status: 'error',
                },
            },
        }));
    },
    removeWindow: (windowId) => {
        set((state) => {
            const { [windowId]: _, ...rest } = state.windows;
            return { windows: rest };
        });
    },
    getStatus: (windowId) => {
        return get().windows[windowId]?.status ?? 'clean';
    },
}));
/**
 * Autosave scheduler. Call `scheduleAutosave(windowId, saveFn)` when state changes.
 * Debounces to 2s, also fires on blur and beforeunload.
 */
const autosaveTimers = new Map();
const autosaveFns = new Map();
const AUTOSAVE_DEBOUNCE_MS = 2000;
/** Data snapshots registered by apps for journal writes. */
const autosaveSnapshots = new Map();
/**
 * Register a data snapshot function for journal writes.
 * Called before save to capture current state for crash recovery.
 */
export function registerSnapshot(windowId, snapshotFn) {
    autosaveSnapshots.set(windowId, snapshotFn);
}
async function runAutosave(windowId) {
    const fn = autosaveFns.get(windowId);
    if (!fn)
        return;
    const store = usePersistenceStore.getState();
    if (store.getStatus(windowId) !== 'dirty')
        return;
    // Write journal BEFORE save — survives tab kill
    const snapshotFn = autosaveSnapshots.get(windowId);
    if (snapshotFn) {
        try {
            writeJournal(windowId, snapshotFn());
        }
        catch {
            // Journal write failed — continue with save anyway
        }
    }
    store.markSaving(windowId);
    try {
        await fn();
        // Save succeeded — promote journal to .good
        promoteJournal(windowId);
        usePersistenceStore.getState().markClean(windowId);
    }
    catch {
        usePersistenceStore.getState().markError(windowId);
    }
}
export function scheduleAutosave(windowId, saveFn) {
    autosaveFns.set(windowId, saveFn);
    usePersistenceStore.getState().markDirty(windowId);
    const existing = autosaveTimers.get(windowId);
    if (existing)
        clearTimeout(existing);
    autosaveTimers.set(windowId, setTimeout(() => {
        autosaveTimers.delete(windowId);
        runAutosave(windowId);
    }, AUTOSAVE_DEBOUNCE_MS));
}
export function unregisterAutosave(windowId) {
    const existing = autosaveTimers.get(windowId);
    if (existing)
        clearTimeout(existing);
    autosaveTimers.delete(windowId);
    autosaveFns.delete(windowId);
    autosaveSnapshots.delete(windowId);
}
// Flush all dirty windows on blur / beforeunload
if (typeof window !== 'undefined') {
    const flushAll = () => {
        for (const [windowId] of autosaveFns) {
            const status = usePersistenceStore.getState().getStatus(windowId);
            if (status === 'dirty') {
                runAutosave(windowId);
            }
        }
    };
    window.addEventListener('blur', flushAll);
    window.addEventListener('beforeunload', flushAll);
}
// ---------------------------------------------------------------------------
// Recovery Journal
//
// Before each save, we write a journal entry to localStorage:
//   rb:autosave:<id>.tmp    — written BEFORE the save completes
//   rb:autosave:<id>.good   — promoted AFTER a successful save
//
// On next load, if `.tmp` exists and is newer than `.good`, the save was
// interrupted and we can offer recovery.
// ---------------------------------------------------------------------------
const JOURNAL_PREFIX = 'rb:autosave:';
/**
 * Write a pre-save journal entry. Call this BEFORE the actual save.
 * If the tab is killed mid-save, this entry survives for recovery.
 */
export function writeJournal(windowId, data, appId) {
    if (typeof localStorage === 'undefined')
        return;
    const entry = {
        windowId,
        appId,
        timestamp: Date.now(),
        data,
    };
    try {
        localStorage.setItem(`${JOURNAL_PREFIX}${windowId}.tmp`, JSON.stringify(entry));
    }
    catch {
        // Storage full or unavailable — best effort
    }
}
/**
 * Promote the journal entry to "last known good" after a successful save.
 * Removes the .tmp entry.
 */
export function promoteJournal(windowId) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        const tmp = localStorage.getItem(`${JOURNAL_PREFIX}${windowId}.tmp`);
        if (tmp) {
            localStorage.setItem(`${JOURNAL_PREFIX}${windowId}.good`, tmp);
            localStorage.removeItem(`${JOURNAL_PREFIX}${windowId}.tmp`);
        }
    }
    catch {
        // best effort
    }
}
/**
 * Clear all journal entries for a window (on explicit close / discard).
 */
export function clearJournal(windowId) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.removeItem(`${JOURNAL_PREFIX}${windowId}.tmp`);
        localStorage.removeItem(`${JOURNAL_PREFIX}${windowId}.good`);
    }
    catch {
        // best effort
    }
}
/**
 * Check localStorage for recoverable autosave entries.
 * Returns entries where a .tmp exists that is newer than .good (or .good is missing).
 */
export function checkForRecovery() {
    if (typeof localStorage === 'undefined')
        return [];
    const results = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(JOURNAL_PREFIX) || !key.endsWith('.tmp'))
                continue;
            const windowId = key.slice(JOURNAL_PREFIX.length, -4); // strip prefix + '.tmp'
            const tmpRaw = localStorage.getItem(key);
            if (!tmpRaw)
                continue;
            let tmpEntry;
            try {
                tmpEntry = JSON.parse(tmpRaw);
            }
            catch {
                continue;
            }
            const goodRaw = localStorage.getItem(`${JOURNAL_PREFIX}${windowId}.good`);
            if (goodRaw) {
                try {
                    const goodEntry = JSON.parse(goodRaw);
                    if (tmpEntry.timestamp > goodEntry.timestamp) {
                        results.push({ ...tmpEntry, reason: 'interrupted' });
                    }
                    // If good is newer or equal, .tmp is stale — skip
                }
                catch {
                    // Corrupt .good — treat .tmp as recoverable
                    results.push({ ...tmpEntry, reason: 'orphaned' });
                }
            }
            else {
                // No .good at all — save never completed
                results.push({ ...tmpEntry, reason: 'orphaned' });
            }
        }
    }
    catch {
        // best effort
    }
    return results;
}
/**
 * Accept a recovery: promote the .tmp to .good and return the data.
 */
export function acceptRecovery(windowId) {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        const tmpRaw = localStorage.getItem(`${JOURNAL_PREFIX}${windowId}.tmp`);
        if (!tmpRaw)
            return null;
        const entry = JSON.parse(tmpRaw);
        // Promote so it becomes the new .good baseline
        promoteJournal(windowId);
        return entry.data;
    }
    catch {
        return null;
    }
}
/**
 * Discard a recovery: remove the stale .tmp entry.
 */
export function discardRecovery(windowId) {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.removeItem(`${JOURNAL_PREFIX}${windowId}.tmp`);
    }
    catch {
        // best effort
    }
}
