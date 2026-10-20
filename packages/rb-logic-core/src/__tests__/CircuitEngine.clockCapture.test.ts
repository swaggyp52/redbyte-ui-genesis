import { describe, expect, it, vi } from 'vitest';
import { CircuitEngine } from '../CircuitEngine';
import { createEvaluationTraceCollector } from '../observation';
import { NodeRegistry } from '../NodeRegistry';
import { ClockBehavior, DelayBehavior } from '../builtins';
import '../index';
import type { Circuit, Connection } from '../types';

function wire(from: string, to: string, port: string, sourcePort = 'out'): Connection {
  return { from: { nodeId: from, portName: sourcePort }, to: { nodeId: to, portName: port } };
}

function pipeline(type = 'DFlipFlop', reverse = false, invert = false): Circuit {
  const nodes: Circuit['nodes'] = [
    { id: 'd', type: 'Switch', state: { isOn: 1 } },
    { id: 'clk', type: 'Switch', state: { isOn: 0 } },
    { id: 'first', type, config: { width: 1 } },
    { id: 'second', type, config: { width: 1 } },
    ...(invert ? [{ id: 'inverter', type: 'NOT' }] : []),
    { id: 'output', type: 'Lamp' },
  ];
  const dataPort = type === 'TFlipFlop' ? 'T' : type === 'JKFlipFlop' ? 'J' : 'D';
  return {
    nodes: reverse ? nodes.reverse() : nodes,
    connections: [
      wire('d', 'first', dataPort), wire('clk', 'first', 'CLK'), wire('clk', 'second', 'CLK'),
      ...(invert ? [wire('first', 'inverter', 'in', 'Q'), wire('inverter', 'second', dataPort)]
        : [wire('first', 'second', dataPort, 'Q')]),
      wire('second', 'output', 'in', 'Q'),
    ],
  };
}

describe('clock capture barrier', () => {
  it.each(['DFlipFlop', 'Register1', 'RegisterBus', 'StateBank', 'TFlipFlop', 'JKFlipFlop'])
  ('captures both %s devices from prior state, independently of node array order', type => {
    for (const reverse of [false, true]) {
      const engine = new CircuitEngine(pipeline(type, reverse));
      engine.setNodeValue('clk', 1);
      engine.tick();
      expect(engine.getNodeState('first')?.q).toBe(1);
      expect(engine.getNodeState('second')?.q).toBe(0);
      expect(engine.getNodeState('output')?.isOn).toBe(0);
      engine.setNodeValue('clk', 0);
      engine.tick();
      engine.setNodeValue('clk', 1);
      engine.tick();
      expect(engine.getNodeState('second')?.q).toBe(1);
      expect(engine.getNodeState('output')?.isOn).toBe(1);
    }
  });

  it('freezes a combinational data cone before capture and settles outputs after commit', () => {
    const collector = createEvaluationTraceCollector();
    const engine = new CircuitEngine(pipeline('DFlipFlop', true, true));
    engine.setNodeValue('clk', 1);
    engine.tick(collector.forContext({ phase: 'macro-high-sample', tick: 0 }));
    expect(engine.getNodeState('first')?.q).toBe(1);
    expect(engine.getNodeState('second')?.q).toBe(1); // NOT(prior first.Q=0)
    expect(engine.getNodeOutputs('inverter').out).toBe(0); // NOT(committed first.Q=1)
    expect(engine.getNodeState('output')?.isOn).toBe(1);
    const trace = collector.snapshot();
    expect(trace.events.find(event => event.nodeId === 'second')).toMatchObject({
      evaluationPhase: 'capture', inputs: { D: 1, CLK: 1 }, stateBefore: { q: 0 }, stateAfter: { q: 1 },
    });
    expect(trace.events.filter(event => event.nodeId === 'inverter').map(event => event.outputs.out)).toEqual([1, 0]);
    expect(trace.events.filter(event => event.nodeId === 'inverter').map(event => event.evaluationPhase)).toEqual(['before-capture', 'after-capture']);
    expect(trace.events.find(event => event.nodeId === 'inverter')?.inputReads[0].origin).toBe('prior-state');
  });

  it('seeds initial Q and complementary aliases from configured register state', () => {
    const circuit = pipeline('Register1');
    circuit.nodes.find(node => node.id === 'first')!.state = { q: 1, lastClk: 0 };
    const engine = new CircuitEngine(circuit);
    expect(engine.getNodeState('first')?.q).toBe(1);
    engine.setNodeValue('clk', 1);
    engine.tick();
    expect(engine.getNodeState('second')?.q).toBe(1);
  });

  it('keeps observation bounded at the capture barrier without omitting device commits', () => {
    const engine = new CircuitEngine(pipeline());
    engine.setNodeValue('clk', 1);
    const collector = createEvaluationTraceCollector({ maxEvents: 3 });
    const clone = vi.spyOn(globalThis, 'structuredClone');
    engine.tick(collector.forContext({ phase: 'macro-high-sample' }));
    expect(clone.mock.calls.length).toBeLessThanOrEqual(8); // At most one rejected snapshot.
    clone.mockRestore();
    expect(collector.snapshot()).toMatchObject({ status: 'truncated' });
    expect(collector.snapshot().events).toHaveLength(3);
    expect(engine.getNodeState('first')?.q).toBe(1);
    expect(engine.getNodeState('second')?.q).toBe(0);
  });

  it('does not advance Clock or Delay twice while settling clocked output cones', () => {
    const clockEvaluate = vi.fn(ClockBehavior.evaluate);
    const delayEvaluate = vi.fn(DelayBehavior.evaluate);
    NodeRegistry.register('Clock', { evaluate: clockEvaluate });
    NodeRegistry.register('Delay', { evaluate: delayEvaluate });
    const circuit = pipeline();
    circuit.nodes.find(node => node.id === 'clk')!.type = 'Clock';
    circuit.nodes.find(node => node.id === 'clk')!.config = { period: 4 };
    circuit.nodes.push({ id: 'delay', type: 'Delay', config: { delay: 1 } });
    circuit.connections.push(wire('first', 'delay', 'in', 'Q'));
    const engine = new CircuitEngine(circuit);
    clockEvaluate.mockClear(); delayEvaluate.mockClear();
    engine.tick();
    expect(clockEvaluate).toHaveBeenCalledOnce();
    expect(delayEvaluate).toHaveBeenCalledOnce();
    NodeRegistry.register('Clock', ClockBehavior);
    NodeRegistry.register('Delay', DelayBehavior);
  });
});
