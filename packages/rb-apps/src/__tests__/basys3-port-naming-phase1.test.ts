/**
 * Phase 1 — Port Naming: Label → HDL/XDC
 *
 * Verifies that:
 * 1. toSignalName uses label when present, falls back to nodeId_port
 * 2. buildTopXdc emits ## group headers (Switches, LEDs, Clock)
 * 3. XDC ports use label-based names, not nodeId_port names
 */

import { describe, expect, it } from 'vitest';
import type { IoMapping } from '@redbyte/rb-utils';
import { exportBasys3Bundle } from '../fpga/boards/basys3/basys3Bundle';
import type { Circuit } from '@redbyte/rb-logic-core';

const EMPTY_CIRCUIT: Circuit = { nodes: [], connections: [] };

function makeCircuitWithNode(id: string): Circuit {
  return {
    nodes: [{ id, type: 'AND', x: 100, y: 100, label: '', config: {}, state: {} }],
    connections: [],
  };
}

describe('Phase 1 — port naming: label takes precedence over nodeId_port', () => {
  it('toSignalName uses label when present in XDC get_ports', () => {
    const ioMapping: IoMapping = {
      inputs: [{ id: 'in0', nodeId: 'g1', port: 'in1', label: 'SW0', pin: 'SW0' }],
      outputs: [{ id: 'out0', nodeId: 'g1', port: 'out', label: 'LD0', pin: 'LD0' }],
    };
    const result = exportBasys3Bundle(makeCircuitWithNode('g1'), ioMapping);
    expect(result.topXdc).toContain('[get_ports {SW0}]');
    expect(result.topXdc).toContain('[get_ports {LD0}]');
    expect(result.topXdc).not.toContain('g1_in1');
    expect(result.topXdc).not.toContain('g1_out');
  });

  it('toSignalName falls back to nodeId_port when label is absent', () => {
    const ioMapping: IoMapping = {
      inputs: [{ id: 'in0', nodeId: 'g1', port: 'in1', label: '', pin: 'SW0' }],
      outputs: [{ id: 'out0', nodeId: 'g1', port: 'out', label: '', pin: 'LD0' }],
    };
    const result = exportBasys3Bundle(makeCircuitWithNode('g1'), ioMapping);
    expect(result.topXdc).toContain('[get_ports {g1_in1}]');
    expect(result.topXdc).toContain('[get_ports {g1_out}]');
  });

  it('toSignalName uses label in VHDL entity ports', () => {
    const ioMapping: IoMapping = {
      inputs: [{ id: 'in0', nodeId: 'g1', port: 'in1', label: 'A', pin: 'SW0' }],
      outputs: [{ id: 'out0', nodeId: 'g1', port: 'out', label: 'Y', pin: 'LD0' }],
    };
    const result = exportBasys3Bundle(makeCircuitWithNode('g1'), ioMapping);
    expect(result.topVhd).toContain('A : in');
    expect(result.topVhd).toContain('Y : out');
    expect(result.topVhd).not.toContain('g1_in1');
    expect(result.topVhd).not.toContain('g1_out');
  });

  it('toSignalName uses label in README pin table', () => {
    const ioMapping: IoMapping = {
      inputs: [{ id: 'in0', nodeId: 'g1', port: 'in1', label: 'sw0', pin: 'SW0' }],
      outputs: [{ id: 'out0', nodeId: 'g1', port: 'out', label: 'ld0', pin: 'LD0' }],
    };
    const result = exportBasys3Bundle(makeCircuitWithNode('g1'), ioMapping);
    expect(result.readme).toContain('| sw0 | SW0 |');
    expect(result.readme).toContain('| ld0 | LD0 |');
  });

  it('sanitizes label for valid VHDL/Verilog identifier', () => {
    const ioMapping: IoMapping = {
      inputs: [{ id: 'in0', nodeId: 'g1', port: 'in1', label: 'my-signal!', pin: 'SW0' }],
      outputs: [],
    };
    const result = exportBasys3Bundle(makeCircuitWithNode('g1'), ioMapping);
    expect(result.topXdc).toContain('[get_ports {my_signal}]');
    expect(result.topVhd).toContain('my_signal : in');
  });

  it('collapses repeated separators so student labels stay legal in Vivado VHDL', () => {
    const ioMapping: IoMapping = {
      inputs: [{ id: 'rst', nodeId: 'g1', port: 'in1', label: 'RST (BTNC)', pin: 'BTNC' }],
      outputs: [],
    };
    const result = exportBasys3Bundle(makeCircuitWithNode('g1'), ioMapping);

    expect(result.topXdc).toContain('[get_ports {RST_BTNC}]');
    expect(result.topVhd).toContain('RST_BTNC : in');
    expect(result.topXdc).not.toContain('RST__BTNC_');
    expect(result.topVhd).not.toContain('RST__BTNC_');
  });
});

