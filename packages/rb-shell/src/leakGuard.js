// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Memory leak guard for RedByte OS.
 *
 * Tracks:
 * - Window open/close counts
 * - Registered cleanup callbacks per window
 * - Store subscription growth
 * - Event listener counts (sampled)
 *
 * On window close, runs all registered cleanups.
 * In dev mode, warns if metrics suggest a leak.
 */
import { logSystemEvent } from '@redbyte/rb-apps';
const windowCleanups = new Map();
const windowOpenTimes = new Map();
/**
 * Register a cleanup callback for a window.
 * Called automatically when that window closes via `runWindowCleanup()`.
 */
export function registerWindowCleanup(windowId, cleanup) {
    const list = windowCleanups.get(windowId) ?? [];
    list.push(cleanup);
    windowCleanups.set(windowId, list);
}
/**
 * Run all registered cleanups for a window and remove tracking.
 * Call this when a window closes.
 */
export function runWindowCleanup(windowId) {
    const cleanups = windowCleanups.get(windowId);
    if (cleanups) {
        for (const fn of cleanups) {
            try {
                fn();
            }
            catch (e) {
                logSystemEvent({
                    level: 'warning',
                    source: 'leak-guard',
                    message: `Cleanup error for window ${windowId}`,
                    data: { error: e instanceof Error ? e.message : String(e) },
                });
            }
        }
        windowCleanups.delete(windowId);
    }
    windowOpenTimes.delete(windowId);
}
/**
 * Track a window open event.
 */
export function trackWindowOpen(windowId) {
    windowOpenTimes.set(windowId, Date.now());
}
const snapshots = [];
const MAX_SNAPSHOTS = 20;
/**
 * Take a leak detection snapshot. Call periodically (e.g., every 60s).
 */
export function takeLeakSnapshot() {
    const snap = {
        windowCount: windowOpenTimes.size,
        cleanupRegistrations: Array.from(windowCleanups.values()).reduce((n, list) => n + list.length, 0),
        timestamp: Date.now(),
    };
    snapshots.push(snap);
    if (snapshots.length > MAX_SNAPSHOTS) {
        snapshots.shift();
    }
    return snap;
}
/**
 * Check for potential leaks by comparing snapshots.
 * Returns warnings if cleanup registrations grow without bounds.
 */
export function checkForLeaks() {
    const warnings = [];
    if (snapshots.length < 3)
        return warnings;
    const recent = snapshots.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    // If no windows are open but cleanups are registered → leak
    if (last.windowCount === 0 && last.cleanupRegistrations > 0) {
        warnings.push(`Orphaned cleanups: ${last.cleanupRegistrations} cleanup(s) registered with no open windows`);
    }
    // If cleanup registrations are growing faster than window count → likely leak
    if (last.cleanupRegistrations > first.cleanupRegistrations + 20 &&
        last.windowCount <= first.windowCount) {
        warnings.push(`Cleanup growth: ${first.cleanupRegistrations} → ${last.cleanupRegistrations} without window growth`);
    }
    return warnings;
}
/**
 * Get current leak guard stats (for Health Panel / diagnostics).
 */
export function getLeakGuardStats() {
    return {
        openWindows: windowOpenTimes.size,
        cleanupRegistrations: Array.from(windowCleanups.values()).reduce((n, list) => n + list.length, 0),
        trackedWindows: Array.from(windowOpenTimes.keys()),
    };
}
// ---------------------------------------------------------------------------
// Auto-check interval (dev only)
// ---------------------------------------------------------------------------
let leakCheckInterval = null;
/**
 * Start periodic leak checking (dev mode only).
 * Logs warnings to system log if leaks detected.
 */
export function startLeakMonitor(intervalMs = 60_000) {
    if (leakCheckInterval)
        return () => { };
    leakCheckInterval = setInterval(() => {
        takeLeakSnapshot();
        const warnings = checkForLeaks();
        for (const warning of warnings) {
            logSystemEvent({
                level: 'warning',
                severity: 'warn',
                source: 'leak-guard',
                message: warning,
            });
        }
    }, intervalMs);
    return () => {
        if (leakCheckInterval) {
            clearInterval(leakCheckInterval);
            leakCheckInterval = null;
        }
    };
}
