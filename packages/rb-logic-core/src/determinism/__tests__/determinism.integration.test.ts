// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import { LogicEngine } from '../../engine';
import { hashCircuitState } from '../stateHash';
import {
  createEventLog,
  appendEvent,
  createCircuitLoadedEvent,
  createInputToggledEvent,
  createSimulationTickEvent,
} from '../eventLog';
import { runReplay, type EngineFactory } from '../replay';

describe('Determinism Integration (Milestone A Proof)', () => {
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

  it('proves hash(live) === hash(replay) for deterministic circuit evolution', () => {
    const testCircuit = createTestCircuit();

    // ========== LIVE RUN ==========
    // Simulate a "live" user session with direct engine manipulation
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit)); // Deep clone
    const liveEngine = engineFactory(liveCircuit);

    // Initial state hash
    const hashInitial = hashCircuitState(liveCircuit);

    // Action 1: Toggle switchA on
    const switchA = liveCircuit.nodes.find((n) => n.id === 'switchA')!;
    switchA.state = { isOn: 1 };
    liveEngine.signals.get('switchA')!.set('out', 1);

    // Action 2: Tick
    liveEngine.tick(1, 0);

    // Action 3: Toggle switchB on
    const switchB = liveCircuit.nodes.find((n) => n.id === 'switchB')!;
    switchB.state = { isOn: 1 };
    liveEngine.signals.get('switchB')!.set('out', 1);

    // Action 4: Tick
    liveEngine.tick(1, 1);

    // Final live hash
    const hashLive = hashCircuitState(liveCircuit);

    // ========== REPLAY RUN ==========
    // Build event log matching the live session
    let log = createEventLog({ description: 'PR4 determinism proof' });
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 1000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 1001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 1002));
    log = appendEvent(log, createInputToggledEvent('switchB', 'out', 1, 1003));
    log = appendEvent(log, createSimulationTickEvent(1, 1, 1004));

    // Run replay
    const replayResult = runReplay(log, engineFactory);
    const hashReplay = hashCircuitState(replayResult.circuit);

    // ========== ASSERTIONS ==========

    // 1. Core proof: live and replay produce identical final state
    expect(hashLive).toBe(hashReplay);

    // 2. Confidence: state actually changed from initial
    expect(hashLive).not.toBe(hashInitial);

    // 3. Sanity: verify final signal state matches expectations
    // Both switches on → AND gate outputs 1
    expect(replayResult.engine.signals.get('switchA')?.get('out')).toBe(1);
    expect(replayResult.engine.signals.get('switchB')?.get('out')).toBe(1);
    expect(replayResult.engine.signals.get('andGate')?.get('out')).toBe(1);
  });

  it('proves replay is repeatable (hash consistency across multiple runs)', () => {
    // Use fresh circuit copy for each replay
    const circuit1 = createTestCircuit();
    const circuit2 = createTestCircuit();

    // Build event log
    let log1 = createEventLog();
    log1 = appendEvent(log1, createCircuitLoadedEvent(circuit1, 2000));
    log1 = appendEvent(log1, createInputToggledEvent('switchA', 'out', 1, 2001));
    log1 = appendEvent(log1, createSimulationTickEvent(0, 1, 2002));

    let log2 = createEventLog();
    log2 = appendEvent(log2, createCircuitLoadedEvent(circuit2, 2000));
    log2 = appendEvent(log2, createInputToggledEvent('switchA', 'out', 1, 2001));
    log2 = appendEvent(log2, createSimulationTickEvent(0, 1, 2002));

    // Run replay twice
    const result1 = runReplay(log1, engineFactory);
    const result2 = runReplay(log2, engineFactory);

    const hash1 = hashCircuitState(result1.circuit);
    const hash2 = hashCircuitState(result2.circuit);

    // Replay must be deterministic
    expect(hash1).toBe(hash2);
  });

  it('detects state changes correctly (initial vs final hash)', () => {
    // Use fresh circuit
    const circuit = createTestCircuit();
    const hashBefore = hashCircuitState(circuit);

    // Build event log that modifies circuit
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(circuit, 3000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 3001));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 3002));

    const result = runReplay(log, engineFactory);
    const hashAfter = hashCircuitState(result.circuit);

    // Hash must change when circuit evolves
    expect(hashAfter).not.toBe(hashBefore);
  });

  it('handles complex multi-tick scenario deterministically', () => {
    const testCircuit = createTestCircuit();

    // ========== LIVE RUN ==========
    const liveCircuit = JSON.parse(JSON.stringify(testCircuit));
    const liveEngine = engineFactory(liveCircuit);

    // Scenario: toggle both switches on, tick, toggle A off, tick, toggle A on, tick
    const switchA = liveCircuit.nodes.find((n) => n.id === 'switchA')!;
    const switchB = liveCircuit.nodes.find((n) => n.id === 'switchB')!;

    // Turn both on
    switchA.state = { isOn: 1 };
    liveEngine.signals.get('switchA')!.set('out', 1);
    switchB.state = { isOn: 1 };
    liveEngine.signals.get('switchB')!.set('out', 1);
    liveEngine.tick(1, 0);

    // Turn A off
    switchA.state = { isOn: 0 };
    liveEngine.signals.get('switchA')!.set('out', 0);
    liveEngine.tick(1, 1);

    // Turn A back on
    switchA.state = { isOn: 1 };
    liveEngine.signals.get('switchA')!.set('out', 1);
    liveEngine.tick(1, 2);

    const hashLive = hashCircuitState(liveCircuit);

    // ========== REPLAY RUN ==========
    let log = createEventLog();
    log = appendEvent(log, createCircuitLoadedEvent(testCircuit, 4000));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 4001));
    log = appendEvent(log, createInputToggledEvent('switchB', 'out', 1, 4002));
    log = appendEvent(log, createSimulationTickEvent(0, 1, 4003));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 0, 4004));
    log = appendEvent(log, createSimulationTickEvent(1, 1, 4005));
    log = appendEvent(log, createInputToggledEvent('switchA', 'out', 1, 4006));
    log = appendEvent(log, createSimulationTickEvent(2, 1, 4007));

    const replayResult = runReplay(log, engineFactory);
    const hashReplay = hashCircuitState(replayResult.circuit);

    // Core proof
    expect(hashLive).toBe(hashReplay);

    // Final state: both switches on → AND outputs 1
    expect(replayResult.engine.signals.get('andGate')?.get('out')).toBe(1);
  });
});
