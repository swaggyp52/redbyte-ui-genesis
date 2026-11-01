/**
 * Independent known-answer oracles for the artifact-consistency matrix.
 *
 * Every model is derived from documented intent only: example names, summaries,
 * expectedBehavior text and IO labels (apps/ide/examplesCatalog.ts, apps/ide/labStarters.ts,
 * the examples/index.ts registry metadata), lab text (labs/labDefinitions.ts and the JSON
 * labSpec descriptions) and the documented clock semantics cited in each model. This module
 * imports nothing: no RedByte simulation, engine, elaboration or export code, and no example
 * vectors. matrixOracles.test.ts checks every model against hand-written known answers and
 * then compares every authored expected value with the models.
 *
 * Signal ids are the circuit node ids the examples' vectors use as keys.
 */

export type Bit = 0 | 1;
/** One authored row: the level of every signal the model reads. */
export type Row = Readonly<Record<string, Bit>>;
/** null: the documented intent does not determine this output for this row (don't care). */
export type ModelValue = Bit | null;
export type ModelOutputs = Readonly<Record<string, ModelValue>>;

export type ExampleSource = 'ide' | 'json';
export type ExampleClass = 'reference' | 'starter' | 'negative' | 'unknown';
/**
 * combinational: each row on its own inputs.
 * clocked-macro: each row drives the non-clock inputs, then one CLK 0->1->0 pulse, then samples.
 * manual-clock: each row drives the clock level; only a low-to-high change from the previous row
 *   (start level 0) is an active edge; the row is sampled after it settles.
 * level-sensitive: storage that follows input levels (latches); no clock.
 */
export type TimingMode = 'combinational' | 'clocked-macro' | 'manual-clock' | 'level-sensitive';

export interface Oracle {
  /** `${source}:${exampleId}`. */
  readonly key: string;
  readonly source: ExampleSource;
  readonly exampleId: string;
  readonly timing: TimingMode;
  /** Signals every row must carry (data inputs; for manual-clock models also the clocks). */
  readonly inputs: readonly string[];
  /** Clock signals. A clocked-macro model pulses its clock itself and does not read it from rows. */
  readonly clocks: readonly string[];
  readonly outputs: readonly string[];
  /** The documented function, in words. */
  readonly intent: string;
  /** Clock, reset, initial-state and sampling assumptions (with where they are documented). */
  readonly semantics: string;
  readonly evidence: readonly string[];
  /** Outputs for each row in order; a sequential model starts from its documented initial state. */
  run(rows: readonly Row[]): ModelOutputs[];
}

// ---------------------------------------------------------------------------------------------
// Documentation the models cite
// ---------------------------------------------------------------------------------------------

const DOCS = {
  clockedMacro:
    'docs/release/course-edition/15-counter-verification-semantics.md ("drive non-clock inputs, apply CLK=0, tick, ' +
    'apply CLK=1, tick, apply CLK=0, tick, then sample"; rising edge; post-rising-edge samples)',
  checkpointMacro:
    'packages/rb-lab-engine/src/verification/verifyTruthTable.ts header (checkpoint clocked_macro: drive non-clock ' +
    'inputs -> [clk=0, clk=1, clk=0] -> sample outputs)',
  autoBoardClock:
    'docs/manuals/RedByte_Product_Manual.md, Clocked / sequential schedule ("every Auto report row ... is sampled ' +
    'post-rising-edge", cycle 0 included)',
  manualClock:
    'docs/manuals/RedByte_Product_Manual.md, manual/custom mode ("each authored row is one settled sample"; "Only a ' +
    'low-to-high transition advances the supported rising-edge state model"; start level 0)',
  zeroInit:
    'docs/release/course-edition/15-counter-verification-semantics.md ("Intended initial state 00, established by ' +
    'initial zero state")',
  risingEdge:
    'docs/manuals/RedByte_Product_Manual.md (activeEdge normalized to rising; no falling-edge capture); ' +
    'labs/labDefinitions.ts lab-6 ("rising-edge D flip-flop")',
} as const;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

type Reader = (id: string) => Bit;

function reader(key: string, row: Row): Reader {
  return (id) => {
    const value = row[id];
    if (value !== 0 && value !== 1) throw new Error(`${key}: row has no 0/1 value for ${id}`);
    return value;
  };
}

/** The unsigned value of bits listed least-significant first. */
function wordOf(read: Reader, ids: readonly string[]): number {
  return ids.reduce((value, id, index) => value + read(id) * 2 ** index, 0);
}

/** Bits of `value`, least-significant first, keyed by `ids`. */
function bitsOf(value: number, ids: readonly string[]): Record<string, Bit> {
  return Object.fromEntries(ids.map((id, index) => [id, Math.floor(value / 2 ** index) % 2 === 1 ? 1 : 0]));
}

const not = (value: Bit): Bit => (value === 1 ? 0 : 1);
const bit = (value: boolean): Bit => (value ? 1 : 0);
const range = (count: number) => Array.from({ length: count }, (_, index) => index);

function checked(key: string, outputs: readonly string[], values: Record<string, ModelValue>): ModelOutputs {
  const produced = Object.keys(values).sort();
  const declared = [...outputs].sort();
  if (produced.join() !== declared.join()) {
    throw new Error(`${key}: model produced [${produced.join(', ')}], declared [${declared.join(', ')}]`);
  }
  return values;
}

interface Common {
  source: ExampleSource;
  exampleId: string;
  inputs: readonly string[];
  outputs: readonly string[];
  intent: string;
  evidence: readonly string[];
}

function combinational(spec: Common & { fn: (read: Reader) => Record<string, ModelValue> }): Oracle {
  const key = `${spec.source}:${spec.exampleId}`;
  return {
    key,
    source: spec.source,
    exampleId: spec.exampleId,
    timing: 'combinational',
    inputs: spec.inputs,
    clocks: [],
    outputs: spec.outputs,
    intent: spec.intent,
    semantics: 'Combinational: each row is evaluated on its own inputs; no state.',
    evidence: spec.evidence,
    run: (rows) =>
      rows.map((row) => {
        const read = reader(key, row);
        spec.inputs.forEach((id) => read(id));
        return checked(key, spec.outputs, spec.fn(read));
      }),
  };
}

