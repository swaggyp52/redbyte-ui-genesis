// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IDE_EXAMPLES } from '../../apps/ide/examplesCatalog';
import {
  EXAMPLE_CLASSIFICATIONS,
  LOCK_CLEARED,
  ORACLES,
  compareAuthoredRows,
  lockEdge,
  oracleFor,
  type AuthoredRow,
  type Bit,
  type ModelValue,
  type Oracle,
  type Row,
} from './matrixOracles';

/**
 * The oracle models against hand-written known answers, then every authored expected
 * value in the shipped examples against the models. Example vectors are read here as
 * data only; nothing in this file or in matrixOracles.ts runs RedByte simulation,
 * elaboration or export code.
 */

const byKey = (key: string): Oracle => {
  const oracle = ORACLES.find((candidate) => candidate.key === key);
  if (!oracle) throw new Error(`no oracle ${key}`);
  return oracle;
};

/** Rows in order; each pairs the inputs with the hand-written expected outputs. */
function expectAnswers(key: string, cases: ReadonlyArray<readonly [Row, Readonly<Record<string, ModelValue>>]>) {
  const outputs = byKey(key).run(cases.map(([inputs]) => inputs));
  cases.forEach(([inputs, expected], index) =>
    expect(outputs[index], `${key} row ${index} ${JSON.stringify(inputs)}`).toEqual(expected));
}

