// @vitest-environment node
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TESTBENCH_RESULT_FILE } from '../../fpga/boards/basys3/testbenchGenerator';
import {
  GHDL_OUTCOME_RULES,
  GHDL_PATH,
  analyzeRunOutput,
  classifyGhdlRun,
  ghdlAvailable,
  ghdlRequired,
  parseTbResults,
  runGhdlFiles,
  type GhdlExpectation,
  type GhdlOutcome,
  type GhdlRun,
  type TbResult,
} from './ghdlHarness';

/**
 * The harness's verdict rules. Every rule is shown to decide at least one case: with that
 * rule removed the same run gets a different outcome (usually a false PASS), so a test
 * passing here means the rule is doing work, not that the input happened to look fine.
 */

const without = (id: string) => GHDL_OUTCOME_RULES.filter((rule) => rule.id !== id);
const summary = (status: string, checks: number, failures: number, tb = 'tb_top'): TbResult => ({ tb, status, checks, failures });
const PASS4 = summary('PASS', 4, 0);

function syntheticRun(overrides: Partial<GhdlRun> = {}): GhdlRun {
  const printed = overrides.printed ?? [PASS4];
  const written = overrides.written ?? [PASS4];
  return {
    analyzeStatus: 0,
    elaborateStatus: 0,
    runStatus: 0,
    timedOut: false,
    printed,
    written,
    mismatchReports: 0,
    log: '',
    tbEntity: 'tb_top',
    printedMarkers: printed.length,
    writtenMarkers: written.length,
    reportsAfterSummary: 0,
    ...overrides,
  };
}

interface Case {
  name: string;
  run: GhdlRun | undefined;
  expectation?: GhdlExpectation;
  outcome: GhdlOutcome;
  rule: string;
  /** Hand-derived outcome of the same run with `rule` removed; omitted for the testbench's own verdict. */
  withoutRule?: GhdlOutcome;
}

const failed = (status: string, checks: number, failures: number) => ({
  printed: [summary(status, checks, failures)],
  written: [summary(status, checks, failures)],
  runStatus: 1,
});

