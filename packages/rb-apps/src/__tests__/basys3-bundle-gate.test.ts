import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import { exportBasys3Bundle } from '../fpga/boards/basys3/basys3Bundle';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function extractXdcPorts(topXdc: string): string[] {
  return Array.from(
    new Set(
      [...topXdc.matchAll(/\[get_ports\s*\{([^}]+)\}\]/g)].map((match) => String(match[1]).trim()),
    ),
  );
}

/** Strip [N] suffix from XDC port refs to get entity base port names. */
function xdcPortToEntityBase(portRef: string): string {
  return portRef.replace(/\[\d+\]$/, '');
}

function extractVhdlPorts(topVhd: string): string[] {
  const entityBlockMatch = topVhd.match(/entity\s+\w+\s+is[\s\S]*?Port\s*\(([^]*?)\);\s*end\s+entity/i);
  if (!entityBlockMatch) return [];
  return Array.from(
    new Set(
      entityBlockMatch[1]
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => entry.split(':')[0]?.trim() ?? '')
        .filter(Boolean),
    ),
  );
}

const validCircuit: Circuit = {
  nodes: [{ id: 'g1', type: 'AND', position: { x: 80, y: 40 }, config: {}, state: {} }],
  connections: [],
};

const validMapping: IoMapping = {
  inputs: [
    { id: 'i2', nodeId: 'g1', port: 'in2', pin: 'SW1' },
    { id: 'i1', nodeId: 'g1', port: 'in1', pin: 'SW0' },
  ],
  outputs: [{ id: 'o1', nodeId: 'g1', port: 'out', pin: 'LD0' }],
};

