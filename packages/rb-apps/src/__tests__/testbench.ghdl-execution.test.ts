// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import {
  createFromScratchCombSwitchAndBasys3Project,
  createFromScratchSeqTwoBitCounterBasys3Project,
} from '../apps/ide/fixtures/fromScratchBasys3CertProjects';
import { exportProjectAsBasys3 } from '../fpga/boards/basys3/basys3ExportService';
import { generateTestbenchVhdl } from '../fpga/boards/basys3/testbenchGenerator';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';

/**
 * Executes generated testbenches in GHDL (Defect A proof).
 *
 * Opt-in: set REDBYTE_GHDL to a ghdl executable. Without it every case is
 * reported as skipped, never as passed. Source-level text contracts live in
 * fpga/boards/basys3/__tests__/testbenchGenerator.selfCheck.test.ts.
 */

const GHDL = process.env.REDBYTE_GHDL?.trim() ?? '';
const ghdlAvailable = GHDL.length > 0 && existsSync(GHDL);
const RUN_TIMEOUT_MS = 20_000;

/** First entity declared in a testbench text (local, so this proof does not trust the code under test). */
function detectTestbenchEntityName(text: string): string | undefined {
  return text.match(/^\s*entity\s+([A-Za-z][A-Za-z0-9_]*)\s+is\b/im)?.[1];
}

interface GhdlOutcome {
  analyzeStatus: number | null;
  elaborateStatus: number | null;
  runStatus: number | null;
  timedOut: boolean;
  log: string;
  results: Array<{ tb: string; status: string; checks: number; failures: number }>;
}

