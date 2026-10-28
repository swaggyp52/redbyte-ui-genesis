import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TESTBENCH_RESULT_FILE } from '../../fpga/boards/basys3/testbenchGenerator';

/**
 * Runs exported VHDL in GHDL for tests. Opt-in through REDBYTE_GHDL; callers report
 * cases as skipped (never passed) when it is absent, and REDBYTE_REQUIRE_GHDL=1 turns
 * a missing simulator into a failed prerequisite for release qualification.
 *
 * A run is judged only through classifyGhdlRun: a PASS needs a clean analysis,
 * elaboration and run plus exactly one printed and one written REDBYTE_TB_RESULT
 * summary that agree with each other, with the testbench and with the exit code.
 */
export const GHDL_PATH = process.env.REDBYTE_GHDL?.trim() ?? '';

export interface GhdlProbe {
  ok: boolean;
  path: string;
  /** First line of `ghdl --version` when ok. */
  version?: string;
  /** Why the path is not a usable GHDL. */
  reason?: string;
}

const probeCache = new Map<string, GhdlProbe>();

/** Whether `path` is a GHDL executable: it exists, is a file, and `--version` names GHDL. Cached per path. */
export function probeGhdl(path: string = GHDL_PATH): GhdlProbe {
  const cached = probeCache.get(path);
  if (cached) return cached;
  const probe = probeUncached(path);
  probeCache.set(path, probe);
  return probe;
}

function probeUncached(path: string): GhdlProbe {
  if (path.length === 0) return { ok: false, path, reason: 'no GHDL path (REDBYTE_GHDL is not set)' };
  if (!existsSync(path)) return { ok: false, path, reason: `no file at ${path}` };
  if (!statSync(path).isFile()) return { ok: false, path, reason: `${path} is not a file` };
  const result = spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 30_000, windowsHide: true });
  if (result.error) return { ok: false, path, reason: `${path} could not be started: ${errorCode(result.error)}` };
  const firstLine = `${result.stdout ?? ''}`.split(/\r?\n/)[0]?.trim() ?? '';
  if (result.status !== 0 || !/^GHDL\b/.test(firstLine)) {
    return { ok: false, path, reason: `${path} is not GHDL (--version exit ${result.status}: "${firstLine.slice(0, 80)}")` };
  }
  return { ok: true, path, version: firstLine };
}

/** REDBYTE_GHDL names a working GHDL executable. */
export const ghdlAvailable = probeGhdl(GHDL_PATH).ok;
export const ghdlRequired = process.env.REDBYTE_REQUIRE_GHDL === '1';

export interface TbResult {
  tb: string;
  status: string;
  checks: number;
  failures: number;
}

export type GhdlStep = 'analyze' | 'elaborate' | 'run';

export interface GhdlRun {
  analyzeStatus: number | null;
  elaborateStatus: number | null;
  runStatus: number | null;
  /** The run step was stopped at its timeout. */
  timedOut: boolean;
  /** Summary lines the simulator printed. */
  printed: TbResult[];
  /** Summary lines the testbench wrote to its result file. */
  written: TbResult[];
  mismatchReports: number;
  log: string;
  /** The testbench entity the run elaborated. */
  tbEntity?: string;
  /** The GHDL could not be used (missing, invalid path, not GHDL, failed to start). */
  toolError?: string;
  /** The step stopped at its timeout, if any. */
  timedOutStep?: GhdlStep;
  /** A step that ended without an exit status for a reason other than a timeout (e.g. output overflow). */
  stepError?: { step: GhdlStep; error: string };
  /** Steps not attempted because an earlier one failed. */
  skippedSteps?: GhdlStep[];
  /** REDBYTE_TB_RESULT occurrences in the run output, parseable or not. */
  printedMarkers?: number;
  /** REDBYTE_TB_RESULT occurrences in the result file, parseable or not. */
  writtenMarkers?: number;
  /** Error- or failure-severity reports the simulator printed after the first summary. */
  reportsAfterSummary?: number;
}

