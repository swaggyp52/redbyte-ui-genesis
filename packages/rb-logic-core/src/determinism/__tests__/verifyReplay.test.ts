// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import { LogicEngine } from '../../engine';
import { createRecorder } from '../recorder';
import { verifyReplay } from '../verifyReplay';
import {
  createEventLog,
  appendEvent,
  createCircuitLoadedEvent,
  createInputToggledEvent,
  createSimulationTickEvent,
} from '../eventLog';
import type { EngineFactory } from '../replay';

describe('verifyReplay (PR6: Replay Verification Command)', () => {
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

  it('Test 1: verifyReplay returns equal: true for valid log', () => {
    const testCircuit = createTestCircuit();

    // Deterministic clock
    let t = 1000;
    const clock = () => t++;

    // Create a recorder and record a live session
    const recorder = createRecorder({ clock });

    // Deep clone for live simulation
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit));
    const liveEngine = engineFactory(liveCircuit);

    // Record the initial circuit
    recorder.recordCircuitLoaded(testCircuit);

    // Live session: toggle switch A on, tick, toggle switch B on, tick
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

    // Get the recorded log
    const recordedLog = recorder.getLog();

    // Verify the log using verifyReplay
    const result = verifyReplay(testCircuit, recordedLog, { engineFactory });

    // Core assertion: valid log should verify successfully
    expect(result.equal).toBe(true);
    expect(result.liveHash).toBe(result.replayHash);

    // Sanity check: hashes should be non-empty strings
    expect(result.liveHash).toBeTruthy();
    expect(typeof result.liveHash).toBe('string');
    expect(result.replayHash).toBeTruthy();
    expect(typeof result.replayHash).toBe('string');
  });

  it('Test 2: verifyReplay detects divergence (corrupted log)', () => {
    const testCircuit = createTestCircuit();

    // Build a valid event log
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 1000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 1001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 1002));
    log = appendEvent(log, createInputToggledEvent('switchB', 'out', 1, 1003));
    log = appendEvent(log, createSimulationTickEvent(1, 1, 1004));

    // Verify it's valid first
    const validResult = verifyReplay(testCircuit, log, { engineFactory });
    expect(validResult.equal).toBe(true);

    // Now create a corrupted version by using a DIFFERENT initial circuit
    // This simulates the case where the log's circuit_loaded event has a different circuit
    // than what we're verifying against
    const corruptedCircuit = createTestCircuit();
    // Add an extra node that's not in the log's circuit
    corruptedCircuit.nodes.push({
      id: 'extraNode',
      type: 'SWITCH',
      position: { x: 600, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 0 },
    });

    // Verify the same log against the corrupted initial circuit
    const result = verifyReplay(corruptedCircuit, log, { engineFactory });

    // Core assertion: should detect the mismatch
    // Live path: applies events to corruptedCircuit (has extraNode)
    // Replay path: uses circuit from log (no extraNode)
    expect(result.equal).toBe(false);
    expect(result.liveHash).not.toEqual(result.replayHash);

    // Both hashes should still be valid strings
    expect(result.liveHash).toBeTruthy();
    expect(result.replayHash).toBeTruthy();
  });

  it('Test 3: verifyReplay is repeatable', () => {
    const testCircuit = createTestCircuit();

    // Build an event log
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 2000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 2001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 2002));

    // Call verifyReplay twice
    const result1 = verifyReplay(testCircuit, log, { engineFactory });
    const result2 = verifyReplay(testCircuit, log, { engineFactory });

    // Core assertion: results should be identical
    expect(result1.liveHash).toBe(result2.liveHash);
    expect(result1.replayHash).toBe(result2.replayHash);
    expect(result1.equal).toBe(result2.equal);

    // Both should succeed
    expect(result1.equal).toBe(true);
    expect(result2.equal).toBe(true);
  });

  it('verifyReplay works with complex multi-event scenario', () => {
    const testCircuit = createTestCircuit();

    // Deterministic clock
    let t = 3000;
    const clock = () => t++;

    const recorder = createRecorder({ clock });

    // Live execution with complex scenario
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit));
    const liveEngine = engineFactory(liveCircuit);

    recorder.recordCircuitLoaded(testCircuit);

    // Complex scenario: toggle A on, tick, toggle B on, tick, toggle A off, tick, toggle A on, tick
    const switchA = liveCircuit.nodes.find((n) => n.id === 'switchA')!;
    const switchB = liveCircuit.nodes.find((n) => n.id === 'switchB')!;

    // Toggle A on
    switchA.state = { isOn: 1 };
    liveEngine.signals.get('switchA')!.set('out', 1);
    recorder.recordInputToggled('switchA', 'out', 1);
    liveEngine.tick(1, 0);
    recorder.recordSimulationTick(1);

    // Toggle B on
    switchB.state = { isOn: 1 };
    liveEngine.signals.get('switchB')!.set('out', 1);
    recorder.recordInputToggled('switchB', 'out', 1);
    liveEngine.tick(1, 1);
    recorder.recordSimulationTick(1);

    // Toggle A off
    switchA.state = { isOn: 0 };
    liveEngine.signals.get('switchA')!.set('out', 0);
    recorder.recordInputToggled('switchA', 'out', 0);
    liveEngine.tick(1, 2);
    recorder.recordSimulationTick(1);

    // Toggle A back on
    switchA.state = { isOn: 1 };
    liveEngine.signals.get('switchA')!.set('out', 1);
    recorder.recordInputToggled('switchA', 'out', 1);
    liveEngine.tick(1, 3);
    recorder.recordSimulationTick(1);

    const recordedLog = recorder.getLog();

    // Verify
    const result = verifyReplay(testCircuit, recordedLog, { engineFactory });

    expect(result.equal).toBe(true);
    expect(result.liveHash).toBe(result.replayHash);
  });

  it('verifyReplay uses default engine factory when not provided', () => {
    const testCircuit = createTestCircuit();

    // Build simple log
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 4000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 4001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 4002));

    // Call without engineFactory option (should use default LogicEngine)
    const result = verifyReplay(testCircuit, log);

    expect(result.equal).toBe(true);
    expect(result.liveHash).toBe(result.replayHash);
  });

  it('verifyReplay handles empty circuit (circuit_loaded only)', () => {
    const testCircuit = createTestCircuit();

    // Log with only circuit_loaded event
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 6000));

    const result = verifyReplay(testCircuit, log, { engineFactory });

    // Should still verify successfully (no events = no divergence)
    expect(result.equal).toBe(true);
  });

  it('verifyReplay detects circuit structure mismatch', () => {
    const testCircuit = createTestCircuit();

    // Build log
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 7000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 7001));

    // Create a different circuit (different structure)
    const differentCircuit = createTestCircuit();
    differentCircuit.nodes.push({
      id: 'extraSwitch',
      type: 'SWITCH',
      position: { x: 500, y: 0 },
      rotation: 0,
      config: {},
      state: { isOn: 0 },
    });

    // Verify log with different circuit
    const result = verifyReplay(differentCircuit, log, { engineFactory });

    // Should detect the mismatch
    expect(result.equal).toBe(false);
  });

  it('verifyReplay detects initial state mismatch', () => {
    const testCircuit = createTestCircuit();

    // Build log starting from default state (all switches OFF)
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 8000));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 8001));

    // Create circuit with different initial state
    const modifiedCircuit = createTestCircuit();
    modifiedCircuit.nodes[0].state = { isOn: 1 }; // switchA starts ON

    // Verify - should detect mismatch
    const result = verifyReplay(modifiedCircuit, log, { engineFactory });

    expect(result.equal).toBe(false);
  });
});