interface SequentialSpec<S> extends Common {
  timing: Exclude<TimingMode, 'combinational'>;
  clock?: string;
  semantics: string;
  initial: S;
  /** The state after one active (rising) clock edge taken with this row's inputs. */
  edge?: (state: S, read: Reader) => S;
  /** Level-sensitive behaviour (latch transparency, asynchronous clear), applied around every edge. */
  level?: (state: S, read: Reader) => S;
  observe: (state: S, read: Reader) => Record<string, ModelValue>;
}

function sequential<S>(spec: SequentialSpec<S>): Oracle {
  const key = `${spec.source}:${spec.exampleId}`;
  const clocks = spec.clock ? [spec.clock] : [];
  const rowSignals = spec.timing === 'manual-clock' ? [...spec.inputs, ...clocks] : [...spec.inputs];
  const edge = spec.edge ?? ((state: S) => state);
  const level = spec.level ?? ((state: S) => state);
  return {
    key,
    source: spec.source,
    exampleId: spec.exampleId,
    timing: spec.timing,
    inputs: rowSignals,
    clocks,
    outputs: spec.outputs,
    intent: spec.intent,
    semantics: spec.semantics,
    evidence: spec.evidence,
    run: (rows) => {
      let state = spec.initial;
      let previousClock: Bit = 0;
      return rows.map((row) => {
        const read = reader(key, row);
        rowSignals.forEach((id) => read(id));
        state = level(state, read);
        if (spec.timing === 'clocked-macro') {
          state = level(edge(state, read), read);
        } else if (spec.timing === 'manual-clock' && spec.clock) {
          const clock = read(spec.clock);
          if (previousClock === 0 && clock === 1) state = level(edge(state, read), read);
          previousClock = clock;
        }
        return checked(key, spec.outputs, spec.observe(state, read));
      });
    },
  };
}

function adderOutputs(total: number, sumIds: readonly string[], carryId: string): Record<string, Bit> {
  return { ...bitsOf(total % 2 ** sumIds.length, sumIds), [carryId]: bit(total >= 2 ** sumIds.length) };
}

// ---------------------------------------------------------------------------------------------
// Lab 8 security lock (labs/labDefinitions.ts lab-8, labStarters.ts, 23_lab8 labSpec)
// ---------------------------------------------------------------------------------------------

/**
 * pos: position in the current 3-bit group (0 -> 1 -> 2 -> 0 per ENTER edge); b0/b1: IN0 captured
 * at positions 0 and 1; groups: consecutive valid groups; lock: LOCK, which stays high once reached.
 */
export interface LockState {
  readonly pos: 0 | 1 | 2;
  readonly b0: Bit;
  readonly b1: Bit;
  readonly groups: number;
  readonly lock: Bit;
}

export const LOCK_CLEARED: LockState = { pos: 0, b0: 0, b1: 0, groups: 0, lock: 0 };

/** One ENTER edge with serial bit `in0`. A group is valid when it is 010 or 100. */
export function lockEdge(state: LockState, in0: Bit): LockState {
  if (state.pos === 0) return { ...state, b0: in0, pos: 1 };
  if (state.pos === 1) return { ...state, b1: in0, pos: 2 };
  const valid = in0 === 0 && state.b0 !== state.b1;
  const groups = valid ? Math.min(state.groups + 1, 4) : 0;
  return { ...state, pos: 0, groups, lock: state.lock === 1 || groups === 4 ? 1 : 0 };
}

const LAB8_INTENT =
  'Moore FSM: a position counter cycles 0->1->2 per ENTER edge; IN0 is captured at positions 0 and 1; at position 2 ' +
  'group_valid = NOT(IN0) AND (bit_at_p0 XOR bit_at_p1) (valid groups 010 and 100); four consecutive valid groups ' +
  'set LOCK, which stays high once reached; RESET clears all state; IN1/IN2 are unused.';
const LAB8_EVIDENCE = [
  'labs/labDefinitions.ts lab-8 learningGoal, whatToDo, buildSteps, simulateChecks and rubric',
  'apps/ide/labStarters.ts lab8-security-lock-fsm description and goals (ENTER SW5 manual clock, RESET SW4 clear)',
];
const LAB8_RESET_SEMANTICS =
  'RESET is a level-sensitive clear that needs no ENTER edge (lab-8 hardwareSteps: "Use SW4 to RESET first (toggle it ' +
  'on then off)"; "Toggling RESET clears all state"). Initial state: cleared. The vectors do not distinguish ' +
  '"consecutive" from "hold on an invalid group", nor sticky from plain m4 after unlock (both streams end at bit 12).';

// ---------------------------------------------------------------------------------------------
// The models
// ---------------------------------------------------------------------------------------------

const SIGNAL_TOUR = ['0', '1', '2', '3'];
const ADDER4_A = ['a0', 'a1', 'a2', 'a3'];
const ADDER4_B = ['b0', 'b1', 'b2', 'b3'];
const ADDER4_SUM = ['sum0', 'sum1', 'sum2', 'sum3'];
const fourBitAdder = (source: ExampleSource, exampleId: string, intent: string, evidence: readonly string[]) =>
  combinational({
    source,
    exampleId,
    inputs: [...ADDER4_A, ...ADDER4_B],
    outputs: [...ADDER4_SUM, 'carry-out'],
    intent,
    evidence,
    fn: (read) => adderOutputs(wordOf(read, ADDER4_A) + wordOf(read, ADDER4_B), ADDER4_SUM, 'carry-out'),
  });

const ALU_A = ['sw_a0', 'sw_a1', 'sw_a2', 'sw_a3'];
const ALU_B = ['sw_b0', 'sw_b1', 'sw_b2', 'sw_b3'];
const ALU_OP = ['sw_op0', 'sw_op1', 'sw_op2'];
const ALU_RESULT = ['led0', 'led1', 'led2', 'led3'];

const REGISTER_D = ['d0', 'd1', 'd2', 'd3'];
const REGISTER_Q = ['q0', 'q1', 'q2', 'q3'];
const LAB7_Q = ['led_q0', 'led_q1', 'led_q2', 'led_q3'];

