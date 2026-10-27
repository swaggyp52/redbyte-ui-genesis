import { describe, expect, it } from 'vitest';
import { CircuitEngine, type EngineEvaluationObservation, type Node, type Signal } from '@redbyte/rb-logic-core';
import { presentJourneyValue, presentSignalJourney } from '../signalJourneyPresentation';

function observe(type: string, inputs: Record<string, Signal>, state: Record<string, unknown> = {}, config: Record<string, unknown> = {}, afterHeldSample = false) {
  const node: Node = { id: 'device', type, state, config };
  const events: EngineEvaluationObservation[] = [];
  const engine = new CircuitEngine({ nodes: [...Object.entries(inputs).map(([port, value]) => ({ id: `source-${port}`, type: 'INPUT', state: { isOn: afterHeldSample && port === 'CLK' ? 0 : value } })), node],
    connections: Object.keys(inputs).map(port => ({ from: { nodeId: `source-${port}`, portName: 'out' }, to: { nodeId: node.id, portName: port } })) },
  { observation: { observe: event => events.push(event), context: { tick: 5, caseIndex: 5, vectorId: 'case-reset', phase: 'macro-high-sample' } } });
  if (afterHeldSample) {
    engine.setNodeState('source-CLK', { isOn: inputs.CLK });
    engine.tick({ observe: event => events.push(event), context: { tick: 5, caseIndex: 5, vectorId: 'case-reset', phase: 'macro-high-sample' } });
  }
  return { node, event: events.filter(event => event.nodeId === node.id).at(-1)! };
}
function explain(record: ReturnType<typeof observe>, port = 'out') {
  return presentSignalJourney({ node: record.node, observation: record.event, selected: { nodeId: record.node.id, port }, revision: 'retained-revision' });
}