/** '0101' (MSB first) -> { p0: 1, p1: 0, p2: 1, p3: 0 } for ids p0..p3. */
const bitsMsbFirst = (text: string, ids: readonly string[]): Record<string, Bit> =>
  Object.fromEntries([...text].reverse().map((char, index) => [ids[index], char === '1' ? 1 : 0]));
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i}`);

const EXAMPLES_DIR = fileURLToPath(new URL('../../examples/', import.meta.url));
const JSON_EXAMPLES = readdirSync(EXAMPLES_DIR)
  .filter((file) => /^\d\d_.+\.json$/.test(file))
  .map((file) => ({ id: file.replace(/\.json$/, ''), data: JSON.parse(readFileSync(`${EXAMPLES_DIR}${file}`, 'utf8')) }));

describe('oracle independence', () => {
  it('matrixOracles.ts imports nothing', () => {
    const source = readFileSync(fileURLToPath(new URL('./matrixOracles.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\s*\(|\bimport\s*\(/);
  });

  it('a model rejects a row that lacks one of its inputs', () => {
    expect(() => byKey('ide:half-adder').run([{ sw0_node: 1 }])).toThrow(/sw1_node/);
  });

  it('the comparison reports a wrong expectation and an unmodelled output instead of passing them', () => {
    const rows: AuthoredRow[] = [
      { tick: 0, inputs: { sw0_node: 1, sw1_node: 1 }, expected: { ld0_node: 0, ld1_node: 0, ld9_node: 1 } },
    ];
    const result = compareAuthoredRows(byKey('ide:half-adder'), rows);
    expect(result.disagreements).toEqual([{ row: 0, tick: 0, signal: 'ld0_node', authored: 0, model: 1 }]);
    expect(result.unmodeled).toEqual(['ld9_node']);
    expect(result.compared).toBe(2);
  });
});

describe('combinational models: known answers', () => {
  const FULL_ADDER_TABLE: ReadonlyArray<readonly [Bit, Bit, Bit, Bit, Bit]> = [
    // a, b, cin -> sum, cout
    [0, 0, 0, 0, 0], [0, 0, 1, 1, 0], [0, 1, 0, 1, 0], [0, 1, 1, 0, 1],
    [1, 0, 0, 1, 0], [1, 0, 1, 0, 1], [1, 1, 0, 0, 1], [1, 1, 1, 1, 1],
  ];
  const ADDS: ReadonlyArray<readonly [string, string, string, Bit]> = [
    // A + B = SUM, CARRY (MSB first)
    ['0101', '0011', '1000', 0],
    ['0011', '0001', '0100', 0],
    ['1111', '0001', '0000', 1],
    ['0110', '0111', '1101', 0],
    ['1000', '1000', '0000', 1],
    ['1010', '0101', '1111', 0],
    ['1111', '1111', '1110', 1],
    ['0000', '0000', '0000', 0],
  ];

  it.each(['ide:four-bit-adder', 'ide:four-bit-adder-hierarchical', 'json:09_4bit-adder'])('%s adds 4-bit words with carry-out', (key) => {
    expectAnswers(key, ADDS.map(([a, b, sum, carry]) => [
      { ...bitsMsbFirst(a, ids('a', 4)), ...bitsMsbFirst(b, ids('b', 4)) },
      { ...bitsMsbFirst(sum, ids('sum', 4)), 'carry-out': carry },
    ] as const));
  });

  it('full adders follow the carry rules', () => {
    expectAnswers('ide:full-adder', FULL_ADDER_TABLE.map(([a, b, c, s, co]) => [{ sw0_node: a, sw1_node: b, sw2_node: c }, { ld1_node: s, ld0_node: co }] as const));
    expectAnswers('ide:lab6-full-adder', FULL_ADDER_TABLE.map(([a, b, c, s, co]) => [{ a_node: a, b_node: b, cin_node: c }, { sum_node: s, cout_node: co }] as const));
    expectAnswers('json:08_full-adder', FULL_ADDER_TABLE.map(([a, b, c, s, co]) => [{ 'input-a': a, 'input-b': b, 'carry-in': c }, { 'sum-output': s, 'carry-output': co }] as const));
  });

  it('half adders: 1 + 1 = 10', () => {
    const table: ReadonlyArray<readonly [Bit, Bit, Bit, Bit]> = [[0, 0, 0, 0], [0, 1, 1, 0], [1, 0, 1, 0], [1, 1, 0, 1]];
    expectAnswers('ide:half-adder', table.map(([a, b, s, c]) => [{ sw0_node: a, sw1_node: b }, { ld1_node: s, ld0_node: c }] as const));
    expectAnswers('ide:lab5-adder', table.map(([a, b, s, c]) => [{ a_node: a, b_node: b }, { sum_node: s, carry_node: c }] as const));
    expectAnswers('json:03_half-adder', table.map(([a, b, s, c]) => [{ a_in: a, b_in: b }, { sum_lamp: s, carry_lamp: c }] as const));
  });

  it('gates, wires and inversion', () => {
    expectAnswers('ide:logic-gates', [
      [{ sw0_node: 0, sw1_node: 0 }, { ld0_node: 0, ld1_node: 0, ld2_node: 0 }],
      [{ sw0_node: 0, sw1_node: 1 }, { ld0_node: 0, ld1_node: 1, ld2_node: 1 }],
      [{ sw0_node: 1, sw1_node: 1 }, { ld0_node: 1, ld1_node: 1, ld2_node: 0 }],
    ]);
    expectAnswers('ide:signal-tour', [
      [{ sw0_node: 1, sw1_node: 0, sw2_node: 1, sw3_node: 0 }, { ld0_node: 1, ld1_node: 0, ld2_node: 1, ld3_node: 0 }],
    ]);
    expectAnswers('ide:lab1-gates', [[{ sw0_node: 1, sw1_node: 0 }, { ld0_node: 0 }], [{ sw0_node: 1, sw1_node: 1 }, { ld0_node: 1 }]]);
    expectAnswers('json:01_wire-lamp', [[{}, { lamp1: 1 }]]);
    expectAnswers('json:02_and-gate', [[{ sw1: 1, sw2: 0 }, { lamp1: 0 }], [{ sw1: 1, sw2: 1 }, { lamp1: 1 }]]);
    expectAnswers('json:15_not-gate', [[{ sw1: 0 }, { lamp1: 1 }], [{ sw1: 1 }, { lamp1: 0 }]]);
    expectAnswers('json:06_xor-gate', [
      [{ 'input-a': 0, 'input-b': 0 }, { output: 0 }], [{ 'input-a': 0, 'input-b': 1 }, { output: 1 }],
      [{ 'input-a': 1, 'input-b': 0 }, { output: 1 }], [{ 'input-a': 1, 'input-b': 1 }, { output: 0 }],
    ]);
  });

  it('multiplexers select by the select bits', () => {
    expectAnswers('ide:lab3-mux', [
      [{ d0_node: 1, d1_node: 0, sel_node: 0 }, { y_node: 1 }],
      [{ d0_node: 1, d1_node: 0, sel_node: 1 }, { y_node: 0 }],
    ]);
    expectAnswers('json:07_2to1-mux', [
      [{ 'input-a': 0, 'input-b': 1, select: 0 }, { output: 0 }],
      [{ 'input-a': 0, 'input-b': 1, select: 1 }, { output: 1 }],
    ]);
    const d = { d0: 0, d1: 0, d2: 1, d3: 0 } as const;
    expectAnswers('json:13_4to1-mux', [
      [{ ...d, s0: 0, s1: 1 }, { output: 1 }],
      [{ ...d, s0: 1, s1: 0 }, { output: 0 }],
      [{ d0: 1, d1: 0, d2: 0, d3: 1, s0: 1, s1: 1 }, { output: 1 }],
    ]);
  });

  it('decoders raise exactly one line', () => {
    expectAnswers('ide:lab4-decoder', [
      [{ a_node: 1, b_node: 0 }, { y0_node: 0, y1_node: 0, y2_node: 1, y3_node: 0 }],
      [{ a_node: 0, b_node: 1 }, { y0_node: 0, y1_node: 1, y2_node: 0, y3_node: 0 }],
    ]);
    expectAnswers('json:12_2to4-decoder', [
      [{ a0: 0, a1: 1 }, { y0: 0, y1: 0, y2: 1, y3: 0 }],
      [{ a0: 1, a1: 1 }, { y0: 0, y1: 0, y2: 0, y3: 1 }],
    ]);
  });

  it('the comparator raises exactly one of GT, EQ, LT', () => {
    expectAnswers('ide:lab7-comparator', [
      [{ a_node: 1, b_node: 0 }, { gt_node: 1, eq_node: 0, lt_node: 0 }],
      [{ a_node: 0, b_node: 1 }, { gt_node: 0, eq_node: 0, lt_node: 1 }],
      [{ a_node: 0, b_node: 0 }, { gt_node: 0, eq_node: 1, lt_node: 0 }],
    ]);
  });

  it('the lab 4 ALU follows the opcode table (A=0011, B=0001) and LED4 carries A + B', () => {
    const row = (a: string, b: string, op: string): Row => ({
      ...bitsMsbFirst(a, ids('sw_a', 4)), ...bitsMsbFirst(b, ids('sw_b', 4)), ...bitsMsbFirst(op, ids('sw_op', 3)),
    });
    const out = (result: string | null, carry: Bit) => ({
      ...(result === null ? Object.fromEntries(ids('led', 4).map((id) => [id, null])) : bitsMsbFirst(result, ids('led', 4))),
      led4: carry,
    });
    expectAnswers('json:19_lab4-alu-starter-basys3', [
      [row('0011', '0001', '000'), out('0001', 0)],
      [row('0011', '0001', '001'), out('0011', 0)],
      [row('0011', '0001', '010'), out('0010', 0)],
      [row('0011', '0001', '011'), out('0100', 0)],
      [row('1111', '0001', '011'), out('0000', 1)],
      [row('1111', '0001', '000'), out('0001', 1)],
      [row('1111', '0001', '100'), out(null, 1)],
    ]);
  });
});

describe('sequential models: known answers', () => {
  it('two-bit counter: one rising edge per row, synchronous reset over enable, wraps at 4', () => {
    const r = (en: Bit, rst: Bit): Row => ({ en_node: en, rst_node: rst });
    const q = (value: number) => ({ q0_out: (value & 1) as Bit, q1_out: ((value >> 1) & 1) as Bit });
    expectAnswers('ide:two-bit-counter', [
      [r(0, 1), q(0)], [r(1, 0), q(1)], [r(1, 0), q(2)], [r(1, 1), q(0)], [r(1, 0), q(1)],
      [r(0, 0), q(1)], [r(1, 0), q(2)], [r(1, 0), q(3)], [r(1, 0), q(0)],
    ]);
  });

  it('lab 7 counter: first pulse from power-up shows 0001; hold, synchronous reset, wrap at 16', () => {
    const r = (en: Bit, rst: Bit): Row => ({ sw_en: en, sw_rst: rst });
    const q = (value: string) => bitsMsbFirst(value, ['led_q0', 'led_q1', 'led_q2', 'led_q3']);
    expectAnswers('json:22_lab7-sync-counter-starter-basys3', [
      [r(1, 0), q('0001')], [r(1, 0), q('0010')], [r(0, 0), q('0010')], [r(1, 1), q('0000')], [r(1, 0), q('0001')],
    ]);
    const counted = byKey('json:22_lab7-sync-counter-starter-basys3').run(Array.from({ length: 17 }, () => r(1, 0)));
    expect(counted[14]).toEqual(q('1111'));
    expect(counted[15]).toEqual(q('0000'));
    expect(counted[16]).toEqual(q('0001'));
  });

  it('lock edge: only 010 and 100 are valid groups', () => {
    const groupValid = (bits: [Bit, Bit, Bit]) => {
      const state = bits.reduce((s, b) => lockEdge(s, b), { ...LOCK_CLEARED, groups: 3 });
      return state.lock;
    };
    const valid = (['000', '001', '010', '011', '100', '101', '110', '111'] as const)
      .filter((g) => groupValid([...g].map(Number) as [Bit, Bit, Bit]) === 1);
    expect(valid).toEqual(['010', '100']);
  });

  const pulses = (bits: string) => [...bits].map((b) => ({ sw_in0: (b === '1' ? 1 : 0) as Bit, sw_reset: 0 as Bit }));
  const lockTrace = (key: string, rows: Row[]) => byKey(key).run(rows).map((out) => out.led_lock).join('');

  it('lab 8 lock (one pulse per row): four consecutive valid groups unlock at pulse 12, and LOCK stays high', () => {
    const key = 'json:23_lab8-fsm-lock-starter-basys3';
    expect(lockTrace(key, pulses('100100100100'))).toBe('000000000001');
    expect(lockTrace(key, pulses('010010010'))).toBe('000000000');
    // An invalid fourth group restarts the count: the next four valid groups unlock at pulse 24.
    expect(lockTrace(key, pulses('010010010110010010010010'))).toBe('000000000000000000000001');
    // Unlocked stays unlocked through an invalid group.
    expect(lockTrace(key, pulses('010100010100111'))).toBe('000000000001111');
    // RESET clears position and progress.
    const reset = [...pulses('010100'), { sw_in0: 0 as Bit, sw_reset: 1 as Bit }, ...pulses('010100010100')];
    expect(lockTrace(key, reset)).toBe('0000000000000000001');
  });

  it('lab 8 lock (manual ENTER): only a 0->1 change is an edge and LOCK rises on that row', () => {
    const key = 'ide:23_lab8-fsm-lock-starter-basys3';
    const row = (in0: Bit, enter: Bit, reset: Bit = 0): Row => ({ sw_in0: in0, sw_enter: enter, sw_reset: reset });
    const stream = [...'100100100100'].flatMap((b) => [row(b === '1' ? 1 : 0, 0), row(b === '1' ? 1 : 0, 1)]);
    const trace = lockTrace(key, stream);
    expect(trace).toBe(`${'0'.repeat(23)}1`);
    // Holding ENTER high, or lowering it, advances nothing: three highs are one edge.
    const held = [row(1, 1), row(0, 1), row(0, 1), row(0, 0), ...[...'00100100100'].flatMap((b) => [row(b === '1' ? 1 : 0, 0), row(b === '1' ? 1 : 0, 1)])];
    expect(lockTrace(key, held)).toBe(`${'0'.repeat(25)}1`);
    // RESET clears without an ENTER edge.
    expect(lockTrace(key, [...stream, row(0, 0, 1), row(0, 0, 0)])).toBe(`${'0'.repeat(23)}100`);
  });

  it('SR latch: set, hold, reset, both-high, and the race after both-high', () => {
    const r = (s: Bit, rr: Bit): Row => ({ set: s, reset: rr });
    expectAnswers('json:10_sr-latch', [
      [r(0, 0), { 'q-output': null, 'qbar-output': null }],
      [r(1, 0), { 'q-output': 1, 'qbar-output': 0 }],
      [r(0, 0), { 'q-output': 1, 'qbar-output': 0 }],
      [r(0, 1), { 'q-output': 0, 'qbar-output': 1 }],
      [r(1, 1), { 'q-output': 0, 'qbar-output': 0 }],
      [r(0, 0), { 'q-output': null, 'qbar-output': null }],
      [r(1, 0), { 'q-output': 1, 'qbar-output': 0 }],
    ]);
  });

  it('D flip-flop and register capture on rising edges only', () => {
    const r = (data: Bit, clock: Bit): Row => ({ data, clock });
    expectAnswers('json:11_d-flipflop', [
      [r(1, 0), { 'q-output': null, 'qbar-output': null }],
      [r(1, 1), { 'q-output': 1, 'qbar-output': 0 }],
      [r(0, 1), { 'q-output': 1, 'qbar-output': 0 }],
      [r(0, 0), { 'q-output': 1, 'qbar-output': 0 }],
      [r(0, 1), { 'q-output': 0, 'qbar-output': 1 }],
    ]);
    const reg = (d: string, clk: Bit): Row => ({ ...bitsMsbFirst(d, ids('d', 4)), clk });
    const unknown = Object.fromEntries(ids('q', 4).map((id) => [id, null]));
    expectAnswers('json:14_4bit-register', [
      [reg('1010', 0), unknown],
      [reg('1010', 1), bitsMsbFirst('1010', ids('q', 4))],
      [reg('0110', 1), bitsMsbFirst('1010', ids('q', 4))],
      [reg('0110', 0), bitsMsbFirst('1010', ids('q', 4))],
      [reg('0110', 1), bitsMsbFirst('0110', ids('q', 4))],
    ]);
  });

  it('D latch is transparent while EN is high; T flip-flop toggles on rising edges with T high', () => {
    const latch = (d: Bit, en: Bit): Row => ({ sw_d: d, sw_en: en });
    expectAnswers('json:24_dlatch-example', [
      [latch(1, 0), { led_q: 0, led_q_inv: 1 }],
      [latch(1, 1), { led_q: 1, led_q_inv: 0 }],
      [latch(0, 1), { led_q: 0, led_q_inv: 1 }],
      [latch(1, 0), { led_q: 0, led_q_inv: 1 }],
    ]);
    const t = (tt: Bit, clk: Bit): Row => ({ sw_t: tt, sw_clk: clk });
    expectAnswers('json:25_tff-example', [
      [t(1, 0), { led_q: 0 }], [t(1, 1), { led_q: 1 }], [t(1, 0), { led_q: 1 }], [t(1, 1), { led_q: 0 }],
      [t(0, 0), { led_q: 0 }], [t(0, 1), { led_q: 0 }],
    ]);
  });

  it('lab 6 devices: latch, DFF, TFF and JK each on their own clock', () => {
    const base = { dl_d: 0, dl_g: 0, dff_d: 0, dff_clk: 0, tff_t: 0, tff_clk: 0, jkff_j: 0, jkff_k: 0, jkff_clk: 0 } as const;
    const out = (dl: Bit, dff: Bit, tff: Bit, jk: Bit) => ({ dl_q: dl, dff_q: dff, tff_q: tff, jkff_q: jk });
    expectAnswers('json:21_lab6-flipflop-starter', [
      [{ ...base, dl_d: 1, dl_g: 1, dff_d: 1, tff_t: 1, jkff_j: 1 }, out(1, 0, 0, 0)],
      [{ ...base, dl_d: 0, dl_g: 0, dff_d: 1, dff_clk: 1, tff_t: 1, tff_clk: 1, jkff_j: 1, jkff_clk: 1 }, out(1, 1, 1, 1)],
      [{ ...base, dff_d: 0, dff_clk: 1, tff_t: 1, tff_clk: 1, jkff_k: 1, jkff_clk: 1 }, out(1, 1, 1, 1)],
      [{ ...base, tff_t: 1, jkff_j: 1, jkff_k: 1 }, out(1, 1, 1, 1)],
      [{ ...base, tff_t: 1, tff_clk: 1, jkff_j: 1, jkff_k: 1, jkff_clk: 1 }, out(1, 1, 0, 0)],
      [{ ...base, jkff_j: 1 }, out(1, 1, 0, 0)],
      [{ ...base, jkff_j: 1, jkff_clk: 1 }, out(1, 1, 0, 1)],
      [{ ...base }, out(1, 1, 0, 1)],
      [{ ...base, jkff_clk: 1 }, out(1, 1, 0, 1)],
      [{ ...base, jkff_k: 1 }, out(1, 1, 0, 1)],
      [{ ...base, jkff_k: 1, jkff_clk: 1 }, out(1, 1, 0, 0)],
    ]);
  });
});

describe('classification of every shipped example', () => {
  const ideIds = IDE_EXAMPLES.map((example) => example.id);
  const jsonIds = JSON_EXAMPLES.map((example) => example.id);

  it('classifies every IDE example and every JSON registry example exactly once', () => {
    const classified = (source: string) => EXAMPLE_CLASSIFICATIONS.filter((c) => c.source === source).map((c) => c.id);
    expect(classified('ide')).toEqual(ideIds);
    expect([...classified('json')].sort()).toEqual([...jsonIds].sort());
    expect(new Set(EXAMPLE_CLASSIFICATIONS.map((c) => `${c.source}:${c.id}`)).size).toBe(EXAMPLE_CLASSIFICATIONS.length);
  });

  it('models every reference design, and only classified examples', () => {
    const references = EXAMPLE_CLASSIFICATIONS.filter((c) => c.cls === 'reference');
    expect(references.filter((c) => !oracleFor(c.source, c.id)).map((c) => c.id)).toEqual([]);
    const classified = new Set(EXAMPLE_CLASSIFICATIONS.map((c) => `${c.source}:${c.id}`));
    expect(ORACLES.map((o) => o.key).filter((key) => !classified.has(key))).toEqual([]);
  });

  it('every oracle signal is a node of its example, and IDE models cover every output row', () => {
    for (const oracle of ORACLES) {
      const nodes: Array<{ id: string }> = oracle.source === 'ide'
        ? IDE_EXAMPLES.find((e) => e.id === oracle.exampleId)!.circuit.nodes
        : JSON_EXAMPLES.find((e) => e.id === oracle.exampleId)!.data.nodes;
      const nodeIds = new Set(nodes.map((node) => node.id));
      const signals = [...oracle.inputs, ...oracle.clocks, ...oracle.outputs];
      expect(signals.filter((id) => !nodeIds.has(id)), oracle.key).toEqual([]);
      if (oracle.source === 'ide') {
        const outputRows = IDE_EXAMPLES.find((e) => e.id === oracle.exampleId)!.ioRows.filter((r) => r.direction === 'out').map((r) => r.nodeId);
        expect([...oracle.outputs].sort(), oracle.key).toEqual([...outputRows].sort());
      }
    }
  });
});

describe('authored vectors against the models', () => {
  interface VectorSet { key: string; set: string; oracle: Oracle; rows: AuthoredRow[] }
  const sets: VectorSet[] = [
    ...IDE_EXAMPLES.filter((example) => example.vectors.length > 0).map((example) => ({
      key: `ide:${example.id}`, set: 'vectors', oracle: oracleFor('ide', example.id)!, rows: example.vectors as AuthoredRow[],
    })),
    ...JSON_EXAMPLES.flatMap((example) =>
      ((example.data.labSpec?.checkpoints ?? []) as Array<{ id: string; config?: { table?: Array<{ inputs: AuthoredRow['inputs']; outputs: AuthoredRow['expected'] }> } }>)
        .filter((checkpoint) => (checkpoint.config?.table ?? []).length > 0)
        .map((checkpoint) => ({
          key: `json:${example.id}`, set: checkpoint.id, oracle: oracleFor('json', example.id)!,
          rows: checkpoint.config!.table!.map((row) => ({ inputs: row.inputs, expected: row.outputs })),
        }))),
  ];

  it('every example that ships expected values has a model', () => {
    expect(sets.filter((s) => !s.oracle).map((s) => `${s.key} ${s.set}`)).toEqual([]);
  });

  const results = sets.map((s) => ({ ...s, result: compareAuthoredRows(s.oracle, s.rows) }));

  it('compares every authored expected cell (none unmodelled or undetermined)', () => {
    expect(results.map((r) => ({ set: `${r.key} ${r.set}`, compared: r.result.compared, undetermined: r.result.undetermined, unmodeled: r.result.unmodeled }))).toEqual([
      { set: 'ide:signal-tour vectors', compared: 32, undetermined: 0, unmodeled: [] },
      { set: 'ide:logic-gates vectors', compared: 12, undetermined: 0, unmodeled: [] },
      { set: 'ide:two-bit-counter vectors', compared: 14, undetermined: 0, unmodeled: [] },
      { set: 'ide:half-adder vectors', compared: 8, undetermined: 0, unmodeled: [] },
      { set: 'ide:full-adder vectors', compared: 16, undetermined: 0, unmodeled: [] },
      { set: 'ide:four-bit-adder-hierarchical vectors', compared: 30, undetermined: 0, unmodeled: [] },
      { set: 'ide:four-bit-adder vectors', compared: 20, undetermined: 0, unmodeled: [] },
      { set: 'ide:lab5-adder vectors', compared: 8, undetermined: 0, unmodeled: [] },
      { set: 'ide:lab6-full-adder vectors', compared: 16, undetermined: 0, unmodeled: [] },
      { set: 'ide:lab7-comparator vectors', compared: 12, undetermined: 0, unmodeled: [] },
      { set: 'ide:23_lab8-fsm-lock-starter-basys3 vectors', compared: 76, undetermined: 0, unmodeled: [] },
      { set: 'json:22_lab7-sync-counter-starter-basys3 counter-sequence-proof', compared: 64, undetermined: 0, unmodeled: [] },
      { set: 'json:23_lab8-fsm-lock-starter-basys3 fsm-invalid-path', compared: 12, undetermined: 0, unmodeled: [] },
      { set: 'json:23_lab8-fsm-lock-starter-basys3 fsm-valid-path', compared: 12, undetermined: 0, unmodeled: [] },
      { set: 'json:23_lab8-fsm-lock-starter-basys3 fsm-valid-path-2', compared: 12, undetermined: 0, unmodeled: [] },
    ]);
  });

  /**
   * Every authored expectation agrees with the model of its lab text. The two content defects this
   * test used to pin are fixed (2026-10-28): the lab 8 IDE starter expected LOCK one row late at
   * bit 12 (row 74), and the lab 7 checkpoint listed each count one pulse early under its own
   * clocked_macro post-edge sampling (30 bits on 16 rows); its first pulse now resets.
   */
  it('no authored expectation disagrees with its model', () => {
    const found = results.flatMap((r) => r.result.disagreements.map((d) => ({ set: `${r.key} ${r.set}`, ...d })));
    expect(found).toEqual([]);
  });
});
