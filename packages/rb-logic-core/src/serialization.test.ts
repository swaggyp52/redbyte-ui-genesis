// Copyright © 2025 Connor Angel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from './serialization';
import type { Circuit } from './types';

describe('Serialization', () => {
  it('should serialize and deserialize a circuit', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'n1',
          type: 'PowerSource',
          position: { x: 10, y: 20 },
          rotation: 45,
          config: { power: 1 },
        },
        {
          id: 'n2',
          type: 'Lamp',
          position: { x: 30, y: 20 },
          rotation: 0,
          config: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'n1', portName: 'out' },
          to: { nodeId: 'n2', portName: 'in' },
        },
      ],
    };

    const serialized = serialize(circuit);
    expect(serialized.version).toBe(1);
    expect(serialized.nodes).toHaveLength(2);
    expect(serialized.connections).toHaveLength(1);

    const deserialized = deserialize(serialized);
    expect(deserialized.nodes).toEqual(circuit.nodes);
    expect(deserialized.connections).toEqual(circuit.connections);
  });

  it('should round-trip through JSON string', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'clk',
          type: 'Clock',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: { period: 10 },
        },
      ],
      connections: [],
    };

    const serialized = serialize(circuit);
    const jsonString = JSON.stringify(serialized);
    const deserialized = deserialize(jsonString);

    expect(deserialized.nodes[0].config.period).toBe(10);
  });

  it('should preserve node state', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 's1',
          type: 'Switch',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: {},
          state: { isOn: 1 },
        },
      ],
      connections: [],
    };

    const serialized = serialize(circuit);
    const deserialized = deserialize(serialized);

    expect(deserialized.nodes[0].state).toEqual({ isOn: 1 });
  });
});
