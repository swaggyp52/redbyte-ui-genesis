// A typed read model of "which recording am I looking at, and what happened".
//
// The Simulate header used to derive its recording facts inline in three places: the
// identity strip counted checks, the command bar decided whether Reproduce was possible,
// and the run line named staleness. Each did it correctly, and each did it differently,
// so a reader could see "Recorded #2 · 8 of 14 checks failed" on one row and a picker
// option that spelled the same fact a third way. This module is the one place those facts
// are derived. It reads the existing owners (the run archive, the identity/digest helpers,
// the surface's staleness authority) and never writes; it is a projection, not a store.
import type { RuntimeVerifyRun } from '../../projectRuntime';
import { BROWSER_ENGINE_VERSION, summarizeRepetitions } from '../../runDeterminism';
import { getRuntimeVerifyRunId } from '../../runArchive';

/** What the optional checks of the selected recording say. `none` means no recording. */
export type RecordingVerdict = 'none' | 'unchecked' | 'not-evaluated' | 'pass' | 'fail';

/** Whether the current work still matches what this recording was made from. */
export type RecordingCurrency = 'none' | 'current' | 'differs';

export interface RecordingPickerOption {
  readonly runId: string;
  readonly ordinal: number;
  /** What the closed picker shows: the ordinal only, so the verdict is stated once beside it. */
  readonly label: string;
  readonly verdict: RecordingVerdict;
  /** The verdict in words, for the Run details list where every recording is named. */
  readonly verdictLabel: string;
}

export interface RecordingState {
  readonly verdict: RecordingVerdict;
  readonly currency: RecordingCurrency;
  /** The recording's own sequence number, or its position in the scenario when it has none. */
  readonly ordinal: number | null;
  readonly runId: string | null;
  /** Optional-check totals for a checked run; null when there is nothing to count. */
  readonly checks: { readonly total: number; readonly failed: number } | null;
  /** The one sentence the identity strip shows beside the recording. */
  readonly label: string;
  /** Present only when the current work differs from this recording. */
  readonly currencyLabel: string | null;
  /** The read model of what changed, in the order the owner reported it. */
  readonly changes: readonly string[];
  /** Repetition summary across identical configurations; null until there is a repeat. */
  readonly repetition: { readonly runs: number; readonly identical: number } | null;
  /** Whether Reproduce can execute this recording again, and why not when it cannot. */
  readonly reproducible: { readonly ok: true } | { readonly ok: false; readonly reason: string };
  /** Every recording of the same scenario, oldest first, for the picker. */
  readonly options: readonly RecordingPickerOption[];
  /** Comparison belongs to the selected recording, never the newest ledger entry. */
  readonly comparison: {
    readonly runId: string;
    readonly ordinal: number | null;
    readonly verdict: 'pass' | 'fail';
    readonly previous: { readonly runId: string; readonly ordinal: number; readonly passed: number; readonly failed: number } | null;
    readonly failedDelta: number | null;
  } | null;
}

export interface RecordingStateInput {
  readonly run: RuntimeVerifyRun | null | undefined;
  readonly archive: readonly RuntimeVerifyRun[];
  /** From `describeRecordingChanges`: the inputs that differ now. */
  readonly changes: readonly string[];
  /** The surface's existing freshness authority (`runProofIsStale`). Not re-derived here. */
  readonly stale: boolean;
}

function verdictOf(run: RuntimeVerifyRun): { verdict: RecordingVerdict; checks: RecordingState['checks'] } {
  if (run.assertionStatus === 'not-evaluated') return { verdict: 'not-evaluated', checks: null };
  const total = run.assertionStatus === 'not-configured' || run.runKind === 'trace' ? 0 : run.report.rows.length;
  if (total === 0) return { verdict: 'unchecked', checks: { total: 0, failed: 0 } };
  const failed = run.report.rows.filter((row) => row.status === 'fail').length;
  return { verdict: failed > 0 ? 'fail' : 'pass', checks: { total, failed } };
}

