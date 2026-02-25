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
      'Run Verify — all vectors should pass green',
      'Toggle switches on the Hardware board',
      'Export the Vivado bundle',
    ],
    ioRows: [
      { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0', direction: 'in',  pin: 'V17', required: true },
      { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1', direction: 'in',  pin: 'V16', required: true },
      { id: 'sw2', nodeId: 'sw2_node', port: 'out', label: 'SW2', direction: 'in',  pin: 'W16', required: true },
      { id: 'sw3', nodeId: 'sw3_node', port: 'out', label: 'SW3', direction: 'in',  pin: 'W17', required: true },
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
    ],
    probes: [
      { nodeId: 'ld0_node', portName: 'in', label: 'LD0', color: '#00ffff' },
      { nodeId: 'ld1_node', portName: 'in', label: 'LD1', color: '#ffff00' },
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
    id: 'logic-gates',
    category: 'showcase' as const,
    name: 'Logic Gates: AND / OR / XOR',
    summary: 'Two switches drive three LEDs showing AND, OR, and XOR in parallel.',
    course: '',
    lab: '',
    concept: 'Combinational Logic',
    tags: ['gates', 'combinational', 'starter'],
    expectedBehavior: 'LD0 = SW0 AND SW1 (both on). LD1 = SW0 OR SW1 (either on). LD2 = SW0 XOR SW1 (exactly one on).',
    goals: [
      'Observe each gate respond to the same two inputs',
      'Compare AND vs OR vs XOR outputs side-by-side',
      'Run Verify to see the full truth table pass',
      'Export to Vivado and check the gate-level RTL view',
    ],
    ioRows: [
      { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0', direction: 'in',  pin: 'V17', required: true },
      { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1', direction: 'in',  pin: 'V16', required: true },
      { id: 'ld0', nodeId: 'ld0_node', port: 'in',  label: 'LD0', direction: 'out', pin: 'U16', required: true },
      { id: 'ld1', nodeId: 'ld1_node', port: 'in',  label: 'LD1', direction: 'out', pin: 'E19', required: true },
      { id: 'ld2', nodeId: 'ld2_node', port: 'in',  label: 'LD2', direction: 'out', pin: 'U19', required: true },
    ],
    vectors: [
      // Full 2-input truth table
      { tick: 0, inputs: { sw0_node: 0, sw1_node: 0 }, expected: { ld0_node: 0, ld1_node: 0, ld2_node: 0 } },
      { tick: 1, inputs: { sw0_node: 1, sw1_node: 0 }, expected: { ld0_node: 0, ld1_node: 1, ld2_node: 1 } },
      { tick: 2, inputs: { sw0_node: 0, sw1_node: 1 }, expected: { ld0_node: 0, ld1_node: 1, ld2_node: 1 } },
      { tick: 3, inputs: { sw0_node: 1, sw1_node: 1 }, expected: { ld0_node: 1, ld1_node: 1, ld2_node: 0 } },
    ],
    probes: [
      { nodeId: 'ld0_node', portName: 'in', label: 'AND', color: '#00ffff' },
      { nodeId: 'ld1_node', portName: 'in', label: 'OR',  color: '#ffff00' },
      { nodeId: 'ld2_node', portName: 'in', label: 'XOR', color: '#ff00ff' },
    ],
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT', x: 90,  y: 120, label: 'SW0', config: {}, state: {} },
        { id: 'sw1_node', type: 'INPUT', x: 90,  y: 260, label: 'SW1', config: {}, state: {} },
        { id: 'and_node', type: 'AND',   x: 300, y: 80,  label: 'AND', config: {}, state: {} },
        { id: 'or_node',  type: 'OR',    x: 300, y: 190, label: 'OR',  config: {}, state: {} },
        { id: 'xor_node', type: 'XOR',   x: 300, y: 300, label: 'XOR', config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 500, y: 80,  label: 'LD0', config: {}, state: {} },
        { id: 'ld1_node', type: 'OUTPUT', x: 500, y: 190, label: 'LD1', config: {}, state: {} },
        { id: 'ld2_node', type: 'OUTPUT', x: 500, y: 300, label: 'LD2', config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'b' } },
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'or_node',  portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'or_node',  portName: 'b' } },
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'b' } },
        { from: { nodeId: 'and_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
        { from: { nodeId: 'or_node',  portName: 'out' }, to: { nodeId: 'ld1_node', portName: 'in' } },
        { from: { nodeId: 'xor_node', portName: 'out' }, to: { nodeId: 'ld2_node', portName: 'in' } },
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
      'On real hardware: press BTNC to reset the counter to 00',
      'Check pin mapping matches Basys3 before exporting',
    ],
    ioRows: [
      { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'CLK',       direction: 'in',  pin: 'W5',  required: true },
      { id: 'en',  nodeId: 'en_node',  port: 'out', label: 'SW0',       direction: 'in',  pin: 'V17', required: true },
      { id: 'rst', nodeId: 'rst_node', port: 'out', label: 'RST (BTNC)', direction: 'in',  pin: 'U18', required: true },
      { id: 'q0',  nodeId: 'q0_out',   port: 'in',  label: 'LD0',       direction: 'out', pin: 'U16', required: true },
      { id: 'q1',  nodeId: 'q1_out',   port: 'in',  label: 'LD1',       direction: 'out', pin: 'E19', required: true },
    ],
    // Synchronous 2-bit counter with active-high reset. With clocked_macro schedule [CLK=0→1→0]:
    // D_final = AND(D_normal, NOT(RST))  ← synchronous reset implemented via NOT + AND gates
    // Q0_next = Q0 XOR EN   (when RST=0)
    // Q1_next = Q1 XOR (Q0 AND EN)  (when RST=0)
    // Trace from Q0=0, Q1=0 after boot-reset warmup:
    //   tick0 RST=1,EN=0: Q0→0 Q1→0  (synchronous reset to 00)
    //   tick1 RST=0,EN=1: Q0→1 Q1→0  (01)
    //   tick2 RST=0,EN=1: Q0→0 Q1→1  (10)
    //   tick3 RST=0,EN=1: Q0→1 Q1→1  (11)
    //   tick4 RST=0,EN=1: Q0→0 Q1→0  (00 rollover)
    //   tick5 RST=0,EN=0: Q0→0 Q1→0  (held)
    //   tick6 RST=0,EN=0: Q0→0 Q1→0  (still held)
    vectors: [
      { tick: 0, inputs: { clk_node: 0, en_node: 0, rst_node: 1 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 1, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 1, q1_out: 0 } },
      { tick: 2, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 0, q1_out: 1 } },
      { tick: 3, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 1, q1_out: 1 } },
      { tick: 4, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 5, inputs: { clk_node: 0, en_node: 0, rst_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 6, inputs: { clk_node: 0, en_node: 0, rst_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
    ],
    probes: [
      { nodeId: 'q0_out',   portName: 'in',  label: 'LD0', color: '#00ffff' },
      { nodeId: 'q1_out',   portName: 'in',  label: 'LD1', color: '#ffff00' },
      { nodeId: 'clk_node', portName: 'out', label: 'CLK', color: '#ffffff' },
      { nodeId: 'rst_node', portName: 'out', label: 'RST', color: '#ff4444' },
    ],
    circuit: {
      nodes: [
        // CLK is type INPUT so the macro schedule can drive it (Clock type ignores setNodeState)
        { id: 'clk_node', type: 'INPUT',     x: 90,  y: 100, label: 'CLK',      config: {}, state: {} },
        { id: 'en_node',  type: 'INPUT',     x: 90,  y: 220, label: 'EN',       config: {}, state: {} },
        { id: 'rst_node', type: 'INPUT',     x: 90,  y: 340, label: 'RST',      config: {}, state: {} },
        // XOR gates for next-state logic (and_en must precede xor1 so Kahn topo-sort appends
        // and_en before xor1; xor1 then reads and_en.out from the current-tick signalCache
        // rather than the previous-tick fallback, ensuring correct carry propagation).
        { id: 'xor0',     type: 'XOR',       x: 270, y: 100, label: 'XOR0',     config: {}, state: {} },
        // AND gate: Q0 AND EN → enable Q1 toggle (must come before xor1 in nodes array)
        { id: 'and_en',   type: 'AND',       x: 270, y: 200, label: 'AND',      config: {}, state: {} },
        { id: 'xor1',     type: 'XOR',       x: 270, y: 290, label: 'XOR1',     config: {}, state: {} },
        // NOT gate inverts RST for AND-based synchronous reset gating
        { id: 'rst_not',  type: 'NOT',       x: 270, y: 380, label: 'NOT',      config: {}, state: {} },
        // Reset AND gates: D_final = AND(D_normal, NOT(RST))
        { id: 'd0_rst',   type: 'AND',       x: 420, y: 100, label: 'RST0',     config: {}, state: {} },
        { id: 'd1_rst',   type: 'AND',       x: 420, y: 290, label: 'RST1',     config: {}, state: {} },
        // D flip-flops (transparent latch, CLK=1→transparent, CLK=0→hold)
        { id: 'q0_ff',    type: 'DFlipFlop', x: 560, y: 100, label: 'Q0',       config: {}, state: {} },
        { id: 'q1_ff',    type: 'DFlipFlop', x: 560, y: 290, label: 'Q1',       config: {}, state: {} },
        // Output sinks
        { id: 'q0_out',   type: 'OUTPUT',    x: 720, y: 100, label: 'LD0',      config: {}, state: {} },
        { id: 'q1_out',   type: 'OUTPUT',    x: 720, y: 290, label: 'LD1',      config: {}, state: {} },
      ],
      connections: [
        // Q0_next = Q0 XOR EN
        { from: { nodeId: 'q0_ff',   portName: 'Q'   }, to: { nodeId: 'xor0',   portName: 'a'   } },
        { from: { nodeId: 'en_node', portName: 'out'  }, to: { nodeId: 'xor0',   portName: 'b'   } },

        // AND: Q0 AND EN (enable for Q1 toggle)
        { from: { nodeId: 'q0_ff',   portName: 'Q'   }, to: { nodeId: 'and_en', portName: 'a'   } },
        { from: { nodeId: 'en_node', portName: 'out'  }, to: { nodeId: 'and_en', portName: 'b'   } },

        // Q1_next = Q1 XOR (Q0 AND EN)
        { from: { nodeId: 'q1_ff',   portName: 'Q'   }, to: { nodeId: 'xor1',   portName: 'a'   } },
        { from: { nodeId: 'and_en',  portName: 'out'  }, to: { nodeId: 'xor1',   portName: 'b'   } },

        // RST inversion
        { from: { nodeId: 'rst_node', portName: 'out' }, to: { nodeId: 'rst_not', portName: 'in'  } },

        // Synchronous reset gating: D_final = AND(D_normal, NOT(RST))
        { from: { nodeId: 'xor0',    portName: 'out'  }, to: { nodeId: 'd0_rst', portName: 'a'   } },
        { from: { nodeId: 'rst_not', portName: 'out'  }, to: { nodeId: 'd0_rst', portName: 'b'   } },
        { from: { nodeId: 'd0_rst',  portName: 'out'  }, to: { nodeId: 'q0_ff',  portName: 'D'   } },

        { from: { nodeId: 'xor1',    portName: 'out'  }, to: { nodeId: 'd1_rst', portName: 'a'   } },
        { from: { nodeId: 'rst_not', portName: 'out'  }, to: { nodeId: 'd1_rst', portName: 'b'   } },
        { from: { nodeId: 'd1_rst',  portName: 'out'  }, to: { nodeId: 'q1_ff',  portName: 'D'   } },

        // CLK to both flip-flops
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'q0_ff',  portName: 'CLK' } },
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'q1_ff',  portName: 'CLK' } },

        // Outputs
        { from: { nodeId: 'q0_ff',   portName: 'Q'   }, to: { nodeId: 'q0_out', portName: 'in'  } },
        { from: { nodeId: 'q1_ff',   portName: 'Q'   }, to: { nodeId: 'q1_out', portName: 'in'  } },
      ],
    },
  },
];

export function getIdeExampleById(id: string): IdeExampleDefinition | undefined {
  return IDE_EXAMPLES.find((example) => example.id === id);
}
