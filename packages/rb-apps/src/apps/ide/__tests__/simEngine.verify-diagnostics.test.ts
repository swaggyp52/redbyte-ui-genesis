import { describe, expect, it } from 'vitest';
import {
  buildSimulationModel,
  elaborateCircuit,
  type Circuit,
} from '@redbyte/rb-logic-core';
import {
  resetSimulationStateFromModel,
  runDeterministicVerifyFromCircuit,
  runDeterministicVerifyFromModel,
} from '../sim/simEngine';
import type { SimulationIoRow } from '../sim/simTypes';
import type { VerifyScheduleContract } from '../../../fpga/boards/basys3/verifySchedule';

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
  it('keeps a valid SUM path runnable while a disconnected CARRY is reported as X', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT', label: 'A', x: 0, y: 0, config: {}, state: {} },
        { id: 'sum', type: 'OUTPUT', label: 'SUM', x: 200, y: 0, config: {}, state: {} },
        { id: 'carry', type: 'OUTPUT', label: 'CARRY', x: 200, y: 100, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'sum', portName: 'in' } },
      ],
    };
    const ioRows: SimulationIoRow[] = [
      { id: 'a', label: 'A', direction: 'in', nodeId: 'a' },
      { id: 'sum', label: 'SUM', direction: 'out', nodeId: 'sum' },
      { id: 'carry', label: 'CARRY', direction: 'out', nodeId: 'carry' },
    ];
    const model = buildSimulationModel(elaborateCircuit(circuit).ir);
    const result = runDeterministicVerifyFromModel(
      circuit,
      model,
      ioRows,
      [{ tick: 0, inputs: { a: 1 }, expected: { sum: 1, carry: 0 } }]
    );

    expect(model.isRunnable).toBe(true);
    expect(result.rows.find((row) => row.signal === 'sum')?.actual).toBe('1');
    expect(result.rows.find((row) => row.signal === 'carry')?.actual).toBe('X');
    expect(result.trace[0]?.signals['carry.in']).toBe('X');
    expect(result.trace[0]?.signals['sum.in']).toBe(1);
    expect(result.evidence.preflight).toEqual([
      expect.objectContaining({
        kind: 'floating-output',
        signal: 'carry',
        severity: 'warning',
        blocking: false,
      }),
    ]);
    expect(result.evidence.preflight[0]?.message).toContain('CARRY');
    expect(result.evidence.preflight[0]?.message).not.toContain('SUM');
  });

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

  it('uses clocked-macro cases as the waveform and sequential sampling authority', () => {
    const circuit: Circuit = {
      nodes: [
        {
          id: 'sw_d',
          type: 'INPUT',
          label: 'D',
          x: 0,
          y: 0,
          config: {},
          state: {},
        },
        {
          id: 'sw_clk',
          type: 'INPUT',
          label: 'CLK',
          x: 0,
          y: 90,
          config: {},
          state: {},
        },
        {
          id: 'ff_q',
          type: 'DFlipFlop',
          label: 'FF',
          x: 220,
          y: 40,
          config: {},
          state: {},
        },
        {
          id: 'out_q',
          type: 'OUTPUT',
          label: 'Q',
          x: 420,
          y: 40,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'sw_d', portName: 'out' },
          to: { nodeId: 'ff_q', portName: 'D' },
        },
        {
          from: { nodeId: 'sw_clk', portName: 'out' },
          to: { nodeId: 'ff_q', portName: 'CLK' },
        },
        {
          from: { nodeId: 'ff_q', portName: 'Q' },
          to: { nodeId: 'out_q', portName: 'in' },
        },
      ],
    };

    const ioRows: SimulationIoRow[] = [
      { id: 'sw_d', label: 'D', direction: 'in', nodeId: 'sw_d' },
      { id: 'sw_clk', label: 'CLK', direction: 'in', nodeId: 'sw_clk' },
      { id: 'out_q', label: 'Q', direction: 'out', nodeId: 'out_q' },
    ];

    const scheduleContract: VerifyScheduleContract = {
      schedule: 'clocked_macro',
      reason: 'circuit-sequential',
      analysis: {
        hasClockedMacros: true,
        hasClockNet: true,
        sequentialNodes: [{ id: 'ff_q', type: 'DFlipFlop', clockPort: 'CLK' }],
        clockSource: 'circuit',
        clockNetName: 'CLK',
      },
      needsSimClockInjection: false,
      clockSignalName: 'CLK',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      hasUnsupportedTemporal: false,
      temporalIssues: [],
    };

    const result = runDeterministicVerifyFromCircuit(
      circuit,
      ioRows,
      [
        { tick: 0, inputs: { D: 0, CLK: 0 }, expected: { Q: 0 } },
        { tick: 1, inputs: { D: 1, CLK: 1 }, expected: { Q: 1 } },
        { tick: 2, inputs: { D: 0, CLK: 0 }, expected: { Q: 0 } },
        { tick: 3, inputs: { D: 0, CLK: 1 }, expected: { Q: 0 } },
      ],
      scheduleContract
    );

    const clockValues = result.trace.map((sample) => {
      const clockEntry = Object.entries(sample.signals).find(([key]) =>
        key.toLowerCase().includes('clk')
      );
      expect(clockEntry).toBeTruthy();
      return clockEntry?.[1] ?? -1;
    });
    const qRows = result.rows
      .filter((row) => row.signal.toLowerCase() === 'q')
      .sort((left, right) => left.tick - right.tick);

    expect(result.evidence.preflight).toEqual([]);
    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((row) => row.expected === row.actual)).toBe(true);
    // Clocked-macro evidence is sampled at the declared post-rising-edge point.
    expect(clockValues).toEqual([1, 1, 1, 1]);
    expect(qRows.map((row) => row.actual)).toEqual(['0', '1', '0', '0']);
  });

  it('propagates unsupported temporal schedule issues into preflight errors', () => {
    const scheduleContract: VerifyScheduleContract = {
      schedule: 'clocked_macro',
      reason: 'hdl-sequential',
      analysis: {
        hasClockedMacros: true,
        hasClockNet: true,
        sequentialNodes: [{ id: 'ff_q', type: 'DFlipFlop', clockPort: 'CLK' }],
        clockSource: 'ioMapping',
        clockNetName: 'CLK100MHZ',
      },
      needsSimClockInjection: false,
      clockSignalName: 'CLK100MHZ',
      samplePoint: 'post-rising-edge',
      tick0Meaning: 'initial-state',
      hasUnsupportedTemporal: true,
      temporalIssues: [
        {
          code: 'unsupported-falling-edge',
          message: 'Unsupported temporal construct: falling_edge(clk).',
        },
      ],
    };

    const result = runDeterministicVerifyFromCircuit(
      buildPassthroughCircuit(),
      [
        { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
        { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_node' },
      ],
      [{ tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }],
      scheduleContract
    );

    expect(result.rows).toEqual([]);
    expect(result.evidence.preflight.some((issue) => issue.kind === 'unsupported-temporal')).toBe(true);
    expect(result.evidence.preflight[0]?.message).toContain('Unsupported temporal construct');
  });

  it('fails fast on invalid IR before deterministic verify execution', () => {
    const invalidSequentialCircuit: Circuit = {
      nodes: [
        {
          id: 'd_node',
          type: 'INPUT',
          label: 'D',
          x: 0,
          y: 0,
          config: {},
          state: {},
        },
        {
          id: 'ff_q',
          type: 'DFlipFlop',
          label: 'FF',
          x: 220,
          y: 40,
          config: {},
          state: {},
        },
        {
          id: 'out_q',
          type: 'OUTPUT',
          label: 'Q',
          x: 420,
          y: 40,
          config: {},
          state: {},
        },
      ],
      connections: [
        {
          from: { nodeId: 'd_node', portName: 'out' },
          to: { nodeId: 'ff_q', portName: 'D' },
        },
        {
          from: { nodeId: 'ff_q', portName: 'Q' },
          to: { nodeId: 'out_q', portName: 'in' },
        },
      ],
    };
    const ioRows: SimulationIoRow[] = [
      { id: 'd', label: 'D', direction: 'in', nodeId: 'd_node' },
      { id: 'q', label: 'Q', direction: 'out', nodeId: 'out_q' },
    ];
    const model = buildSimulationModel(elaborateCircuit(invalidSequentialCircuit).ir);

    const simResult = resetSimulationStateFromModel(
      invalidSequentialCircuit,
      model,
      ioRows
    );
    const verifyResult = runDeterministicVerifyFromModel(
      invalidSequentialCircuit,
      model,
      ioRows,
      [{ tick: 0, inputs: { d: 1 }, expected: { q: 1 } }]
    );

    expect(simResult.status).toBe('blocked');
    expect(
      simResult.status === 'blocked' &&
        simResult.diagnostics.some((diagnostic) => diagnostic.code === 'IR004')
    ).toBe(true);
    expect(verifyResult.rows).toEqual([]);
    expect(verifyResult.trace).toEqual([]);
    expect(verifyResult.evidence.preflight.some((issue) => issue.kind === 'invalid-ir')).toBe(true);
  });

  it('uses the SimulationModel for naming instead of execution-circuit labels', () => {
    const baseCircuit = buildPassthroughCircuit();
    const executionCircuit: Circuit = {
      ...baseCircuit,
      nodes: baseCircuit.nodes.map((node) =>
        node.id === 'sw0_node'
          ? { ...node, label: 'raw-runtime-label-in' }
          : node.id === 'ld0_node'
            ? { ...node, label: 'raw-runtime-label-out' }
            : { ...node }
      ),
    };
    const ioRows: SimulationIoRow[] = [
      { id: 'sw0', label: 'SW0', direction: 'in', nodeId: 'sw0_node' },
      { id: 'ld0', label: 'LD0', direction: 'out', nodeId: 'ld0_node' },
    ];
    const model = buildSimulationModel(elaborateCircuit(baseCircuit).ir);

    const result = runDeterministicVerifyFromModel(
      executionCircuit,
      model,
      ioRows,
      [{ tick: 0, inputs: { sw0: 1 }, expected: { ld0: 1 } }]
    );

    expect(result.evidence.preflight).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.signal).toBe('ld0');
    expect(result.rows[0]?.actual).toBe('1');
  });
});
