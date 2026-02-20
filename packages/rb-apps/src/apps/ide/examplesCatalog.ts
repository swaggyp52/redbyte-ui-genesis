import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';

export interface IdeExampleIoRow {
  id: string;
  nodeId: string;
  port: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}

export interface IdeExampleDefinition {
  id: string;
  name: string;
  summary: string;
  course: string;
  lab: string;
  concept: string;
  tags: string[];
  expectedBehavior: string;
  ioRows: IdeExampleIoRow[];
  vectors: TestVector[];
  circuit: Circuit;
}

export const IDE_DEFAULT_EXAMPLE_ID = 'counter-basics';

export const IDE_EXAMPLES: IdeExampleDefinition[] = [
  {
    id: 'counter-basics',
    name: '3-bit Counter Baseline',
    summary: 'Clocked baseline with enable and reset wiring for Basys3 bring-up.',
    course: 'ECE141',
    lab: 'Lab 8',
    concept: 'Sequential Counter',
    tags: ['sequential', 'counter', 'basys3'],
    expectedBehavior: 'Toggles q0/q1/q2 style outputs with deterministic tick progression.',
    ioRows: [
      {
        id: 'clk',
        nodeId: 'clk_node',
        port: 'out',
        label: 'clk',
        direction: 'in',
        pin: 'CLK100MHZ',
        required: true,
      },
      {
        id: 'rst',
        nodeId: 'rst_node',
        port: 'out',
        label: 'rst',
        direction: 'in',
        pin: 'SW0',
        required: true,
      },
      {
        id: 'count_en',
        nodeId: 'count_en_node',
        port: 'out',
        label: 'count_en',
        direction: 'in',
        pin: 'SW1',
        required: true,
      },
      {
        id: 'q0',
        nodeId: 'q0_node',
        port: 'in',
        label: 'q0',
        direction: 'out',
        pin: 'LD0',
        required: true,
      },
      {
        id: 'q1',
        nodeId: 'q1_node',
        port: 'in',
        label: 'q1',
        direction: 'out',
        pin: 'LD1',
        required: true,
      },
      {
        id: 'q2',
        nodeId: 'q2_node',
        port: 'in',
        label: 'q2',
        direction: 'out',
        pin: 'LD2',
        required: true,
      },
    ],
    vectors: [],
    circuit: {
      nodes: [
        { id: 'clk_node', type: 'INPUT', x: 96, y: 80, label: 'clk', config: {}, state: {} },
        { id: 'rst_node', type: 'INPUT', x: 96, y: 148, label: 'rst', config: {}, state: {} },
        { id: 'count_en_node', type: 'INPUT', x: 96, y: 216, label: 'count_en', config: {}, state: {} },
        { id: 'q0_node', type: 'OUTPUT', x: 520, y: 132, label: 'q0', config: {}, state: {} },
        { id: 'q1_node', type: 'OUTPUT', x: 520, y: 200, label: 'q1', config: {}, state: {} },
        { id: 'q2_node', type: 'OUTPUT', x: 520, y: 268, label: 'q2', config: {}, state: {} },
      ],
      connections: [],
    },
  },
  {
    id: 'and-gate-basics',
    name: 'AND Gate Starter',
    summary: 'Two-switch combinational starter that drives one LED output.',
    course: 'ECE141',
    lab: 'Lab 1',
    concept: 'Combinational Basics',
    tags: ['combinational', 'logic-basics', 'starter'],
    expectedBehavior: 'LED turns on only when both inputs are high.',
    ioRows: [
      {
        id: 'sw0',
        nodeId: 'sw0_node',
        port: 'out',
        label: 'sw0',
        direction: 'in',
        pin: 'SW0',
        required: true,
      },
      {
        id: 'sw1',
        nodeId: 'sw1_node',
        port: 'out',
        label: 'sw1',
        direction: 'in',
        pin: 'SW1',
        required: true,
      },
      {
        id: 'ld0',
        nodeId: 'ld0_node',
        port: 'in',
        label: 'ld0',
        direction: 'out',
        pin: 'LD0',
        required: true,
      },
    ],
    vectors: [
      { id: 'vec-01', tick: 0, inputs: { sw0: 0, sw1: 0 }, expected: { ld0: 0 } },
      { id: 'vec-02', tick: 1, inputs: { sw0: 1, sw1: 0 }, expected: { ld0: 0 } },
      { id: 'vec-03', tick: 2, inputs: { sw0: 0, sw1: 1 }, expected: { ld0: 0 } },
      { id: 'vec-04', tick: 3, inputs: { sw0: 1, sw1: 1 }, expected: { ld0: 1 } },
    ],
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', x: 90, y: 150, label: 'sw0', config: {}, state: {} },
        { id: 'sw1_node', type: 'INPUT', x: 90, y: 240, label: 'sw1', config: {}, state: {} },
        { id: 'and_node', type: 'AND', x: 290, y: 195, label: 'and0', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 520, y: 195, label: 'ld0', config: {}, state: {} },
      ],
      connections: [
        {
          from: { nodeId: 'sw0_node', portName: 'out' },
          to: { nodeId: 'and_node', portName: 'a' },
        },
        {
          from: { nodeId: 'sw1_node', portName: 'out' },
          to: { nodeId: 'and_node', portName: 'b' },
        },
        {
          from: { nodeId: 'and_node', portName: 'out' },
          to: { nodeId: 'ld0_node', portName: 'in' },
        },
      ],
    },
  },
  {
    id: 'xor-parity',
    name: 'XOR Parity Probe',
    summary: 'Simple XOR parity testbed with deterministic vectors.',
    course: 'ECE141',
    lab: 'Lab 2',
    concept: 'Parity Logic',
    tags: ['combinational', 'xor', 'parity'],
    expectedBehavior: 'Output is high when an odd number of inputs are high.',
    ioRows: [
      {
        id: 'sw0',
        nodeId: 'parity_sw0',
        port: 'out',
        label: 'sw0',
        direction: 'in',
        pin: 'SW0',
        required: true,
      },
      {
        id: 'sw1',
        nodeId: 'parity_sw1',
        port: 'out',
        label: 'sw1',
        direction: 'in',
        pin: 'SW1',
        required: true,
      },
      {
        id: 'ld0',
        nodeId: 'parity_ld0',
        port: 'in',
        label: 'ld0',
        direction: 'out',
        pin: 'LD0',
        required: true,
      },
    ],
    vectors: [
      { id: 'vec-01', tick: 0, inputs: { sw0: 0, sw1: 0 }, expected: { ld0: 0 } },
      { id: 'vec-02', tick: 1, inputs: { sw0: 1, sw1: 0 }, expected: { ld0: 1 } },
      { id: 'vec-03', tick: 2, inputs: { sw0: 0, sw1: 1 }, expected: { ld0: 1 } },
      { id: 'vec-04', tick: 3, inputs: { sw0: 1, sw1: 1 }, expected: { ld0: 0 } },
    ],
    circuit: {
      nodes: [
        { id: 'parity_sw0', type: 'INPUT', x: 90, y: 150, label: 'sw0', config: {}, state: {} },
        { id: 'parity_sw1', type: 'INPUT', x: 90, y: 240, label: 'sw1', config: {}, state: {} },
        { id: 'parity_xor', type: 'XOR', x: 290, y: 195, label: 'xor0', config: {}, state: {} },
        { id: 'parity_ld0', type: 'OUTPUT', x: 520, y: 195, label: 'ld0', config: {}, state: {} },
      ],
      connections: [
        {
          from: { nodeId: 'parity_sw0', portName: 'out' },
          to: { nodeId: 'parity_xor', portName: 'a' },
        },
        {
          from: { nodeId: 'parity_sw1', portName: 'out' },
          to: { nodeId: 'parity_xor', portName: 'b' },
        },
        {
          from: { nodeId: 'parity_xor', portName: 'out' },
          to: { nodeId: 'parity_ld0', portName: 'in' },
        },
      ],
    },
  },
  {
    id: 'dff-toggle',
    name: 'Clocked DFF Toggle',
    summary: 'Sequential starter with clock, data input, and one observed output.',
    course: 'ECE141',
    lab: 'Lab 6',
    concept: 'DFF Timing',
    tags: ['sequential', 'clocked', 'dff'],
    expectedBehavior: 'Output follows data input on clock edge ticks.',
    ioRows: [
      {
        id: 'clk',
        nodeId: 'dff_clk',
        port: 'out',
        label: 'clk',
        direction: 'in',
        pin: 'CLK100MHZ',
        required: true,
      },
      {
        id: 'd',
        nodeId: 'dff_data',
        port: 'out',
        label: 'd',
        direction: 'in',
        pin: 'SW0',
        required: true,
      },
      {
        id: 'q',
        nodeId: 'dff_q',
        port: 'in',
        label: 'q',
        direction: 'out',
        pin: 'LD0',
        required: true,
      },
    ],
    vectors: [
      { id: 'vec-01', tick: 0, inputs: { clk: 0, d: 0 }, expected: { q: 0 } },
      { id: 'vec-02', tick: 1, inputs: { clk: 1, d: 1 }, expected: { q: 1 } },
      { id: 'vec-03', tick: 2, inputs: { clk: 0, d: 0 }, expected: { q: 1 } },
      { id: 'vec-04', tick: 3, inputs: { clk: 1, d: 0 }, expected: { q: 0 } },
    ],
    circuit: {
      nodes: [
        { id: 'dff_clk', type: 'Clock', x: 90, y: 120, label: 'clk', config: {}, state: {} },
        { id: 'dff_data', type: 'INPUT', x: 90, y: 240, label: 'd', config: {}, state: {} },
        { id: 'dff_core', type: 'DFlipFlop', x: 300, y: 190, label: 'dff0', config: {}, state: {} },
        { id: 'dff_q', type: 'OUTPUT', x: 530, y: 190, label: 'q', config: {}, state: {} },
      ],
      connections: [
        {
          from: { nodeId: 'dff_clk', portName: 'out' },
          to: { nodeId: 'dff_core', portName: 'CLK' },
        },
        {
          from: { nodeId: 'dff_data', portName: 'out' },
          to: { nodeId: 'dff_core', portName: 'D' },
        },
        {
          from: { nodeId: 'dff_core', portName: 'Q' },
          to: { nodeId: 'dff_q', portName: 'in' },
        },
      ],
    },
  },
  {
    id: 'majority-voter',
    name: 'Three-Input Majority',
    summary: 'Logic composition starter for 3-input majority style behavior.',
    course: 'ECE141',
    lab: 'Lab 4',
    concept: 'Logic Composition',
    tags: ['combinational', 'intermediate', 'logic-composition'],
    expectedBehavior: 'Output should assert when at least two inputs are high.',
    ioRows: [
      {
        id: 'sw0',
        nodeId: 'maj_sw0',
        port: 'out',
        label: 'sw0',
        direction: 'in',
        pin: 'SW0',
        required: true,
      },
      {
        id: 'sw1',
        nodeId: 'maj_sw1',
        port: 'out',
        label: 'sw1',
        direction: 'in',
        pin: 'SW1',
        required: true,
      },
      {
        id: 'sw2',
        nodeId: 'maj_sw2',
        port: 'out',
        label: 'sw2',
        direction: 'in',
        pin: 'SW2',
        required: true,
      },
      {
        id: 'ld0',
        nodeId: 'maj_ld0',
        port: 'in',
        label: 'ld0',
        direction: 'out',
        pin: 'LD0',
        required: true,
      },
    ],
    vectors: [
      { id: 'vec-01', tick: 0, inputs: { sw0: 0, sw1: 0, sw2: 0 }, expected: { ld0: 0 } },
      { id: 'vec-02', tick: 1, inputs: { sw0: 1, sw1: 1, sw2: 0 }, expected: { ld0: 1 } },
      { id: 'vec-03', tick: 2, inputs: { sw0: 1, sw1: 0, sw2: 1 }, expected: { ld0: 1 } },
      { id: 'vec-04', tick: 3, inputs: { sw0: 0, sw1: 1, sw2: 0 }, expected: { ld0: 0 } },
    ],
    circuit: {
      nodes: [
        { id: 'maj_sw0', type: 'INPUT', x: 90, y: 110, label: 'sw0', config: {}, state: {} },
        { id: 'maj_sw1', type: 'INPUT', x: 90, y: 190, label: 'sw1', config: {}, state: {} },
        { id: 'maj_sw2', type: 'INPUT', x: 90, y: 270, label: 'sw2', config: {}, state: {} },
        { id: 'maj_and0', type: 'AND', x: 260, y: 140, label: 'and0', config: {}, state: {} },
        { id: 'maj_and1', type: 'AND', x: 260, y: 240, label: 'and1', config: {}, state: {} },
        { id: 'maj_or0', type: 'OR', x: 420, y: 190, label: 'or0', config: {}, state: {} },
        { id: 'maj_ld0', type: 'OUTPUT', x: 560, y: 190, label: 'ld0', config: {}, state: {} },
      ],
      connections: [
        {
          from: { nodeId: 'maj_sw0', portName: 'out' },
          to: { nodeId: 'maj_and0', portName: 'a' },
        },
        {
          from: { nodeId: 'maj_sw1', portName: 'out' },
          to: { nodeId: 'maj_and0', portName: 'b' },
        },
        {
          from: { nodeId: 'maj_sw1', portName: 'out' },
          to: { nodeId: 'maj_and1', portName: 'a' },
        },
        {
          from: { nodeId: 'maj_sw2', portName: 'out' },
          to: { nodeId: 'maj_and1', portName: 'b' },
        },
        {
          from: { nodeId: 'maj_and0', portName: 'out' },
          to: { nodeId: 'maj_or0', portName: 'a' },
        },
        {
          from: { nodeId: 'maj_and1', portName: 'out' },
          to: { nodeId: 'maj_or0', portName: 'b' },
        },
        {
          from: { nodeId: 'maj_or0', portName: 'out' },
          to: { nodeId: 'maj_ld0', portName: 'in' },
        },
      ],
    },
  },
  {
    id: 'button-or-indicator',
    name: 'Button OR Indicator',
    summary: 'Button-focused starter aligned with quick board sanity checks.',
    course: 'ECE141',
    lab: 'Lab 3',
    concept: 'Board IO',
    tags: ['buttons', 'io-mapping', 'quick-check'],
    expectedBehavior: 'LED lights when either button is pressed.',
    ioRows: [
      {
        id: 'btnu',
        nodeId: 'btn_or_u',
        port: 'out',
        label: 'btnu',
        direction: 'in',
        pin: 'BTNU',
        required: true,
      },
      {
        id: 'btnl',
        nodeId: 'btn_or_l',
        port: 'out',
        label: 'btnl',
        direction: 'in',
        pin: 'BTNL',
        required: true,
      },
      {
        id: 'ld0',
        nodeId: 'btn_or_led',
        port: 'in',
        label: 'ld0',
        direction: 'out',
        pin: 'LD0',
        required: true,
      },
    ],
    vectors: [
      { id: 'vec-01', tick: 0, inputs: { btnu: 0, btnl: 0 }, expected: { ld0: 0 } },
      { id: 'vec-02', tick: 1, inputs: { btnu: 1, btnl: 0 }, expected: { ld0: 1 } },
      { id: 'vec-03', tick: 2, inputs: { btnu: 0, btnl: 1 }, expected: { ld0: 1 } },
      { id: 'vec-04', tick: 3, inputs: { btnu: 1, btnl: 1 }, expected: { ld0: 1 } },
    ],
    circuit: {
      nodes: [
        { id: 'btn_or_u', type: 'INPUT', x: 90, y: 150, label: 'btnu', config: {}, state: {} },
        { id: 'btn_or_l', type: 'INPUT', x: 90, y: 240, label: 'btnl', config: {}, state: {} },
        { id: 'btn_or_gate', type: 'OR', x: 290, y: 195, label: 'or0', config: {}, state: {} },
        { id: 'btn_or_led', type: 'OUTPUT', x: 520, y: 195, label: 'ld0', config: {}, state: {} },
      ],
      connections: [
        {
          from: { nodeId: 'btn_or_u', portName: 'out' },
          to: { nodeId: 'btn_or_gate', portName: 'a' },
        },
        {
          from: { nodeId: 'btn_or_l', portName: 'out' },
          to: { nodeId: 'btn_or_gate', portName: 'b' },
        },
        {
          from: { nodeId: 'btn_or_gate', portName: 'out' },
          to: { nodeId: 'btn_or_led', portName: 'in' },
        },
      ],
    },
  },
];

export function getIdeExampleById(id: string): IdeExampleDefinition | undefined {
  return IDE_EXAMPLES.find((example) => example.id === id);
}
