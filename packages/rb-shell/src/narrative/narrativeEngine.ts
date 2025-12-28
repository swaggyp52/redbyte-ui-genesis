// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { useNarrativeStore } from './narrativeStore';
import { NARRATIVE_EVENTS, type NarrativeEventId, type NarrativeEventPayload } from './narrativeEvents';

const COOLDOWN_MS = 60_000; // 60 seconds between any narrative displays

/**
 * Queue for narrative events waiting to be displayed
 */
let narrativeQueue: NarrativeEventPayload[] = [];

/**
 * Active narrative being displayed
 */
let activeNarrative: NarrativeEventPayload | null = null;

/**
 * Callbacks for UI updates
 */
const listeners: Set<(narrative: NarrativeEventPayload | null) => void> = new Set();

/**
 * Register a listener for narrative display updates
 */
export function onNarrativeChange(callback: (narrative: NarrativeEventPayload | null) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Notify all listeners of narrative state change
 */
function notifyListeners() {
  listeners.forEach((callback) => callback(activeNarrative));
}

/**
 * Check if prerequisites are met for an event
 */
function checkPrerequisites(eventId: NarrativeEventId): boolean {
  const event = NARRATIVE_EVENTS[eventId];
  if (!event.prerequisites || event.prerequisites.length === 0) {
    return true;
  }

  const store = useNarrativeStore.getState();
  return event.prerequisites.every((prereqId) => store.hasBeenShown(prereqId));
}

/**
 * Check if cooldown period has passed
 */
function isInCooldown(): boolean {
  const store = useNarrativeStore.getState();
  if (!store.lastShownAt) {
    return false;
  }

  const lastShown = new Date(store.lastShownAt).getTime();
  const now = Date.now();
  return now - lastShown < COOLDOWN_MS;
}

/**
 * Trigger a narrative event (may queue or display immediately)
 */
export function trigger(eventId: NarrativeEventId, metadata?: NarrativeEventPayload['metadata']): void {
  const store = useNarrativeStore.getState();
  const event = NARRATIVE_EVENTS[eventId];

  if (!event) {
    console.warn('[Narrative] Unknown event ID:', eventId);
    return;
  }

  // Check if already shown (unless allowRepeat is true)
  if (!event.allowRepeat && store.hasBeenShown(eventId)) {
    return;
  }

  // Check prerequisites
  if (!checkPrerequisites(eventId)) {
    return;
  }

  // Create payload
  const payload: NarrativeEventPayload = {
    eventId,
    sourceAppId: metadata?.exampleId || 'unknown',
    timestamp: new Date().toISOString(),
    metadata,
  };

  // If in cooldown or narrative already active, queue it
  if (isInCooldown() || activeNarrative) {
    narrativeQueue.push(payload);
    return;
  }

  // Display immediately
  displayNarrative(payload);
}

/**
 * Display a narrative (internal)
 */
function displayNarrative(payload: NarrativeEventPayload): void {
  activeNarrative = payload;

  const store = useNarrativeStore.getState();
  store.markAsShown(payload.eventId);

  notifyListeners();
}

/**
 * Dismiss the current narrative
 */
export function dismiss(): void {
  if (!activeNarrative) {
    return;
  }

  const store = useNarrativeStore.getState();
  store.incrementDismissed();

  activeNarrative = null;
  notifyListeners();

  // Try to show next queued narrative after a brief delay
  setTimeout(processQueue, 1000);
}

/**
 * Process queued narratives
 */
function processQueue(): void {
  if (narrativeQueue.length === 0 || activeNarrative || isInCooldown()) {
    return;
  }

  const next = narrativeQueue.shift();
  if (next) {
    displayNarrative(next);
  }
}

/**
 * Get current active narrative
 */
export function getActiveNarrative(): NarrativeEventPayload | null {
  return activeNarrative;
}

/**
 * Clear queue (for testing)
 */
export function clearQueue(): void {
  narrativeQueue = [];
  activeNarrative = null;
  notifyListeners();
}
