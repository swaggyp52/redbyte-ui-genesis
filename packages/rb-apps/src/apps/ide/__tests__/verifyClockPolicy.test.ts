import { describe, expect, it } from 'vitest';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import {
  detectVerifyClockPolicy,
  materializeVectorsForClockPolicy,
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
      resetBehavior: 'auto-sequence',
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
    expect(vectors.map((vector) => vector.inputs.clk)).toEqual([0, 1, 0, 1]);
    expect(vectors.map((vector) => vector.inputs.en)).toEqual([1, 1, 1, 1]);
    expect(vectors.map((vector) => vector.inputs.rst)).toEqual([1, 0, 0, 0]);
    expect(vectors[0]?.expected).toEqual({ q0: 0 });
    expect(vectors.slice(1).every((vector) => Object.keys(vector.expected).length === 0)).toBe(true);
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
    expect(vectors.map((vector) => vector.inputs.clk)).toEqual([0, 1, 0, 1]);
    expect(vectors.map((vector) => vector.inputs.en)).toEqual([0, 0, 0, 0]);
    expect(vectors.map((vector) => vector.inputs.rst)).toEqual([1, 0, 0, 0]);
    expect(vectors.every((vector) => Object.keys(vector.expected).length === 0)).toBe(true);
  });
});
