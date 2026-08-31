import { describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import {
  detectVerifyClockPolicy,
  materializeVectorsForClockPolicy,
  resolveEffectiveVerifyClockPolicy,
  type VerifyClockPolicy,
} from '../verifyClockPolicy';

function makeClockedContract(
  overrides: Partial<VerifyScheduleContract> = {}
): VerifyScheduleContract {
  return {
    schedule: 'clocked_macro',
    timingMode: 'synchronous_board_clock',
    reason: 'circuit-sequential',
    analysis: {
      hasClockedMacros: true,
      hasClockNet: true,
      sequentialNodes: [{ id: 'ff0', type: 'DFlipFlop', clockPort: 'CLK' }],
      clockSource: 'ioMapping',
      clockNetName: 'CLK100MHZ',
    },
    needsSimClockInjection: false,
    clockSignalName: 'CLK100MHZ',
    samplePoint: 'post-rising-edge',
    tick0Meaning: 'initial-state',
    resetHint: {
      signalName: 'rst',
      activeLevel: 1,
    },
    hasUnsupportedTemporal: false,
    temporalIssues: [],
    ...overrides,
  };
}

describe('verifyClockPolicy', () => {
  it('detects Basys3 CLK100MHZ/W5 as an auto-running board clock', () => {
    const policy = detectVerifyClockPolicy({
      ioRows: [
        { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5' },
        { id: 'sw0', label: 'SW0', direction: 'in', pin: 'V17' },
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
      scheduleContract: makeClockedContract(),
    });

    expect(policy).toMatchObject({
      signalId: 'clk',
      signalLabel: 'CLK100MHZ',
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      overrideMode: 'auto',
      autoRunEnabled: true,
      activeEdge: 'rising',
      frequencyMHz: 100,
      periodNs: 10,
      boardAlias: 'CLK100MHZ',
      packagePin: 'W5',
      resetBehavior: 'none',
    });
  });

  it('keeps manual switch-driven clocks in manual pulse mode', () => {
    const policy = detectVerifyClockPolicy({
      ioRows: [
        {
          id: 'enter',
          label: 'ENTER (SW5)',
          direction: 'in',
          pin: 'SW5',
          timingRole: 'manual_step',
        },
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
      scheduleContract: makeClockedContract({
        timingMode: 'manual_event_driven_lab',
        needsSimClockInjection: true,
        clockSignalName: 'ENTER (SW5)',
      }),
    });

    expect(policy).toMatchObject({
      signalId: 'enter',
      sourceType: 'manual',
      executionModel: 'manual',
      overrideMode: 'manual-pulses',
      autoRunEnabled: false,
      resetBehavior: 'custom',
    });
    expect(policy?.manualWarning).toContain('Manual clock source');
  });

  it('does not promote an unassigned explicit switch clock to the W5 oscillator', () => {
    const policy = detectVerifyClockPolicy({
      ioRows: [
        {
          id: 'enter',
          label: 'ENTER (SW5)',
          direction: 'in',
          pin: '',
          timingRole: 'clock',
          boardResourceType: 'switch',
        },
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
      scheduleContract: makeClockedContract({
        timingMode: 'manual_event_driven_lab',
        needsSimClockInjection: true,
        clockSignalName: 'ENTER (SW5)',
      }),
    });

    expect(policy).toMatchObject({
      signalId: 'enter',
      sourceType: 'manual',
      executionModel: 'manual',
      overrideMode: 'manual-pulses',
      autoRunEnabled: false,
    });
    expect(policy?.boardAlias).toBeUndefined();
    expect(policy?.frequencyMHz).toBeUndefined();
  });

  it('keeps inferred non-board clock rows in manual pulse mode', () => {
    const policy = detectVerifyClockPolicy({
      ioRows: [
        {
          id: 'enter',
          label: 'ENTER (SW5)',
          direction: 'in',
          pin: 'SW5',
        },
        { id: 'ld0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
      scheduleContract: makeClockedContract({
        timingMode: 'synchronous_board_clock',
        needsSimClockInjection: false,
        clockSignalName: 'ENTER (SW5)',
      }),
    });

    expect(policy).toMatchObject({
      signalId: 'enter',
      sourceType: 'manual',
      executionModel: 'manual',
      overrideMode: 'manual-pulses',
      autoRunEnabled: false,
      resetBehavior: 'none',
    });
    expect(policy?.manualWarning).toContain('Manual clock source');
  });

  it('does not promote an imported sim-only Clock row to a Basys3 board clock', () => {
    const circuit = {
      nodes: [
        {
          id: 'clk_node',
          type: 'Clock',
          label: 'CLK',
          position: { x: 0, y: 0 },
          rotation: 0,
          config: { role: 'sim', period: 2 },
          state: {},
        },
      ],
    } satisfies Pick<Circuit, 'nodes'>;
    const ioRows = [
      {
        id: 'clk',
        label: 'CLK100MHZ',
        nodeId: 'clk_node',
        direction: 'in' as const,
        pin: 'W5',
      },
      { id: 'd', label: 'D', nodeId: 'd_node', direction: 'in' as const, pin: 'SW0' },
      { id: 'q', label: 'Q', nodeId: 'q_node', direction: 'out' as const, pin: 'LD0' },
    ];

    const policy = detectVerifyClockPolicy({
      circuit,
      ioRows,
      scheduleContract: makeClockedContract({
        clockSignalName: 'CLK',
        resetHint: undefined,
      }),
    });

    expect(policy).toMatchObject({
      signalId: 'CLK',
      signalLabel: 'CLK',
      sourceType: 'explicit-clock-component',
      executionModel: 'component-oscillator',
      overrideMode: 'manual-pulses',
      autoRunEnabled: false,
      periodTicks: 2,
      resetBehavior: 'none',
    });
    expect(policy?.boardAlias).toBeUndefined();
    expect(policy?.packagePin).toBeUndefined();
    expect(policy?.manualWarning).toContain('Sim Clock components are import-only');

    const vectors = materializeVectorsForClockPolicy({
      vectors: [{ tick: 0, inputs: { d: 1 }, expected: { q: 0 } }],
      ioRows,
      policy,
    });

    expect(vectors).toHaveLength(1);
    expect(vectors[0]?.inputs).toEqual({ d: 1 });
  });

  it('materializes auto board-clock cycles without requiring authored clock pulses', () => {
    const policy: VerifyClockPolicy = {
      signalId: 'clk',
      signalLabel: 'CLK100MHZ',
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      overrideMode: 'auto',
      autoRunEnabled: true,
      activeEdge: 'rising',
      startLevel: 0,
      dutyCycle: 0.5,
      runCycles: 4,
      frequencyMHz: 100,
      periodNs: 10,
      boardAlias: 'CLK100MHZ',
      packagePin: 'W5',
      resetSignalName: 'rst',
      resetBehavior: 'auto-sequence',
    };

    const vectors = materializeVectorsForClockPolicy({
      vectors: [{ tick: 0, inputs: { en: 1 }, expected: { q0: 0 } }],
      ioRows: [
        { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5' },
        { id: 'en', label: 'SW0', direction: 'in', pin: 'V17' },
        { id: 'rst', label: 'BTNC', direction: 'in', pin: 'U18' },
        { id: 'q0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
      policy,
    });

    expect(vectors).toHaveLength(4);
    expect(vectors.map((vector) => vector.inputs.clk)).toEqual([1, 1, 1, 1]);
    expect(vectors.map((vector) => vector.inputs.en)).toEqual([1, 1, 1, 1]);
    expect(vectors.map((vector) => vector.inputs.rst)).toEqual([1, 0, 0, 0]);
    expect(vectors[0]?.expected).toEqual({ q0: 0 });
    expect(vectors.slice(1).every((vector) => Object.keys(vector.expected).length === 0)).toBe(true);
  });

  it('orders authored manual vectors by tick while preserving original order within a tick', () => {
    const vectors = materializeVectorsForClockPolicy({
      vectors: [
        { id: 'late', tick: 4, inputs: { clk: 0 }, expected: {} },
        { id: 'same-tick-first', tick: 1, inputs: { clk: 0 }, expected: {} },
        { id: 'same-tick-second', tick: 1, inputs: { clk: 1 }, expected: {} },
      ],
      ioRows: [{ id: 'clk', label: 'CLK', direction: 'in' }],
      policy: {
        signalId: 'clk',
        signalLabel: 'CLK',
        sourceType: 'manual',
        executionModel: 'manual',
        overrideMode: 'manual-pulses',
        autoRunEnabled: false,
        activeEdge: 'rising',
        startLevel: 0,
        dutyCycle: 0.5,
        runCycles: 3,
        resetBehavior: 'none',
      },
    });

    expect(vectors.map((vector) => vector.id)).toEqual([
      'same-tick-first',
      'same-tick-second',
      'late',
    ]);
  });

  it('overrides authored reset values with the authoritative Auto reset sequence', () => {
    const policy: VerifyClockPolicy = {
      signalId: 'clk',
      signalLabel: 'CLK100MHZ',
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      overrideMode: 'auto',
      autoRunEnabled: true,
      activeEdge: 'rising',
      startLevel: 0,
      dutyCycle: 0.5,
      runCycles: 2,
      resetSignalName: 'BTNC',
      resetBehavior: 'auto-sequence',
    };

    const vectors = materializeVectorsForClockPolicy({
      vectors: [
        { tick: 0, inputs: { rst_node: 0 }, expected: {} },
        { tick: 1, inputs: { rst_node: 1 }, expected: {} },
      ],
      ioRows: [
        { id: 'clk', label: 'CLK100MHZ', direction: 'in' },
        { id: 'rst', label: 'BTNC', nodeId: 'rst_node', direction: 'in' },
      ],
      policy,
    });

    expect(vectors.map((vector) => vector.inputs.rst)).toEqual([1, 0]);
    expect(vectors.every((vector) => !('rst_node' in vector.inputs))).toBe(true);
  });

  it('canonicalizes authored node-id inputs without leaving row-id defaults that override them', () => {
    const policy: VerifyClockPolicy = {
      signalId: 'clk',
      signalLabel: 'CLK100MHZ',
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      overrideMode: 'auto',
      autoRunEnabled: true,
      activeEdge: 'rising',
      startLevel: 0,
      dutyCycle: 0.5,
      runCycles: 3,
      frequencyMHz: 100,
      periodNs: 10,
      boardAlias: 'CLK100MHZ',
      packagePin: 'W5',
      resetSignalName: 'BTNC',
      resetBehavior: 'auto-sequence',
    };

    const vectors = materializeVectorsForClockPolicy({
      vectors: [
        { tick: 0, inputs: { clk_node: 0, en_node: 1, rst_node: 0 }, expected: { q0_out: 1 } },
      ],
      ioRows: [
        { id: 'clk', label: 'CLK100MHZ', nodeId: 'clk_node', direction: 'in', pin: 'W5' },
        { id: 'en', label: 'SW0', nodeId: 'en_node', direction: 'in', pin: 'V17' },
        { id: 'rst', label: 'BTNC', nodeId: 'rst_node', direction: 'in', pin: 'U18' },
        { id: 'q0', label: 'LD0', nodeId: 'q0_out', direction: 'out', pin: 'U16' },
      ],
      policy,
    });

    expect(vectors[0]?.inputs).toMatchObject({ clk: 1, en: 1, rst: 1 });
    expect(vectors[0]?.inputs).not.toHaveProperty('clk_node');
    expect(vectors[0]?.inputs).not.toHaveProperty('en_node');
    expect(vectors[0]?.inputs).not.toHaveProperty('rst_node');
  });

  it('uses a reset-role IO row as the auto-clock reset fallback when structural reset detection is unavailable', () => {
    const policy = detectVerifyClockPolicy({
      ioRows: [
        { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5', timingRole: 'clock' },
        { id: 'rst', label: 'BTNC', direction: 'in', pin: 'U18', timingRole: 'reset' },
        { id: 'q0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
      scheduleContract: makeClockedContract({ resetHint: undefined }),
    });

    expect(policy).toMatchObject({
      resetSignalName: 'BTNC',
      resetBehavior: 'auto-sequence',
    });
  });

  it('rebinds a stale structural reset hint to the current live reset row', () => {
    const ioRows = [
      { id: 'detected_clk', label: 'CLK100MHZ', direction: 'in' as const, pin: 'W5', timingRole: 'clock' as const },
      { id: 'detected_reset', label: 'BTNC', direction: 'in' as const, pin: 'U18', timingRole: 'reset' as const },
      { id: 'q0', label: 'LD0', direction: 'out' as const, pin: 'U16' },
    ];
    const policy = detectVerifyClockPolicy({
      ioRows,
      scheduleContract: makeClockedContract({
        resetHint: { signalName: 'rst', activeLevel: 1 },
      }),
    });

    expect(policy).toMatchObject({
      signalId: 'detected_clk',
      resetSignalName: 'BTNC',
      resetBehavior: 'auto-sequence',
    });
    expect(
      materializeVectorsForClockPolicy({
        vectors: [{ tick: 0, inputs: {}, expected: { q0: 0 } }],
        ioRows,
        policy,
      })[0]?.inputs
    ).toMatchObject({ detected_clk: 1, detected_reset: 1 });
  });

  it('disables reset execution when no current live reset input row exists', () => {
    const policy = detectVerifyClockPolicy({
      ioRows: [
        { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5', timingRole: 'clock' },
        { id: 'q0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
      scheduleContract: makeClockedContract({
        resetHint: { signalName: 'retired_internal_reset', activeLevel: 1 },
      }),
    });

    expect(policy).toMatchObject({
      resetSignalName: undefined,
      resetBehavior: 'none',
    });
  });

  it('creates default auto board-clock cycles when no authored vectors exist yet', () => {
    const policy: VerifyClockPolicy = {
      signalId: 'clk',
      signalLabel: 'CLK100MHZ',
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      overrideMode: 'auto',
      autoRunEnabled: true,
      activeEdge: 'rising',
      startLevel: 0,
      dutyCycle: 0.5,
      runCycles: 4,
      frequencyMHz: 100,
      periodNs: 10,
      boardAlias: 'CLK100MHZ',
      packagePin: 'W5',
      resetSignalName: 'rst',
      resetBehavior: 'auto-sequence',
    };

    const vectors = materializeVectorsForClockPolicy({
      vectors: [],
      ioRows: [
        { id: 'clk', label: 'CLK100MHZ', direction: 'in', pin: 'W5' },
        { id: 'en', label: 'SW0', direction: 'in', pin: 'V17' },
        { id: 'rst', label: 'BTNC', direction: 'in', pin: 'U18' },
        { id: 'q0', label: 'LD0', direction: 'out', pin: 'U16' },
      ],
      policy,
    });

    expect(vectors).toHaveLength(4);
    expect(vectors.map((vector) => vector.inputs.clk)).toEqual([1, 1, 1, 1]);
    expect(vectors.map((vector) => vector.inputs.en)).toEqual([0, 0, 0, 0]);
    expect(vectors.map((vector) => vector.inputs.rst)).toEqual([1, 0, 0, 0]);
    expect(vectors.every((vector) => Object.keys(vector.expected).length === 0)).toBe(true);
  });

  it('rebinds saved Auto intent to the current live clock and reset identities', () => {
    const detected: VerifyClockPolicy = {
      signalId: 'clk',
      signalLabel: 'CLK100MHZ',
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      overrideMode: 'auto',
      autoRunEnabled: true,
      activeEdge: 'rising',
      startLevel: 0,
      dutyCycle: 0.5,
      runCycles: 8,
      resetSignalName: 'rst',
      resetBehavior: 'auto-sequence',
    };

    const resolved = resolveEffectiveVerifyClockPolicy({
      savedPolicy: {
        overrideMode: 'auto',
        runCycles: 12,
        activeEdge: 'rising',
        resetBehavior: 'custom',
        sourceType: 'inferred',
        executionModel: 'external-input-auto-toggle',
        signalId: 'retired_clk',
        signalLabel: 'Retired clock',
        resetSignalName: 'retired_reset',
        startLevel: 1,
      },
      detectedPolicy: detected,
      overrideMode: 'auto',
      requestedRunCycles: 12,
      totalVectorCount: 2,
    });

    expect(resolved).toMatchObject({
      overrideMode: 'auto',
      autoRunEnabled: true,
      sourceType: 'board-clock',
      executionModel: 'external-input-auto-toggle',
      signalId: 'clk',
      signalLabel: 'CLK100MHZ',
      resetSignalName: 'rst',
      resetBehavior: 'custom',
      startLevel: 1,
      runCycles: 12,
    });
  });

  it('falls back to authored clock mode when the live source cannot run Auto', () => {
    const resolved = resolveEffectiveVerifyClockPolicy({
      savedPolicy: {
        overrideMode: 'auto',
        runCycles: 12,
        activeEdge: 'rising',
        resetBehavior: 'auto-sequence',
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        signalId: 'old_clk',
        signalLabel: 'Old clock',
        startLevel: 0,
      },
      detectedPolicy: {
        signalId: 'step_clk',
        signalLabel: 'Step clock',
        sourceType: 'manual',
        executionModel: 'manual',
        overrideMode: 'manual-pulses',
        autoRunEnabled: false,
        activeEdge: 'rising',
        startLevel: 0,
        dutyCycle: 0.5,
        runCycles: 8,
        resetBehavior: 'none',
      },
      overrideMode: 'auto',
      requestedRunCycles: 12,
      totalVectorCount: 3,
    });

    expect(resolved).toMatchObject({
      overrideMode: 'manual-pulses',
      autoRunEnabled: false,
      executionModel: 'manual',
      signalId: 'step_clk',
      signalLabel: 'Step clock',
      runCycles: 3,
      resetBehavior: 'none',
    });
    expect(resolved?.manualWarning).toContain('Auto clock is unavailable');
  });
});
