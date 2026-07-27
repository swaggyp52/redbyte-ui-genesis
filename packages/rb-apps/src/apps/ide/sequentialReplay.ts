import type { VerifyEvidenceIoRow, VerifyReport, VerifyWaveSample } from './verifyReport';
import type { VerifyScenarioStep } from './verifyScenarioSteps';

export interface SequentialReplayModel {
  eventSampleIndexes: number[];
  transitionSampleIndexes: number[];
  frameAt(sampleIndex: number): SequentialReplayFrame;
}

export interface SequentialReplayFrame {
  eventNumber: number;
  eventCount: number;
  data: string | null;
  clock: string | null;
  reset: string | null;
  output: string | null;
  edge: 'rising' | 'falling' | 'none';
  preState: string | null;
  postState: string | null;
  stateChanged: boolean;
}

export function buildSequentialReplayModel(input: {
  waveform: VerifyWaveSample[];
  report?: Pick<VerifyReport, 'signalRoles'> | null;
  ioRows?: VerifyEvidenceIoRow[] | null;
  steps?: VerifyScenarioStep[] | null;
  clockSignalName?: string | null;
}): SequentialReplayModel {
  const waveform = input.waveform;
  const eventSampleIndexes = buildEventSampleIndexes(waveform.length, input.steps);
  const transitionSampleIndexes = waveform
    .map((sample, index) => ({ sample, index }))
    .filter(({ index }) => index > 0 && didSignalsChange(waveform[index - 1]!, waveform[index]!))
    .map(({ index }) => index);
  const roleKeys = resolveRoleKeys(input.report?.signalRoles ?? {}, input.clockSignalName);
  const roleCandidates = {
    data: buildSignalCandidates(roleKeys.data, input.ioRows),
    clock: buildSignalCandidates(roleKeys.clock, input.ioRows),
    reset: buildSignalCandidates(roleKeys.reset, input.ioRows),
    output: buildSignalCandidates(roleKeys.output, input.ioRows),
  };

  return {
    eventSampleIndexes,
    transitionSampleIndexes,
    frameAt(sampleIndex) {
      const boundedIndex = Math.max(0, Math.min(sampleIndex, Math.max(0, waveform.length - 1)));
      const current = waveform[boundedIndex];
      const previous = boundedIndex > 0 ? waveform[boundedIndex - 1] : undefined;
      const eventNumber = resolveEventNumber(eventSampleIndexes, boundedIndex);
      const clockBefore = readSignal(previous, roleCandidates.clock);
      const clockAfter = readSignal(current, roleCandidates.clock);
      const edge =
        clockBefore === '0' && clockAfter === '1'
          ? 'rising'
          : clockBefore === '1' && clockAfter === '0'
            ? 'falling'
            : 'none';
      const preState = readSignal(previous, roleCandidates.output);
      const postState = readSignal(current, roleCandidates.output);

      return {
        eventNumber,
        eventCount: eventSampleIndexes.length,
        data: readSignal(current, roleCandidates.data),
        clock: clockAfter,
        reset: readSignal(current, roleCandidates.reset),
        output: postState,
        edge,
        preState,
        postState,
        stateChanged: preState != null && postState != null && preState !== postState,
      };
    },
  };
}

export function findPreviousReplayIndex(indexes: number[], currentIndex: number): number | null {
  for (let index = indexes.length - 1; index >= 0; index -= 1) {
    const candidate = indexes[index]!;
    if (candidate < currentIndex) return candidate;
  }
  return null;
}

export function findNextReplayIndex(indexes: number[], currentIndex: number): number | null {
  return indexes.find((candidate) => candidate > currentIndex) ?? null;
}

