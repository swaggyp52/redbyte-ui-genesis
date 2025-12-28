// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import { LogicEngine } from '../../engine';
import { hashCircuitState } from '../stateHash';
import { createRecorder } from '../recorder';
import { runReplay, type EngineFactory } from '../replay';

describe('Recorder (PR5: Record Harness)', () => {
  // Engine factory for consistent engine creation
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

  it('Test 1: recorded log replays to same hash', () => {
    // Build a test circuit
    const testCircuit = createTestCircuit();

    // Deterministic clock (auto-incrementing timestamps)
    let t = 1000;
    const clock = () => t++;

    // Start recorder with deterministic clock
    const recorder = createRecorder({ clock });

    // ========== LIVE RUN ==========
    // Deep clone for live simulation
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit));
    const liveEngine = engineFactory(liveCircuit);

    // Emit circuit_loaded event
    recorder.recordCircuitLoaded(testCircuit);

    // Live sequence: toggle switch A, tick, toggle switch B, tick
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

    // Compute final live hash
    const hashLiveFinal = hashCircuitState(liveCircuit);

    // ========== REPLAY RUN ==========
    // Get recorded log
    const recordedLog = recorder.getLog();

    // Validate encode/decode round-trip (serialize and deserialize)
    const encoded = JSON.stringify(recordedLog);
    const decoded = JSON.parse(encoded);

    // Replay from decoded log
    const replayResult = runReplay(decoded, engineFactory);

    // Compute final replay hash
    const hashReplayFinal = hashCircuitState(replayResult.circuit);

    // ========== ASSERTIONS ==========
    // Core proof: recorded live hash === replayed hash
    expect(hashLiveFinal).toBe(hashReplayFinal);

    // Sanity: verify both switches ended up on → AND gate outputs 1
    expect(replayResult.engine.signals.get('switchA')?.get('out')).toBe(1);
    expect(replayResult.engine.signals.get('switchB')?.get('out')).toBe(1);
    expect(replayResult.engine.signals.get('andGate')?.get('out')).toBe(1);
  });

  it('Test 2: recorder produces strictly increasing timestamps', () => {
    // Deterministic clock
    let t = 2000;
    const clock = () => t++;

    const recorder = createRecorder({ clock });

    const testCircuit = createTestCircuit();

    // Record a sequence of events
    recorder.recordCircuitLoaded(testCircuit);
    recorder.recordInputToggled('switchA', 'out', 1);
    recorder.recordSimulationTick(1);
    recorder.recordInputToggled('switchB', 'out', 1);
    recorder.recordSimulationTick(1);

    // Get the log
    const log = recorder.getLog();

    // Verify timestamps are strictly increasing
    const timestamps = log.events.map((e) => e.timestamp);

    expect(timestamps).toEqual([2000, 2001, 2002, 2003, 2004]);

    // Verify monotonic property (each timestamp > previous)
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });

  it('Test 3: log is immutable / stable', () => {
    // Deterministic clock
    let t = 3000;
    const clock = () => t++;

    const recorder = createRecorder({ clock });

    const testCircuit = createTestCircuit();

    // Record initial event
    recorder.recordCircuitLoaded(testCircuit);

    // Get first snapshot
    const snapshot1 = recorder.getLog();

    // Record more events
    recorder.recordInputToggled('switchA', 'out', 1);
    recorder.recordSimulationTick(1);

    // Get second snapshot
    const snapshot2 = recorder.getLog();

    // ========== ASSERTIONS ==========

    // 1. First snapshot should be stable (not affected by subsequent recordings)
    expect(snapshot1.events.length).toBe(1);
    expect(snapshot1.events[0].type).toBe('circuit_loaded');

    // 2. Second snapshot should have all events
    expect(snapshot2.events.length).toBe(3);

    // 3. Mutating returned snapshot should NOT affect recorder's internal state
    snapshot2.events.push({
      type: 'simulation_tick',
      tickIndex: 999,
      dt: 1,
      timestamp: 9999,
    });

    const snapshot3 = recorder.getLog();
    expect(snapshot3.events.length).toBe(3); // Still 3, not affected by mutation

    // 4. Metadata immutability check
    const recorderWithMeta = createRecorder({
      clock,
      metadata: { description: 'test' },
    });

    recorderWithMeta.recordCircuitLoaded(testCircuit);
    const metaSnapshot = recorderWithMeta.getLog();

    // Mutate returned metadata
    if (metaSnapshot.metadata) {
      metaSnapshot.metadata.description = 'mutated';
    }

    // Verify internal metadata unchanged
    const metaSnapshot2 = recorderWithMeta.getLog();
    expect(metaSnapshot2.metadata?.description).toBe('test');
  });

  it('recorder respects stop() method', () => {
    let t = 4000;
    const clock = () => t++;

    const recorder = createRecorder({ clock });

    const testCircuit = createTestCircuit();

    // Record one event
    recorder.recordCircuitLoaded(testCircuit);
    expect(recorder.isRecording()).toBe(true);

    // Stop recording
    recorder.stop();
    expect(recorder.isRecording()).toBe(false);

    // Attempt to record more events (should be no-ops)
    recorder.recordInputToggled('switchA', 'out', 1);
    recorder.recordSimulationTick(1);

    // Log should only contain the first event
    const log = recorder.getLog();
    expect(log.events.length).toBe(1);
    expect(log.events[0].type).toBe('circuit_loaded');
  });

  it('recorder handles complex multi-event scenario', () => {
    // Deterministic clock
    let t = 5000;
    const clock = () => t++;

    const recorder = createRecorder({
      clock,
      metadata: { description: 'Complex scenario test' },
    });

    const testCircuit = createTestCircuit();
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit));
    const liveEngine = engineFactory(liveCircuit);

    // Record circuit load
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

    const hashLive = hashCircuitState(liveCircuit);

    // Replay from recorded log
    const recordedLog = recorder.getLog();
    const replayResult = runReplay(recordedLog, engineFactory);
    const hashReplay = hashCircuitState(replayResult.circuit);

    // Core proof
    expect(hashLive).toBe(hashReplay);

    // Verify event count
    expect(recordedLog.events.length).toBe(9); // 1 circuit_loaded + 4 input_toggled + 4 simulation_tick

    // Verify metadata preserved
    expect(recordedLog.metadata?.description).toBe('Complex scenario test');
  });
});
