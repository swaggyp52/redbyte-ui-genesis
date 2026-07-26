import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { createFromScratchSeqTwoBitCounterBasys3Project } from '../fixtures/fromScratchBasys3CertProjects';
import {
  runDeterministicVerifyFromModel,
  simulateExpectedIoRowsFromModel,
} from '../sim/simEngine';
import type { SimulationIoRow } from '../sim/simTypes';
import type { VerifyClockPolicy } from '../verifyClockPolicy';
import { buildDeterministicVerifyContext } from '../../../fpga/boards/basys3/verifySchedule';

const MANUAL_CLOCK_POLICY: VerifyClockPolicy = {
  signalId: 'clk',
  signalLabel: 'CLK100MHZ',
  sourceType: 'manual',
  executionModel: 'manual',
  overrideMode: 'manual-pulses',
  autoRunEnabled: false,
  activeEdge: 'rising',
  startLevel: 0,
  dutyCycle: 0.5,
  runCycles: 8,
  frequencyMHz: 100,
  periodNs: 10,
  boardAlias: 'CLK100MHZ',
  packagePin: 'W5',
  resetSignalName: 'BTNC',
  resetBehavior: 'custom',
};

function buildCounterIoRows(): SimulationIoRow[] {
  const project = createFromScratchSeqTwoBitCounterBasys3Project();
  return [
    ...(project.ioMapping?.inputs ?? []).map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      direction: 'in' as const,
      nodeId: row.nodeId,
    })),
    ...(project.ioMapping?.outputs ?? []).map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      direction: 'out' as const,
      nodeId: row.nodeId,
    })),
  ];
}

function observeCounter(
  vectors: TestVector[],
  policy: VerifyClockPolicy = MANUAL_CLOCK_POLICY
) {
  const project = createFromScratchSeqTwoBitCounterBasys3Project();
  const ioRows = buildCounterIoRows();
  const context = buildDeterministicVerifyContext(project.circuit, project.ioMapping);
  return {
    ioRows,
    context,
    result: runDeterministicVerifyFromModel(
      project.circuit,
      context.simModel,
      ioRows,
      vectors,
      context.schedule,
      policy
    ),
  };
}

function actualSequence(
  rows: ReturnType<typeof runDeterministicVerifyFromModel>['rows'],
  ticks: readonly number[]
) {
  return ticks.map((tick) => ({
    tick,
    q0: rows.find((row) => row.tick === tick && row.signal === 'ld0')?.actual,
    q1: rows.find((row) => row.tick === tick && row.signal === 'ld1')?.actual,
  }));
}

