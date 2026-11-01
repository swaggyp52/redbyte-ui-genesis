import { describe, expect, it } from 'vitest';
import type { Circuit, Connection } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { buildDeterministicVerifyContext } from '../../../fpga/boards/basys3/verifySchedule';
import { runDeterministicVerifyFromModel, type VerifyClockExecutionPolicy } from '../sim/simEngineCore';
import type { SimulationIoRow } from '../sim/simTypes';

function wire(from: string, to: string, port = 'in', sourcePort = 'out'): Connection {
  return { from: { nodeId: from, portName: sourcePort }, to: { nodeId: to, portName: port } };
}

function recordedRun(circuit: Circuit, ioRows: SimulationIoRow[], vectors: TestVector[], policy?: VerifyClockExecutionPolicy) {
  const context = buildDeterministicVerifyContext(circuit);
  const plain = runDeterministicVerifyFromModel(circuit, context.simModel, ioRows, vectors, context.schedule, policy);
  const traced = runDeterministicVerifyFromModel(circuit, context.simModel, ioRows, vectors, context.schedule, policy, { maxEvents: 2048 });
  const { evaluationTrace, ...published } = traced;
  expect(published).toEqual(plain);
  expect(plain.evaluationTrace).toBeUndefined();
  return { context, plain, traced, evaluationTrace: evaluationTrace! };
}

function sequentialFixture() {
  const circuit: Circuit = {
    nodes: [
      ...['d', 'clk', 'en', 'rst'].map(id => ({ id, type: 'INPUT', label: id, state: { isOn: 0 } })),
      { id: 'ff', type: 'DFlipFlop' }, { id: 'q', type: 'OUTPUT', label: 'q' },
    ],
    connections: [wire('d', 'ff', 'D'), wire('clk', 'ff', 'CLK'), wire('en', 'ff', 'EN'),
      wire('rst', 'ff', 'RST'), wire('ff', 'q', 'in', 'Q')],
  };
  const ioRows: SimulationIoRow[] = ['d', 'clk', 'en', 'rst', 'q'].map(id => ({
    id, label: id, nodeId: id, direction: id === 'q' ? 'out' : 'in',
  }));
  return { circuit, ioRows };
}

