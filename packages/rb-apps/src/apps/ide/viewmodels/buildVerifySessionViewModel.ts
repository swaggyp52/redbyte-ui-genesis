import type { RuntimeVerifyRun } from '../projectRuntime';

export type VerifySessionMode = 'simulation' | 'capture' | 'assertion';

export type VerifySessionStatus =
  | 'draft'
  | 'running'
  | 'stale'
  | 'simulation-complete'
  | 'assertions-incomplete'
  | 'assertions-match'
  | 'assertions-differ';

export interface VerifySessionViewModel {
  mode: VerifySessionMode;
  status: VerifySessionStatus;
  tone: 'ok' | 'warn' | 'error' | 'idle';
  statusBadge: string;
  modeLabel: string;
  title: string;
  summary: string;
  runLabel: string;
  recommendedNextAction: 'simulate' | 'capture' | 'verify';
}

export interface BuildVerifySessionViewModelInput {
  totalVectorCount: number;
  totalExpectedCaseCount: number;
  runState: 'idle' | 'running' | 'complete';
  lastRun?: RuntimeVerifyRun;
  assertionMode: boolean;
  isRunStale: boolean;
  isTraceOnly: boolean;
  hasResults: boolean;
  canSetOracle: boolean;
  failingRowCount: number;
}

export function buildVerifySessionViewModel(
  input: BuildVerifySessionViewModelInput
): VerifySessionViewModel {
  const hasVectors = input.totalVectorCount > 0;
  const hasAssertions = input.totalExpectedCaseCount > 0;
  const lastRunStatus = input.lastRun?.status ?? null;

  const mode: VerifySessionMode = input.isTraceOnly && input.canSetOracle
    ? 'capture'
    : hasAssertions && (input.assertionMode || !input.lastRun)
      ? 'assertion'
      : 'simulation';

  const recommendedNextAction: VerifySessionViewModel['recommendedNextAction'] =
    input.isTraceOnly && input.canSetOracle
      ? 'capture'
      : mode === 'assertion'
        ? 'verify'
        : 'simulate';

  const status: VerifySessionStatus =
    input.runState === 'running'
      ? 'running'
      : input.isRunStale
        ? 'stale'
        : !hasVectors
          ? 'draft'
          : !input.lastRun
            ? 'draft'
            : input.isTraceOnly
              ? hasAssertions
                ? 'simulation-complete'
                : 'assertions-incomplete'
              : lastRunStatus === 'fail'
                ? 'assertions-differ'
                : input.hasResults
                  ? 'assertions-match'
                  : hasAssertions
                    ? 'simulation-complete'
                    : 'assertions-incomplete';

  const tone: VerifySessionViewModel['tone'] =
    status === 'assertions-match'
      ? input.lastRun?.qualification === 'incomplete-mapping'
        ? 'warn'
        : 'ok'
      : status === 'assertions-differ'
        ? 'warn'
        : status === 'assertions-incomplete' || status === 'stale'
          ? 'warn'
          : 'idle';

  const statusBadge =
    status === 'assertions-match'
      ? input.lastRun?.qualification === 'incomplete-mapping'
        ? 'ASSERTIONS MATCH (MAPPING REVIEW)'
        : 'ASSERTIONS MATCH'
      : status === 'assertions-differ'
        ? 'ASSERTIONS DIFFER'
        : status === 'assertions-incomplete'
          ? 'EXPECTED OUTPUTS INCOMPLETE'
          : status === 'simulation-complete'
            ? 'SIMULATION COMPLETE'
            : status === 'stale'
              ? 'STALE'
              : status === 'running'
                ? 'RUNNING'
                : 'DRAFT';

  const modeLabel =
    mode === 'assertion'
      ? 'COMPARE'
      : mode === 'capture'
        ? 'CAPTURE'
        : 'OBSERVE';

  const title =
    status === 'assertions-match'
      ? 'Assertions match observed outputs'
      : status === 'assertions-differ'
        ? 'Assertions differ from observed outputs'
        : status === 'assertions-incomplete'
          ? 'Expected outputs are still incomplete'
          : status === 'simulation-complete'
            ? input.lastRun
              ? 'Simulation complete'
              : 'Ready to simulate'
            : status === 'stale'
              ? 'Results are stale'
              : status === 'running'
                ? mode === 'assertion'
                  ? 'Comparing outputs'
                  : 'Running simulation'
                : hasVectors
                  ? mode === 'assertion'
                    ? 'Ready to compare'
                    : 'Ready to simulate'
                  : 'Build a testbench';

  const summary =
    status === 'assertions-match'
      ? input.lastRun?.qualification === 'incomplete-mapping'
        ? 'Observed outputs matched your assertions, but some board mappings are still incomplete.'
        : 'Observed outputs matched every asserted expected value.'
      : status === 'assertions-differ'
        ? input.failingRowCount === 1
          ? 'One asserted output differs from what the live design produced. Inspect that first difference before changing anything else.'
          : `${input.failingRowCount} asserted outputs differ from what the live design produced. Start with the first difference.`
        : status === 'assertions-incomplete'
          ? 'Only asserted outputs should be compared. Capture outputs or author expected values before treating this as a comparison run.'
          : status === 'simulation-complete'
            ? input.lastRun
              ? 'Waveform recorded from the live design. Capture outputs as expected when you are ready to compare.'
              : 'Add stimulus ticks, then run the circuit to record a waveform.'
            : status === 'stale'
              ? 'The circuit or testbench changed after the last run. Re-run before trusting the result.'
              : status === 'running'
                ? mode === 'assertion'
                  ? 'Comparing asserted outputs against the current live design.'
                  : 'Recording waveform data from the current live design.'
                : hasVectors
                  ? mode === 'assertion'
                    ? 'Expected outputs are loaded. Compare them against the current live design when you are ready.'
                    : 'Add more ticks if needed, then run the circuit to record waveform behavior from the live design.'
                  : 'Add ticks, input patterns, and optional expected outputs to start the session.';

  const runLabel =
    input.isRunStale
      ? 'Re-run for current circuit'
      : mode === 'assertion'
        ? input.lastRun
          ? 'Re-run Verification'
          : 'Run Verification'
        : input.lastRun
          ? 'Re-run Simulation'
          : 'Run Simulation';

  return {
    mode,
    status,
    tone,
    statusBadge,
    modeLabel,
    title,
    summary,
    runLabel,
    recommendedNextAction,
  };
}
