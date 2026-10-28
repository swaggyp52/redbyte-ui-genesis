// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { ThemeProvider } from '@redbyte/rb-theme';
import { IdeApp } from '../../IdeApp';
import type { RBProject } from '../../../export/projectFormat';
import { buildImportedProjectCompilerResult } from '../../../import/importCompiler';
import { parseVhdl } from '../../../import/vhdlImport';
import { parseXdcPins } from '../../../import/xdcImport';
import { at, projectOf, wire } from '../../../__tests__/helpers/productPath';
import { deriveIdeBlockingDesignIssue } from '../ideDesignBlocking';
import { buildIdeExportProject } from '../ideExportProject';
import { createEmptyProjectHierarchy, createModuleFromSelection } from '../projectHierarchy';
import { projectRepository } from '../projectRepository';
import { useProjectRuntime, type RunVerificationInput, type RuntimeVerifyRun } from '../projectRuntime';
import { planStudioRun } from '../studioRunInput';
import { workspacePreferencesStore } from '../workspacePreferences';
import { InlineVerificationWorker } from './inlineVerificationWorker';

/**
 * RB-DEBT-026: the classic workbench and the Meridian studio derive the export project, and so
 * every Run's schedule contract, from one function. IdeApp memoizes its two parts
 * (deriveIdeExportHdl, assembleIdeExportProject); the studio calls buildIdeExportProject.
 *
 * Parity is proven on the student's paths: the classic Run is a click on Simulate's Run in a
 * rendered IdeApp (IdeApp adds the schedule contract from its export project), the studio Run
 * is planStudioRun on the same runtime state. Both must hand the Run owner the same contract,
 * replay hash and vectors, record the same RunIdentity and output digest, or refuse alike.
 *
 * Agreement alone would let one shared mistake pass on both sides, so each fixture also states
 * what is true of it by hand: whether its schedule is clocked, which modules its export ships,
 * and, where the expectations are worked out here, that the Run passes them. IdeApp's own export
 * project is read where the student's work goes, the project it autosaves.
 */

const NOW = '2026-10-28T00:00:00.000Z';

