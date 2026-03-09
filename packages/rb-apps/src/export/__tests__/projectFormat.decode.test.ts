import { describe, expect, it } from 'vitest';
import { decodeRBProject } from '../projectFormat';

const VALID_PROJECT = {
  kind: 'rb-project',
  version: 1,
  createdAt: '2026-03-09T00:00:00.000Z',
  updatedAt: '2026-03-09T00:00:00.000Z',
  name: 'Legacy Import',
  circuit: {
    nodes: [
      { id: 'in_a', type: 'INPUT', x: 12, y: 24 },
      { id: 'out_y', type: 'OUTPUT', position: { x: 48, y: 72 } },
    ],
    connections: [
      {
        from: 'in_a',
        fromPort: 'out',
        to: 'out_y',
        toPort: 'in',
      },
    ],
  },
  ioMapping: {
    inputs: [
      { id: 'in_a', nodeId: 'in_a', port: 'out', label: 'in_a', pin: 'SW0' },
    ],
    outputs: [
      { id: 'out_y', nodeId: 'out_y', port: 'in', label: 'out_y', pin: 'LD0' },
    ],
  },
  vectors: [
    {
      tick: 0,
      inputs: { in_a: true },
      expected: { out_y: 1 },
    },
  ],
} as const;

describe('decodeRBProject', () => {
  it('normalizes legacy coordinates and string connection refs', () => {
    const decoded = decodeRBProject(JSON.stringify(VALID_PROJECT));

    expect(decoded.circuit.nodes[0]).toMatchObject({
      id: 'in_a',
      position: { x: 12, y: 24 },
      x: 12,
      y: 24,
      config: {},
      state: {},
    });
    expect(decoded.circuit.connections[0]).toEqual({
      from: { nodeId: 'in_a', portName: 'out' },
      to: { nodeId: 'out_y', portName: 'in' },
    });
    expect(decoded.vectors?.[0]).toEqual({
      tick: 0,
      inputs: { in_a: 1 },
      expected: { out_y: 1 },
    });
  });

  it('rejects projects without circuit arrays', () => {
    expect(() =>
      decodeRBProject(
        JSON.stringify({
          ...VALID_PROJECT,
          circuit: {
            nodes: null,
            connections: [],
          },
        })
      )
    ).toThrow('Invalid project: circuit must include nodes and connections arrays');
  });
});
