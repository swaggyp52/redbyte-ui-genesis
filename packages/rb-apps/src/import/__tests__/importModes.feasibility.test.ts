// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseVhdl } from '../vhdlImport';
import { parseXdcPins } from '../xdcImport';
import { buildImportedProjectCompilerResult } from '../importCompiler';
import { useCircuitStore } from '../../stores/circuitStore';
import { useProjectRuntime } from '../../apps/ide/projectRuntime';
import { planStudioRun } from '../../apps/ide/studioRunInput';
import { deriveIdeBlockingDesignIssue } from '../../apps/ide/ideDesignBlocking';
import { buildIdeExportProject } from '../../apps/ide/ideExportProject';
import { getActiveScenario } from '../../apps/ide/verifyScenario';
import { buildExportViewModel } from '../../apps/ide/viewmodels/buildExportViewModel';
import { ghdlAvailable, ghdlRequired, runGhdlFiles } from '../../__tests__/helpers/ghdlHarness';

/**
 * Imported HDL, V1 decision (docs/manuals/RedByte_Product_Manual.md, "Imported HDL in V1"):
 * Mode A, a reconstructed circuit, ships for sources the importer rebuilds exactly (proven
 * browser = export = GHDL in hdlImport.productPath.ghdl). Everything else keeps the safe
 * refusal. This file is the feasibility evidence for Mode B, preserved imported HDL, on a source
 * the importer cannot rebuild (numeric_std arithmetic in a clocked process):
 *   - what Mode B needs and RedByte already has: the source kept byte for byte, the entity's
 *     interface, and an external simulator that executes that source (GHDL, against a testbench
 *     whose expectations are computed here by hand, never by an engine);
 *   - what the product must not do meanwhile: fabricate gates or constants for the logic, claim
 *     a browser simulation, or ship generated HDL in place of the source.
 * REDBYTE_GHDL=<ghdl.exe>; REDBYTE_REQUIRE_GHDL=1 makes a missing GHDL a failure, never a skip.
 */

const COUNTER = [
  'library ieee;',
  'use ieee.std_logic_1164.all;',
  'use ieee.numeric_std.all;',
  'entity top is',
  '  port (CLK100MHZ : in std_logic; SW0 : in std_logic; LD0 : out std_logic; LD1 : out std_logic);',
  'end entity top;',
  'architecture rtl of top is',
  "  signal count : unsigned(1 downto 0) := (others => '0');",
  'begin',
  '  process (CLK100MHZ)',
  '  begin',
  '    if rising_edge(CLK100MHZ) then',
  "      if SW0 = '1' then count <= (others => '0'); else count <= count + 1; end if;",
  '    end if;',
  '  end process;',
  '  LD0 <= count(0);',
  '  LD1 <= count(1);',
  'end architecture rtl;',
  '',
].join('\n');

const XDC = [['CLK100MHZ', 'W5'], ['SW0', 'V17'], ['LD0', 'U16'], ['LD1', 'E19']]
  .flatMap(([port, pin]) => [`set_property PACKAGE_PIN ${pin} [get_ports {${port}}]`, `set_property IOSTANDARD LVCMOS33 [get_ports {${port}}]`])
  .join('\n');

/** Reset for one edge, then six edges counting: (LD1, LD0) after each edge, by hand. */
const EXPECTED_AFTER_EDGE: Array<{ sw0: 0 | 1; ld1: 0 | 1; ld0: 0 | 1 }> = [
  { sw0: 1, ld1: 0, ld0: 0 },
  { sw0: 0, ld1: 0, ld0: 1 },
  { sw0: 0, ld1: 1, ld0: 0 },
  { sw0: 0, ld1: 1, ld0: 1 },
  { sw0: 0, ld1: 0, ld0: 0 },
  { sw0: 0, ld1: 0, ld0: 1 },
  { sw0: 1, ld1: 0, ld0: 0 },
];

function externalBench(): string {
  const steps = EXPECTED_AFTER_EDGE.map((row, index) => [
    `    SW0 <= '${row.sw0}';`,
    "    wait for 5 ns; CLK100MHZ <= '1'; wait for 1 ns;",
    `    assert LD1 = '${row.ld1}' and LD0 = '${row.ld0}' report "RB_FEASIBILITY_MISMATCH edge ${index}" severity error;`,
    `    if LD1 = '${row.ld1}' and LD0 = '${row.ld0}' then checked := checked + 1; end if;`,
    "    wait for 4 ns; CLK100MHZ <= '0';",
  ].join('\n')).join('\n');
  return [
    'library ieee;', 'use ieee.std_logic_1164.all;',
    'entity feasibility_tb is end entity feasibility_tb;',
    'architecture sim of feasibility_tb is',
    "  signal CLK100MHZ, SW0 : std_logic := '0';",
    '  signal LD0, LD1 : std_logic;',
    'begin',
    '  dut : entity work.top port map (CLK100MHZ => CLK100MHZ, SW0 => SW0, LD0 => LD0, LD1 => LD1);',
    '  process',
    '    variable checked : natural := 0;',
    '  begin',
    steps,
    `    report "RB_FEASIBILITY_CHECKED " & integer'image(checked) & " of ${EXPECTED_AFTER_EDGE.length}";`,
    '    wait;',
    '  end process;',
    'end architecture sim;',
    '',
  ].join('\n');
}

