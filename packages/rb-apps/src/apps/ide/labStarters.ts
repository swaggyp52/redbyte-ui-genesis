import type { TestVector } from '@redbyte/rb-utils';
import type { IdeExampleDefinition } from './examplesCatalog';

export interface LabStarter {
  id: string;
  labNumber: number;
  title: string;
  description: string;
  difficulty: 'intro' | 'intermediate' | 'advanced';
  estimatedMinutes: number;
  example: IdeExampleDefinition;
}

type Lab8Bit = 0 | 1;

const LAB8_INVALID_SEQUENCE = [1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0] as const;
const LAB8_VALID_SEQUENCE = [0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0] as const;

function buildLab8StarterRow(
  tick: number,
  swIn0: Lab8Bit,
  swEnter: Lab8Bit,
  swReset: Lab8Bit,
  ledLock: Lab8Bit,
): TestVector {
  return {
    tick,
    inputs: {
      sw_in0: swIn0,
      sw_in1: 0,
      sw_in2: 0,
      sw_enter: swEnter,
      sw_reset: swReset,
    },
    expected: {
      led_lock: ledLock,
    },
  };
}

function buildLab8StarterSequence(
  startTick: number,
  bits: readonly Lab8Bit[],
  unlockAtBitIndex: number | null,
): TestVector[] {
  const resetRows = [
    buildLab8StarterRow(startTick, 0, 0, 1, 0),
    buildLab8StarterRow(startTick + 1, 0, 0, 0, 0),
  ];

  const pulseRows = bits.flatMap((bit, index) => {
    const pulseStart = startTick + 2 + index * 3;
    const unlockedBeforePulse = unlockAtBitIndex !== null && index > unlockAtBitIndex ? 1 : 0;
    const unlockedAfterPulse = unlockAtBitIndex !== null && index >= unlockAtBitIndex ? 1 : 0;

    return [
      buildLab8StarterRow(pulseStart, bit, 0, 0, unlockedBeforePulse),
      buildLab8StarterRow(pulseStart + 1, bit, 1, 0, unlockedBeforePulse),
      buildLab8StarterRow(pulseStart + 2, bit, 0, 0, unlockedAfterPulse),
    ];
  });

  return [...resetRows, ...pulseRows];
}

function buildLab8StarterVectors(): TestVector[] {
  const invalidVectors = buildLab8StarterSequence(0, LAB8_INVALID_SEQUENCE, null);
  const validVectors = buildLab8StarterSequence(
    invalidVectors.length,
    LAB8_VALID_SEQUENCE,
    LAB8_VALID_SEQUENCE.length - 1,
  );
  return [...invalidVectors, ...validVectors];
}

const LAB8_STARTER_VECTORS = buildLab8StarterVectors();

