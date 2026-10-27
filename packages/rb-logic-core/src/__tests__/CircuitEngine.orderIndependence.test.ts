import { describe, expect, it } from 'vitest';
import { CircuitEngine } from '../CircuitEngine';
import '../index';
import type { Circuit, Connection, Node } from '../types';

/**
 * RB-DEBT-014: feedback through non-capture state elements (Delay, DLatch,
 * RSLatch) must not evaluate in node-array order. The project codec re-sorts
 * nodes by id on save, so an array-order scheduler gives one RunIdentity two
 * different recordings. Every fixture is driven through every permutation of
 * its node array (and both connection orders) and must publish identical
 * per-tick signals and OUTPUT samples.
 */

function wire(from: string, to: string, port = 'in', sourcePort = 'out'): Connection {
  return { from: { nodeId: from, portName: sourcePort }, to: { nodeId: to, portName: port } };
}

interface Fixture {
  name: string;
  nodes: Node[];
  connections: Connection[];
  /** Per-tick INPUT values, applied before each tick after construction. */
  stimulus: Record<string, number[]>;
  outputs: string[];
}

const FIXTURES: Fixture[] = [
  {
    // A three-element ring that circulates an injected pulse: seed XOR d2 -> d1 -> d2.
    name: 'delay ring',
    nodes: [
      { id: 'seed', type: 'INPUT', state: { isOn: 0 } },
      { id: 'mix', type: 'XOR' },
      { id: 'd1', type: 'Delay', config: { delay: 1 } },
      { id: 'd2', type: 'Delay', config: { delay: 1 } },
      { id: 'tap', type: 'OUTPUT' },
    ],
    connections: [wire('seed', 'mix', 'a'), wire('d2', 'mix', 'b'), wire('mix', 'd1'), wire('d1', 'd2'), wire('d2', 'tap')],
    stimulus: { seed: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0] },
    outputs: ['tap'],
  },
  {
    // The audited latch-on: INPUT -> OR <-> Delay, OR -> OUTPUT.
    name: 'latch-on',
    nodes: [
      { id: 'set', type: 'INPUT', state: { isOn: 0 } },
      { id: 'hold', type: 'OR' },
      { id: 'loop', type: 'Delay', config: { delay: 1 } },
      { id: 'lamp', type: 'OUTPUT' },
    ],
    connections: [wire('set', 'hold', 'a'), wire('loop', 'hold', 'b'), wire('hold', 'loop'), wire('hold', 'lamp')],
    stimulus: { set: [0, 1, 0, 0, 0, 0, 0, 0] },
    outputs: ['lamp'],
  },
  {
    // The audited DLatch toggle: Q_inv feeds D, so Q toggles on every enabled tick.
    name: 'DLatch toggle',
    nodes: [
      { id: 'en', type: 'INPUT', state: { isOn: 0 } },
      { id: 'latch', type: 'DLatch' },
      { id: 'q', type: 'OUTPUT' },
    ],
    connections: [wire('en', 'latch', 'EN'), wire('latch', 'latch', 'D', 'Q_inv'), wire('latch', 'q', 'in', 'Q')],
    stimulus: { en: [1, 1, 0, 1, 0, 0, 1, 1] },
    outputs: ['q'],
  },
  {
    // RSLatch whose S input is driven by its own inverted Q.
    name: 'RSLatch feedback',
    nodes: [
      { id: 'r', type: 'INPUT', state: { isOn: 1 } },
      { id: 'rs', type: 'RSLatch' },
      { id: 'inv', type: 'NOT' },
      { id: 'lamp', type: 'OUTPUT' },
    ],
    connections: [wire('r', 'rs', 'R'), wire('rs', 'inv', 'in', 'Q'), wire('inv', 'rs', 'S'), wire('rs', 'lamp', 'in', 'Q')],
    stimulus: { r: [1, 0, 1, 1, 0, 1, 1, 0] },
    outputs: ['lamp'],
  },
];

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(rest => [item, ...rest]));
}

function build(fixture: Fixture, nodes: readonly Node[], reverseConnections: boolean): Circuit {
  const connections = fixture.connections.map(connection => structuredClone(connection));
  return { nodes: nodes.map(node => structuredClone(node)), connections: reverseConnections ? connections.reverse() : connections };
}