function importCounter() {
  const imported = buildImportedProjectCompilerResult({
    sourceName: 'counter.vhd', topPath: 'top.vhd', topText: COUNTER, parsedHdl: parseVhdl(COUNTER),
    xdcPath: 'basys3.xdc', xdcText: XDC, xdcResult: parseXdcPins(XDC),
  });
  localStorage.clear();
  useCircuitStore.getState().reset();
  useProjectRuntime.getState().resetToActiveExample();
  useProjectRuntime.getState().loadFromProject(imported.project);
  return imported;
}

describe('imported HDL the importer cannot rebuild: Mode B feasibility, refusal kept for V1', () => {
  it('keeps the source byte for byte and takes the interface from the entity', () => {
    importCounter();
    const state = useProjectRuntime.getState();
    expect(state.sourceModel.files.some((file) => file.text === COUNTER), 'the imported source is preserved unchanged').toBe(true);
    const ports = state.projectIoRows.map((row) => `${row.direction}:${row.label}:${row.pin}`).sort();
    expect(ports).toEqual(['in:CLK100MHZ:W5', 'in:SW0:V17', 'out:LD0:U16', 'out:LD1:E19'].sort());
  });

  it('fabricates no logic: the circuit is the port scaffold, with nothing driving an output', () => {
    importCounter();
    const { circuit } = useProjectRuntime.getState();
    expect([...new Set(circuit.nodes.map((node) => node.type))].sort()).toEqual(['INPUT', 'OUTPUT']);
    const outputs = new Set(circuit.nodes.filter((node) => node.type === 'OUTPUT').map((node) => node.id));
    expect(circuit.connections.filter((connection) => outputs.has(typeof connection.to === 'string' ? connection.to : connection.to.nodeId))).toEqual([]);
  });

  it('claims no browser simulation and ships no generated HDL in place of the source', () => {
    importCounter();
    const sw0 = useProjectRuntime.getState().projectIoRows.find((row) => row.label === 'SW0')!.id;
    useProjectRuntime.getState().setVectors([1, 0, 0, 0].map((value, tick) => ({ tick, inputs: { [sw0]: value }, expected: {} })));
    const plan = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: false, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
    let recorded: unknown;
    let refusal = '';
    try {
      recorded = useProjectRuntime.getState().runVerification(plan.input);
    } catch (error) {
      refusal = error instanceof Error ? error.message : String(error);
    }
    const run = recorded as { waveform?: Array<{ tick: number; signals: Record<string, string> }> } | undefined;
    // Either the Run refuses, or it records every output as unknown, never a level it did not compute.
    const outputs = useProjectRuntime.getState().projectIoRows.filter((row) => row.direction === 'out');
    const claimed = (run?.waveform ?? []).flatMap((sample) => outputs
      .flatMap((row) => [row.id, row.nodeId, `${row.nodeId}.in`, row.label])
      .filter((key) => sample.signals[key] === '0' || sample.signals[key] === '1')
      .map((key) => `t${sample.tick} ${key}=${sample.signals[key]}`));
    expect(claimed, 'the browser recorded a level for an output it never computed').toEqual([]);
    // The browser executes only what it rebuilt (the inputs): every output sample is unknown.
    const unknown = (run?.waveform ?? []).every((sample) => outputs.every((row) => sample.signals[`${row.nodeId}.in`] === 'X'));
    expect(refusal.length > 0 || ((run?.waveform?.length ?? 0) > 0 && unknown)).toBe(true);

    const state = useProjectRuntime.getState();
    const vm = buildExportViewModel(buildIdeExportProject(state), undefined, getActiveScenario(state.scenarios, state.activeScenarioId) ?? undefined);
    expect(vm.status).toBe('blocked');
    expect(vm.errors.filter((error) => error.code === 'RBEX4103').map((error) => error.message).join('\n')).toMatch(/LD0[\s\S]*LD1|LD1[\s\S]*LD0/);
    expect(vm.artifacts.find((artifact) => artifact.path === 'top.vhd')?.status).not.toBe('ready');
  });

  it.runIf(ghdlAvailable || ghdlRequired)('an external simulator executes the preserved source as written (GHDL, hand-computed expectations)', () => {
    expect(ghdlAvailable, 'REDBYTE_REQUIRE_GHDL=1 but REDBYTE_GHDL is not a working ghdl').toBe(true);
    importCounter();
    const preserved = useProjectRuntime.getState().sourceModel.files.find((file) => file.text === COUNTER);
    expect(preserved).toBeDefined();
    const run = runGhdlFiles([{ name: 'top.vhd', text: preserved!.text }, { name: 'feasibility_tb.vhd', text: externalBench() }], 'feasibility_tb');
    expect({ analyze: run.analyzeStatus, elaborate: run.elaborateStatus, run: run.runStatus }, run.log).toEqual({ analyze: 0, elaborate: 0, run: 0 });
    expect(run.log).not.toMatch(/RB_FEASIBILITY_MISMATCH/);
    expect(run.log).toMatch(new RegExp(`RB_FEASIBILITY_CHECKED ${EXPECTED_AFTER_EDGE.length} of ${EXPECTED_AFTER_EDGE.length}`));
  }, 120_000);
});