describe('student-facing explanations of retained evaluations', () => {
  it('puts the actual OR relationship first and keeps unchanged output separate', () => {
    const recorded = observe('OR', { a: 0, b: 1 });
    recorded.event.previousOutputs = { out: 1 };
    const result = explain(recorded);
    expect(result.node).toMatchObject({ title: 'OR gate', kind: 'OR gate', stage: 'Top-level circuit' });
    expect(result.rule).toEqual({ text: '0 OR 1 = 1.', expression: '0 OR 1 = 1' });
    expect(result.outcome).toEqual({ kind: 'unchanged', text: 'The output stayed at 1.' });
    expect(result.phase).toMatchObject({ kind: 'evaluated', label: 'Evaluated output' });
    expect(result.details.observation).toBe(recorded.event);
    expect(result.details.scheduler?.context).toEqual(recorded.event.context);
    expect(result.details.revision).toBe('retained-revision');
  });

  it('keeps exact selected input and driver separate from the gate output', () => {
    const recorded = observe('OR', { a: 0, b: 1 });
    const result = explain(recorded, 'a');
    expect(result.mode).toBe('input');
    expect(result.rule.text).toBe('Input A = 0, read from source-a.out. This is an input value, not the gate’s output.');
    expect(result.inputs.find(row => row.selected)).toMatchObject({ key: 'A', value: { value: 0 }, driver: { nodeId: 'source-a', portName: 'out' } });
    expect(result.outputs[0].value.value).toBe(1);
  });

  it('honors actual in1/in2 precedence without merging conflicting input spellings', () => {
    const result = explain(observe('OR', { in1: 0, a: 1, in2: 0 }));
    expect(result.rule.expression).toBe('0 OR 0 = 0');
    expect(result.inputs.find(row => row.key === 'A')?.ports).toEqual(['in1']);
    expect(result.inputs.find(row => row.key === 'a')?.value.value).toBe(1);
  });

  it.each(['DFlipFlop', 'Register1', 'RegisterBus', 'StateBank', 'TFlipFlop', 'JKFlipFlop'])('groups only the genuine state/complement aliases of %s', type => {
    const inputs: Record<string, Signal> = type === 'TFlipFlop' ? { T: 1, CLK: 1 } : type === 'JKFlipFlop' ? { J: 1, K: 0, CLK: 1 } : { D: 1, CLK: 1 };
    const result = explain(observe(type, inputs, { q: 0, lastClk: 0 }, { width: 1 }), 'q');
    const state = result.outputs.find(row => row.key === 'Q')!, complement = result.outputs.find(row => row.key === 'Q_inv')!;
    expect(state.ports).toEqual(expect.arrayContaining(['Q', 'q', 'out']));
    expect(state.selected).toBe(true);
    expect(state.value.value).toBe(1);
    expect(complement.ports).toEqual(expect.arrayContaining(['Q_inv', 'qn']));
    expect(complement.value.value).toBe(0);
    expect(state.ports.some(port => complement.ports.includes(port))).toBe(false);
    expect(result.phase.label).toBe('Captured result · not yet published');
    expect(result.phase.explanation).toContain('publish their new state together');
  });

  it('does not confuse a packed word with equal-valued bits or width metadata', () => {
    const result = explain(observe('RegisterBus', { D: 1, CLK: 1 }, { q: 0, lastClk: 0 }, { width: 2 }), 'Q[0]');
    const word = result.outputs.find(row => row.key === 'Q')!, bit = result.outputs.find(row => row.key === 'Q[0]')!;
    expect(word.ports).toEqual(['Q', 'q', 'out', 'value']);
    expect(bit.ports).toEqual(['Q0', 'q0', 'Q[0]', 'q[0]']);
    expect(word.value.value).toBe(bit.value.value);
    expect(word.selected).toBe(false);
    expect(bit.selected).toBe(true);
    expect(result.outputs.find(row => row.key === 'width')).toMatchObject({ role: 'metadata', value: { value: 2 } });
    expect(result.sequential).toMatchObject({ kind: 'capture', priorState: { value: 0 }, nextState: { value: 1 } });
  });

  it('respects Register1 scalar compatibility when an imported width exceeds one', () => {
    const result = explain(observe('Register1', { RST: 1, CLK: 0 }, { q: 0, lastClk: 0 }, { width: 2, resetKind: 'async_preset' }), 'value');
    expect(result.outputs.find(row => row.key === 'Q')?.value.value).toBe(1);
    expect(result.outputs.find(row => row.key === 'Q')?.ports).not.toContain('value');
    expect(result.outputs.find(row => row.key === 'value')).toMatchObject({ selected: true, value: { value: 3 } });
    expect(result.sequential?.kind).toBe('set');
  });

  it('does not merge custom equal outputs, even when they use native-looking names', () => {
    const native = observe('DFlipFlop', { D: 1, CLK: 1 }, { q: 0, lastClk: 0 });
    const node = { ...native.node, type: 'CustomRegister' };
    const event = { ...native.event, nodeType: node.type, outputs: { Q: 1, q: 1, out: 1, second: 1 }, previousOutputs: { Q: 1, q: 1, out: 1, second: 1 } };
    const result = presentSignalJourney({ node, selected: { nodeId: node.id, port: 'second' }, observation: event });
    expect(result.outputs.map(row => row.ports)).toEqual([['Q'], ['q'], ['out'], ['second']]);
    expect(result.sequential).toBeUndefined();
    expect(result.outcome).toEqual({ kind: 'unchanged', text: 'The outputs stayed the same.' });
    expect(result.rule.text).toContain('direct rule for this device is unavailable');
  });

  it('exposes clock, data and actual prior/result state without claiming publication', () => {
    const result = explain(observe('DFlipFlop', { D: 1, CLK: 1 }, { q: 0, lastClk: 0 }, {}, true), 'Q');
    expect(result.sequential).toMatchObject({ kind: 'capture', label: 'Capture data at clock edge',
      priorState: { value: 0 }, nextState: { value: 1 }, clock: { key: 'CLK', value: { value: 1 } } });
    expect(result.sequential?.data[0]).toMatchObject({ key: 'D', value: { value: 1 } });
    expect(result.phase.kind).toBe('awaiting-common-publication');
    expect(result.outcome.text).toContain('publication is still pending');
    const initial = explain(observe('DFlipFlop', { D: 1, CLK: 1 }, { q: 0, lastClk: 0 }), 'Q');
    expect(initial.sequential?.kind).toBe('capture');
    expect(initial.outcome.kind).toBe('unavailable');
  });

  it('explains disabled and no-edge hold from the actual controls and unchanged state', () => {
    const disabled = explain(observe('Register1', { D: 0, CLK: 1, EN: 0 }, { q: 1, lastClk: 0 }, { hasEnable: true }, true), 'Q');
    expect(disabled.sequential).toMatchObject({ kind: 'hold', priorState: { value: 1 }, nextState: { value: 1 } });
    expect(disabled.sequential?.reason).toContain('Capture is disabled');
    expect(disabled.outcome.text).toBe('The output stayed at 1.');
    const noEdge = explain(observe('DFlipFlop', { D: 0, CLK: 0 }, { q: 1, lastClk: 0 }), 'Q');
    expect(noEdge.sequential?.reason).toContain('no rising edge');
  });

  it('treats EN as the configuration does: a register without Clock enable captures whatever EN reads (RB-DEBT-028)', () => {
    // The simulator ignores EN without Clock enable; a wired EN = 0 must not be read as a disabled capture.
    const wired = explain(observe('Register1', { D: 1, CLK: 1, EN: 0 }, { q: 0, lastClk: 0 }, { hasEnable: false }, true), 'Q');
    expect(wired.sequential).toMatchObject({ kind: 'capture', priorState: { value: 0 }, nextState: { value: 1 } });
    // Nor does an active-low enable polarity apply to an EN the configuration disables.
    const open = explain(observe('Register1', { D: 1, CLK: 1 }, { q: 0, lastClk: 0 }, { hasEnable: false, enablePolarity: 'active_low' }, true), 'Q');
    expect(open.sequential).toMatchObject({ kind: 'capture', nextState: { value: 1 } });
    // With Clock enable on, an unconnected EN reads 0 and holds.
    const held = explain(observe('Register1', { D: 1, CLK: 1 }, { q: 0, lastClk: 0 }, { hasEnable: true }, true), 'Q');
    expect(held.sequential).toMatchObject({ kind: 'hold', nextState: { value: 0 } });
  });

  it('distinguishes direct async clear from synchronous reset requiring an actual edge', () => {
    const direct = explain(observe('DFlipFlop', { D: 1, CLK: 0, RST: 1 }, { q: 1, lastClk: 0 }), 'Q');
    expect(direct.sequential).toMatchObject({ kind: 'reset', priorState: { value: 1 }, nextState: { value: 0 } });
    const synchronous = explain(observe('Register1', { D: 1, CLK: 1, RST: 1 }, { q: 1, lastClk: 0 }, { resetKind: 'sync_reset' }), 'Q');
    expect(synchronous.sequential?.reason).toContain('at the rising edge');
    const noEdge = explain(observe('Register1', { D: 0, CLK: 0, RST: 1 }, { q: 1, lastClk: 0 }, { resetKind: 'sync_reset' }), 'Q');
    expect(noEdge.sequential?.kind).toBe('hold');
  });

  it('handles recorded falling-edge and active-low reset contracts', () => {
    const falling = explain(observe('Register1', { D: 1, CLK: 0 }, { q: 0, lastClk: 1 }, { clockPolarity: 'falling_edge' }), 'Q');
    expect(falling.sequential?.reason).toContain('falling clock edge');
    const activeLow = explain(observe('StateBank', { CLK: 0, RST: 0 }, { q: 3, lastClk: 0 }, { width: 2, resetKind: 'async_clear', resetPolarity: 'active_low' }), 'Q');
    expect(activeLow.sequential).toMatchObject({ kind: 'reset', priorState: { value: 3 }, nextState: { value: 0 } });
  });

  it('does not name a falling Q value as reset without a reset control observation', () => {
    const record = observe('DFlipFlop', { D: 0, CLK: 1 }, { q: 1, lastClk: 0 });
    record.node.label = 'Reset stage';
    const result = explain(record, 'Q');
    expect(result.sequential?.kind).toBe('capture');
    expect(result.sequential?.reset).toBeUndefined();
    expect(result.sequential?.reason).not.toMatch(/reset/i);
  });

  it('uses local phase values for another gate without inventing its evaluation or change', () => {
    const recorded = observe('OR', { a: 0, b: 1 });
    const node = { id: 'other', type: 'OR', label: 'Carry condition' };
    const result = presentSignalJourney({ node, observation: recorded.event, selected: { nodeId: node.id, port: 'out' },
      values: new Map([['other.a', 0], ['other.b', 1], ['other.out', 1]]) });
    expect(result.node.title).toBe('Carry condition');
    expect(result.rule.expression).toBe('0 OR 1 = 1');
    expect(result.phase.kind).toBe('recorded-phase');
    expect(result.outcome.kind).toBe('unavailable');
    expect(result.details.localObservationAvailable).toBe(false);
    expect(result.details.observation).toBe(recorded.event);
  });

  it('keeps published samples separate from capture and does not derive absent complements', () => {
    const node = { id: 'stored', type: 'DFlipFlop' };
    const result = presentSignalJourney({ node, selected: { nodeId: node.id, port: 'Q' }, publication: 'published-sample', publishedValue: '1' });
    expect(result.phase.label).toBe('Published sample');
    expect(result.outputs.find(row => row.key === 'Q')?.value.text).toBe('1');
    expect(result.outputs.find(row => row.key === 'Q_inv')?.value.availability).toBe('unrecorded');
    expect(result.sequential?.kind).toBe('unavailable');
    expect(result.outcome.kind).toBe('unavailable');
  });

  it('retains unknown and unrecorded values without showing a false Boolean equation', () => {
    const node = { id: 'gate', type: 'OR' };
    const result = presentSignalJourney({ node, selected: { nodeId: node.id, port: 'out' }, publication: 'evaluation',
      values: new Map<string, unknown>([['gate.a', 'X'], ['gate.b', 1], ['gate.out', 1]]) });
    expect(result.inputs[0].value).toEqual({ value: 'X', text: 'X', availability: 'unknown' });
    expect(result.rule.expression).toBeUndefined();
    expect(result.rule.text).toContain('not recorded');
    expect(presentJourneyValue(undefined).text).toBe('unrecorded');
    expect(presentJourneyValue('Z').availability).toBe('unknown');
    expect(presentJourneyValue(Number.NaN).value).toBeNull();
    expect(presentJourneyValue('0xA').availability).toBe('recorded');
  });

  it('refuses unknown clock, missing prior state, missing phase, and contradictory aliases', () => {
    const recorded = observe('DFlipFlop', { D: 1, CLK: 1 }, { q: 0, lastClk: 0 });
    expect(explain({ ...recorded, event: { ...recorded.event, inputs: { D: 1, CLK: 'X' } } }, 'Q').sequential?.kind).toBe('unavailable');
    const register = observe('Register1', { D: 1, CLK: 1, CE: 1 }, { q: 0, lastClk: 0 });
    expect(explain({ ...register, event: { ...register.event, inputs: { D: 1, CLK: 1, CE: 'X' } } }, 'Q').sequential?.kind).toBe('unavailable');
    expect(explain({ ...recorded, event: { ...recorded.event, stateBefore: {} } }, 'Q').sequential?.kind).toBe('unavailable');
    const missingPhase = { ...recorded.event, evaluationPhase: undefined } as unknown as EngineEvaluationObservation;
    const unavailable = explain({ ...recorded, event: missingPhase }, 'Q');
    expect(unavailable.details.localObservationAvailable).toBe(false);
    expect(unavailable.sequential?.kind).toBe('unavailable');
    const conflict = explain({ ...recorded, event: { ...recorded.event, outputs: { ...recorded.event.outputs, q: 0 } } }, 'Q');
    expect(conflict.outputs.find(row => row.key === 'Q')).toMatchObject({ conflict: true, value: { availability: 'unrecorded' } });
    expect(conflict.sequential?.kind).toBe('unavailable');
  });

  it('does not make a mathematically false equation from inconsistent recorded outputs', () => {
    const recorded = observe('OR', { a: 0, b: 1 });
    const result = explain({ ...recorded, event: { ...recorded.event, outputs: { out: 0 } } });
    expect(result.rule.expression).toBeUndefined();
    expect(result.rule.text).toContain('Recorded output 0 does not match');
    expect(result.outputs[0].value.value).toBe(0);
  });

  it('uses friendly kind/stage without treating friendly labels as repeated-instance identities', () => {
    const record = observe('OR', { a: 0, b: 1 });
    const source = { instancePath: ['stable-instance-2'], definitionId: 'adder', localNodeId: 'o1', displayPath: ['u_fa2'] };
    const node = { ...record.node, label: 'u_fa2.o1' };
    const result = presentSignalJourney({ node, source, observation: record.event, selected: { nodeId: node.id, port: 'out' } });
    expect(result.node).toMatchObject({ title: 'OR gate', kind: 'OR gate', stage: 'In u_fa2', instancePath: ['stable-instance-2'] });
    expect(result.details.nodeLabel).toBe('u_fa2.o1');
    const renamed = presentSignalJourney({ node: { ...node, label: 'Carry ready' }, source: { ...source, displayPath: ['Arithmetic', 'Upper carry'] },
      selected: { nodeId: node.id, port: 'out' } });
    expect(renamed.node.title).toBe('Carry ready');
    expect(renamed.node.stage).toBe('In Arithmetic / Upper carry');
    expect(renamed.node.instancePath).toEqual(result.node.instancePath);
  });

  it('is read-only and bounds presentation while retaining raw custom evidence', () => {
    const recorded = observe('OR', { a: 0, b: 1 });
    const before = JSON.stringify(recorded);
    explain(recorded);
    expect(JSON.stringify(recorded)).toBe(before);
    const node = { id: 'custom', type: 'CustomDevice' };
    const event = { ...recorded.event, nodeId: node.id, nodeType: node.type, outputs: Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`port${i}`, 1])) };
    const result = presentSignalJourney({ node, observation: event, selected: { nodeId: node.id, port: 'port149' } });
    expect(result.outputs.length).toBe(128);
    expect(result.notices).toContain('Additional ports remain in recorded details.');
    expect(Object.keys(result.details.observation!.outputs)).toHaveLength(150);
  });
});
