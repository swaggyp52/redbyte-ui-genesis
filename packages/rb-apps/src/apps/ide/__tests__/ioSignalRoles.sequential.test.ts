import { describe, expect, it } from 'vitest';
import { deriveIoSignalRoles } from '../ioSignalRoles';

describe('deriveIoSignalRoles sequential authority', () => {
  it('keeps an authored reset a reset when stale hardware metadata says clock', () => {
    const roles = deriveIoSignalRoles(
      [
        {
          id: 'reset',
          label: 'RESET',
          direction: 'in',
          boardResourceType: 'clock_pin',
        },
      ],
      {
        schedule: 'clocked_macro',
        timingMode: 'synchronous_board_clock',
        reason: 'circuit-sequential',
        analysis: {
          hasClockedMacros: true,
          hasClockNet: true,
          sequentialNodes: [],
          clockSource: 'ioMapping',
          clockNetName: 'CLK',
        },
        needsSimClockInjection: false,
        clockSignalName: 'CLK',
        samplePoint: 'post-rising-edge',
        tick0Meaning: 'initial-state',
        resetHint: { signalName: 'RESET', activeLevel: 1 },
        hasUnsupportedTemporal: false,
        temporalIssues: [],
      }
    );

    expect(roles.RESET).toBe('reset');
  });
});