const SUMMARY_PATTERN = /REDBYTE_TB_RESULT v=1 tb=(\w+) status=(\w+) checks=(\d+) failures=(\d+)(?![\w=])/g;
const countMarkers = (text: string) => text.split('REDBYTE_TB_RESULT').length - 1;
/** A GHDL report line: `file:line:col:@time:(report failure): message` or `(assertion error)`. */
const SEVERE_REPORT_LINE = /:@[^:]*:\((?:report|assertion) (?:error|failure)\):/;

export function parseTbResults(text: string): TbResult[] {
  return [...text.matchAll(SUMMARY_PATTERN)].map((m) => ({
    tb: m[1],
    status: m[2],
    checks: Number(m[3]),
    failures: Number(m[4]),
  }));
}

export interface RunOutputSummary {
  printed: TbResult[];
  printedMarkers: number;
  reportsAfterSummary: number;
  mismatchReports: number;
}

/** Reads the simulator's run output: summaries, unparseable summary markers, and severe reports after the summary. */
export function analyzeRunOutput(text: string): RunOutputSummary {
  const lines = text.split(/\r?\n/);
  const summaryLine = lines.findIndex((line) => parseTbResults(line).length > 0);
  const after = summaryLine < 0 ? [] : lines.slice(summaryLine + 1);
  return {
    printed: parseTbResults(text),
    printedMarkers: countMarkers(text),
    reportsAfterSummary: after.filter((line) => SEVERE_REPORT_LINE.test(line) && countMarkers(line) === 0).length,
    mismatchReports: (text.match(/Vector \d+ failed on /g) ?? []).length,
  };
}

export interface GhdlRunOptions {
  /** GHDL executable; defaults to REDBYTE_GHDL. */
  ghdlPath?: string;
  /** Timeout for analysis and for elaboration (ms). */
  stepTimeoutMs?: number;
}

/** Room for long mismatch logs; an overflow stops the step and is reported, never read as a pass. */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function errorCode(error: Error): string {
  return (error as NodeJS.ErrnoException).code ?? error.message;
}

function textOf(result: SpawnSyncReturns<string> | undefined): string {
  return result ? `${result.stdout ?? ''}${result.stderr ?? ''}` : '';
}

/**
 * Analyzes the files in the given order, elaborates and runs the testbench entity.
 * Files are written to a fresh temporary directory that is removed afterwards. A step
 * runs only when the previous one succeeded; skipped steps keep a null status.
 */