const originalScrollIntoView = Element.prototype.scrollIntoView;
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterAll(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

function loadProject(project: RBProject, vectors: TestVector[] = []): void {
  useProjectRuntime.getState().loadFromProject(project);
  if (vectors.length) useProjectRuntime.getState().setVectors(vectors);
}

function enabledRegisterProject(): { project: RBProject; vectors: TestVector[] } {
  const nodes: Node[] = [
    { id: 'clk', type: 'INPUT', label: 'CLK100MHZ', ...at(0) },
    { id: 'd', type: 'INPUT', label: 'SW0', ...at(0, 60) },
    { id: 'en', type: 'INPUT', label: 'SW1', ...at(0, 120) },
    { id: 'r', type: 'Register1', ...at(200), config: { width: 1, resetKind: 'none', hasEnable: true, enablePolarity: 'active_high', clockPolarity: 'rising_edge' } },
    { id: 'q', type: 'OUTPUT', label: 'LD0', ...at(400) },
  ];
  const circuit: Circuit = {
    nodes,
    connections: [wire('w1', 'clk', 'out', 'r', 'CLK'), wire('w2', 'd', 'out', 'r', 'D'), wire('w3', 'en', 'out', 'r', 'EN'), wire('w4', 'r', 'Q', 'q', 'in')],
  };
  const project = projectOf('enabled-register', circuit, [['clk', 'CLK100MHZ'], ['d', 'SW0'], ['en', 'SW1']], [['q', 'LD0']]);
  return { project, vectors: enabledRegisterVectors((q) => q) };
}

/** Worked by hand: after each rising edge Q takes D while EN is high and holds otherwise. */
function enabledRegisterVectors(output: (q: number) => number): TestVector[] {
  const rows: Array<[number, number]> = [[1, 1], [0, 0], [0, 1], [1, 0], [1, 1]];
  let q = 0;
  return rows.map(([d, en], tick) => {
    if (en) q = d;
    return { tick, inputs: { d, en }, expected: { q: output(q) } } as TestVector;
  });
}

/** Leaf (two NOTs) inside Mid (Leaf then a NOT) inside the top: Y = A through three inversions. */
function nestedHierarchyProject(): { project: RBProject; vectors: TestVector[] } {
  const base: Circuit = {
    nodes: [
      { id: 'a', type: 'INPUT', label: 'SW0', ...at(0) },
      { id: 'n1', type: 'NOT', ...at(120) },
      { id: 'n2', type: 'NOT', ...at(240) },
      { id: 'n3', type: 'NOT', ...at(360) },
      { id: 'y', type: 'OUTPUT', label: 'LD0', ...at(480) },
    ],
    connections: [wire('c1', 'a', 'out', 'n1', 'in'), wire('c2', 'n1', 'out', 'n2', 'in'), wire('c3', 'n2', 'out', 'n3', 'in'), wire('c4', 'n3', 'out', 'y', 'in')],
  };
  const leaf = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Leaf', instanceName: 'u_leaf', selectedNodeIds: ['n1', 'n2'], nowIso: NOW });
  const mid = createModuleFromSelection(leaf.circuit, leaf.hierarchy, { moduleName: 'Mid', instanceName: 'u_mid', selectedNodeIds: [leaf.instance.id, 'n3'], nowIso: NOW });
  const midDef = mid.hierarchy.modules.find((module) => module.name === 'Mid');
  expect(midDef?.circuit.nodes.some((node) => node.config?.moduleDefinitionId === leaf.definition.id), 'Mid instantiates Leaf').toBe(true);
  const project = projectOf('nested-hierarchy', mid.circuit, [['a', 'SW0']], [['y', 'LD0']], [], mid.hierarchy);
  return { project, vectors: [0, 1, 0].map((a, tick) => ({ tick, inputs: { a }, expected: { y: 1 - a } }) as TestVector) };
}

/**
 * An enabled register and an inverter carved into a module: the top level holds only the
 * instance, so only the elaborated hierarchy shows the design is clocked.
 */
function registerInModuleProject(): { project: RBProject; vectors: TestVector[] } {
  const { project: flat } = enabledRegisterProject();
  const base: Circuit = {
    nodes: [...flat.circuit.nodes.filter((node) => node.id !== 'q'), { id: 'n', type: 'NOT', ...at(300) }, { id: 'q', type: 'OUTPUT', label: 'LD0', ...at(400) }],
    connections: [...flat.circuit.connections.filter((connection) => connection.id !== 'w4'), wire('w5', 'r', 'Q', 'n', 'in'), wire('w6', 'n', 'out', 'q', 'in')],
  };
  const cell = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'HeldInverse', instanceName: 'u_held', selectedNodeIds: ['r', 'n'], nowIso: NOW });
  expect(cell.circuit.nodes.some((node) => node.type === 'Register1'), 'the register lives only inside the module').toBe(false);
  const project = projectOf('register-in-module', cell.circuit, [['clk', 'CLK100MHZ'], ['d', 'SW0'], ['en', 'SW1']], [['q', 'LD0']], [], cell.hierarchy);
  return { project, vectors: enabledRegisterVectors((q) => 1 - q) };
}

function mux4Project(): RBProject {
  const names = ['i0', 'i1', 'i2', 'i3', 's0', 's1'];
  const nodes: Node[] = [
    ...names.map((name, i) => ({ id: `sw_${name}`, type: 'INPUT', label: `SW${i}`, ...at(0, i * 40) })),
    { id: 'mux', type: 'MUX4', ...at(200) },
    { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(400) },
  ];
  const connections = [...names.map((name, i) => wire(`w${i}`, `sw_${name}`, 'out', 'mux', name)), wire('wo', 'mux', 'out', 'ld0', 'in')];
  return projectOf('mux4', { nodes, connections }, names.map((name, i) => [`sw_${name}`, `SW${i}`] as [string, string]), [['ld0', 'LD0']]);
}

function importedVhdlProject(): { project: RBProject; vectorsFor: (rows: RunRow[]) => TestVector[] } {
  const vhdl = ['library ieee;', 'use ieee.std_logic_1164.all;', 'entity top is',
    '  port (SW0 : in std_logic; SW1 : in std_logic; LD0 : out std_logic; LD1 : out std_logic);', 'end entity top;',
    'architecture rtl of top is', 'begin', '  LD0 <= SW0 and SW1;', '  LD1 <= SW0 xor SW1;', 'end architecture rtl;', ''].join('\n');
  const xdc = [['SW0', 'V17'], ['SW1', 'V16'], ['LD0', 'U16'], ['LD1', 'E19']]
    .flatMap(([port, pin]) => [`set_property PACKAGE_PIN ${pin} [get_ports {${port}}]`, `set_property IOSTANDARD LVCMOS33 [get_ports {${port}}]`]).join('\n');
  const imported = buildImportedProjectCompilerResult({
    sourceName: 'gates.vhd', topPath: 'top.vhd', topText: vhdl, parsedHdl: parseVhdl(vhdl),
    xdcPath: 'basys3.xdc', xdcText: xdc, xdcResult: parseXdcPins(xdc),
  });
  const vectorsFor = (rows: RunRow[]) => {
    const ioRows = useProjectRuntime.getState().projectIoRows;
    const id = (port: string) => ioRows.find((row) => row.label === port || row.nodeId === `port_${port}` || row.nodeId === `port_out_${port}`)?.id ?? port;
    return rows.map((row, tick) => ({
      tick,
      inputs: Object.fromEntries(Object.entries(row.inputs).map(([port, value]) => [id(port), value])),
      expected: Object.fromEntries(Object.entries(row.expected).map(([port, value]) => [id(port), value])),
    }) as TestVector);
  };
  return { project: imported.project, vectorsFor };
}

