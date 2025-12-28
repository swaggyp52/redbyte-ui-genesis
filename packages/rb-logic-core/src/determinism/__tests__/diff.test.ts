// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import { LogicEngine } from '../../engine';
import { diffState } from '../diff';
import { getStateAtIndex } from '../inspector';
import {
  createEventLog,
  appendEvent,
  createCircuitLoadedEvent,
  createInputToggledEvent,
  createSimulationTickEvent,
} from '../eventLog';
import type { EngineFactory } from '../replay';

describe('diffState (PR9: State Diffing)', () => {
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

  it('Test 1: diffState shows no changes for identical snapshots', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 1000));

    const snapshot1 = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    const snapshot2 = getStateAtIndex(testCircuit, log, 0, { engineFactory });

    const diff = diffState(snapshot1, snapshot2);

    expect(diff.hasChanges).toBe(false);
    expect(diff.nodesAdded).toHaveLength(0);
    expect(diff.nodesRemoved).toHaveLength(0);
    expect(diff.nodeStateChanges).toHaveLength(0);
    expect(diff.signalChanges).toHaveLength(0);
    expect(diff.connectionChanges).toHaveLength(0);
  });

  it('Test 2: diffState detects node state changes (switch toggle)', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 2000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 2001));

    const before = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    const after = getStateAtIndex(testCircuit, log, 1, { engineFactory });

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.nodeStateChanges).toHaveLength(1);

    const change = diff.nodeStateChanges[0];
    expect(change.nodeId).toBe('switchA');
    expect(change.nodeType).toBe('SWITCH');
    expect(change.stateBefore.isOn).toBe(0);
    expect(change.stateAfter.isOn).toBe(1);
    expect(change.changedKeys).toContain('isOn');
  });

  it('Test 3: diffState detects signal changes', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 3000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 3001));

    const before = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    const after = getStateAtIndex(testCircuit, log, 1, { engineFactory });

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.signalChanges.length).toBeGreaterThan(0);

    // Find the switchA output signal change
    const switchAChange = diff.signalChanges.find(
      (c) => c.nodeId === 'switchA' && c.portName === 'out'
    );
    expect(switchAChange).toBeDefined();
    expect(switchAChange!.valueBefore).toBe(0);
    expect(switchAChange!.valueAfter).toBe(1);
  });

  it('Test 4: diffState detects multiple signal changes after tick', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 4000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 4001));
    log = appendEvent(log, createInputToggledEvent('switchB', 'out', 1, 4002));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 4003));

    const before = getStateAtIndex(testCircuit, log, 2, { engineFactory });
    const after = getStateAtIndex(testCircuit, log, 3, { engineFactory });

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);

    // After tick, AND gate output should change from 0 to 1
    const andGateChange = diff.signalChanges.find(
      (c) => c.nodeId === 'andGate' && c.portName === 'out'
    );
    expect(andGateChange).toBeDefined();
    expect(andGateChange!.valueBefore).toBe(0);
    expect(andGateChange!.valueAfter).toBe(1);
  });

  it('Test 5: diffState detects node additions', () => {
    const testCircuit = createTestCircuit();

    // Create modified circuit with an extra node
    const modifiedCircuit = JSON.parse(JSON.stringify(testCircuit)) as Circuit;
    modifiedCircuit.nodes.push({
      id: 'extraSwitch',
      type: 'SWITCH',
      position: { x: 500, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 0 },
    });

    // Build two separate logs
    let log1 = createEventLog();
    log1 = appendEvent(log1, createCircuitLoadedEvent(testCircuit, 5000));

    let log2 = createEventLog();
    log2 = appendEvent(log2, createCircuitLoadedEvent(modifiedCircuit, 5000));

    const before = getStateAtIndex(testCircuit, log1, 0, { engineFactory });
    const after = getStateAtIndex(modifiedCircuit, log2, 0, { engineFactory });

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.nodesAdded).toHaveLength(1);
    expect(diff.nodesAdded[0].nodeId).toBe('extraSwitch');
    expect(diff.nodesAdded[0].nodeType).toBe('SWITCH');
  });

  it('Test 6: diffState detects node removals', () => {
    const testCircuit = createTestCircuit();

    // Create modified circuit with one node removed
    const modifiedCircuit = JSON.parse(JSON.stringify(testCircuit)) as Circuit;
    modifiedCircuit.nodes = modifiedCircuit.nodes.filter((n) => n.id !== 'switchB');

    let log1 = createEventLog();
    log1 = appendEvent(log1, createCircuitLoadedEvent(testCircuit, 6000));

    let log2 = createEventLog();
    log2 = appendEvent(log2, createCircuitLoadedEvent(modifiedCircuit, 6000));

    const before = getStateAtIndex(testCircuit, log1, 0, { engineFactory });
    const after = getStateAtIndex(modifiedCircuit, log2, 0, { engineFactory });

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.nodesRemoved).toHaveLength(1);
    expect(diff.nodesRemoved[0].nodeId).toBe('switchB');
    expect(diff.nodesRemoved[0].nodeType).toBe('SWITCH');
  });

  it('Test 7: diffState detects connection additions', () => {
    const testCircuit = createTestCircuit();

    // Create modified circuit with extra connection
    const modifiedCircuit = JSON.parse(JSON.stringify(testCircuit)) as Circuit;
    modifiedCircuit.nodes.push({
      id: 'extraSwitch',
      type: 'SWITCH',
      position: { x: 500, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 0 },
    });
    modifiedCircuit.connections.push({
      from: { nodeId: 'extraSwitch', portName: 'out' },
      to: { nodeId: 'output', portName: 'in' },
    });

    let log1 = createEventLog();
    log1 = appendEvent(log1, createCircuitLoadedEvent(testCircuit, 7000));

    let log2 = createEventLog();
    log2 = appendEvent(log2, createCircuitLoadedEvent(modifiedCircuit, 7000));

    const before = getStateAtIndex(testCircuit, log1, 0, { engineFactory });
    const after = getStateAtIndex(modifiedCircuit, log2, 0, { engineFactory });

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.connectionChanges.length).toBeGreaterThan(0);

    const addedConnection = diff.connectionChanges.find((c) => c.type === 'added');
    expect(addedConnection).toBeDefined();
    expect(addedConnection!.from.nodeId).toBe('extraSwitch');
    expect(addedConnection!.to.nodeId).toBe('output');
  });

  it('Test 8: diffState detects connection removals', () => {
    const testCircuit = createTestCircuit();

    // Create modified circuit with one connection removed
    const modifiedCircuit = JSON.parse(JSON.stringify(testCircuit)) as Circuit;
    modifiedCircuit.connections = modifiedCircuit.connections.filter(
      (c) => !(c.from.nodeId === 'switchA' && c.to.nodeId === 'andGate')
    );

    let log1 = createEventLog();
    log1 = appendEvent(log1, createCircuitLoadedEvent(testCircuit, 8000));

    let log2 = createEventLog();
    log2 = appendEvent(log2, createCircuitLoadedEvent(modifiedCircuit, 8000));

    const before = getStateAtIndex(testCircuit, log1, 0, { engineFactory });
    const after = getStateAtIndex(modifiedCircuit, log2, 0, { engineFactory });

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.connectionChanges.length).toBeGreaterThan(0);

    const removedConnection = diff.connectionChanges.find((c) => c.type === 'removed');
    expect(removedConnection).toBeDefined();
    expect(removedConnection!.from.nodeId).toBe('switchA');
    expect(removedConnection!.to.nodeId).toBe('andGate');
  });

  it('Test 9: diffState is deterministic (repeated calls return same result)', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 9000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 9001));

    const before = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    const after = getStateAtIndex(testCircuit, log, 1, { engineFactory });

    const diff1 = diffState(before, after);
    const diff2 = diffState(before, after);

    // Results should be identical
    expect(JSON.stringify(diff1)).toBe(JSON.stringify(diff2));
  });

  it('Test 10: diffState handles complex multi-change scenario', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 10000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 10001));
    log = appendEvent(log, createInputToggledEvent('switchB', 'out', 1, 10002));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 10003));

    const before = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    const after = getStateAtIndex(testCircuit, log, 3, { engineFactory });

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);

    // Should detect multiple node state changes
    expect(diff.nodeStateChanges.length).toBeGreaterThanOrEqual(2);

    const switchAChange = diff.nodeStateChanges.find((c) => c.nodeId === 'switchA');
    const switchBChange = diff.nodeStateChanges.find((c) => c.nodeId === 'switchB');

    expect(switchAChange).toBeDefined();
    expect(switchBChange).toBeDefined();

    expect(switchAChange!.stateAfter.isOn).toBe(1);
    expect(switchBChange!.stateAfter.isOn).toBe(1);

    // Should detect multiple signal changes
    expect(diff.signalChanges.length).toBeGreaterThan(0);
  });

  it('Test 11: diffState preserves immutability', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 11000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 11001));

    const before = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    const after = getStateAtIndex(testCircuit, log, 1, { engineFactory });

    // Deep clone for comparison
    const beforeCopy = JSON.parse(JSON.stringify(before));
    const afterCopy = JSON.parse(JSON.stringify(after));

    // Call diffState
    diffState(before, after);

    // Verify inputs are unchanged
    expect(JSON.stringify(before)).toBe(JSON.stringify(beforeCopy));
    expect(JSON.stringify(after)).toBe(JSON.stringify(afterCopy));
  });

  it('Test 12: diffState detects state key additions', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 12000));

    // Manually modify a node to add a new state key
    const before = getStateAtIndex(testCircuit, log, 0, { engineFactory });
    const after = getStateAtIndex(testCircuit, log, 0, { engineFactory });

    // Add new state key to 'after' snapshot
    const switchA = after.circuit.nodes.find((n) => n.id === 'switchA')!;
    switchA.state = { ...switchA.state, newKey: 'newValue' };

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.nodeStateChanges).toHaveLength(1);

    const change = diff.nodeStateChanges[0];
    expect(change.changedKeys).toContain('newKey');
  });

  it('Test 13: diffState detects state key removals', () => {
    const testCircuit = createTestCircuit();

    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 13000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 13001));

    const before = getStateAtIndex(testCircuit, log, 1, { engineFactory });
    const after = getStateAtIndex(testCircuit, log, 1, { engineFactory });

    // Remove state key from 'after' snapshot
    const switchA = after.circuit.nodes.find((n) => n.id === 'switchA')!;
    const { isOn, ...restState } = switchA.state ?? {};
    switchA.state = restState;

    const diff = diffState(before, after);

    expect(diff.hasChanges).toBe(true);
    expect(diff.nodeStateChanges).toHaveLength(1);

    const change = diff.nodeStateChanges[0];
    expect(change.changedKeys).toContain('isOn');
  });
});
