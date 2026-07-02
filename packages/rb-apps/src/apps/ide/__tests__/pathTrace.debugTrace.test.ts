import { describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import { buildDesignDebugSignalTrace } from '../pathTrace';

const circuit: Circuit = {
  nodes: [
    { id: 'a', type: 'Switch', label: 'A', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: {} },
    { id: 'b', type: 'Switch', label: 'B', position: { x: 0, y: 80 }, rotation: 0, config: {}, state: {} },
    { id: 'cin', type: 'Switch', label: 'CIN', position: { x: 0, y: 160 }, rotation: 0, config: {}, state: {} },
    { id: 'xor_ab', type: 'XOR', label: 'XOR_AB', position: { x: 140, y: 40 }, rotation: 0, config: {}, state: {} },
    { id: 'wrong_sum', type: 'OR', label: 'wrong_or_should_be_xor', position: { x: 280, y: 90 }, rotation: 0, config: {}, state: {} },
    { id: 'sum', type: 'Lamp', label: 'SUM_OUT', position: { x: 420, y: 90 }, rotation: 0, config: {}, state: {} },
  ],
  connections: [
    { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'xor_ab', portName: 'a' } },
    { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'xor_ab', portName: 'b' } },
    { from: { nodeId: 'xor_ab', portName: 'out' }, to: { nodeId: 'wrong_sum', portName: 'a' } },
    { from: { nodeId: 'cin', portName: 'out' }, to: { nodeId: 'wrong_sum', portName: 'b' } },
    { from: { nodeId: 'wrong_sum', portName: 'out' }, to: { nodeId: 'sum', portName: 'in' } },
  ],
};

describe('buildDesignDebugSignalTrace', () => {
  it('walks from a failed output through the direct driver and upstream inputs', () => {
    const trace = buildDesignDebugSignalTrace(circuit, {
      targetSignalKey: 'sum.in',
      resolveNodeLabel: (node: Node | undefined, nodeId: string) => node?.label ?? nodeId,
      resolveNodeTypeLabel: (node: Node | undefined) => node?.type ?? 'Signal',
      maxDepth: 4,
    });

    expect(trace?.targetLabel).toBe('SUM_OUT');
    expect(trace?.wireIds).toEqual([
      'wrong_sum.out-sum.in',
      'xor_ab.out-wrong_sum.a',
      'cin.out-wrong_sum.b',
      'a.out-xor_ab.a',
      'b.out-xor_ab.b',
    ]);

    expect(trace?.nodes.map((node) => `${node.depth}:${node.label}:${node.typeLabel}`)).toEqual([
      '0:SUM_OUT:Lamp',
      '1:wrong_or_should_be_xor:OR',
      '2:XOR_AB:XOR',
      '2:CIN:Switch',
      '3:A:Switch',
      '3:B:Switch',
    ]);
    expect(trace?.nodes.find((node) => node.nodeId === 'wrong_sum')?.upstreamLabels).toEqual([
      'XOR_AB',
      'CIN',
    ]);
    expect(trace?.nodes.find((node) => node.nodeId === 'xor_ab')?.upstreamLabels).toEqual([
      'A',
      'B',
    ]);
  });
});
