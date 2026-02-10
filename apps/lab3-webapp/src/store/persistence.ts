import type { SerializedSnapshot } from './labStore';
import { validateSnapshotV1, serializeStoreSnapshot } from './labStore';

const STORAGE_KEY = 'rb.lab3.session.v1';
const DEBOUNCE_MS = 350;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Load snapshot from localStorage
 * Returns parsed snapshot if valid, null otherwise (silent failures)
 */
export function loadSnapshot(): SerializedSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    
    const parsed = JSON.parse(raw);
    if (!validateSnapshotV1(parsed)) {
      console.warn('[persistence] Invalid snapshot in localStorage, ignoring');
      return null;
    }
    
    return parsed;
  } catch (err) {
    console.warn('[persistence] Failed to load snapshot:', err);
    return null;
  }
}

/**
 * Save snapshot to localStorage with debouncing
 */
export function saveSnapshotDebounced(snapshot: string): void {
  // Clear existing timer
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  
  // Set new timer
  debounceTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, snapshot);
    } catch (err) {
      console.error('[persistence] Failed to save snapshot:', err);
    }
  }, DEBOUNCE_MS);
}

/**
 * Initialize persistence by subscribing to store changes
 * Call once on app mount
 */
export function initPersistence(store: any): void {
  store.subscribe((state: any) => {
    const snapshot = serializeStoreSnapshot(
      state.doc,
      state.windows,
      state.events,
      state.eventSeq,
      { simulationInput: state.simulationInput ?? 0, implMode: state.implMode ?? 'table', verilogCode: state.verilogCode ?? '' }
    );
    saveSnapshotDebounced(snapshot);
  });
}
