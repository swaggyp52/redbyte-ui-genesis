import type { IdeDiagnostic } from '../diagnostics';
import type { RuntimeVerifyRun } from '../projectRuntime';
import { normalizeIoSignalKey } from '../ioLabels';

type MappedSignal = {
  id: string;
  label?: string;
  pin?: string;
  direction: 'in' | 'out';
};

export interface VerifyStudentFailureRow {
  key: string;
  tick: number;
  rawSignal: string;
  signalLabel: string;
  expected: string;
  actual: string;
  vectorId?: string;
  caseIndex?: number;
  technical?: {
    vectorId?: string;
    sampledSignalKey?: string | null;
    expectedSignalKey?: string | null;
    actualReason?: string | null;
  };
}

export interface VerifyStudentPreflightSummary {
  id: string;
  title: string;
  message: string;
  blocking: boolean;
}

export interface VerifyStudentViewModel {
  failureRows: VerifyStudentFailureRow[];
  firstFailure: VerifyStudentFailureRow | null;
  selectedFailure: VerifyStudentFailureRow | null;
  selectedPeers: VerifyStudentFailureRow[];
  preflight: VerifyStudentPreflightSummary[];
}

export interface BuildVerifyStudentViewModelInput {
  lastRun?: RuntimeVerifyRun;
  mappedSignals?: MappedSignal[];
  selectedFailureKey?: string | null;
  preflightDiagnostics?: IdeDiagnostic[];
}

export function buildVerifyStudentViewModel(
  input: BuildVerifyStudentViewModelInput
): VerifyStudentViewModel {
  const displayLookup = buildSignalDisplayLookup(input.mappedSignals ?? []);
  const evidenceFailures = input.lastRun?.evidence?.failures ?? [];
  const failureRows = (input.lastRun?.report.rows ?? [])
    .filter((row) => row.status === 'fail')
    .map((row) => {
      const key = buildFailureCaseKey(row.tick, row.signal, row.vectorId, row.caseIndex);
      const technical =
        evidenceFailures.find(
          (entry) =>
            entry.vectorId === row.vectorId &&
            entry.signal === row.signal &&
            entry.caseIndex === row.caseIndex
        ) ??
        evidenceFailures.find(
          (entry) => entry.tick === row.tick && entry.signal === row.signal
        ) ??
        null;

      return {
        key,
        tick: row.tick,
        rawSignal: row.signal,
        signalLabel: displayLookup.get(normalizeIoSignalKey(row.signal)) ?? row.signal,
        expected: row.expected,
        actual: row.actual,
        vectorId: row.vectorId,
        caseIndex: row.caseIndex,
        technical: technical
          ? {
              vectorId: technical.vectorId,
              sampledSignalKey: technical.actualSourceKey,
              expectedSignalKey: technical.expectedSourceKey,
              actualReason: technical.actualReason,
            }
          : undefined,
      } satisfies VerifyStudentFailureRow;
    });

  const firstFailure = failureRows[0] ?? null;
  const selectedFailure =
    (input.selectedFailureKey
      ? failureRows.find((row) => row.key === input.selectedFailureKey) ?? null
      : null) ?? firstFailure;
  const selectedPeers = selectedFailure
    ? failureRows.filter(
        (row) => row.tick === selectedFailure.tick && row.key !== selectedFailure.key
      )
    : [];
  const preflight = (input.preflightDiagnostics ?? []).map((diagnostic) => ({
    id: diagnostic.id,
    title: diagnostic.title,
    message: diagnostic.message,
    blocking: diagnostic.blocking,
  }));

  return {
    failureRows,
    firstFailure,
    selectedFailure,
    selectedPeers,
    preflight,
  };
}

function buildFailureCaseKey(
  tick: number,
  signal: string,
  vectorId?: string,
  caseIndex?: number
): string {
  return [
    tick,
    normalizeSignalForKey(signal),
    signal,
    vectorId?.trim() || 'no-vector',
    Number.isFinite(caseIndex) ? String(caseIndex) : 'no-case',
  ].join(':');
}

function buildSignalDisplayLookup(signals: MappedSignal[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const signal of signals) {
    const display = (signal.label ?? signal.id).trim() || signal.id;
    for (const candidate of [signal.id, signal.label ?? '']) {
      const normalized = normalizeIoSignalKey(candidate);
      if (normalized && !lookup.has(normalized)) {
        lookup.set(normalized, display);
      }
    }
  }
  return lookup;
}

function normalizeSignalForKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}
