import { describe, expect, it } from 'vitest';
import type { VerifyScheduleContract } from '../../../fpga/boards/basys3/verifySchedule';
import { deriveTimingGuidance, formatTimingProtocol } from '../timingGuidance';

function makeSequentialContract(
  nodeType: 'DLatch' | 'DFlipFlop',
  signalName: string
): VerifyScheduleContract {
  return {
    schedule: 'clocked_macro',
    reason: 'circuit-sequential',
    analysis: {
      hasClockedMacros: true,
      hasClockNet: true,
      sequentialNodes: [{ id: 'u0', type: nodeType, clockPort: nodeType === 'DLatch' ? 'EN' : 'CLK' }],
      clockSource: 'circuit',
      clockNetName: signalName,
    },
    needsSimClockInjection: false,
    clockSignalName: signalName,
    samplePoint: 'post-rising-edge',
    tick0Meaning: 'initial-state',
    hasUnsupportedTemporal: false,
    temporalIssues: [],
  };
}

describe('timing guidance', () => {
  it('classifies pure DLatch schedules as latch-control guidance', () => {
    const guidance = deriveTimingGuidance(makeSequentialContract('DLatch', 'EN'));

    expect(guidance.kind).toBe('latch-control');
    expect(guidance.signalLabelSingular).toBe('Latch control');
    expect(guidance.signalName).toBe('EN');
  });

  it('keeps flip-flop schedules on clock guidance', () => {
    const guidance = deriveTimingGuidance(makeSequentialContract('DFlipFlop', 'CLK'));

    expect(guidance.kind).toBe('clock');
    expect(guidance.signalLabelSingular).toBe('Clock');
    expect(guidance.signalName).toBe('CLK');
  });

  it('describes Auto and authored clock execution without inventing one protocol', () => {
    const guidance = deriveTimingGuidance(makeSequentialContract('DFlipFlop', 'CLK'));
    const commonPolicy = {
      signalId: 'clk',
      signalLabel: 'CLK',
      sourceType: 'manual' as const,
      executionModel: 'manual' as const,
      autoRunEnabled: false,
      activeEdge: 'rising' as const,
      startLevel: 0 as const,
      dutyCycle: 0.5,
      runCycles: 2,
      resetBehavior: 'none' as const,
    };

    expect(
      formatTimingProtocol(guidance, {
        ...commonPolicy,
        sourceType: 'board-clock',
        executionModel: 'external-input-auto-toggle',
        overrideMode: 'auto',
        autoRunEnabled: true,
      })
    ).toContain('one rising edge and post-edge sample per case');
    expect(
      formatTimingProtocol(guidance, {
        ...commonPolicy,
        overrideMode: 'manual-pulses',
      })
    ).toContain('follows each authored row level');
  });
});
