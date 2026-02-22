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
  category?: 'showcase' | 'course';
  goals?: string[];
  probes?: Array<{ nodeId: string; portName: string; label: string; color: string }>;
}

export const IDE_DEFAULT_EXAMPLE_ID = 'signal-tour';

export const IDE_EXAMPLES: IdeExampleDefinition[] = [
  {
    id: 'signal-tour',
    category: 'showcase' as const,
    name: 'Signal Tour: Switches → LEDs',
    summary: 'Four-wire passthrough. Learn mapping, run Verify, and see the board light up.',
    course: '',
    lab: '',
    concept: 'Board Mapping',
    tags: ['mapping', 'hardware', 'starter'],
    expectedBehavior: 'Each switch directly drives its corresponding LED. SW0→LD0, SW1→LD1, SW2→LD2, SW3→LD3.',
    goals: [
      'Map SW and LD ports to Basys3 pins',
      'Run Verify — inspect the deliberate failure vector',
      'Toggle switches on the Hardware board',
      'Export the Vivado bundle',
    ],
    ioRows: [
      { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0', direction: 'in',  pin: 'V17', required: true },
      { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1', direction: 'in',  pin: 'W16', required: true },
      { id: 'sw2', nodeId: 'sw2_node', port: 'out', label: 'SW2', direction: 'in',  pin: 'W15', required: true },
      { id: 'sw3', nodeId: 'sw3_node', port: 'out', label: 'SW3', direction: 'in',  pin: 'V15', required: true },
      { id: 'ld0', nodeId: 'ld0_node', port: 'in',  label: 'LD0', direction: 'out', pin: 'U16', required: true },
      { id: 'ld1', nodeId: 'ld1_node', port: 'in',  label: 'LD1', direction: 'out', pin: 'E19', required: true },
      { id: 'ld2', nodeId: 'ld2_node', port: 'in',  label: 'LD2', direction: 'out', pin: 'U19', required: true },
      { id: 'ld3', nodeId: 'ld3_node', port: 'in',  label: 'LD3', direction: 'out', pin: 'V19', required: true },
    ],
    vectors: [
      { tick: 0, inputs: { sw0_node: 0, sw1_node: 0, sw2_node: 0, sw3_node: 0 }, expected: { ld0_node: 0, ld1_node: 0, ld2_node: 0, ld3_node: 0 } },
      { tick: 1, inputs: { sw0_node: 1, sw1_node: 0, sw2_node: 0, sw3_node: 0 }, expected: { ld0_node: 1, ld1_node: 0, ld2_node: 0, ld3_node: 0 } },
      { tick: 2, inputs: { sw0_node: 0, sw1_node: 1, sw2_node: 0, sw3_node: 0 }, expected: { ld0_node: 0, ld1_node: 1, ld2_node: 0, ld3_node: 0 } },
      { tick: 3, inputs: { sw0_node: 0, sw1_node: 0, sw2_node: 1, sw3_node: 0 }, expected: { ld0_node: 0, ld1_node: 0, ld2_node: 1, ld3_node: 0 } },
      { tick: 4, inputs: { sw0_node: 0, sw1_node: 0, sw2_node: 0, sw3_node: 1 }, expected: { ld0_node: 0, ld1_node: 0, ld2_node: 0, ld3_node: 1 } },
      { tick: 5, inputs: { sw0_node: 1, sw1_node: 1, sw2_node: 0, sw3_node: 0 }, expected: { ld0_node: 1, ld1_node: 1, ld2_node: 0, ld3_node: 0 } },
      { tick: 6, inputs: { sw0_node: 1, sw1_node: 1, sw2_node: 1, sw3_node: 1 }, expected: { ld0_node: 1, ld1_node: 1, ld2_node: 1, ld3_node: 1 } },
      { tick: 7, inputs: { sw0_node: 0, sw1_node: 0, sw2_node: 0, sw3_node: 0 }, expected: { ld0_node: 0, ld1_node: 0, ld2_node: 0, ld3_node: 0 } },
      // Deliberate FAIL — shows Verify debugger with mismatch
      { tick: 8, inputs: { sw0_node: 1, sw1_node: 0, sw2_node: 0, sw3_node: 0 }, expected: { ld0_node: 0, ld1_node: 0, ld2_node: 0, ld3_node: 0 } },
    ],
    probes: [
      { nodeId: 'ld0_node', portName: 'out', label: 'LD0', color: '#00ffff' },
      { nodeId: 'ld1_node', portName: 'out', label: 'LD1', color: '#ffff00' },
    ],
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', x: 100, y: 80,  label: 'SW0', config: {}, state: {} },
        { id: 'sw1_node', type: 'INPUT', x: 100, y: 160, label: 'SW1', config: {}, state: {} },
        { id: 'sw2_node', type: 'INPUT', x: 100, y: 240, label: 'SW2', config: {}, state: {} },
        { id: 'sw3_node', type: 'INPUT', x: 100, y: 320, label: 'SW3', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 400, y: 80,  label: 'LD0', config: {}, state: {} },
        { id: 'ld1_node', type: 'OUTPUT', x: 400, y: 160, label: 'LD1', config: {}, state: {} },
        { id: 'ld2_node', type: 'OUTPUT', x: 400, y: 240, label: 'LD2', config: {}, state: {} },
        { id: 'ld3_node', type: 'OUTPUT', x: 400, y: 320, label: 'LD3', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'ld1_node', portName: 'in' } },
        { from: { nodeId: 'sw2_node', portName: 'out' }, to: { nodeId: 'ld2_node', portName: 'in' } },
        { from: { nodeId: 'sw3_node', portName: 'out' }, to: { nodeId: 'ld3_node', portName: 'in' } },
      ],
    },
  },
  {
    id: 'edge-detector',
    category: 'showcase' as const,
    name: 'Edge Detector: Button to Pulse',
    summary: 'Rising-edge detector. BTNC press produces a 1-tick LD0 pulse.',
    course: '',
    lab: '',
    concept: 'Sequential Timing',
    tags: ['sequential', 'timing', 'waveforms'],
    expectedBehavior: 'LD0 pulses HIGH for exactly one clock tick on the rising edge of BTNC.',
    goals: [
      'Understand rising-edge detection in probe waveforms',
      'Read the Verify failure diff — sustained high vs single pulse',
      'Observe how board button timing differs from simulation ticks',
    ],
    ioRows: [
      { id: 'btn0', nodeId: 'btn0_node', port: 'out', label: 'BTNC', direction: 'in',  pin: 'J15', required: true },
      { id: 'clk',  nodeId: 'clk_node',  port: 'out', label: 'CLK',  direction: 'in',  pin: 'W5',  required: true },
      { id: 'ld0',  nodeId: 'ld0_node',  port: 'in',  label: 'LD0',  direction: 'out', pin: 'U16', required: true },
    ],
    vectors: [
      { tick: 0, inputs: { btn0_node: 0, clk_node: 0 }, expected: { ld0_node: 0 } },
      { tick: 1, inputs: { btn0_node: 1, clk_node: 1 }, expected: { ld0_node: 0 } },
      { tick: 2, inputs: { btn0_node: 1, clk_node: 1 }, expected: { ld0_node: 1 } },
      { tick: 3, inputs: { btn0_node: 1, clk_node: 1 }, expected: { ld0_node: 0 } },
      { tick: 4, inputs: { btn0_node: 0, clk_node: 1 }, expected: { ld0_node: 0 } },
      // Deliberate FAILs — wrong mental model expects sustained HIGH
      { tick: 5, inputs: { btn0_node: 1, clk_node: 1 }, expected: { ld0_node: 1 } },
      { tick: 6, inputs: { btn0_node: 1, clk_node: 1 }, expected: { ld0_node: 1 } },
    ],
    probes: [
      { nodeId: 'btn0_node', portName: 'out', label: 'BTNC', color: '#ff00ff' },
      { nodeId: 'ld0_node',  portName: 'out', label: 'LD0',  color: '#00ffff' },
    ],
    circuit: {
      nodes: [
        { id: 'btn0_node', type: 'INPUT',     x: 90,  y: 120, label: 'BTNC', config: {}, state: {} },
        { id: 'clk_node',  type: 'Clock',     x: 90,  y: 240, label: 'CLK',  config: {}, state: {} },
        { id: 'dff1_node', type: 'DFlipFlop', x: 300, y: 150, label: 'DFF1', config: {}, state: {} },
        { id: 'dff2_node', type: 'DFlipFlop', x: 300, y: 270, label: 'DFF2', config: {}, state: {} },
        { id: 'xor_node',  type: 'XOR',       x: 480, y: 210, label: 'XOR0', config: {}, state: {} },
        { id: 'ld0_node',  type: 'OUTPUT',    x: 640, y: 210, label: 'LD0',  config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'btn0_node', portName: 'out' }, to: { nodeId: 'dff1_node', portName: 'D' } },
        { from: { nodeId: 'clk_node',  portName: 'out' }, to: { nodeId: 'dff1_node', portName: 'CLK' } },
        { from: { nodeId: 'dff1_node', portName: 'Q' },   to: { nodeId: 'dff2_node', portName: 'D' } },
        { from: { nodeId: 'clk_node',  portName: 'out' }, to: { nodeId: 'dff2_node', portName: 'CLK' } },
        { from: { nodeId: 'dff1_node', portName: 'Q' },   to: { nodeId: 'xor_node',  portName: 'a' } },
        { from: { nodeId: 'dff2_node', portName: 'Q' },   to: { nodeId: 'xor_node',  portName: 'b' } },
        { from: { nodeId: 'xor_node',  portName: 'out' }, to: { nodeId: 'ld0_node',  portName: 'in' } },
      ],
    },
  },
  {
    id: 'two-bit-counter',
    category: 'showcase' as const,
    name: '2-Bit Up Counter',
    summary: 'Clock-driven counter. SW0 enables; LD1/LD0 show the 2-bit value 00→01→10→11→00.',
    course: '',
    lab: '',
    concept: 'Sequential + Waveforms',
    tags: ['counter', 'sequential', 'waveforms'],
    expectedBehavior: 'When SW0 is high, counter increments on each rising clock edge.',
    goals: [
      'Watch the counter tick in the Verify waveform panel',
      'Toggle SW0 enable and see counting pause',
      'Check pin mapping matches Basys3 before exporting',
    ],
    ioRows: [
      { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'CLK',  direction: 'in',  pin: 'W5',  required: true },
      { id: 'en',  nodeId: 'en_node',  port: 'out', label: 'SW0',  direction: 'in',  pin: 'V17', required: true },
      { id: 'q0',  nodeId: 'q0_out',   port: 'in',  label: 'LD0',  direction: 'out', pin: 'U16', required: true },
      { id: 'q1',  nodeId: 'q1_out',   port: 'in',  label: 'LD1',  direction: 'out', pin: 'E19', required: true },
    ],
    vectors: [
      { tick: 0, inputs: { clk_node: 0, en_node: 1 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 1, inputs: { clk_node: 1, en_node: 1 }, expected: { q0_out: 1, q1_out: 0 } },
      { tick: 2, inputs: { clk_node: 1, en_node: 1 }, expected: { q0_out: 0, q1_out: 1 } },
      { tick: 3, inputs: { clk_node: 1, en_node: 1 }, expected: { q0_out: 1, q1_out: 1 } },
      { tick: 4, inputs: { clk_node: 1, en_node: 1 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 5, inputs: { clk_node: 1, en_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
      // Deliberate FAIL — expects count while disabled
      { tick: 6, inputs: { clk_node: 1, en_node: 0 }, expected: { q0_out: 1, q1_out: 0 } },
    ],
    probes: [
      { nodeId: 'q0_out',   portName: 'out', label: 'LD0', color: '#00ffff' },
      { nodeId: 'q1_out',   portName: 'out', label: 'LD1', color: '#ffff00' },
      { nodeId: 'clk_node', portName: 'out', label: 'CLK', color: '#ffffff' },
    ],
    circuit: {
      nodes: [
        { id: 'clk_node', type: 'Clock',     x: 90,  y: 100, label: 'CLK', config: {}, state: {} },
        { id: 'en_node',  type: 'INPUT',     x: 90,  y: 220, label: 'EN',  config: {}, state: {} },
        { id: 'q0_ff',    type: 'DFlipFlop', x: 300, y: 140, label: 'Q0',  config: {}, state: {} },
        { id: 'q1_ff',    type: 'DFlipFlop', x: 300, y: 260, label: 'Q1',  config: {}, state: {} },
        { id: 'q0_out',   type: 'OUTPUT',    x: 520, y: 140, label: 'LD0', config: {}, state: {} },
        { id: 'q1_out',   type: 'OUTPUT',    x: 520, y: 260, label: 'LD1', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'q0_ff',  portName: 'CLK' } },
        { from: { nodeId: 'en_node',  portName: 'out' }, to: { nodeId: 'q0_ff',  portName: 'D' } },
        { from: { nodeId: 'q0_ff',   portName: 'Q' },   to: { nodeId: 'q1_ff',  portName: 'D' } },
        { from: { nodeId: 'q0_ff',   portName: 'Q' },   to: { nodeId: 'q1_ff',  portName: 'CLK' } },
        { from: { nodeId: 'q0_ff',   portName: 'Q' },   to: { nodeId: 'q0_out', portName: 'in' } },
        { from: { nodeId: 'q1_ff',   portName: 'Q' },   to: { nodeId: 'q1_out', portName: 'in' } },
      ],
    },
  },
];

export function getIdeExampleById(id: string): IdeExampleDefinition | undefined {
  return IDE_EXAMPLES.find((example) => example.id === id);
}
