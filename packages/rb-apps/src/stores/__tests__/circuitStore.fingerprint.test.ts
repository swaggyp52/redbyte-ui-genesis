// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// REGRESSION TEST: Circuit store fingerprint gating prevents no-op updates

import { describe, it, expect, beforeEach } from 'vitest';
import { useCircuitStore } from '../circuitStore';
import type { Circuit } from '@redbyte/rb-logic-core';

describe('CircuitStore - Fingerprint Gating', () => {
  beforeEach(() => {
    // Reset store before each test
    useCircuitStore.getState().reset();
  });

  it('should skip update when circuit fingerprint is identical', () => {
    const initialCircuit: Circuit = {
      nodes: [
        { id: 'node-1', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, state: {}, config: {} },
      ],
      connections: [],
    };

    // Initial commit
    useCircuitStore.getState().commit(initialCircuit);
    
    // Re-read state after mutation (zustand creates new state objects on set())
    const pastLength1 = useCircuitStore.getState().past.length;
    expect(pastLength1).toBe(1);

    // Create a clone with identical structure (different object reference but same values)
    const clonedCircuit: Circuit = {
      nodes: [
        { id: 'node-1', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, state: {}, config: {} },
      ],
      connections: [],
    };

    // Fingerprint dedup only runs when enforceLimits=false (undo/redo/load paths).
    // commit() always sets enforceLimits=true to allow clamping, so use updateCircuit directly.
    useCircuitStore.getState().updateCircuit(clonedCircuit, { skipHistory: false, enforceLimits: false });

    // Past should NOT grow because fingerprint matched
    const pastLength2 = useCircuitStore.getState().past.length;
    
    // CRITICAL: If fingerprint gating works, past length should still be 1
    // (the second commit was a no-op and didn't add to history)
    expect(pastLength2).toBe(pastLength1);
  });

  it('should process update when circuit fingerprint differs', () => {
    const circuit1: Circuit = {
      nodes: [
        { id: 'node-1', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, state: {}, config: {} },
      ],
      connections: [],
    };

    const circuit2: Circuit = {
      nodes: [
        { id: 'node-1', type: 'Switch', position: { x: 100, y: 0 }, rotation: 0, state: {}, config: {} }, // Changed X position
      ],
      connections: [],
    };

    useCircuitStore.getState().commit(circuit1);
    const pastLength1 = useCircuitStore.getState().past.length;

    // Use updateCircuit with enforceLimits: false to test fingerprint change detection
    useCircuitStore.getState().updateCircuit(circuit2, { skipHistory: false, enforceLimits: false });
    const pastLength2 = useCircuitStore.getState().past.length;

    // CRITICAL: Different fingerprints should add to history
    expect(pastLength2).toBe(pastLength1 + 1);
  });

  it('should handle undefined rotation consistently in fingerprint', () => {
    const circuitNoRotation: Circuit = {
      nodes: [
        { id: 'node-1', type: 'Switch', position: { x: 0, y: 0 }, state: {}, config: {} }, // rotation undefined
      ],
      connections: [],
    };

    const circuitZeroRotation: Circuit = {
      nodes: [
        { id: 'node-1', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, state: {}, config: {} },
      ],
      connections: [],
    };

    useCircuitStore.getState().commit(circuitNoRotation);
    const pastLength1 = useCircuitStore.getState().past.length;

    // updateCircuit with enforceLimits: false to test fingerprint normalization
    useCircuitStore.getState().updateCircuit(circuitZeroRotation, { skipHistory: false, enforceLimits: false });
    const pastLength2 = useCircuitStore.getState().past.length;

    // CRITICAL: undefined and 0 should produce identical fingerprints
    expect(pastLength2).toBe(pastLength1);
  });
});
