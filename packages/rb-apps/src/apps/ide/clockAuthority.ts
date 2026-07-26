import type { TestVector } from '@redbyte/rb-utils';
import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import type { RuntimeVerifyRun } from './projectRuntime';

export type ClockHelperPattern = 'alternating' | 'hold-low' | 'hold-high';

interface ResolveActiveScheduleContractInput {
  deterministicHash: string;
  liveScheduleContract?: VerifyScheduleContract | null;
  lastRun?: Pick<RuntimeVerifyRun, 'deterministicHash' | 'scheduleContract'> | null;
}

export function resolveActiveScheduleContract(
  input: ResolveActiveScheduleContractInput
): VerifyScheduleContract | undefined {
  // Current project derivation is always authoritative. A persisted run
  // contract is historical evidence and only a compatibility fallback when
  // the live contract is unavailable.
  return input.liveScheduleContract ?? input.lastRun?.scheduleContract ?? undefined;
}

export function getClockHelperValueForTick(
  tick: number,
  pattern: ClockHelperPattern
): 0 | 1 {
  if (pattern === 'hold-low') return 0;
  if (pattern === 'hold-high') return 1;
  // Helper parity is tick-absolute so every consumer tells the same clock story.
  return tick % 2 === 0 ? 0 : 1;
}

export function buildClockHelperVectors(input: {
  clockSignalName: string;
  startTick: number;
  count?: number;
  pattern: ClockHelperPattern;
  idPrefix?: string;
}): TestVector[] {
  const count = Math.max(0, Math.floor(input.count ?? 4));
  if (count === 0) return [];

  return Array.from({ length: count }, (_value, index) => {
    const tick = input.startTick + index;
    return {
      id: `${input.idPrefix ?? 'vec-clk'}-${String(tick).padStart(2, '0')}`,
      tick,
      inputs: {
        [input.clockSignalName]: getClockHelperValueForTick(tick, input.pattern),
      },
      expected: {},
    };
  });
}