describe('Phase 1 — XDC grouping: section headers emitted per signal type', () => {
  it('emits ## Switches header for SW pin', () => {
    const ioMapping: IoMapping = {
      inputs: [{ id: 'in0', nodeId: 'g1', port: 'in1', label: 'sw0', pin: 'SW0' }],
      outputs: [],
    };
    const result = exportBasys3Bundle(makeCircuitWithNode('g1'), ioMapping);
    expect(result.topXdc).toContain('## Switches');
  });

  it('emits ## LEDs header for LD pin', () => {
    const ioMapping: IoMapping = {
      inputs: [],
      outputs: [{ id: 'out0', nodeId: 'g1', port: 'out', label: 'ld0', pin: 'LD0' }],
    };
    const result = exportBasys3Bundle(makeCircuitWithNode('g1'), ioMapping);
    expect(result.topXdc).toContain('## LEDs');
  });

  it('emits ## Clock header and timing constraint for CLK100MHZ pin', () => {
    const ioMapping: IoMapping = {
      inputs: [{ id: 'clk', nodeId: 'port_clk', port: 'out', label: 'clk', pin: 'CLK100MHZ' }],
      outputs: [],
    };
    const result = exportBasys3Bundle(EMPTY_CIRCUIT, ioMapping);
    expect(result.topXdc).toContain('## Clock');
    expect(result.topXdc).toContain('create_clock');
    expect(result.topXdc).toContain('PACKAGE_PIN W5');
  });

  it('groups do not contain nodeId_port style names when labels are provided', () => {
    const ioMapping: IoMapping = {
      inputs: [
        { id: 'in0', nodeId: 'port_sw0', port: 'out', label: 'sw0', pin: 'SW0' },
        { id: 'in1', nodeId: 'port_sw1', port: 'out', label: 'sw1', pin: 'SW1' },
      ],
      outputs: [
        { id: 'out0', nodeId: 'port_ld0', port: 'in', label: 'ld0', pin: 'LD0' },
      ],
    };
    const result = exportBasys3Bundle(EMPTY_CIRCUIT, ioMapping);
    expect(result.topXdc).not.toContain('port_sw0');
    expect(result.topXdc).not.toContain('port_sw1');
    expect(result.topXdc).not.toContain('port_ld0');
    expect(result.topXdc).toContain('[get_ports {sw0}]');
    expect(result.topXdc).toContain('[get_ports {sw1}]');
    expect(result.topXdc).toContain('[get_ports {ld0}]');
  });

  it('emits ## Buttons header for BTN pin', () => {
    const ioMapping: IoMapping = {
      inputs: [{ id: 'btn0', nodeId: 'g1', port: 'in1', label: 'btn0', pin: 'BTNC' }],
      outputs: [],
    };
    const result = exportBasys3Bundle(makeCircuitWithNode('g1'), ioMapping);
    expect(result.topXdc).toContain('## Buttons');
  });
});