type RunRow = { inputs: Record<string, number>; expected: Record<string, number> };

/** A clocked process the importer does not rebuild: it keeps the source and builds the ports only. */
function unrebuiltImportProject(): RBProject {
  const vhdl = ['library ieee;', 'use ieee.std_logic_1164.all;', 'entity top is',
    '  port (CLK100MHZ : in std_logic; SW0 : in std_logic; LD0 : out std_logic);', 'end entity top;',
    'architecture rtl of top is', '  signal q : std_logic := \'0\';', 'begin',
    '  process (CLK100MHZ) begin', '    if rising_edge(CLK100MHZ) then', '      if SW0 = \'1\' then q <= not q; end if;',
    '    end if;', '  end process;', '  LD0 <= q;', 'end architecture rtl;', ''].join('\n');
  const xdc = [['CLK100MHZ', 'W5'], ['SW0', 'V17'], ['LD0', 'U16']]
    .flatMap(([port, pin]) => [`set_property PACKAGE_PIN ${pin} [get_ports {${port}}]`, `set_property IOSTANDARD LVCMOS33 [get_ports {${port}}]`]).join('\n');
  return buildImportedProjectCompilerResult({
    sourceName: 'toggle.vhd', topPath: 'top.vhd', topText: vhdl, parsedHdl: parseVhdl(vhdl),
    xdcPath: 'basys3.xdc', xdcText: xdc, xdcResult: parseXdcPins(xdc),
  }).project;
}

interface Fixture {
  readonly kind: string;
  readonly load: () => void;
  /** A refused design: neither surface records, and both name the part that cannot be simulated. */
  readonly refused?: { readonly part: string };
  /** How the Run must schedule it, and (for a clocked design) which elaborated registers it found. */
  readonly schedule?: { readonly reason: 'combinational' | 'circuit-sequential'; readonly registers?: RegExp };
  /** The module sources its export ships beside top.vhd. */
  readonly modules?: number;
  /** Expectations worked out in this file: the Run must pass every one. */
  readonly passes?: true;
  /** Nothing computes its outputs in the browser: every output sample must be unknown. */
  readonly unknownOutputs?: true;
}

const combinational = { reason: 'combinational' } as const;

