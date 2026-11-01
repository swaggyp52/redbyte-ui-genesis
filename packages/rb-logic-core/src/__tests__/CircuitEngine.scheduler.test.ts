import { describe, expect, it } from 'vitest';
import { CircuitEngine } from '../CircuitEngine';
import '../index';
import type { Circuit } from '../types';

describe('CircuitEngine dependency ordering', () => {
  it.each([
    ['lamp', 'gate', 'input'],
    ['gate', 'input', 'lamp'],
    ['input', 'lamp', 'gate'],
  ])('counts one dependency when one source drives two target ports: %j', (...ids) => {
    const nodeById: Record<string, Circuit['nodes'][number]> = {
      lamp: { id: 'lamp', type: 'Lamp' },
      gate: { id: 'gate', type: 'AND' },
      input: { id: 'input', type: 'Switch', state: { isOn: 0 } },
    };
    const circuit: Circuit = {
      nodes: ids.map(id => nodeById[id]),
      connections: [
        { from: { nodeId: 'input', portName: 'out' }, to: { nodeId: 'gate', portName: 'a' } },
        { from: { nodeId: 'input', portName: 'out' }, to: { nodeId: 'gate', portName: 'b' } },
        { from: { nodeId: 'gate', portName: 'out' }, to: { nodeId: 'lamp', portName: 'in' } },
      ],
    };
    const engine = new CircuitEngine(circuit);
    engine.setNodeValue('input', 1);
    engine.tick();
    expect(engine.getEvaluationOrder()).toEqual(['input', 'gate', 'lamp']);
    expect(engine.getNodeOutputs('gate')).toEqual({ out: 1 });
    expect(engine.getNodeState('lamp')).toEqual({ isOn: 1 });
  });
});