describe('deterministic vector evaluation observation', () => {
  it('keeps cases, verdict evidence, samples and repeated-instance identities unchanged', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT', label: 'renamedOperand' }, { id: 'b', type: 'INPUT', label: 'mask' },
        { id: 'u0__gate', type: 'AND', label: 'same friendly gate' },
        { id: 'u1__gate', type: 'XOR', label: 'same friendly gate' },
        { id: 'reconvergence', type: 'OR' }, { id: 'q', type: 'OUTPUT', label: 'result' },
      ],
      connections: [wire('a', 'u0__gate', 'a'), wire('b', 'u0__gate', 'b'),
        wire('a', 'u1__gate', 'a'), wire('b', 'u1__gate', 'b'),
        wire('u0__gate', 'reconvergence', 'a'), wire('u1__gate', 'reconvergence', 'b'),
        wire('reconvergence', 'q')],
    };
    const ioRows: SimulationIoRow[] = [
      { id: 'a', label: 'renamedOperand', nodeId: 'a', direction: 'in' },
      { id: 'b', label: 'mask', nodeId: 'b', direction: 'in' },
      { id: 'q', label: 'result', nodeId: 'q', direction: 'out' },
    ];
    const vectors: TestVector[] = [
      { tick: 0, inputs: { a: 0, b: 0 }, expected: { q: 0 } },
      { tick: 0, inputs: { a: 1, b: 0 }, expected: { q: 1 } }, // same tick, different case
      { tick: 2, inputs: { a: 1, b: 1 }, expected: { q: 0 } }, // authored mismatch remains independent
    ];
    const { evaluationTrace, plain } = recordedRun(circuit, ioRows, vectors);
    const events = evaluationTrace.events.filter(event => event.context.vectorId === 'vec-02');
    expect(events.map(event => event.nodeId)).toContain('u0__gate');
    expect(events.map(event => event.nodeId)).toContain('u1__gate');
    expect(events.find(event => event.nodeId === 'u0__gate')).toMatchObject({
      context: { caseIndex: 1, tick: 0, phase: 'combinational' },
      inputs: { a: 1, b: 0 }, previousOutputs: { out: 0 }, outputs: { out: 0 },
    });
    expect(plain.evidence.failures).toHaveLength(1);
    expect(evaluationTrace.status).toBe('complete');
    expect(new Set(evaluationTrace.events.map(event => event.order)).size).toBe(evaluationTrace.events.length);
    expect(evaluationTrace.events.map(event => event.order)).toEqual(evaluationTrace.events.map((_, index) => index));
  });

  it('captures the actual macro low/high/low evaluations while retaining the high sample', () => {
    const { circuit, ioRows } = sequentialFixture();
    const policy: VerifyClockExecutionPolicy = { overrideMode: 'auto', resetBehavior: 'custom', signalId: 'clk', startLevel: 0 };
    const vectors: TestVector[] = [
      { tick: 0, inputs: { d: 1, en: 1, rst: 0 }, expected: { q: 1 } },
      { tick: 1, inputs: { d: 0, en: 0, rst: 0 }, expected: { q: 1 } },
      { tick: 2, inputs: { d: 1, en: 1, rst: 1 }, expected: { q: 0 } },
    ];
    const { evaluationTrace, plain } = recordedRun(circuit, ioRows, vectors, policy);
    const ff = evaluationTrace.events.filter(event => event.nodeId === 'ff' && event.context.vectorId);
    for (let caseIndex = 0; caseIndex < vectors.length; caseIndex += 1) {
      const phases = ff.filter(event => event.context.caseIndex === caseIndex);
      expect(phases.map(event => event.context.phase)).toEqual(['macro-low-before', 'macro-high-sample', 'macro-low-after']);
      expect(phases.map(event => event.inputs.CLK)).toEqual([0, 1, 0]);
      expect(phases[1].outputs.Q).toBe(plain.trace[caseIndex].signals['ff.Q']);
      expect(phases[2].stateAfter.lastClk).toBe(0);
    }
    expect(ff.filter(event => event.context.caseIndex === 1).map(event => event.stateAfter.q)).toEqual([1, 1, 1]);
    expect(ff.filter(event => event.context.caseIndex === 2).map(event => event.stateAfter.q)).toEqual([0, 0, 0]);
    expect(new Set(ff.map(event => event.context.engineTick)).size).toBe(9);
  });

  it('records authored clock evaluations once per case and preserves capture/hold/reset', () => {
    const { circuit, ioRows } = sequentialFixture();
    const vectors: TestVector[] = [
      { tick: 0, inputs: { d: 1, clk: 0, en: 1, rst: 0 }, expected: { q: 0 } },
      { tick: 1, inputs: { d: 1, clk: 1, en: 1, rst: 0 }, expected: { q: 1 } },
      { tick: 2, inputs: { d: 0, clk: 1, en: 1, rst: 0 }, expected: { q: 1 } },
      { tick: 3, inputs: { d: 0, clk: 0, en: 0, rst: 0 }, expected: { q: 1 } },
      { tick: 4, inputs: { d: 0, clk: 1, en: 0, rst: 0 }, expected: { q: 1 } },
      { tick: 5, inputs: { d: 1, clk: 1, en: 1, rst: 1 }, expected: { q: 0 } },
    ];
    const { evaluationTrace } = recordedRun(circuit, ioRows, vectors, {
      overrideMode: 'manual-pulses', resetBehavior: 'custom', signalId: 'clk', startLevel: 0,
    });
    const ff = evaluationTrace.events.filter(event => event.nodeId === 'ff' && event.context.vectorId);
    expect(ff).toHaveLength(6);
    expect(ff.every(event => event.context.phase === 'authored-clock')).toBe(true);
    expect(ff.map(event => event.stateAfter.q)).toEqual([0, 1, 1, 1, 1, 0]);
  });

  it('keeps floating output X distinct from the actual underlying defaulted lamp evaluation', () => {
    const circuit: Circuit = { nodes: [{ id: 'q', type: 'OUTPUT', label: 'q' }], connections: [] };
    const { evaluationTrace, plain } = recordedRun(circuit, [{ id: 'q', nodeId: 'q', label: 'q', direction: 'out' }], [
      { tick: 0, inputs: {}, expected: { q: 1 } },
    ]);
    expect(plain.trace[0].signals['q.out']).toBe('X');
    expect(evaluationTrace.events.find(event => event.context.vectorId)?.inputs).toEqual({});
  });

  it('exposes unavailable invalid feedback and unsupported temporal traces without manufacturing evaluations', () => {
    const circuit: Circuit = {
      nodes: [{ id: 'a', type: 'NOT' }, { id: 'b', type: 'NOT' }],
      connections: [wire('a', 'b'), wire('b', 'a')],
    };
    const context = buildDeterministicVerifyContext(circuit);
    const invalid = runDeterministicVerifyFromModel(circuit, context.simModel, [], [], context.schedule, undefined, {});
    expect(invalid.evaluationTrace).toMatchObject({ status: 'unavailable', unavailableReason: 'invalid-ir', events: [] });
    const { circuit: sequential, ioRows } = sequentialFixture();
    const validContext = buildDeterministicVerifyContext(sequential);
    const unsupported = runDeterministicVerifyFromModel(sequential, validContext.simModel, ioRows, [], {
      ...validContext.schedule, hasUnsupportedTemporal: true,
    }, undefined, {});
    expect(unsupported.evaluationTrace).toMatchObject({ status: 'unavailable', unavailableReason: 'unsupported-temporal', events: [] });
  });

  it('bounds capture without truncating the published vector run', () => {
    const { circuit, ioRows } = sequentialFixture();
    const context = buildDeterministicVerifyContext(circuit);
    const vectors = Array.from({ length: 80 }, (_, tick) => ({ tick, inputs: { d: tick % 2, en: 1, rst: 0 }, expected: {} }));
    const policy: VerifyClockExecutionPolicy = { overrideMode: 'auto', resetBehavior: 'custom', signalId: 'clk' };
    const plain = runDeterministicVerifyFromModel(circuit, context.simModel, ioRows, vectors, context.schedule, policy);
    const { evaluationTrace, ...published } = runDeterministicVerifyFromModel(circuit, context.simModel, ioRows, vectors, context.schedule, policy, { maxEvents: 12, maxBytes: 50000 });
    expect(published).toEqual(plain);
    expect(published.trace).toHaveLength(80);
    expect(evaluationTrace).toMatchObject({ status: 'truncated' });
    expect(evaluationTrace!.events).toHaveLength(12);
    expect(evaluationTrace!.bytes).toBeLessThanOrEqual(50000);
  });
});
