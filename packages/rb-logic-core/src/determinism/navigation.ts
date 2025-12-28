// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '../types';
import type { EventLogV1 } from './eventLog';
import { getStateAtIndex, type CircuitStateSnapshot, type GetStateAtIndexOptions } from './inspector';

/**
 * Step forward in time by one event.
 *
 * Returns the state at the next event index, or null if already at the end.
 * This is a convenience wrapper around getStateAtIndex().
 *
 * @param initialCircuit - Starting circuit (must match eventLog's circuit_loaded event)
 * @param eventLog - Event log being navigated
 * @param currentSnapshot - Current state snapshot
 * @param options - Optional configuration (engineFactory, etc.)
 * @returns Next snapshot or null if at end
 */
export function stepForward(
  initialCircuit: Circuit,
  eventLog: EventLogV1,
  currentSnapshot: CircuitStateSnapshot,
  options?: GetStateAtIndexOptions
): CircuitStateSnapshot | null {
  const nextIndex = currentSnapshot.eventIndex + 1;

  // Check if we're already at the end
  if (nextIndex >= currentSnapshot.totalEvents) {
    return null;
  }

  return getStateAtIndex(initialCircuit, eventLog, nextIndex, options);
}

/**
 * Step backward in time by one event.
 *
 * Returns the state at the previous event index, or null if already at the start.
 * This is a convenience wrapper around getStateAtIndex().
 *
 * @param initialCircuit - Starting circuit (must match eventLog's circuit_loaded event)
 * @param eventLog - Event log being navigated
 * @param currentSnapshot - Current state snapshot
 * @param options - Optional configuration (engineFactory, etc.)
 * @returns Previous snapshot or null if at start
 */
export function stepBackward(
  initialCircuit: Circuit,
  eventLog: EventLogV1,
  currentSnapshot: CircuitStateSnapshot,
  options?: GetStateAtIndexOptions
): CircuitStateSnapshot | null {
  const prevIndex = currentSnapshot.eventIndex - 1;

  // Check if we're already at the start
  if (prevIndex < 0) {
    return null;
  }

  return getStateAtIndex(initialCircuit, eventLog, prevIndex, options);
}

/**
 * Jump to a specific event index.
 *
 * This is an alias for getStateAtIndex() with snapshot-based context.
 * Useful when you want to jump to an arbitrary point in the timeline.
 *
 * @param initialCircuit - Starting circuit (must match eventLog's circuit_loaded event)
 * @param eventLog - Event log being navigated
 * @param targetIndex - Target event index (0-based)
 * @param options - Optional configuration (engineFactory, etc.)
 * @returns Snapshot at target index
 * @throws Error if targetIndex is out of bounds
 */
export function jumpToIndex(
  initialCircuit: Circuit,
  eventLog: EventLogV1,
  targetIndex: number,
  options?: GetStateAtIndexOptions
): CircuitStateSnapshot {
  return getStateAtIndex(initialCircuit, eventLog, targetIndex, options);
}

/**
 * Check if there is a next event to step forward to.
 *
 * @param currentSnapshot - Current state snapshot
 * @returns True if stepping forward is possible
 */
export function canStepForward(currentSnapshot: CircuitStateSnapshot): boolean {
  return currentSnapshot.eventIndex + 1 < currentSnapshot.totalEvents;
}

/**
 * Check if there is a previous event to step backward to.
 *
 * @param currentSnapshot - Current state snapshot
 * @returns True if stepping backward is possible
 */
export function canStepBackward(currentSnapshot: CircuitStateSnapshot): boolean {
  return currentSnapshot.eventIndex > 0;
}
