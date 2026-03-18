// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { vhdlFromNetlist } from '../vhdlExport';
import type { Netlist } from '../netlistExport';

// ---------------------------------------------------------------------------
// Minimal AND gate netlist: SW(0) and SW(1) -> AND -> LED(0)
// ---------------------------------------------------------------------------
const minimalAndNetlist: Netlist = {
  kind: 'rb-netlist',
  version: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  circuitDigest: 'test-digest-and',
  nodes: [
    {
      id: 'switch_0',
      type: 'Switch',
      label: 'SW[0]',
      ports: [{ name: 'out', direction: 'out' }],
    },
    {
      id: 'switch_1',
      type: 'Switch',
      label: 'SW[1]',
      ports: [{ name: 'out', direction: 'out' }],
    },
    {
      id: 'and_gate_0',
      type: 'AND',
      ports: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
      ],
    },
    {
      id: 'lamp_0',
      type: 'Lamp',
      label: 'LED[0]',
      ports: [{ name: 'in', direction: 'in' }],
    },
  ],
  nets: [
    {
      id: 'switch_0.out->and_gate_0.a',
      from: { nodeId: 'switch_0', port: 'out' },
      to: { nodeId: 'and_gate_0', port: 'a' },
    },
    {
      id: 'switch_1.out->and_gate_0.b',
      from: { nodeId: 'switch_1', port: 'out' },
      to: { nodeId: 'and_gate_0', port: 'b' },
    },
    {
      id: 'and_gate_0.out->lamp_0.in',
      from: { nodeId: 'and_gate_0', port: 'out' },
      to: { nodeId: 'lamp_0', port: 'in' },
    },
  ],
};

// ---------------------------------------------------------------------------
// 4-bit netlist: 4 switches through AND gates to 4 LEDs
// ---------------------------------------------------------------------------
const fourBitNetlist: Netlist = {
  kind: 'rb-netlist',
  version: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  circuitDigest: 'test-digest-4bit',
  nodes: [
    { id: 'sw_node_0', type: 'Switch', label: 'SW[0]', ports: [{ name: 'out', direction: 'out' }] },
    { id: 'sw_node_1', type: 'Switch', label: 'SW[1]', ports: [{ name: 'out', direction: 'out' }] },
    { id: 'sw_node_2', type: 'Switch', label: 'SW[2]', ports: [{ name: 'out', direction: 'out' }] },
    { id: 'sw_node_3', type: 'Switch', label: 'SW[3]', ports: [{ name: 'out', direction: 'out' }] },
    {
      id: 'and_a',
      type: 'AND',
      ports: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
      ],
    },
    {
      id: 'and_b',
      type: 'AND',
      ports: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
      ],
    },
    {
      id: 'or_c',
      type: 'OR',
      ports: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
      ],
    },
    {
      id: 'xor_d',
      type: 'XOR',
      ports: [
        { name: 'a', direction: 'in' },
        { name: 'b', direction: 'in' },
        { name: 'out', direction: 'out' },
      ],
    },
    { id: 'led_node_0', type: 'Lamp', label: 'LED[0]', ports: [{ name: 'in', direction: 'in' }] },
    { id: 'led_node_1', type: 'Lamp', label: 'LED[1]', ports: [{ name: 'in', direction: 'in' }] },
    { id: 'led_node_2', type: 'Lamp', label: 'LED[2]', ports: [{ name: 'in', direction: 'in' }] },
    { id: 'led_node_3', type: 'Lamp', label: 'LED[3]', ports: [{ name: 'in', direction: 'in' }] },
  ],
  nets: [
    { id: 'sw_node_0.out->and_a.a', from: { nodeId: 'sw_node_0', port: 'out' }, to: { nodeId: 'and_a', port: 'a' } },
    { id: 'sw_node_1.out->and_a.b', from: { nodeId: 'sw_node_1', port: 'out' }, to: { nodeId: 'and_a', port: 'b' } },
    { id: 'sw_node_2.out->and_b.a', from: { nodeId: 'sw_node_2', port: 'out' }, to: { nodeId: 'and_b', port: 'a' } },
    { id: 'sw_node_3.out->and_b.b', from: { nodeId: 'sw_node_3', port: 'out' }, to: { nodeId: 'and_b', port: 'b' } },
    { id: 'and_a.out->or_c.a',   from: { nodeId: 'and_a',    port: 'out' }, to: { nodeId: 'or_c',     port: 'a' } },
    { id: 'and_b.out->or_c.b',   from: { nodeId: 'and_b',    port: 'out' }, to: { nodeId: 'or_c',     port: 'b' } },
    { id: 'and_a.out->xor_d.a',  from: { nodeId: 'and_a',    port: 'out' }, to: { nodeId: 'xor_d',    port: 'a' } },
    { id: 'and_b.out->xor_d.b',  from: { nodeId: 'and_b',    port: 'out' }, to: { nodeId: 'xor_d',    port: 'b' } },
    { id: 'and_a.out->led_0.in', from: { nodeId: 'and_a',    port: 'out' }, to: { nodeId: 'led_node_0', port: 'in' } },
    { id: 'and_b.out->led_1.in', from: { nodeId: 'and_b',    port: 'out' }, to: { nodeId: 'led_node_1', port: 'in' } },
    { id: 'or_c.out->led_2.in',  from: { nodeId: 'or_c',     port: 'out' }, to: { nodeId: 'led_node_2', port: 'in' } },
    { id: 'xor_d.out->led_3.in', from: { nodeId: 'xor_d',    port: 'out' }, to: { nodeId: 'led_node_3', port: 'in' } },
  ],
};

