import { digestValue } from '../../utils/digest';

export interface VerifyReportRow {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
  status: 'pass' | 'fail';
}

export interface VerifyReportVector {
  id: string;
  tick: number;
  inputs: Record<string, 0 | 1>;
  expected: Record<string, 0 | 1>;
}

export interface VerifyReport {
  schemaVersion: 'rb.verify-report.v1';
  scenarioId: string;
  scenarioName: string;
  status: 'pass' | 'fail';
  deterministicHash: string;
  firstFailingTick?: number;
  rows: VerifyReportRow[];
  vectors: VerifyReportVector[];
  inputsAtTick: Record<number, Record<string, 0 | 1>>;
  signalRoles: Record<string, 'clock' | 'reset' | 'input' | 'output'>;
  generatedAtIso: string;
  reportHash: string;
}

export interface VerifyWaveSample {
  tick: number;
  signals: Record<string, string>;
  mismatches: Array<{
    signal: string;
    expected: string;
    actual: string;
  }>;
}

export interface VerifyTickSignalIndexEntry {
  tick: number;
  signal: string;
  expected: string;
  actual: string;
  status: 'pass' | 'fail';
}

export interface VerifyTickSignalIndex {
  ticks: number[];
  rowsByTick: Record<string, VerifyTickSignalIndexEntry[]>;
}

interface BuildVerifyReportInput {
  scenarioId: string;
  scenarioName: string;
  status: 'pass' | 'fail';
  deterministicHash: string;
  rows: Array<{
    tick: number;
    signal: string;
    expected: string;
    actual: string;
  }>;
  vectors: VerifyReportVector[];
  generatedAtIso: string;
  signalRoles?: Record<string, 'clock' | 'reset' | 'input' | 'output'>;
}

export function buildVerifyReport(input: BuildVerifyReportInput): VerifyReport {
  const normalizedRows = input.rows
    .map((row) => ({
      tick: Number.isFinite(row.tick) ? Math.max(0, Math.floor(row.tick)) : 0,
      signal: row.signal.trim(),
      expected: String(row.expected),
      actual: String(row.actual),
      status: row.expected === row.actual ? ('pass' as const) : ('fail' as const),
    }))
    .sort((left, right) => {
      if (left.tick !== right.tick) return left.tick - right.tick;
      if (left.signal < right.signal) return -1;
      if (left.signal > right.signal) return 1;
      return 0;
    });

  const normalizedVectors = input.vectors
    .map((vector, index) => ({
      id: (vector.id ?? '').trim() || `vec-${String(index + 1).padStart(2, '0')}`,
      tick: Number.isFinite(vector.tick) ? Math.max(0, Math.floor(vector.tick)) : index,
      inputs: normalizeBitMap(vector.inputs),
      expected: normalizeBitMap(vector.expected),
    }))
    .sort((left, right) => {
      if (left.tick !== right.tick) return left.tick - right.tick;
      if (left.id < right.id) return -1;
      if (left.id > right.id) return 1;
      return 0;
    });

  const inputsAtTick: Record<number, Record<string, 0 | 1>> = {};
  for (const vector of normalizedVectors) {
    inputsAtTick[vector.tick] = { ...vector.inputs };
  }

  const signalRoles = input.signalRoles ?? {};
  const firstFailingTick = normalizedRows.find((row) => row.status === 'fail')?.tick;
  const hashSeed = {
    schemaVersion: 'rb.verify-report.v1',
    scenarioId: input.scenarioId,
    scenarioName: input.scenarioName,
    status: input.status,
    deterministicHash: input.deterministicHash,
    firstFailingTick,
    rows: normalizedRows,
    vectors: normalizedVectors,
  };

  return {
    schemaVersion: 'rb.verify-report.v1',
    scenarioId: input.scenarioId,
    scenarioName: input.scenarioName,
    status: input.status,
    deterministicHash: input.deterministicHash,
    firstFailingTick,
    rows: normalizedRows,
    vectors: normalizedVectors,
    inputsAtTick,
    signalRoles,
    generatedAtIso: input.generatedAtIso,
    reportHash: `vrf_${digestValue(hashSeed)}`,
  };
}

export function buildVerifyWaveSamples(report: VerifyReport): VerifyWaveSample[] {
  const index = new Map<number, VerifyWaveSample>();
  for (const [tickKey, inputs] of Object.entries(report.inputsAtTick)) {
    const tick = Number.parseInt(tickKey, 10);
    if (!Number.isFinite(tick)) continue;
    const current = index.get(tick) ?? {
      tick,
      signals: {},
      mismatches: [],
    };
    for (const [signal, value] of Object.entries(inputs)) {
      current.signals[signal] = String(value);
    }
    index.set(tick, current);
  }

  for (const row of report.rows) {
    const current = index.get(row.tick) ?? {
      tick: row.tick,
      signals: {},
      mismatches: [],
    };
    current.signals[row.signal] = row.actual;
    if (row.status === 'fail') {
      current.mismatches.push({
        signal: row.signal,
        expected: row.expected,
        actual: row.actual,
      });
    }
    index.set(row.tick, current);
  }

  return Array.from(index.values()).sort((left, right) => left.tick - right.tick);
}

export function buildVerifyTickSignalIndex(report: VerifyReport): VerifyTickSignalIndex {
  const rowsByTick: Record<string, VerifyTickSignalIndexEntry[]> = {};
  for (const row of report.rows) {
    const key = String(row.tick);
    const nextRow: VerifyTickSignalIndexEntry = {
      tick: row.tick,
      signal: row.signal,
      expected: row.expected,
      actual: row.actual,
      status: row.status,
    };
    if (!rowsByTick[key]) {
      rowsByTick[key] = [nextRow];
    } else {
      rowsByTick[key].push(nextRow);
    }
  }
  const ticks = Object.keys(rowsByTick)
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  return { ticks, rowsByTick };
}

/**
 * Canonical signal key format is `nodeId.portName` (dot-separated).
 * Some internal paths emit `nodeId:portName` (colon). Normalise on read.
 */
export function normalizeSignalKey(key: string): string {
  return key.replace(':', '.');
}

function normalizeBitMap(value: Record<string, unknown>): Record<string, 0 | 1> {
  const keys = Object.keys(value ?? {}).sort();
  const next: Record<string, 0 | 1> = {};
  for (const key of keys) {
    next[key] = normalizeBit(value[key]);
  }
  return next;
}

function normalizeBit(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1') return 1;
  return 0;
}
