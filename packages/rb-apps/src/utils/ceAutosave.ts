/**
 * Classroom Edition Autosave & Restore
 * 
 * Automatically persists circuit state to localStorage on mutations
 * and restores on app load. Includes schema versioning for safe upgrades.
 */

import { useEffect, useRef } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import { useCircuitStore } from '../stores/circuitStore';
import { getCEConfig, CE_STORAGE_KEY, loadCEState, saveCEState } from '@redbyte/rb-utils';

const AUTOSAVE_DEBOUNCE_MS = 3000; // Wait 3s after last change before saving
const CE_CIRCUIT_SCHEMA_VERSION = 1;

interface CESavedCircuitState {
  version: number;
  timestamp: number;
  circuit: Circuit;
}

/**
 * Load last saved circuit from localStorage
 * Returns null if not in CE mode, no saved state, or corrupted state
 */
export function loadSavedCircuit(): Circuit | null {
  const config = getCEConfig();
  if (!config.enabled) return null;

  try {
    const saved = loadCEState();
    if (!saved.lastCircuit) return null;

    const parsed = JSON.parse(saved.lastCircuit) as CESavedCircuitState;
    
    // Validate schema version (for future upgrades)
    if (parsed.version !== CE_CIRCUIT_SCHEMA_VERSION) {
      console.warn(
        `[Autosave] Saved circuit has version ${parsed.version}, ` +
        `expected ${CE_CIRCUIT_SCHEMA_VERSION}. Discarding for safety.`
      );
      return null;
    }

    // Validate circuit structure (min fields)
    if (!parsed.circuit || !Array.isArray(parsed.circuit.nodes)) {
      console.warn('[Autosave] Saved circuit has invalid structure. Discarding.');
      return null;
    }

    console.log(`[Autosave] Restored circuit with ${parsed.circuit.nodes.length} nodes from ${new Date(parsed.timestamp).toLocaleTimeString()}`);
    return parsed.circuit;
  } catch (err) {
    console.error('[Autosave] Failed to restore circuit:', err);
    return null;
  }
}

/**
 * Save circuit to localStorage
 * Called on debounced updates
 */
export function saveCircuitToStorage(circuit: Circuit): void {
  const config = getCEConfig();
  if (!config.enabled) return;

  try {
    const data: CESavedCircuitState = {
      version: CE_CIRCUIT_SCHEMA_VERSION,
      timestamp: Date.now(),
      circuit,
    };

    saveCEState({
      lastCircuit: JSON.stringify(data),
      lastTimestamp: Date.now(),
    });

    if (import.meta.env.DEV) {
      console.log(`[Autosave] Saved circuit (${circuit.nodes.length} nodes, ${circuit.connections.length} connections)`);
    }
  } catch (err) {
    console.error('[Autosave] Failed to save circuit:', err);
  }
}

/**
 * Hook: autosave circuit on mutations
 * Debounced to avoid excessive writes
 */
export function useAutosaveCircuit(): void {
  const config = getCEConfig();
  const circuit = useCircuitStore((state) => state.circuit);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!config.enabled) return;

    // Clear pending save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Schedule new save
    debounceRef.current = setTimeout(() => {
      saveCircuitToStorage(circuit);
    }, config.autosaveIntervalMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [circuit, config]);
}

/**
 * Hook: restore circuit on mount
 * Only restores if:
 * 1. CE mode is enabled
 * 2. Circuit store is currently empty
 * 3. Saved state exists and is valid
 */
export function useRestoreCircuit(): { restored: boolean } {
  const circuit = useCircuitStore((state) => state.circuit);
  const updateCircuit = useCircuitStore((state) => state.updateCircuit);
  const restoredRef = useRef(false);
  const hasTriedRef = useRef(false);

  useEffect(() => {
    if (hasTriedRef.current) return; // Only try once
    hasTriedRef.current = true;

    const config = getCEConfig();
    if (!config.enabled) {
      restoredRef.current = false;
      return;
    }

    // Only restore if circuit is empty (first load)
    if (circuit.nodes.length > 0) {
      restoredRef.current = false;
      return;
    }

    const saved = loadSavedCircuit();
    if (saved) {
      updateCircuit(saved, { skipHistory: true, enforceLimits: true }); // Skip history but enforce classroom limits
      restoredRef.current = true;
      console.log('[Autosave] Circuit restored from storage');
    } else {
      restoredRef.current = false;
    }
  }, []);

  return { restored: restoredRef.current };
}

/**
 * Reset all CE storage (called by reset button)
 */
export function clearAutosaveStorage(): void {
  try {
    localStorage.removeItem('rb:classroom:v1'); // CE_STORAGE_KEY
    console.log('[Autosave] Cleared all saved state');
  } catch (err) {
    console.error('[Autosave] Failed to clear storage:', err);
  }
}

/**
 * Alias for clearAutosaveStorage for explicit CE context
 */
export function clearSavedCircuit(): void {
  clearAutosaveStorage();
}
