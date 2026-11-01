import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { EngineeringObjectRef, JourneySelection } from '@redbyte/rb-apps/domain';
import { createStore } from '../store';
import { createMomentStore, sameMoment, stepTick } from '../moment';
import { fromEngineeringRef, fromJourneySelection, sameRef, toEngineeringRef, toJourneySelection } from '../objectRef';
import { deriveTruthTable } from '../nextState';
import { clockDrivingInputs } from '../explore';

// The shipped 2-Bit Up Counter's next-state logic, copied structurally from examplesCatalog.
const counter: Circuit = {
  nodes: [
    { id: 'clk_node', type: 'INPUT', label: 'CLK100MHZ' },
    { id: 'en_node', type: 'INPUT', label: 'EN' },
    { id: 'rst_node', type: 'INPUT', label: 'RST' },
    { id: 'xor0', type: 'XOR', label: 'XOR0' },
    { id: 'and_en', type: 'AND', label: 'AND' },
    { id: 'xor1', type: 'XOR', label: 'XOR1' },
    { id: 'rst_not', type: 'NOT', label: 'NOT' },
    { id: 'd0_rst', type: 'AND', label: 'RST0' },
    { id: 'd1_rst', type: 'AND', label: 'RST1' },
    { id: 'q0_ff', type: 'DFlipFlop', label: 'Q0' },
    { id: 'q1_ff', type: 'DFlipFlop', label: 'Q1' },
    { id: 'q0_out', type: 'OUTPUT', label: 'LD0' },
    { id: 'q1_out', type: 'OUTPUT', label: 'LD1' },
  ] as Circuit['nodes'],
  connections: [
    ['q0_ff', 'Q', 'xor0', 'a'], ['en_node', 'out', 'xor0', 'b'],
    ['q0_ff', 'Q', 'and_en', 'a'], ['en_node', 'out', 'and_en', 'b'],
    ['q1_ff', 'Q', 'xor1', 'a'], ['and_en', 'out', 'xor1', 'b'],
    ['rst_node', 'out', 'rst_not', 'in'],
    ['xor0', 'out', 'd0_rst', 'a'], ['rst_not', 'out', 'd0_rst', 'b'], ['d0_rst', 'out', 'q0_ff', 'D'],
    ['xor1', 'out', 'd1_rst', 'a'], ['rst_not', 'out', 'd1_rst', 'b'], ['d1_rst', 'out', 'q1_ff', 'D'],
    ['clk_node', 'out', 'q0_ff', 'CLK'], ['clk_node', 'out', 'q1_ff', 'CLK'],
    ['q0_ff', 'Q', 'q0_out', 'in'], ['q1_ff', 'Q', 'q1_out', 'in'],
  ].map(([fromNode, fromPort, toNode, toPort]) => ({ from: { nodeId: fromNode, portName: fromPort }, to: { nodeId: toNode, portName: toPort } })),
};

describe('store', () => {
  it('notifies only on an actual change and shallow-merges', () => {
    const store = createStore({ a: 1, b: { x: 1 } });
    const seen: number[] = [];
    store.subscribe((state) => seen.push(state.a));
    store.setState({ a: 1 });
    store.setState({ a: 2 });
    store.setState((state) => ({ a: state.a + 1 }));
    expect(seen).toEqual([2, 3]);
    expect(store.getState().b).toEqual({ x: 1 });
  });
});

