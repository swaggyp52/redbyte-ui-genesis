import type { RuntimeVerifyRun } from '../projectRuntime';

export type VerifySessionMode = 'simulation' | 'capture' | 'assertion';

/**
 * Student-facing Verify session states.
 *
 * DRAFT             — No vectors defined yet, or first-time session.
 * STIMULUS_ONLY     — Live tracing / observation-only mode.
 *                     The session can run simulation or show recorded waveform evidence,
 *                     but no compare authority is active for the current run.
 * ASSERTIONS_INCOMPLETE — Some outputs are expected (asserted); others remain blank.
 *                         Only asserted outputs will be compared on next run.
 * ASSERTIONS_MATCH  — Compare ran; every asserted output matched the observed design.
 * ASSERTIONS_DIFFER — Compare ran; one or more asserted outputs differed from observed.
 * STALE             — Circuit or testbench changed after the last run. Result is no longer
 *                     authoritative; re-run before trusting it.
 *
 * RUNNING and structural-blocker states are transient and internal only — they must not
 * be persisted or treated as canonical session outcomes.
 */
export type VerifySessionStatus =
  | 'draft'
  | 'running'
  | 'stale'
  | 'stimulus-only'
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

/**
 * A single signal lane visible in the active scenario's vector set.
 * Used to build the pre-run inventory contract.
 */
export interface VerifySignalLane {
  /** Signal name as it appears in scenario vectors (id/label key). */
  name: string;
  /** Direction relative to the circuit boundary. */
  direction: 'input' | 'output';
  /**
   * True when this output signal has at least one tick in the active scenario
   * where expected is non-null/non-empty. Stimulus-only signals have false here.
   * Always false for input signals.
   */
  isAsserted: boolean;
}

/**
 * Pre-run signal inventory — the contract that Verify must expose BEFORE running simulation.
 *
 * This tells the student exactly what will be simulated: which signals are present,
 * which outputs will be compared, and what the timing policy is.
 * If this contract is missing or stale, the Verify surface should surface a warning.
 *
 * Computed from activeScenario + circuit structure. Must NOT depend on any prior run.
 */
export interface VerifyPreRunInventory {
  /** All signal lanes visible in the active scenario, grouped by direction. */
  lanes: VerifySignalLane[];
  /** Total number of ticks defined in the active scenario. */
  tickCount: number;
  /** Number of distinct output signals with at least one asserted tick. */
  assertedOutputCount: number;
  /** Total number of expected-value entries across all ticks (assertion coverage). */
  totalAssertionCount: number;
  /**
   * Clock policy derived from the circuit structure via VerifyScheduleContract.
   * 'combinational' — purely combinational, no clock signal required.
   * 'clocked'       — sequential circuit; a clock signal drives flip-flops.
   */
  clockPolicy: 'combinational' | 'clocked';
  /**
   * Clock signal name when clockPolicy is 'clocked'.
   * Undefined for combinational circuits.
   * Populated from VerifyScheduleContract.clockSignalName when available.
   */
  clockSignalName?: string;
}

export interface BuildVerifySessionViewModelInput {
  totalVectorCount: number;
  totalExpectedCaseCount: number;
  runState: 'idle' | 'running' | 'complete';
  lastRun?: RuntimeVerifyRun;
  /**
   * Local authoring / next-run intent from VerifySurface.
   * This must not reinterpret the current persisted run; it only describes what
   * the student's next run is currently configured to do.
   */
  nextRunUsesAssertions: boolean;
  isRunStale: boolean;
  isTraceOnly: boolean;
  hasResults: boolean;
  canSetOracle: boolean;
  failingRowCount: number;
  /**
   * Pre-run signal inventory — the Verify contract surface before simulation.
   * When present, the UI can show students exactly what will be tested before they run.
   * When absent, the surface should not attempt to render pre-run detail.
   *
   * Must be populated from activeScenario + VerifyScheduleContract.
   * Must NOT be populated from prior run results.
   */
  signalInventory?: VerifyPreRunInventory;
}

