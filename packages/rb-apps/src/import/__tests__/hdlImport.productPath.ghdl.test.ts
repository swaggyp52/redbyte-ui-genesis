// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { TestVector } from '@redbyte/rb-utils';
import { parseVhdl } from '../vhdlImport';
import { parseXdcPins } from '../xdcImport';
import { buildImportedProjectCompilerResult } from '../importCompiler';
import { useCircuitStore } from '../../stores/circuitStore';
import { useProjectRuntime, type RuntimeVerifyRun } from '../../apps/ide/projectRuntime';
import { planStudioRun } from '../../apps/ide/studioRunInput';
import { deriveIdeBlockingDesignIssue } from '../../apps/ide/ideDesignBlocking';
import { buildIdeExportProject } from '../../apps/ide/ideExportProject';
import { getActiveScenario } from '../../apps/ide/verifyScenario';
import { buildExportViewModel } from '../../apps/ide/viewmodels/buildExportViewModel';
import { buildVivadoProjectFolderEntries, deriveVivadoProjectSlug } from '../../fpga/vivado/vivadoProjectFolder';
import { classifyGhdlRun, ghdlAvailable, ghdlRequired, runGhdlFiles } from '../../__tests__/helpers/ghdlHarness';

/**
 * Imported VHDL on the student's path: import (with an XDC) -> load into the runtime -> Verify
 * (planStudioRun + runVerification, the recorded run) -> Export (buildExportViewModel) -> the
 * packaged Vivado project's VHDL in GHDL. Every expected cell is computed by hand from the source
 * VHDL, never from either engine: the browser and GHDL must both agree with the source.
 * REDBYTE_GHDL=<ghdl.exe>; REDBYTE_REQUIRE_GHDL=1 makes a missing GHDL a failure, never a skip.
 */

const PINS: Record<string, string> = { SW0: 'V17', SW1: 'V16', SW2: 'W16', SW3: 'W17', SW4: 'W15', LD0: 'U16', LD1: 'E19', LD2: 'U19', CLK100MHZ: 'W5' };

function xdcFor(vhdl: string): string {
  const ports = [...new Set([...vhdl.matchAll(/\b(SW[0-9]|LD[0-9]|CLK100MHZ)\b/g)].map((match) => match[1]))];
  return ports.flatMap((port) => [
    `set_property PACKAGE_PIN ${PINS[port]} [get_ports {${port}}]`,
    `set_property IOSTANDARD LVCMOS33 [get_ports {${port}}]`,
  ]).join('\n');
}

function vhdlTop(ports: string, declarations: string, body: string): string {
  return ['library ieee;', 'use ieee.std_logic_1164.all;', 'entity top is', `  port (${ports});`, 'end entity top;',
    'architecture rtl of top is', declarations, 'begin', body, 'end architecture rtl;', ''].join('\n');
}

const clockedProcess = (ports: string, nextState: string) => vhdlTop(ports, '  signal q : std_logic;', [
  '  process (CLK100MHZ, SW0)', '  begin', "    if SW0 = '1' then", "      q <= '0';",
  '    elsif rising_edge(CLK100MHZ) then', `      q <= ${nextState};`, '    end if;', '  end process;', '  LD0 <= q;',
].join('\n'));

/** Vectors keyed by entity port name, expectations from the source VHDL. */
type Row = { inputs: Record<string, number>; expected: Record<string, number> };

interface Product {
  run?: RuntimeVerifyRun;
  refusal?: string;
  vm: ReturnType<typeof buildExportViewModel>;
  projectName: string;
  part?: string;
}

