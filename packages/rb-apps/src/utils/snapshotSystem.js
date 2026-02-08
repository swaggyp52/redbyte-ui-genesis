// Copyright (c) 2025 Connor Angiel - RedByte OS Genesis
// Workspace snapshot persistence for crash recovery
const SNAPSHOT_KEYS = {
    LATEST: 'rb_workspace_latest',
    PREVIOUS: 'rb_workspace_previous',
    LAST_CLEAN_SHUTDOWN: 'rb_last_clean_shutdown',
    ERROR_BOUNDARY_HIT: 'rb_error_boundary_hit',
    WATCHDOG_MARKER: 'rb_watchdog_marker',
};
let debounceTimer = null;
const AUTOSAVE_DEBOUNCE_MS = 5000;
/**
 * Save workspace snapshot (debounced for autosaves)
 */
export function saveSnapshot(circuit, layout, flags, reason, immediate = false, project) {
    const projectId = project &&
        typeof project === 'object' &&
        typeof project.meta === 'object' &&
        typeof project.meta?.projectId === 'string' &&
        String(project.meta.projectId).trim().length > 0
        ? String(project.meta.projectId).trim()
        : null;
    const snapshot = {
        schemaVersion: 1,
        timestamp: Date.now(),
        reason,
        // Stabilization invariant: snapshot system persists workspace/layout recovery only.
        // Circuit/project payloads are handled via RBProject autosave (rb:autosave:<projectId>).
        payload: {
            layout,
            flags,
            projectRef: projectId ? { kind: 'rbproj', projectId } : undefined,
        },
    };
    const save = () => {
        try {
            // Move latest -> previous
            const latest = localStorage.getItem(SNAPSHOT_KEYS.LATEST);
            if (latest) {
                localStorage.setItem(SNAPSHOT_KEYS.PREVIOUS, latest);
            }
            // Save new latest
            localStorage.setItem(SNAPSHOT_KEYS.LATEST, JSON.stringify(snapshot));
        }
        catch (err) {
            // Check if this is a quota exceeded error
            const isQuotaError = err instanceof DOMException &&
                (err.name === 'QuotaExceededError' || err.code === 22);
            if (isQuotaError) {
                console.error('[Snapshot] Storage quota exceeded! Your work may not be saved.');
                // Dispatch event that UI can listen for
                window.dispatchEvent(new CustomEvent('rb:storage-error', {
                    detail: {
                        type: 'quota-exceeded',
                        message: 'Browser storage is full. Please export your work to avoid data loss.',
                    },
                }));
            }
            else {
                console.warn('[Snapshot] Failed to save:', err);
            }
        }
    };
    if (immediate || reason !== 'autosave') {
        // Immediate save for reset/unload
        if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
        save();
    }
    else {
        // Debounced autosave (short interval for lab reliability)
        if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = window.setTimeout(() => {
            save();
            debounceTimer = null;
        }, AUTOSAVE_DEBOUNCE_MS);
    }
}
/**
 * Load latest workspace snapshot
 */
export function loadSnapshot() {
    try {
        const raw = localStorage.getItem(SNAPSHOT_KEYS.LATEST);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch (err) {
        console.warn('[Snapshot] Failed to load latest:', err);
        return null;
    }
}
/**
 * Load previous workspace snapshot (one rollback)
 */
export function loadPreviousSnapshot() {
    try {
        const raw = localStorage.getItem(SNAPSHOT_KEYS.PREVIOUS);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch (err) {
        console.warn('[Snapshot] Failed to load previous:', err);
        return null;
    }
}
/**
 * Mark clean shutdown (call only in pagehide if no fatal markers)
 */
export function markCleanShutdown() {
    if (hasFatalMarkers())
        return; // Don't mark clean if crash markers exist
    localStorage.setItem(SNAPSHOT_KEYS.LAST_CLEAN_SHUTDOWN, 'true');
}
/**
 * Mark boot start (immediately sets lastCleanShutdown=false to detect crashes)
 */
export function markBootStart() {
    localStorage.setItem(SNAPSHOT_KEYS.LAST_CLEAN_SHUTDOWN, 'false');
}
/**
 * Check if last shutdown was clean
 */
export function wasLastShutdownClean() {
    return localStorage.getItem(SNAPSHOT_KEYS.LAST_CLEAN_SHUTDOWN) === 'true';
}
/**
 * Check for fatal markers (error boundary, watchdog)
 */
export function hasFatalMarkers() {
    return (localStorage.getItem(SNAPSHOT_KEYS.ERROR_BOUNDARY_HIT) === 'true' ||
        localStorage.getItem(SNAPSHOT_KEYS.WATCHDOG_MARKER) === 'true');
}
/**
 * Set error boundary marker (called from error boundary)
 */
export function setErrorBoundaryMarker() {
    localStorage.setItem(SNAPSHOT_KEYS.ERROR_BOUNDARY_HIT, 'true');
}
/**
 * Clear all fatal markers
 */
export function clearFatalMarkers() {
    localStorage.removeItem(SNAPSHOT_KEYS.ERROR_BOUNDARY_HIT);
    localStorage.removeItem(SNAPSHOT_KEYS.WATCHDOG_MARKER);
}
/**
 * Clear all snapshots (used by Reset Workspace)
 */
export function clearAllSnapshots() {
    localStorage.removeItem(SNAPSHOT_KEYS.LATEST);
    localStorage.removeItem(SNAPSHOT_KEYS.PREVIOUS);
}
/**
 * Initialize snapshot system on boot
 * - Marks boot start (lastCleanShutdown=false)
 * - Sets up pagehide handler
 */
export function initSnapshotSystem(getWorkspaceData) {
    // Mark boot start immediately
    markBootStart();
    // Setup pagehide handler for clean shutdown
    if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
            const data = getWorkspaceData();
            saveSnapshot(data.circuit, data.layout, data.flags, 'unload', true, data.project);
            markCleanShutdown();
        });
    }
}
