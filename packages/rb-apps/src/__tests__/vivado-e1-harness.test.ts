// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  createFromScratchCombSwitchAndBasys3Project,
  createFromScratchSeqTwoBitCounterBasys3Project,
} from '../apps/ide/fixtures/fromScratchBasys3CertProjects';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { buildVivadoProjectFolderZip, deriveVivadoProjectSlug } from '../fpga/vivado/vivadoProjectFolder';
import type { RBProject } from '../export/projectFormat';
import type { TestVector } from '@redbyte/rb-utils';
import { ghdlRequired } from './helpers/ghdlHarness';

/**
 * Vivado E1 harness fail-closed contract (Defect B).
 *
 * Vivado is not installed here, so nothing in this file is E1 evidence. It proves the
 * harness's own logic:
 *   1. static contract checks on the scripts (always run);
 *   2. the pure E1c classifier, table-tested in tclsh;
 *   3. the real redbyte-e1-certify.tcl driven by a fake Vivado (a tclsh stub defining the
 *      Vivado commands), including a mode where GHDL really simulates the package;
 *   4. the real redbyte-e1-certify.ps1 wrapper against a real exported package and the fake.
 * Tiers 2-4 need tclsh (REDBYTE_TCLSH or Git for Windows'); tier 4 also needs Windows.
 * Missing tools report as skipped, never as passed; with REDBYTE_REQUIRE_GHDL=1 a missing GHDL fails.
 */

const REPO = resolve(__dirname, '../../../..');
const CERTIFY_TCL = join(REPO, 'scripts/vivado/redbyte-e1-certify.tcl');
const CLASSIFY_TCL = join(REPO, 'scripts/vivado/redbyte-e1-classify.tcl');
const CERTIFY_PS1 = join(REPO, 'scripts/vivado/redbyte-e1-certify.ps1');
const PACK_RUNNER_PS1 = join(REPO, 'scripts/vivado/redbyte-e1-pack-runner.ps1');
const COLLECT_PS1 = join(REPO, 'scripts/vivado/redbyte-e1-collect.ps1');
const FIXTURES = join(__dirname, 'fixtures/vivado-e1');

function findTclsh(): string | null {
  const candidates = [
    process.env.REDBYTE_TCLSH,
    'C:\\Program Files\\Git\\mingw64\\bin\\tclsh.exe',
    'C:\\Program Files\\Git\\usr\\bin\\tclsh.exe',
    '/usr/bin/tclsh',
  ].filter((c): c is string => Boolean(c && c.trim()));
  return candidates.find((c) => existsSync(c)) ?? null;
}