describe('moment', () => {
  it('keeps one selection and one cursor; seeking only patches a recording cursor', () => {
    const moment = createMomentStore('p1');
    const changes: string[] = [];
    moment.subscribe((state, previous) => {
      if (state.selection !== previous.selection) changes.push('selection');
      if (state.cursor !== previous.cursor) changes.push('cursor');
    });
    moment.seek({ tick: 3 });
    expect(moment.getState().cursor).toBeNull();
    moment.select({ kind: 'node', scope: [], nodeId: 'q1_ff' });
    moment.select({ nodeId: 'q1_ff', scope: [], kind: 'node' }); // same object, other key order
    moment.setCursor({ source: 'recording', runId: 'r1', tick: 0, view: 'published', eventOrder: null });
    moment.seek({ tick: 3 });
    moment.seek({ tick: 3 });
    expect(moment.getState().cursor).toEqual({ source: 'recording', runId: 'r1', tick: 3, view: 'published', eventOrder: null });
    expect(changes).toEqual(['selection', 'cursor', 'cursor']);
  });

  it('keeps the inspection anchor while selecting inside the cone and clears it with the selection', () => {
    const moment = createMomentStore('p1');
    moment.select({ kind: 'port', scope: [], nodeId: 'q1_out', port: 'in' }, { anchor: { nodeId: 'q1_out', port: 'in' } });
    moment.select({ kind: 'node', scope: [], nodeId: 'd1_rst' });
    expect(moment.getState().anchor).toEqual({ nodeId: 'q1_out', port: 'in' });
    moment.select(null);
    expect(moment.getState().anchor).toBeNull();
  });

  it('steps discrete ticks and clamps at the ends', () => {
    const ticks = [0, 1, 2, 3, 4, 5, 6];
    expect(stepTick(ticks, 3, 1)).toBe(4);
    expect(stepTick(ticks, 6, 1)).toBe(6);
    expect(stepTick(ticks, 0, -1)).toBe(0);
    expect(stepTick([0, 2, 4], 3, 1)).toBe(4);
    expect(stepTick([0, 2, 4], 3, -1)).toBe(2);
    // Outside the recorded range the first step lands on the nearest recorded tick.
    expect(stepTick([0, 2, 4], 9, -1)).toBe(4);
    expect(stepTick([0, 2, 4], 9, 1)).toBe(4);
    expect(stepTick([0, 2, 4], -5, 1)).toBe(0);
    expect(stepTick([0, 2, 4], -5, -1)).toBe(0);
    expect(sameMoment({ source: 'live', seq: 1 }, { source: 'live', seq: 1 })).toBe(true);
    expect(sameMoment({ source: 'live', seq: 1 }, null)).toBe(false);
  });
});

describe('object refs', () => {
  const engineeringRefs: EngineeringObjectRef[] = [
    { kind: 'project' },
    { kind: 'signal', fieldId: 'q1', runSignal: 'q1_out.in', nodeId: 'q1_out' },
    { kind: 'signal', fieldId: 'q0', runSignal: null },
    { kind: 'node', moduleId: 'top', nodeId: 'q1_ff' },
    { kind: 'node', moduleId: 'FullAdderCell', nodeId: 'x1' },
    { kind: 'module', moduleId: 'FullAdderCell' },
    { kind: 'component', componentName: 'Adder' },
    { kind: 'macro', macroId: 'm1', macroName: 'Half' },
    { kind: 'scenario', scenarioId: 's1' },
    { kind: 'case-tick', scenarioId: 's1', tick: 3 },
    { kind: 'signal-edge', fieldId: 'clk', tick: 2 },
    { kind: 'board-resource', constraintSetId: 'default', pin: 'U16' },
    { kind: 'constraint-set', constraintSetId: 'default' },
    { kind: 'source-range', fileId: 'top.vhd', range: { start: { line: 12, column: 1 }, end: { line: 12, column: 9 } } as never },
    { kind: 'artifact', artifactId: 'top.vhd' },
    { kind: 'run', runId: 'run-abc' },
    { kind: 'problem', problemId: 'p-1' },
  ];

  it('round-trips every workbench selection kind without loss', () => {
    for (const ref of engineeringRefs) expect(toEngineeringRef(fromEngineeringRef(ref))).toEqual(ref);
  });

  it('round-trips a Signal Journey selection, including bus, bit and inspection anchor', () => {
    const selection: JourneySelection = {
      projectId: 'p', revision: 'rev', runId: 'run-1', tick: 3, nodeId: 'u_fa2__x1', port: 'out',
      instancePath: ['u_fa2'], bit: 2, busId: 'sum', eventOrder: 41, anchorNodeId: 'q1_out', anchorPort: 'in',
    };
    expect(toJourneySelection(fromJourneySelection(selection))).toEqual(selection);
    const bare: JourneySelection = { ...selection, bit: null, eventOrder: null };
    delete (bare as Partial<JourneySelection>).busId;
    delete (bare as Partial<JourneySelection>).anchorNodeId;
    delete (bare as Partial<JourneySelection>).anchorPort;
    expect(toJourneySelection(fromJourneySelection(bare))).toEqual(bare);
  });

  it('compares refs structurally', () => {
    expect(sameRef({ kind: 'net', scope: [], netId: 'q1_ff.Q' }, { netId: 'q1_ff.Q', kind: 'net', scope: [] })).toBe(true);
    expect(sameRef({ kind: 'net', scope: ['u1'], netId: 'a.out' }, { kind: 'net', scope: [], netId: 'a.out' })).toBe(false);
  });
});