function buildEventSampleIndexes(
  waveformLength: number,
  steps?: VerifyScenarioStep[] | null
): number[] {
  if (waveformLength === 0) return [];
  if (!steps || steps.length === 0) {
    return Array.from({ length: waveformLength }, (_, index) => index);
  }

  const result: number[] = [];
  let sampleCursor = -1;
  const sorted = [...steps].sort((left, right) => left.order - right.order);
  for (const step of sorted) {
    const duration = Math.max(1, Math.floor(step.durationTicks ?? 1));
    const sampleCount =
      step.kind === 'pulse_step' &&
      (step.pulseBehavior === 'rising' || step.pulseBehavior === 'falling' || step.pulseBehavior == null)
        ? duration + 1
        : duration;
    sampleCursor += sampleCount;
    result.push(Math.min(sampleCursor, waveformLength - 1));
    if (sampleCursor >= waveformLength - 1) break;
  }

  if (result.length === 0) return [waveformLength - 1];
  return Array.from(new Set(result));
}

function resolveEventNumber(eventSampleIndexes: number[], sampleIndex: number): number {
  if (eventSampleIndexes.length === 0) return 0;
  const firstAtOrAfter = eventSampleIndexes.findIndex((candidate) => candidate >= sampleIndex);
  return (firstAtOrAfter < 0 ? eventSampleIndexes.length - 1 : firstAtOrAfter) + 1;
}

function didSignalsChange(previous: VerifyWaveSample, current: VerifyWaveSample): boolean {
  const keys = new Set([...Object.keys(previous.signals), ...Object.keys(current.signals)]);
  return Array.from(keys).some((key) => previous.signals[key] !== current.signals[key]);
}

function readSignal(
  sample: VerifyWaveSample | undefined,
  candidates: string[]
): string | null {
  if (!sample) return null;
  for (const candidate of candidates) {
    if (sample.signals[candidate] !== undefined) {
      return sample.signals[candidate] ?? null;
    }
    const normalizedCandidate = normalizeKey(candidate);
    const matchedKey = Object.keys(sample.signals).find(
      (key) => normalizeKey(key) === normalizedCandidate
    );
    if (matchedKey) return sample.signals[matchedKey] ?? null;
  }
  return null;
}

function buildSignalCandidates(
  logicalKey: string | null,
  ioRows?: VerifyEvidenceIoRow[] | null
): string[] {
  if (!logicalKey) return [];
  const normalizedLogical = normalizeKey(logicalKey);
  const row = ioRows?.find(
    (candidate) =>
      normalizeKey(candidate.label) === normalizedLogical ||
      normalizeKey(candidate.id) === normalizedLogical
  );
  const candidates = [
    logicalKey,
    row?.id,
    row?.label,
    row?.nodeId,
    row?.nodeId ? `${row.nodeId}.in` : null,
    row?.nodeId ? `${row.nodeId}.out` : null,
  ];
  return candidates.filter(
    (candidate, index, source): candidate is string =>
      typeof candidate === 'string' &&
      candidate.length > 0 &&
      source.indexOf(candidate) === index
  );
}

function resolveRoleKeys(
  signalRoles: VerifyReport['signalRoles'],
  clockSignalName?: string | null
): { data: string | null; clock: string | null; reset: string | null; output: string | null } {
  const entries = Object.entries(signalRoles);
  const byRole = (role: VerifyReport['signalRoles'][string]) =>
    entries.filter(([, candidateRole]) => candidateRole === role).map(([key]) => key);
  const inputKeys = byRole('input');
  const outputKeys = byRole('output');
  const clockKeys = byRole('clock');
  const resetKeys = byRole('reset');
  const preferred = (keys: string[], pattern: RegExp) =>
    keys.find((key) => pattern.test(normalizeKey(key))) ?? keys[0] ?? null;
  const authoredClock = normalizeKey(clockSignalName ?? '');

  return {
    data: preferred(inputKeys, /^d$/),
    clock:
      clockKeys.find((key) => normalizeKey(key) === authoredClock) ??
      preferred(clockKeys, /^(clk|clock)$/),
    reset: preferred(resetKeys, /^(reset|rst)$/),
    output: preferred(outputKeys, /^q$/),
  };
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}
