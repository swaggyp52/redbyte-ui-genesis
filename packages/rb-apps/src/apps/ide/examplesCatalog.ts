import type { Circuit } from '@redbyte/rb-logic-core';
import type { HardwareBoardResourceType, HardwareTimingRole, TestVector } from '@redbyte/rb-utils';
import { LAB_STARTERS } from './labStarters';

/** Map Pins / hardwareMappingV2 entry classification (mirrors V2 entry kinds). */
export type ProjectIoMappingKind = 'scalar' | 'bit' | 'slice' | 'bus' | 'group';

export interface IdeExampleIoRow {
  id: string;
  nodeId: string;
  port: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
  /** Structured mapping kind — defaults to scalar when absent. */
  mappingKind?: ProjectIoMappingKind;
  timingRole?: HardwareTimingRole;
  boardResourceType?: HardwareBoardResourceType;
}

/** Position of this example in the curated v1 learning path. */
export interface ExampleLearningPath {
  /** Curriculum tier: 1=combinational, 2=hardware-mapping, 3=sequential, 4=lab-bridge. */
  tier: 1 | 2 | 3 | 4;
  /** Globally unique 1-based position across the full path (1–6 for v1). */
  order: number;
  /** ID of the next example in the path; undefined for the final item. */
  nextExampleId?: string;
  /** True for the flagship example that first introduces the full Design→Verify→Hardware→Export spine. */
  flagship?: boolean;
  /** Honest caveat when proof is not fully closed (e.g. E3 hardware observation pending). */
  openProof?: string;
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
  /** Curated learning path metadata. Present only on the 6 path examples. */
  learningPath?: ExampleLearningPath;
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
    learningPath: { tier: 2, order: 4, nextExampleId: 'two-bit-counter', flagship: true },
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
    learningPath: { tier: 1, order: 1, nextExampleId: 'half-adder' },
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
    name: '2-Bit Up Counter (Basys3)',
    summary:
      'On-chip 2-bit up counter clocked by the Basys3 100 MHz oscillator (CLK100MHZ / W5). SW0 enables counting; LD1:LD0 show 00→11; BTNC is synchronous reset.',
    course: '',
    lab: '',
    concept: 'Sequential + Waveforms',
    tags: ['counter', 'sequential', 'waveforms', 'basys3', 'board-clock'],
    learningPath: {
      tier: 3,
      order: 5,
      nextExampleId: '23_lab8-fsm-lock-starter-basys3',
      openProof: 'E3 hardware proof not yet closed — export is draft until board observation is recorded.',
    },
    expectedBehavior:
      'With SW0 high, the counter advances on each rising edge of CLK100MHZ (Verify simulates clock steps; the board runs at real 100 MHz so LEDs show a fast blur unless you slow the clock in hardware). With BTNC pressed (RST), count returns to 00.',
    goals: [
      'In Verify: confirm CLK100MHZ is the board clock source, not an ordinary switch lane',
      'Run Compare checks — all vectors pass on the clocked-macro schedule',
      'On hardware: export, bitstream, program; use SW0 enable and BTNC reset',
    ],
    ioRows: [
      {
        id: 'clk',
        nodeId: 'clk_node',
        port: 'out',
        label: 'CLK100MHZ',
        direction: 'in',
        pin: 'CLK100MHZ',
        required: true,
        timingRole: 'clock',
        boardResourceType: 'clock_pin',
      },
      {
        id: 'en',
        nodeId: 'en_node',
        port: 'out',
        label: 'SW0',
        direction: 'in',
        pin: 'SW0',
        required: true,
        timingRole: 'enable',
        boardResourceType: 'switch',
      },
      {
        id: 'rst',
        nodeId: 'rst_node',
        port: 'out',
        label: 'BTNC',
        direction: 'in',
        pin: 'BTNC',
        required: true,
        timingRole: 'reset',
        boardResourceType: 'button',
      },
      {
        id: 'q0',
        nodeId: 'q0_out',
        port: 'in',
        label: 'LD0',
        direction: 'out',
        pin: 'LD0',
        required: true,
        boardResourceType: 'led',
      },
      {
        id: 'q1',
        nodeId: 'q1_out',
        port: 'in',
        label: 'LD1',
        direction: 'out',
        pin: 'LD1',
        required: true,
        boardResourceType: 'led',
      },
    ],
    // Synchronous 2-bit counter with active-high reset. With clocked_macro schedule [CLK=0→1→0]:
    // D_final = AND(D_normal, NOT(RST))  ← synchronous reset implemented via NOT + AND gates
    // Q0_next = Q0 XOR EN   (when RST=0)
    // Q1_next = Q1 XOR (Q0 AND EN)  (when RST=0)
    // All expected values are sampled AFTER the rising edge of that tick (post-clock model).
    // Trace from Q0=0, Q1=0 after boot-reset warmup:
    //   tick0 RST=1,EN=0: Q0→0 Q1→0  (reset asserted)
    //   tick1 RST=0,EN=0: Q0→0 Q1→0  (reset released, EN still low — sequencing lesson)
    //   tick2 RST=0,EN=1: Q0→1 Q1→0  (01)
    //   tick3 RST=0,EN=1: Q0→0 Q1→1  (10)
    //   tick4 RST=0,EN=1: Q0→1 Q1→1  (11)
    //   tick5 RST=0,EN=1: Q0→0 Q1→0  (00 rollover)
    //   tick6 RST=0,EN=0: Q0→0 Q1→0  (hold)
    vectors: [
      { tick: 0, inputs: { clk_node: 0, en_node: 0, rst_node: 1 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 1, inputs: { clk_node: 0, en_node: 0, rst_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 2, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 1, q1_out: 0 } },
      { tick: 3, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 0, q1_out: 1 } },
      { tick: 4, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 1, q1_out: 1 } },
      { tick: 5, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
      { tick: 6, inputs: { clk_node: 0, en_node: 0, rst_node: 0 }, expected: { q0_out: 0, q1_out: 0 } },
    ],
    probes: [
      { nodeId: 'q0_out',   portName: 'in',  label: 'LD0', color: '#00ffff' },
      { nodeId: 'q1_out',   portName: 'in',  label: 'LD1', color: '#ffff00' },
      { nodeId: 'clk_node', portName: 'out', label: 'CLK100MHZ', color: '#ffffff' },
      { nodeId: 'rst_node', portName: 'out', label: 'BTNC', color: '#ff4444' },
    ],
    circuit: {
      nodes: [
        // Top-level port for the board oscillator net (Verify uses clocked_macro edges on this node).
        { id: 'clk_node', type: 'INPUT',     x: 90,  y: 100, label: 'CLK100MHZ', config: {}, state: {} },
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
        // D flip-flops (rising-edge capture, hold between edges)
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
  {
    id: 'half-adder',
    category: 'showcase' as const,
    name: 'Half Adder',
    summary: 'XOR gives the sum bit; AND gives the carry. Toggle SW0 and SW1 to verify all 4 input combinations.',
    course: '',
    lab: '',
    concept: 'Combinational Arithmetic',
    tags: ['arithmetic', 'combinational', 'adder'],
    learningPath: { tier: 1, order: 2, nextExampleId: 'full-adder' },
    expectedBehavior: 'LD1 shows the SUM (SW0 XOR SW1). LD0 shows the CARRY (SW0 AND SW1). Both LEDs light only when both switches are ON.',
    goals: [
      'Toggle SW0 and SW1 — LD1 shows sum, LD0 shows carry',
      'Run Verify — all 4 truth-table rows should pass green',
      'Compare with Full Adder: notice there is no carry-in',
      'Export the Vivado bundle and check the gate-level RTL view',
    ],
    ioRows: [
      { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0 (A)', direction: 'in',  pin: 'V17', required: true },
      { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1 (B)', direction: 'in',  pin: 'W16', required: true },
      { id: 'ld0', nodeId: 'ld0_node', port: 'in',  label: 'LD0 (CARRY)', direction: 'out', pin: 'U16', required: true },
      { id: 'ld1', nodeId: 'ld1_node', port: 'in',  label: 'LD1 (SUM)', direction: 'out', pin: 'E19', required: true },
    ],
    vectors: [
      { tick: 0, inputs: { sw0_node: 0, sw1_node: 0 }, expected: { ld0_node: 0, ld1_node: 0 } },
      { tick: 1, inputs: { sw0_node: 0, sw1_node: 1 }, expected: { ld0_node: 0, ld1_node: 1 } },
      { tick: 2, inputs: { sw0_node: 1, sw1_node: 0 }, expected: { ld0_node: 0, ld1_node: 1 } },
      { tick: 3, inputs: { sw0_node: 1, sw1_node: 1 }, expected: { ld0_node: 1, ld1_node: 0 } },
    ],
    probes: [
      { nodeId: 'and_node', portName: 'out', label: 'CARRY', color: '#ffff00' },
      { nodeId: 'xor_node', portName: 'out', label: 'SUM',   color: '#00ffff' },
    ],
    circuit: {
      nodes: [
        { id: 'sw0_node', type: 'INPUT',  x: 90,  y: 120, label: 'SW0 (A)', config: {}, state: {} },
        { id: 'sw1_node', type: 'INPUT',  x: 90,  y: 260, label: 'SW1 (B)', config: {}, state: {} },
        { id: 'and_node', type: 'AND',    x: 300, y: 100, label: 'AND',     config: {}, state: {} },
        { id: 'xor_node', type: 'XOR',    x: 300, y: 230, label: 'XOR',     config: {}, state: {} },
        { id: 'ld0_node', type: 'OUTPUT', x: 500, y: 100, label: 'LD0 (CARRY)', config: {}, state: {} },
        { id: 'ld1_node', type: 'OUTPUT', x: 500, y: 230, label: 'LD1 (SUM)',   config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'b' } },
        { from: { nodeId: 'sw0_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'a' } },
        { from: { nodeId: 'sw1_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'b' } },
        { from: { nodeId: 'and_node', portName: 'out' }, to: { nodeId: 'ld0_node', portName: 'in' } },
        { from: { nodeId: 'xor_node', portName: 'out' }, to: { nodeId: 'ld1_node', portName: 'in' } },
      ],
    },
  },
  {
    id: 'full-adder',
    category: 'showcase' as const,
    name: 'Full Adder',
    summary: '3-input addition with carry-in. Two XOR stages compute the sum; two AND gates + OR compute the carry-out.',
    course: '',
    lab: '',
    concept: 'Combinational Arithmetic',
    tags: ['arithmetic', 'combinational', 'adder'],
    learningPath: { tier: 1, order: 3, nextExampleId: 'signal-tour' },
    expectedBehavior: 'LD1 shows SUM, LD0 shows CARRY-OUT. SW2 is the carry-in. Compare with Half Adder to see how CIN changes the behavior.',
    goals: [
      'Compare with Half Adder — how does CIN change the behavior?',
      'Run Verify — all 8 truth-table rows should pass green',
      'Trace the carry chain: AND0 and AND1 both contribute to CARRY via OR',
      'Export to Vivado and inspect the two-stage XOR cascade in RTL view',
    ],
    ioRows: [
      { id: 'sw0', nodeId: 'sw0_node', port: 'out', label: 'SW0 (A)',   direction: 'in',  pin: 'V17', required: true },
      { id: 'sw1', nodeId: 'sw1_node', port: 'out', label: 'SW1 (B)',   direction: 'in',  pin: 'W16', required: true },
      { id: 'sw2', nodeId: 'sw2_node', port: 'out', label: 'SW2 (CIN)', direction: 'in',  pin: 'W15', required: true },
      { id: 'ld0', nodeId: 'ld0_node', port: 'in',  label: 'LD0 (CARRY)', direction: 'out', pin: 'U16', required: true },
      { id: 'ld1', nodeId: 'ld1_node', port: 'in',  label: 'LD1 (SUM)',   direction: 'out', pin: 'E19', required: true },
    ],
    // Full truth table: A B CIN → SUM CARRY
    // 000 → 0 0 | 001 → 1 0 | 010 → 1 0 | 011 → 0 1
    // 100 → 1 0 | 101 → 0 1 | 110 → 0 1 | 111 → 1 1
    vectors: [
      { tick: 0, inputs: { sw0_node: 0, sw1_node: 0, sw2_node: 0 }, expected: { ld0_node: 0, ld1_node: 0 } },
      { tick: 1, inputs: { sw0_node: 0, sw1_node: 0, sw2_node: 1 }, expected: { ld0_node: 0, ld1_node: 1 } },
      { tick: 2, inputs: { sw0_node: 0, sw1_node: 1, sw2_node: 0 }, expected: { ld0_node: 0, ld1_node: 1 } },
      { tick: 3, inputs: { sw0_node: 0, sw1_node: 1, sw2_node: 1 }, expected: { ld0_node: 1, ld1_node: 0 } },
      { tick: 4, inputs: { sw0_node: 1, sw1_node: 0, sw2_node: 0 }, expected: { ld0_node: 0, ld1_node: 1 } },
      { tick: 5, inputs: { sw0_node: 1, sw1_node: 0, sw2_node: 1 }, expected: { ld0_node: 1, ld1_node: 0 } },
      { tick: 6, inputs: { sw0_node: 1, sw1_node: 1, sw2_node: 0 }, expected: { ld0_node: 1, ld1_node: 0 } },
      { tick: 7, inputs: { sw0_node: 1, sw1_node: 1, sw2_node: 1 }, expected: { ld0_node: 1, ld1_node: 1 } },
    ],
    probes: [
      { nodeId: 'or_node',  portName: 'out', label: 'CARRY', color: '#ffff00' },
      { nodeId: 'xor2_node', portName: 'out', label: 'SUM',  color: '#00ffff' },
    ],
    circuit: {
      // SUM = A XOR B XOR CIN
      // CARRY = (A AND B) OR (A XOR B) AND CIN
      //       = (A AND B) OR (XOR1_out AND CIN)
      nodes: [
        { id: 'sw0_node',  type: 'INPUT',  x: 90,  y: 100, label: 'SW0 (A)',   config: {}, state: {} },
        { id: 'sw1_node',  type: 'INPUT',  x: 90,  y: 220, label: 'SW1 (B)',   config: {}, state: {} },
        { id: 'sw2_node',  type: 'INPUT',  x: 90,  y: 340, label: 'SW2 (CIN)', config: {}, state: {} },
        // Stage 1: A XOR B, A AND B
        { id: 'xor1_node', type: 'XOR',    x: 280, y: 140, label: 'XOR1 (A⊕B)',    config: {}, state: {} },
        { id: 'and0_node', type: 'AND',    x: 280, y: 260, label: 'AND0 (A·B)',    config: {}, state: {} },
        // Stage 2: (A⊕B) XOR CIN → SUM, (A⊕B) AND CIN → partial carry
        { id: 'xor2_node', type: 'XOR',    x: 470, y: 180, label: 'XOR2 (SUM)',    config: {}, state: {} },
        { id: 'and1_node', type: 'AND',    x: 470, y: 310, label: 'AND1 (carry2)', config: {}, state: {} },
        // Carry OR
        { id: 'or_node',   type: 'OR',     x: 650, y: 280, label: 'OR (CARRY)',    config: {}, state: {} },
        // Outputs
        { id: 'ld0_node',  type: 'OUTPUT', x: 840, y: 260, label: 'LD0 (CARRY)',   config: {}, state: {} },
        { id: 'ld1_node',  type: 'OUTPUT', x: 840, y: 180, label: 'LD1 (SUM)',     config: {}, state: {} },
      ],
      connections: [
        // Stage 1 inputs
        { from: { nodeId: 'sw0_node',  portName: 'out' }, to: { nodeId: 'xor1_node', portName: 'a' } },
        { from: { nodeId: 'sw1_node',  portName: 'out' }, to: { nodeId: 'xor1_node', portName: 'b' } },
        { from: { nodeId: 'sw0_node',  portName: 'out' }, to: { nodeId: 'and0_node', portName: 'a' } },
        { from: { nodeId: 'sw1_node',  portName: 'out' }, to: { nodeId: 'and0_node', portName: 'b' } },
        // Stage 2: SUM and partial carry
        { from: { nodeId: 'xor1_node', portName: 'out' }, to: { nodeId: 'xor2_node', portName: 'a' } },
        { from: { nodeId: 'sw2_node',  portName: 'out' }, to: { nodeId: 'xor2_node', portName: 'b' } },
        { from: { nodeId: 'xor1_node', portName: 'out' }, to: { nodeId: 'and1_node', portName: 'a' } },
        { from: { nodeId: 'sw2_node',  portName: 'out' }, to: { nodeId: 'and1_node', portName: 'b' } },
        // OR for final carry
        { from: { nodeId: 'and0_node', portName: 'out' }, to: { nodeId: 'or_node',   portName: 'a' } },
        { from: { nodeId: 'and1_node', portName: 'out' }, to: { nodeId: 'or_node',   portName: 'b' } },
        // Outputs
        { from: { nodeId: 'xor2_node', portName: 'out' }, to: { nodeId: 'ld1_node',  portName: 'in' } },
        { from: { nodeId: 'or_node',   portName: 'out' }, to: { nodeId: 'ld0_node',  portName: 'in' } },
      ],
    },
  },
  ...LAB_STARTERS.map((s) => s.example),
];

export function getIdeExampleById(id: string): IdeExampleDefinition | undefined {
  return IDE_EXAMPLES.find((example) => example.id === id);
}
