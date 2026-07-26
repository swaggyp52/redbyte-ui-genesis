import { INTERNAL_SIM_CLOCK_NAME, type VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import type { RuntimeVerifyRun } from './projectRuntime';
import type { VerifyClockPolicy } from './verifyClockPolicy';

export type TimingGuidanceKind = 'combinational' | 'clock' | 'latch-control' | 'sequential';

export interface TimingGuidance {
  kind: TimingGuidanceKind;
  isSequential: boolean;
  signalName?: string;
  badgePrefix?: 'CLK' | 'EN' | 'SEQ';
  signalLabelSingular: string;
  signalLabelPlural: string;
  activityLabel: string;
  patternActionLabel: string;
  exportLabel: string;
  exportDetail: string;
  exportTooltip: string;
}

const COMBINATIONAL_GUIDANCE: TimingGuidance = Object.freeze({
  kind: 'combinational',
  isSequential: false,
  signalLabelSingular: 'Combinational',
  signalLabelPlural: 'Combinational',
  activityLabel: 'settle activity',
  patternActionLabel: 'Insert basic pattern',
  exportLabel: 'Timing',
  exportDetail: 'Combinational settle',
  exportTooltip: 'This circuit is combinational and does not require a timing-control signal.',
});

function normalizeTimingSignalName(signalName: string | null | undefined): string | undefined {
  const trimmed = signalName?.trim();
  if (!trimmed || trimmed === INTERNAL_SIM_CLOCK_NAME) return undefined;
  return trimmed;
}

export function createClockTimingGuidance(signalName: string | undefined): TimingGuidance {
  return {
    kind: 'clock',
    isSequential: true,
    signalName,
    badgePrefix: 'CLK',
    signalLabelSingular: 'Clock',
    signalLabelPlural: 'Clocks',
    activityLabel: 'clock activity',
    patternActionLabel: 'Insert basic clock pattern',
    exportLabel: 'Clock Domain',
    exportDetail: 'Single domain',
    exportTooltip:
      'All flip-flops share one clock signal. Multiple clock domains can cause unpredictable synthesis results.',
  };
}

export function createLatchTimingGuidance(signalName: string | undefined): TimingGuidance {
  return {
    kind: 'latch-control',
    isSequential: true,
    signalName,
    badgePrefix: 'EN',
    signalLabelSingular: 'Latch control',
    signalLabelPlural: 'Latch control',
    activityLabel: 'latch-control activity',
    patternActionLabel: 'Insert basic enable pattern',
    exportLabel: 'Latch control',
    exportDetail: signalName
      ? `${signalName} drives supported latch behavior`
      : 'Supported latch control',
    exportTooltip:
      'Supported D-latches use an enable/control signal rather than a rising-edge clock. Toggle the control signal to observe transparent versus hold behavior.',
  };
}

export function createSequentialTimingGuidance(signalName: string | undefined): TimingGuidance {
  return {
    kind: 'sequential',
    isSequential: true,
    signalName,
    badgePrefix: 'SEQ',
    signalLabelSingular: 'Sequential control',
    signalLabelPlural: 'Sequential control',
    activityLabel: 'timing activity',
    patternActionLabel: 'Insert basic timing pattern',
    exportLabel: 'Sequential control',
    exportDetail: 'Stateful behavior detected',
    exportTooltip:
      'This design includes state-holding behavior. Provide an explicit timing or control waveform when verifying it.',
  };
}

export function deriveTimingGuidance(
  contract?: VerifyScheduleContract | null
): TimingGuidance {
  if (!contract) return COMBINATIONAL_GUIDANCE;

  const signalName = normalizeTimingSignalName(contract.clockSignalName);
  const sequentialTypes = Array.from(
    new Set(
      (contract.analysis?.sequentialNodes ?? [])
        .map((node) => node.type?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
  const isSequential =
    contract.schedule === 'clocked_macro' ||
    contract.reason === 'circuit-sequential' ||
    contract.reason === 'hdl-sequential' ||
    sequentialTypes.length > 0;

  if (!isSequential) return COMBINATIONAL_GUIDANCE;

  const isPureLatch =
    sequentialTypes.length > 0 &&
    sequentialTypes.every((type) => type === 'DLatch');
  if (isPureLatch) {
    return createLatchTimingGuidance(signalName);
  }

  const hasExplicitClock =
    sequentialTypes.some((type) => type !== 'DLatch') ||
    contract.reason === 'hdl-sequential' ||
    Boolean(signalName);

  if (hasExplicitClock) {
    return createClockTimingGuidance(signalName);
  }

  return createSequentialTimingGuidance(signalName);
}

export function deriveTimingGuidanceFromRun(
  run?: Pick<RuntimeVerifyRun, 'scheduleContract' | 'schedule' | 'meta'> | null
): TimingGuidance {
  if (run?.scheduleContract) {
    return deriveTimingGuidance(run.scheduleContract);
  }
  if (run?.schedule === 'clocked_macro' || run?.meta.clockingProtocol === 'clocked_macro') {
    return createClockTimingGuidance(normalizeTimingSignalName(run.meta.clockSignalName));
  }
  return COMBINATIONAL_GUIDANCE;
}

export function formatTimingBadge(guidance: TimingGuidance): string {
  if (!guidance.isSequential) return 'Combinational';
  if (guidance.signalName && guidance.badgePrefix) {
    return `${guidance.badgePrefix}: ${guidance.signalName}`;
  }
  return guidance.signalLabelSingular;
}

export function formatTimingTooltip(guidance: TimingGuidance): string {
  if (!guidance.isSequential) {
    return 'Combinational circuit — no timing-control signal required.';
  }
  if (guidance.kind === 'latch-control') {
    return guidance.signalName
      ? `Level-sensitive latch — control signal: ${guidance.signalName}`
      : 'Level-sensitive latch — control-driven';
  }
  if (guidance.kind === 'clock') {
    return guidance.signalName
      ? `Sequential circuit — clock signal: ${guidance.signalName}`
      : 'Sequential circuit — clock-driven';
  }
  return guidance.signalName
    ? `Sequential circuit — control signal: ${guidance.signalName}`
    : 'Sequential circuit — stateful behavior detected';
}

export function formatTimingProtocol(
  guidance: TimingGuidance,
  clockPolicy?: VerifyClockPolicy | null
): string {
  if (guidance.kind === 'latch-control') {
    return guidance.signalName
      ? `Latch control (${guidance.signalName}: 0 -> 1 -> 0 per case)`
      : 'Level-sensitive latch';
  }
  if (guidance.kind === 'clock' || guidance.kind === 'sequential') {
    const signalName = guidance.signalName ?? 'CLK';
    if (clockPolicy?.overrideMode === 'auto') {
      return `Auto clock (${signalName}: one rising edge and post-edge sample per case)`;
    }
    if (
      clockPolicy?.overrideMode === 'manual-pulses' ||
      clockPolicy?.overrideMode === 'custom-pattern'
    ) {
      return `Authored clock (${signalName}: follows each authored row level)`;
    }
    return `Clocked macro (${signalName}: derived clock protocol)`;
  }
  return 'Combinational settle (one evaluation per case)';
}

export function formatTimingTickZero(
  guidance: TimingGuidance,
  tick0Meaning: RuntimeVerifyRun['meta']['tick0Meaning']
): string {
  if (tick0Meaning === 'initial-state') {
    if (guidance.kind === 'latch-control') {
      return 'Initial state before the latch opens';
    }
    return 'Initial state before the first clock pulse';
  }
  if (tick0Meaning === 'reset-phase') return 'Reset phase before normal stepping begins';
  return 'First evaluated case';
}
