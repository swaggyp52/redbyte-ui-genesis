import { describe, expect, it } from 'vitest';
import { normalizeConnection, serialize, type Circuit, type Connection, type ConnectionInput } from '@redbyte/rb-logic-core';
import { circuitTransform } from '../transforms/circuit-transform';
import { schematicTransform } from '../transforms/schematic-transform';
import { isometricTransform } from '../transforms/iso-transform';

const graph = (connections: Connection[]): Circuit => ({
  nodes: [
    { id: 'source', type: 'PowerSource', position: { x: 100, y: 20 }, rotation: 0, config: { value: 1 } },
    { id: 'gate', type: 'AND', position: { x: 260, y: 80 }, rotation: 0, config: {} },
  ], connections,
});
const freeze = (value: unknown): void => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
};
const projections = [
  { name: 'circuit', transform: circuitTransform },
  { name: 'schematic', transform: schematicTransform },
  { name: 'isometric', transform: isometricTransform },
];

describe('core-owned connection normalization across projections', () => {
  it.each(projections)('keeps equivalent canonical, pin-alias, port-alias, mixed and default wires in $name without source mutation', ({ transform }) => {
    const formats: Connection[] = [
      { from: { nodeId: 'source', portName: 'out' }, to: { nodeId: 'gate', portName: 'in' } },
      { id: 'retained-source-wire-id', from: 'source', fromPin: 'out', to: 'gate', toPin: 'in' },
      { from: 'source', fromPort: 'out', to: 'gate', toPort: 'in' },
      { from: { nodeId: 'source', portName: 'out' }, to: 'gate', toPin: 'in' },
      { from: 'source', to: 'gate' },
    ];
    const expected = transform(graph([formats[0]])).wires[0];
    for (const connection of formats) {
      const source = graph([connection]);
      const before = JSON.stringify(source);
      freeze(source);
      expect(transform(source).wires[0]).toEqual(expected);
      expect(JSON.stringify(source)).toBe(before);
      expect(JSON.stringify(serialize(source))).toBe(JSON.stringify(serialize(graph([formats[0]]))));
    }
    expect(expected.id).toBe('source.out-gate.in');
  });

  it('pins both existing 2D geometries and the Manhattan route', () => {
    const source = graph([{ from: 'source', to: 'gate' }]);
    expect(circuitTransform(source).wires).toEqual([{ id: 'source.out-gate.in', from: { x: 120, y: 20 }, to: { x: 236, y: 80 } }]);
    const from = { x: 100 + 40 * 1.2 / 2, y: 20 };
    const to = { x: 260 - 48 * 1.2 / 2, y: 80 };
    const midX = (from.x + to.x) / 2;
    expect(schematicTransform(source).wires).toEqual([{ id: 'source.out-gate.in', from, to,
      points: [from, { x: midX, y: 20 }, { x: midX, y: 80 }, to],
    }]);
  });

  it('pins the historical isometric coordinates, node placement, and custom port identity fallback', () => {
    const source = graph([{ from: 'source', to: 'gate' }]);
    expect(isometricTransform(source).wires).toEqual([{ id: 'source.out-gate.in', from: { x: 100, y: 70 }, to: { x: 156, y: 158 } }]);
    const custom = isometricTransform(graph([{ from: 'source', fromPin: 'Q', to: 'gate', toPort: 'b' }]));
    expect(custom.wires).toEqual([{ id: 'source.Q-gate.b', from: { x: 80, y: 60 }, to: { x: 180, y: 170 } }]);
    const stacked: Circuit = { nodes: [{ id: 'source', type: 'PowerSource' }, { id: 'gate', type: 'AND' }], connections: [{ from: 'source', to: 'gate' }] };
    expect(isometricTransform(stacked).wires).toEqual([{ id: 'source.out-gate.in', from: { x: 20, y: 10 }, to: { x: -16, y: -8 } }]);
    expect(stacked.nodes.map((node) => node.position)).toEqual([undefined, undefined]);
  });

  it('preserves endpoint-over-alias and pin-over-port precedence, including empty names and serialized bytes', () => {
    const connection: Connection = {
      from: { nodeId: 'source', portName: 'Q', port: 'legacy-Q' }, to: { nodeId: 'gate', portName: '', port: 'legacy-input' },
      fromPin: 'pin-Q', fromPort: 'port-Q', toPin: 'pin-in', toPort: 'port-in',
    };
    expect(normalizeConnection(connection)).toEqual({ from: { nodeId: 'source', portName: 'Q' }, to: { nodeId: 'gate', portName: '' } });
    expect(normalizeConnection({ from: 'source', to: 'gate', fromPin: 'pin-Q', fromPort: 'port-Q', toPin: 'pin-in', toPort: 'port-in' })).toEqual({ from: { nodeId: 'source', portName: 'pin-Q' }, to: { nodeId: 'gate', portName: 'pin-in' } });
    const serialized = serialize(graph([connection]));
    expect(serialized.connections).toEqual([{ from: { nodeId: 'source', portName: 'Q' }, to: { nodeId: 'gate', portName: '' } }]);
    const legacy: ConnectionInput = {
      from: { nodeId: 'source', port: 'out' }, to: { nodeId: 'gate', port: 'in' }, fromPin: 'ignored', toPin: 'ignored',
    };
    const before = JSON.stringify(legacy);
    freeze(legacy);
    const normalized = normalizeConnection(legacy);
    expect(normalized).toEqual({ from: { nodeId: 'source', portName: 'out' }, to: { nodeId: 'gate', portName: 'in' } });
    expect(normalizeConnection({ from: { nodeId: 'source' }, to: { nodeId: 'gate' }, fromPin: 'Q', toPort: 'b' })).toEqual({
      from: { nodeId: 'source', portName: 'Q' }, to: { nodeId: 'gate', portName: 'b' },
    });
    for (const { transform } of projections) expect(transform(graph([normalized])).wires[0].id).toBe('source.out-gate.in');
    expect(JSON.stringify(legacy)).toBe(before);
  });

  it.each(projections)('retains the indexed zero-coordinate placeholder for missing nodes in $name', ({ name, transform }) => {
    const source = graph([
      { from: 'absent', to: { nodeId: 'gate', portName: 'in' } },
      { from: { nodeId: 'source', portName: 'out' }, to: 'absent' },
      { from: 'absent', to: 'also-absent' },
    ]);
    const before = JSON.stringify(source);
    freeze(source);
    expect(transform(source).wires).toEqual([0, 1, 2].map((index) => ({ id: `wire_${index}`, from: { x: 0, y: 0 }, to: { x: 0, y: 0 }, ...(name === 'schematic' ? { points: [] } : {}) })));
    expect(JSON.stringify(source)).toBe(before);
  });
});