export function runGhdlFiles(
  files: ReadonlyArray<{ name: string; text: string }>,
  tbEntity: string,
  std: '08' | '93c' = '08',
  runTimeoutMs = 20_000,
  options: GhdlRunOptions = {},
): GhdlRun {
  const ghdlPath = options.ghdlPath ?? GHDL_PATH;
  const stepTimeoutMs = options.stepTimeoutMs ?? 60_000;
  const run: GhdlRun = {
    analyzeStatus: null,
    elaborateStatus: null,
    runStatus: null,
    timedOut: false,
    printed: [],
    written: [],
    mismatchReports: 0,
    log: '',
    tbEntity,
  };
  const probe = probeGhdl(ghdlPath);
  if (!probe.ok) {
    return { ...run, toolError: probe.reason, skippedSteps: ['analyze', 'elaborate', 'run'], log: `GHDL unavailable: ${probe.reason}` };
  }

  const dir = mkdtempSync(join(tmpdir(), 'rb-ghdl-'));
  const logs: string[] = [];
  try {
    for (const file of files) writeFileSync(join(dir, file.name), file.text, 'utf8');
    const step = (name: GhdlStep, args: string[], timeout: number) => {
      const result = spawnSync(ghdlPath, args, {
        cwd: dir, encoding: 'utf8', timeout, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true,
      });
      logs.push(textOf(result));
      if (result.error) {
        const code = errorCode(result.error);
        if (code === 'ETIMEDOUT' || /ETIMEDOUT/.test(String(result.error))) run.timedOutStep = name;
        else if (result.status === null) run.stepError = { step: name, error: code };
      }
      return result;
    };
    const order: GhdlStep[] = ['analyze', 'elaborate', 'run'];
    const skipFrom = (name: GhdlStep) => {
      run.skippedSteps = order.slice(order.indexOf(name) + 1);
    };

    const analyze = step('analyze', ['-a', `--std=${std}`, ...files.map((f) => f.name)], stepTimeoutMs);
    run.analyzeStatus = analyze.status;
    if (analyze.status !== 0) {
      skipFrom('analyze');
      return run;
    }
    const elaborate = step('elaborate', ['-e', `--std=${std}`, tbEntity], stepTimeoutMs);
    run.elaborateStatus = elaborate.status;
    if (elaborate.status !== 0) {
      skipFrom('elaborate');
      return run;
    }
    const simulate = step('run', ['-r', `--std=${std}`, tbEntity], runTimeoutMs);
    run.runStatus = simulate.status;
    run.timedOut = run.timedOutStep === 'run';
    const output = analyzeRunOutput(textOf(simulate));
    const resultPath = join(dir, TESTBENCH_RESULT_FILE);
    const resultText = existsSync(resultPath) ? readFileSync(resultPath, 'utf8') : '';
    run.printed = output.printed;
    run.printedMarkers = output.printedMarkers;
    run.reportsAfterSummary = output.reportsAfterSummary;
    run.mismatchReports = output.mismatchReports;
    run.written = parseTbResults(resultText);
    run.writtenMarkers = countMarkers(resultText);
    return run;
  } finally {
    run.log = logs.join('\n');
    // A simulator killed at its timeout can hold its files for a moment on Windows.
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

// ---------------------------------------------------------------------------------------------
// Outcome classification
// ---------------------------------------------------------------------------------------------

export type GhdlOutcome =
  | 'PASS'
  | 'FAIL'
  | 'NO_CHECKS'
  | 'TOOL_MISSING'
  | 'ANALYZE_ERROR'
  | 'ELABORATE_ERROR'
  | 'RUNTIME_ERROR'
  | 'TIMEOUT'
  | 'MISSING_SUMMARY'
  | 'CONTRADICTORY_SUMMARY'
  | 'SKIPPED';

export interface GhdlExpectation {
  /** The testbench entity the summary must name; defaults to the entity the run elaborated. */
  tbEntity?: string;
  /** The exact number of checks a PASS (or NO_CHECKS) must report. */
  expectedChecks?: number;
}

export interface GhdlClassification {
  outcome: GhdlOutcome;
  /** Id of the rule that decided the outcome; 'status' when the testbench's own verdict stands. */
  rule: string;
  detail: string;
  /** The single agreed summary, when there is one. */
  summary?: TbResult;
}

interface RuleContext {
  run: GhdlRun;
  summary: TbResult | undefined;
  tbEntity: string | undefined;
  expectedChecks: number | undefined;
}

export interface GhdlOutcomeRule {
  id: string;
  outcome: GhdlOutcome;
  /** A detail string when the rule applies to the run, otherwise null. */
  test(context: RuleContext): string | null;
}

const VERDICTS = new Set(['PASS', 'FAIL', 'NO_CHECKS']);
const same = (a: TbResult, b: TbResult) =>
  a.tb === b.tb && a.status === b.status && a.checks === b.checks && a.failures === b.failures;
const show = (r: TbResult | undefined) => (r ? `tb=${r.tb} status=${r.status} checks=${r.checks} failures=${r.failures}` : 'none');
const stepErrorNote = (run: GhdlRun, step: GhdlStep) => (run.stepError?.step === step ? ` (${run.stepError.error})` : '');

/**
 * Ordered rules; the first that applies decides. When none applies the testbench's own
 * status (PASS, FAIL or NO_CHECKS) is the outcome, and any other status is contradictory.
 * Every rule exists to stop a false PASS, or to name why a run produced no trustworthy verdict.
 */
export const GHDL_OUTCOME_RULES: readonly GhdlOutcomeRule[] = [
  {
    id: 'tool-missing', outcome: 'TOOL_MISSING',
    test: ({ run }) => run.toolError ?? null,
  },
  {
    id: 'timeout', outcome: 'TIMEOUT',
    test: ({ run }) => (run.timedOutStep || run.timedOut ? `${run.timedOutStep ?? 'run'} stopped at its timeout` : null),
  },
  {
    id: 'analyze-failed', outcome: 'ANALYZE_ERROR',
    test: ({ run }) => (run.analyzeStatus !== 0 ? `analysis exit ${run.analyzeStatus}${stepErrorNote(run, 'analyze')}` : null),
  },
  {
    id: 'elaborate-failed', outcome: 'ELABORATE_ERROR',
    test: ({ run }) => (run.elaborateStatus !== 0 ? `elaboration exit ${run.elaborateStatus}${stepErrorNote(run, 'elaborate')}` : null),
  },
  {
    id: 'run-incomplete', outcome: 'RUNTIME_ERROR',
    test: ({ run }) =>
      run.runStatus === null ? `run ended without an exit status${run.stepError ? ` (${run.stepError.error})` : ''}` : null,
  },
  {
    id: 'crash-without-summary', outcome: 'RUNTIME_ERROR',
    test: ({ run }) =>
      run.runStatus !== 0 && run.printed.length === 0 && run.written.length === 0 && (run.printedMarkers ?? 0) === 0
        ? `run exit ${run.runStatus} with no summary`
        : null,
  },
  {
    id: 'malformed-summary', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ run }) =>
      (run.printedMarkers ?? run.printed.length) > run.printed.length || (run.writtenMarkers ?? run.written.length) > run.written.length
        ? 'a REDBYTE_TB_RESULT line does not parse as a v=1 summary'
        : null,
  },
  {
    id: 'multiple-summaries', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ run }) =>
      run.printed.length > 1 || run.written.length > 1
        ? `${run.printed.length} printed and ${run.written.length} written summaries; exactly one of each is required`
        : null,
  },
  {
    id: 'summary-missing', outcome: 'MISSING_SUMMARY',
    test: ({ run }) =>
      run.printed.length === 0 || run.written.length === 0
        ? `${run.printed.length === 0 ? 'no printed summary' : 'printed'}; ${run.written.length === 0 ? `no ${TESTBENCH_RESULT_FILE} summary` : 'written'}`
        : null,
  },
  {
    id: 'printed-written-disagree', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ run }) =>
      run.printed[0] && run.written[0] && !same(run.printed[0], run.written[0])
        ? `printed ${show(run.printed[0])} but wrote ${show(run.written[0])}`
        : null,
  },
  {
    id: 'wrong-testbench', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ summary, tbEntity }) =>
      summary && tbEntity && summary.tb.toLowerCase() !== tbEntity.toLowerCase()
        ? `summary names tb=${summary.tb}, the run elaborated ${tbEntity}`
        : null,
  },
  {
    id: 'failures-exceed-checks', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ summary }) => (summary && summary.failures > summary.checks ? `failures=${summary.failures} > checks=${summary.checks}` : null),
  },
  {
    id: 'pass-with-failures', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ summary }) => (summary?.status === 'PASS' && summary.failures > 0 ? `PASS with failures=${summary.failures}` : null),
  },
  {
    id: 'pass-without-checks', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ summary }) => (summary?.status === 'PASS' && summary.checks === 0 ? 'PASS with checks=0' : null),
  },
  {
    id: 'check-count-mismatch', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ summary, expectedChecks }) =>
      summary && expectedChecks !== undefined && summary.status !== 'FAIL' && summary.checks !== expectedChecks
        ? `${summary.status} with checks=${summary.checks}, expected ${expectedChecks}`
        : null,
  },
  {
    id: 'fail-without-failures', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ summary }) => (summary?.status === 'FAIL' && summary.failures === 0 ? 'FAIL with failures=0' : null),
  },
  {
    id: 'no-checks-with-counts', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ summary }) =>
      summary?.status === 'NO_CHECKS' && (summary.checks > 0 || summary.failures > 0)
        ? `NO_CHECKS with checks=${summary.checks} failures=${summary.failures}`
        : null,
  },
  {
    id: 'exit-pass-nonzero', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ run, summary }) => (summary?.status === 'PASS' && run.runStatus !== 0 ? `PASS but run exit ${run.runStatus}` : null),
  },
  {
    id: 'exit-verdict-zero', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ run, summary }) =>
      (summary?.status === 'FAIL' || summary?.status === 'NO_CHECKS') && run.runStatus === 0
        ? `${summary.status} but run exit 0 (it must end at severity failure)`
        : null,
  },
  {
    id: 'reports-after-summary', outcome: 'CONTRADICTORY_SUMMARY',
    test: ({ run }) =>
      (run.reportsAfterSummary ?? 0) > 0 ? `${run.reportsAfterSummary} error/failure report(s) after the summary line` : null,
  },
];

