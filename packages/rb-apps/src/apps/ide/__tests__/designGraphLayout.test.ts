import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { arrangeCircuitByDependency, hasRunnableBoundaryPath } from '../designGraphLayout';

const circuit: Circuit = {
  nodes: [
    { id: 'sum', type: 'OUTPUT', label: 'SUM', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
    { id: 'a', type: 'INPUT', label: 'A', position: { x: 420, y: 200 }, rotation: 0, config: {}, state: {} },
    { id: 'xor', type: 'XOR', label: 'A XOR B', position: { x: 80, y: 20 }, rotation: 0, config: {}, state: {} },
    { id: 'b', type: 'INPUT', label: 'B', position: { x: 380, y: 40 }, rotation: 0, config: {}, state: {} },
  ],
  connections: [
    { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'xor', portName: 'a' } },
    { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'xor', portName: 'b' } },
    { from: { nodeId: 'xor', portName: 'out' }, to: { nodeId: 'sum', portName: 'in' } },
  ],
};

describe('design graph layout', () => {
  it('recognizes a supported input-to-output path', () => {
    expect(hasRunnableBoundaryPath(circuit)).toBe(true);
    expect(hasRunnableBoundaryPath({ ...circuit, connections: circuit.connections.slice(0, 2) })).toBe(false);
  });

  it('arranges boundary inputs, dependency layers, and outputs without changing graph semantics', () => {
    const arranged = arrangeCircuitByDependency(circuit);
    const byId = new Map(arranged.nodes.map((node) => [node.id, node]));

    expect(byId.get('a')?.position?.x).toBe(byId.get('b')?.position?.x);
    expect(byId.get('a')!.position!.x).toBeLessThan(byId.get('xor')!.position!.x);
    expect(byId.get('xor')!.position!.x).toBeLessThan(byId.get('sum')!.position!.x);
    expect(arranged.connections).toEqual(circuit.connections);
    expect(arranged.nodes.map(({ id, type, label, config, state }) => ({ id, type, label, config, state })))
      .toEqual(circuit.nodes.map(({ id, type, label, config, state }) => ({ id, type, label, config, state })));
  });

  it('is deterministic and idempotent', () => {
    const first = arrangeCircuitByDependency(circuit);
    expect(arrangeCircuitByDependency(circuit)).toEqual(first);
    expect(arrangeCircuitByDependency(first)).toEqual(first);
  });
});
