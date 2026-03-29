import { describe, expect, it } from 'vitest';
import type { VerifyScheduleContract } from '../../../fpga/boards/basys3/verifySchedule';
import { deriveTimingGuidance } from '../timingGuidance';

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
});
