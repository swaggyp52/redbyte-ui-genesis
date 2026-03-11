import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import { runDeterministicVerifyFromCircuit } from '../sim/simEngine';
import type { SimulationIoRow } from '../sim/simTypes';

function buildPassthroughCircuit(): Circuit {
  return {
    nodes: [
      {
        id: 'sw0_node',
        type: 'INPUT',
        label: 'sw0',
        x: 0,
        y: 0,
        config: {},
        state: {},
      },
      {
        id: 'ld0_node',
        type: 'OUTPUT',
        label: 'ld0',
        x: 160,
        y: 0,
        config: {},
        state: {},
      },
    ],
    connections: [
      {
        from: { nodeId: 'sw0_node', portName: 'out' },
        to: { nodeId: 'ld0_node', portName: 'in' },
      },
    ],
  };
}

describe('simEngine verify diagnostics', () => {
  it('evaluates repeated-tick combinational vectors as distinct cases', () => {
    const ioRows: SimulationIoRow[] = [
      { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
      { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_node' },
    ];
    const result = runDeterministicVerifyFromCircuit(buildPassthroughCircuit(), ioRows, [
      { tick: 0, inputs: { sw0: 0 }, expected: { ld0: 0 } },
      { tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ]);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((row) => row.expected === row.actual)).toBe(true);
    expect(result.rows[0]?.vectorId).not.toBe(result.rows[1]?.vectorId);
    expect(result.evidence.preflight).toEqual([]);
    expect(result.evidence.failures).toEqual([]);
  });

  it('turns unmatched expected outputs into explicit preflight issues', () => {
    const ioRows: SimulationIoRow[] = [
      { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
    ];
    const result = runDeterministicVerifyFromCircuit(buildPassthroughCircuit(), ioRows, [
      { tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ]);

    expect(result.rows).toEqual([]);
    expect(result.evidence.preflight).toHaveLength(1);
    expect(result.evidence.preflight[0]?.kind).toBe('missing-output-row');
    expect(result.evidence.preflight[0]?.message).toContain('does not match any mapped output row');
  });

  it('reports unmapped output nodes instead of defaulting actual to zero', () => {
    const ioRows: SimulationIoRow[] = [
      { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
      { id: 'ld0', label: 'LD0', direction: 'out', nodeId: '' },
    ];
    const result = runDeterministicVerifyFromCircuit(buildPassthroughCircuit(), ioRows, [
      { tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } },
    ]);

    expect(result.rows).toEqual([]);
    expect(result.evidence.preflight).toHaveLength(1);
    expect(result.evidence.preflight[0]?.kind).toBe('missing-output-node');
    expect(result.evidence.preflight[0]?.message).toContain('not mapped to a concrete design node');
  });
});
