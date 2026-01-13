/**
 * Store Instrumentation for React #185 Detection
 * 
 * This module provides dev-only instrumentation for detecting store selector churn
 * that can lead to React #185 "Maximum update depth exceeded" errors.
 * 
 * Exposed via window.__RB_DEBUG__ in DEV mode only.
 * 
 * Key metrics:
 * - stateWritesPerSecond: How many store mutations per second
 * - repeatedWrites: How many times identical value written in succession
 * - selectorSnapshotChurn: New object references from selectors
 * - churnPercentage: Percentage of writes that are redundant
 */

interface DebugMetrics {
  storeSubscriberCount: number;
  stateWritesPerSecond: number;
  repeatedWrites: number;
  selectorSnapshotChurn: number;
  churnPercentage: number;
  lastReportTime: number;
  windowMs: number;
}

const metrics: DebugMetrics = {
  storeSubscriberCount: 0,
  stateWritesPerSecond: 0,
  repeatedWrites: 0,
  selectorSnapshotChurn: 0,
  churnPercentage: 0,
  lastReportTime: Date.now(),
  windowMs: 1000,
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
  const now = Date.now();
  writeCountWindow.push(now);
  
  // Keep only writes from configured window (default 1000ms)
  writeCountWindow = writeCountWindow.filter(t => now - t < metrics.windowMs);
  
  // Detect repeated identical writes
  if (lastWriteValue !== undefined && JSON.stringify(lastWriteValue) === JSON.stringify(value)) {
    selectorChurnCount++;
  }
  lastWriteValue = value;
  
  metrics.stateWritesPerSecond = writeCountWindow.length;
  metrics.repeatedWrites = selectorChurnCount;
  metrics.churnPercentage = writeCount > 0 ? Math.round((selectorChurnCount / writeCount) * 100) : 0;
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
      assertNoRunawayLoop,
      storeSubscriberCount: 0,
      stateWritesPerSecond: 0,
      repeatedWrites: 0,
      selectorSnapshotChurn: 0,
      churnPercentage: 0,
      
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
 * 
 * Default threshold: 5 writes/sec and < 50% churn
 */
export function assertNoRunawayLoop(options?: { maxWritesPerSec?: number; maxChurnPercent?: number }) {
  const m = getMetrics();
  const maxWrites = options?.maxWritesPerSec ?? 5;
  const maxChurn = options?.maxChurnPercent ?? 50;
  
  if (m.stateWritesPerSecond > maxWrites) {
    throw new Error(
      `Potential runaway store loop: ${m.stateWritesPerSecond} writes/sec (limit: ${maxWrites}). ` +
      `Churn: ${m.churnPercentage}% (${m.repeatedWrites}/${writeCount} writes), ` +
      `Selector issues: ${m.selectorSnapshotChurn}`
    );
  }
  
  if (m.churnPercentage > maxChurn && m.stateWritesPerSecond > 2) {
    throw new Error(
      `High store churn detected: ${m.churnPercentage}% redundant writes (limit: ${maxChurn}%). ` +
      `${m.repeatedWrites} repeated writes, writes/sec: ${m.stateWritesPerSecond}`
    );
  }
  
  return true;
}