describe('explore clock edge', () => {
  it('pulses exactly the live inputs that drive a clock port', () => {
    expect(clockDrivingInputs(counter, { clk_node: 0, en_node: 1, rst_node: 0 })).toEqual(['clk_node']);
    expect(clockDrivingInputs(counter, { en_node: 1 })).toEqual([]);
  });
});

describe('derived next-state table', () => {
  it('derives D1 = (Q1 xor (Q0 and EN)) and not RST for the counter and evaluates all 16 rows', () => {
    const result = deriveTruthTable(counter, { nodeId: 'q1_ff', port: 'D' }, {
      label: (nodeId) => counter.nodes.find((node) => node.id === nodeId)?.label ?? nodeId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { table } = result;
    expect(table.leaves.map((leaf) => leaf.label).sort()).toEqual(['EN', 'Q0', 'Q1', 'RST']);
    expect(table.rows).toHaveLength(16);
    const at = (name: string, inputs: readonly (0 | 1)[]) => inputs[table.leaves.findIndex((leaf) => leaf.label === name)];
    for (const row of table.rows) {
      const expected = ((at('Q1', row.inputs) ^ (at('Q0', row.inputs) & at('EN', row.inputs))) & (at('RST', row.inputs) ^ 1)) as 0 | 1;
      expect(row.output).toBe(expected);
    }
    expect(table.expression).toContain('⊕');
  });

  it('treats constants as fixed values and Q / Q_inv of one register as one stored bit', () => {
    const wire = (fromNode: string, fromPort: string, toNode: string, toPort: string) => ({ from: { nodeId: fromNode, portName: fromPort }, to: { nodeId: toNode, portName: toPort } });
    // D = (J · ¬Q) + (¬K · Q), with Q_inv feeding the first term and a tied-high enable.
    const jk: Circuit = {
      nodes: [
        { id: 'j', type: 'INPUT', label: 'J' }, { id: 'k', type: 'INPUT', label: 'K' },
        { id: 'vcc', type: 'PowerSource', label: 'VCC' },
        { id: 'ff', type: 'DFlipFlop', label: 'Q' },
        { id: 'a1', type: 'AND3', label: 'A1' }, { id: 'nk', type: 'NOT', label: 'NK' },
        { id: 'a2', type: 'AND', label: 'A2' }, { id: 'or', type: 'OR', label: 'OR' },
      ] as Circuit['nodes'],
      connections: [
        wire('j', 'out', 'a1', 'a'), wire('ff', 'Q_inv', 'a1', 'b'), wire('vcc', 'out', 'a1', 'c'),
        wire('k', 'out', 'nk', 'in'), wire('nk', 'out', 'a2', 'a'), wire('ff', 'Q', 'a2', 'b'),
        wire('a1', 'out', 'or', 'a'), wire('a2', 'out', 'or', 'b'), wire('or', 'out', 'ff', 'D'),
      ],
    };
    const result = deriveTruthTable(jk, { nodeId: 'ff', port: 'D' }, { label: (nodeId) => jk.nodes.find((node) => node.id === nodeId)?.label ?? nodeId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { table } = result;
    expect(table.leaves.map((leaf) => leaf.label)).toEqual(['J', 'Q', 'K']);
    expect(table.rows).toHaveLength(8);
    for (const row of table.rows) {
      const [j, q, k] = row.inputs;
      expect(row.output).toBe(((j & (q ^ 1)) | ((k ^ 1) & q)) as 0 | 1);
    }
    expect(table.expression).toContain('¬Q');
    expect(table.expression).toContain('1');
  });

  it('keeps the bits of a register bus distinct and folds qBar onto Q', () => {
    const wire = (fromNode: string, fromPort: string, toNode: string, toPort: string) => ({ from: { nodeId: fromNode, portName: fromPort }, to: { nodeId: toNode, portName: toPort } });
    const bus: Circuit = {
      nodes: [
        { id: 's', type: 'RegisterBus', label: 'S' },
        { id: 'ff', type: 'DFlipFlop', label: 'F' },
        { id: 'and', type: 'AND', label: 'AND' },
        { id: 'xor', type: 'XOR', label: 'XOR' },
      ] as Circuit['nodes'],
      connections: [
        wire('s', 'Q[0]', 'and', 'a'), wire('s', 'Q[1]', 'and', 'b'),
        wire('ff', 'Q', 'xor', 'a'), wire('ff', 'qBar', 'xor', 'b'),
      ],
    };
    // The drawing's metadata: a scalar Q next to a two-bit Q[1:0] bus, as the register family has.
    const getMetadata = (type: string) => (type === 'RegisterBus'
      ? { inputs: [{ id: 'D[0]', name: 'D[0]' }, { id: 'D[1]', name: 'D[1]' }, { id: 'clk', name: 'clk' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q[0]', name: 'Q[0]' }, { id: 'Q[1]', name: 'Q[1]' }] }
      : type === 'DFlipFlop'
        ? { inputs: [{ id: 'D', name: 'D' }, { id: 'clk', name: 'clk' }], outputs: [{ id: 'Q', name: 'Q' }, { id: 'Q_inv', name: 'Q_inv' }] }
        : undefined) as never;
    const and = deriveTruthTable(bus, { nodeId: 'and', port: 'out' }, { fromDriver: true, getMetadata });
    expect(and.ok).toBe(true);
    if (!and.ok) return;
    expect(and.table.leaves.map((leaf) => `${leaf.nodeId}.${leaf.port}`)).toEqual(['s.Q[0]', 's.Q[1]']);
    expect(and.table.rows.map((row) => row.output)).toEqual([0, 0, 0, 1]);

    const xor = deriveTruthTable(bus, { nodeId: 'xor', port: 'out' }, { fromDriver: true, getMetadata });
    expect(xor.ok).toBe(true);
    if (!xor.ok) return;
    // Q xor not-Q: one stored bit, always 1.
    expect(xor.table.leaves).toHaveLength(1);
    expect(xor.table.rows.map((row) => row.output)).toEqual([1, 1]);
  });

  it('stops honestly instead of guessing', () => {
    expect(deriveTruthTable(counter, { nodeId: 'q1_ff', port: 'D' }, { maxLeaves: 3 })).toEqual({ ok: false, reason: 'More than 3 inputs' });
    const floating = { ...counter, connections: counter.connections.filter((wire) => !(typeof wire.to === 'object' && wire.to.nodeId === 'xor1' && wire.to.portName === 'b')) };
    expect(deriveTruthTable(floating, { nodeId: 'q1_ff', port: 'D' })).toMatchObject({ ok: false });
    expect(deriveTruthTable(counter, { nodeId: 'clk_node', port: 'in' })).toEqual({ ok: false, reason: 'The selected input is undriven' });
  });
});