const CASES: Case[] = [
  // The testbench's own verdict stands only when nothing contradicts it.
  { name: 'clean PASS', run: syntheticRun(), outcome: 'PASS', rule: 'status' },
  { name: 'PASS with the expected check count', run: syntheticRun(), expectation: { expectedChecks: 4 }, outcome: 'PASS', rule: 'status' },
  { name: 'FAIL ending at severity failure', run: syntheticRun(failed('FAIL', 4, 1)), outcome: 'FAIL', rule: 'status' },
  { name: 'NO_CHECKS ending at severity failure', run: syntheticRun(failed('NO_CHECKS', 0, 0)), outcome: 'NO_CHECKS', rule: 'status' },
  { name: 'not run', run: undefined, outcome: 'SKIPPED', rule: 'not-run' },
  { name: 'unknown status word', run: syntheticRun({ printed: [summary('OK', 4, 0)], written: [summary('OK', 4, 0)] }), outcome: 'CONTRADICTORY_SUMMARY', rule: 'status' },

  // Tool and step failures.
  {
    name: 'GHDL missing', outcome: 'TOOL_MISSING', rule: 'tool-missing', withoutRule: 'ANALYZE_ERROR',
    run: syntheticRun({ toolError: 'no file at C:/nope/ghdl.exe', analyzeStatus: null, elaborateStatus: null, runStatus: null, printed: [], written: [] }),
  },
  {
    name: 'run stopped at its timeout', outcome: 'TIMEOUT', rule: 'timeout', withoutRule: 'RUNTIME_ERROR',
    run: syntheticRun({ timedOut: true, timedOutStep: 'run', runStatus: null, printed: [], written: [] }),
  },
  {
    name: 'analysis stopped at its timeout', outcome: 'TIMEOUT', rule: 'timeout', withoutRule: 'ANALYZE_ERROR',
    run: syntheticRun({ timedOutStep: 'analyze', analyzeStatus: null, elaborateStatus: null, runStatus: null, printed: [], written: [] }),
  },
  {
    name: 'analysis failed although PASS summaries are present', outcome: 'ANALYZE_ERROR', rule: 'analyze-failed', withoutRule: 'PASS',
    run: syntheticRun({ analyzeStatus: 1 }),
  },
  {
    name: 'elaboration failed although PASS summaries are present', outcome: 'ELABORATE_ERROR', rule: 'elaborate-failed', withoutRule: 'PASS',
    run: syntheticRun({ elaborateStatus: 1 }),
  },
  {
    name: 'run ended without an exit status (output overflow)', outcome: 'RUNTIME_ERROR', rule: 'run-incomplete', withoutRule: 'CONTRADICTORY_SUMMARY',
    run: syntheticRun({ runStatus: null, stepError: { step: 'run', error: 'ENOBUFS' } }),
  },
  {
    name: 'crash with no summary at all', outcome: 'RUNTIME_ERROR', rule: 'crash-without-summary', withoutRule: 'MISSING_SUMMARY',
    run: syntheticRun({ runStatus: 1, printed: [], written: [] }),
  },

  // Summary completeness.
  {
    name: 'clean exit with no summary', outcome: 'MISSING_SUMMARY', rule: 'summary-missing', withoutRule: 'MISSING_SUMMARY',
    run: syntheticRun({ printed: [], written: [] }),
  },
  {
    name: 'printed a PASS but wrote no result file', outcome: 'MISSING_SUMMARY', rule: 'summary-missing', withoutRule: 'PASS',
    run: syntheticRun({ written: [] }),
  },
  {
    name: 'wrote a PASS but printed none', outcome: 'MISSING_SUMMARY', rule: 'summary-missing', withoutRule: 'PASS',
    run: syntheticRun({ printed: [] }),
  },

  // Contradictions.
  {
    name: 'an unparseable REDBYTE_TB_RESULT line', outcome: 'CONTRADICTORY_SUMMARY', rule: 'malformed-summary', withoutRule: 'PASS',
    run: syntheticRun({ printedMarkers: 2 }),
  },
  {
    name: 'two contradictory printed summaries', outcome: 'CONTRADICTORY_SUMMARY', rule: 'multiple-summaries', withoutRule: 'PASS',
    run: syntheticRun({ printed: [PASS4, summary('FAIL', 4, 1)] }),
  },
  {
    name: 'printed and written summaries disagree', outcome: 'CONTRADICTORY_SUMMARY', rule: 'printed-written-disagree', withoutRule: 'PASS',
    run: syntheticRun({ written: [summary('PASS', 3, 0)] }),
  },
  {
    name: 'summary for a different testbench', outcome: 'CONTRADICTORY_SUMMARY', rule: 'wrong-testbench', withoutRule: 'PASS',
    run: syntheticRun({ printed: [summary('PASS', 4, 0, 'tb_other')], written: [summary('PASS', 4, 0, 'tb_other')] }),
  },
  {
    name: 'more failures than checks', outcome: 'CONTRADICTORY_SUMMARY', rule: 'failures-exceed-checks', withoutRule: 'FAIL',
    run: syntheticRun(failed('FAIL', 2, 3)),
  },
  {
    name: 'PASS with failures', outcome: 'CONTRADICTORY_SUMMARY', rule: 'pass-with-failures', withoutRule: 'PASS',
    run: syntheticRun({ printed: [summary('PASS', 4, 1)], written: [summary('PASS', 4, 1)] }),
  },
  {
    name: 'PASS with zero checks', outcome: 'CONTRADICTORY_SUMMARY', rule: 'pass-without-checks', withoutRule: 'PASS',
    run: syntheticRun({ printed: [summary('PASS', 0, 0)], written: [summary('PASS', 0, 0)] }),
  },
  {
    name: 'PASS with a different check count than expected', outcome: 'CONTRADICTORY_SUMMARY', rule: 'check-count-mismatch', withoutRule: 'PASS',
    run: syntheticRun(), expectation: { expectedChecks: 5 },
  },
  {
    name: 'NO_CHECKS where checks are expected', outcome: 'CONTRADICTORY_SUMMARY', rule: 'check-count-mismatch', withoutRule: 'NO_CHECKS',
    run: syntheticRun(failed('NO_CHECKS', 0, 0)), expectation: { expectedChecks: 3 },
  },
  {
    name: 'FAIL with zero failures', outcome: 'CONTRADICTORY_SUMMARY', rule: 'fail-without-failures', withoutRule: 'FAIL',
    run: syntheticRun(failed('FAIL', 4, 0)),
  },
  {
    name: 'NO_CHECKS that reports checks', outcome: 'CONTRADICTORY_SUMMARY', rule: 'no-checks-with-counts', withoutRule: 'NO_CHECKS',
    run: syntheticRun(failed('NO_CHECKS', 2, 0)),
  },
  {
    name: 'PASS with a nonzero exit', outcome: 'CONTRADICTORY_SUMMARY', rule: 'exit-pass-nonzero', withoutRule: 'PASS',
    run: syntheticRun({ runStatus: 1 }),
  },
  {
    name: 'FAIL with exit 0', outcome: 'CONTRADICTORY_SUMMARY', rule: 'exit-verdict-zero', withoutRule: 'FAIL',
    run: syntheticRun({ ...failed('FAIL', 4, 1), runStatus: 0 }),
  },
  {
    name: 'NO_CHECKS with exit 0', outcome: 'CONTRADICTORY_SUMMARY', rule: 'exit-verdict-zero', withoutRule: 'NO_CHECKS',
    run: syntheticRun({ ...failed('NO_CHECKS', 0, 0), runStatus: 0 }),
  },
  {
    name: 'an error report after the summary line', outcome: 'CONTRADICTORY_SUMMARY', rule: 'reports-after-summary', withoutRule: 'PASS',
    run: syntheticRun({ reportsAfterSummary: 1 }),
  },
];