function importLoadVerifyExport(name: string, vhdl: string, rows: Row[]): Product {
  const xdcText = xdcFor(vhdl);
  const imported = buildImportedProjectCompilerResult({
    sourceName: `${name}.vhd`, topPath: 'top.vhd', topText: vhdl, parsedHdl: parseVhdl(vhdl),
    xdcPath: 'basys3.xdc', xdcText, xdcResult: parseXdcPins(xdcText),
  });
  localStorage.clear();
  useCircuitStore.getState().reset();
  useProjectRuntime.getState().resetToActiveExample();
  useProjectRuntime.getState().loadFromProject(imported.project);
  const ioRows = useProjectRuntime.getState().projectIoRows;
  const rowId = (port: string) => {
    const row = ioRows.find((candidate) => candidate.label === port || candidate.nodeId === `port_${port}` || candidate.nodeId === `port_out_${port}`);
    expect(row, `${name}: no IO row for ${port}`).toBeDefined();
    return row!.id;
  };
  const vectors: TestVector[] = rows.map((row, tick) => ({
    tick,
    inputs: Object.fromEntries(Object.entries(row.inputs).map(([port, value]) => [rowId(port), value])),
    expected: Object.fromEntries(Object.entries(row.expected).map(([port, value]) => [rowId(port), value])),
  }) as TestVector);
  if (vectors.length > 0) useProjectRuntime.getState().setVectors(vectors);
  const plan = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: false, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
  let run: RuntimeVerifyRun | undefined;
  let refusal: string | undefined;
  try {
    run = useProjectRuntime.getState().runVerification(plan.input);
  } catch (error) {
    refusal = error instanceof Error ? error.message : String(error);
  }
  const after = useProjectRuntime.getState();
  const project = buildIdeExportProject(after);
  const scenario = getActiveScenario(after.scenarios, after.activeScenarioId) ?? undefined;
  return { run, refusal, vm: buildExportViewModel(project, run, scenario), projectName: project.name, part: project.fpga?.part };
}

const checkedRows = (run: RuntimeVerifyRun) => run.report.rows.filter((row) => row.expected === '0' || row.expected === '1');

async function runPackagedInGhdl(label: string, product: Product, expectedChecks: number) {
  const artifacts = product.vm.artifacts.filter((artifact) => artifact.content.trim().length > 0);
  const entries = await buildVivadoProjectFolderEntries({
    artifacts: artifacts.map((artifact) => ({ path: artifact.path, content: artifact.content })),
    projectName: product.projectName,
    projectSlug: deriveVivadoProjectSlug(label),
    topModule: product.vm.topAuthority.designTop,
    part: product.part,
  });
  const vhdl = entries.filter((entry) => !entry.dir && entry.name.endsWith('.vhd'));
  const design = vhdl.filter((entry) => entry.name.includes('/sources_1/')).map((entry) => ({ name: entry.name.split('/').pop()!, text: entry.text }));
  const bench = vhdl.filter((entry) => entry.name.includes('/sim_1/')).map((entry) => ({ name: 'testbench.vhd', text: entry.text }));
  const run = runGhdlFiles([...design, ...bench], product.vm.topAuthority.simulationTop);
  return { ...classifyGhdlRun(run, { tbEntity: product.vm.topAuthority.simulationTop, expectedChecks }), log: run.log };
}

const useGhdl = ghdlAvailable || ghdlRequired;

const RIPPLE = vhdlTop('SW0, SW1, SW2, SW3, SW4 : in std_logic; LD0, LD1, LD2 : out std_logic', '  signal c1 : std_logic;', [
  '  u0 : entity work.FullAdder port map (A => SW0, B => SW2, Cin => SW4, Sum => LD0, Cout => c1);',
  '  u1 : entity work.FullAdder port map (A => SW1, B => SW3, Cin => c1, Sum => LD1, Cout => LD2);',
].join('\n'));
const rippleRows: Row[] = Array.from({ length: 32 }, (_, n) => {
  const [sw0, sw1, sw2, sw3, sw4] = [0, 1, 2, 3, 4].map((bit) => (n >> bit) & 1);
  const total = sw0 + 2 * sw1 + sw2 + 2 * sw3 + sw4;
  return { inputs: { SW0: sw0, SW1: sw1, SW2: sw2, SW3: sw3, SW4: sw4 }, expected: { LD0: total & 1, LD1: (total >> 1) & 1, LD2: (total >> 2) & 1 } };
});

/** Reset (SW0 = 1), then edges with reset released: a toggle reads 0, 1, 0, 1. */
const toggleRows: Row[] = [
  { inputs: { SW0: 1 }, expected: { LD0: 0 } }, { inputs: { SW0: 0 }, expected: { LD0: 1 } },
  { inputs: { SW0: 0 }, expected: { LD0: 0 } }, { inputs: { SW0: 0 }, expected: { LD0: 1 } },
];

