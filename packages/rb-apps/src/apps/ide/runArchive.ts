import type { RuntimeVerifyRun, VerifyRunLedgerEntry } from './projectRuntime';

export function getRuntimeVerifyRunId(run: RuntimeVerifyRun): string {
  if (run.runId) return run.runId;
  if (run.reportHash && run.generatedAtIso) return `run-${run.generatedAtIso}-${run.reportHash.slice(0, 8)}`;
  // Pre-archive local saves may have only the earlier timestamp and deterministic
  // hash. This is an archive key, never a reconstructed execution identity.
  const legacyTime = 'ranAtIso' in run && typeof run.ranAtIso === 'string' ? run.ranAtIso : 'undated';
  return `legacy-run-${run.generatedAtIso ?? legacyTime}-${run.scenarioId}-${run.deterministicHash}`;
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
  return [...archive.filter((entry) => getRuntimeVerifyRunId(entry) !== id), run];
}

export function latestRecordedScenarioRun(
  archive: readonly RuntimeVerifyRun[], scenarioId: string,
): RuntimeVerifyRun | undefined {
  for (let index = archive.length - 1; index >= 0; index -= 1) {
    if (archive[index].scenarioId === scenarioId) return archive[index];
  }
  return undefined;
}
