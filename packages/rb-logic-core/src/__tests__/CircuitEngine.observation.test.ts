import { describe, expect, it, vi } from 'vitest';
import { CircuitEngine } from '../CircuitEngine';
import { NodeRegistry } from '../NodeRegistry';
import { createEvaluationTraceCollector } from '../observation';
import '../index';
import type { Circuit, Connection } from '../types';

function wire(from: string, to: string, port = 'in', sourcePort = 'out'): Connection {
  return { from: { nodeId: from, portName: sourcePort }, to: { nodeId: to, portName: port } };
}

function cone(): Circuit {
  return {
    nodes: [
      { id: 'a', type: 'Switch', state: { isOn: 0 } },
      { id: 'b', type: 'Switch', state: { isOn: 0 } },
      { id: 'xor', type: 'XOR' }, { id: 'and', type: 'AND' },
      { id: 'join', type: 'OR' }, { id: 'result', type: 'Lamp' },
    ],
    connections: [
      wire('a', 'xor', 'a'), wire('b', 'xor', 'b'),
      wire('a', 'and', 'a'), wire('b', 'and', 'b'),
      wire('xor', 'join', 'a'), wire('and', 'join', 'b'), wire('join', 'result'),
    ],
  };
}

function engineSnapshot(engine: CircuitEngine) {
  return {
    signals: Object.fromEntries(engine.getAllSignals()),
    states: engine.getCircuit().nodes.map(node => [node.id, engine.getNodeState(node.id)]),
    issue: engine.getLastIssue(),
  };
}

