// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import { LogicEngine } from '../../engine';
import { getStateAtIndex } from '../inspector';
import {
  createEventLog,
  appendEvent,
  createCircuitLoadedEvent,
  createInputToggledEvent,
  createSimulationTickEvent,
} from '../eventLog';
import type { EngineFactory } from '../replay';

describe('getStateAtIndex (PR8: State Query Primitive)', () => {
  // Engine factory for tests
  const engineFactory: EngineFactory = (circuit) => new LogicEngine(circuit);

  /**
   * Test circuit factory: Two switches → AND gate → output
   * Returns a fresh copy each time to avoid cross-test contamination
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

  it('Test 1: getStateAtIndex(0) returns initial state after circuit_loaded', () => {
    const testCircuit = createTestCircuit();

    // Build log with only circuit_loaded event
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 1000));

    const snapshot = getStateAtIndex(testCircuit, log, 0, { engineFactory });

    // Core assertions
    expect(snapshot.eventIndex).toBe(0);
    expect(snapshot.totalEvents).toBe(1);
    expect(snapshot.circuit).toBeDefined();
    expect(snapshot.signals).toBeDefined();

    // Verify circuit structure matches initial
    expect(snapshot.circuit.nodes.length).toBe(4);
    expect(snapshot.circuit.connections.length).toBe(3);

    // Verify initial switch states (both OFF)
    const switchA = snapshot.circuit.nodes.find((n) => n.id === 'switchA')!;
    const switchB = snapshot.circuit.nodes.find((n) => n.id === 'switchB')!;
    expect(switchA.state?.isOn).toBe(0);
    expect(switchB.state?.isOn).toBe(0);

    // Verify signals map exists
    expect(snapshot.signals.size).toBeGreaterThan(0);
  });

  it('Test 2: getStateAtIndex captures state after input_toggled event', () => {
    const testCircuit = createTestCircuit();

    // Build log: circuit_loaded, toggle switchA on
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 1000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 1001));

    // Get state at index 1 (after toggle)
    const snapshot = getStateAtIndex(testCircuit, log, 1, { engineFactory });

    expect(snapshot.eventIndex).toBe(1);
    expect(snapshot.totalEvents).toBe(2);

    // Verify switchA is ON
    const switchA = snapshot.circuit.nodes.find((n) => n.id === 'switchA')!;
    expect(switchA.state?.isOn).toBe(1);

    // Verify signal is set
    const switchASignals = snapshot.signals.get('switchA');
    expect(switchASignals).toBeDefined();
    expect(switchASignals?.get('out')).toBe(1);
  });

  it('Test 3: getStateAtIndex captures state after simulation_tick', () => {
    const testCircuit = createTestCircuit();

    // Build log: circuit_loaded, toggle switchA on, tick, toggle switchB on, tick
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 1000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 1001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 1002));
    log = appendEvent(log, createInputToggledEvent('switchB', 'out', 1, 1003));
    log = appendEvent(log, createSimulationTickEvent(1, 1, 1004));

    // Get state at index 4 (after both switches on and second tick)
    const snapshot = getStateAtIndex(testCircuit, log, 4, { engineFactory });

    expect(snapshot.eventIndex).toBe(4);
    expect(snapshot.totalEvents).toBe(5);

    // Verify both switches are ON
    const switchA = snapshot.circuit.nodes.find((n) => n.id === 'switchA')!;
    const switchB = snapshot.circuit.nodes.find((n) => n.id === 'switchB')!;
    expect(switchA.state?.isOn).toBe(1);
    expect(switchB.state?.isOn).toBe(1);

    // Verify AND gate output should be 1 (both inputs HIGH)
    const andGateSignals = snapshot.signals.get('andGate');
    expect(andGateSignals).toBeDefined();
    expect(andGateSignals?.get('out')).toBe(1);
  });

  it('Test 4: getStateAtIndex is deterministic (repeated calls return same state)', () => {
    const testCircuit = createTestCircuit();

    // Build log with multiple events
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 2000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 2001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 2002));

    // Call getStateAtIndex twice at the same index
    const snapshot1 = getStateAtIndex(testCircuit, log, 2, { engineFactory });
    const snapshot2 = getStateAtIndex(testCircuit, log, 2, { engineFactory });

    // Core assertion: results should be identical
    expect(snapshot1.eventIndex).toBe(snapshot2.eventIndex);
    expect(snapshot1.totalEvents).toBe(snapshot2.totalEvents);

    // Circuit state should match
    expect(JSON.stringify(snapshot1.circuit)).toBe(JSON.stringify(snapshot2.circuit));

    // Signals should match
    const signals1 = Array.from(snapshot1.signals.entries()).map(([nodeId, portMap]) => [
      nodeId,
      Array.from(portMap.entries()),
    ]);
    const signals2 = Array.from(snapshot2.signals.entries()).map(([nodeId, portMap]) => [
      nodeId,
      Array.from(portMap.entries()),
    ]);
    expect(JSON.stringify(signals1)).toBe(JSON.stringify(signals2));
  });

  it('Test 5: getStateAtIndex throws error for out-of-bounds index (negative)', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 3000));

    expect(() => {
      getStateAtIndex(testCircuit, log, -1, { engineFactory });
    }).toThrow(/out of bounds/i);
  });

  it('Test 6: getStateAtIndex throws error for out-of-bounds index (too large)', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 3000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 3001));

    // Log has 2 events (indices 0 and 1), so index 2 should fail
    expect(() => {
      getStateAtIndex(testCircuit, log, 2, { engineFactory });
    }).toThrow(/out of bounds/i);
  });

  it('Test 7: getStateAtIndex throws error for empty event log', () => {
    const testCircuit = createTestCircuit();

    const log = createEventLog();

    expect(() => {
      getStateAtIndex(testCircuit, log, 0, { engineFactory });
    }).toThrow(/must contain at least one event/i);
  });

  it('Test 8: getStateAtIndex throws error for invalid first event', () => {
    const testCircuit = createTestCircuit();

    // Create log with input_toggled as first event (invalid)
    let log = createEventLog();
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 4000));

    expect(() => {
      getStateAtIndex(testCircuit, log, 0, { engineFactory });
    }).toThrow(/first event must be circuit_loaded/i);
  });

  it('Test 9: getStateAtIndex preserves immutability (does not mutate inputs)', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 5000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 5001));

    // Deep clone inputs for comparison
    const circuitBefore = JSON.parse(JSON.stringify(testCircuit));
    const logBefore = JSON.parse(JSON.stringify(log));

    // Call getStateAtIndex
    getStateAtIndex(testCircuit, log, 1, { engineFactory });

    // Verify inputs are unchanged
    expect(JSON.stringify(testCircuit)).toBe(JSON.stringify(circuitBefore));
    expect(JSON.stringify(log)).toBe(JSON.stringify(logBefore));
  });

  it('Test 10: getStateAtIndex works with default engine factory', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 6000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 6001));

    // Call without engineFactory option (should use default LogicEngine)
    const snapshot = getStateAtIndex(testCircuit, log, 1);

    expect(snapshot.eventIndex).toBe(1);
    expect(snapshot.signals).toBeDefined();

    // Verify switchA is ON
    const switchASignals = snapshot.signals.get('switchA');
    expect(switchASignals?.get('out')).toBe(1);
  });

  it('Test 11: getStateAtIndex handles complex multi-event scenario', () => {
    const testCircuit = createTestCircuit();

    // Build complex log: toggle A on, tick, toggle B on, tick, toggle A off, tick
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 7000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 7001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 7002));
    log = appendEvent(log, createInputToggledEvent('switchB', 'out', 1, 7003));
    log = appendEvent(log, createSimulationTickEvent(1, 1, 7004));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 0, 7005));
    log = appendEvent(log, createSimulationTickEvent(2, 1, 7006));

    // Get state at various points and verify consistency
    const snapshot0 = getStateAtIndex(testCircuit, log, 0, { engineFactory }); // After circuit_loaded
    const snapshot2 = getStateAtIndex(testCircuit, log, 2, { engineFactory }); // After first tick (A on)
    const snapshot4 = getStateAtIndex(testCircuit, log, 4, { engineFactory }); // After second tick (A and B on)
    const snapshot6 = getStateAtIndex(testCircuit, log, 6, { engineFactory }); // After third tick (A off, B on)

    // Verify snapshot0: both switches OFF
    const switchA0 = snapshot0.circuit.nodes.find((n) => n.id === 'switchA')!;
    const switchB0 = snapshot0.circuit.nodes.find((n) => n.id === 'switchB')!;
    expect(switchA0.state?.isOn).toBe(0);
    expect(switchB0.state?.isOn).toBe(0);

    // Verify snapshot2: A on, B off
    const switchA2 = snapshot2.circuit.nodes.find((n) => n.id === 'switchA')!;
    const switchB2 = snapshot2.circuit.nodes.find((n) => n.id === 'switchB')!;
    expect(switchA2.state?.isOn).toBe(1);
    expect(switchB2.state?.isOn).toBe(0);

    // Verify snapshot4: both on, AND gate output should be 1
    const switchA4 = snapshot4.circuit.nodes.find((n) => n.id === 'switchA')!;
    const switchB4 = snapshot4.circuit.nodes.find((n) => n.id === 'switchB')!;
    expect(switchA4.state?.isOn).toBe(1);
    expect(switchB4.state?.isOn).toBe(1);
    expect(snapshot4.signals.get('andGate')?.get('out')).toBe(1);

    // Verify snapshot6: A off, B on, AND gate output should be 0
    const switchA6 = snapshot6.circuit.nodes.find((n) => n.id === 'switchA')!;
    const switchB6 = snapshot6.circuit.nodes.find((n) => n.id === 'switchB')!;
    expect(switchA6.state?.isOn).toBe(0);
    expect(switchB6.state?.isOn).toBe(1);
    expect(snapshot6.signals.get('andGate')?.get('out')).toBe(0);
  });

  it('Test 12: getStateAtIndex handles single event (circuit_loaded only)', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 8000));

    const snapshot = getStateAtIndex(testCircuit, log, 0, { engineFactory });

    expect(snapshot.eventIndex).toBe(0);
    expect(snapshot.totalEvents).toBe(1);
    expect(snapshot.circuit.nodes.length).toBe(4);
  });

  it('Test 13: getStateAtIndex snapshots are independent (mutating one does not affect another)', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 9000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 9001));

    const snapshot1 = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    const snapshot2 = getStateAtIndex(testCircuit, log, 1, { engineFactory });

    // Mutate snapshot1's circuit
    snapshot1.circuit.nodes[0].state = { isOn: 999 };

    // Mutate snapshot1's signals
    const switchASignals1 = snapshot1.signals.get('switchA');
    if (switchASignals1) {
      switchASignals1.set('out', 999);
    }

    // Verify snapshot2 is unaffected
    const switchA2 = snapshot2.circuit.nodes.find((n) => n.id === 'switchA')!;
    expect(switchA2.state?.isOn).toBe(1); // Not 999

    const switchASignals2 = snapshot2.signals.get('switchA');
    expect(switchASignals2?.get('out')).toBe(1); // Not 999
  });
});