/**
 * The one verdict a GHDL run supports. `run` undefined or null means it was not run (SKIPPED).
 * `rules` exists so tests can prove each rule decides its cases; callers use the default.
 */
export function classifyGhdlRun(
  run: GhdlRun | null | undefined,
  expectation: GhdlExpectation = {},
  rules: readonly GhdlOutcomeRule[] = GHDL_OUTCOME_RULES,
): GhdlClassification {
  if (!run) return { outcome: 'SKIPPED', rule: 'not-run', detail: 'GHDL was not run' };
  const summary = run.printed.length === 1 && run.written.length <= 1 ? run.printed[0] : run.written.length === 1 ? run.written[0] : undefined;
  const context: RuleContext = {
    run,
    summary,
    tbEntity: expectation.tbEntity ?? run.tbEntity,
    expectedChecks: expectation.expectedChecks,
  };
  for (const rule of rules) {
    const detail = rule.test(context);
    if (detail !== null) return { outcome: rule.outcome, rule: rule.id, detail, summary };
  }
  if (!summary) return { outcome: 'MISSING_SUMMARY', rule: 'status', detail: 'no single summary', summary };
  if (!VERDICTS.has(summary.status)) {
    return { outcome: 'CONTRADICTORY_SUMMARY', rule: 'status', detail: `unknown status ${summary.status}`, summary };
  }
  return { outcome: summary.status as GhdlOutcome, rule: 'status', detail: show(summary), summary };
}

/**
 * The design sources and testbench an export view model ships, in analysis order:
 * companions (leaf modules first, as packaged), then top.vhd, then the testbench.
 */
export function shippedSimulationFiles(
  artifacts: ReadonlyArray<{ path: string; kind: string; category: string; content: string }>,
): Array<{ name: string; text: string }> {
  const design = artifacts.filter((a) => a.category === 'design-source' && a.kind === 'vhd');
  const top = design.find((a) => a.path === 'top.vhd');
  const companions = design.filter((a) => a.path !== 'top.vhd');
  const bench = artifacts.find((a) => a.path === 'testbench.vhd');
  return [
    ...companions.map((a) => ({ name: a.path.replace(/[\\/]/g, '_'), text: a.content })),
    ...(top ? [{ name: 'top.vhd', text: top.content }] : []),
    ...(bench ? [{ name: 'testbench.vhd', text: bench.content }] : []),
  ];
}
