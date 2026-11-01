// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import { runTestVectors } from '../fpga/boards/basys3/vectorRunner';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { ghdlRequired } from './helpers/ghdlHarness';

/**
 * RB-DEBT-028 (b): a register's configuration is the authority for its EN and RST pins, and the
 * simulator and the exported VHDL agree on it. One flat design carries two Register1 parts fed by
 * the same D, EN and RST switches:
 *   - r_off: Clock enable off and Reset mode none, so its wired EN and RST must have no effect;
 *   - r_on:  Clock enable on and an active-high asynchronous clear, so both must act.
 * The expectations come from that rule, not from either implementation. The simulator must pass
 * them (Verify's own vector runner), and the exported self-checking testbench must pass them in
 * GHDL (opt-in: REDBYTE_GHDL names a ghdl executable; without it that case is skipped, never
 * reported as passed, and with REDBYTE_REQUIRE_GHDL=1 it fails).
 *
 * Stimulus: an input wired to a register's RST is the design's reset, and the board-clock policy
 * drives it as a reset sequence (1 in the first cycle, then 0) in Verify and in the exported
 * testbench alike (materializeVectorsForClockPolicy). The steps author exactly that sequence, so
 * the simulator and the testbench run the same stimulus.
 */

const NOW = '2026-10-26T00:00:00.000Z';

const STEPS: ReadonlyArray<{ d: 0 | 1; en: 0 | 1; rst: 0 | 1 }> = [
  { d: 1, en: 0, rst: 1 },
  { d: 1, en: 0, rst: 0 },
  { d: 1, en: 1, rst: 0 },
  { d: 0, en: 0, rst: 0 },
  { d: 0, en: 1, rst: 0 },
  { d: 1, en: 0, rst: 0 },
  { d: 1, en: 1, rst: 0 },
  { d: 0, en: 0, rst: 0 },
  { d: 1, en: 0, rst: 0 },
];

/** The rule: r_off captures D at every edge; r_on clears while RST = 1 and captures only while EN = 1. */
function ruleVectors(): TestVector[] {
  let onState = 0;
  return STEPS.map((step, tick) => {
    onState = step.rst === 1 ? 0 : step.en === 1 ? step.d : onState;
    return {
      tick,
      inputs: { clk: 0, d: step.d, en: step.en, rst: step.rst },
      expected: { ld_off: step.d, ld_on: onState },
    };
  });
}

const wire = (from: string, fromPort: string, to: string, toPort: string) => ({
  id: `${from}.${fromPort}-${to}.${toPort}`,
  from: { nodeId: from, portName: fromPort },
  to: { nodeId: to, portName: toPort },
});

function registerProject(vectors: TestVector[]): RBProject {
  const register = { width: 1, resetPolarity: 'active_high', enablePolarity: 'active_high', clockPolarity: 'rising_edge' };
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    name: 'register-config-authority',
    circuit: {
      nodes: [
        { id: 'clk', type: 'INPUT', label: 'CLK100MHZ', x: 0, y: 0, config: {}, state: {} },
        { id: 'd', type: 'INPUT', label: 'D', x: 0, y: 80, config: {}, state: {} },
        { id: 'en', type: 'INPUT', label: 'EN', x: 0, y: 160, config: {}, state: {} },
        { id: 'rst', type: 'INPUT', label: 'RST', x: 0, y: 240, config: {}, state: {} },
        { id: 'r_off', type: 'Register1', label: 'R_OFF', x: 240, y: 40, config: { ...register, hasEnable: false, resetKind: 'none' }, state: {} },
        { id: 'r_on', type: 'Register1', label: 'R_ON', x: 240, y: 200, config: { ...register, hasEnable: true, resetKind: 'async_clear' }, state: {} },
        { id: 'ld_off', type: 'OUTPUT', label: 'LD0', x: 440, y: 40, config: {}, state: {} },
        { id: 'ld_on', type: 'OUTPUT', label: 'LD1', x: 440, y: 200, config: {}, state: {} },
      ],
      connections: ['r_off', 'r_on'].flatMap((reg) => [
        wire('d', 'out', reg, 'D'),
        wire('clk', 'out', reg, 'CLK'),
        wire('en', 'out', reg, 'EN'),
        wire('rst', 'out', reg, 'RST'),
      ]).concat([wire('r_off', 'Q', 'ld_off', 'in'), wire('r_on', 'Q', 'ld_on', 'in')]),
    },
    ioMapping: {
      inputs: [
        { id: 'clk', nodeId: 'clk', port: 'out', label: 'CLK100MHZ', pin: 'CLK100MHZ' },
        { id: 'd', nodeId: 'd', port: 'out', label: 'D', pin: 'SW0' },
        { id: 'en', nodeId: 'en', port: 'out', label: 'EN', pin: 'SW1' },
        { id: 'rst', nodeId: 'rst', port: 'out', label: 'RST', pin: 'SW2' },
      ],
      outputs: [
        { id: 'ld_off', nodeId: 'ld_off', port: 'in', label: 'LD0', pin: 'LD0' },
        { id: 'ld_on', nodeId: 'ld_on', port: 'in', label: 'LD1', pin: 'LD1' },
      ],
    },
    vectors,
    hdl: { top: 'reg_cfg_top', sources: [] },
    fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'reg_cfg_top' },
  } as RBProject;
}