export const ORACLES: readonly Oracle[] = [
  // ----- IDE catalog: reference designs ------------------------------------------------------
  combinational({
    source: 'ide',
    exampleId: 'signal-tour',
    inputs: SIGNAL_TOUR.map((k) => `sw${k}_node`),
    outputs: SIGNAL_TOUR.map((k) => `ld${k}_node`),
    intent: 'Each switch drives its LED: LDk = SWk for k = 0..3.',
    evidence: ['examplesCatalog.ts signal-tour expectedBehavior "SW0->LD0, SW1->LD1, SW2->LD2, SW3->LD3"'],
    fn: (read) => Object.fromEntries(SIGNAL_TOUR.map((k) => [`ld${k}_node`, read(`sw${k}_node`)])),
  }),
  combinational({
    source: 'ide',
    exampleId: 'logic-gates',
    inputs: ['sw0_node', 'sw1_node'],
    outputs: ['ld0_node', 'ld1_node', 'ld2_node'],
    intent: 'LD0 = SW0 AND SW1, LD1 = SW0 OR SW1, LD2 = SW0 XOR SW1.',
    evidence: ['examplesCatalog.ts logic-gates expectedBehavior and probe labels AND/OR/XOR'],
    fn: (read) => {
      const a = read('sw0_node');
      const b = read('sw1_node');
      return { ld0_node: bit(a === 1 && b === 1), ld1_node: bit(a === 1 || b === 1), ld2_node: bit(a !== b) };
    },
  }),
  sequential<number>({
    source: 'ide',
    exampleId: 'two-bit-counter',
    timing: 'clocked-macro',
    clock: 'clk_node',
    inputs: ['en_node', 'rst_node'],
    outputs: ['q0_out', 'q1_out'],
    intent: '2-bit up counter: with EN (SW0) high it advances on each rising CLK100MHZ edge; BTNC (RST) is a synchronous reset to 00; LD1:LD0 show the count.',
    semantics:
      `Auto board clock: each row is one rising edge with the row's EN/RST and a post-edge sample (${DOCS.autoBoardClock}; ` +
      `${DOCS.clockedMacro}). RST is synchronous and wins over EN (summary "BTNC is synchronous reset"). Initial count 00 ` +
      `(${DOCS.zeroInit}).`,
    evidence: [
      'examplesCatalog.ts two-bit-counter summary ("SW0 enables counting; LD1:LD0 show 00->11; BTNC is synchronous reset") and expectedBehavior',
    ],
    initial: 0,
    edge: (count, read) => (read('rst_node') === 1 ? 0 : read('en_node') === 1 ? (count + 1) % 4 : count),
    observe: (count) => bitsOf(count, ['q0_out', 'q1_out']),
  }),
  combinational({
    source: 'ide',
    exampleId: 'half-adder',
    inputs: ['sw0_node', 'sw1_node'],
    outputs: ['ld0_node', 'ld1_node'],
    intent: 'A = SW0, B = SW1; LD1 = SUM = A XOR B; LD0 = CARRY = A AND B.',
    evidence: ['examplesCatalog.ts half-adder summary/expectedBehavior and IO labels "LD0 (CARRY)", "LD1 (SUM)"'],
    fn: (read) => {
      const total = read('sw0_node') + read('sw1_node');
      return { ld1_node: bit(total % 2 === 1), ld0_node: bit(total >= 2) };
    },
  }),
  combinational({
    source: 'ide',
    exampleId: 'full-adder',
    inputs: ['sw0_node', 'sw1_node', 'sw2_node'],
    outputs: ['ld0_node', 'ld1_node'],
    intent: 'A = SW0, B = SW1, CIN = SW2; LD1 = SUM and LD0 = CARRY-OUT of A + B + CIN.',
    evidence: ['examplesCatalog.ts full-adder summary/expectedBehavior and IO labels "SW2 (CIN)", "LD0 (CARRY)", "LD1 (SUM)"'],
    fn: (read) => {
      const total = read('sw0_node') + read('sw1_node') + read('sw2_node');
      return { ld1_node: bit(total % 2 === 1), ld0_node: bit(total >= 2) };
    },
  }),
  fourBitAdder('ide', 'four-bit-adder-hierarchical', 'SUM[3:0], CARRY = A[3:0] + B[3:0] (carry-in 0).', [
    'examplesCatalog.ts four-bit-adder-hierarchical summary ("A[3:0] + B[3:0] -> SUM[3:0], CARRY") and expectedBehavior',
    'IO labels A[i] (SW2i), B[i] (SW2i+1), SUM[i] (LDi), CARRY (LD4)',
  ]),
  fourBitAdder('ide', 'four-bit-adder', 'LD0-LD3 = 4-bit sum and LD4 = carry-out of A[3:0] + B[3:0].', [
    'examplesCatalog.ts four-bit-adder expectedBehavior ("SW0/SW2/SW4/SW6 are A0-A3 and SW1/SW3/SW5/SW7 are B0-B3")',
  ]),

  // ----- IDE catalog: lab starters with a documented function ----------------------------------
  combinational({
    source: 'ide',
    exampleId: 'lab1-gates',
    inputs: ['sw0_node', 'sw1_node'],
    outputs: ['ld0_node'],
    intent: 'After wiring: LD0 = SW0 AND SW1.',
    evidence: ['labStarters.ts lab1-gates expectedBehavior "LD0 lights when both SW0 and SW1 are high (after wiring AND gate)"'],
    fn: (read) => ({ ld0_node: bit(read('sw0_node') === 1 && read('sw1_node') === 1) }),
  }),
  combinational({
    source: 'ide',
    exampleId: 'lab3-mux',
    inputs: ['d0_node', 'd1_node', 'sel_node'],
    outputs: ['y_node'],
    intent: 'Y = D0 when SEL = 0; Y = D1 when SEL = 1.',
    evidence: ['labStarters.ts lab3-mux expectedBehavior'],
    fn: (read) => ({ y_node: read('sel_node') === 1 ? read('d1_node') : read('d0_node') }),
  }),
  combinational({
    source: 'ide',
    exampleId: 'lab4-decoder',
    inputs: ['a_node', 'b_node'],
    outputs: ['y0_node', 'y1_node', 'y2_node', 'y3_node'],
    intent: 'Yk is high exactly when AB = k, with A written first (the MSB): AB=00 -> Y0, 01 -> Y1, 10 -> Y2, 11 -> Y3.',
    evidence: ['labStarters.ts lab4-decoder expectedBehavior "Y0 high when AB=00; Y1 high when AB=01; Y2 high when AB=10; Y3 high when AB=11"'],
    fn: (read) => {
      const index = 2 * read('a_node') + read('b_node');
      return Object.fromEntries(range(4).map((k) => [`y${k}_node`, bit(k === index)]));
    },
  }),
  combinational({
    source: 'ide',
    exampleId: 'lab5-adder',
    inputs: ['a_node', 'b_node'],
    outputs: ['sum_node', 'carry_node'],
    intent: 'SUM = A XOR B; CARRY = A AND B.',
    evidence: ['labStarters.ts lab5-adder expectedBehavior "SUM = A XOR B; CARRY = A AND B."'],
    fn: (read) => {
      const total = read('a_node') + read('b_node');
      return { sum_node: bit(total % 2 === 1), carry_node: bit(total >= 2) };
    },
  }),
  combinational({
    source: 'ide',
    exampleId: 'lab6-full-adder',
    inputs: ['a_node', 'b_node', 'cin_node'],
    outputs: ['sum_node', 'cout_node'],
    intent: 'SUM and Cout of the 1-bit full addition A + B + Cin.',
    evidence: ['labStarters.ts lab6-full-adder description and expectedBehavior'],
    fn: (read) => {
      const total = read('a_node') + read('b_node') + read('cin_node');
      return { sum_node: bit(total % 2 === 1), cout_node: bit(total >= 2) };
    },
  }),
  combinational({
    source: 'ide',
    exampleId: 'lab7-comparator',
    inputs: ['a_node', 'b_node'],
    outputs: ['gt_node', 'eq_node', 'lt_node'],
    intent: '1-bit magnitude comparator: GT = A > B, EQ = A = B, LT = A < B (exactly one is high).',
    evidence: ['labStarters.ts lab7-comparator description and expectedBehavior'],
    fn: (read) => {
      const a = read('a_node');
      const b = read('b_node');
      return { gt_node: bit(a > b), eq_node: bit(a === b), lt_node: bit(a < b) };
    },
  }),
  sequential<LockState>({
    source: 'ide',
    exampleId: '23_lab8-fsm-lock-starter-basys3',
    timing: 'manual-clock',
    clock: 'sw_enter',
    inputs: ['sw_in0', 'sw_reset'],
    outputs: ['led_lock'],
    intent: LAB8_INTENT,
    semantics:
      `ENTER (SW5) is a manual clock authored per row: only a 0->1 change from the previous row (start level 0) is an ` +
      `edge, and every row is sampled after settling, so LOCK (= m4.Q, a Moore output) shows the new state on the row ` +
      `where ENTER rises (${DOCS.manualClock}). ${LAB8_RESET_SEMANTICS}`,
    evidence: LAB8_EVIDENCE,
    initial: LOCK_CLEARED,
    level: (state, read) => (read('sw_reset') === 1 ? LOCK_CLEARED : state),
    edge: (state, read) => lockEdge(state, read('sw_in0')),
    observe: (state) => ({ led_lock: state.lock }),
  }),

  // ----- JSON registry: reference designs ------------------------------------------------------
  combinational({
    source: 'json',
    exampleId: '01_wire-lamp',
    inputs: [],
    outputs: ['lamp1'],
    intent: 'A power source lights the lamp: lamp1 = 1.',
    evidence: ['examples/index.ts 01_wire-lamp "Basic power source connected to a lamp"'],
    fn: () => ({ lamp1: 1 }),
  }),
  combinational({
    source: 'json',
    exampleId: '02_and-gate',
    inputs: ['sw1', 'sw2'],
    outputs: ['lamp1'],
    intent: 'lamp1 = sw1 AND sw2.',
    evidence: ['examples/index.ts 02_and-gate "Two switches controlling a lamp through an AND gate"'],
    fn: (read) => ({ lamp1: bit(read('sw1') === 1 && read('sw2') === 1) }),
  }),
  combinational({
    source: 'json',
    exampleId: '03_half-adder',
    inputs: ['a_in', 'b_in'],
    outputs: ['sum_lamp', 'carry_lamp'],
    intent: 'sum_lamp = a XOR b; carry_lamp = a AND b.',
    evidence: ['examples/index.ts 03_half-adder "1-bit half adder with sum and carry outputs"; node ids sum_lamp/carry_lamp'],
    fn: (read) => {
      const total = read('a_in') + read('b_in');
      return { sum_lamp: bit(total % 2 === 1), carry_lamp: bit(total >= 2) };
    },
  }),
  combinational({
    source: 'json',
    exampleId: '06_xor-gate',
    inputs: ['input-a', 'input-b'],
    outputs: ['output'],
    intent: 'output = input-a XOR input-b.',
    evidence: ['examples/index.ts 06_xor-gate "XOR Gate from NANDs" / "Build XOR using three NAND gates"'],
    fn: (read) => ({ output: bit(read('input-a') !== read('input-b')) }),
  }),
  combinational({
    source: 'json',
    exampleId: '07_2to1-mux',
    inputs: ['input-a', 'input-b', 'select'],
    outputs: ['output'],
    intent: 'output = input-a when select = 0, input-b when select = 1 (first input is D0, as in lab3-mux "Y = D0 when SEL=0").',
    evidence: ['examples/index.ts 07_2to1-mux "Choose between two inputs using a select signal"', 'labStarters.ts lab3-mux convention'],
    fn: (read) => ({ output: read('select') === 1 ? read('input-b') : read('input-a') }),
  }),
  combinational({
    source: 'json',
    exampleId: '08_full-adder',
    inputs: ['input-a', 'input-b', 'carry-in'],
    outputs: ['sum-output', 'carry-output'],
    intent: 'sum-output and carry-output of input-a + input-b + carry-in.',
    evidence: ['examples/index.ts 08_full-adder "1-bit full adder with carry-in support for chaining"'],
    fn: (read) => {
      const total = read('input-a') + read('input-b') + read('carry-in');
      return { 'sum-output': bit(total % 2 === 1), 'carry-output': bit(total >= 2) };
    },
  }),
  fourBitAdder('json', '09_4bit-adder', 'sum[3:0], carry-out = a[3:0] + b[3:0] (no carry-in input; carry-in 0).', [
    'examples/index.ts 09_4bit-adder "Chain four full adders to add 4-bit numbers"',
    'labs/labDefinitions.ts lab-2 expected behaviour (0011 + 0001 = 0100; 1111 + 0001 = 0000, Cout 1)',
  ]),
  sequential<{ readonly q: Bit | null; readonly both: boolean }>({
    source: 'json',
    exampleId: '10_sr-latch',
    timing: 'level-sensitive',
    inputs: ['set', 'reset'],
    outputs: ['q-output', 'qbar-output'],
    intent: 'NOR SR latch: set=1 -> Q=1; reset=1 -> Q=0; both 0 -> hold; both 1 -> Q = Qbar = 0.',
    semantics:
      'Level-sensitive, no clock. Power-up state is undetermined (null) until set or reset; releasing set=reset=1 ' +
      'together races, so the state is undetermined again.',
    evidence: ['examples/index.ts 10_sr-latch "First memory circuit - stores 1 bit using feedback loops"; NOR node types and q/qbar outputs'],
    initial: { q: null, both: false },
    level: (state, read) => {
      const s = read('set');
      const r = read('reset');
      if (s === 1 && r === 1) return { q: state.q, both: true };
      if (s === 1) return { q: 1, both: false };
      if (r === 1) return { q: 0, both: false };
      return state.both ? { q: null, both: false } : state;
    },
    observe: (state) =>
      state.both
        ? { 'q-output': 0, 'qbar-output': 0 }
        : { 'q-output': state.q, 'qbar-output': state.q === null ? null : not(state.q) },
  }),
  sequential<Bit | null>({
    source: 'json',
    exampleId: '11_d-flipflop',
    timing: 'manual-clock',
    clock: 'clock',
    inputs: ['data'],
    outputs: ['q-output', 'qbar-output'],
    intent: 'D flip-flop: Q takes D at each active clock edge and holds between edges; Qbar = NOT Q.',
    semantics:
      `Rising edge (${DOCS.risingEdge}); the clock is the level of the Clock node per row. Power-up state of the ` +
      'gate-level master-slave is undetermined (null) until the first edge.',
    evidence: ['examples/index.ts 11_d-flipflop "Clock-controlled memory - the foundation of registers"'],
    initial: null,
    edge: (_state, read) => read('data'),
    observe: (q) => ({ 'q-output': q, 'qbar-output': q === null ? null : not(q) }),
  }),
  combinational({
    source: 'json',
    exampleId: '12_2to4-decoder',
    inputs: ['a0', 'a1'],
    outputs: ['y0', 'y1', 'y2', 'y3'],
    intent: 'yk = 1 exactly when the 2-bit input a1a0 (a0 the LSB) equals k.',
    evidence: ['examples/index.ts 12_2to4-decoder "Decodes 2-bit input into 4 output lines"'],
    fn: (read) => {
      const index = wordOf(read, ['a0', 'a1']);
      return Object.fromEntries(range(4).map((k) => [`y${k}`, bit(k === index)]));
    },
  }),
  combinational({
    source: 'json',
    exampleId: '13_4to1-mux',
    inputs: ['d0', 'd1', 'd2', 'd3', 's0', 's1'],
    outputs: ['output'],
    intent: 'output = d[s1 s0] (s0 the LSB).',
    evidence: ['examples/index.ts 13_4to1-mux "Selects one of four inputs using 2 control signals"'],
    fn: (read) => ({ output: read(`d${wordOf(read, ['s0', 's1'])}`) }),
  }),
  sequential<ReadonlyArray<Bit | null>>({
    source: 'json',
    exampleId: '14_4bit-register',
    timing: 'manual-clock',
    clock: 'clk',
    inputs: REGISTER_D,
    outputs: REGISTER_Q,
    intent: '4-bit register: q[3:0] takes d[3:0] together at each active clock edge and holds between edges.',
    semantics: `Rising edge (${DOCS.risingEdge}); power-up contents undetermined (null) until the first edge.`,
    evidence: ['examples/index.ts 14_4bit-register "Stores 4 bits simultaneously - the building block of CPU registers"'],
    initial: [null, null, null, null],
    edge: (_state, read) => REGISTER_D.map((id) => read(id)),
    observe: (q) => Object.fromEntries(REGISTER_Q.map((id, index) => [id, q[index]])),
  }),
  combinational({
    source: 'json',
    exampleId: '15_not-gate',
    inputs: ['sw1'],
    outputs: ['lamp1'],
    intent: 'lamp1 = NOT sw1.',
    evidence: ['examples/index.ts 15_not-gate "A switch, inverter, and lamp to show signal inversion"'],
    fn: (read) => ({ lamp1: not(read('sw1')) }),
  }),
  sequential<Bit>({
    source: 'json',
    exampleId: '24_dlatch-example',
    timing: 'level-sensitive',
    inputs: ['sw_d', 'sw_en'],
    outputs: ['led_q', 'led_q_inv'],
    intent: 'Transparent D latch: Q follows D while EN = 1 and holds while EN = 0; Q_inv = NOT Q.',
    semantics: `Level-sensitive. Initial Q = 0 (a DLatch part; ${DOCS.zeroInit}).`,
    evidence: ['examples/index.ts 24_dlatch-example description ("level-triggered storage")', 'labs/labDefinitions.ts lab-6 D latch check'],
    initial: 0,
    level: (q, read) => (read('sw_en') === 1 ? read('sw_d') : q),
    observe: (q) => ({ led_q: q, led_q_inv: not(q) }),
  }),
  sequential<Bit>({
    source: 'json',
    exampleId: '25_tff-example',
    timing: 'manual-clock',
    clock: 'sw_clk',
    inputs: ['sw_t'],
    outputs: ['led_q'],
    intent: 'T flip-flop: Q toggles at each rising clock edge when T = 1 and holds when T = 0.',
    semantics: `Rising edge (${DOCS.risingEdge}); CLR is unconnected (inactive). Initial Q = 0 (${DOCS.zeroInit}).`,
    evidence: ['examples/index.ts 25_tff-example description ("Toggles its output on every clock edge when T = 1, holds when T = 0")'],
    initial: 0,
    edge: (q, read) => (read('sw_t') === 1 ? not(q) : q),
    observe: (q) => ({ led_q: q }),
  }),

  // ----- JSON registry: starters and negatives with a documented function --------------------
  combinational({
    source: 'json',
    exampleId: '19_lab4-alu-starter-basys3',
    inputs: [...ALU_A, ...ALU_B, ...ALU_OP],
    outputs: [...ALU_RESULT, 'led4'],
    intent:
      'Opcode S2S1S0 (SW10..SW8): 000 AND, 001 OR, 010 XOR, 011 ADD of A = SW[3:0] and B = SW[7:4] on LED[3:0]; ' +
      'LED[4] = Cout of FA[3], wired straight from the A + B ripple chain, so it is the A + B carry for every opcode. ' +
      'Opcodes 1xx are not documented (null).',
    evidence: [
      'labs/labDefinitions.ts lab-4 whatToDo opcode table, buildSteps ("Connect FA[3] Cout to LED[4]"; "tie Cin of FA[0] to ground")',
      'labs/labDefinitions.ts lab-4 expected-behaviour table (A=0011, B=0001)',
    ],
    fn: (read) => {
      const a = wordOf(read, ALU_A);
      const b = wordOf(read, ALU_B);
      const op = wordOf(read, ALU_OP);
      const results = [a & b, a | b, a ^ b, (a + b) % 16];
      const result = op < 4 ? results[op] : undefined;
      return {
        ...(result === undefined
          ? Object.fromEntries(ALU_RESULT.map((id) => [id, null]))
          : bitsOf(result, ALU_RESULT)),
        led4: bit(a + b >= 16),
      };
    },
  }),
  {
    key: 'json:21_lab6-flipflop-starter',
    source: 'json',
    exampleId: '21_lab6-flipflop-starter',
    timing: 'manual-clock',
    inputs: ['dl_d', 'dl_g', 'dff_d', 'dff_clk', 'tff_t', 'tff_clk', 'jkff_j', 'jkff_k', 'jkff_clk'],
    clocks: ['dff_clk', 'tff_clk', 'jkff_clk'],
    outputs: ['dl_q', 'dff_q', 'tff_q', 'jkff_q'],
    intent:
      'Four devices: D latch (Q follows D while G = 1, holds while G = 0); rising-edge D flip-flop; T flip-flop with CLR ' +
      'tied low (T = 0 holds, T = 1 toggles); JK flip-flop with CLR tied low (00 hold, 01 reset, 10 set, 11 toggle).',
    semantics: `Each flip-flop has its own manual clock (${DOCS.manualClock}); the latch is level-sensitive. All four start at 0 (${DOCS.zeroInit}).`,
    evidence: ['labs/labDefinitions.ts lab-6 whatToDo, buildSteps and simulateChecks', 'IO labels DL_D/DL_G, DFF_D/DFF_CLK, TFF_T/TFF_CLK, JK_J/JK_K/JK_CLK'],
    run: (rows) => {
      const key = 'json:21_lab6-flipflop-starter';
      let dl: Bit = 0;
      let dff: Bit = 0;
      let tff: Bit = 0;
      let jk: Bit = 0;
      let previous = { dff_clk: 0 as Bit, tff_clk: 0 as Bit, jkff_clk: 0 as Bit };
      return rows.map((row) => {
        const read = reader(key, row);
        const rose = (clock: keyof typeof previous) => previous[clock] === 0 && read(clock) === 1;
        if (read('dl_g') === 1) dl = read('dl_d');
        if (rose('dff_clk')) dff = read('dff_d');
        if (rose('tff_clk') && read('tff_t') === 1) tff = not(tff);
        if (rose('jkff_clk')) {
          const j = read('jkff_j');
          const k = read('jkff_k');
          jk = j === 1 && k === 1 ? not(jk) : j === 1 ? 1 : k === 1 ? 0 : jk;
        }
        previous = { dff_clk: read('dff_clk'), tff_clk: read('tff_clk'), jkff_clk: read('jkff_clk') };
        return { dl_q: dl, dff_q: dff, tff_q: tff, jkff_q: jk };
      });
    },
  },
  sequential<number>({
    source: 'json',
    exampleId: '22_lab7-sync-counter-starter-basys3',
    timing: 'clocked-macro',
    clock: 'sw_clk',
    inputs: ['sw_en', 'sw_rst'],
    outputs: LAB7_Q,
    intent: '4-bit synchronous up counter: Q3..Q0 advance by one per CLK rising edge while EN = 1, hold while EN = 0; RST is a synchronous reset to 0000 and wins over EN.',
    semantics:
      `The checkpoint declares schedule clocked_macro with clockSignal sw_clk: each row is one pulse and a post-edge ` +
      `sample (${DOCS.checkpointMacro}). Reset is synchronous (lab-7 commonMistakes "Asynchronous reset assumptions in ` +
      `synchronous design"). Initial count 0000 (${DOCS.zeroInit}).`,
    evidence: [
      '22_lab7 labSpec objective "Prove a deterministic 0->15 trajectory under clocked macro stepping"',
      'labs/labDefinitions.ts lab-7 whatToDo, simulateChecks and hardwareSteps (EN<-SW8, CLK<-SW7, RST<-SW6, Q3..Q0 -> LED3..LED0)',
    ],
    initial: 0,
    edge: (count, read) => (read('sw_rst') === 1 ? 0 : read('sw_en') === 1 ? (count + 1) % 16 : count),
    observe: (count) => bitsOf(count, LAB7_Q),
  }),
  sequential<LockState>({
    source: 'json',
    exampleId: '23_lab8-fsm-lock-starter-basys3',
    timing: 'clocked-macro',
    clock: 'sw_enter',
    inputs: ['sw_in0', 'sw_reset'],
    outputs: ['led_lock'],
    intent: LAB8_INTENT,
    semantics:
      `The checkpoints declare schedule clocked_macro with clockSignal sw_enter: each row is one ENTER pulse and a ` +
      `post-edge sample (${DOCS.checkpointMacro}). ${LAB8_RESET_SEMANTICS}`,
    evidence: [...LAB8_EVIDENCE, '23_lab8 labSpec description ("LOCK (LED1) should rise only after the fourth valid 3-bit group finishes")'],
    initial: LOCK_CLEARED,
    level: (state, read) => (read('sw_reset') === 1 ? LOCK_CLEARED : state),
    edge: (state, read) => lockEdge(state, read('sw_in0')),
    observe: (state) => ({ led_lock: state.lock }),
  }),
];

