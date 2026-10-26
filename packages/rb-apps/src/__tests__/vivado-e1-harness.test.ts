// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
 * Missing tools report as skipped, never as passed.
 */

const REPO = resolve(__dirname, '../../../..');
const CERTIFY_TCL = join(REPO, 'scripts/vivado/redbyte-e1-certify.tcl');
const CLASSIFY_TCL = join(REPO, 'scripts/vivado/redbyte-e1-classify.tcl');
const CERTIFY_PS1 = join(REPO, 'scripts/vivado/redbyte-e1-certify.ps1');
const PACK_RUNNER_PS1 = join(REPO, 'scripts/vivado/redbyte-e1-pack-runner.ps1');
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

  it('the Gannon run kit ships the classifier with the certify script', () => {
    expect(read(PACK_RUNNER_PS1)).toContain("'scripts/vivado/redbyte-e1-classify.tcl'");
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

async function writePackageZip(project: RBProject, dir: string, designId: string): Promise<void> {
  const vm = buildExportViewModel(project);
  expect(vm.status).toBe('ok');
  const bytes = await buildVivadoProjectFolderZip({
    artifacts: vm.artifacts.map((a) => ({ path: a.path, content: a.content })),
    projectName: project.name,
    projectSlug: deriveVivadoProjectSlug(project.meta?.projectId ?? project.name),
    topModule: vm.topAuthority.designTop,
    part: project.fpga?.part,
  });
  await JSZip.loadAsync(bytes);
  writeFileSync(join(dir, `${designId}-vivado-project.zip`), bytes);
}

interface WrapperOutcome {
  status: number | null;
  output: string;
  manifest: Record<string, any> | null;
}

function runWrapper(root: string, scenario: string, designId: string, timeoutMinutes = '5'): WrapperOutcome {
  const fakeDir = join(root, 'fake');
  mkdirSync(fakeDir, { recursive: true });
  copyFileSync(join(FIXTURES, 'fake-vivado.tcl'), join(fakeDir, 'fake-vivado.tcl'));
  writeFileSync(
    join(fakeDir, 'vivado.cmd'),
    `@echo off\r\n"${TCLSH}" "%~dp0fake-vivado.tcl" %*\r\nexit /b %ERRORLEVEL%\r\n`,
  );
  const out = join(root, `out-${scenario}`);
  const run = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', CERTIFY_PS1, '-Mode', 'Certify', '-ZipDir', join(root, 'zips'),
      '-OutDir', out, '-DesignIds', designId, '-VivadoPath', join(fakeDir, 'vivado.cmd'), '-TimeoutMinutes', timeoutMinutes],
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

  async function withPackage<T>(fn: (root: string) => T): Promise<T> {
    const root = mkdtempSync(join(tmpdir(), 'rb-e1-ps1-'));
    mkdirSync(join(root, 'zips'));
    await writePackageZip(createFromScratchCombSwitchAndBasys3Project(), join(root, 'zips'), designId);
    try {
      return fn(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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
      const outcome = runWrapper(root, 'wallclock-hang', designId, '0.1');
      const design = outcome.manifest!.designs[0];
      expect(design.classification, outcome.output).toBe('TIMEOUT');
      expect(design.vivadoRun.timedOut).toBe(true);
      expect(design.vivadoRun.lastStage).toBe('E1c-behavioral-sim');
      expect(outcome.status).toBe(1);
    });
  }, 300_000);
});