/** Per-tick published signals (key-sorted) and OUTPUT samples, starting with the constructor's evaluation. */
function record(fixture: Fixture, circuit: Circuit) {
  const engine = new CircuitEngine(circuit);
  const ticks = Math.max(...Object.values(fixture.stimulus).map(values => values.length));
  const snapshot = () => ({
    signals: [...engine.getAllSignals().entries()].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    outputs: fixture.outputs.map(id => engine.getNodeState(id)?.isOn ?? null),
  });
  const frames = [snapshot()];
  for (let tick = 0; tick < ticks; tick += 1) {
    for (const [id, values] of Object.entries(fixture.stimulus)) engine.setNodeValue(id, values[tick] as 0 | 1);
    engine.tick();
    frames.push(snapshot());
  }
  return frames;
}

describe('CircuitEngine feedback evaluation is independent of node order (RB-DEBT-014)', () => {
  it.each(FIXTURES.map(fixture => [fixture.name, fixture] as const))(
    '%s publishes identical per-tick signals for every node permutation',
    (_name, fixture) => {
      const reference = record(fixture, build(fixture, fixture.nodes, false));
      const divergent: string[] = [];
      for (const nodes of permutations(fixture.nodes)) {
        for (const reverseConnections of [false, true]) {
          const frames = record(fixture, build(fixture, nodes, reverseConnections));
          if (JSON.stringify(frames) !== JSON.stringify(reference)) {
            divergent.push(`${nodes.map(node => node.id).join(',')}${reverseConnections ? ' (connections reversed)' : ''}`);
          }
        }
      }
      expect(divergent, `orders whose recording differs from authored order: ${divergent.slice(0, 4).join(' | ')}`).toEqual([]);
    },
  );

  it.each(FIXTURES.map(fixture => [fixture.name, fixture] as const))(
    '%s schedules one evaluation order for every node permutation',
    (_name, fixture) => {
      const orders = new Set<string>();
      for (const nodes of permutations(fixture.nodes)) {
        const engine = new CircuitEngine(build(fixture, nodes, false));
        orders.add(engine.getEvaluationOrder().join(','));
      }
      expect([...orders]).toHaveLength(1);
    },
  );

  it('evaluates a cycle in codepoint id order and every downstream node after it', () => {
    const latchOn = FIXTURES.find(fixture => fixture.name === 'latch-on')!;
    for (const nodes of permutations(latchOn.nodes)) {
      expect(new CircuitEngine(build(latchOn, nodes, false)).getEvaluationOrder()).toEqual(['set', 'hold', 'loop', 'lamp']);
    }
  });

  it('samples a DLatch toggle OUTPUT in the same tick as the latch publishes Q, whatever the array order', () => {
    const toggle = FIXTURES.find(fixture => fixture.name === 'DLatch toggle')!;
    for (const nodes of permutations(toggle.nodes)) {
      const order = nodes.map(node => node.id).join(',');
      const engine = new CircuitEngine(build(toggle, nodes, false));
      let previousQ = engine.getNodeOutputs('latch').Q;
      expect(engine.getNodeState('q')?.isOn, `${order}: constructor sample`).toBe(previousQ);
      toggle.stimulus.en.forEach((en, tick) => {
        engine.setNodeValue('en', en as 0 | 1);
        engine.tick();
        const q = engine.getNodeOutputs('latch').Q;
        // Enabled ticks toggle Q through the Q_inv -> D feedback; disabled ticks hold it.
        expect(q, `${order}: tick ${tick} latch Q`).toBe(en === 1 ? (previousQ === 1 ? 0 : 1) : previousQ);
        expect(engine.getNodeState('q')?.isOn, `${order}: tick ${tick} OUTPUT sample`).toBe(q);
        previousQ = q;
      });
    }
  });

  it('keeps the acyclic dependency order of a codec-ordered circuit', () => {
    // Codec order: nodes and connections sorted by codepoint. Kahn's FIFO order over this
    // array is what saved projects evaluated before RB-DEBT-014; acyclic traces keep it.
    const circuit: Circuit = {
      nodes: [
        { id: 'a', type: 'Switch', state: { isOn: 1 } }, { id: 'and', type: 'AND' },
        { id: 'b', type: 'Switch', state: { isOn: 0 } }, { id: 'join', type: 'OR' },
        { id: 'result', type: 'Lamp' }, { id: 'xor', type: 'XOR' },
      ],
      connections: [
        wire('a', 'and', 'a'), wire('a', 'xor', 'a'), wire('and', 'join', 'b'),
        wire('b', 'and', 'b'), wire('b', 'xor', 'b'), wire('join', 'result'), wire('xor', 'join', 'a'),
      ],
    };
    expect(new CircuitEngine(circuit).getEvaluationOrder()).toEqual(['a', 'b', 'and', 'xor', 'join', 'result']);
  });
});
