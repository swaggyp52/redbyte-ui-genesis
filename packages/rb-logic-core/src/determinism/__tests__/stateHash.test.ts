// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import type { Circuit } from '../../types';
import {
  normalizeCircuitState,
  serializeNormalizedState,
  hashCircuitState,
  normalizeRuntimeState,
  hashRuntimeState,
  type CircuitRuntimeState,
} from '../stateHash';

describe('stateHash', () => {
  describe('normalizeCircuitState', () => {
    it('sorts nodes by ID', () => {
      const circuit: Circuit = {
        nodes: [
          {
            id: 'c',
            type: 'LAMP',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
          {
            id: 'a',
            type: 'POWER',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
          {
            id: 'b',
            type: 'SWITCH',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [],
      };

      const normalized = normalizeCircuitState(circuit);

      expect(normalized.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    });

    it('sorts connections by stable key', () => {
      const circuit: Circuit = {
        nodes: [],
        connections: [
          {
            from: { nodeId: 'b', portName: 'out' },
            to: { nodeId: 'c', portName: 'in' },
          },
          {
            from: { nodeId: 'a', portName: 'out' },
            to: { nodeId: 'b', portName: 'in' },
          },
        ],
      };

      const normalized = normalizeCircuitState(circuit);

      expect(normalized.connections[0].from.nodeId).toBe('a');
      expect(normalized.connections[1].from.nodeId).toBe('b');
    });

    it('normalizes node config into sorted key-value pairs', () => {
      const circuit: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'GATE',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: { z: 3, a: 1, m: 2 },
          },
        ],
        connections: [],
      };

      const normalized = normalizeCircuitState(circuit);

      expect(normalized.nodes[0].config).toEqual([
        ['a', 1],
        ['m', 2],
        ['z', 3],
      ]);
    });

    it('normalizes node state into sorted key-value pairs', () => {
      const circuit: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'FLIP_FLOP',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
            state: { q: 1, qBar: 0 },
          },
        ],
        connections: [],
      };

      const normalized = normalizeCircuitState(circuit);

      expect(normalized.nodes[0].state).toEqual([
        ['q', 1],
        ['qBar', 0],
      ]);
    });

    it('handles nested config objects', () => {
      const circuit: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'COMPOSITE',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {
              nested: { z: 2, a: 1 },
              simple: 'value',
            },
          },
        ],
        connections: [],
      };

      const normalized = normalizeCircuitState(circuit);

      // Nested objects should be normalized recursively
      expect(normalized.nodes[0].config).toEqual([
        [
          'nested',
          [
            ['a', 1],
            ['z', 2],
          ],
        ],
        ['simple', 'value'],
      ]);
    });
  });

  describe('serializeNormalizedState', () => {
    it('produces deterministic JSON string', () => {
      const normalized = {
        nodes: [
          {
            id: 'a',
            type: 'POWER',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: [],
            state: [],
          },
        ],
        connections: [],
      };

      const serialized1 = serializeNormalizedState(normalized);
      const serialized2 = serializeNormalizedState(normalized);

      expect(serialized1).toBe(serialized2);
      expect(typeof serialized1).toBe('string');
    });
  });

  describe('hashCircuitState', () => {
    it('produces same hash for identical circuits', () => {
      const circuit: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'POWER',
            position: { x: 10, y: 20 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [],
      };

      const hash1 = hashCircuitState(circuit);
      const hash2 = hashCircuitState(circuit);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex is 64 chars
    });

    it('produces same hash for circuits with nodes in different order', () => {
      const circuit1: Circuit = {
        nodes: [
          {
            id: 'a',
            type: 'POWER',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
          {
            id: 'b',
            type: 'LAMP',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [],
      };

      const circuit2: Circuit = {
        nodes: [
          {
            id: 'b',
            type: 'LAMP',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
          {
            id: 'a',
            type: 'POWER',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [],
      };

      const hash1 = hashCircuitState(circuit1);
      const hash2 = hashCircuitState(circuit2);

      expect(hash1).toBe(hash2);
    });

    it('produces same hash for circuits with config keys in different order', () => {
      const circuit1: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'GATE',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: { a: 1, b: 2, c: 3 },
          },
        ],
        connections: [],
      };

      const circuit2: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'GATE',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: { c: 3, a: 1, b: 2 },
          },
        ],
        connections: [],
      };

      const hash1 = hashCircuitState(circuit1);
      const hash2 = hashCircuitState(circuit2);

      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different circuits', () => {
      const circuit1: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'POWER',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [],
      };

      const circuit2: Circuit = {
        nodes: [
          {
            id: 'n2',
            type: 'LAMP',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [],
      };

      const hash1 = hashCircuitState(circuit1);
      const hash2 = hashCircuitState(circuit2);

      expect(hash1).not.toBe(hash2);
    });

    it('produces different hash when node state changes', () => {
      const circuit1: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'FLIP_FLOP',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
            state: { q: 0 },
          },
        ],
        connections: [],
      };

      const circuit2: Circuit = {
        nodes: [
          {
            id: 'n1',
            type: 'FLIP_FLOP',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
            state: { q: 1 },
          },
        ],
        connections: [],
      };

      const hash1 = hashCircuitState(circuit1);
      const hash2 = hashCircuitState(circuit2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('normalizeRuntimeState', () => {
    it('sorts signals by node ID and port name', () => {
      const state: CircuitRuntimeState = {
        circuit: {
          nodes: [],
          connections: [],
        },
        signals: new Map([
          [
            'c',
            new Map([
              ['in', 1],
              ['out', 0],
            ]),
          ],
          [
            'a',
            new Map([
              ['out', 1],
            ]),
          ],
        ]),
      };

      const normalized = normalizeRuntimeState(state);

      expect(normalized.signals.map((s) => s.nodeId)).toEqual(['a', 'c']);
      expect(normalized.signals[1].ports).toEqual([
        ['in', 1],
        ['out', 0],
      ]);
    });
  });

  describe('hashRuntimeState', () => {
    it('produces same hash for identical runtime states', () => {
      const state: CircuitRuntimeState = {
        circuit: {
          nodes: [
            {
              id: 'n1',
              type: 'POWER',
              position: { x: 0, y: 0 },
              rotation: 0,
              config: {},
            },
          ],
          connections: [],
        },
        signals: new Map([['n1', new Map([['out', 1]])]]),
      };

      const hash1 = hashRuntimeState(state);
      const hash2 = hashRuntimeState(state);

      expect(hash1).toBe(hash2);
    });

    it('produces same hash regardless of Map iteration order', () => {
      const state1: CircuitRuntimeState = {
        circuit: { nodes: [], connections: [] },
        signals: new Map([
          ['a', new Map([['out', 1]])],
          ['b', new Map([['out', 0]])],
        ]),
      };

      const state2: CircuitRuntimeState = {
        circuit: { nodes: [], connections: [] },
        signals: new Map([
          ['b', new Map([['out', 0]])],
          ['a', new Map([['out', 1]])],
        ]),
      };

      const hash1 = hashRuntimeState(state1);
      const hash2 = hashRuntimeState(state2);

      expect(hash1).toBe(hash2);
    });

    it('produces different hash when signal values change', () => {
      const state1: CircuitRuntimeState = {
        circuit: { nodes: [], connections: [] },
        signals: new Map([['n1', new Map([['out', 0]])]]),
      };

      const state2: CircuitRuntimeState = {
        circuit: { nodes: [], connections: [] },
        signals: new Map([['n1', new Map([['out', 1]])]]),
      };

      const hash1 = hashRuntimeState(state1);
      const hash2 = hashRuntimeState(state2);

      expect(hash1).not.toBe(hash2);
    });
  });
});