describe('RC D2 basys3 bundle gate', () => {
  it('produces valid deterministic top.vhd/top.xdc/readme with top entity', () => {
    const run1 = exportBasys3Bundle(validCircuit, validMapping);
    const run2 = exportBasys3Bundle(validCircuit, validMapping);

    expect(run1.valid).toBe(true);
    expect(run1.topVhd).toContain('library IEEE;');
    expect(run1.topVhd).toContain('entity top is');
    expect(run1.topVhd).toContain('architecture Behavioral');
    expect(run1.topVhd).toContain('g1_in1 : in  STD_LOGIC');
    expect(run1.topVhd).toContain('g1_in2 : in  STD_LOGIC');
    expect(run1.topVhd).toContain('g1_out : out STD_LOGIC');
    expect(run1.topXdc).toContain('PACKAGE_PIN V17');
    expect(run1.topXdc).toContain('PACKAGE_PIN V16');
    expect(run1.topXdc).toContain('PACKAGE_PIN U16');
    expect(run1.topXdc).not.toContain('PACKAGE_PIN W16');
    expect(run1.readme).toContain('| g1_in1 | SW0 | V17 | input |');
    expect(run1.readme).toContain('| g1_out | LD0 | U16 | output |');
    expect(run1.readme).toContain('`top.vhd`');

    expect(run2.topVhd).toBe(run1.topVhd);
    expect(run2.topXdc).toBe(run1.topXdc);
    expect(run2.readme).toBe(run1.readme);

    const bundleHash1 = sha256(`${run1.topVhd}\n---\n${run1.topXdc}\n---\n${run1.readme}`);
    const bundleHash2 = sha256(`${run2.topVhd}\n---\n${run2.topXdc}\n---\n${run2.readme}`);
    expect(bundleHash2).toBe(bundleHash1);

    const xdcPorts = extractXdcPorts(run1.topXdc);
    const vhdlPorts = extractVhdlPorts(run1.topVhd);
    // XDC port refs may use SW[0] notation; strip [N] to get entity base port name
    xdcPorts.forEach((portRef) => {
      expect(vhdlPorts).toContain(xdcPortToEntityBase(portRef));
    });
  });

  it('returns invalid bundle with crisp warnings for unsupported nodes', () => {
    const unsupportedCircuit: Circuit = {
      nodes: [{ id: 'sw1', type: 'UnknownGate', position: { x: 0, y: 0 }, config: {}, state: {} }],
      connections: [],
    };

    const result = exportBasys3Bundle(unsupportedCircuit, {
      inputs: [],
      outputs: [{ id: 'o1', nodeId: 'sw1', port: 'out', pin: 'LD0' }],
    });

    expect(result.valid).toBe(false);
    expect(result.warnings.some((warning) => warning.includes('Unsupported node: sw1 (UnknownGate)'))).toBe(true);
  });

  it('accepts Basys3 button/7-seg aliases and direct package pins in deterministic XDC output', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'g1', type: 'AND', position: { x: 0, y: 0 }, config: {}, state: {} },
        { id: 'g2', type: 'AND', position: { x: 200, y: 0 }, config: {}, state: {} },
      ],
      connections: [],
    };

    const mapping: IoMapping = {
      inputs: [
        { id: 'in_clk', nodeId: 'g1', port: 'in1', pin: 'CLK100MHZ' },
        { id: 'in_btn', nodeId: 'g1', port: 'in2', pin: 'BTNC' },
        { id: 'in_sw', nodeId: 'g2', port: 'in1', pin: 'SW0' },
      ],
      outputs: [
        { id: 'out_seg', nodeId: 'g1', port: 'out', pin: 'SEG0' },
        { id: 'out_an', nodeId: 'g2', port: 'out', pin: 'W4' },
      ],
    };

    const result = exportBasys3Bundle(circuit, mapping);
    expect(result.valid).toBe(true);
    expect(result.topXdc).toContain('PACKAGE_PIN W5');
    expect(result.topXdc).toContain('PACKAGE_PIN U18');
    expect(result.topXdc).toContain('PACKAGE_PIN W7');
    expect(result.topXdc).toContain('PACKAGE_PIN W4');
    expect(result.warnings.some((warning) => warning.includes('Unsupported Basys3 pin alias'))).toBe(false);
  });

  // Regression: SW→LD direct (no logic gates) previously produced
  // architecture bodies with undeclared LED(0), causing Vivado synthesis failure.
  it('pass-through Switch→Lamp circuit: architecture uses only declared entity port names', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'sw0', type: 'Switch', position: { x: 0,   y: 0 }, config: {}, state: {} },
        { id: 'sw1', type: 'Switch', position: { x: 0,   y: 80 }, config: {}, state: {} },
        { id: 'ld0', type: 'Lamp',   position: { x: 200, y: 0 }, config: {}, state: {} },
        { id: 'ld1', type: 'Lamp',   position: { x: 200, y: 80 }, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
        { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'ld1', portName: 'in' } },
      ],
    };

    const mapping: IoMapping = {
      inputs: [
        { id: 'i1', nodeId: 'sw0', port: 'out', pin: 'SW0' },
        { id: 'i2', nodeId: 'sw1', port: 'out', pin: 'SW1' },
      ],
      outputs: [
        { id: 'o1', nodeId: 'ld0', port: 'in', pin: 'LD0' },
        { id: 'o2', nodeId: 'ld1', port: 'in', pin: 'LD1' },
      ],
    };

    const result = exportBasys3Bundle(circuit, mapping);

    expect(result.valid).toBe(true);

    // With IO nodes present, buildPortGroups produces SW/LED vector ports (swaggy.zip standard)
    expect(result.topVhd).toContain('SW : in  STD_LOGIC_VECTOR(1 downto 0)');
    expect(result.topVhd).toContain('LED : out STD_LOGIC_VECTOR(1 downto 0)');

    // Architecture body assigns LED(N) <= SW(N) — all references are to declared ports
    expect(result.topVhd).toContain('LED(0) <= SW(0)');
    expect(result.topVhd).toContain('LED(1) <= SW(1)');

    // XDC must use vector bit notation matching the entity port names
    expect(result.topXdc).toContain('[get_ports {SW[0]}]');
    expect(result.topXdc).toContain('[get_ports {SW[1]}]');
    expect(result.topXdc).toContain('[get_ports {LED[0]}]');
    expect(result.topXdc).toContain('[get_ports {LED[1]}]');

    // XDC must contain physical pin assignments for both switches and LEDs
    expect(result.topXdc).toContain('PACKAGE_PIN V17'); // SW0
    expect(result.topXdc).toContain('PACKAGE_PIN V16'); // SW1
    expect(result.topXdc).toContain('PACKAGE_PIN U16'); // LD0
    expect(result.topXdc).toContain('PACKAGE_PIN E19'); // LD1

    // VHDL entity ports and XDC get_ports must match (parity check — vector-aware)
    const xdcPorts = extractXdcPorts(result.topXdc);
    const vhdlPorts = extractVhdlPorts(result.topVhd);
    xdcPorts.forEach((portRef) => {
      expect(vhdlPorts).toContain(xdcPortToEntityBase(portRef));
    });
  });
});