/** The concurrent process that drives one register signal, from `process` to `end process;`. */
function processFor(vhd: string, signal: string): string {
  const blocks = vhd.split(/(?=^\s*process \()/m).map((block) => block.slice(0, block.indexOf('end process;') + 'end process;'.length));
  const owning = blocks.filter((block) => new RegExp(`^\\s+${signal} <= `, 'm').test(block));
  expect(owning, `${signal} in\n${vhd}`).toHaveLength(1);
  return owning[0];
}

describe('register configuration authority: simulation and export agree', () => {
  it('the simulator passes the configuration-authority vectors on the clocked schedule', async () => {
    const vectors = ruleVectors();
    const project = registerProject(vectors);
    // The rule is not vacuous: EN and RST change the enabled register's result.
    expect(vectors.map((vector) => vector.expected!.ld_off)).not.toEqual(vectors.map((vector) => vector.expected!.ld_on));
    const result = await runTestVectors(project.circuit, vectors, project.ioMapping);
    expect(result.schedule).toBe('clocked_macro');
    expect(result.failures).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it('the exported top.vhd gives the disabled pins no branch and the enabled ones theirs', () => {
    const vm = buildExportViewModel(registerProject(ruleVectors()));
    expect(vm.status).toBe('ok');
    const top = vm.artifacts.find((artifact) => artifact.path === 'top.vhd')!.content;
    // Node order is by id: r_off is reg1_0, r_on is reg1_1.
    const off = processFor(top, 'reg1_0');
    expect(off).toMatch(/^\s+process \([^,()]+\)\s+begin\s+if rising_edge\([^)]+\) then\s+reg1_0 <= [^;]+;\s+end if;\s+end process;$/);
    const on = processFor(top, 'reg1_1');
    expect(on).toMatch(/if \S+ = '1' then\s+reg1_1 <= '0';\s+elsif rising_edge\([^)]+\) then\s+if \S+ = '1' then\s+reg1_1 <= [^;]+;\s+end if;/);
  });
});

const GHDL = process.env.REDBYTE_GHDL?.trim() ?? '';
const ghdlAvailable = GHDL.length > 0 && existsSync(GHDL);

describe.skipIf(!ghdlAvailable)('register configuration authority in GHDL', () => {
  it('the exported self-checking testbench passes the same vectors', () => {
    const vectors = ruleVectors();
    const vm = buildExportViewModel(registerProject(vectors));
    expect(vm.status).toBe('ok');
    const design = vm.artifacts.filter((artifact) => artifact.category === 'design-source' && artifact.kind === 'vhd');
    const bench = vm.artifacts.find((artifact) => artifact.path === 'testbench.vhd')!;
    const dir = mkdtempSync(join(tmpdir(), 'rb-regcfg-ghdl-'));
    try {
      const files = [...design.map((artifact) => ({ name: artifact.path.replace(/\//g, '_'), text: artifact.content })), { name: 'testbench.vhd', text: bench.content }];
      for (const file of files) writeFileSync(join(dir, file.name), file.text);
      const options = { cwd: dir, encoding: 'utf8' as const, timeout: 60_000 };
      const analyze = spawnSync(GHDL, ['-a', '--std=08', ...files.map((file) => file.name)], options);
      expect(analyze.status, `${analyze.stdout}${analyze.stderr}`).toBe(0);
      const elaborate = spawnSync(GHDL, ['-e', '--std=08', vm.topAuthority.simulationTop], options);
      expect(elaborate.status, `${elaborate.stdout}${elaborate.stderr}`).toBe(0);
      const run = spawnSync(GHDL, ['-r', '--std=08', vm.topAuthority.simulationTop], options);
      const out = `${run.stdout}${run.stderr}`;
      expect(out).toMatch(new RegExp(`REDBYTE_TB_RESULT v=1 tb=\\w+ status=PASS checks=${vectors.length * 2} failures=0`));
      expect(run.status, out).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

describe.skipIf(ghdlAvailable)('register configuration authority in GHDL (unavailable)', () => {
  it.skipIf(!ghdlRequired)('REDBYTE_GHDL is not set to a ghdl executable; the exported design was not simulated', () => {
    expect(ghdlAvailable, 'REDBYTE_REQUIRE_GHDL=1 but REDBYTE_GHDL is not a ghdl executable').toBe(true);
  });
});