describe('classifyGhdlRun: synthetic runs', () => {
  it.each(CASES)('$name -> $outcome ($rule)', ({ run, expectation, outcome, rule, withoutRule }) => {
    const verdict = classifyGhdlRun(run, expectation);
    expect({ outcome: verdict.outcome, rule: verdict.rule }).toEqual({ outcome, rule });
    if (withoutRule) expect(classifyGhdlRun(run, expectation, without(rule)).outcome).toBe(withoutRule);
  });

  it('every rule decides at least one case that gets another outcome without it', () => {
    const load = new Map(GHDL_OUTCOME_RULES.map((rule) => [rule.id, 0]));
    for (const testCase of CASES) {
      if (testCase.withoutRule && testCase.withoutRule !== testCase.outcome) {
        load.set(testCase.rule, (load.get(testCase.rule) ?? 0) + 1);
      }
    }
    expect([...load].filter(([, count]) => count === 0).map(([id]) => id)).toEqual([]);
  });

  it('the testbench verdict stands only as PASS, FAIL or NO_CHECKS; any other word is contradictory', () => {
    const fromStatus = new Set(CASES.filter((c) => c.rule === 'status').map((c) => c.outcome));
    expect([...fromStatus].sort()).toEqual(['CONTRADICTORY_SUMMARY', 'FAIL', 'NO_CHECKS', 'PASS']);
  });
});

describe('run output parsing', () => {
  it('reads only well-formed v=1 summaries', () => {
    expect(parseTbResults('REDBYTE_TB_RESULT v=1 tb=tb_top status=PASS checks=3 failures=0')).toEqual([summary('PASS', 3, 0)]);
    expect(parseTbResults('REDBYTE_TB_RESULT v=2 tb=tb_top status=PASS checks=3 failures=0')).toEqual([]);
    expect(parseTbResults('REDBYTE_TB_RESULT v=1 tb=tb_top status=PASS checks=3 failures=0x')).toEqual([]);
  });

  it('counts unparseable markers and severe reports after the summary, ignoring GHDL trailer lines', () => {
    const failRun = [
      'testbench.vhd:90:5:@40ns:(assertion error): Vector 3 failed on LD0: expected \'1\', got \'0\'',
      'testbench.vhd:120:7:@41ns:(report failure): REDBYTE_TB_RESULT v=1 tb=tb_top status=FAIL checks=4 failures=1',
      'ghdl:error: report failed',
      'ghdl:error: simulation failed',
    ].join('\n');
    expect(analyzeRunOutput(failRun)).toEqual({ printed: [summary('FAIL', 4, 1)], printedMarkers: 1, reportsAfterSummary: 0, mismatchReports: 1 });
    const late = [
      'tb.vhd:16:5:@1ns:(report note): REDBYTE_TB_RESULT v=1 tb=tb_top status=PASS checks=1 failures=0',
      'tb.vhd:17:5:@1ns:(assertion error): late check failed',
      'tb.vhd:18:5:@1ns:(report note): REDBYTE_TB_RESULT truncated',
    ].join('\n');
    expect(analyzeRunOutput(late)).toMatchObject({ printedMarkers: 2, reportsAfterSummary: 1 });
  });
});