describe('opt-in actual evaluation observations', () => {
  it('preserves every signal, state, issue, and tick result for fan-out and reconvergence', () => {
    const plain = new CircuitEngine(cone());
    const traced = new CircuitEngine(cone());
    const collector = createEvaluationTraceCollector();
    for (const [tick, [a, b]] of [[1, 0], [1, 1], [0, 1], [0, 0]].entries()) {
      for (const engine of [plain, traced]) {
        engine.setNodeValue('a', a); engine.setNodeValue('b', b);
      }
      const ordinaryChanged = plain.tick();
      const tracedChanged = traced.tick(collector.forContext({ tick, phase: 'combinational' }));
      expect(tracedChanged).toBe(ordinaryChanged);
      expect(engineSnapshot(traced)).toEqual(engineSnapshot(plain));
    }
    const trace = collector.snapshot();
    expect(trace.status).toBe('complete');
    expect(trace.events).toHaveLength(24);
    const unchanged = trace.events.find(event => event.nodeId === 'and' && event.context.tick === 0)!;
    expect(unchanged.inputs).toEqual({ a: 1, b: 0 });
    expect(unchanged.previousOutputs).toEqual({ out: 0 });
    expect(unchanged.outputs).toEqual({ out: 0 });
    expect(unchanged.inputReads[0]).toEqual({
      portName: 'a', driver: { nodeId: 'a', portName: 'out' }, value: 1,
      previousValue: 0, origin: 'current-evaluation',
    });
  });

  it('distinguishes presented data, capture, enabled hold, no-edge hold, and reset', () => {
    const circuit: Circuit = {
      nodes: [
        ...['d', 'clk', 'en', 'rst'].map(id => ({ id, type: 'Switch', state: { isOn: 0 } })),
        { id: 'ff', type: 'DFlipFlop' }, { id: 'q', type: 'Lamp' },
      ],
      connections: [wire('d', 'ff', 'D'), wire('clk', 'ff', 'CLK'), wire('en', 'ff', 'EN'),
        wire('rst', 'ff', 'RST'), wire('ff', 'q', 'in', 'Q')],
    };
    const plain = new CircuitEngine(structuredClone(circuit));
    const traced = new CircuitEngine(structuredClone(circuit));
    const collector = createEvaluationTraceCollector();
    const stimuli = [
      { d: 1, clk: 0, en: 1, rst: 0 }, // data presented, no edge
      { d: 1, clk: 1, en: 1, rst: 0 }, // capture
      { d: 0, clk: 1, en: 1, rst: 0 }, // high level holds
      { d: 0, clk: 0, en: 0, rst: 0 },
      { d: 0, clk: 1, en: 0, rst: 0 }, // edge while disabled holds
      { d: 1, clk: 1, en: 1, rst: 1 }, // asynchronous reset without another edge
    ];
    stimuli.forEach((inputs, tick) => {
      for (const engine of [plain, traced]) {
        Object.entries(inputs).forEach(([id, value]) => engine.setNodeValue(id, value));
      }
      expect(traced.tick(collector.forContext({ tick, phase: 'authored-clock' }))).toBe(plain.tick());
      expect(engineSnapshot(traced)).toEqual(engineSnapshot(plain));
    });
    const events = collector.snapshot().events.filter(event => event.nodeId === 'ff');
    expect(events.map(event => event.stateAfter.q)).toEqual([0, 1, 1, 1, 1, 0]);
    expect(events[0].inputs.D).toBe(1);
    expect(events[1].stateBefore.lastClk).toBe(0);
    expect(events[1].inputs.CLK).toBe(1);
    expect(events[4].inputs.EN).toBe(0);
    expect(events[4].stateBefore.q).toBe(events[4].stateAfter.q);
    expect(events[5].inputs.RST).toBe(1);
  });

  it('observes Register1 configured reset and enable without changing register-family state', () => {
    const circuit: Circuit = {
      nodes: [
        ...['d', 'clk', 'en', 'rst'].map(id => ({ id, type: 'Switch', state: { isOn: 0 } })),
        { id: 'register', type: 'Register1', config: { hasEnable: true, resetKind: 'async_clear' } },
      ],
      connections: [wire('d', 'register', 'D'), wire('clk', 'register', 'CLK'),
        wire('en', 'register', 'EN'), wire('rst', 'register', 'RST')],
    };
    const plain = new CircuitEngine(structuredClone(circuit));
    const traced = new CircuitEngine(structuredClone(circuit));
    const collector = createEvaluationTraceCollector();
    for (const [tick, inputs] of [
      { d: 1, clk: 1, en: 1, rst: 0 }, { d: 0, clk: 0, en: 0, rst: 0 },
      { d: 0, clk: 1, en: 0, rst: 0 }, { d: 1, clk: 1, en: 1, rst: 1 },
    ].entries()) {
      for (const engine of [plain, traced]) Object.entries(inputs).forEach(([id, value]) => engine.setNodeValue(id, value));
      expect(traced.tick(collector.forContext({ tick }))).toBe(plain.tick());
      expect(engineSnapshot(traced)).toEqual(engineSnapshot(plain));
    }
    expect(collector.snapshot().events.filter(event => event.nodeId === 'register')
      .map(event => event.stateAfter.q)).toEqual([1, 1, 1, 0]);
  });

  it('keeps constructor initialization explicit and unrecorded prior outputs absent', () => {
    const collector = createEvaluationTraceCollector();
    new CircuitEngine({ nodes: [{ id: 'input', type: 'Switch' }], connections: [] }, {
      observation: collector.forContext({ phase: 'initialize', engineTick: 0 }),
    });
    expect(collector.snapshot().events[0]).toMatchObject({
      context: { phase: 'initialize', engineTick: 0 }, inputs: {}, previousOutputs: {},
    });
  });

  it('uses detached snapshots and isolates throwing observers from actual state', () => {
    NodeRegistry.register('ObservationMutableTest', {
      evaluate(_inputs, state) {
        const tags = (state.tags ?? []) as string[];
        tags.push('evaluated');
        return { outputs: { out: 1 }, state: { tags } };
      },
    });
    const engine = new CircuitEngine({ nodes: [{ id: 'n', type: 'ObservationMutableTest', state: { tags: ['start'] } }], connections: [] });
    const onError = vi.fn();
    engine.tick({
      observe(event) {
        expect(event.stateBefore.tags).toEqual(['start', 'evaluated']);
        (event.stateBefore.tags as string[]).push('wrong');
        (event.stateAfter.tags as string[]).push('wrong');
        event.outputs.out = 0;
        throw new Error('observer failure');
      }, onError,
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(engine.getNodeState('n')?.tags).toEqual(['start', 'evaluated', 'evaluated']);
    expect(engine.getNodeOutputs('n')).toEqual({ out: 1 });
    NodeRegistry.unregister('ObservationMutableTest');
  });

  it('preserves X/Z and reports existing invalid-output publication rather than hiding it', () => {
    NodeRegistry.register('ObservationValuesTest', {
      evaluate: () => ({ outputs: { unknown: 'X', floating: 'Z', invalid: NaN }, state: {} }),
    });
    const collector = createEvaluationTraceCollector();
    const engine = new CircuitEngine({ nodes: [{ id: 'n', type: 'ObservationValuesTest' }], connections: [] });
    engine.tick(collector.forContext({}));
    const event = collector.snapshot().events[0];
    expect(event.outputs).toEqual({ unknown: 'X', floating: 'Z', invalid: 0 });
    expect(event.rawOutputs.invalid).toBeNaN();
    expect(event.invalidOutputPorts).toEqual(['invalid']);
    NodeRegistry.unregister('ObservationValuesTest');
  });

  it('reports previous-tick/default-zero input origins and invalid feedback without changing execution', () => {
    const circuit: Circuit = {
      nodes: [{ id: 'first', type: 'NOT' }, { id: 'second', type: 'NOT' }, { id: 'unknown', type: 'ObservationNoBehavior' }, { id: 'load', type: 'Lamp' }],
      connections: [wire('first', 'second'), wire('second', 'first'), wire('unknown', 'load')],
    };
    const plain = new CircuitEngine(structuredClone(circuit));
    const traced = new CircuitEngine(structuredClone(circuit));
    const collector = createEvaluationTraceCollector();
    expect(traced.tick(collector.forContext({}))).toBe(plain.tick());
    expect(engineSnapshot(traced)).toEqual(engineSnapshot(plain));
    const trace = collector.snapshot();
    expect(trace.issues[0].code).toBe('COMBINATIONAL_LOOP');
    expect(trace.events.find(event => event.nodeId === 'first')?.inputReads[0].origin).toBe('previous-tick');
    expect(trace.events.find(event => event.nodeId === 'load')?.inputReads[0]).toMatchObject({ value: 0, origin: 'default-zero' });
    expect(trace.events.some(event => event.nodeId === 'unknown')).toBe(false);
  });

  it('bounds a large trace by events and bytes and leaves published execution intact', () => {
    const circuit: Circuit = { nodes: [{ id: 'source', type: 'Switch', state: { isOn: 1 } }], connections: [] };
    for (let index = 0; index < 100; index += 1) {
      circuit.nodes.push({ id: `gate${index}`, type: 'NOT' });
      circuit.connections.push(wire(index === 0 ? 'source' : `gate${index - 1}`, `gate${index}`));
    }
    const plain = new CircuitEngine(structuredClone(circuit));
    const traced = new CircuitEngine(structuredClone(circuit));
    for (const limits of [{ maxEvents: 3 }, { maxBytes: 25 }, { maxEvents: 0 }]) {
      const collector = createEvaluationTraceCollector(limits);
      expect(traced.tick(collector.forContext({}))).toBe(plain.tick());
      expect(engineSnapshot(traced)).toEqual(engineSnapshot(plain));
      const trace = collector.snapshot();
      expect(trace.status).toBe('truncated');
      expect(trace.events.length).toBeLessThanOrEqual(trace.maxEvents);
      expect(trace.bytes).toBeLessThanOrEqual(trace.maxBytes);
    }
  });

  it('marks unavailable observation snapshots without interrupting simulation', () => {
    NodeRegistry.register('ObservationNonCloneableTest', {
      evaluate: () => ({ outputs: { out: 1 }, state: { callback: () => 1 } }),
    });
    const engine = new CircuitEngine({ nodes: [{ id: 'n', type: 'ObservationNonCloneableTest' }], connections: [] });
    const collector = createEvaluationTraceCollector();
    expect(engine.tick(collector.forContext({}))).toBe(false);
    expect(engine.getNodeOutputs('n')).toEqual({ out: 1 });
    expect(collector.snapshot()).toMatchObject({ status: 'unavailable', unavailableReason: 'observer-error' });
    NodeRegistry.unregister('ObservationNonCloneableTest');
  });

  it('does not construct detached observation snapshots when tracing is disabled', () => {
    const engine = new CircuitEngine(cone());
    const clone = vi.spyOn(globalThis, 'structuredClone');
    engine.tick();
    expect(clone).not.toHaveBeenCalled();
    clone.mockRestore();
  });
});
