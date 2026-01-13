/**
 * Store Instrumentation for React #185 Detection
 * 
 * This module provides dev-only instrumentation for detecting store selector churn
 * that can lead to React #185 "Maximum update depth exceeded" errors.
 * 
 * Exposed via window.__RB_DEBUG__ in DEV mode only.
 */

interface DebugMetrics {
  storeSubscriberCount: number;
  stateWritesPerSecond: number;
  repeatedWrites: number;
  selectorSnapshotChurn: number;
  lastReportTime: number;
}

const metrics: DebugMetrics = {
  storeSubscriberCount: 0,
  stateWritesPerSecond: 0,
  repeatedWrites: 0,
  selectorSnapshotChurn: 0,
  lastReportTime: Date.now(),
};

let writeCount = 0;
let writeCountWindow: number[] = [];
let lastWriteValue: any = Symbol('initial');
let selectorChurnCount = 0;

/**
 * Track a store write (call from zustand setState)
 * Used to detect runaway loops where same state written repeatedly
 */
export function trackStoreWrite(value: any) {
  writeCount++;
  writeCountWindow.push(Date.now());
  
  // Keep only writes from last second
  const now = Date.now();
  writeCountWindow = writeCountWindow.filter(t => now - t < 1000);
  
  // Detect repeated identical writes
  if (lastWriteValue !== undefined && JSON.stringify(lastWriteValue) === JSON.stringify(value)) {
    selectorChurnCount++;
  }
  lastWriteValue = value;
  
  metrics.stateWritesPerSecond = writeCountWindow.length;
  metrics.repeatedWrites = selectorChurnCount;
  metrics.lastReportTime = now;
}

/**
 * Track snapshot reference changes (selector returning new object)
 */
export function trackSelectorChurn() {
  selectorChurnCount++;
  metrics.selectorSnapshotChurn = selectorChurnCount;
}

/**
 * Track store subscription count
 */
export function trackSubscriberCount(count: number) {
  metrics.storeSubscriberCount = count;
}

/**
 * Reset all metrics
 */
export function resetMetrics() {
  writeCount = 0;
  writeCountWindow = [];
  lastWriteValue = Symbol('initial');
  selectorChurnCount = 0;
  metrics.storeSubscriberCount = 0;
  metrics.stateWritesPerSecond = 0;
  metrics.repeatedWrites = 0;
  metrics.selectorSnapshotChurn = 0;
}

/**
 * Get current metrics
 */
export function getMetrics(): DebugMetrics {
  return { ...metrics };
}

/**
 * Initialize instrumentation (called from main.tsx in DEV mode)
 */
export function initializeStoreInstrumentation() {
  if (typeof window === 'undefined') return;
  
  // Only expose in DEV mode
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    (window as any).__RB_DEBUG__ = {
      getMetrics,
      resetMetrics,
      storeSubscriberCount: 0,
      stateWritesPerSecond: 0,
      repeatedWrites: 0,
      selectorSnapshotChurn: 0,
      
      // Expose tracking functions for stores to call
      trackStoreWrite,
      trackSelectorChurn,
      trackSubscriberCount,
    };
  }
}

/**
 * Assert no runaway loop detected
 * Used in tests to verify stability
 */
export function assertNoRunawayLoop(maxWritesPerSecond = 5) {
  const m = getMetrics();
  if (m.stateWritesPerSecond > maxWritesPerSecond) {
    throw new Error(
      `Potential runaway store loop detected: ${m.stateWritesPerSecond} writes/sec (limit: ${maxWritesPerSecond}). ` +
      `Repeated writes: ${m.repeatedWrites}, Selector churn: ${m.selectorSnapshotChurn}`
    );
  }
  return true;
}