export function oracleFor(source: ExampleSource, exampleId: string): Oracle | undefined {
  return ORACLES.find((oracle) => oracle.source === source && oracle.exampleId === exampleId);
}

// ---------------------------------------------------------------------------------------------
// Classification of every shipped example
// ---------------------------------------------------------------------------------------------

export interface ExampleClassification {
  readonly source: ExampleSource;
  readonly id: string;
  readonly cls: ExampleClass;
  /** Why the class applies. */
  readonly evidence: string;
  /** Content defects or support limits found while deriving the model (not vector disagreements). */
  readonly caveats?: readonly string[];
}

export const EXAMPLE_CLASSIFICATIONS: readonly ExampleClassification[] = [
  { source: 'ide', id: 'signal-tour', cls: 'reference', evidence: 'Complete 4-wire passthrough; expectedBehavior names every SW->LD pair.' },
  { source: 'ide', id: 'logic-gates', cls: 'reference', evidence: 'Complete AND/OR/XOR circuit; expectedBehavior gives each LED function.' },
  { source: 'ide', id: 'two-bit-counter', cls: 'reference', evidence: 'Complete counter (XOR/AND next-state, NOT/AND synchronous reset, two DFlipFlops); summary and expectedBehavior.' },
  {
    source: 'ide', id: 'half-adder', cls: 'reference', evidence: 'Complete XOR/AND half adder; labels LD0 (CARRY), LD1 (SUM).',
    caveats: ['expectedBehavior says "Both LEDs light only when both switches are ON", but with both ON SUM = 0, so only LD0 lights; the sentence contradicts the function and the labels.'],
  },
  { source: 'ide', id: 'full-adder', cls: 'reference', evidence: 'Complete two-XOR, two-AND, OR full adder; labels SW2 (CIN), LD0 (CARRY), LD1 (SUM).' },
  { source: 'ide', id: 'four-bit-adder-hierarchical', cls: 'reference', evidence: 'FullAdderCell module instantiated four times, carry chained, CIN of u_fa0 on Ground.' },
  {
    source: 'ide', id: 'four-bit-adder', cls: 'reference', evidence: 'Circuit of 09_4bit-adder.json with SW/LED labels.',
    caveats: ['Bit-0 carry-in pins (fa0-xor2.in2, fa0-and2.in2) are left unconnected rather than tied to Ground; the design relies on an open input reading 0.'],
  },
  { source: 'ide', id: 'lab1-gates', cls: 'starter', evidence: 'No connections, no vectors; summary "Wire an AND gate between SW0/SW1 and LD0".' },
  { source: 'ide', id: 'lab2-combinational', cls: 'starter', evidence: 'No connections, no vectors; the Boolean expression is not given anywhere ("Implement the required Boolean expression"), so no model.' },
  { source: 'ide', id: 'lab3-mux', cls: 'starter', evidence: 'No connections, no vectors; expectedBehavior gives the mux function.' },
  { source: 'ide', id: 'lab4-decoder', cls: 'starter', evidence: 'No connections, no vectors; expectedBehavior gives the decode table.' },
  { source: 'ide', id: 'lab5-adder', cls: 'starter', evidence: 'No connections; ships 4 authored vectors; expectedBehavior "SUM = A XOR B; CARRY = A AND B".' },
  { source: 'ide', id: 'lab6-full-adder', cls: 'starter', evidence: 'No connections; ships 8 authored vectors.' },
  { source: 'ide', id: 'lab7-comparator', cls: 'starter', evidence: 'No connections; ships 4 authored vectors.' },
  {
    source: 'ide', id: '23_lab8-fsm-lock-starter-basys3', cls: 'starter',
    evidence: 'Scaffold: eight DFlipFlops share ENTER/RESET, but no D, EN or group logic is wired ("unsolved subsystem scaffold"); ships 76 manual-clock vectors.',
    caveats: ['The proven solution in __tests__/lab8-export-validation.test.ts drives LOCK straight from m4.Q and clears the milestones on an invalid group, but m4 is not sticky; the lab text says "LOCK stays high once reached". No vector reaches past bit 12, so the difference is untested.'],
  },
  { source: 'json', id: '01_wire-lamp', cls: 'reference', evidence: 'PowerSource -> Lamp, complete.' },
  { source: 'json', id: '02_and-gate', cls: 'reference', evidence: 'Two Switches -> AND -> Lamp, complete.' },
  { source: 'json', id: '03_half-adder', cls: 'reference', evidence: 'XOR/AND half adder, complete.' },
  {
    source: 'json', id: '04_4bit-counter', cls: 'negative',
    evidence: 'Counter4Bit is category "unsupported" in componentSupportRegistry.ts (simulation, verification and VHDL export false); the clock is a sim-only Clock node.',
  },
  {
    source: 'json', id: '05_simple-cpu', cls: 'unknown',
    evidence: '"Basic CPU with registers and ALU - runs real programs" documents no observable behaviour; the netlist is two DFlipFlops into one FullAdder Sum with no carry-in, no program and a sim-only Clock.',
  },
  {
    source: 'json', id: '06_xor-gate', cls: 'reference', evidence: 'Intent is XOR ("XOR Gate from NANDs").',
    caveats: ['The netlist does not compute XOR: nand2 = NAND(a, NAND(a,b)) = NOT a OR b, so nand3 = NAND(b, nand2) = NOT b. output = NOT input-b (wrong for a=0). XOR needs four 2-input NANDs; "three NAND gates" cannot work.'],
  },
  {
    source: 'json', id: '07_2to1-mux', cls: 'reference', evidence: 'NOT/AND/AND/OR mux, complete.',
    caveats: ['Legacy flat connections (from: "<id>", fromPort/toPort) and in1/in2 pin names; examples/index.ts normalizes only 17 and 18, so loadExampleAsProject reads conn.from.nodeId of a string (undefined) for 07-11.'],
  },
  { source: 'json', id: '08_full-adder', cls: 'reference', evidence: 'Two XOR, two AND, OR full adder, complete.', caveats: ['Legacy flat connections, as for 07.'] },
  {
    source: 'json', id: '09_4bit-adder', cls: 'reference', evidence: 'Four gate-level full adders chained, complete.',
    caveats: ['Legacy flat connections, as for 07.', 'Bit-0 carry-in pins are unconnected (read as 0).'],
  },
  {
    source: 'json', id: '10_sr-latch', cls: 'reference', evidence: 'Cross-coupled NOR SR latch.',
    caveats: ['A combinational feedback loop: the Verify model is unrunnable and export reports RBEX4102 (combinational loop), so the pipeline blocks rather than checks.', 'Legacy flat connections.'],
  },
  {
    source: 'json', id: '11_d-flipflop', cls: 'reference', evidence: 'NAND master-slave D flip-flop with a Clock node.',
    caveats: [
      'The master latch is transparent while CLK = 1 and the slave while CLK = 0, so Q changes on the falling edge, not on the rising edge every RedByte flip-flop uses.',
      'Combinational feedback loops (RBEX4102) and a sim-only Clock node; legacy flat connections.',
    ],
  },
  { source: 'json', id: '12_2to4-decoder', cls: 'reference', evidence: 'NOT/AND decoder, complete; a0 is the LSB (and-y1 = a0 AND NOT a1).' },
  {
    source: 'json', id: '13_4to1-mux', cls: 'reference', evidence: 'Intent is a 4:1 mux ("Selects one of four inputs using 2 control signals").',
    caveats: ['The netlist is broken: and-d0..and-d3 each have input in1 driven twice (dk.out and and-s0-k.out), and the select ANDs and-s0-k / and-s1-k have only in1 connected, so the select term never reaches the data AND.'],
  },
  {
    source: 'json', id: '14_4bit-register', cls: 'reference', evidence: 'Intent is a 4-bit register ("Stores 4 bits simultaneously").',
    caveats: ['Each "dff" is a 4-NAND gated D latch (transparent while clk = 1), not an edge-triggered flip-flop; it differs from a register whenever D changes while clk is high.', 'Combinational feedback loops (RBEX4102).'],
  },
  { source: 'json', id: '15_not-gate', cls: 'reference', evidence: 'Switch -> NOT -> Lamp, complete.' },
  {
    source: 'json', id: '16_8bit-counter-basys3', cls: 'negative',
    evidence: 'Uses node types CLOCK (registry: simulation and verification false) and D_FLIPFLOP (not in the support registry), has no output node, and drives each flip-flop\'s single "in" port from both the clock and its own inverter.',
  },
  {
    source: 'json', id: '17_traffic-light-fsm-basys3', cls: 'unknown',
    evidence: '"3-state traffic light controller with timer" gives no state order, durations or encoding.',
    caveats: ['The netlist cannot show three distinct lights: red_decoder and yellow_decoder are both AND(state0, state1); timer_reset_logic drives nothing; state0.D is the RESET switch.'],
  },
  {
    source: 'json', id: '18_4bit-alu-basys3', cls: 'unknown',
    evidence: '"ADD/SUB/AND/OR" with OP[1:0], but the opcode-to-operation map and any carry output are undocumented.',
    caveats: ['Under any opcode assignment the netlist cannot match: out = A when OP0 = 0 and A OR B when OP0 = 1 (out_i = (A_i XOR B_i) AND OP0 OR A_i); OP1 is unused and nothing adds.'],
  },
  {
    source: 'json', id: '19_lab4-alu-starter-basys3', cls: 'negative',
    evidence: 'Contains four MUX4 parts (registry: authoring and classroom false; rb-logic-core defines no MUX4 behaviour) and no connections ("Unsolved starter scaffold"); lab-4 text documents the target function, modelled for later use.',
  },
  {
    source: 'json', id: '20_lab5-addsub-starter-basys3', cls: 'starter',
    evidence: 'Three switches and one lamp, no connections ("Unsolved starter scaffold").',
    caveats: ['Lab 5 text previews 4-bit operands (0101 +/- 0011) but the starter has 1-bit M, A, B and one output F; for one bit A + B and A - B have the same result bit, so the intended F is undetermined; no model.'],
  },
  { source: 'json', id: '21_lab6-flipflop-starter', cls: 'starter', evidence: 'Switches, lamps and two Ground nodes, no connections ("Blank four-device scaffold"); lab-6 text documents the four devices.' },
  { source: 'json', id: '22_lab7-sync-counter-starter-basys3', cls: 'starter', evidence: 'Three switches and four lamps, no connections; ships one clocked_macro checkpoint table (16 rows).' },
  { source: 'json', id: '23_lab8-fsm-lock-starter-basys3', cls: 'starter', evidence: 'Same scaffold as the IDE lab 8 starter, no connections; ships three clocked_macro checkpoint tables (12 rows each).' },
  {
    source: 'json', id: '24_dlatch-example', cls: 'reference', evidence: 'DLatch part with D/EN switches and Q/Q_inv lamps, complete.',
    caveats: ['Description says "built from NAND gates"; the circuit is a single DLatch part.'],
  },
  {
    source: 'json', id: '25_tff-example', cls: 'reference', evidence: 'TFlipFlop part with T/CLK switches and a Q lamp, complete.',
    caveats: ['Description says "built from a D flip-flop"; the circuit is a single TFlipFlop part.'],
  },
];

