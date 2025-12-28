// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import { LogicEngine } from '../../engine';
import {
  createEventLog,
  appendEvent,
  createCircuitLoadedEvent,
  createInputToggledEvent,
  createSimulationTickEvent,
  createNodeStateModifiedEvent,
} from '../eventLog';
import { runReplay, validateEventLog, type EngineFactory } from '../replay';

describe('replay', () => {
  // Engine factory for tests
  const engineFactory: EngineFactory = (circuit) => new LogicEngine(circuit);

  const simpleCircuit: Circuit = {
    nodes: [
      {
        id: 'power1',
        type: 'SWITCH',
        position: { x: 0, y: 0 },
        rotation: 0,
        config: {},
        state: { isOn: 0 },
      },
      {
        id: 'lamp1',
        type: 'LAMP',
        position: { x: 100, y: 0 },
        rotation: 0,
        config: {},
      },
    ],
    connections: [
      {
        from: { nodeId: 'power1', portName: 'out' },
        to: { nodeId: 'lamp1', portName: 'in' },
      },
    ],
  };

  describe('validateEventLog', () => {
    it('validates well-formed event log', () => {
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createSimulationTickEvent(0, 1, 2000));

      const result = validateEventLog(log);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects unsupported version', () => {
      const log: any = { version: 2, events: [] };
      const result = validateEventLog(log);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unsupported version: 2');
    });

    it('rejects empty event log', () => {
      const log = createEventLog();
      const result = validateEventLog(log);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least one event'))).toBe(true);
    });

    it('rejects log where first event is not circuit_loaded', () => {
      let log = createEventLog();
      log = appendEvent(log, createSimulationTickEvent(0, 1, 1000));

      const result = validateEventLog(log);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('First event must be circuit_loaded'))).toBe(
        true
      );
    });

    it('rejects log with out-of-order timestamps', () => {
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createSimulationTickEvent(0, 1, 3000));
      log = appendEvent(log, createSimulationTickEvent(1, 1, 2000)); // Out of order!

      const result = validateEventLog(log);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('out of order'))).toBe(true);
    });
  });

  describe('runReplay', () => {
    it('throws on unsupported version', () => {
      const log: any = { version: 2, events: [] };

      expect(() => runReplay(log, engineFactory)).toThrow('Unsupported event log version');
    });

    it('throws on empty event log', () => {
      const log = createEventLog();

      expect(() => runReplay(log, engineFactory)).toThrow('at least one circuit_loaded event');
    });

    it('throws when first event is not circuit_loaded', () => {
      let log = createEventLog();
      log = appendEvent(log, createSimulationTickEvent(0, 1, 1000));

      expect(() => runReplay(log, engineFactory)).toThrow('First event must be circuit_loaded');
    });

    it('replays circuit_loaded event only', () => {
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));

      const result = runReplay(log, engineFactory);

      expect(result.circuit).toEqual(simpleCircuit);
      expect(result.eventsProcessed).toBe(1);
      expect(result.engine).toBeDefined();
    });

    it('replays input_toggled event', () => {
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createInputToggledEvent('power1', 'out', 1, 2000));

      const result = runReplay(log, engineFactory);

      // Power node output should be set to 1
      const powerOutput = result.engine.signals.get('power1')?.get('out');
      expect(powerOutput).toBe(1);
    });

    it('replays simulation_tick event', () => {
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createInputToggledEvent('power1', 'out', 1, 2000));
      log = appendEvent(log, createSimulationTickEvent(0, 1, 3000));

      const result = runReplay(log, engineFactory);

      // After tick, lamp should output the received value
      const lampOutput = result.engine.signals.get('lamp1')?.get('out');
      expect(lampOutput).toBe(1);
    });

    it('replays node_state_modified event', () => {
      const circuitWithStatefulNode: Circuit = {
        nodes: [
          {
            id: 'ff1',
            type: 'D_FLIP_FLOP',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
            state: { q: 0 },
          },
        ],
        connections: [],
      };

      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(circuitWithStatefulNode, 1000));
      log = appendEvent(log, createNodeStateModifiedEvent('ff1', { q: 1 }, 2000));

      const result = runReplay(log, engineFactory);

      // Node state should be updated
      const ff1 = result.circuit.nodes.find((n) => n.id === 'ff1');
      expect(ff1?.state?.q).toBe(1);
    });

    it('replays complex event sequence', () => {
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createInputToggledEvent('power1', 'out', 1, 2000));
      log = appendEvent(log, createSimulationTickEvent(0, 1, 3000));
      log = appendEvent(log, createInputToggledEvent('power1', 'out', 0, 4000));
      log = appendEvent(log, createSimulationTickEvent(1, 1, 5000));

      const result = runReplay(log, engineFactory);

      expect(result.eventsProcessed).toBe(5);
      // Power should be off (0) after last toggle
      const powerOutput = result.engine.signals.get('power1')?.get('out');
      expect(powerOutput).toBe(0);
    });

    it('produces deterministic results for repeated replays', () => {
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createInputToggledEvent('power1', 'out', 1, 2000));
      log = appendEvent(log, createSimulationTickEvent(0, 1, 3000));

      const result1 = runReplay(log, engineFactory);
      const result2 = runReplay(log, engineFactory);

      // Circuits should be deeply equal
      expect(result1.circuit).toEqual(result2.circuit);

      // Signal states should match
      const power1_1 = result1.engine.signals.get('power1')?.get('out');
      const power1_2 = result2.engine.signals.get('power1')?.get('out');
      expect(power1_1).toBe(power1_2);

      const lamp1_1 = result1.engine.signals.get('lamp1')?.get('in');
      const lamp1_2 = result2.engine.signals.get('lamp1')?.get('in');
      expect(lamp1_1).toBe(lamp1_2);
    });

    it('handles multiple ticks correctly', () => {
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createInputToggledEvent('power1', 'out', 1, 2000));

      // Add 10 ticks
      for (let i = 0; i < 10; i++) {
        log = appendEvent(log, createSimulationTickEvent(i, 1, 3000 + i * 100));
      }

      const result = runReplay(log, engineFactory);

      expect(result.eventsProcessed).toBe(12); // 1 circuit_loaded + 1 input_toggled + 10 ticks
      // Power should still be on
      const powerOutput = result.engine.signals.get('power1')?.get('out');
      expect(powerOutput).toBe(1);
    });
  });

  describe('Replay correctness', () => {
    it('matches live simulation for simple switch-lamp circuit', () => {
      // Build "live" simulation
      const liveEngine = new LogicEngine(simpleCircuit);

      // Toggle switch on by setting state and signal (matching input_toggled behavior)
      const switchNode = simpleCircuit.nodes.find((n) => n.id === 'power1')!;
      switchNode.state = { isOn: 1 };
      liveEngine.signals.get('power1')!.set('out', 1);
      liveEngine.tick(1, 0);

      const livePowerOut = liveEngine.signals.get('power1')?.get('out');
      const liveLampOut = liveEngine.signals.get('lamp1')?.get('out');

      // Build replay log
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createInputToggledEvent('power1', 'out', 1, 2000));
      log = appendEvent(log, createSimulationTickEvent(0, 1, 3000));

      const replayResult = runReplay(log, engineFactory);
      const replayPowerOut = replayResult.engine.signals.get('power1')?.get('out');
      const replayLampOut = replayResult.engine.signals.get('lamp1')?.get('out');

      // Signals should match
      expect(replayPowerOut).toBe(livePowerOut);
      expect(replayLampOut).toBe(liveLampOut);
    });
  });
});
