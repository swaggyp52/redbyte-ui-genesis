import { describe, expect, it } from 'vitest';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import { buildClockHelperVectors, resolveActiveScheduleContract } from '../clockAuthority';

function makeContract(
  overrides: Partial<VerifyScheduleContract> = {}
): VerifyScheduleContract {
  return {
    schedule: 'clocked_macro',
    reason: 'circuit-sequential',
    analysis: {
      hasClockedMacros: true,
      hasClockNet: true,
      sequentialNodes: [{ id: 'dff0', type: 'DFlipFlop', clockPort: 'CLK' }],
      clockSource: 'circuit',
      clockNetName: 'phase_driver',
    },
    needsSimClockInjection: false,
    clockSignalName: 'phase_driver',
    samplePoint: 'post-rising-edge',
    tick0Meaning: 'initial-state',
    hasUnsupportedTemporal: false,
    temporalIssues: [],
    ...overrides,
  };
}

describe('clockAuthority', () => {
  it('prefers the live contract when the last run is stale', () => {
    const staleRunContract = makeContract({ clockSignalName: 'old_clk' });
    const liveContract = makeContract({ clockSignalName: 'phase_driver' });

    expect(
      resolveActiveScheduleContract({
        deterministicHash: 'hash-live',
        liveScheduleContract: liveContract,
        lastRun: {
          deterministicHash: 'hash-old',
          scheduleContract: staleRunContract,
        },
      })
    ).toEqual(liveContract);
  });

  it('keeps the live contract authoritative even when the last run hash matches', () => {
    const verifyRunContract = makeContract({ clockSignalName: 'verify_clk' });
    const liveContract = makeContract({ clockSignalName: 'phase_driver' });

    expect(
      resolveActiveScheduleContract({
        deterministicHash: 'hash-live',
        liveScheduleContract: liveContract,
        lastRun: {
          deterministicHash: 'hash-live',
          scheduleContract: verifyRunContract,
        },
      })
    ).toEqual(liveContract);
  });

  it('does not let a poisoned matching run contract override live derivation', () => {
    const poisonedRunContract = makeContract({
      schedule: 'combinational',
      clockSignalName: 'poison_clk',
      needsSimClockInjection: true,
    });
    const liveContract = makeContract({ clockSignalName: 'phase_driver' });

    expect(
      resolveActiveScheduleContract({
        deterministicHash: 'same-design-hash',
        liveScheduleContract: liveContract,
        lastRun: {
          deterministicHash: 'same-design-hash',
          scheduleContract: poisonedRunContract,
        },
      })
    ).toEqual(liveContract);
  });

  it('uses the last run contract only when live derivation is unavailable', () => {
    const priorRunContract = makeContract({ clockSignalName: 'prior_clk' });

    expect(
      resolveActiveScheduleContract({
        deterministicHash: 'hash-live',
        liveScheduleContract: null,
        lastRun: {
          deterministicHash: 'hash-old',
          scheduleContract: priorRunContract,
        },
      })
    ).toEqual(priorRunContract);
  });

  it('falls back to the live contract when both hashes are empty', () => {
    const staleRunContract = makeContract({ clockSignalName: 'old_clk' });
    const liveContract = makeContract({ clockSignalName: 'phase_driver' });

    expect(
      resolveActiveScheduleContract({
        deterministicHash: '',
        liveScheduleContract: liveContract,
        lastRun: {
          deterministicHash: '',
          scheduleContract: staleRunContract,
        },
      })
    ).toEqual(liveContract);
  });

  it('builds alternating helper vectors from absolute tick parity instead of local offset parity', () => {
    const vectors = buildClockHelperVectors({
      clockSignalName: 'phase_driver',
      startTick: 1,
      count: 4,
      pattern: 'alternating',
    });

    expect(
      vectors.map((vector) => ({
        tick: vector.tick,
        phase_driver: vector.inputs.phase_driver,
      }))
    ).toEqual([
      { tick: 1, phase_driver: 1 },
      { tick: 2, phase_driver: 0 },
      { tick: 3, phase_driver: 1 },
      { tick: 4, phase_driver: 0 },
    ]);
  });
});