// ---------------------------------------------------------------------------
// Unconnected output netlist: one LED has no driver
// ---------------------------------------------------------------------------
const unconnectedOutputNetlist: Netlist = {
  kind: 'rb-netlist',
  version: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  circuitDigest: 'test-digest-unconnected',
  nodes: [
    {
      id: 'sw_only',
      type: 'Switch',
      label: 'SW[0]',
      ports: [{ name: 'out', direction: 'out' }],
    },
    {
      id: 'led_driven',
      type: 'Lamp',
      label: 'LED[0]',
      ports: [{ name: 'in', direction: 'in' }],
    },
    {
      id: 'led_floating',
      type: 'Lamp',
      label: 'LED[1]',
      ports: [{ name: 'in', direction: 'in' }],
    },
  ],
  // sw_only connects to led_driven, but led_floating has no driver
  nets: [
    {
      id: 'sw_only.out->led_driven.in',
      from: { nodeId: 'sw_only', port: 'out' },
      to: { nodeId: 'led_driven', port: 'in' },
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('vhdlFromNetlist', () => {
  it('produces entity/architecture for a simple AND gate', () => {
    const result = vhdlFromNetlist(minimalAndNetlist, { entityName: 'top' });

    expect(result.vhd).toContain('entity top is');
    expect(result.vhd).toContain('end entity top');
    expect(result.vhd).toContain('architecture Behavioral of top');
    expect(result.vhd).toContain('end architecture Behavioral');
    expect(result.vhd).toContain('library IEEE');
    expect(result.vhd).toContain('STD_LOGIC');
  });

  it('uses STD_LOGIC_VECTOR for multi-bit ports', () => {
    const result = vhdlFromNetlist(fourBitNetlist, { entityName: 'top' });
    expect(result.vhd).toContain('STD_LOGIC_VECTOR');
    expect(result.vhd).toContain('downto 0');
  });

  it('uses meaningful signal names (not n_12345 spam)', () => {
    const result = vhdlFromNetlist(minimalAndNetlist, { entityName: 'top' });
    // Should not have signals like "sig_a1b2c3d4" with 6+ hex chars
    expect(result.vhd).not.toMatch(/\bsig_[0-9a-f]{6,}\b/);
  });

  it('includes file header with entity name when includeFileHeader is true', () => {
    const result = vhdlFromNetlist(minimalAndNetlist, {
      entityName: 'top',
      includeFileHeader: true,
      labTitle: 'Lab 4 ALU',
    });
    expect(result.vhd).toContain('RedByte Generated VHDL');
    expect(result.vhd).toContain('Lab 4 ALU');
  });

  it('reports warnings for unconnected outputs', () => {
    const result = vhdlFromNetlist(unconnectedOutputNetlist, { entityName: 'top' });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('normalizes uppercase DFlipFlop ports and emits Q_inv support', () => {
    const netlist: Netlist = {
      kind: 'rb-netlist',
      version: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      circuitDigest: 'test-dff-uppercase',
      nodes: [
        { id: 'd_src', type: 'Switch', label: 'D', ports: [{ name: 'out', direction: 'out' }] },
        { id: 'clk_src', type: 'Switch', label: 'CLK', ports: [{ name: 'out', direction: 'out' }] },
        {
          id: 'dff0',
          type: 'DFlipFlop',
          ports: [
            { name: 'D', direction: 'in' },
            { name: 'CLK', direction: 'in' },
            { name: 'Q', direction: 'out' },
            { name: 'Q_inv', direction: 'out' },
          ],
        },
        { id: 'q_out', type: 'Lamp', label: 'Q', ports: [{ name: 'in', direction: 'in' }] },
      ],
      nets: [
        { id: 'd->dff', from: { nodeId: 'd_src', port: 'out' }, to: { nodeId: 'dff0', port: 'D' } },
        { id: 'clk->dff', from: { nodeId: 'clk_src', port: 'out' }, to: { nodeId: 'dff0', port: 'CLK' } },
        { id: 'q->out', from: { nodeId: 'dff0', port: 'Q' }, to: { nodeId: 'q_out', port: 'in' } },
      ],
    };

    const result = vhdlFromNetlist(netlist, { entityName: 'top' });
    expect(result.warnings.join('\n')).not.toContain('missing DFlipFlop clock');
    expect(result.vhd).toMatch(/if rising_edge\(CLK(?:\(\d+\))?\) then/);
    expect(result.vhd).toContain('signal dff_0_inv : STD_LOGIC;');
    expect(result.vhd).toContain('dff_0_inv <= not dff_0;');
  });

  it('emits CLR-aware sequential processes and constant-low Ground support', () => {
    const netlist: Netlist = {
      kind: 'rb-netlist',
      version: 1,
      createdAt: '2025-01-01T00:00:00.000Z',
      circuitDigest: 'test-jk-clr-ground',
      nodes: [
        { id: 'j_src', type: 'Switch', label: 'J', ports: [{ name: 'out', direction: 'out' }] },
        { id: 'k_src', type: 'Switch', label: 'K', ports: [{ name: 'out', direction: 'out' }] },
        { id: 'clk_src', type: 'Switch', label: 'CLK', ports: [{ name: 'out', direction: 'out' }] },
        { id: 'clr_src', type: 'Ground', ports: [{ name: 'out', direction: 'out' }] },
        {
          id: 'jk0',
          type: 'JKFlipFlop',
          ports: [
            { name: 'J', direction: 'in' },
            { name: 'K', direction: 'in' },
            { name: 'CLK', direction: 'in' },
            { name: 'CLR', direction: 'in' },
            { name: 'Q', direction: 'out' },
            { name: 'Q_inv', direction: 'out' },
          ],
        },
      ],
      nets: [
        { id: 'j->jk', from: { nodeId: 'j_src', port: 'out' }, to: { nodeId: 'jk0', port: 'J' } },
        { id: 'k->jk', from: { nodeId: 'k_src', port: 'out' }, to: { nodeId: 'jk0', port: 'K' } },
        { id: 'clk->jk', from: { nodeId: 'clk_src', port: 'out' }, to: { nodeId: 'jk0', port: 'CLK' } },
        { id: 'clr->jk', from: { nodeId: 'clr_src', port: 'out' }, to: { nodeId: 'jk0', port: 'CLR' } },
      ],
    };

    const result = vhdlFromNetlist(netlist, { entityName: 'top' });
    expect(result.vhd).toContain("gnd_0 <= '0';");
    expect(result.vhd).toMatch(/process \(CLK(?:\(\d+\))?, gnd_0\)/);
    expect(result.vhd).toContain("if gnd_0 = '1' then");
    expect(result.vhd).toContain('jkff_0_inv <= not jkff_0;');
  });
});

  // ---------------------------------------------------------------------------
  // topPorts mode regression tests
  // These pin the bug where vhdlFromNetlist with topPorts produced architecture
  // bodies that referenced undeclared identifiers like LED(0) / SW(0).
  // ---------------------------------------------------------------------------

  // Pass-through: sw0_node_out ──wire──> ld0_node_in (no logic gates)
  const passThroughNetlist: Netlist = {
    kind: 'rb-netlist',
    version: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    circuitDigest: 'test-digest-passthrough',
    nodes: [
      { id: 'sw0_node', type: 'Switch', label: 'SW0', ports: [{ name: 'out', direction: 'out' }] },
      { id: 'sw1_node', type: 'Switch', label: 'SW1', ports: [{ name: 'out', direction: 'out' }] },
      { id: 'ld0_node', type: 'Lamp',   label: 'LD0', ports: [{ name: 'in',  direction: 'in'  }] },
      { id: 'ld1_node', type: 'Lamp',   label: 'LD1', ports: [{ name: 'in',  direction: 'in'  }] },
    ],
    nets: [
      { id: 'sw0->ld0', from: { nodeId: 'sw0_node', port: 'out' }, to: { nodeId: 'ld0_node', port: 'in' } },
      { id: 'sw1->ld1', from: { nodeId: 'sw1_node', port: 'out' }, to: { nodeId: 'ld1_node', port: 'in' } },
    ],
  };

  // AND gate between two switches and one LED
  const andWithTopPortsNetlist: Netlist = {
    kind: 'rb-netlist',
    version: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    circuitDigest: 'test-digest-and-topports',
    nodes: [
      { id: 'sw0_node', type: 'Switch', label: 'SW0', ports: [{ name: 'out', direction: 'out' }] },
      { id: 'sw1_node', type: 'Switch', label: 'SW1', ports: [{ name: 'out', direction: 'out' }] },
      {
        id: 'and_gate',
        type: 'AND',
        ports: [
          { name: 'a',   direction: 'in'  },
          { name: 'b',   direction: 'in'  },
          { name: 'out', direction: 'out' },
        ],
      },
      { id: 'ld0_node', type: 'Lamp', label: 'LD0', ports: [{ name: 'in', direction: 'in' }] },
    ],
    nets: [
      { id: 'sw0->and.a',  from: { nodeId: 'sw0_node',  port: 'out' }, to: { nodeId: 'and_gate', port: 'a'  } },
      { id: 'sw1->and.b',  from: { nodeId: 'sw1_node',  port: 'out' }, to: { nodeId: 'and_gate', port: 'b'  } },
      { id: 'and->ld0',    from: { nodeId: 'and_gate',  port: 'out' }, to: { nodeId: 'ld0_node', port: 'in' } },
    ],
  };

  describe('vhdlFromNetlist — topPorts mode (board-aware export)', () => {
    it('pass-through: entity declares only the canonical port names, not SW/LED vectors', () => {
      const result = vhdlFromNetlist(passThroughNetlist, {
        entityName: 'top',
        topPorts: [
          { name: 'sw0_node_out', dir: 'in',  vhdlType: 'STD_LOGIC' },
          { name: 'sw1_node_out', dir: 'in',  vhdlType: 'STD_LOGIC' },
          { name: 'ld0_node_in',  dir: 'out', vhdlType: 'STD_LOGIC' },
          { name: 'ld1_node_in',  dir: 'out', vhdlType: 'STD_LOGIC' },
        ],
        topInputBindings: [
          { portName: 'sw0_node_out', toNodeId: 'sw0_node', toPort: 'out' },
          { portName: 'sw1_node_out', toNodeId: 'sw1_node', toPort: 'out' },
        ],
        topOutputBindings: [
          { portName: 'ld0_node_in', fromNodeId: 'ld0_node', fromPort: 'in' },
          { portName: 'ld1_node_in', fromNodeId: 'ld1_node', fromPort: 'in' },
        ],
      });

      // Entity must declare canonical port names
      expect(result.vhd).toContain('sw0_node_out : in');
      expect(result.vhd).toContain('sw1_node_out : in');
      expect(result.vhd).toContain('ld0_node_in : out');
      expect(result.vhd).toContain('ld1_node_in : out');

      // Architecture must NOT reference undeclared portGroup identifiers.
      // Regression: previously the architecture would emit ld0_node_in <= LED(0)
      // where LED was never declared — exactly what Vivado reported as synthesis error.
      expect(result.vhd).not.toMatch(/\bLED\s*\(/);
      expect(result.vhd).not.toMatch(/\bSW\s*\(/);

      // Architecture must connect the canonical port names correctly
      expect(result.vhd).toContain('ld0_node_in <= sw0_node_out');
      expect(result.vhd).toContain('ld1_node_in <= sw1_node_out');
    });

    it('AND gate: architecture assignments reference canonical port names, not portGroup vectors', () => {
      const result = vhdlFromNetlist(andWithTopPortsNetlist, {
        entityName: 'top',
        topPorts: [
          { name: 'sw0_node_out', dir: 'in',  vhdlType: 'STD_LOGIC' },
          { name: 'sw1_node_out', dir: 'in',  vhdlType: 'STD_LOGIC' },
          { name: 'ld0_node_in',  dir: 'out', vhdlType: 'STD_LOGIC' },
        ],
        topInputBindings: [
          { portName: 'sw0_node_out', toNodeId: 'sw0_node', toPort: 'out' },
          { portName: 'sw1_node_out', toNodeId: 'sw1_node', toPort: 'out' },
        ],
        topOutputBindings: [
          { portName: 'ld0_node_in', fromNodeId: 'ld0_node', fromPort: 'in' },
        ],
      });

      expect(result.vhd).not.toMatch(/\bLED\s*\(/);
      expect(result.vhd).not.toMatch(/\bSW\s*\(/);

      // Internal AND signal driven by canonical input port names
      expect(result.vhd).toContain('sw0_node_out');
      expect(result.vhd).toContain('sw1_node_out');

      // Entity output driven by internal AND signal (e.g. 'and_0')
      expect(result.vhd).toMatch(/ld0_node_in\s*<=\s*\w+;/);
    });

    it('pass-through: no warnings about unresolved drivers', () => {
      const result = vhdlFromNetlist(passThroughNetlist, {
        entityName: 'top',
        topPorts: [
          { name: 'sw0_node_out', dir: 'in',  vhdlType: 'STD_LOGIC' },
          { name: 'ld0_node_in',  dir: 'out', vhdlType: 'STD_LOGIC' },
          { name: 'ld1_node_in',  dir: 'out', vhdlType: 'STD_LOGIC' },
        ],
        topInputBindings: [{ portName: 'sw0_node_out', toNodeId: 'sw0_node', toPort: 'out' }],
        topOutputBindings: [
          { portName: 'ld0_node_in', fromNodeId: 'ld0_node', fromPort: 'in' },
          { portName: 'ld1_node_in', fromNodeId: 'ld1_node', fromPort: 'in' },
        ],
      });

      // ld1 is driven by sw1 which is not in topInputBindings → driver will be unresolved
      // but ld0 must have no warning
      const ld0Warnings = result.warnings.filter((w) => w.includes('ld0_node_in'));
      expect(ld0Warnings).toHaveLength(0);
    });

    it('four-switch pass-through produces 4-port entity matching XDC-ready names', () => {
      const nodes = [0, 1, 2, 3].flatMap((i) => [
        { id: `sw${i}_node`, type: 'Switch', label: `SW${i}`, ports: [{ name: 'out', direction: 'out' as const }] },
        { id: `ld${i}_node`, type: 'Lamp',   label: `LD${i}`, ports: [{ name: 'in',  direction: 'in'  as const }] },
      ]);
      const nets = [0, 1, 2, 3].map((i) => ({
        id: `sw${i}->ld${i}`,
        from: { nodeId: `sw${i}_node`, port: 'out' },
        to:   { nodeId: `ld${i}_node`, port: 'in'  },
      }));
      const netlist: Netlist = {
        kind: 'rb-netlist', version: 1,
        createdAt: '2025-01-01T00:00:00.000Z', circuitDigest: 'test-4sw',
        nodes, nets,
      };
      const topPorts = [
        ...([0, 1, 2, 3].map((i) => ({ name: `sw${i}_node_out`, dir: 'in'  as const, vhdlType: 'STD_LOGIC' }))),
        ...([0, 1, 2, 3].map((i) => ({ name: `ld${i}_node_in`,  dir: 'out' as const, vhdlType: 'STD_LOGIC' }))),
      ];
      const topInputBindings  = [0, 1, 2, 3].map((i) => ({ portName: `sw${i}_node_out`, toNodeId: `sw${i}_node`, toPort: 'out' }));
      const topOutputBindings = [0, 1, 2, 3].map((i) => ({ portName: `ld${i}_node_in`, fromNodeId: `ld${i}_node`, fromPort: 'in' }));

      const result = vhdlFromNetlist(netlist, { entityName: 'top', topPorts, topInputBindings, topOutputBindings });

      // All 8 ports declared
      for (let i = 0; i < 4; i++) {
        expect(result.vhd).toContain(`sw${i}_node_out : in`);
        expect(result.vhd).toContain(`ld${i}_node_in : out`);
      }
      // No portGroup vector references
      expect(result.vhd).not.toMatch(/\bLED\s*\(/);
      expect(result.vhd).not.toMatch(/\bSW\s*\(/);
      // Each LED assigned from corresponding SW
      for (let i = 0; i < 4; i++) {
        expect(result.vhd).toContain(`ld${i}_node_in <= sw${i}_node_out`);
      }
      expect(result.warnings).toHaveLength(0);
    });

    it('supports explicit vector topPorts bindings derived from export refs', () => {
      const result = vhdlFromNetlist(passThroughNetlist, {
        entityName: 'top',
        topPorts: [
          { name: 'SW', dir: 'in', vhdlType: 'STD_LOGIC_VECTOR(1 downto 0)' },
          { name: 'LED', dir: 'out', vhdlType: 'STD_LOGIC_VECTOR(1 downto 0)' },
        ],
        topInputBindings: [
          { portName: 'SW', bitIndex: 0, toNodeId: 'sw0_node', toPort: 'out' },
          { portName: 'SW', bitIndex: 1, toNodeId: 'sw1_node', toPort: 'out' },
        ],
        topOutputBindings: [
          { portName: 'LED', bitIndex: 0, fromNodeId: 'ld0_node', fromPort: 'in' },
          { portName: 'LED', bitIndex: 1, fromNodeId: 'ld1_node', fromPort: 'in' },
        ],
      });

      expect(result.vhd).toContain('SW : in  STD_LOGIC_VECTOR(1 downto 0)');
      expect(result.vhd).toContain('LED : out STD_LOGIC_VECTOR(1 downto 0)');
      expect(result.vhd).toContain('LED(0) <= SW(0)');
      expect(result.vhd).toContain('LED(1) <= SW(1)');
      expect(result.warnings).toEqual([]);
    });
  });