export function buildVerifySessionViewModel(
  input: BuildVerifySessionViewModelInput
): VerifySessionViewModel {
  // ── PRE-RUN CONTRACT GUARD (dev mode) ─────────────────────────────────────
  // Verify must expose a signalInventory before rendering when vectors exist.
  // If this warning fires, the caller needs to compute signalInventory from
  // activeScenario + VerifyScheduleContract and pass it in before rendering.
  // signalInventory must NOT be populated from prior run results — only from
  // current scenario vectors and circuit structure.
  if (process.env.NODE_ENV !== 'production' && input.totalVectorCount > 0 && !input.signalInventory) {
    // eslint-disable-next-line no-console
    console.warn(
      '[RedByte] buildVerifySessionViewModel: signalInventory is absent but vectors exist (%d ticks). ' +
        'Populate signalInventory from activeScenario + VerifyScheduleContract before Verify renders. ' +
        'Without it the pre-run UX contract (signal lanes, assertion coverage, clock policy) cannot be met.',
      input.totalVectorCount
    );
  }
  // ──────────────────────────────────────────────────────────────────────────

  const hasVectors = input.totalVectorCount > 0;
  const hasAssertions = input.totalExpectedCaseCount > 0;
  const lastRunStatus = input.lastRun?.status ?? null;

  // `mode` is the student's current next-run intent / authoring stance.
  // `status` below remains the authoritative meaning of the persisted run/session.
  const mode: VerifySessionMode = input.lastRun && input.isTraceOnly && input.canSetOracle
    ? 'capture'
    : hasAssertions && input.nextRunUsesAssertions
      ? 'assertion'
      : 'simulation';

  const recommendedNextAction: VerifySessionViewModel['recommendedNextAction'] =
    input.lastRun && input.isTraceOnly && input.canSetOracle
      ? 'capture'
      : mode === 'assertion'
        ? 'verify'
        : 'simulate';

  const status: VerifySessionStatus =
    input.runState === 'running'
      ? 'running'
      : input.isRunStale
        ? 'stale'
        : !input.lastRun
            ? 'draft'
            : !input.isTraceOnly && lastRunStatus === 'fail'
                ? 'assertions-differ'
                : !input.isTraceOnly && input.hasResults
                  ? 'assertions-match'
                  : input.isTraceOnly || !hasAssertions
                    ? 'stimulus-only'
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
          ? 'ASSERTIONS INCOMPLETE'
          : status === 'stimulus-only'
            ? 'STIMULUS ONLY'
            : status === 'stale'
              ? 'STALE'
              : status === 'running'
                ? 'RUNNING'
                : 'DRAFT';

  const modeLabel =
    mode === 'assertion'
      ? 'ASSERTIONS'
      : mode === 'capture'
        ? 'CAPTURE'
        : 'STIMULUS';

  const title =
    status === 'assertions-match'
      ? 'All asserted outputs matched'
      : status === 'assertions-differ'
        ? 'Asserted outputs differ from observed'
        : status === 'assertions-incomplete'
          ? 'Assertion coverage is incomplete'
          : status === 'stimulus-only'
            ? input.lastRun
              ? 'Waveform recorded — stimulus evidence'
              : 'Ready to run this testbench'
            : status === 'stale'
              ? 'Results are stale'
              : status === 'running'
                ? mode === 'assertion'
                  ? 'Verifying assertions'
                  : 'Recording waveform'
                : hasVectors
                ? mode === 'assertion'
                    ? 'Ready to run assertions'
                    : 'Ready to run stimulus'
                  : 'Build a testbench';

  const summary =
    status === 'assertions-match'
      ? input.lastRun?.qualification === 'incomplete-mapping'
        ? 'Every asserted output matched. Some board IO mappings are still incomplete — hardware tests may not agree until mapping is finished.'
        : 'Every asserted output matched the observed design. Blank outputs were not verified.'
      : status === 'assertions-differ'
        ? input.failingRowCount === 1
          ? 'One asserted output differs from what the live design produced. Inspect that difference before changing anything else.'
          : `${input.failingRowCount} asserted outputs differ from what the live design produced. Start with the first difference.`
        : status === 'assertions-incomplete'
          ? 'Some outputs have saved assertions; others remain observational. Only asserted outputs will be verified on the next run.'
          : status === 'stimulus-only'
            ? input.lastRun
              ? 'You ran the current stimulus and recorded waveform evidence. Save observed outputs as assertions only when you want explicit verification of specific outputs.'
                : 'Run this stimulus to see what the circuit does on the waveform. Add output assertions only when you want explicit verification of specific outputs.'
            : status === 'stale'
              ? 'The circuit or testbench changed after the last run. Re-run before trusting the result.'
              : status === 'running'
                ? mode === 'assertion'
                  ? 'Verifying saved output assertions against the current live design. Blank outputs are not verified.'
                  : 'Recording waveform data from the current live design.'
                : hasVectors
                  ? mode === 'assertion'
                    ? 'Output assertions are loaded. Verification only checks outputs you intentionally asserted.'
                      : 'Run this stimulus to see how the circuit behaves. Add output assertions only when you want explicit verification.'
                    : 'Add ticks and input patterns to build the first stimulus. Output assertions stay optional.';

  const runLabel =
    input.isRunStale
      ? 'Re-run stimulus'
      : mode === 'assertion'
        ? input.lastRun
          ? 'Run assertions again'
          : 'Run assertions'
        : input.lastRun
          ? 'Run stimulus again'
          : 'Run stimulus';

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