function verdictLabel(verdict: RecordingVerdict, checks: RecordingState['checks']): string {
  switch (verdict) {
    case 'none': return 'No recording yet';
    case 'not-evaluated': return 'Checks not evaluated';
    case 'unchecked': return 'No checks · outputs recorded';
    case 'fail': return `${checks?.failed ?? 0} of ${checks?.total ?? 0} checks failed`;
    case 'pass': return `${checks?.total ?? 0} checks passed`;
  }
}

function verdictShort(verdict: RecordingVerdict): string {
  switch (verdict) {
    case 'none': return 'no recording';
    case 'not-evaluated': return 'not evaluated';
    case 'unchecked': return 'no checks';
    case 'fail': return 'checks failed';
    case 'pass': return 'checks passed';
  }
}

/**
 * One picker line for a recording: its ordinal, never a digest. A native select shows the
 * selected option's text while closed, so anything more than the ordinal here would repeat
 * the verdict that already stands beside the picker.
 */
export function recordingPickerLabel(run: RuntimeVerifyRun, index: number): string {
  return `Recording ${run.sequence ?? index + 1}`;
}

/** The verdict in words, for lists that name every recording. */
export function recordingVerdictWords(run: RuntimeVerifyRun): string {
  return verdictShort(verdictOf(run).verdict);
}

export function describeRecordingState(input: RecordingStateInput): RecordingState {
  const { run, archive, changes, stale } = input;
  if (!run) {
    return {
      verdict: 'none', currency: 'none', ordinal: null, runId: null, checks: null,
      label: verdictLabel('none', null), currencyLabel: null, changes: [],
      repetition: null, reproducible: { ok: false, reason: 'Nothing has been recorded yet.' }, options: [], comparison: null,
    };
  }
  const { verdict, checks } = verdictOf(run);
  const records = archive.filter((entry) => entry.projectId === run.projectId && entry.scenarioId === run.scenarioId);
  const index = records.findIndex((entry) => getRuntimeVerifyRunId(entry) === getRuntimeVerifyRunId(run));
  const repetition = summarizeRepetitions(run, archive);
  const differs = stale || changes.length > 0;
  const ordinal = run.sequence ?? (index >= 0 ? index + 1 : null);
  // Archives are appended oldest first. Compare a historical selection to its own preceding
  // checked recording; later runs, traces and other scenarios cannot become its baseline.
  let previous: NonNullable<RecordingState['comparison']>['previous'] = null;
  if (verdict === 'pass' || verdict === 'fail') {
    for (let position = index - 1; position >= 0; position -= 1) {
      const entry = records[position];
      const result = verdictOf(entry);
      if (result.verdict !== 'pass' && result.verdict !== 'fail') continue;
      previous = { runId: getRuntimeVerifyRunId(entry), ordinal: entry.sequence ?? position + 1,
        passed: result.checks!.total - result.checks!.failed, failed: result.checks!.failed };
      break;
    }
  }
  const reproducible: RecordingState['reproducible'] =
    !run.executionInput || !run.circuitSnapshot
      ? { ok: false, reason: 'This older recording did not retain reproduction inputs.' }
      : run.identity?.engine && run.identity.engine !== BROWSER_ENGINE_VERSION
        ? { ok: false, reason: 'The recorded engine is unavailable.' }
        : { ok: true };
  return {
    verdict,
    currency: differs ? 'differs' : 'current',
    ordinal,
    runId: getRuntimeVerifyRunId(run),
    checks,
    label: verdictLabel(verdict, checks),
    currencyLabel: differs ? 'Current work differs' : null,
    changes,
    comparison: verdict === 'pass' || verdict === 'fail' ? {
      runId: getRuntimeVerifyRunId(run), ordinal, verdict, previous,
      failedDelta: previous ? checks!.failed - previous.failed : null,
    } : null,
    repetition: run.identity && repetition.runs.length > 1
      ? { runs: repetition.runs.length, identical: repetition.identical }
      : null,
    reproducible,
    options: records.map((entry, position) => ({
      runId: getRuntimeVerifyRunId(entry),
      ordinal: entry.sequence ?? position + 1,
      label: recordingPickerLabel(entry, position),
      verdict: verdictOf(entry).verdict,
      verdictLabel: verdictShort(verdictOf(entry).verdict),
    })),
  };
}