export const LAB_STARTERS: LabStarter[] = [
  {
    id: 'lab1-gates',
    labNumber: 1,
    title: 'Lab 1 — Basic Logic Gates',
    description: 'Build AND, OR, and NOT circuits. SW inputs drive LED outputs.',
    difficulty: 'intro',
    estimatedMinutes: 30,
    example: {
      id: 'lab1-gates',
      name: 'Lab 1 Starter — Basic Gates',
      summary: 'Two-switch, one-LED scaffold. Wire an AND gate between SW0/SW1 and LD0.',
      course: 'ECE141',
      lab: 'Lab 1',
      concept: 'Combinational Logic',
      tags: ['gates', 'starter', 'lab1'],
      expectedBehavior: 'LD0 lights when both SW0 and SW1 are high (after wiring AND gate).',
      goals: [
        'Wire an AND gate between SW0, SW1 and LD0',
        'Add test vectors and run Verify',
        'Map pins to Basys3 and export',
      ],
      ioRows: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0', direction: 'in',  pin: 'V17', required: true },
        { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1', direction: 'in',  pin: 'V16', required: true },
        { id: 'ld0', nodeId: 'ld0_node', port: 'in',  label: 'LD0', direction: 'out', pin: 'U16', required: true },
      ],
      vectors: [],
      circuit: {
        nodes: [
          { id: 'sw0_node', type: 'INPUT',  x: 100, y: 120, label: 'SW0', config: {}, state: {} },
          { id: 'sw1_node', type: 'INPUT',  x: 100, y: 240, label: 'SW1', config: {}, state: {} },
          { id: 'ld0_node', type: 'OUTPUT', x: 500, y: 180, label: 'LD0', config: {}, state: {} },
        ],
        connections: [],
      },
    },
  },
  {
    id: 'lab2-combinational',
    labNumber: 2,
    title: 'Lab 2 — Combinational Logic',
    description: 'Implement a sum-of-products Boolean expression using gate primitives.',
    difficulty: 'intro',
    estimatedMinutes: 45,
    example: {
      id: 'lab2-combinational',
      name: 'Lab 2 Starter — Combinational Logic',
      summary: 'Three-switch, two-LED scaffold for a Boolean expression circuit.',
      course: 'ECE141',
      lab: 'Lab 2',
      concept: 'Boolean Algebra',
      tags: ['combinational', 'starter', 'lab2'],
      expectedBehavior: 'Implement the required Boolean expression. LD0 and LD1 driven by gate logic.',
      goals: [
        'Build the sum-of-products circuit from your truth table',
        'Add all 8 input combinations as test vectors',
        'Run Verify — all vectors must pass',
      ],
      ioRows: [
        { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0', direction: 'in',  pin: 'V17', required: true },
        { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1', direction: 'in',  pin: 'V16', required: true },
        { id: 'sw2', nodeId: 'sw2_node', port: 'out', label: 'SW2', direction: 'in',  pin: 'W16', required: true },
        { id: 'ld0', nodeId: 'ld0_node', port: 'in',  label: 'LD0', direction: 'out', pin: 'U16', required: true },
        { id: 'ld1', nodeId: 'ld1_node', port: 'in',  label: 'LD1', direction: 'out', pin: 'E19', required: true },
      ],
      vectors: [],
      circuit: {
        nodes: [
          { id: 'sw0_node', type: 'INPUT',  x: 100, y: 100, label: 'SW0', config: {}, state: {} },
          { id: 'sw1_node', type: 'INPUT',  x: 100, y: 200, label: 'SW1', config: {}, state: {} },
          { id: 'sw2_node', type: 'INPUT',  x: 100, y: 300, label: 'SW2', config: {}, state: {} },
          { id: 'ld0_node', type: 'OUTPUT', x: 550, y: 150, label: 'LD0', config: {}, state: {} },
          { id: 'ld1_node', type: 'OUTPUT', x: 550, y: 270, label: 'LD1', config: {}, state: {} },
        ],
        connections: [],
      },
    },
  },
  {
    id: 'lab3-mux',
    labNumber: 3,
    title: 'Lab 3 — Multiplexer',
    description: 'Build a 2-to-1 multiplexer from basic gates and verify with all selector combinations.',
    difficulty: 'intro',
    estimatedMinutes: 45,
    example: {
      id: 'lab3-mux',
      name: 'Lab 3 Starter — Multiplexer',
      summary: '3 inputs (D0, D1, SEL) and 1 output (Y). Wire a 2-to-1 MUX.',
      course: 'ECE141',
      lab: 'Lab 3',
      concept: 'Multiplexers',
      tags: ['mux', 'starter', 'lab3'],
      expectedBehavior: 'Y = D0 when SEL=0; Y = D1 when SEL=1.',
      goals: [
        'Build a 2-to-1 MUX from AND, OR, and NOT gates',
        'Add all 8 test vectors (D0, D1, SEL combinations)',
        'Run Verify — confirm correct selection behavior',
      ],
      ioRows: [
        { id: 'd0',  nodeId: 'd0_node',  port: 'out', label: 'D0',  direction: 'in',  pin: 'V17', required: true },
        { id: 'd1',  nodeId: 'd1_node',  port: 'out', label: 'D1',  direction: 'in',  pin: 'V16', required: true },
        { id: 'sel', nodeId: 'sel_node', port: 'out', label: 'SEL', direction: 'in',  pin: 'W16', required: true },
        { id: 'y',   nodeId: 'y_node',   port: 'in',  label: 'Y',   direction: 'out', pin: 'U16', required: true },
      ],
      vectors: [],
      circuit: {
        nodes: [
          { id: 'd0_node',  type: 'INPUT',  x: 100, y: 100, label: 'D0',  config: {}, state: {} },
          { id: 'd1_node',  type: 'INPUT',  x: 100, y: 200, label: 'D1',  config: {}, state: {} },
          { id: 'sel_node', type: 'INPUT',  x: 100, y: 300, label: 'SEL', config: {}, state: {} },
          { id: 'y_node',   type: 'OUTPUT', x: 550, y: 190, label: 'Y',   config: {}, state: {} },
        ],
        connections: [],
      },
    },
  },
  {
    id: 'lab4-decoder',
    labNumber: 4,
    title: 'Lab 4 — Decoder',
    description: 'Implement a 2-to-4 binary decoder. Each output activates for exactly one input combination.',
    difficulty: 'intermediate',
    estimatedMinutes: 60,
    example: {
      id: 'lab4-decoder',
      name: 'Lab 4 Starter — 2-to-4 Decoder',
      summary: '2 inputs (A, B) and 4 outputs (Y0–Y3). Exactly one output is high at a time.',
      course: 'ECE141',
      lab: 'Lab 4',
      concept: 'Decoders',
      tags: ['decoder', 'starter', 'lab4'],
      expectedBehavior: 'Y0 high when AB=00; Y1 high when AB=01; Y2 high when AB=10; Y3 high when AB=11.',
      goals: [
        'Build 2-to-4 decoder using AND and NOT gates',
        'Add all 4 input combinations as test vectors',
        'Run Verify — confirm only one output active per vector',
      ],
      ioRows: [
        { id: 'a',  nodeId: 'a_node',  port: 'out', label: 'A',  direction: 'in',  pin: 'V17', required: true },
        { id: 'b',  nodeId: 'b_node',  port: 'out', label: 'B',  direction: 'in',  pin: 'V16', required: true },
        { id: 'y0', nodeId: 'y0_node', port: 'in',  label: 'Y0', direction: 'out', pin: 'U16', required: true },
        { id: 'y1', nodeId: 'y1_node', port: 'in',  label: 'Y1', direction: 'out', pin: 'E19', required: true },
        { id: 'y2', nodeId: 'y2_node', port: 'in',  label: 'Y2', direction: 'out', pin: 'U19', required: true },
        { id: 'y3', nodeId: 'y3_node', port: 'in',  label: 'Y3', direction: 'out', pin: 'V19', required: true },
      ],
      vectors: [],
      circuit: {
        nodes: [
          { id: 'a_node',  type: 'INPUT',  x: 100, y: 120, label: 'A',  config: {}, state: {} },
          { id: 'b_node',  type: 'INPUT',  x: 100, y: 240, label: 'B',  config: {}, state: {} },
          { id: 'y0_node', type: 'OUTPUT', x: 550, y:  80, label: 'Y0', config: {}, state: {} },
          { id: 'y1_node', type: 'OUTPUT', x: 550, y: 160, label: 'Y1', config: {}, state: {} },
          { id: 'y2_node', type: 'OUTPUT', x: 550, y: 240, label: 'Y2', config: {}, state: {} },
          { id: 'y3_node', type: 'OUTPUT', x: 550, y: 320, label: 'Y3', config: {}, state: {} },
        ],
        connections: [],
      },
    },
  },
  {
    id: 'lab5-adder',
    labNumber: 5,
    title: 'Lab 5 — Half Adder',
    description: 'Build a 1-bit half adder. Sum (XOR) and Carry (AND) outputs.',
    difficulty: 'intermediate',
    estimatedMinutes: 45,
    example: {
      id: 'lab5-adder',
      name: 'Lab 5 Starter — Half Adder',
      summary: 'Two inputs (A, B) and two outputs (SUM, CARRY). Wire the half adder.',
      course: 'ECE141',
      lab: 'Lab 5',
      concept: 'Arithmetic Circuits',
      tags: ['adder', 'arithmetic', 'starter', 'lab5'],
      expectedBehavior: 'SUM = A XOR B; CARRY = A AND B.',
      goals: [
        'Wire a half adder using XOR and AND gates',
        'Add all 4 input combinations as test vectors',
        'Run Verify — SUM and CARRY must match the truth table',
      ],
      ioRows: [
        { id: 'a',     nodeId: 'a_node',     port: 'out', label: 'A',     direction: 'in',  pin: 'V17', required: true },
        { id: 'b',     nodeId: 'b_node',     port: 'out', label: 'B',     direction: 'in',  pin: 'V16', required: true },
        { id: 'sum',   nodeId: 'sum_node',   port: 'in',  label: 'SUM',   direction: 'out', pin: 'U16', required: true },
        { id: 'carry', nodeId: 'carry_node', port: 'in',  label: 'CARRY', direction: 'out', pin: 'E19', required: true },
      ],
      vectors: [
        { tick: 0, inputs: { a_node: 0, b_node: 0 }, expected: { sum_node: 0, carry_node: 0 } },
        { tick: 1, inputs: { a_node: 0, b_node: 1 }, expected: { sum_node: 1, carry_node: 0 } },
        { tick: 2, inputs: { a_node: 1, b_node: 0 }, expected: { sum_node: 1, carry_node: 0 } },
        { tick: 3, inputs: { a_node: 1, b_node: 1 }, expected: { sum_node: 0, carry_node: 1 } },
      ],
      circuit: {
        nodes: [
          { id: 'a_node',     type: 'INPUT',  x: 100, y: 140, label: 'A',     config: {}, state: {} },
          { id: 'b_node',     type: 'INPUT',  x: 100, y: 240, label: 'B',     config: {}, state: {} },
          { id: 'sum_node',   type: 'OUTPUT', x: 550, y: 140, label: 'SUM',   config: {}, state: {} },
          { id: 'carry_node', type: 'OUTPUT', x: 550, y: 240, label: 'CARRY', config: {}, state: {} },
        ],
        connections: [],
      },
    },
  },
  {
    id: 'lab6-full-adder',
    labNumber: 6,
    title: 'Lab 6 — Full Adder',
    description: 'Extend the half adder with a carry-in input to build a 1-bit full adder.',
    difficulty: 'intermediate',
    estimatedMinutes: 60,
    example: {
      id: 'lab6-full-adder',
      name: 'Lab 6 Starter — Full Adder',
      summary: 'Three inputs (A, B, Cin) and two outputs (SUM, Cout).',
      course: 'ECE141',
      lab: 'Lab 6',
      concept: 'Arithmetic Circuits',
      tags: ['adder', 'arithmetic', 'starter', 'lab6'],
      expectedBehavior: 'SUM and Cout implement 1-bit full addition with carry-in.',
      goals: [
        'Compose two half adders and an OR gate',
        'Add all 8 input combinations as test vectors',
        'Run Verify — all vectors must match the truth table',
      ],
      ioRows: [
        { id: 'a',    nodeId: 'a_node',    port: 'out', label: 'A',    direction: 'in',  pin: 'V17', required: true },
        { id: 'b',    nodeId: 'b_node',    port: 'out', label: 'B',    direction: 'in',  pin: 'V16', required: true },
        { id: 'cin',  nodeId: 'cin_node',  port: 'out', label: 'Cin',  direction: 'in',  pin: 'W16', required: true },
        { id: 'sum',  nodeId: 'sum_node',  port: 'in',  label: 'SUM',  direction: 'out', pin: 'U16', required: true },
        { id: 'cout', nodeId: 'cout_node', port: 'in',  label: 'Cout', direction: 'out', pin: 'E19', required: true },
      ],
      vectors: [
        { tick: 0, inputs: { a_node: 0, b_node: 0, cin_node: 0 }, expected: { sum_node: 0, cout_node: 0 } },
        { tick: 1, inputs: { a_node: 0, b_node: 0, cin_node: 1 }, expected: { sum_node: 1, cout_node: 0 } },
        { tick: 2, inputs: { a_node: 0, b_node: 1, cin_node: 0 }, expected: { sum_node: 1, cout_node: 0 } },
        { tick: 3, inputs: { a_node: 0, b_node: 1, cin_node: 1 }, expected: { sum_node: 0, cout_node: 1 } },
        { tick: 4, inputs: { a_node: 1, b_node: 0, cin_node: 0 }, expected: { sum_node: 1, cout_node: 0 } },
        { tick: 5, inputs: { a_node: 1, b_node: 0, cin_node: 1 }, expected: { sum_node: 0, cout_node: 1 } },
        { tick: 6, inputs: { a_node: 1, b_node: 1, cin_node: 0 }, expected: { sum_node: 0, cout_node: 1 } },
        { tick: 7, inputs: { a_node: 1, b_node: 1, cin_node: 1 }, expected: { sum_node: 1, cout_node: 1 } },
      ],
      circuit: {
        nodes: [
          { id: 'a_node',    type: 'INPUT',  x: 100, y: 120, label: 'A',    config: {}, state: {} },
          { id: 'b_node',    type: 'INPUT',  x: 100, y: 220, label: 'B',    config: {}, state: {} },
          { id: 'cin_node',  type: 'INPUT',  x: 100, y: 320, label: 'Cin',  config: {}, state: {} },
          { id: 'sum_node',  type: 'OUTPUT', x: 550, y: 170, label: 'SUM',  config: {}, state: {} },
          { id: 'cout_node', type: 'OUTPUT', x: 550, y: 270, label: 'Cout', config: {}, state: {} },
        ],
        connections: [],
      },
    },
  },
  {
    id: 'lab7-comparator',
    labNumber: 7,
    title: 'Lab 7 — 1-bit Magnitude Comparator',
    description: 'Determine if A > B, A = B, or A < B for single-bit inputs.',
    difficulty: 'intermediate',
    estimatedMinutes: 60,
    example: {
      id: 'lab7-comparator',
      name: 'Lab 7 Starter — Magnitude Comparator',
      summary: 'Two inputs (A, B) and three outputs (GT, EQ, LT) for comparison.',
      course: 'ECE141',
      lab: 'Lab 7',
      concept: 'Comparators',
      tags: ['comparator', 'starter', 'lab7'],
      expectedBehavior: 'Exactly one of GT, EQ, LT is high for each input pair.',
      goals: [
        'Build the comparator using XNOR, AND, and NOT gates',
        'Add all 4 input combinations as test vectors',
        'Run Verify — confirm mutual exclusion of outputs',
      ],
      ioRows: [
        { id: 'a',  nodeId: 'a_node',  port: 'out', label: 'A',  direction: 'in',  pin: 'V17', required: true },
        { id: 'b',  nodeId: 'b_node',  port: 'out', label: 'B',  direction: 'in',  pin: 'V16', required: true },
        { id: 'gt', nodeId: 'gt_node', port: 'in',  label: 'GT', direction: 'out', pin: 'U16', required: true },
        { id: 'eq', nodeId: 'eq_node', port: 'in',  label: 'EQ', direction: 'out', pin: 'E19', required: true },
        { id: 'lt', nodeId: 'lt_node', port: 'in',  label: 'LT', direction: 'out', pin: 'U19', required: true },
      ],
      vectors: [
        { tick: 0, inputs: { a_node: 0, b_node: 0 }, expected: { gt_node: 0, eq_node: 1, lt_node: 0 } },
        { tick: 1, inputs: { a_node: 0, b_node: 1 }, expected: { gt_node: 0, eq_node: 0, lt_node: 1 } },
        { tick: 2, inputs: { a_node: 1, b_node: 0 }, expected: { gt_node: 1, eq_node: 0, lt_node: 0 } },
        { tick: 3, inputs: { a_node: 1, b_node: 1 }, expected: { gt_node: 0, eq_node: 1, lt_node: 0 } },
      ],
      circuit: {
        nodes: [
          { id: 'a_node',  type: 'INPUT',  x: 100, y: 120, label: 'A',  config: {}, state: {} },
          { id: 'b_node',  type: 'INPUT',  x: 100, y: 240, label: 'B',  config: {}, state: {} },
          { id: 'gt_node', type: 'OUTPUT', x: 550, y: 120, label: 'GT', config: {}, state: {} },
          { id: 'eq_node', type: 'OUTPUT', x: 550, y: 220, label: 'EQ', config: {}, state: {} },
          { id: 'lt_node', type: 'OUTPUT', x: 550, y: 320, label: 'LT', config: {}, state: {} },
        ],
        connections: [],
      },
    },
  },
  {
    id: 'lab8-security-lock-fsm',
    labNumber: 8,
    title: 'Lab 8 - Security Lock Bridge Starter',
    description: 'Recommended student starting point for the ECE141 Digital Security Lock: a manual-clock, D-flip-flop bridge scaffold you build out yourself.',
    difficulty: 'advanced',
    estimatedMinutes: 90,
    example: {
      id: '23_lab8-fsm-lock-starter-basys3',
      name: 'ECE141 Security Lock Starter - Lab 8 Bridge',
      summary: 'Recommended student path for the Digital Security Lock final project: a simple Lab 8 bridge with board I/O, manual ENTER stepping, and an unsolved subsystem scaffold.',
      course: 'ECE141',
      lab: 'Lab 8',
      concept: 'Finite State Machines',
      tags: ['fsm', 'sequential', 'starter', 'lab8', 'basys3'],
      expectedBehavior: 'Use the scaffold to build the lock one subsystem at a time: track bit position, detect valid 3-bit groups, advance the valid-group milestones, and drive LOCK only when the full sequence is satisfied.',
      goals: [
        'Start here before the fuller final-project reference package - this is the recommended student bridge',
        'Keep ENTER (SW5) as the shared manual clock and RESET (SW4) as the shared clear for every DFlipFlop',
        'Use the scaffolded regions to separate bit/window count, valid-group detection, milestone count, and LOCK output',
        'Run the invalid and valid verification checks to prove what your design is doing at each stage',
        'Export only after the bridge starter behaves the way you expect',
      ],
      ioRows: [
        { id: 'iom-in0',   nodeId: 'sw_in0',   port: 'out', label: 'IN0 (SW6)',   direction: 'in',  pin: 'W14', required: true },
        { id: 'iom-in1',   nodeId: 'sw_in1',   port: 'out', label: 'IN1 (SW7)',   direction: 'in',  pin: 'W13', required: true },
        { id: 'iom-in2',   nodeId: 'sw_in2',   port: 'out', label: 'IN2 (SW8)',   direction: 'in',  pin: 'V2',  required: true },
        { id: 'iom-enter', nodeId: 'sw_enter', port: 'out', label: 'ENTER (SW5)', direction: 'in',  pin: 'V15', required: true },
        { id: 'iom-reset', nodeId: 'sw_reset', port: 'out', label: 'RESET (SW4)', direction: 'in',  pin: 'W15', required: true },
        { id: 'iom-lock',  nodeId: 'led_lock', port: 'in',  label: 'LOCK (LED1)', direction: 'out', pin: 'E19', required: true },
      ],
      vectors: LAB8_STARTER_VECTORS,
      circuit: {
        nodes: [
          { id: 'sw_in2',      type: 'INPUT',     x: 80,   y: 80,  label: 'IN2 (SW8)',        config: {}, state: {} },
          { id: 'sw_in1',      type: 'INPUT',     x: 80,   y: 150, label: 'IN1 (SW7)',        config: {}, state: {} },
          { id: 'sw_in0',      type: 'INPUT',     x: 80,   y: 220, label: 'IN0 (SW6)',        config: {}, state: {} },
          { id: 'sw_enter',    type: 'INPUT',     x: 80,   y: 320, label: 'ENTER (SW5)',      config: {}, state: {} },
          { id: 'sw_reset',    type: 'INPUT',     x: 80,   y: 400, label: 'RESET (SW4)',      config: {}, state: {} },

          { id: 'cap_p0_ff',   type: 'DFlipFlop', x: 320,  y: 120, label: 'CAP p0',           config: {}, state: {} },
          { id: 'cap_p1_ff',   type: 'DFlipFlop', x: 320,  y: 220, label: 'CAP p1',           config: {}, state: {} },
          { id: 'pos0_ff',     type: 'DFlipFlop', x: 320,  y: 360, label: 'POS0',             config: {}, state: {} },
          { id: 'pos1_ff',     type: 'DFlipFlop', x: 320,  y: 460, label: 'POS1',             config: {}, state: {} },

          { id: 'xor_valid',   type: 'XOR',       x: 520,  y: 170, label: '010 / 100 XOR',    config: {}, state: {} },
          { id: 'not_last',    type: 'NOT',       x: 520,  y: 290, label: 'Last bit = 0',     config: {}, state: {} },
          { id: 'valid_group', type: 'AND',       x: 520,  y: 410, label: 'GROUP VALID',      config: {}, state: {} },

          { id: 'm1_ff',       type: 'DFlipFlop', x: 760,  y: 110, label: 'M1',               config: {}, state: {} },
          { id: 'm2_ff',       type: 'DFlipFlop', x: 760,  y: 210, label: 'M2',               config: {}, state: {} },
          { id: 'm3_ff',       type: 'DFlipFlop', x: 760,  y: 310, label: 'M3',               config: {}, state: {} },
          { id: 'm4_ff',       type: 'DFlipFlop', x: 760,  y: 410, label: 'M4',               config: {}, state: {} },

          { id: 'lock_drive',  type: 'OR',        x: 960,  y: 260, label: 'OPEN / LOCK',      config: {}, state: {} },
          { id: 'led_lock',    type: 'OUTPUT',    x: 1140, y: 260, label: 'LOCK (LED1)',      config: {}, state: {} },
        ],
        connections: [
          { from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'cap_p0_ff', portName: 'CLK' } },
          { from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'cap_p1_ff', portName: 'CLK' } },
          { from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'pos0_ff', portName: 'CLK' } },
          { from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'pos1_ff', portName: 'CLK' } },
          { from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'm1_ff', portName: 'CLK' } },
          { from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'm2_ff', portName: 'CLK' } },
          { from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'm3_ff', portName: 'CLK' } },
          { from: { nodeId: 'sw_enter', portName: 'out' }, to: { nodeId: 'm4_ff', portName: 'CLK' } },

          { from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'cap_p0_ff', portName: 'RST' } },
          { from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'cap_p1_ff', portName: 'RST' } },
          { from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'pos0_ff', portName: 'RST' } },
          { from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'pos1_ff', portName: 'RST' } },
          { from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'm1_ff', portName: 'RST' } },
          { from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'm2_ff', portName: 'RST' } },
          { from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'm3_ff', portName: 'RST' } },
          { from: { nodeId: 'sw_reset', portName: 'out' }, to: { nodeId: 'm4_ff', portName: 'RST' } },

          { from: { nodeId: 'm4_ff', portName: 'Q' }, to: { nodeId: 'lock_drive', portName: 'a' } },
          { from: { nodeId: 'lock_drive', portName: 'out' }, to: { nodeId: 'led_lock', portName: 'in' } },
        ],
      },
    },
  },
];

export function getLabStarterById(id: string): LabStarter | undefined {
  return LAB_STARTERS.find((s) => s.id === id);
}