const TCLSH = findTclsh();
const GHDL = process.env.REDBYTE_GHDL?.trim() ?? '';
const ghdlAvailable = GHDL.length > 0 && existsSync(GHDL);
const windows = process.platform === 'win32';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('E1 harness scripts: static fail-closed contract', () => {
  const tcl = read(CERTIFY_TCL);
  const ps1 = read(CERTIFY_PS1);

  it('never hard-codes the simulation top', () => {
    expect(tcl).not.toMatch(/\btb_top\b/);
    expect(tcl).toMatch(/set_property top \$tb_entity \$sim_fs/);
  });

  it('deletes stale results before running and contains every stage in one catch', () => {
    expect(tcl).toMatch(/foreach stale \{e1-result\.json e1-result\.json\.tmp e1-progress\.json e1-progress\.json\.tmp\}/);
    expect(tcl).toMatch(/if \{\[catch \{rb_e1_main\} err\]\} \{[\s\S]*?HARNESS_ERROR 10/);
    expect(tcl).toMatch(/file rename -force \$tmp \$path/);
    expect(tcl).toContain('redbyte.vivado-e1.tcl-result.v2');
  });

  it('decides E1c through the pure classifier and the testbench result file', () => {
    expect(tcl).toMatch(/source \[file join .*redbyte-e1-classify\.tcl\]/);
    expect(tcl).toContain('redbyte_tb_result.txt');
    expect(tcl).toContain('xsim.simulate.runtime');
    expect(tcl).not.toMatch(/\brun all\b/);
  });

  it('wrapper accepts only this run\'s v2 result and never invents a pass', () => {
    expect(ps1).not.toMatch(/\$classification = 'PASS_E1'/);
    expect(ps1).not.toMatch(/\$classification = 'FAIL_SYNTH'/);
    expect(ps1).toMatch(/\$tclResult\.runId -ne \$runId/);
    expect(ps1).toMatch(/WaitForExit\(\$TimeoutMs\)/);
    expect(ps1).toMatch(/-RedirectStandardOutput \$StdoutPath/);
    expect(ps1).toMatch(/if \(\$Mode -eq 'Certify' -and \$verdict -ne 'pass-e1'\) \{\s+exit 1/);
    expect(ps1).not.toMatch(/Set-Content -LiteralPath \$Path[^\n]*-Encoding UTF8/);
  });

  it('the Gannon run kit ships the classifier and the package matcher with the certify script', () => {
    expect(read(PACK_RUNNER_PS1)).toContain("'scripts/vivado/redbyte-e1-classify.tcl'");
    expect(read(PACK_RUNNER_PS1)).toContain("'scripts/vivado/redbyte-e1-packages.ps1'");
  });

  it('no script selects a package ZIP by substring', () => {
    for (const script of [CERTIFY_PS1, COLLECT_PS1, PACK_RUNNER_PS1]) {
      const text = read(script);
      expect(text, script).not.toMatch(/-like\s+"\*\$DesignId\*"/);
      expect(text, script).toMatch(/\. \(Join-Path \$PSScriptRoot 'redbyte-e1-packages\.ps1'\)/);
    }
  });
});

describe.skipIf(!TCLSH)('E1c classifier (tclsh table)', () => {
  // Collected even when skipped, so only spawn when tclsh exists.
  const run = TCLSH
    ? spawnSync(TCLSH, [join(FIXTURES, 'classify-cases.tcl'), CLASSIFY_TCL], { encoding: 'utf8' })
    : { status: null, stdout: '', stderr: '' };
  const rows = new Map(
    (run.stdout ?? '').trim().split(/\r?\n/).map((line) => {
      const [name, ...rest] = line.trim().split(' ');
      return [name, rest] as const;
    }),
  );

  it('runs cleanly', () => {
    expect(run.status, run.stderr).toBe(0);
  });

  it.each([
    ['pass', 'PASS', 'PASS_E1C', '0'],
    ['no-simulator', 'NO_SIMULATOR', 'BLOCKED_NO_SIM', '20'],
    ['no-sim-fileset', 'NOT_CONFIGURED', 'BLOCKED_NO_TESTBENCH', '21'],
    ['no-testbench-file', 'NOT_CONFIGURED', 'BLOCKED_NO_TESTBENCH', '21'],
    ['no-entity', 'NOT_CONFIGURED', 'BLOCKED_NO_TESTBENCH', '21'],
    ['compile-error', 'HDL_COMPILE_ERROR', 'FAIL_TESTBENCH_COMPILE', '22'],
    ['elab-error', 'HDL_ELAB_ERROR', 'FAIL_TESTBENCH_ELAB', '23'],
    ['launch-error', 'SIM_LAUNCH_ERROR', 'FAIL_TESTBENCH_LAUNCH', '24'],
    ['legacy-testbench', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['runtime-error', 'RUNTIME_ERROR', 'FAIL_TESTBENCH_RUNTIME', '25'],
    ['timeout', 'TIMEOUT', 'FAIL_TESTBENCH_TIMEOUT', '26'],
    ['silent-end', 'RUNTIME_ERROR', 'FAIL_TESTBENCH_RUNTIME', '25'],
    ['two-lines', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['garbled-line', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['wrong-tb', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['log-disagrees', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['fail', 'ASSERTION_FAILED', 'FAIL_TESTBENCH_ASSERTION', '28'],
    ['fail-surfaced-as-launch-error', 'ASSERTION_FAILED', 'FAIL_TESTBENCH_ASSERTION', '28'],
    ['no-checks', 'NO_CHECKS', 'FAIL_TESTBENCH_NO_CHECKS', '29'],
    ['pass-with-launch-error', 'RUNTIME_ERROR', 'FAIL_TESTBENCH_RUNTIME', '25'],
    ['pass-with-fatal', 'RUNTIME_ERROR', 'FAIL_TESTBENCH_RUNTIME', '25'],
    ['pass-zero-checks', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['pass-count-drift', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['pass-unknown-static-count', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['pass-with-mismatch-report', 'ASSERTION_FAILED', 'FAIL_TESTBENCH_ASSERTION', '28'],
    ['pass-failures-nonzero', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    // A simulator prefix before a log copy is fine; the result file is the authority, so a
    // missing log copy is not required (xsim's log routing is unobserved).
    ['pass-ghdl-log-prefix', 'PASS', 'PASS_E1C', '0'],
    ['pass-trailing-cr', 'PASS', 'PASS_E1C', '0'],
    ['pass-without-log-copy', 'PASS', 'PASS_E1C', '0'],
    // Markers are counted, not lines, and every marker must be the exact testbench grammar.
    ['log-truncated-fail', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['log-trailing-junk', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['log-two-markers', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['file-two-markers-one-line', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['file-trailing-status', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['file-failures-hex', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['file-checks-leading-zero', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['file-leading-junk', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['file-extra-line', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
    ['file-junk-only', 'CONTRACT_VIOLATION', 'FAIL_TESTBENCH_CONTRACT', '27'],
  ])('%s -> %s', (name, outcome, classification, code) => {
    expect(rows.get(name)).toEqual([outcome, classification, code]);
  });

  it('counts checks from the testbench source and recognises the result contract', () => {
    expect(rows.get('static-checks')).toEqual(['3']);
    expect(rows.get('has-contract')).toEqual(['1']);
  });
});

interface FakeProject {
  root: string;
  xpr: string;
  out: string;
}

/** A minimal Vivado-shaped project folder holding real generated artifacts. */
function makeFakeProject(topVhd: string, testbenchVhd: string): FakeProject {
  const root = mkdtempSync(join(tmpdir(), 'rb-e1-'));
  const proj = join(root, 'proj');
  mkdirSync(join(proj, 'proj.srcs/sources_1/new'), { recursive: true });
  mkdirSync(join(proj, 'proj.srcs/sim_1/new'), { recursive: true });
  writeFileSync(join(proj, 'proj.xpr'), '<Project/>\n');
  writeFileSync(join(proj, 'proj.srcs/sources_1/new/top.vhd'), topVhd);
  writeFileSync(join(proj, 'proj.srcs/sim_1/new/testbench.vhd'), testbenchVhd);
  return { root, xpr: join(proj, 'proj.xpr'), out: join(root, 'out') };
}

function artifactsOf(project: RBProject): { topVhd: string; testbenchVhd: string } {
  const vm = buildExportViewModel(project);
  expect(vm.status).toBe('ok');
  return {
    topVhd: vm.artifacts.find((a) => a.path === 'top.vhd')!.content,
    testbenchVhd: vm.artifacts.find((a) => a.path === 'testbench.vhd')!.content,
  };
}

interface CertifyOutcome {
  status: number | null;
  stdout: string;
  result: Record<string, any> | null;
}

function runCertify(fake: FakeProject, scenario: string, runId = 'run-under-test'): CertifyOutcome {
  const run = spawnSync(
    TCLSH!,
    [join(FIXTURES, 'fake-vivado.tcl'), '-mode', 'batch', '-source', CERTIFY_TCL, '-log', join(fake.out, 'logs/vivado.log'),
      '-tclargs', fake.xpr, fake.out, runId, '4', 'false', '2000'],
    { encoding: 'utf8', env: { ...process.env, FAKE_SCENARIO: scenario }, timeout: 120_000 },
  );
  const resultPath = join(fake.out, 'e1-result.json');
  return {
    status: run.status,
    stdout: `${run.stdout ?? ''}${run.stderr ?? ''}`,
    result: existsSync(resultPath) ? JSON.parse(read(resultPath)) : null,
  };
}

describe.skipIf(!TCLSH)('redbyte-e1-certify.tcl under a fake Vivado', () => {
  const comb = artifactsOf(createFromScratchCombSwitchAndBasys3Project());

  it.each([
    ['pass', 'PASS_E1', 0, 'pass'],
    ['assertion', 'FAIL_TESTBENCH_ASSERTION', 28, 'fail'],
    ['failure-as-error', 'FAIL_TESTBENCH_ASSERTION', 28, 'fail'],
    ['no-checks', 'FAIL_TESTBENCH_NO_CHECKS', 29, 'fail'],
    ['elab-error', 'FAIL_TESTBENCH_ELAB', 23, 'fail'],
    ['compile-error', 'FAIL_TESTBENCH_COMPILE', 22, 'fail'],
    ['no-sim', 'BLOCKED_NO_TESTBENCH', 21, 'blocked'],
    ['hang', 'FAIL_TESTBENCH_TIMEOUT', 26, 'fail'],
    ['silent', 'FAIL_TESTBENCH_RUNTIME', 25, 'fail'],
    ['wrong-tb', 'FAIL_TESTBENCH_CONTRACT', 27, 'fail'],
    ['wrong-count', 'FAIL_TESTBENCH_CONTRACT', 27, 'fail'],
    ['two-lines', 'FAIL_TESTBENCH_CONTRACT', 27, 'fail'],
    ['log-conflict', 'FAIL_TESTBENCH_CONTRACT', 27, 'fail'],
    ['pass-with-mismatch', 'FAIL_TESTBENCH_ASSERTION', 28, 'fail'],
    ['two-markers-one-line', 'FAIL_TESTBENCH_CONTRACT', 27, 'fail'],
    ['trailing-junk', 'FAIL_TESTBENCH_CONTRACT', 27, 'fail'],
    ['extra-result-line', 'FAIL_TESTBENCH_CONTRACT', 27, 'fail'],
    ['log-truncated', 'FAIL_TESTBENCH_CONTRACT', 27, 'fail'],
    ['synth-fail', 'FAIL_SYNTH', 5, 'pass'],
    ['harness-crash', 'HARNESS_ERROR', 10, 'pending'],
  ])('%s -> %s (exit %d)', (scenario, classification, exitCode, e1cStatus) => {
    const fake = makeFakeProject(comb.topVhd, comb.testbenchVhd);
    try {
      const outcome = runCertify(fake, scenario);
      expect(outcome.status, outcome.stdout).toBe(exitCode);
      expect(outcome.result?.classification, outcome.stdout).toBe(classification);
      expect(outcome.result?.exitCode).toBe(exitCode);
      expect(outcome.result?.schema).toBe('redbyte.vivado-e1.tcl-result.v2');
      expect(outcome.result?.runId).toBe('run-under-test');
      expect(outcome.result?.stages.E1c.status).toBe(e1cStatus);
      if (classification !== 'PASS_E1') expect(outcome.result?.failedStage).not.toBe('');
    } finally {
      rmSync(fake.root, { recursive: true, force: true });
    }
  }, 120_000);

  it('elaborates the entity the testbench declares, not a fixed tb_top', () => {
    const project = createFromScratchCombSwitchAndBasys3Project();
    const named = artifactsOf({ ...project, fpga: { ...project.fpga!, top: 'and_gate_top' } });
    const fake = makeFakeProject(named.topVhd, named.testbenchVhd);
    try {
      const outcome = runCertify(fake, 'pass');
      expect(outcome.stdout).toContain('fake set_property top tb_and_gate_top sim_1');
      expect(outcome.result?.classification, outcome.stdout).toBe('PASS_E1');
      expect(outcome.result?.e1c.tbEntity).toBe('tb_and_gate_top');
    } finally {
      rmSync(fake.root, { recursive: true, force: true });
    }
  }, 120_000);

  it('a stale result from an earlier run can never be read as this run\'s pass', () => {
    const fake = makeFakeProject(comb.topVhd, comb.testbenchVhd);
    try {
      mkdirSync(fake.out, { recursive: true });
      writeFileSync(join(fake.out, 'e1-result.json'), '{"schema":"redbyte.vivado-e1.tcl-result.v2","runId":"old","classification":"PASS_E1"}');
      const stale = join(dirname(fake.xpr), 'proj.sim/sim_1/behav/xsim');
      mkdirSync(stale, { recursive: true });
      writeFileSync(join(stale, 'redbyte_tb_result.txt'), 'REDBYTE_TB_RESULT v=1 tb=tb_top status=PASS checks=4 failures=0\n');

      const crashed = runCertify(fake, 'exit0-no-result');
      expect(crashed.status).toBe(0);
      expect(crashed.result).toBeNull();

      const silent = runCertify(fake, 'silent');
      expect(silent.result?.classification).toBe('FAIL_TESTBENCH_RUNTIME');
    } finally {
      rmSync(fake.root, { recursive: true, force: true });
    }
  }, 120_000);

  it('a legacy testbench without the self-check cannot pass', () => {
    const legacy = comb.testbenchVhd.replace(/REDBYTE_TB_RESULT v=1/g, 'LEGACY');
    const fake = makeFakeProject(comb.topVhd, legacy);
    try {
      expect(runCertify(fake, 'silent').result?.classification).toBe('FAIL_TESTBENCH_CONTRACT');
    } finally {
      rmSync(fake.root, { recursive: true, force: true });
    }
  }, 120_000);

  it('escapes control characters so the result is always valid JSON', () => {
    const fake = makeFakeProject(comb.topVhd, comb.testbenchVhd);
    try {
      const outcome = runCertify(fake, 'control-chars');
      expect(outcome.result?.classification).toBe('FAIL_TESTBENCH_LAUNCH');
      expect(outcome.result?.message).toContain('\u001b');
    } finally {
      rmSync(fake.root, { recursive: true, force: true });
    }
  }, 120_000);
});

function flipExpectation(vectors: TestVector[], index: number): TestVector[] {
  return vectors.map((vector, i) => {
    if (i !== index) return vector;
    const [key] = Object.keys(vector.expected);
    return { ...vector, expected: { ...vector.expected, [key]: vector.expected[key] ? 0 : 1 } };
  });
}

describe.skipIf(ghdlAvailable)('redbyte-e1-certify.tcl with GHDL standing in for xsim (GHDL unavailable)', () => {
  it.skipIf(!ghdlRequired)('REDBYTE_GHDL is not set to a ghdl executable; the GHDL tier did not run', () => {
    expect(ghdlAvailable, 'REDBYTE_REQUIRE_GHDL=1 but REDBYTE_GHDL is not a ghdl executable').toBe(true);
  });
});

describe.skipIf(!TCLSH || !ghdlAvailable)('redbyte-e1-certify.tcl with GHDL standing in for xsim', () => {
  it.each([
    ['combinational pass', 'PASS_E1', 'comb', false],
    ['combinational wrong expectation', 'FAIL_TESTBENCH_ASSERTION', 'comb', true],
    ['counter pass', 'PASS_E1', 'counter', false],
    ['counter wrong expectation', 'FAIL_TESTBENCH_ASSERTION', 'counter', true],
  ] as const)('%s -> %s', (_label, classification, design, mutate) => {
    const base =
      design === 'comb' ? createFromScratchCombSwitchAndBasys3Project() : createFromScratchSeqTwoBitCounterBasys3Project();
    const project = mutate ? { ...base, vectors: flipExpectation(base.vectors ?? [], 3) } : base;
    const { topVhd, testbenchVhd } = artifactsOf(project);
    const fake = makeFakeProject(topVhd, testbenchVhd);
    try {
      const outcome = runCertify(fake, 'ghdl');
      expect(outcome.result?.classification, outcome.stdout).toBe(classification);
      if (classification === 'PASS_E1') expect(outcome.result?.e1c.resultLine).toMatch(/status=PASS checks=\d+ failures=0$/);
    } finally {
      rmSync(fake.root, { recursive: true, force: true });
    }
  }, 180_000);
});

function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

interface PackageOptions {
  /** Project folder slug inside the ZIP (defaults to the project's own). */
  slug?: string;
  /** Rewrites top.vhd before packaging. */
  editTop?: (topVhd: string) => string;
  /** Adds a second .xpr project file next to the real one. */
  extraXpr?: boolean;
}

interface WrittenPackage {
  path: string;
  sha256: string;
  /** SHA-256 of the .xpr entry inside the ZIP. */
  xprSha256: string;
}

async function writePackageZip(project: RBProject, dir: string, fileName: string, options: PackageOptions = {}): Promise<WrittenPackage> {
  const vm = buildExportViewModel(project);
  expect(vm.status).toBe('ok');
  const slug = options.slug ?? deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);
  let bytes = await buildVivadoProjectFolderZip({
    artifacts: vm.artifacts.map((a) => ({
      path: a.path,
      content: a.path === 'top.vhd' && options.editTop ? options.editTop(a.content) : a.content,
    })),
    projectName: project.name,
    projectSlug: slug,
    topModule: vm.topAuthority.designTop,
    part: project.fpga?.part,
  });
  const zip = await JSZip.loadAsync(bytes);
  const xprEntry = zip.file(`${slug}/${slug}.xpr`);
  expect(xprEntry).not.toBeNull();
  const xprBytes = await xprEntry!.async('uint8array');
  if (options.extraXpr) {
    zip.file(`${slug}/zzz-second.xpr`, xprBytes);
    bytes = await zip.generateAsync({ type: 'uint8array' });
  }
  mkdirSync(dir, { recursive: true });
  const path = join(dir, fileName);
  writeFileSync(path, bytes);
  return { path, sha256: sha256(bytes), xprSha256: sha256(xprBytes) };
}

interface WrapperOutcome {
  status: number | null;
  output: string;
  manifest: Record<string, any> | null;
}

interface WrapperOptions {
  zipDir?: string;
  out?: string;
  timeoutMinutes?: string;
}

function runWrapper(root: string, scenario: string, designId: string, options: WrapperOptions = {}): WrapperOutcome {
  const fakeDir = join(root, 'fake');
  mkdirSync(fakeDir, { recursive: true });
  copyFileSync(join(FIXTURES, 'fake-vivado.tcl'), join(fakeDir, 'fake-vivado.tcl'));
  writeFileSync(
    join(fakeDir, 'vivado.cmd'),
    `@echo off\r\n"${TCLSH}" "%~dp0fake-vivado.tcl" %*\r\nexit /b %ERRORLEVEL%\r\n`,
  );
  const out = options.out ?? join(root, `out-${scenario}`);
  const run = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', CERTIFY_PS1, '-Mode', 'Certify', '-ZipDir', options.zipDir ?? join(root, 'zips'),
      '-OutDir', out, '-DesignIds', designId, '-VivadoPath', join(fakeDir, 'vivado.cmd'), '-TimeoutMinutes', options.timeoutMinutes ?? '5'],
    { encoding: 'utf8', env: { ...process.env, FAKE_SCENARIO: scenario }, timeout: 300_000 },
  );
  const manifestPath = join(out, 'manifest.json');
  return {
    status: run.status,
    output: `${run.stdout ?? ''}${run.stderr ?? ''}`,
    manifest: existsSync(manifestPath) ? JSON.parse(read(manifestPath)) : null,
  };
}

describe.skipIf(!TCLSH || !windows)('redbyte-e1-certify.ps1 against a real package and a fake Vivado', () => {
  const designId = 'fs-comb-switch-and';

  async function withRoot<T>(fn: (root: string) => Promise<T> | T): Promise<T> {
    const root = mkdtempSync(join(tmpdir(), 'rb-e1-ps1-'));
    try {
      return await fn(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  async function withPackage<T>(fn: (root: string) => T): Promise<T> {
    return withRoot(async (root) => {
      await writePackageZip(createFromScratchCombSwitchAndBasys3Project(), join(root, 'zips'), `${designId}-vivado-project.zip`);
      return fn(root);
    });
  }

  it.each([
    ['pass', 'PASS_E1', 'pass-e1', 0, true],
    ['noisy', 'PASS_E1', 'pass-e1', 0, true],
    ['assertion', 'FAIL_TESTBENCH_ASSERTION', 'failed', 1, false],
    ['no-checks', 'FAIL_TESTBENCH_NO_CHECKS', 'failed', 1, false],
    ['crash137', 'INTERRUPTED', 'failed', 1, false],
    ['exit0-no-result', 'INTERRUPTED', 'failed', 1, false],
    ['forged-result', 'HARNESS_ERROR', 'failed', 1, false],
    ['vivado-log-conflict', 'EVIDENCE_CONFLICT', 'failed', 1, false],
    ['vivado-log-truncated', 'EVIDENCE_CONFLICT', 'failed', 1, false],
    ['no-sim', 'BLOCKED_NO_TESTBENCH', 'blocked', 1, false],
  ])('%s -> %s, verdict %s, exit %d', async (scenario, classification, verdict, exitCode, testbenchFlag) => {
    await withPackage((root) => {
      const outcome = runWrapper(root, scenario, designId);
      expect(outcome.manifest, outcome.output).not.toBeNull();
      const design = outcome.manifest!.designs[0];
      expect(design.classification, `${outcome.output}\n${design.vivadoRun?.acceptance}`).toBe(classification);
      expect(outcome.manifest!.verdict).toBe(verdict);
      expect(outcome.status, outcome.output).toBe(exitCode);
      expect(design.e1.testbench).toBe(testbenchFlag);
    });
  }, 300_000);

  it('a hung Vivado is stopped at the wall-clock limit and is a TIMEOUT', async () => {
    await withPackage((root) => {
      const outcome = runWrapper(root, 'wallclock-hang', designId, { timeoutMinutes: '0.1' });
      const design = outcome.manifest!.designs[0];
      expect(design.classification, outcome.output).toBe('TIMEOUT');
      expect(design.vivadoRun.timedOut).toBe(true);
      expect(design.vivadoRun.lastStage).toBe('E1c-behavioral-sim');
      expect(outcome.status).toBe(1);
    });
  }, 300_000);

  it('a reused -OutDir is refused: a new ZIP is never certified against an earlier extraction', async () => {
    await withRoot(async (root) => {
      const project = createFromScratchCombSwitchAndBasys3Project();
      const first = await writePackageZip(project, join(root, 'zips-first'), 'lab-vivado-project.zip', { slug: 'aaa-lab' });
      const second = await writePackageZip(project, join(root, 'zips-second'), 'lab-vivado-project.zip', { slug: 'zzz-lab' });
      const out = join(root, 'out-reused');

      const run1 = runWrapper(root, 'pass', 'lab', { zipDir: join(root, 'zips-first'), out });
      expect(run1.manifest?.verdict, run1.output).toBe('pass-e1');
      const manifestBefore = read(join(out, 'manifest.json'));

      const run2 = runWrapper(root, 'pass', 'lab', { zipDir: join(root, 'zips-second'), out });
      const recorded = run2.manifest?.designs?.[0];
      expect(run2.status, `zip ${recorded?.zipSha256} certified with xpr ${recorded?.files?.xpr}\n${run2.output}`).toBe(2);
      expect(run2.output).toMatch(/refused: output folder .* is not empty/);
      expect(read(join(out, 'manifest.json'))).toBe(manifestBefore);
      expect(run1.manifest!.designs[0].zipSha256).toBe(first.sha256);

      // A fresh folder analyses only the ZIP it names, and the manifest binds ZIP, .xpr path and .xpr hash.
      const fresh = runWrapper(root, 'pass', 'lab', { zipDir: join(root, 'zips-second'), out: join(root, 'out-fresh') });
      const design = fresh.manifest!.designs[0];
      expect(design.classification, fresh.output).toBe('PASS_E1');
      expect(design.zipSha256).toBe(second.sha256);
      expect(design.xprZipEntry).toBe('zzz-lab/zzz-lab.xpr');
      expect(design.files.xpr).toMatch(/[\\/]extracted[\\/]zzz-lab[\\/]zzz-lab\.xpr$/);
      expect(design.xprSha256).toBe(second.xprSha256);
    });
  }, 300_000);

  // The names RedByte's own tools give design <id>'s package (see redbyte-e1-packages.ps1).
  it.each([
    [`${designId}-vivado-project.zip`],
    [`rb-${designId}-41vclq-vivado-project.zip`],
    [`${designId}-rb-${designId}-41vclq-vivado-project.zip`],
    [`${designId}.zip`],
  ])('-DesignIds selects the exported name %s', async (fileName) => {
    await withRoot(async (root) => {
      await writePackageZip(createFromScratchCombSwitchAndBasys3Project(), join(root, 'zips'), fileName);
      const outcome = runWrapper(root, 'pass', designId);
      const design = outcome.manifest!.designs[0];
      expect(design.classification, outcome.output).toBe('PASS_E1');
      expect(design.zipPath.endsWith(`\\${fileName}`)).toBe(true);
    });
  }, 300_000);

  it('-DesignIds matches exactly: a newer package with a longer name is never selected', async () => {
    await withRoot(async (root) => {
      const project = createFromScratchCombSwitchAndBasys3Project();
      await writePackageZip(project, join(root, 'zips'), `${designId}-vivado-project.zip`);
      const longer = await writePackageZip(project, join(root, 'zips'), `${designId}-hierarchical-vivado-project.zip`, { slug: 'hier' });
      const later = new Date(Date.now() + 60_000);
      utimesSync(longer.path, later, later);
      const outcome = runWrapper(root, 'pass', designId);
      expect(outcome.manifest!.designs[0].zipPath, outcome.output).toMatch(new RegExp(`\\\\${designId}-vivado-project\\.zip$`));
    });
  }, 300_000);

  it.each([
    [`${designId}-hierarchical-vivado-project.zip`],
    [`rb-${designId}-hierarchical-41vxyz-vivado-project.zip`],
    [`old-${designId}-vivado-project.zip`],
  ])('a package named %s alone is BLOCKED_PACKAGE_MISSING for the shorter id', async (fileName) => {
    await withRoot(async (root) => {
      await writePackageZip(createFromScratchCombSwitchAndBasys3Project(), join(root, 'zips'), fileName);
      const outcome = runWrapper(root, 'pass', designId);
      const design = outcome.manifest!.designs[0];
      expect(design.classification, `${outcome.output}\n${design.zipPath}`).toBe('BLOCKED_PACKAGE_MISSING');
      expect(outcome.manifest!.verdict).toBe('blocked');
      expect(outcome.status).toBe(1);
    });
  }, 300_000);

  it('two packages that both match a design id exactly are BLOCKED_PACKAGE_AMBIGUOUS, not the newest', async () => {
    await withRoot(async (root) => {
      const project = createFromScratchCombSwitchAndBasys3Project();
      await writePackageZip(project, join(root, 'zips', 'a'), `${designId}-vivado-project.zip`);
      await writePackageZip(project, join(root, 'zips', 'b'), `rb-${designId}-41vclq-vivado-project.zip`);
      const outcome = runWrapper(root, 'pass', designId);
      const design = outcome.manifest!.designs[0];
      expect(design.classification, outcome.output).toBe('BLOCKED_PACKAGE_AMBIGUOUS');
      expect(design.issues.join('\n')).toMatch(/2 ZIP packages match/);
      expect(outcome.status).toBe(1);
    });
  }, 300_000);

  it('a design id that is not a RedByte project slug is refused before anything is written', async () => {
    await withRoot(async (root) => {
      const outcome = runWrapper(root, 'pass', '..\\escape');
      expect(outcome.status, outcome.output).toBe(2);
      expect(outcome.output).toMatch(/refused: design id/);
      expect(existsSync(join(root, 'out-pass'))).toBe(false);
    });
  }, 300_000);

  it('the collector copies only the exactly named package', async () => {
    await withRoot(async (root) => {
      const project = createFromScratchCombSwitchAndBasys3Project();
      await writePackageZip(project, join(root, 'zips'), `${designId}-vivado-project.zip`);
      const longer = await writePackageZip(project, join(root, 'zips'), `${designId}-hierarchical-vivado-project.zip`, { slug: 'hier' });
      const later = new Date(Date.now() + 60_000);
      utimesSync(longer.path, later, later);
      const collected = join(root, 'collected');
      const run = spawnSync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', COLLECT_PS1, '-Mode', 'ExistingZipDir', '-InputZipDir', join(root, 'zips'),
          '-OutputZipDir', collected, '-DesignIds', designId],
        { encoding: 'utf8', timeout: 120_000 },
      );
      expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
      const summary = JSON.parse(read(join(collected, 'collection-summary.json')).replace(/^﻿/, ''));
      expect(summary.records[0].status).toBe('copied');
      expect(summary.records[0].source).toMatch(new RegExp(`\\\\${designId}-vivado-project\\.zip$`));
    });
  }, 300_000);

  it('the unsupported-construct scan ignores comments: a project named "After school lab" is not blocked', async () => {
    await withRoot(async (root) => {
      const project = { ...createFromScratchCombSwitchAndBasys3Project(), name: 'After school lab' };
      let top = '';
      await writePackageZip(project, join(root, 'zips'), `${designId}-vivado-project.zip`, { editTop: (text) => (top = text) });
      expect(top).toMatch(/^-- Project: After school lab\b/m);
      const outcome = runWrapper(root, 'pass', designId);
      const design = outcome.manifest!.designs[0];
      expect(design.packageFacts.unsupportedTopConstructs).toEqual([]);
      expect(design.classification, outcome.output).toBe('PASS_E1');
    });
  }, 300_000);

  it('an after clause in top.vhd code is still BLOCKED_UNSUPPORTED_CONSTRUCT, even behind a "--" string literal', async () => {
    await withRoot(async (root) => {
      const injected = '  -- wait: this comment is not code\n  probe_text <= "--"; LD0 <= SW0 after 1 ns;\n';
      await writePackageZip(createFromScratchCombSwitchAndBasys3Project(), join(root, 'zips'), `${designId}-vivado-project.zip`, {
        editTop: (text) => {
          const edited = text.replace(/^begin\r?\n/m, (line) => `${line}${injected}`);
          expect(edited).not.toBe(text);
          return edited;
        },
      });
      const outcome = runWrapper(root, 'pass', designId);
      const design = outcome.manifest!.designs[0];
      expect(design.packageFacts.unsupportedTopConstructs, outcome.output).toEqual(['after-delay']);
      expect(design.classification).toBe('BLOCKED_UNSUPPORTED_CONSTRUCT');
      expect(design.vivadoRun.attempted).toBe(false);
      expect(outcome.status).toBe(1);
    });
  }, 300_000);

  it('a package holding two .xpr projects is a named FAIL_IMPORT and never reaches Vivado', async () => {
    await withRoot(async (root) => {
      await writePackageZip(createFromScratchCombSwitchAndBasys3Project(), join(root, 'zips'), `${designId}-vivado-project.zip`, { extraXpr: true });
      const outcome = runWrapper(root, 'pass', designId);
      const design = outcome.manifest!.designs[0];
      expect(design.classification, outcome.output).toBe('FAIL_IMPORT');
      expect(design.issues.join('\n')).toMatch(/exactly one \.xpr project; found 2/);
      expect(design.vivadoRun.attempted).toBe(false);
      expect(outcome.status).toBe(1);
    });
  }, 300_000);
});