function runGhdl(files: Array<{ name: string; text: string }>, tbEntity: string, std: '08' | '93c' = '08'): GhdlOutcome {
  const dir = mkdtempSync(join(tmpdir(), 'rb-ghdl-'));
  try {
    for (const file of files) writeFileSync(join(dir, file.name), file.text, 'utf8');
    const common = { cwd: dir, encoding: 'utf8' as const };
    const analyze = spawnSync(GHDL, ['-a', `--std=${std}`, ...files.map((f) => f.name)], { ...common, timeout: 60_000 });
    const elaborate = spawnSync(GHDL, ['-e', `--std=${std}`, tbEntity], { ...common, timeout: 60_000 });
    const run = spawnSync(GHDL, ['-r', `--std=${std}`, tbEntity], { ...common, timeout: RUN_TIMEOUT_MS });
    const log = [analyze, elaborate, run].map((r) => `${r.stdout ?? ''}${r.stderr ?? ''}`).join('\n');
    const results = [...`${run.stdout ?? ''}${run.stderr ?? ''}`.matchAll(
      /REDBYTE_TB_RESULT v=1 tb=(\w+) status=(\w+) checks=(\d+) failures=(\d+)/g,
    )].map((m) => ({ tb: m[1], status: m[2], checks: Number(m[3]), failures: Number(m[4]) }));
    return {
      analyzeStatus: analyze.status,
      elaborateStatus: elaborate.status,
      runStatus: run.status,
      timedOut: run.error !== undefined && /ETIMEDOUT/.test(String(run.error)),
      log,
      results,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function exportedFiles(project: RBProject): { files: Array<{ name: string; text: string }>; tb: string } {
  const result = exportProjectAsBasys3(project);
  expect(result.errors).toEqual([]);
  const testbench = result.bundle!.testbench!;
  return {
    files: [
      { name: 'top.vhd', text: result.bundle!.topVhd },
      { name: 'testbench.vhd', text: testbench },
    ],
    tb: detectTestbenchEntityName(testbench)!,
  };
}

function withVectors(project: RBProject, vectors: TestVector[]): RBProject {
  return { ...project, vectors };
}

function flipFirstExpectation(vectors: TestVector[], index: number): TestVector[] {
  return vectors.map((vector, i) => {
    if (i !== index) return vector;
    const [key] = Object.keys(vector.expected);
    return { ...vector, expected: { ...vector.expected, [key]: vector.expected[key] ? 0 : 1 } };
  });
}

/** The fixture counter with LD0 routed through two inverters after its flip-flop. */
function deepOutputCounter(): RBProject {
  const base = createFromScratchSeqTwoBitCounterBasys3Project();
  return {
    ...base,
    circuit: {
      ...base.circuit,
      nodes: [
        ...base.circuit.nodes,
        { id: 'inv_a', type: 'NOT', x: 640, y: 60, label: 'INVA', config: {}, state: {} },
        { id: 'inv_b', type: 'NOT', x: 680, y: 60, label: 'INVB', config: {}, state: {} },
      ],
      connections: [
        ...base.circuit.connections.filter(
          (c) =>
            !(typeof c.from === 'object' && c.from.nodeId === 'q0_ff' && typeof c.to === 'object' && c.to.nodeId === 'q0_out'),
        ),
        { id: 'q0_inva', from: { nodeId: 'q0_ff', portName: 'Q' }, to: { nodeId: 'inv_a', portName: 'in' } },
        { id: 'inva_invb', from: { nodeId: 'inv_a', portName: 'out' }, to: { nodeId: 'inv_b', portName: 'in' } },
        { id: 'invb_ld0', from: { nodeId: 'inv_b', portName: 'out' }, to: { nodeId: 'q0_out', portName: 'in' } },
      ],
    },
  };
}

describe.skipIf(!ghdlAvailable)('generated testbenches executed in GHDL', () => {
  it.each(['08', '93c'] as const)('combinational pass exits 0 with one PASS summary (VHDL-%s)', (std) => {
    const { files, tb } = exportedFiles(createFromScratchCombSwitchAndBasys3Project());
    const outcome = runGhdl(files, tb, std);
    expect(outcome.analyzeStatus, outcome.log).toBe(0);
    expect(outcome.runStatus, outcome.log).toBe(0);
    expect(outcome.results).toEqual([{ tb, status: 'PASS', checks: 4, failures: 0 }]);
  }, 120_000);

  it('combinational wrong expectation fails with a nonzero exit', () => {
    const base = createFromScratchCombSwitchAndBasys3Project();
    const { files, tb } = exportedFiles(withVectors(base, flipFirstExpectation(base.vectors ?? [], 3)));
    const outcome = runGhdl(files, tb);
    expect(outcome.runStatus, outcome.log).not.toBe(0);
    expect(outcome.results).toEqual([{ tb, status: 'FAIL', checks: 4, failures: 1 }]);
  }, 120_000);

  it('stimulus-only testbench reports NO_CHECKS with a nonzero exit', () => {
    const base = createFromScratchCombSwitchAndBasys3Project();
    const { files, tb } = exportedFiles(withVectors(base, (base.vectors ?? []).map((v) => ({ ...v, expected: {} }))));
    const outcome = runGhdl(files, tb);
    expect(outcome.runStatus, outcome.log).not.toBe(0);
    expect(outcome.results).toEqual([{ tb, status: 'NO_CHECKS', checks: 0, failures: 0 }]);
  }, 120_000);

  it('auto board-clock counter terminates on its own and passes', () => {
    const { files, tb } = exportedFiles(createFromScratchSeqTwoBitCounterBasys3Project());
    const outcome = runGhdl(files, tb);
    expect(outcome.timedOut, outcome.log).toBe(false);
    expect(outcome.runStatus, outcome.log).toBe(0);
    expect(outcome.results).toEqual([{ tb, status: 'PASS', checks: 14, failures: 0 }]);
  }, 120_000);

  it('auto board-clock counter with a wrong expectation terminates and fails', () => {
    const base = createFromScratchSeqTwoBitCounterBasys3Project();
    const { files, tb } = exportedFiles(withVectors(base, flipFirstExpectation(base.vectors ?? [], 4)));
    const outcome = runGhdl(files, tb);
    expect(outcome.timedOut, outcome.log).toBe(false);
    expect(outcome.runStatus, outcome.log).not.toBe(0);
    expect(outcome.results).toEqual([{ tb, status: 'FAIL', checks: 14, failures: 1 }]);
  }, 120_000);

  it('auto board-clock sampling waits for logic after the flip-flop to settle', () => {
    const { files, tb } = exportedFiles(deepOutputCounter());
    const outcome = runGhdl(files, tb);
    expect(outcome.runStatus, outcome.log).toBe(0);
    expect(outcome.results).toEqual([{ tb, status: 'PASS', checks: 14, failures: 0 }]);
  }, 120_000);

  it.each([
    ['pass', false, 'PASS', 0],
    ['fail', true, 'FAIL', 1],
  ] as const)('authored-clock counter %s', (_label, mutate, status, failures) => {
    const project = createFromScratchSeqTwoBitCounterBasys3Project();
    const topVhd = exportProjectAsBasys3(project).bundle!.topVhd;
    const vectors: TestVector[] = [
      { tick: 0, inputs: { clk: 0, en: 0, rst: 1 }, expected: { q0: 0, q1: 0 } },
      { tick: 1, inputs: { clk: 1, en: 0, rst: 1 }, expected: { q0: 0, q1: 0 } },
      { tick: 2, inputs: { clk: 0, en: 1, rst: 0 }, expected: { q0: 0, q1: 0 } },
      { tick: 3, inputs: { clk: 1, en: 1, rst: 0 }, expected: { q0: 1, q1: 0 } },
    ];
    const testbench = generateTestbenchVhdl(project, mutate ? flipFirstExpectation(vectors, 3) : vectors, {
      entityVhd: topVhd,
      clockDrive: { mode: 'authored', signalId: 'clk', signalLabel: 'CLK100MHZ', startLevel: 0 },
    });
    const tb = detectTestbenchEntityName(testbench)!;
    const outcome = runGhdl([{ name: 'top.vhd', text: topVhd }, { name: 'testbench.vhd', text: testbench }], tb);
    expect(outcome.timedOut, outcome.log).toBe(false);
    expect(outcome.runStatus === 0, outcome.log).toBe(status === 'PASS');
    expect(outcome.results).toEqual([{ tb, status, checks: 8, failures }]);
  }, 120_000);

  it('the exported view-model artifacts (with provenance headers) simulate and pass', () => {
    const vm = buildExportViewModel(createFromScratchSeqTwoBitCounterBasys3Project());
    expect(vm.status).toBe('ok');
    const design = vm.artifacts.filter((a) => a.category === 'design-source' && a.kind === 'vhd');
    const bench = vm.artifacts.find((a) => a.path === 'testbench.vhd')!;
    const tb = detectTestbenchEntityName(bench.content)!;
    expect(vm.topAuthority.simulationTop).toBe(tb);
    const outcome = runGhdl(
      [...design.map((a) => ({ name: a.path.replace(/\//g, '_'), text: a.content })), { name: 'testbench.vhd', text: bench.content }],
      tb,
    );
    expect(outcome.runStatus, outcome.log).toBe(0);
    expect(outcome.results).toEqual([{ tb, status: 'PASS', checks: 14, failures: 0 }]);
  }, 120_000);
});

describe.skipIf(ghdlAvailable)('generated testbenches executed in GHDL (unavailable)', () => {
  it.skip('REDBYTE_GHDL is not set to a ghdl executable; simulator execution was not performed', () => {});
});
