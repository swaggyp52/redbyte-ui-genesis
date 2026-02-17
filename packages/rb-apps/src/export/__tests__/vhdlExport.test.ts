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
    expect(result.vhd).toContain('architecture rtl of top');
    expect(result.vhd).toContain('end architecture rtl');
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
});
