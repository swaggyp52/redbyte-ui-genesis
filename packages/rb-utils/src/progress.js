/**
 * Progress reporting system for long-running operations
 * Provides student-friendly progress tracking with "Copy details" affordance on failures
 */
const MAX_HISTORY = 50;
/**
 * Creates a bounded event bus for progress events
 */
export function createProgressBus() {
    const history = [];
    const listeners = new Set();
    return {
        emit(event) {
            // Add to bounded ring buffer
            history.push(event);
            if (history.length > MAX_HISTORY) {
                history.shift();
            }
            // Notify subscribers
            listeners.forEach((listener) => {
                try {
                    listener(event);
                }
                catch (err) {
                    console.error('[ProgressBus] Listener error:', err);
                }
            });
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getSnapshot() {
            return [...history];
        },
    };
}
// Module-local singleton for v1.0 convenience
export const progressBus = createProgressBus();
/**
 * Start a long-running operation
 */
export function progressStart(actionId, message, meta) {
    progressBus.emit({
        ts: Date.now(),
        actionId,
        type: 'start',
        message,
        meta,
    });
}
/**
 * Update progress for an operation
 */
export function progressUpdate(actionId, progress, message, meta) {
    progressBus.emit({
        ts: Date.now(),
        actionId,
        type: 'update',
        message: message || '',
        progress,
        meta,
    });
}
/**
 * Mark an operation as successfully completed
 */
export function progressSucceed(actionId, message, meta) {
    progressBus.emit({
        ts: Date.now(),
        actionId,
        type: 'succeed',
        message: message || 'Complete',
        meta,
    });
}
/**
 * Mark an operation as failed with student-friendly error
 */
export function progressFail(actionId, failPayload, meta) {
    progressBus.emit({
        ts: Date.now(),
        actionId,
        type: 'fail',
        message: failPayload.studentMessage,
        failPayload,
        meta,
    });
}
