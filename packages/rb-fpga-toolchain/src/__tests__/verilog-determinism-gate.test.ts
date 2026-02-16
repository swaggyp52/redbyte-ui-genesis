import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { CircuitV1, IoMapping } from '@redbyte/rb-utils';
import { circuitToVerilog } from '../verilog-generator';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const fixtureCircuit: CircuitV1 = {
  schemaVersion: '1.0',
  nodes: [
    { id: 'and_b', type: 'AND', x: 120, y: 40, params: {}, state: {} },
    { id: 'and_a', type: 'AND', x: 20, y: 40, params: {}, state: {} },
  ],
  connections: [
    { id: 'c2', fromNodeId: 'and_b', fromPin: 'out', toNodeId: 'and_a', toPin: 'in2' },
    { id: 'c1', fromNodeId: 'and_a', fromPin: 'out', toNodeId: 'and_b', toPin: 'in1' },
  ],
  customChips: [],
};

const fixtureMapping: IoMapping = {
  inputs: [
    { id: 'in-2', nodeId: 'and_b', port: 'in2', pin: 'SW1' },
    { id: 'in-1', nodeId: 'and_a', port: 'in1', pin: 'SW0' },
  ],
  outputs: [{ id: 'out-1', nodeId: 'and_a', port: 'out', pin: 'LD0' }],
};

describe('RC D1 verilog determinism gate', () => {
  it('produces byte-identical Verilog output across repeated calls', () => {
    const run1 = circuitToVerilog(fixtureCircuit, fixtureMapping, { moduleName: 'top' });
    const run2 = circuitToVerilog(fixtureCircuit, fixtureMapping, { moduleName: 'top' });
    expect(run2.verilog).toBe(run1.verilog);
    expect(run2.inputs).toEqual(run1.inputs);
    expect(run2.outputs).toEqual(run1.outputs);
  });

  it('maintains stable module/port/wire/instance ordering and golden hash', () => {
    const out = circuitToVerilog(fixtureCircuit, fixtureMapping, { moduleName: 'top' });

    expect(out.verilog).toContain('// Deterministic export');
    expect(out.verilog).not.toContain('Timestamp:');
    expect(out.verilog).toContain('module top (\n  input wire and_a_in1,\n  input wire and_b_in2,\n  output wire and_a_out\n);');
    expect(out.verilog.indexOf('RB_AND inst_and_a')).toBeLessThan(out.verilog.indexOf('RB_AND inst_and_b'));

    const expectedHash = 'bfbb47e0e63972e1ec935225c4dd477cf91a65a1a2d7e89803a602dfb5741654';
    expect(sha256(out.verilog)).toBe(expectedHash);
  });
});
