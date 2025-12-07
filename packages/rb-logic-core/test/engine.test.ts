import { describe, it, expect } from 'vitest';
import type {
  Circuit,
  RuntimeNode,
  Connection,
  LogicValue
} from '../src/types';
import { serializeCircuit, deserializeCircuit } from '../src/serialize';
import { LogicEngine } from '../src/engine';
import { clearRegistry } from '../src/registry';
import { registerBuiltinNodes } from '../src/nodes';

function makeSimpleCircuit(): Circuit {
  const nodes: RuntimeNode[] = [
    {
      id: 'src',
      type: 'PowerSource',
      config: { on: true },
      state: {}
    },
    {
      id: 'wire',
      type: 'Wire',
      state: {}
    },
    {
      id: 'lamp',
      type: 'Lamp',
      state: {}
    }
  ];

  const connections: Connection[] = [
    {
      id: 'c1',
      from: { nodeId: 'src', port: 'out' },
      to: { nodeId: 'wire', port: 'in' }
    },
    {
      id: 'c2',
      from: { nodeId: 'wire', port: 'out' },
      to: { nodeId: 'lamp', port: 'in' }
    }
  ];

  return { nodes, connections };
}

describe('LogicEngine core behavior', () => {
  it('propagates signal from PowerSource through Wire to Lamp', () => {
    clearRegistry();
    registerBuiltinNodes();

    const circuit = makeSimpleCircuit();
    const engine = new LogicEngine(circuit, { tickRate: 20 });

    engine.step(1);

    expect(engine.getSignal('wire', 'out')).toBe(1);
    expect(engine.getSignal('lamp', 'out')).toBe(1);
  });

  it('Clock produces periodic signal', () => {
    clearRegistry();
    registerBuiltinNodes();

    const nodes: RuntimeNode[] = [
      {
        id: 'clock',
        type: 'Clock',
        config: { periodTicks: 4 },
        state: {}
      }
    ];

    const circuit: Circuit = {
      nodes,
      connections: []
    };

    const engine = new LogicEngine(circuit, { tickRate: 20 });

    const samples: LogicValue[] = [];
    for (let i = 0; i < 8; i++) {
      engine.step(1);
      samples.push(engine.getSignal('clock', 'out'));
    }

    expect(samples).toEqual([1, 1, 0, 0, 1, 1, 0, 0]);
  });

  it('Delay buffers input by configured ticks', () => {
    clearRegistry();
    registerBuiltinNodes();

    const nodes: RuntimeNode[] = [
      {
        id: 'src',
        type: 'PowerSource',
        config: { on: true },
        state: {}
      },
      {
        id: 'delay',
        type: 'Delay',
        config: { delayTicks: 2 },
        state: {}
      }
    ];

    const connections: Connection[] = [
      {
        id: 'c1',
        from: { nodeId: 'src', port: 'out' },
        to: { nodeId: 'delay', port: 'in' }
      }
    ];

    const circuit: Circuit = { nodes, connections };
    const engine = new LogicEngine(circuit, { tickRate: 20 });

    const outputs: LogicValue[] = [];
    for (let i = 0; i < 5; i++) {
      engine.step(1);
      outputs.push(engine.getSignal('delay', 'out'));
    }

    expect(outputs.slice(0, 2)).toEqual([0, 0]);
    expect(outputs[2]).toBe(1);
    expect(outputs[3]).toBe(1);
    expect(outputs[4]).toBe(1);
  });

  it('serialize/deserialize round-trip preserves circuit structure', () => {
    clearRegistry();
    registerBuiltinNodes();

    const original = makeSimpleCircuit();
    const schema = serializeCircuit(original);
    const restored = deserializeCircuit(schema);

    expect(restored.nodes.length).toBe(original.nodes.length);
    expect(restored.connections.length).toBe(original.connections.length);

    expect(
      restored.nodes.map((n) => ({
        id: n.id,
        type: n.type
      }))
    ).toEqual(
      original.nodes.map((n) => ({
        id: n.id,
        type: n.type
      }))
    );
  });
});
