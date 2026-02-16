import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping } from '@redbyte/rb-utils';
import { exportBasys3Bundle } from '../fpga/boards/basys3/basys3Bundle';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
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
  it('produces valid deterministic top.v/top.xdc/readme with top module', () => {
    const run1 = exportBasys3Bundle(validCircuit, validMapping);
    const run2 = exportBasys3Bundle(validCircuit, validMapping);

    expect(run1.valid).toBe(true);
    expect(run1.topV).toContain('module top (');
    expect(run1.topXdc).toContain('PACKAGE_PIN V17');
    expect(run1.topXdc).toContain('PACKAGE_PIN V16');
    expect(run1.topXdc).toContain('PACKAGE_PIN U16');
    expect(run1.topXdc).not.toContain('PACKAGE_PIN W16');
    expect(run1.readme).toContain('| g1_in1 | SW0 | V17 | input |');
    expect(run1.readme).toContain('| g1_out | LD0 | U16 | output |');

    expect(run2.topV).toBe(run1.topV);
    expect(run2.topXdc).toBe(run1.topXdc);
    expect(run2.readme).toBe(run1.readme);

    const bundleHash1 = sha256(`${run1.topV}\n---\n${run1.topXdc}\n---\n${run1.readme}`);
    const bundleHash2 = sha256(`${run2.topV}\n---\n${run2.topXdc}\n---\n${run2.readme}`);
    expect(bundleHash2).toBe(bundleHash1);
  });

  it('returns invalid bundle with crisp warnings for unsupported nodes', () => {
    const unsupportedCircuit: Circuit = {
      nodes: [{ id: 'sw1', type: 'Switch', position: { x: 0, y: 0 }, config: {}, state: {} }],
      connections: [],
    };

    const result = exportBasys3Bundle(unsupportedCircuit, {
      inputs: [],
      outputs: [{ id: 'o1', nodeId: 'sw1', port: 'out', pin: 'LD0' }],
    });

    expect(result.valid).toBe(false);
    expect(result.warnings.some((warning) => warning.includes('Unsupported node: sw1 (Switch)'))).toBe(true);
  });
});
