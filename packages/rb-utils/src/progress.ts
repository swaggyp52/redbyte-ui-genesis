/**
 * Progress reporting system for long-running operations
 * Provides student-friendly progress tracking with "Copy details" affordance on failures
 */

export type RbProgressEventType = 'start' | 'update' | 'succeed' | 'fail';

export interface RbProgressFailPayload {
  code: string;
  studentMessage: string;
  details?: string | object;
}

export interface RbProgressEvent {
  ts: number;
  actionId: string;
  type: RbProgressEventType;
  message: string;
  progress?: number; // 0..1 for update events
  failPayload?: RbProgressFailPayload;
  meta?: Record<string, unknown>;
}

export interface RbProgressBus {
  emit: (event: RbProgressEvent) => void;
  subscribe: (listener: (event: RbProgressEvent) => void) => () => void;
  getSnapshot: () => RbProgressEvent[];
}

const MAX_HISTORY = 50;

/**
 * Creates a bounded event bus for progress events
 */
export function createProgressBus(): RbProgressBus {
  const history: RbProgressEvent[] = [];
  const listeners: Set<(event: RbProgressEvent) => void> = new Set();

  return {
    emit(event: RbProgressEvent) {
      // Add to bounded ring buffer
      history.push(event);
      if (history.length > MAX_HISTORY) {
        history.shift();
      }

      // Notify subscribers
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error('[ProgressBus] Listener error:', err);
        }
      });
    },

    subscribe(listener: (event: RbProgressEvent) => void) {
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
export function progressStart(
  actionId: string,
  message: string,
  meta?: Record<string, unknown>
): void {
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
export function progressUpdate(
  actionId: string,
  progress?: number,
  message?: string,
  meta?: Record<string, unknown>
): void {
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
export function progressSucceed(
  actionId: string,
  message?: string,
  meta?: Record<string, unknown>
): void {
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
export function progressFail(
  actionId: string,
  failPayload: RbProgressFailPayload,
  meta?: Record<string, unknown>
): void {
  progressBus.emit({
    ts: Date.now(),
    actionId,
    type: 'fail',
    message: failPayload.studentMessage,
    failPayload,
    meta,
  });
}