const FIXTURES: Fixture[] = [
  { kind: 'combinational', load: () => useProjectRuntime.getState().loadExample('logic-gates'), schedule: combinational, modules: 0 },
  { kind: 'full adder', load: () => useProjectRuntime.getState().loadExample('full-adder'), schedule: combinational, modules: 0 },
  {
    kind: 'enabled register',
    load: () => { const { project, vectors } = enabledRegisterProject(); loadProject(project, vectors); },
    schedule: { reason: 'circuit-sequential', registers: /^r$/ }, modules: 0, passes: true,
  },
  { kind: 'counter', load: () => useProjectRuntime.getState().loadExample('two-bit-counter'), schedule: { reason: 'circuit-sequential' }, modules: 0 },
  { kind: 'reusable module', load: () => useProjectRuntime.getState().loadExample('four-bit-adder-hierarchical'), schedule: combinational, modules: 1 },
  {
    kind: 'register inside a module',
    load: () => { const { project, vectors } = registerInModuleProject(); loadProject(project, vectors); },
    // The top level holds only the instance: the register is found in the elaborated design.
    schedule: { reason: 'circuit-sequential', registers: /^u-held__r$/ }, modules: 1, passes: true,
  },
  {
    kind: 'nested hierarchy',
    load: () => { const { project, vectors } = nestedHierarchyProject(); loadProject(project, vectors); },
    schedule: combinational, modules: 2, passes: true,
  },
  { kind: 'incomplete', load: () => useProjectRuntime.getState().loadExample('lab6-full-adder'), schedule: combinational, modules: 0 },
  { kind: 'unsupported', load: () => loadProject(mux4Project()), refused: { part: 'MUX4' } },
  {
    kind: 'imported HDL',
    schedule: combinational,
    modules: 0,
    passes: true,
    load: () => {
      const { project, vectorsFor } = importedVhdlProject();
      useProjectRuntime.getState().loadFromProject(project);
      useProjectRuntime.getState().setVectors(vectorsFor([[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => ({
        inputs: { SW0: a, SW1: b }, expected: { LD0: a & b, LD1: a ^ b },
      }))));
    },
  },
  {
    kind: 'imported HDL it cannot rebuild',
    load: () => {
      useProjectRuntime.getState().loadFromProject(unrebuiltImportProject());
      const sw0 = useProjectRuntime.getState().projectIoRows.find((row) => row.label === 'SW0')!.id;
      useProjectRuntime.getState().setVectors([1, 0, 1, 1].map((value, tick) => ({ tick, inputs: { [sw0]: value }, expected: {} }) as TestVector));
    },
    modules: 0,
    unknownOutputs: true,
  },
];

interface Outcome {
  readonly input?: RunVerificationInput;
  readonly run?: RuntimeVerifyRun;
  readonly refusal?: string;
}

// Simulate names each event row (event-01, ...) and the studio passes the scenario's ids through;
// a row id is a label, not stimulus: the recorded identity and digest below must still agree.
const unlabelled = (vectors: readonly TestVector[] | undefined) =>
  JSON.stringify((vectors ?? []).map(({ id: _label, ...vector }) => vector));

const comparable = (input: RunVerificationInput | undefined) => input && {
  deterministicHash: input.deterministicHash,
  scheduleContract: input.scheduleContract,
  vectors: unlabelled(input.vectors),
  assertionMode: Boolean(input.assertionMode),
  clockPolicy: input.clockPolicy ?? null,
  scenarioId: input.scenarioId,
  scenarioContentHash: input.scenarioContentHash,
};

const recorded = (run: RuntimeVerifyRun | undefined) => run && {
  design: run.identity?.design,
  stimulus: run.identity?.stimulus,
  engine: run.identity?.engine,
  outputDigest: run.outputDigest,
  status: run.status,
  samples: run.report.rows.length,
  checks: run.report.rows.filter((row) => row.expected === '0' || row.expected === '1').map((row) => `${row.tick}:${row.signal}=${row.actual}/${row.expected}`).join(' '),
};

async function classicRun(view: ReturnType<typeof render>): Promise<Outcome> {
  const requests: RunVerificationInput[] = [];
  const owner = useProjectRuntime.getState().startVerification;
  await act(async () => {
    useProjectRuntime.setState({ startVerification: (input) => { requests.push(structuredClone(input)); owner(input); } });
  });
  fireEvent.click(await view.findByTestId('mode-button-verify'));
  // Simulate offers Run, or refuses the design outright (blocked mode has no Run).
  await waitFor(() => expect(view.queryByTestId('ide-vcb-run') ?? view.queryByTestId('ide-verify-entry-blocked')).toBeTruthy(), { timeout: 15000 });
  const blocked = view.queryByTestId('ide-verify-entry-blocked');
  if (blocked) return { refusal: blocked.textContent ?? '' };
  const run = view.getByTestId('ide-vcb-run') as HTMLButtonElement;
  expect(run.disabled, 'Simulate offers Run').toBe(false);
  fireEvent.click(run);
  await waitFor(() => {
    const execution = useProjectRuntime.getState().verificationExecution.status;
    expect(requests.length).toBe(1);
    expect(['complete', 'error']).toContain(execution);
  }, { timeout: 20000 });
  const state = useProjectRuntime.getState();
  return state.verificationExecution.status === 'error'
    ? { input: requests[0], refusal: state.verificationExecution.message }
    : { input: requests[0], run: state.verifyLastRun };
}

function studioRun(): Outcome {
  const plan = planStudioRun(useProjectRuntime.getState(), { captureEvaluations: true, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
  try {
    return { input: plan.input, run: useProjectRuntime.getState().runVerification(plan.input) };
  } catch (error) {
    return { input: plan.input, refusal: error instanceof Error ? error.message : String(error) };
  }
}

describe('one export derivation for the workbench and the studio (RB-DEBT-026)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    workspacePreferencesStore.reset();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    window.history.replaceState({}, '', '/os/?mode=project');
    vi.stubGlobal('Worker', InlineVerificationWorker);
  });

  afterEach(() => {
    cleanup();
    useProjectRuntime.getState().cancelVerification();
    useProjectRuntime.persist.clearStorage();
    useProjectRuntime.setState(useProjectRuntime.getInitialState(), true);
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
  });

  it('IdeApp builds its export project only from the shared derivation', () => {
    const source = readFileSync(path.resolve(__dirname, '../../IdeApp.tsx'), 'utf8');
    for (const own of ['generateHierarchicalVhdlProject', 'vhdlFromNetlist', 'netlistFromCircuit', 'buildVhdlTopLevelBindings', 'materializeIoMappingFromHardwareMappingV2']) {
      expect(source, `IdeApp derives the export itself with ${own}`).not.toMatch(new RegExp(`\\b${own}\\b`));
    }
    expect(source).toMatch(/deriveIdeExportHdl\(/);
    expect(source).toMatch(/assembleIdeExportProject\(/);
  });

  it.each(FIXTURES)('$kind: the classic Run and the studio Run carry one contract and record one identity', async (fixture) => {
    const autosaved: RBProject[] = [];
    const autosave = projectRepository.autosave.bind(projectRepository);
    vi.spyOn(projectRepository, 'autosave').mockImplementation((input) => { autosaved.push(structuredClone(input.project)); return autosave(input); });
    const view = render(<ThemeProvider><IdeApp /></ThemeProvider>);
    await act(async () => fixture.load());

    // IdeApp's export project, as it autosaves it, is the shared derivation of the same state. Its
    // meta differs by design: IdeApp records the scenario authority it derives and the lab/student.
    const withoutMeta = ({ meta: _meta, ...project }: RBProject) => project;
    await waitFor(() => {
      expect(autosaved.length, 'IdeApp autosaved the open project').toBeGreaterThan(0);
      expect(withoutMeta(autosaved[autosaved.length - 1])).toEqual(withoutMeta(buildIdeExportProject(useProjectRuntime.getState())));
    }, { timeout: 5000 });
    if (fixture.modules !== undefined) {
      const shipped = autosaved[autosaved.length - 1].hdl?.sources.map((source) => source.path) ?? [];
      expect(shipped[0], 'the export ships top.vhd first').toBe('top.vhd');
      expect(shipped.length - 1, `module sources shipped: ${shipped.join(', ')}`).toBe(fixture.modules);
    }

    const classic = await classicRun(view);
    const studio = studioRun();

    if (fixture.refused) {
      expect(classic.run, 'the classic Run recorded a refused design').toBeUndefined();
      expect(studio.run, 'the studio Run recorded a refused design').toBeUndefined();
      expect(classic.refusal).toContain(fixture.refused.part);
      expect(studio.refusal).toContain(fixture.refused.part);
      return;
    }
    expect(classic.refusal, 'the classic Run refused').toBeUndefined();
    expect(studio.refusal, 'the studio Run refused').toBeUndefined();
    expect(comparable(studio.input)).toEqual(comparable(classic.input));
    expect(classic.run?.identity?.design, 'the classic Run recorded an identity').toBeTruthy();
    expect(recorded(studio.run)).toEqual(recorded(classic.run));

    const contract = classic.input?.scheduleContract;
    if (fixture.schedule) expect(contract?.reason, 'the Run schedules the design as it is').toBe(fixture.schedule.reason);
    if (fixture.schedule?.registers) {
      const registers = contract?.analysis.sequentialNodes.map((node) => node.id) ?? [];
      expect(registers.length, `registers found: ${registers.join(', ')}`).toBe(1);
      expect(registers[0]).toMatch(fixture.schedule.registers);
    }
    if (fixture.passes) {
      const checks = classic.run?.report.rows.filter((row) => row.expected === '0' || row.expected === '1') ?? [];
      expect(checks.length, 'the worked expectations are checked').toBeGreaterThan(0);
      expect(checks.filter((row) => row.actual !== row.expected), 'every worked expectation holds').toEqual([]);
      expect(classic.run?.status).toBe('pass');
    }
    if (fixture.unknownOutputs) {
      // Simulate's Run claims no level for an output it never computed (manual 12.2), .in or .out.
      const outputs = useProjectRuntime.getState().projectIoRows.filter((row) => row.direction === 'out');
      const samples = classic.run?.waveform ?? [];
      expect(samples.length, 'Simulate recorded the run').toBeGreaterThan(0);
      const levels = samples.flatMap((sample) => outputs.map((row) => Object.entries(sample.signals)
        .filter(([key]) => key === row.id || key === row.nodeId || key.startsWith(`${row.nodeId}.`))
        .map(([key, value]) => `t${sample.tick} ${key}=${value}`)));
      expect(levels.filter((values) => values.length === 0), 'an output sample with no recorded signal').toEqual([]);
      expect(levels.flat().filter((value) => !value.endsWith('=X')), 'Simulate recorded a level it never computed').toEqual([]);
    }
  }, 60_000);
});