// ---------------------------------------------------------------------------------------------
// Comparing authored vectors with a model
// ---------------------------------------------------------------------------------------------

export interface AuthoredRow {
  readonly tick?: number;
  readonly inputs: Readonly<Record<string, number | boolean>>;
  readonly expected?: Readonly<Record<string, number | boolean>>;
}

export interface Disagreement {
  /** Position in execution order (rows sorted by tick, stable). */
  readonly row: number;
  readonly tick: number;
  readonly signal: string;
  readonly authored: Bit;
  readonly model: Bit;
}

export interface Comparison {
  /** Authored expected cells the model determines. */
  readonly compared: number;
  /** Authored expected cells the model leaves undetermined (null). */
  readonly undetermined: number;
  readonly disagreements: readonly Disagreement[];
  /** Expected keys that are not model outputs. */
  readonly unmodeled: readonly string[];
}

function toBit(value: number | boolean, where: string): Bit {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  throw new Error(`${where}: authored value ${String(value)} is not 0/1`);
}

/** Runs the model on the authored inputs, in execution (tick) order, and compares every expected cell. */
export function compareAuthoredRows(oracle: Oracle, rows: readonly AuthoredRow[]): Comparison {
  const ordered = rows
    .map((row, index) => ({ row, index, tick: Number.isFinite(row.tick) ? Number(row.tick) : index }))
    .sort((left, right) => left.tick - right.tick || left.index - right.index);
  const modelRows: Row[] = ordered.map(({ row, tick }) =>
    Object.fromEntries(Object.entries(row.inputs).map(([id, value]) => [id, toBit(value, `${oracle.key} tick ${tick} ${id}`)])),
  );
  const outputs = oracle.run(modelRows);
  const disagreements: Disagreement[] = [];
  const unmodeled = new Set<string>();
  let compared = 0;
  let undetermined = 0;
  ordered.forEach(({ row, tick }, position) => {
    for (const [signal, value] of Object.entries(row.expected ?? {})) {
      if (!oracle.outputs.includes(signal)) {
        unmodeled.add(signal);
        continue;
      }
      const authored = toBit(value, `${oracle.key} tick ${tick} ${signal}`);
      const model = outputs[position][signal];
      if (model === null) {
        undetermined += 1;
        continue;
      }
      compared += 1;
      if (model !== authored) disagreements.push({ row: position, tick, signal, authored, model });
    }
  });
  return { compared, undetermined, disagreements, unmodeled: [...unmodeled].sort() };
}
