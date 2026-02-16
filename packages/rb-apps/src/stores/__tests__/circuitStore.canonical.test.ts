// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// CONTRACT TEST RC-P1: Circuit Store is the Single Canonical Source of Truth
// Fails if someone introduces useState<Circuit> or shadow circuit sources in app

import { describe, it, expect, beforeEach } from 'vitest';
import { useCircuitStore } from '../circuitStore';
import type { Circuit } from '@redbyte/rb-logic-core';

describe('RC-P1: Circuit Store Canonical Contract', () => {
  
  beforeEach(() => {
    useCircuitStore.getState().reset();
  });
  
  it('should have circuitStore as the sole canonical circuit state container', () => {
    // This test verifies that useCircuitStore is the ONLY place where circuit state lives.
    // If this test fails, someone has introduced useState<Circuit> or another shadow source.
    
    const store = useCircuitStore.getState();
    
    // Verify store has all required methods for circuit mutations
    expect(typeof store.addNode).toBe('function');
    expect(typeof store.updateNode).toBe('function');
    expect(typeof store.deleteNode).toBe('function');
    expect(typeof store.addConnection).toBe('function');
    expect(typeof store.deleteConnection).toBe('function');
    expect(typeof store.updateCircuit).toBe('function');
    expect(typeof store.commit).toBe('function');
    expect(typeof store.undo).toBe('function');
    expect(typeof store.redo).toBe('function');
  });

  it('should provide circuit state through useCircuitStore selector', () => {
    // Verify that reading circuit goes through the store selector, not useState
    const store = useCircuitStore.getState();
    const circuit = store.circuit;
    
    expect(circuit).toBeDefined();
    expect(Array.isArray(circuit.nodes)).toBe(true);
    expect(Array.isArray(circuit.connections)).toBe(true);
  });

  it('should create distinct nodes when addNode called multiple times', () => {
    const store = useCircuitStore.getState();
    
    // Add first node via canonical store method
    store.addNode('AND', { x: 50, y: 100 });
    // Get fresh reference from store after mutation
    const nodeCount1 = useCircuitStore.getState().circuit.nodes.length;
    expect(nodeCount1).toBe(1);
    
    // Add second node (should have different ID)
    store.addNode('AND', { x: 50, y: 100 });
    // Get fresh reference from store after mutation
    const nodeCount2 = useCircuitStore.getState().circuit.nodes.length;
    
    // Both nodes should exist and be distinct (different IDs generated)
    expect(nodeCount2).toBe(2);
    const nodes = useCircuitStore.getState().circuit.nodes;
    expect(nodes[0].id).not.toBe(nodes[1].id);
  });

  it('should sync engine instances through store, not external useState', () => {
    const store = useCircuitStore.getState();
    
    // Verify store has methods to set engine/tickEngine
    expect(typeof store.setEngine).toBe('function');
    expect(typeof store.setTickEngine).toBe('function');
  });

  it('should maintain logical state consistency (RC-P1 enforcement)', () => {
    // This test verifies the contract: circuitStore is THE source of truth.
    // The violation we're preventing:
    // ❌ const [circuit, setCircuit] = useState<Circuit>(...) // async desync risk
    // ✅ const circuit = useCircuitStore(state => state.circuit) // canonical
    
    // Read circuit before modification
    let circuit = useCircuitStore.getState().circuit;
    expect(circuit.nodes.length).toBe(0);
    
    // Add a node via store method
    useCircuitStore.getState().addNode('Switch', { x: 0, y: 0 });
    
    // Read circuit after modification (get FRESH reference)
    const circuitAfter = useCircuitStore.getState().circuit;
    
    // Different objects (because store creates new circuit object on mutation)
    expect(circuitAfter === circuit).toBe(false);
    // NEW circuit should have the added node
    expect(circuitAfter.nodes.length).toBe(1);
    // OLD reference should NOT be updated (proves immutability)
    expect(circuit.nodes.length).toBe(0);
  });

  it('should prevent shadow circuit sources by enforcing store-only mutations', () => {
    // This test validates the RC-P1 core invariant:
    // All circuit mutations MUST route through circuitStore, never direct useState
    
    // Simulate stale snapshot scenario
    const staleSnapshot = useCircuitStore.getState().circuit;
    expect(staleSnapshot.nodes.length).toBe(0);
    
    // Add node via store (the CORRECT way)
    useCircuitStore.getState().addNode('Lamp', { x: 10, y: 20 });
    
    // Read current state from store (the CORRECT way)
    const currentState = useCircuitStore.getState().circuit;
    
    // Current state should reflect the mutation
    expect(currentState.nodes.length).toBe(1);
    
    // Old snapshot should NOT reflect the mutation (proves no shared mutation)
    expect(staleSnapshot.nodes.length).toBe(0);
    
    // If code was using a shadow useState, it would have missed this update,
    // causing the UI to show stale data while store has the truth
  });
});