describe('runGhdlFiles: GHDL path injection', () => {
  const tiny = [{ name: 'tb.vhd', text: 'entity tb_top is end entity;' }];
  it.each([
    ['an empty path', '', /REDBYTE_GHDL is not set/],
    ['a path with no file', join(tmpdir(), 'rb-no-such-ghdl', 'ghdl.exe'), /no file at/],
    ['a directory', tmpdir(), /is not a file/],
    ['an executable that is not GHDL', process.execPath, /is not GHDL/],
  ])('%s is TOOL_MISSING and runs no step', (_label, ghdlPath, reason) => {
    const run = runGhdlFiles(tiny, 'tb_top', '08', 5_000, { ghdlPath });
    expect(run).toMatchObject({ analyzeStatus: null, elaborateStatus: null, runStatus: null, skippedSteps: ['analyze', 'elaborate', 'run'] });
    expect(run.toolError).toMatch(reason);
    expect(classifyGhdlRun(run)).toMatchObject({ outcome: 'TOOL_MISSING', rule: 'tool-missing' });
  });

  it('defaults to REDBYTE_GHDL', () => {
    expect(GHDL_PATH).toBe(process.env.REDBYTE_GHDL?.trim() ?? '');
  });
});

// ---------------------------------------------------------------------------------------------
// Real GHDL: skipped (never passed) without REDBYTE_GHDL; REDBYTE_REQUIRE_GHDL=1 makes them fail.
// ---------------------------------------------------------------------------------------------

const line = (entity: string, status: string, checks: number, failures: number) =>
  `REDBYTE_TB_RESULT v=1 tb=${entity} status=${status} checks=${checks} failures=${failures}`;

function bench(entity: string, statements: string[], options: { resultFile?: boolean; declarations?: string[]; concurrent?: string[] } = {}): string {
  const stimulus = statements.length === 0 ? [] : [
    '  stim: process',
    ...(options.resultFile ? [`    file result_file : text open write_mode is "${TESTBENCH_RESULT_FILE}";`] : []),
    '    variable l : line;',
    '    variable a : int_pair := (others => 0);',
    '    variable i : integer := 5;',
    '  begin',
    '    wait for 1 ns;',
    ...statements.map((statement) => `    ${statement}`),
    '    wait;',
    '  end process;',
  ];
  return [
    'library ieee;',
    'use ieee.std_logic_1164.all;',
    'use std.textio.all;',
    `entity ${entity} is`,
    `end entity ${entity};`,
    `architecture sim of ${entity} is`,
    '  type int_pair is array (0 to 1) of integer;',
    ...(options.declarations ?? []),
    'begin',
    ...(options.concurrent ?? []),
    ...stimulus,
    'end architecture sim;',
    '',
  ].join('\n');
}

const writeLine = (text: string) => [`write(l, string'("${text}"));`, 'writeline(result_file, l);'];
const reportLine = (text: string, severity: 'note' | 'error' | 'failure') => `report "${text}" severity ${severity};`;
const finish = (entity: string, status: string, checks: number, failures: number, severity: 'note' | 'failure') => [
  ...writeLine(line(entity, status, checks, failures)),
  'file_close(result_file);',
  reportLine(line(entity, status, checks, failures), severity),
];

interface RealCase {
  name: string;
  entity: string;
  /** Entity to elaborate when it differs from the bench's entity. */
  elaborate?: string;
  text: string;
  runTimeoutMs?: number;
  outcome: GhdlOutcome;
  rule: string;
  withoutRule?: GhdlOutcome;
}

