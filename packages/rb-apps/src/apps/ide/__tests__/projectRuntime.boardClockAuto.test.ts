// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import {
  createFromScratchCombSwitchAndBasys3Project,
  createFromScratchSeqTwoBitCounterBasys3Project,
} from '../fixtures/fromScratchBasys3CertProjects';
import { useProjectRuntime } from '../projectRuntime';

function buildBoardClockDffProject(): RBProject {
  const timestamp = '2026-05-02T12:00:00.000Z';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    name: 'Board Clock DFF',
    description: 'DFF fixture that relies on the Basys3 board clock.',
    circuit: {
      nodes: [
        { id: 'd_node', type: 'INPUT', label: 'D', x: 0, y: 0, config: {}, state: {} },
        { id: 'clk_node', type: 'INPUT', label: 'CLK100MHZ', x: 0, y: 120, config: {}, state: {} },
        { id: 'ff_node', type: 'DFlipFlop', label: 'FF0', x: 240, y: 60, config: {}, state: {} },
        { id: 'q_node', type: 'OUTPUT', label: 'Q', x: 420, y: 60, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'd_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'D' } },
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'CLK' } },
        { from: { nodeId: 'ff_node', portName: 'Q' }, to: { nodeId: 'q_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'd', nodeId: 'd_node', port: 'out', label: 'D', pin: 'SW0' },
        { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'CLK100MHZ', pin: 'CLK100MHZ' },
      ],
      outputs: [{ id: 'q', nodeId: 'q_node', port: 'in', label: 'Q', pin: 'LD0' }],
    },
    vectors: [],
    meta: {
      projectId: 'rb-board-clock-dff',
    },
  };
}

describe('projectRuntime board-clock auto verify', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectRuntime.getState().resetToActiveExample();
  });

  it('auto-runs a Basys3 board clock for DFF verification without authored clock pulses', () => {
    useProjectRuntime.getState().loadFromProject(buildBoardClockDffProject());
    useProjectRuntime.getState().setVectors([
      { tick: 0, inputs: { d: 1 }, expected: { q: 0 } },
      { tick: 1, inputs: { d: 1 }, expected: { q: 1 } },
      { tick: 2, inputs: { d: 0 }, expected: { q: 1 } },
      { tick: 3, inputs: { d: 0 }, expected: { q: 0 } },
    ]);

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'board-clock-dff',
      scenarioName: 'Board Clock DFF',
      deterministicHash: 'board-clock-dff-hash',
      rows: [],
      ranAtIso: '2026-05-02T12:10:00.000Z',
    });

    const qRows = run.report.rows
      .filter((row) => row.signal === 'q')
      .sort((left, right) => left.tick - right.tick);

    expect(run.status).toBe('pass');
    expect(run.clockPolicy).toMatchObject({
      sourceType: 'board-clock',
      overrideMode: 'auto',
      packagePin: 'W5',
      frequencyMHz: 100,
    });
    expect(run.report.vectors.slice(0, 4).map((vector) => vector.inputs.clk)).toEqual([0, 1, 0, 1]);
    expect(run.report.rows.every((row) => row.status === 'pass')).toBe(true);
    expect(qRows.map((row) => row.actual)).toEqual(['0', '1', '1', '0']);
  });

  it('advances the from-scratch 2-bit Basys3 counter with auto-generated board clock edges', () => {
    useProjectRuntime.getState().loadFromProject(createFromScratchSeqTwoBitCounterBasys3Project());
    useProjectRuntime.getState().setVectors([
      { tick: 0, inputs: { en: 0, rst: 1 }, expected: { q0: 0, q1: 0 } },
      { tick: 1, inputs: { en: 0, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 2, inputs: { en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 3, inputs: { en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 4, inputs: { en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
      { tick: 5, inputs: { en: 1, rst: 0 }, expected: { q0: 0, q1: 1 } },
      { tick: 6, inputs: { en: 1, rst: 0 }, expected: { q0: 0, q1: 1 } },
      { tick: 7, inputs: { en: 1, rst: 0 }, expected: { q0: 1, q1: 1 } },
    ]);

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'board-clock-counter',
      scenarioName: 'Board Clock Counter',
      deterministicHash: 'board-clock-counter-hash',
      rows: [],
      ranAtIso: '2026-05-02T12:20:00.000Z',
    });

    const perTickOutputs = new Map<number, Record<string, string>>();
    for (const row of run.report.rows) {
      const outputs = perTickOutputs.get(row.tick) ?? {};
      outputs[row.signal] = row.actual;
      perTickOutputs.set(row.tick, outputs);
    }

    expect(run.status).toBe('pass');
    expect(run.report.vectors.slice(0, 8).map((vector) => vector.inputs.clk)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    expect(perTickOutputs.get(3)).toEqual({ ld0: '1', ld1: '0' });
    expect(perTickOutputs.get(5)).toEqual({ ld0: '0', ld1: '1' });
    expect(perTickOutputs.get(7)).toEqual({ ld0: '1', ld1: '1' });
  });

  it('keeps combinational verify working without inventing a clock policy', () => {
    useProjectRuntime.getState().loadFromProject(createFromScratchCombSwitchAndBasys3Project());

    const run = useProjectRuntime.getState().runVerification({
      scenarioId: 'comb-no-clock',
      scenarioName: 'Comb No Clock',
      deterministicHash: 'comb-no-clock-hash',
      rows: [],
      ranAtIso: '2026-05-02T12:30:00.000Z',
    });

    expect(run.status).toBe('pass');
    expect(run.schedule).toBe('combinational');
    expect(run.clockPolicy).toBeUndefined();
    expect(run.report.rows.every((row) => row.status === 'pass')).toBe(true);
  });
});
