// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import { LogicEngine } from '../../engine';
import { createRecorder } from '../recorder';
import { getStateAtIndex } from '../inspector';
import { stepForward, stepBackward, canStepForward, canStepBackward } from '../navigation';
import { diffState } from '../diff';
import type { EngineFactory } from '../replay';

/**
 * Integration Test for Milestone C: Inspectable Time Travel
 *
 * This test demonstrates the complete time travel workflow:
 * 1. Record a live session with multiple events
 * 2. Use inspector to query state at any point
 * 3. Use navigation to step through the timeline
 * 4. Use diffing to see what changed between states
 *
 * Acceptance criteria:
 * - Can navigate forward and backward through recorded events
 * - State at each index is deterministic and repeatable
 * - Diffs correctly identify changes between states
 * - All APIs compose cleanly without duplication
 */
describe('Time Travel Integration (PR10: Milestone C)', () => {
  const engineFactory: EngineFactory = (circuit) => new LogicEngine(circuit);

  /**
   * Test circuit: Two switches → AND gate → output
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

  it('E2E Test 1: Complete time travel workflow with recording, inspection, navigation, and diffing', () => {
    const testCircuit = createTestCircuit();

    // Deterministic clock for recording
    let t = 1000;
    const clock = () => t++;

    // Step 1: Record a live session
    const recorder = createRecorder({ clock });
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit)) as Circuit;
    const liveEngine = engineFactory(liveCircuit);

    // Record initial circuit
    recorder.recordCircuitLoaded(testCircuit);

    // Event 1: Toggle switchA on
    const switchA = liveCircuit.nodes.find((n) => n.id === 'switchA')!;
    switchA.state = { isOn: 1 };
    liveEngine.signals.get('switchA')!.set('out', 1);
    recorder.recordInputToggled('switchA', 'out', 1);

    // Event 2: Tick simulation
    liveEngine.tick(1, 0);
    recorder.recordSimulationTick(1);

    // Event 3: Toggle switchB on
    const switchB = liveCircuit.nodes.find((n) => n.id === 'switchB')!;
    switchB.state = { isOn: 1 };
    liveEngine.signals.get('switchB')!.set('out', 1);
    recorder.recordInputToggled('switchB', 'out', 1);

    // Event 4: Tick simulation
    liveEngine.tick(1, 1);
    recorder.recordSimulationTick(1);

    // Event 5: Toggle switchA off
    switchA.state = { isOn: 0 };
    liveEngine.signals.get('switchA')!.set('out', 0);
    recorder.recordInputToggled('switchA', 'out', 0);

    // Event 6: Tick simulation
    liveEngine.tick(1, 2);
    recorder.recordSimulationTick(1);

    recorder.stop();

    const eventLog = recorder.getLog();
    expect(eventLog.events.length).toBe(7); // circuit_loaded + 6 events

    // Step 2: Use inspector to query state at various points
    const snapshot0 = getStateAtIndex(testCircuit, eventLog, 0, { engineFactory }); // Initial state
    const snapshot2 = getStateAtIndex(testCircuit, eventLog, 2, { engineFactory }); // After first tick
    const snapshot4 = getStateAtIndex(testCircuit, eventLog, 4, { engineFactory }); // After both switches on + tick
    const snapshot6 = getStateAtIndex(testCircuit, eventLog, 6, { engineFactory }); // After switchA off + tick

    // Verify snapshot0 (initial state: both switches off)
    expect(snapshot0.circuit.nodes.find((n) => n.id === 'switchA')!.state?.isOn).toBe(0);
    expect(snapshot0.circuit.nodes.find((n) => n.id === 'switchB')!.state?.isOn).toBe(0);

    // Verify snapshot2 (switchA on, switchB off, after tick)
    expect(snapshot2.circuit.nodes.find((n) => n.id === 'switchA')!.state?.isOn).toBe(1);
    expect(snapshot2.circuit.nodes.find((n) => n.id === 'switchB')!.state?.isOn).toBe(0);

    // Verify snapshot4 (both switches on, after tick - AND gate should output 1)
    expect(snapshot4.circuit.nodes.find((n) => n.id === 'switchA')!.state?.isOn).toBe(1);
    expect(snapshot4.circuit.nodes.find((n) => n.id === 'switchB')!.state?.isOn).toBe(1);
    expect(snapshot4.signals.get('andGate')?.get('out')).toBe(1);

    // Verify snapshot6 (switchA off, switchB on, after tick - AND gate should output 0)
    expect(snapshot6.circuit.nodes.find((n) => n.id === 'switchA')!.state?.isOn).toBe(0);
    expect(snapshot6.circuit.nodes.find((n) => n.id === 'switchB')!.state?.isOn).toBe(1);
    expect(snapshot6.signals.get('andGate')?.get('out')).toBe(0);

    // Step 3: Use navigation to step through timeline
    let current = snapshot0;

    // Step forward through all events
    expect(canStepForward(current)).toBe(true);
    current = stepForward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(1);

    current = stepForward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(2);

    current = stepForward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(3);

    current = stepForward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(4);

    current = stepForward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(5);

    current = stepForward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(6);

    // At end of log
    expect(canStepForward(current)).toBe(false);
    expect(stepForward(testCircuit, eventLog, current, { engineFactory })).toBeNull();

    // Step backward through timeline
    expect(canStepBackward(current)).toBe(true);
    current = stepBackward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(5);

    current = stepBackward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(4);

    current = stepBackward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(3);

    current = stepBackward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(2);

    current = stepBackward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(1);

    current = stepBackward(testCircuit, eventLog, current, { engineFactory })!;
    expect(current.eventIndex).toBe(0);

    // At start of log
    expect(canStepBackward(current)).toBe(false);
    expect(stepBackward(testCircuit, eventLog, current, { engineFactory })).toBeNull();

    // Step 4: Use diffing to see what changed between states
    const diff0to2 = diffState(snapshot0, snapshot2);
    expect(diff0to2.hasChanges).toBe(true);
    expect(diff0to2.nodeStateChanges.length).toBeGreaterThan(0);
    const switchAChange = diff0to2.nodeStateChanges.find((c) => c.nodeId === 'switchA');
    expect(switchAChange).toBeDefined();
    expect(switchAChange!.stateAfter.isOn).toBe(1);

    const diff2to4 = diffState(snapshot2, snapshot4);
    expect(diff2to4.hasChanges).toBe(true);
    const switchBChange = diff2to4.nodeStateChanges.find((c) => c.nodeId === 'switchB');
    expect(switchBChange).toBeDefined();
    expect(switchBChange!.stateAfter.isOn).toBe(1);

    // Diff showing AND gate output change
    expect(diff2to4.signalChanges.length).toBeGreaterThan(0);
    const andGateSignalChange = diff2to4.signalChanges.find(
      (c) => c.nodeId === 'andGate' && c.portName === 'out'
    );
    expect(andGateSignalChange).toBeDefined();
    expect(andGateSignalChange!.valueBefore).toBe(0);
    expect(andGateSignalChange!.valueAfter).toBe(1);

    const diff4to6 = diffState(snapshot4, snapshot6);
    expect(diff4to6.hasChanges).toBe(true);
    const switchAOffChange = diff4to6.nodeStateChanges.find((c) => c.nodeId === 'switchA');
    expect(switchAOffChange).toBeDefined();
    expect(switchAOffChange!.stateBefore.isOn).toBe(1);
    expect(switchAOffChange!.stateAfter.isOn).toBe(0);

    // AND gate output should change from 1 to 0
    const andGateSignalChange2 = diff4to6.signalChanges.find(
      (c) => c.nodeId === 'andGate' && c.portName === 'out'
    );
    expect(andGateSignalChange2).toBeDefined();
    expect(andGateSignalChange2!.valueBefore).toBe(1);
    expect(andGateSignalChange2!.valueAfter).toBe(0);
  });

  it('E2E Test 2: Time travel inspection is deterministic (multiple passes produce identical results)', () => {
    const testCircuit = createTestCircuit();

    let t = 2000;
    const clock = () => t++;

    const recorder = createRecorder({ clock });
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit)) as Circuit;
    const liveEngine = engineFactory(liveCircuit);

    recorder.recordCircuitLoaded(testCircuit);

    const switchA = liveCircuit.nodes.find((n) => n.id === 'switchA')!;
    switchA.state = { isOn: 1 };
    liveEngine.signals.get('switchA')!.set('out', 1);
    recorder.recordInputToggled('switchA', 'out', 1);

    liveEngine.tick(1, 0);
    recorder.recordSimulationTick(1);

    recorder.stop();

    const eventLog = recorder.getLog();

    // First pass: step through timeline
    const pass1States = [];
    let current = getStateAtIndex(testCircuit, eventLog, 0, { engineFactory });
    pass1States.push(JSON.parse(JSON.stringify(current.circuit)));

    while (canStepForward(current)) {
      current = stepForward(testCircuit, eventLog, current, { engineFactory })!;
      pass1States.push(JSON.parse(JSON.stringify(current.circuit)));
    }

    // Second pass: step through timeline again
    const pass2States = [];
    current = getStateAtIndex(testCircuit, eventLog, 0, { engineFactory });
    pass2States.push(JSON.parse(JSON.stringify(current.circuit)));

    while (canStepForward(current)) {
      current = stepForward(testCircuit, eventLog, current, { engineFactory })!;
      pass2States.push(JSON.parse(JSON.stringify(current.circuit)));
    }

    // Results should be identical
    expect(pass1States.length).toBe(pass2States.length);
    for (let i = 0; i < pass1States.length; i++) {
      expect(JSON.stringify(pass1States[i])).toBe(JSON.stringify(pass2States[i]));
    }
  });

  it('E2E Test 3: Diffing is symmetric and transitive', () => {
    const testCircuit = createTestCircuit();

    let t = 3000;
    const clock = () => t++;

    const recorder = createRecorder({ clock });
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit)) as Circuit;
    const liveEngine = engineFactory(liveCircuit);

    recorder.recordCircuitLoaded(testCircuit);

    const switchA = liveCircuit.nodes.find((n) => n.id === 'switchA')!;
    switchA.state = { isOn: 1 };
    liveEngine.signals.get('switchA')!.set('out', 1);
    recorder.recordInputToggled('switchA', 'out', 1);

    liveEngine.tick(1, 0);
    recorder.recordSimulationTick(1);

    const switchB = liveCircuit.nodes.find((n) => n.id === 'switchB')!;
    switchB.state = { isOn: 1 };
    liveEngine.signals.get('switchB')!.set('out', 1);
    recorder.recordInputToggled('switchB', 'out', 1);

    liveEngine.tick(1, 1);
    recorder.recordSimulationTick(1);

    recorder.stop();

    const eventLog = recorder.getLog();

    const snapshot0 = getStateAtIndex(testCircuit, eventLog, 0, { engineFactory });
    const snapshot2 = getStateAtIndex(testCircuit, eventLog, 2, { engineFactory });
    const snapshot4 = getStateAtIndex(testCircuit, eventLog, 4, { engineFactory });

    // Symmetric: diff(A, A) should have no changes
    const diffSame = diffState(snapshot0, snapshot0);
    expect(diffSame.hasChanges).toBe(false);

    // Transitive: changes from 0→2 + 2→4 should include all changes from 0→4
    const diff0to2 = diffState(snapshot0, snapshot2);
    const diff2to4 = diffState(snapshot2, snapshot4);
    const diff0to4 = diffState(snapshot0, snapshot4);

    // All diffs should have changes
    expect(diff0to2.hasChanges).toBe(true);
    expect(diff2to4.hasChanges).toBe(true);
    expect(diff0to4.hasChanges).toBe(true);

    // diff0to4 should detect both switchA and switchB changes
    expect(diff0to4.nodeStateChanges.length).toBeGreaterThanOrEqual(2);
    const hasASwitchAChange = diff0to4.nodeStateChanges.some((c) => c.nodeId === 'switchA');
    const hasBChange = diff0to4.nodeStateChanges.some((c) => c.nodeId === 'switchB');
    expect(hasASwitchAChange).toBe(true);
    expect(hasBChange).toBe(true);
  });

  it('E2E Test 4: Complete navigation loop (forward to end, backward to start)', () => {
    const testCircuit = createTestCircuit();

    let t = 4000;
    const clock = () => t++;

    const recorder = createRecorder({ clock });
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit)) as Circuit;
    const liveEngine = engineFactory(liveCircuit);

    recorder.recordCircuitLoaded(testCircuit);

    // Record multiple events
    for (let i = 0; i < 5; i++) {
      const switchA = liveCircuit.nodes.find((n) => n.id === 'switchA')!;
      switchA.state = { isOn: i % 2 };
      liveEngine.signals.get('switchA')!.set('out', i % 2);
      recorder.recordInputToggled('switchA', 'out', i % 2);

      liveEngine.tick(1, i);
      recorder.recordSimulationTick(1);
    }

    recorder.stop();

    const eventLog = recorder.getLog();

    // Start at beginning
    let current = getStateAtIndex(testCircuit, eventLog, 0, { engineFactory });
    const startIndex = current.eventIndex;

    // Navigate to end
    const forwardPath = [current.eventIndex];
    while (canStepForward(current)) {
      current = stepForward(testCircuit, eventLog, current, { engineFactory })!;
      forwardPath.push(current.eventIndex);
    }

    const endIndex = current.eventIndex;

    // Navigate back to start
    const backwardPath = [current.eventIndex];
    while (canStepBackward(current)) {
      current = stepBackward(testCircuit, eventLog, current, { engineFactory })!;
      backwardPath.push(current.eventIndex);
    }

    // Should be back at start
    expect(current.eventIndex).toBe(startIndex);

    // Forward path should be ascending
    for (let i = 1; i < forwardPath.length; i++) {
      expect(forwardPath[i]).toBe(forwardPath[i - 1] + 1);
    }

    // Backward path should be descending
    for (let i = 1; i < backwardPath.length; i++) {
      expect(backwardPath[i]).toBe(backwardPath[i - 1] - 1);
    }

    // Should have visited all indices
    expect(forwardPath[forwardPath.length - 1]).toBe(endIndex);
    expect(backwardPath[backwardPath.length - 1]).toBe(startIndex);
  });
});