const REAL_CASES: RealCase[] = [
  { name: 'passing bench', entity: 'tb_pass', text: bench('tb_pass', finish('tb_pass', 'PASS', 2, 0, 'note'), { resultFile: true }), outcome: 'PASS', rule: 'status' },
  { name: 'failing bench', entity: 'tb_fail', text: bench('tb_fail', finish('tb_fail', 'FAIL', 2, 1, 'failure'), { resultFile: true }), outcome: 'FAIL', rule: 'status' },
  { name: 'bench with no checks', entity: 'tb_none', text: bench('tb_none', finish('tb_none', 'NO_CHECKS', 0, 0, 'failure'), { resultFile: true }), outcome: 'NO_CHECKS', rule: 'status' },
  {
    name: 'analysis error', entity: 'tb_syntax', outcome: 'ANALYZE_ERROR', rule: 'analyze-failed', withoutRule: 'ELABORATE_ERROR',
    text: bench('tb_syntax', [], { concurrent: ['  this is not vhdl;'] }),
  },
  {
    name: 'elaboration error (missing entity)', entity: 'tb_pass', elaborate: 'tb_missing', outcome: 'ELABORATE_ERROR', rule: 'elaborate-failed', withoutRule: 'RUNTIME_ERROR',
    text: bench('tb_pass', finish('tb_pass', 'PASS', 2, 0, 'note'), { resultFile: true }),
  },
  {
    name: 'runtime failure with no summary', entity: 'tb_crash', outcome: 'RUNTIME_ERROR', rule: 'crash-without-summary', withoutRule: 'MISSING_SUMMARY',
    text: bench('tb_crash', ['a(i) := 1;', reportLine(line('tb_crash', 'PASS', 1, 0), 'note')]),
  },
  {
    name: 'bench that never terminates', entity: 'tb_hang', runTimeoutMs: 1_500, outcome: 'TIMEOUT', rule: 'timeout', withoutRule: 'RUNTIME_ERROR',
    text: bench('tb_hang', [], { declarations: ["  signal clk : std_logic := '0';"], concurrent: ['  clk <= not clk after 5 ns;'] }),
  },
  {
    name: 'two contradictory printed summaries', entity: 'tb_twice', outcome: 'CONTRADICTORY_SUMMARY', rule: 'multiple-summaries', withoutRule: 'PASS',
    text: bench('tb_twice', [...finish('tb_twice', 'PASS', 2, 0, 'note'), reportLine(line('tb_twice', 'FAIL', 2, 1), 'note')], { resultFile: true }),
  },
  {
    name: 'prints a summary but writes no result file', entity: 'tb_unwritten', outcome: 'MISSING_SUMMARY', rule: 'summary-missing', withoutRule: 'PASS',
    text: bench('tb_unwritten', [reportLine(line('tb_unwritten', 'PASS', 2, 0), 'note')]),
  },
  {
    name: 'an error reported after the summary', entity: 'tb_late', outcome: 'CONTRADICTORY_SUMMARY', rule: 'reports-after-summary', withoutRule: 'PASS',
    text: bench('tb_late', [...finish('tb_late', 'PASS', 1, 0, 'note'), 'assert false report "late check failed" severity error;'], { resultFile: true }),
  },
];

const requireGhdl = () => expect(ghdlAvailable, `REDBYTE_REQUIRE_GHDL=1 but REDBYTE_GHDL (${GHDL_PATH || 'unset'}) is not a ghdl executable`).toBe(true);

describe.skipIf(!ghdlAvailable && !ghdlRequired)('runGhdlFiles + classifyGhdlRun on real GHDL', () => {
  it.each(REAL_CASES)('$name -> $outcome', ({ entity, elaborate, text, runTimeoutMs, outcome, rule, withoutRule }) => {
    requireGhdl();
    const started = Date.now();
    const run = runGhdlFiles([{ name: `${entity}.vhd`, text }], elaborate ?? entity, '08', runTimeoutMs ?? 20_000);
    const verdict = classifyGhdlRun(run);
    expect({ outcome: verdict.outcome, rule: verdict.rule }, `${verdict.detail}\n${run.log}`).toEqual({ outcome, rule });
    if (withoutRule) expect(classifyGhdlRun(run, {}, without(rule)).outcome).toBe(withoutRule);
    if (outcome === 'TIMEOUT') {
      expect(run.timedOut).toBe(true);
      expect(Date.now() - started).toBeLessThan(15_000);
    }
  }, 60_000);

  it('a real PASS still depends on the expected entity and check count', () => {
    requireGhdl();
    const [pass] = REAL_CASES;
    const run = runGhdlFiles([{ name: 'tb_pass.vhd', text: pass.text }], 'tb_pass');
    expect(run).toMatchObject({ analyzeStatus: 0, elaborateStatus: 0, runStatus: 0, timedOut: false, printedMarkers: 1, writtenMarkers: 1 });
    expect(run.printed).toEqual([summary('PASS', 2, 0, 'tb_pass')]);
    expect(run.written).toEqual(run.printed);
    expect(classifyGhdlRun(run, { expectedChecks: 2 }).outcome).toBe('PASS');
    expect(classifyGhdlRun(run, { expectedChecks: 3 })).toMatchObject({ outcome: 'CONTRADICTORY_SUMMARY', rule: 'check-count-mismatch' });
    expect(classifyGhdlRun(run, { tbEntity: 'tb_top' })).toMatchObject({ outcome: 'CONTRADICTORY_SUMMARY', rule: 'wrong-testbench' });
  }, 60_000);

  it('skips elaboration and run after an analysis error', () => {
    requireGhdl();
    const syntax = REAL_CASES.find((c) => c.entity === 'tb_syntax')!;
    const run = runGhdlFiles([{ name: 'tb_syntax.vhd', text: syntax.text }], 'tb_syntax');
    expect(run).toMatchObject({ elaborateStatus: null, runStatus: null, skippedSteps: ['elaborate', 'run'] });
    expect(run.analyzeStatus).not.toBe(0);
  }, 60_000);
});
