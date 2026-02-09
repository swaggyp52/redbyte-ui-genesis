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

    const store = useCircuitStore.getState();
    
    // Initial commit
    store.commit(initialCircuit);
    
    // Get current past length (should be 1)
    const pastLength1 = store.past.length;
    expect(pastLength1).toBe(1);

    // Create a clone with identical structure (different object reference but same values)
    const clonedCircuit: Circuit = {
      nodes: [
        { id: 'node-1', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, state: {}, config: {} },
      ],
      connections: [],
    };

    // Attempt to commit the clone (should be no-op due to fingerprint match)
    store.commit(clonedCircuit);

    // Past should NOT grow because fingerprint matched
    const pastLength2 = store.past.length;
    
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

    const store =useCircuitStore.getState();
    
    store.commit(circuit1);
    const pastLength1 = store.past.length;

    store.commit(circuit2);
    const pastLength2 = store.past.length;

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

    const store = useCircuitStore.getState();
    
    store.commit(circuitNoRotation);
    const pastLength1 = store.past.length;

    // Commit with rotation=0 (should be treated as identical to undefined due to fingerprint normalization)
    store.commit(circuitZeroRotation);
    const pastLength2 = store.past.length;

    // CRITICAL: undefined and 0 should produce identical fingerprints
    expect(pastLength2).toBe(pastLength1);
  });
});