const CASES: Array<{ id: string; vhdl: string; rows: Row[] }> = [
  { id: 'I1 ripple adder (u0.Cout -> c1 -> u1.Cin)', vhdl: RIPPLE, rows: rippleRows },
  { id: 'I2 process next state "not q"', vhdl: clockedProcess('CLK100MHZ : in std_logic; SW0 : in std_logic; LD0 : out std_logic', 'not q'), rows: toggleRows },
  {
    id: 'I3 DFlipFlop Q_inv -> D',
    vhdl: vhdlTop('CLK100MHZ : in std_logic; SW0 : in std_logic; LD0 : out std_logic', '  signal qb : std_logic;',
      '  u0 : entity work.DFlipFlop port map (D => qb, CLK => CLK100MHZ, RST => SW0, Q => LD0, Q_inv => qb);'),
    rows: toggleRows,
  },
  {
    id: 'I4 process next state "SW1 and SW2"',
    vhdl: clockedProcess('CLK100MHZ : in std_logic; SW0, SW1, SW2 : in std_logic; LD0 : out std_logic', 'SW1 and SW2'),
    rows: [
      { inputs: { SW0: 1, SW1: 1, SW2: 1 }, expected: { LD0: 0 } },
      { inputs: { SW0: 0, SW1: 1, SW2: 1 }, expected: { LD0: 1 } },
      { inputs: { SW0: 0, SW1: 0, SW2: 1 }, expected: { LD0: 0 } },
      { inputs: { SW0: 0, SW1: 1, SW2: 0 }, expected: { LD0: 0 } },
      { inputs: { SW0: 0, SW1: 1, SW2: 1 }, expected: { LD0: 1 } },
    ],
  },
  {
    id: "FullAdder Cin tied to '1'",
    vhdl: vhdlTop('SW0, SW1 : in std_logic; LD0, LD1 : out std_logic', '',
      "  u0 : entity work.FullAdder port map (A => SW0, B => SW1, Cin => '1', Sum => LD0, Cout => LD1);"),
    rows: Array.from({ length: 4 }, (_, n) => {
      const total = (n & 1) + ((n >> 1) & 1) + 1;
      return { inputs: { SW0: n & 1, SW1: (n >> 1) & 1 }, expected: { LD0: total & 1, LD1: total >> 1 } };
    }),
  },
];

describe.each(CASES)('imported VHDL on the student path: $id', ({ id, vhdl, rows }) => {
  it('the browser, the export and GHDL all match the source VHDL', async () => {
    const product = importLoadVerifyExport(id, vhdl, rows);
    expect(product.refusal).toBeUndefined();
    const checks = checkedRows(product.run!);
    const expectedCells = rows.reduce((total, row) => total + Object.keys(row.expected).length, 0);
    expect(checks.length).toBe(expectedCells);
    expect(checks.filter((check) => check.actual !== check.expected).map((check) => `t${check.tick} ${check.signal}: ${check.actual} != ${check.expected}`)).toEqual([]);
    expect(product.vm.errors.map((error) => `${error.code} ${error.message}`)).toEqual([]);
    expect(product.vm.status).toBe('ok');

    if (!useGhdl) return;
    expect(ghdlAvailable, 'REDBYTE_REQUIRE_GHDL=1 but REDBYTE_GHDL is not a working ghdl').toBe(true);
    const ghdl = await runPackagedInGhdl(id, product, expectedCells);
    expect({ outcome: ghdl.outcome, rule: ghdl.rule, checks: ghdl.summary?.checks, failures: ghdl.summary?.failures }, ghdl.log)
      .toEqual({ outcome: 'PASS', rule: 'status', checks: expectedCells, failures: 0 });
  }, 180_000);
});

describe('imported VHDL the importer cannot rebuild exactly is refused by name', () => {
  it('a register next state it does not rebuild ships nothing: Export names the undriven LD0', () => {
    const product = importLoadVerifyExport('nand-next',
      clockedProcess('CLK100MHZ : in std_logic; SW0, SW1, SW2 : in std_logic; LD0 : out std_logic', 'SW1 nand SW2'), []);
    expect(product.vm.status).toBe('blocked');
    const undriven = product.vm.errors.filter((error) => error.code === 'RBEX4103');
    expect(undriven.map((error) => error.message).join('\n')).toMatch(/LD0/);
    const top = product.vm.artifacts.find((artifact) => artifact.path === 'top.vhd');
    expect(top?.status).not.toBe('ready');
  }, 180_000);
});
