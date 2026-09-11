import type { RuntimeVerifyRun, VerifyRunLedgerEntry } from './projectRuntime';

export const MAX_RECORDED_RUNS = 50;

export function getRuntimeVerifyRunId(run: RuntimeVerifyRun): string {
  return run.runId ?? `run-${run.generatedAtIso}-${run.reportHash.slice(0, 8)}`;
}

export function findVerifyRunLedgerEntry(
  history: readonly VerifyRunLedgerEntry[], run: RuntimeVerifyRun | null | undefined,
): VerifyRunLedgerEntry | undefined {
  if (!run) return undefined;
  return history.find((entry) => entry.runId === getRuntimeVerifyRunId(run));
}

export function appendRecordedRun(
  archive: readonly RuntimeVerifyRun[], run: RuntimeVerifyRun,
): RuntimeVerifyRun[] {
  const id = getRuntimeVerifyRunId(run);
  return [...archive.filter((entry) => getRuntimeVerifyRunId(entry) !== id), run].slice(-MAX_RECORDED_RUNS);
}

export function latestRecordedScenarioRun(
  archive: readonly RuntimeVerifyRun[], scenarioId: string,
): RuntimeVerifyRun | undefined {
  for (let index = archive.length - 1; index >= 0; index -= 1) {
    if (archive[index].scenarioId === scenarioId) return archive[index];
  }
  return undefined;
}
