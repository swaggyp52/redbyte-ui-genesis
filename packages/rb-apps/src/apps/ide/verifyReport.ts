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
  generatedAtIso: string;
  reportHash: string;
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
    generatedAtIso: input.generatedAtIso,
    reportHash: `vrf_${digestValue(hashSeed)}`,
  };
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
