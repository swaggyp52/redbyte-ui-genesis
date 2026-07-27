import type { VerifyReport, VerifyWaveSample } from '../verifyReport';
import { buildVerifyWaveSamples } from '../verifyReport';
import type { RuntimeLogicValue, RuntimeSimTraceSample } from './simTypes';

type CanonicalLogicSymbol = '0' | '1' | 'X' | 'Z';

export interface CanonicalTraceFrame {
  tick: number;
  signals: Record<string, CanonicalLogicSymbol>;
}

export interface CanonicalSimulationTrace {
  schemaVersion: 'rb.sim-trace.v1';
  ticks: number[];
  signalOrder: string[];
  frames: CanonicalTraceFrame[];
}

export function normalizeSimulationTrace(
  trace: RuntimeSimTraceSample[]
): CanonicalSimulationTrace {
  const framesByTick = new Map<number, Record<string, CanonicalLogicSymbol>>();
  for (const sample of trace) {
    const tick = normalizeTick(sample.tick);
    const current = framesByTick.get(tick) ?? {};
    const next = {
      ...current,
      ...normalizeSignalRecord(sample.signals),
    };
    framesByTick.set(tick, sortSignalRecord(next));
  }

  const ticks = Array.from(framesByTick.keys()).sort((left, right) => left - right);
  const frames = ticks.map((tick) => ({
    tick,
    signals: framesByTick.get(tick) ?? {},
  }));

  return {
    schemaVersion: 'rb.sim-trace.v1',
    ticks,
    signalOrder: collectSignalOrder(frames),
    frames,
  };
}

export function buildVerifyWaveSamplesFromRuntimeTrace(
  trace: RuntimeSimTraceSample[]
): VerifyWaveSample[] {
  const canonical = normalizeSimulationTrace(trace);
  return canonical.frames.map((frame) => ({
    tick: frame.tick,
    signals: { ...frame.signals },
    mismatches: [],
  }));
}

export function buildCanonicalVerifyWaveSamples(
  report: VerifyReport,
  trace: RuntimeSimTraceSample[]
): VerifyWaveSample[] {
  if (trace.length === 0) {
    return buildVerifyWaveSamples(report);
  }

  const byTick = new Map<number, VerifyWaveSample>();
  for (const sample of buildVerifyWaveSamplesFromRuntimeTrace(trace)) {
    byTick.set(sample.tick, sample);
  }

  for (const [tickKey, inputs] of Object.entries(report.inputsAtTick)) {
    const tick = Number.parseInt(tickKey, 10);
    if (!Number.isFinite(tick)) continue;
    const base = byTick.get(tick) ?? {
      tick,
      signals: {},
      mismatches: [],
    };
    const mergedInputs = Object.fromEntries(
      Object.entries(inputs).map(([signal, value]) => [signal, String(value)])
    ) as Record<string, string>;
    const next: VerifyWaveSample = {
      ...base,
      signals: sortStringSignalRecord({
        ...base.signals,
        ...mergedInputs,
      }),
      mismatches: [...base.mismatches],
    };
    byTick.set(tick, next);
  }

  for (const row of report.rows) {
    const base = byTick.get(row.tick) ?? {
      tick: row.tick,
      signals: {},
      mismatches: [],
    };
    const nextMismatches =
      row.status === 'fail'
        ? [
            ...base.mismatches,
            {
              signal: row.signal,
              expected: row.expected,
              actual: row.actual,
            },
          ]
        : [...base.mismatches];
    const next: VerifyWaveSample = {
      ...base,
      signals: sortStringSignalRecord({
        ...base.signals,
        [row.signal]: row.actual,
      }),
      mismatches: nextMismatches,
    };
    byTick.set(row.tick, next);
  }

  return Array.from(byTick.values()).sort((left, right) => left.tick - right.tick);
}

function normalizeTick(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeSignalRecord(
  value: Record<string, RuntimeLogicValue>
): Record<string, CanonicalLogicSymbol> {
  const normalized: Record<string, CanonicalLogicSymbol> = {};
  for (const [key, bitValue] of Object.entries(value ?? {})) {
    normalized[key] = bitValue === 1 ? '1' : bitValue === 0 ? '0' : bitValue;
  }
  return sortSignalRecord(normalized);
}

function sortSignalRecord(
  value: Record<string, CanonicalLogicSymbol>
): Record<string, CanonicalLogicSymbol> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => compareText(left, right))
  ) as Record<string, CanonicalLogicSymbol>;
}

function sortStringSignalRecord(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => compareText(left, right))
  ) as Record<string, string>;
}

function collectSignalOrder(frames: CanonicalTraceFrame[]): string[] {
  const keys = new Set<string>();
  for (const frame of frames) {
    for (const key of Object.keys(frame.signals)) {
      keys.add(key);
    }
  }
  return Array.from(keys).sort((left, right) => compareText(left, right));
}

function compareText(left: string, right: string): number {
  const leftKey = left.toLowerCase();
  const rightKey = right.toLowerCase();
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
