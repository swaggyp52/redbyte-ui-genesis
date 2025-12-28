// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import {
  encodeEventLog,
  decodeEventLog,
  createEventLog,
  appendEvent,
  createCircuitLoadedEvent,
  createInputToggledEvent,
  createSimulationTickEvent,
  createNodeStateModifiedEvent,
  type EventLogV1,
} from '../eventLog';

describe('eventLog', () => {
  const simpleCircuit: Circuit = {
    nodes: [
      {
        id: 'power1',
        type: 'POWER',
        position: { x: 0, y: 0 },
        rotation: 0,
        config: {},
      },
    ],
    connections: [],
  };

  describe('createEventLog', () => {
    it('creates an empty event log with version 1', () => {
      const log = createEventLog();

      expect(log.version).toBe(1);
      expect(log.events).toEqual([]);
      expect(log.metadata).toBeUndefined();
    });

    it('creates an event log with metadata', () => {
      const log = createEventLog({ description: 'Test session' });

      expect(log.metadata?.description).toBe('Test session');
    });
  });

  describe('appendEvent', () => {
    it('appends event to log immutably', () => {
      const log1 = createEventLog();
      const event = createSimulationTickEvent(0);
      const log2 = appendEvent(log1, event);

      expect(log1.events).toHaveLength(0); // Original unchanged
      expect(log2.events).toHaveLength(1);
      expect(log2.events[0]).toBe(event);
    });

    it('maintains event order', () => {
      let log = createEventLog();
      const event1 = createSimulationTickEvent(0, 1, 1000);
      const event2 = createSimulationTickEvent(1, 1, 2000);
      const event3 = createSimulationTickEvent(2, 1, 3000);

      log = appendEvent(log, event1);
      log = appendEvent(log, event2);
      log = appendEvent(log, event3);

      expect(log.events.map((e: any) => e.tickIndex)).toEqual([0, 1, 2]);
    });
  });

  describe('Event creators', () => {
    describe('createCircuitLoadedEvent', () => {
      it('creates circuit loaded event with circuit', () => {
        const event = createCircuitLoadedEvent(simpleCircuit, 12345);

        expect(event.type).toBe('circuit_loaded');
        expect(event.timestamp).toBe(12345);
        expect(event.circuit).toBe(simpleCircuit);
      });

      it('uses Date.now() if timestamp not provided', () => {
        const before = Date.now();
        const event = createCircuitLoadedEvent(simpleCircuit);
        const after = Date.now();

        expect(event.timestamp).toBeGreaterThanOrEqual(before);
        expect(event.timestamp).toBeLessThanOrEqual(after);
      });
    });

    describe('createInputToggledEvent', () => {
      it('creates input toggled event', () => {
        const event = createInputToggledEvent('power1', 'out', 1, 12345);

        expect(event.type).toBe('input_toggled');
        expect(event.timestamp).toBe(12345);
        expect(event.nodeId).toBe('power1');
        expect(event.portName).toBe('out');
        expect(event.value).toBe(1);
      });
    });

    describe('createSimulationTickEvent', () => {
      it('creates simulation tick event', () => {
        const event = createSimulationTickEvent(42, 1, 12345);

        expect(event.type).toBe('simulation_tick');
        expect(event.timestamp).toBe(12345);
        expect(event.tickIndex).toBe(42);
        expect(event.dt).toBe(1);
      });

      it('defaults dt to 1', () => {
        const event = createSimulationTickEvent(0, undefined, 12345);

        expect(event.dt).toBe(1);
      });
    });

    describe('createNodeStateModifiedEvent', () => {
      it('creates node state modified event', () => {
        const state = { q: 1, qBar: 0 };
        const event = createNodeStateModifiedEvent('ff1', state, 12345);

        expect(event.type).toBe('node_state_modified');
        expect(event.timestamp).toBe(12345);
        expect(event.nodeId).toBe('ff1');
        expect(event.state).toEqual({ q: 1, qBar: 0 });
      });
    });
  });

  describe('encodeEventLog', () => {
    it('encodes empty log to JSON', () => {
      const log = createEventLog();
      const encoded = encodeEventLog(log);

      expect(typeof encoded).toBe('string');
      expect(JSON.parse(encoded)).toEqual({
        version: 1,
        events: [],
      });
    });

    it('encodes log with events to JSON', () => {
      let log = createEventLog();
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createSimulationTickEvent(0, 1, 2000));

      const encoded = encodeEventLog(log);
      const parsed = JSON.parse(encoded);

      expect(parsed.version).toBe(1);
      expect(parsed.events).toHaveLength(2);
      expect(parsed.events[0].type).toBe('circuit_loaded');
      expect(parsed.events[1].type).toBe('simulation_tick');
    });

    it('encodes metadata', () => {
      const log = createEventLog({ description: 'Test', startTime: 0 });
      const encoded = encodeEventLog(log);
      const parsed = JSON.parse(encoded);

      expect(parsed.metadata).toEqual({
        description: 'Test',
        startTime: 0,
      });
    });
  });

  describe('decodeEventLog', () => {
    it('decodes valid event log JSON', () => {
      const original = createEventLog();
      const encoded = encodeEventLog(original);
      const decoded = decodeEventLog(encoded);

      expect(decoded.version).toBe(1);
      expect(decoded.events).toEqual([]);
    });

    it('throws on invalid JSON', () => {
      expect(() => decodeEventLog('not json')).toThrow();
    });

    it('throws on non-object JSON', () => {
      expect(() => decodeEventLog('"string"')).toThrow('not an object');
      expect(() => decodeEventLog('123')).toThrow('not an object');
      expect(() => decodeEventLog('null')).toThrow('not an object');
    });

    it('throws on unsupported version', () => {
      const invalid = JSON.stringify({ version: 2, events: [] });
      expect(() => decodeEventLog(invalid)).toThrow('Unsupported event log version: 2');
    });

    it('throws when events is not an array', () => {
      const invalid = JSON.stringify({ version: 1, events: 'not an array' });
      expect(() => decodeEventLog(invalid)).toThrow('events must be an array');
    });

    it('round-trips complex event log', () => {
      let log = createEventLog({ description: 'Complex test', startTime: 0 });
      log = appendEvent(log, createCircuitLoadedEvent(simpleCircuit, 1000));
      log = appendEvent(log, createInputToggledEvent('power1', 'out', 1, 2000));
      log = appendEvent(log, createSimulationTickEvent(0, 1, 3000));
      log = appendEvent(log, createNodeStateModifiedEvent('ff1', { q: 1 }, 4000));

      const encoded = encodeEventLog(log);
      const decoded = decodeEventLog(encoded);

      expect(decoded).toEqual(log);
    });
  });

  describe('Event log integrity', () => {
    it('preserves event order through encode/decode', () => {
      let log = createEventLog();

      for (let i = 0; i < 10; i++) {
        log = appendEvent(log, createSimulationTickEvent(i, 1, 1000 + i * 100));
      }

      const encoded = encodeEventLog(log);
      const decoded = decodeEventLog(encoded);

      const tickIndices = decoded.events.map((e: any) => e.tickIndex);
      expect(tickIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('preserves circuit structure through encode/decode', () => {
      const circuit: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'AND',
            position: { x: 10, y: 20 },
            rotation: 90,
            config: { inputs: 2 },
            state: { lastOutput: 0 },
          },
          {
            id: 'n2',
            type: 'OR',
            position: { x: 30, y: 40 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [
          {
            from: { nodeId: 'n1', portName: 'out' },
            to: { nodeId: 'n2', portName: 'in0' },
          },
        ],
      };

      const event = createCircuitLoadedEvent(circuit, 1000);
      let log = createEventLog();
      log = appendEvent(log, event);

      const encoded = encodeEventLog(log);
      const decoded = decodeEventLog(encoded);

      const decodedCircuit = (decoded.events[0] as any).circuit;
      expect(decodedCircuit).toEqual(circuit);
    });
  });
});