describe('manual sequential clock authority', () => {
  it('keeps a counter at its initial state while the authored clock stays flat-low', () => {
    const vectors: TestVector[] = [0, 1, 2, 3].map((tick) => ({
      tick,
      inputs: { clk: 0, en: 1, rst: 0 },
      expected: { q0: 0, q1: 0 },
    }));

    const { result } = observeCounter(vectors);

    expect(result.evidence.preflight).toEqual([]);
    expect(result.evidence.failures).toEqual([]);
    expect(actualSequence(result.rows, [0, 1, 2, 3])).toEqual([
      { tick: 0, q0: '0', q1: '0' },
      { tick: 1, q0: '0', q1: '0' },
      { tick: 2, q0: '0', q1: '0' },
      { tick: 3, q0: '0', q1: '0' },
    ]);
    expect(result.trace.map((sample) => sample.signals['clk_node.out'])).toEqual([0, 0, 0, 0]);
  });

  it('advances only on authored rising edges and holds across high, falling, and low rows', () => {
    const vectors: TestVector[] = [
      { tick: 0, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 1, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 2, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 3, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 4, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 5, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 0, q1: 1 } },
    ];

    const { result, ioRows, context } = observeCounter(vectors);
    const project = createFromScratchSeqTwoBitCounterBasys3Project();
    const expectedRows = simulateExpectedIoRowsFromModel({
      executionCircuit: project.circuit,
      model: context.simModel,
      ioRows,
      vectors,
      scheduleContract: context.schedule,
      clockPolicy: MANUAL_CLOCK_POLICY,
    });

    expect(result.evidence.failures).toEqual([]);
    expect(actualSequence(result.rows, [0, 1, 2, 3, 4, 5])).toEqual([
      { tick: 0, q0: '0', q1: '0' },
      { tick: 1, q0: '1', q1: '0' },
      { tick: 2, q0: '1', q1: '0' },
      { tick: 3, q0: '1', q1: '0' },
      { tick: 4, q0: '1', q1: '0' },
      { tick: 5, q0: '0', q1: '1' },
    ]);
    expect(result.trace.map((sample) => sample.signals['clk_node.out'])).toEqual([0, 1, 1, 0, 0, 1]);
    expect(expectedRows).toEqual(
      result.rows.map((row) => ({ tick: row.tick, signal: row.signal, expected: row.actual }))
    );
  });

  it.each([
    { label: 'custom reset policy', resetBehavior: 'custom' as const, persistedReset: 0 as const },
    { label: 'contradictory auto-reset policy', resetBehavior: 'auto-sequence' as const, persistedReset: 0 as const },
    { label: 'persisted-high reset input', resetBehavior: 'custom' as const, persistedReset: 1 as const },
  ])('does not inject hidden reset activity for $label', ({ resetBehavior, persistedReset }) => {
    const circuit: Circuit = {
      nodes: [
        { id: 'clk_node', type: 'INPUT', label: 'CLK', x: 0, y: 0, config: {}, state: { isOn: 0 } },
        { id: 'd_node', type: 'INPUT', label: 'D', x: 0, y: 80, config: {}, state: { isOn: 0 } },
        { id: 'en_node', type: 'INPUT', label: 'EN', x: 0, y: 160, config: {}, state: { isOn: 0 } },
        { id: 'rst_node', type: 'INPUT', label: 'RST', x: 0, y: 240, config: {}, state: { isOn: persistedReset } },
        { id: 'ff_node', type: 'DFlipFlop', label: 'Q', x: 180, y: 80, config: {}, state: { q: 1, lastClk: 0 } },
        { id: 'q_node', type: 'OUTPUT', label: 'Q', x: 360, y: 80, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'CLK' } },
        { from: { nodeId: 'd_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'D' } },
        { from: { nodeId: 'en_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'EN' } },
        { from: { nodeId: 'rst_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'RST' } },
        { from: { nodeId: 'ff_node', portName: 'Q' }, to: { nodeId: 'q_node', portName: 'in' } },
      ],
    };
    const ioRows: SimulationIoRow[] = [
      { id: 'clk', label: 'CLK', direction: 'in', nodeId: 'clk_node' },
      { id: 'd', label: 'D', direction: 'in', nodeId: 'd_node' },
      { id: 'en', label: 'EN', direction: 'in', nodeId: 'en_node' },
      { id: 'rst', label: 'RST', direction: 'in', nodeId: 'rst_node' },
      { id: 'q', label: 'Q', direction: 'out', nodeId: 'q_node' },
    ];
    const context = buildDeterministicVerifyContext(circuit, {
      inputs: ioRows.filter((row) => row.direction === 'in').map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? row.id,
        label: row.label,
        port: 'out' as const,
      })),
      outputs: ioRows.filter((row) => row.direction === 'out').map((row) => ({
        id: row.id,
        nodeId: row.nodeId ?? row.id,
        label: row.label,
        port: 'in' as const,
      })),
    });
    const result = runDeterministicVerifyFromModel(
      circuit,
      context.simModel,
      ioRows,
      [{ tick: 0, inputs: { clk: 0, d: 0, en: 0, rst: 0 }, expected: { q: 0 } }],
      context.schedule,
      {
        ...MANUAL_CLOCK_POLICY,
        signalId: 'clk',
        signalLabel: 'CLK',
        resetSignalName: 'RST',
        resetBehavior,
      }
    );

    expect(result.evidence.failures).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({ tick: 0, signal: 'q', expected: '0', actual: '0' }),
    ]);
  });

  it('uses a high start level without inventing a first-row rising edge', () => {
    const vectors: TestVector[] = [
      { tick: 0, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 1, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 2, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
    ];

    const { result } = observeCounter(vectors, {
      ...MANUAL_CLOCK_POLICY,
      startLevel: 1,
    });

    expect(result.evidence.failures).toEqual([]);
    expect(actualSequence(result.rows, [0, 1, 2])).toEqual([
      { tick: 0, q0: '0', q1: '0' },
      { tick: 1, q0: '0', q1: '0' },
      { tick: 2, q0: '1', q1: '0' },
    ]);
  });
});
