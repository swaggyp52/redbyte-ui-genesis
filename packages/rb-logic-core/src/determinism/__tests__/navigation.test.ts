// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import { LogicEngine } from '../../engine';
import {
  stepForward,
  stepBackward,
  jumpToIndex,
  canStepForward,
  canStepBackward,
} from '../navigation';
import { getStateAtIndex } from '../inspector';
import {
  createEventLog,
  appendEvent,
  createCircuitLoadedEvent,
  createInputToggledEvent,
  createSimulationTickEvent,
} from '../eventLog';
import type { EngineFactory } from '../replay';

describe('navigation (PR9: Step Navigation)', () => {
  // Engine factory for tests
  const engineFactory: EngineFactory = (circuit) => new LogicEngine(circuit);

  /**
   * Test circuit factory: Two switches → AND gate → output
   */
  function createTestCircuit(): Circuit {
    return {
      nodes: [
        {
          id: 'switchA',
          type: 'SWITCH',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 0 },
        },
        {
          id: 'switchB',
          type: 'SWITCH',
          position: { x: 0, y: 100 },
          rotation: 0,
          config: {},
          state: { isOn: 0 },
        },
        {
          id: 'andGate',
          type: 'AND',
          position: { x: 200, y: 50 },
          rotation: 0,
          config: {},
        },
        {
          id: 'output',
          type: 'OUTPUT',
          position: { x: 400, y: 50 },
          rotation: 0,
          config: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'switchA', portName: 'out' },
          to: { nodeId: 'andGate', portName: 'a' },
        },
        {
          from: { nodeId: 'switchB', portName: 'out' },
          to: { nodeId: 'andGate', portName: 'b' },
        },
        {
          from: { nodeId: 'andGate', portName: 'out' },
          to: { nodeId: 'output', portName: 'in' },
        },
      ],
    };
  }

  it('Test 1: stepForward moves to next event index', () => {
    const testCircuit = createTestCircuit();

    // Build log with multiple events
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 1000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 1001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 1002));

    // Start at index 0
    const snapshot0 = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    expect(snapshot0.eventIndex).toBe(0);

    // Step forward to index 1
    const snapshot1 = stepForward(testCircuit, log, snapshot0, { engineFactory });
    expect(snapshot1).not.toBeNull();
    expect(snapshot1!.eventIndex).toBe(1);

    // Step forward to index 2
    const snapshot2 = stepForward(testCircuit, log, snapshot1!, { engineFactory });
    expect(snapshot2).not.toBeNull();
    expect(snapshot2!.eventIndex).toBe(2);

    // Verify switchA is ON at index 2
    const switchA = snapshot2!.circuit.nodes.find((n) => n.id === 'switchA')!;
    expect(switchA.state?.isOn).toBe(1);
  });

  it('Test 2: stepForward returns null when at end of log', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 2000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 2001));

    // Get snapshot at last event (index 1)
    const lastSnapshot = getStateAtIndex(testCircuit, log, 1, { engineFactory });
    expect(lastSnapshot.eventIndex).toBe(1);
    expect(lastSnapshot.totalEvents).toBe(2);

    // Try to step forward - should return null
    const next = stepForward(testCircuit, log, lastSnapshot, { engineFactory });
    expect(next).toBeNull();
  });

  it('Test 3: stepBackward moves to previous event index', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 3000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 3001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 3002));

    // Start at index 2 (last event)
    const snapshot2 = getStateAtIndex(testCircuit, log, 2, { engineFactory });
    expect(snapshot2.eventIndex).toBe(2);

    // Step backward to index 1
    const snapshot1 = stepBackward(testCircuit, log, snapshot2, { engineFactory });
    expect(snapshot1).not.toBeNull();
    expect(snapshot1!.eventIndex).toBe(1);

    // Step backward to index 0
    const snapshot0 = stepBackward(testCircuit, log, snapshot1!, { engineFactory });
    expect(snapshot0).not.toBeNull();
    expect(snapshot0!.eventIndex).toBe(0);
  });

  it('Test 4: stepBackward returns null when at start of log', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 4000));

    // Get snapshot at first event (index 0)
    const firstSnapshot = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    expect(firstSnapshot.eventIndex).toBe(0);

    // Try to step backward - should return null
    const prev = stepBackward(testCircuit, log, firstSnapshot, { engineFactory });
    expect(prev).toBeNull();
  });

  it('Test 5: forward then backward returns to same state', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 5000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 5001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 5002));

    // Start at index 1
    const original = getStateAtIndex(testCircuit, log, 1, { engineFactory });

    // Step forward then backward
    const forward = stepForward(testCircuit, log, original, { engineFactory });
    const backToOriginal = stepBackward(testCircuit, log, forward!, { engineFactory });

    // Should be back at index 1
    expect(backToOriginal!.eventIndex).toBe(original.eventIndex);

    // Circuit state should match
    expect(JSON.stringify(backToOriginal!.circuit)).toBe(JSON.stringify(original.circuit));
  });

  it('Test 6: backward then forward returns to same state', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 6000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 6001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 6002));

    // Start at index 1
    const original = getStateAtIndex(testCircuit, log, 1, { engineFactory });

    // Step backward then forward
    const backward = stepBackward(testCircuit, log, original, { engineFactory });
    const backToOriginal = stepForward(testCircuit, log, backward!, { engineFactory });

    // Should be back at index 1
    expect(backToOriginal!.eventIndex).toBe(original.eventIndex);

    // Circuit state should match
    expect(JSON.stringify(backToOriginal!.circuit)).toBe(JSON.stringify(original.circuit));
  });

  it('Test 7: jumpToIndex jumps to arbitrary index', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 7000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 7001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 7002));
    log = appendEvent(log, createInputToggledEvent('switchB', 'out', 1, 7003));
    log = appendEvent(log, createSimulationTickEvent(1, 1, 7004));

    // Jump directly to index 3
    const snapshot = jumpToIndex(testCircuit, log, 3, { engineFactory });
    expect(snapshot.eventIndex).toBe(3);

    // Verify switchB was toggled
    const switchB = snapshot.circuit.nodes.find((n) => n.id === 'switchB')!;
    expect(switchB.state?.isOn).toBe(1);
  });

  it('Test 8: canStepForward correctly identifies when forward is possible', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 8000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 8001));

    // At index 0 (can step forward)
    const snapshot0 = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    expect(canStepForward(snapshot0)).toBe(true);

    // At index 1 (last event, cannot step forward)
    const snapshot1 = getStateAtIndex(testCircuit, log, 1, { engineFactory });
    expect(canStepForward(snapshot1)).toBe(false);
  });

  it('Test 9: canStepBackward correctly identifies when backward is possible', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 9000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 9001));

    // At index 0 (first event, cannot step backward)
    const snapshot0 = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    expect(canStepBackward(snapshot0)).toBe(false);

    // At index 1 (can step backward)
    const snapshot1 = getStateAtIndex(testCircuit, log, 1, { engineFactory });
    expect(canStepBackward(snapshot1)).toBe(true);
  });

  it('Test 10: navigation preserves immutability', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 10000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 10001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 10002));

    const snapshot0 = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    const snapshot1 = stepForward(testCircuit, log, snapshot0, { engineFactory });

    // Mutate snapshot0
    snapshot0.circuit.nodes[0].state = { isOn: 999 };

    // Verify snapshot1 is unaffected
    const switchA = snapshot1!.circuit.nodes.find((n) => n.id === 'switchA')!;
    expect(switchA.state?.isOn).toBe(1); // Not 999
  });

  it('Test 11: multi-step navigation traverses full log', () => {
    const testCircuit = createTestCircuit();

    // Build longer log
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 11000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 11001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 11002));
    log = appendEvent(log, createInputToggledEvent('switchB', 'out', 1, 11003));
    log = appendEvent(log, createSimulationTickEvent(1, 1, 11004));

    // Start at index 0 and step forward repeatedly
    let current = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    expect(current.eventIndex).toBe(0);

    // Step through all events
    const indices = [0];
    while (canStepForward(current)) {
      const next = stepForward(testCircuit, log, current, { engineFactory });
      expect(next).not.toBeNull();
      current = next!;
      indices.push(current.eventIndex);
    }

    // Should have visited all indices
    expect(indices).toEqual([0, 1, 2, 3, 4]);
    expect(current.eventIndex).toBe(4);
  });

  it('Test 12: jumpToIndex throws error for out-of-bounds index', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 12000));

    // Log has 1 event (index 0), so index 1 should fail
    expect(() => {
      jumpToIndex(testCircuit, log, 1, { engineFactory });
    }).toThrow(/out of bounds/i);
  });
});
