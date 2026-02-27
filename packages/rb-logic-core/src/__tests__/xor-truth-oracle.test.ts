import { describe, expect, it } from 'vitest';
import type { Circuit } from '../types';
import { CircuitEngine } from '../CircuitEngine';
import '../index';

const XOR_ORACLE_CIRCUIT: Circuit = {
  nodes: [
    { id: 'sw0', type: 'INPUT', position: { x: 0, y: 0 }, config: {}, state: {} },
    { id: 'sw1', type: 'INPUT', position: { x: 0, y: 80 }, config: {}, state: {} },
    { id: 'xor', type: 'XOR', position: { x: 180, y: 40 }, config: {}, state: {} },
    { id: 'led', type: 'OUTPUT', position: { x: 360, y: 40 }, config: {}, state: {} },
  ],
  connections: [
    { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'xor', portName: 'a' } },
    { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'xor', portName: 'b' } },
    { from: { nodeId: 'xor', portName: 'out' }, to: { nodeId: 'led', portName: 'in' } },
  ],
};

describe('xor truth oracle', () => {
  it('matches XOR truth table for all 4 input combinations', () => {
    const engine = new CircuitEngine(XOR_ORACLE_CIRCUIT);
    const vectors = [
      { sw0: 0, sw1: 0, expected: 0 },
      { sw0: 0, sw1: 1, expected: 1 },
      { sw0: 1, sw1: 0, expected: 1 },
      { sw0: 1, sw1: 1, expected: 0 },
    ] as const;

    for (const vector of vectors) {
      engine.setNodeValue('sw0', vector.sw0);
      engine.setNodeValue('sw1', vector.sw1);
      engine.tick();

      expect(engine.getNodeValue('xor', 'out')).toBe(vector.expected);
      expect(engine.getNodeState('led')?.isOn ?? 0).toBe(vector.expected);
    }
  });
});
