// @vitest-environment jsdom
import { writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import { IDE_EXAMPLES } from '../apps/ide/examplesCatalog';
import { createFromScratchCombSwitchAndBasys3Project } from '../apps/ide/fixtures/fromScratchBasys3CertProjects';
import { createEmptyProjectHierarchy, createModuleFromSelection, placeModuleInstance } from '../apps/ide/projectHierarchy';
import { useProjectRuntime, type RuntimeVerifyRun } from '../apps/ide/projectRuntime';
import { materializeVectorsForClockPolicy } from '../apps/ide/verifyClockPolicy';
import { findVhdlXdcPortMismatches } from '../fpga/boards/basys3/basys3Bundle';
import { ghdlAvailable, ghdlRequired } from './helpers/ghdlHarness';
import { at, projectOf, resetRuntime, runPackage, runProduct, wire, NOW, type ProductRun } from './helpers/productPath';
import { EXAMPLE_CLASSIFICATIONS, oracleFor, type Bit, type ExampleClass, type Row } from './helpers/matrixOracles';

/**
 * Artifact-consistency matrix: the release gate for "what the browser shows is what ships".
 *
 * Every fixture takes the student's path through the product:
 *   load into the runtime (loadExample or loadFromProject)
 *   -> planStudioRun: the Run a student's Verify makes (schedule, clock policy, checks)
 *   -> runtime.runVerification: the recorded run the case table shows
 *   -> buildIdeExportProject + buildExportViewModel(project, run, scenario): what Export ships,
 *      whose execution plan must equal the run's, row for row
 *   -> the Open Project package (buildVivadoProjectFolderEntries), run in GHDL as packaged.
 * Expectations come from independent oracles (helpers/matrixOracles: documented intent in plain
 * TypeScript, and the formulas below), never from the engine under test. Classes:
 *   reference: complete designs. Exhaustive oracle vectors for combinational ones; the browser,
 *     the exported testbench in GHDL and the oracle agree on every cell, and injected faults are
 *     killed identically by both engines, vector by vector.
 *   starter: incomplete by design. An undriven board output blocks the package by name
 *     (RBEX4103) while Verify shows it as X; a starter that does export agrees with GHDL.
 *   negative: unsupported or broken content, refused by name.
 * GHDL is a VHDL simulator, not Vivado: nothing here is E1, E2 or E3 evidence.
 * REDBYTE_GHDL=<ghdl.exe>; REDBYTE_REQUIRE_GHDL=1 makes a missing GHDL a failure, never a skip.
 * REDBYTE_MATRIX_REPORT=<json> writes the per-fixture results; REDBYTE_MATRIX_DUMP=<dir> keeps
 * exactly what GHDL ran.
 */

// ---------------------------------------------------------------------------------------------
// Oracles: an independent model of each reference design's outputs
// ---------------------------------------------------------------------------------------------

interface MatrixOracle {
  /** Where the model comes from (helpers/matrixOracles key, or this file's formula). */
  readonly source: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  /** Exhaustive input combinations are generated for a combinational model. */
  readonly combinational: boolean;
  run(rows: readonly Row[]): Array<Record<string, Bit | null>>;
}

function formula(source: string, inputs: string[], outputs: string[], fn: (read: (id: string) => Bit) => Record<string, Bit>): MatrixOracle {
  return {
    source, inputs, outputs, combinational: true,
    run: (rows) => rows.map((row) => fn((id) => row[id] ?? 0)),
  };
}

const bit = (value: boolean | number): Bit => (value ? 1 : 0);

/** Every combination of a combinational model's inputs, expected cells from the model. */
function exhaustiveVectors(oracle: MatrixOracle): TestVector[] {
  const rows: Row[] = Array.from({ length: 1 << oracle.inputs.length }, (_, n) =>
    Object.fromEntries(oracle.inputs.map((id, i) => [id, ((n >> i) & 1) as Bit])));
  const outputs = oracle.run(rows);
  return rows.map((inputs, tick) => ({
    tick,
    inputs: { ...inputs },
    expected: Object.fromEntries(Object.entries(outputs[tick]).filter(([, value]) => value !== null)) as Record<string, Bit>,
  }));
}

/**
 * A sequential model's expected cells on the authored stimulus. The runtime keys vectors by IO
 * row id; the models read node ids, so keys go through the runtime's own IO rows.
 */
function modelOnAuthoredStimulus(oracle: MatrixOracle, authored: readonly TestVector[], ioRows: ReadonlyArray<{ id: string; nodeId: string }>): TestVector[] {
  const nodeIdOf = (key: string) => ioRows.find((row) => row.id === key)?.nodeId ?? key;
  const ordered = [...authored].sort((left, right) => (left.tick ?? 0) - (right.tick ?? 0));
  const rows: Row[] = ordered.map((vector) => Object.fromEntries(Object.entries(vector.inputs ?? {}).map(([id, value]) => [nodeIdOf(id), bit(Number(value))])));
  const outputs = oracle.run(rows);
  return ordered.map((vector, index) => ({
    id: vector.id,
    tick: vector.tick,
    inputs: { ...(vector.inputs ?? {}) },
    expected: Object.fromEntries(Object.entries(outputs[index]).filter(([, value]) => value !== null)) as Record<string, Bit>,
  }));
}

function modelFor(source: 'ide', id: string): MatrixOracle | undefined {
  const oracle = oracleFor(source, id);
  if (!oracle) return undefined;
  return {
    source: oracle.key,
    inputs: oracle.inputs,
    outputs: oracle.outputs,
    combinational: oracle.timing === 'combinational',
    run: (rows) => oracle.run(rows).map((outputs) => ({ ...outputs })),
  };
}

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

interface Fixture {
  readonly id: string;
  readonly cls: ExampleClass;
  readonly load: () => void;
  readonly oracle?: MatrixOracle;
  /** Codes the export must refuse a negative or unwired-starter fixture with. */
  readonly refusedWith?: readonly string[];
  readonly evidence: string;
}

function exampleFixtures(): Fixture[] {
  return IDE_EXAMPLES.map((example) => {
    const classification = EXAMPLE_CLASSIFICATIONS.find((entry) => entry.source === 'ide' && entry.id === example.id);
    return {
      id: `ide:${example.id}`,
      cls: classification?.cls ?? 'unknown',
      load: () => useProjectRuntime.getState().loadExample(example.id),
      oracle: classification?.cls === 'reference' ? modelFor('ide', example.id) : undefined,
      evidence: classification?.evidence ?? 'not classified',
    };
  });
}

/** 2-to-4 decoder from NOT/AND gates. */
function decoderFixture(): Fixture {
  const nodes: Node[] = [
    { id: 'a0', type: 'INPUT', label: 'SW0', ...at(0) },
    { id: 'a1', type: 'INPUT', label: 'SW1', ...at(0, 60) },
    { id: 'n0', type: 'NOT', ...at(100) },
    { id: 'n1', type: 'NOT', ...at(100, 60) },
    ...[0, 1, 2, 3].map((k) => ({ id: `g${k}`, type: 'AND', ...at(200, k * 60) })),
    ...[0, 1, 2, 3].map((k) => ({ id: `y${k}`, type: 'OUTPUT', label: `LD${k}`, ...at(300, k * 60) })),
  ];
  const term = (k: number) => [
    wire(`g${k}a`, k & 1 ? 'a0' : 'n0', 'out', `g${k}`, 'a'),
    wire(`g${k}b`, k & 2 ? 'a1' : 'n1', 'out', `g${k}`, 'b'),
    wire(`g${k}o`, `g${k}`, 'out', `y${k}`, 'in'),
  ];
  const project = projectOf('decoder2to4', { nodes, connections: [wire('i0', 'a0', 'out', 'n0', 'in'), wire('i1', 'a1', 'out', 'n1', 'in'), ...[0, 1, 2, 3].flatMap(term)] },
    [['a0', 'SW0'], ['a1', 'SW1']], [0, 1, 2, 3].map((k) => [`y${k}`, `LD${k}`] as [string, string]));
  return {
    id: 'custom:decoder2to4', cls: 'reference', load: () => useProjectRuntime.getState().loadFromProject(project), evidence: 'One-hot decode of SW1:SW0.',
    oracle: formula('formula:decoder2to4', ['a0', 'a1'], ['y0', 'y1', 'y2', 'y3'], (read) => {
      const n = read('a0') | (read('a1') << 1);
      return { y0: bit(n === 0), y1: bit(n === 1), y2: bit(n === 2), y3: bit(n === 3) };
    }),
  };
}

/** A reusable two-gate module placed twice, plus top-level FullAdder, NAND3 and Ground. */
function reusedModuleFixture(): Fixture {
  const base: Circuit = {
    nodes: [
      { id: 'mi', type: 'INPUT', label: 'A', ...at(0) },
      { id: 'mj', type: 'INPUT', label: 'B', ...at(0, 60) },
      { id: 'mx', type: 'XOR', ...at(100) },
      { id: 'mn', type: 'NOT', ...at(160) },
      { id: 'mo', type: 'OUTPUT', label: 'Y', ...at(220) },
    ],
    connections: [wire('b1', 'mi', 'out', 'mx', 'a'), wire('b2', 'mj', 'out', 'mx', 'b'), wire('b3', 'mx', 'out', 'mn', 'in'), wire('b4', 'mn', 'out', 'mo', 'in')],
  };
  const cell = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'XnorCell', instanceName: 'u_x0', selectedNodeIds: ['mx', 'mn'], nowIso: NOW });
  const nodes: Node[] = [
    { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0) },
    { id: 'sw1', type: 'INPUT', label: 'SW1', ...at(0, 60) },
    { id: 'sw2', type: 'INPUT', label: 'SW2', ...at(0, 120) },
    { id: 'gnd', type: 'Ground', ...at(0, 180) },
    { id: 'fa', type: 'FullAdder', ...at(150) },
    { id: 'n3', type: 'NAND3', ...at(150, 120) },
    ...[0, 1, 2, 3, 4, 5].map((k) => ({ id: `ld${k}`, type: 'OUTPUT', label: `LD${k}`, ...at(400, k * 40) })),
  ];
  const first = placeModuleInstance({ nodes, connections: [] }, cell.definition, { x: 250, y: 240 }, 'u_x0');
  const second = placeModuleInstance(first.circuit, cell.definition, { x: 250, y: 320 }, 'u_x1');
  const x0 = first.instance.id;
  const x1 = second.instance.id;
  const circuit: Circuit = {
    nodes: second.circuit.nodes,
    connections: [
      wire('k1', 'sw0', 'out', 'fa', 'A'), wire('k2', 'sw1', 'out', 'fa', 'B'), wire('k3', 'sw2', 'out', 'fa', 'Cin'),
      wire('k4', 'fa', 'Sum', 'ld0', 'in'), wire('k5', 'fa', 'Cout', 'ld1', 'in'),
      wire('k6', 'sw0', 'out', 'n3', 'a'), wire('k7', 'sw1', 'out', 'n3', 'b'), wire('k8', 'sw2', 'out', 'n3', 'c'),
      wire('k9', 'n3', 'out', 'ld2', 'in'), wire('k10', 'gnd', 'out', 'ld3', 'in'),
      wire('k11', 'sw0', 'out', x0, 'A'), wire('k12', 'sw1', 'out', x0, 'B'), wire('k13', x0, 'Y', 'ld4', 'in'),
      wire('k14', x0, 'Y', x1, 'A'), wire('k15', 'sw2', 'out', x1, 'B'), wire('k16', x1, 'Y', 'ld5', 'in'),
    ],
  };
  const project = projectOf('reused-module-mixed', circuit, [['sw0', 'SW0'], ['sw1', 'SW1'], ['sw2', 'SW2']],
    [0, 1, 2, 3, 4, 5].map((k) => [`ld${k}`, `LD${k}`] as [string, string]), [], cell.hierarchy);
  const xnor = (p: Bit, q: Bit): Bit => (p === q ? 1 : 0);
  return {
    id: 'custom:reused-module-mixed', cls: 'reference', load: () => useProjectRuntime.getState().loadFromProject(project),
    evidence: 'XnorCell module placed twice in series, a FullAdder, a NAND3 and a Ground-tied output.',
    oracle: formula('formula:reused-module-mixed', ['sw0', 'sw1', 'sw2'], ['ld0', 'ld1', 'ld2', 'ld3', 'ld4', 'ld5'], (read) => {
      const [a, b, c] = [read('sw0'), read('sw1'), read('sw2')];
      return { ld0: bit(a ^ b ^ c), ld1: bit((a & b) | (c & (a ^ b))), ld2: bit(!(a & b & c)), ld3: 0, ld4: xnor(a, b), ld5: xnor(xnor(a, b), c) };
    }),
  };
}

/** MUX4 has no simulator behaviour: refused by name everywhere. */
function mux4Fixture(): Fixture {
  const names = ['i0', 'i1', 'i2', 'i3', 's0', 's1'];
  const nodes: Node[] = [
    ...names.map((name, i) => ({ id: `sw_${name}`, type: 'INPUT', label: `SW${i}`, ...at(0, i * 40) })),
    { id: 'mux', type: 'MUX4', ...at(200) },
    { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(400) },
  ];
  const connections = [...names.map((name, i) => wire(`w${i}`, `sw_${name}`, 'out', 'mux', name)), wire('wo', 'mux', 'out', 'ld0', 'in')];
  const project = projectOf('mux4', { nodes, connections }, names.map((name, i) => [`sw_${name}`, `SW${i}`] as [string, string]), [['ld0', 'LD0']]);
  return {
    id: 'custom:mux4', cls: 'negative', refusedWith: ['RBEX4100'], load: () => useProjectRuntime.getState().loadFromProject(project),
    evidence: 'componentSupportRegistry: MUX4 is not simulated, verified or exported.',
  };
}

function certFixtures(): Fixture[] {
  const comb = createFromScratchCombSwitchAndBasys3Project();
  return [{
    id: 'cert:comb-switch-and', cls: 'reference', load: () => useProjectRuntime.getState().loadFromProject(comb),
    evidence: 'From-scratch certification project: LD0 = SW0 AND SW1.',
    oracle: formula('formula:comb-switch-and', comb.ioMapping!.inputs.map((entry) => entry.id), comb.ioMapping!.outputs.map((entry) => entry.id),
      (read) => Object.fromEntries(comb.ioMapping!.outputs.map((entry) => [entry.id, bit(comb.ioMapping!.inputs.every((input) => read(input.id) === 1))]))),
  }];
}

const FIXTURES: Fixture[] = [...exampleFixtures(), decoderFixture(), reusedModuleFixture(), mux4Fixture(), ...certFixtures()];

// ---------------------------------------------------------------------------------------------
// The product path
// ---------------------------------------------------------------------------------------------

const checkedRows = (run: RuntimeVerifyRun) => run.report.rows.filter((row) => row.expected === '0' || row.expected === '1');

/** Failing checked cells per executed tick, as the recorded run (the case table) shows them. */
function browserFailuresByTick(run: RuntimeVerifyRun): Map<number, number> {
  const byTick = new Map<number, number>();
  for (const row of checkedRows(run)) if (row.actual !== row.expected) byTick.set(row.tick, (byTick.get(row.tick) ?? 0) + 1);
  return byTick;
}

/** The stimulus and expectations the run executed: its recorded input through its clock policy. */
function executedPlan(run: RuntimeVerifyRun): TestVector[] {
  return materializeVectorsForClockPolicy({
    vectors: run.executionInput?.vectors ?? [],
    ioRows: run.executionInput?.ioRows ?? [],
    policy: run.clockPolicy ?? null,
  });
}

const planKey = (vectors: readonly TestVector[]) =>
  JSON.stringify(vectors.map((vector) => [vector.tick, Object.entries(vector.inputs ?? {}).sort(), Object.entries(vector.expected ?? {}).sort()]));

function browserFailuresByVector(product: ProductRun): Map<number, number> {
  const byTick = browserFailuresByTick(product.run!);
  const byVector = new Map<number, number>();
  product.authority.executionVectors.forEach((vector, index) => {
    const count = byTick.get(vector.tick ?? index) ?? 0;
    if (count > 0) byVector.set(index, count);
  });
  return byVector;
}

const sortedEntries = (map: Map<number, number>) => [...map.entries()].sort((left, right) => left[0] - right[0]);

// ---------------------------------------------------------------------------------------------
// Fault injection
// ---------------------------------------------------------------------------------------------

const SWAP: Record<string, string> = {
  AND: 'OR', OR: 'AND', NAND: 'NOR', NOR: 'NAND', XOR: 'XNOR', XNOR: 'XOR', AND3: 'OR3', OR3: 'AND3', NAND3: 'NOR3', NOR3: 'NAND3',
};

/** Deterministic single-fault mutants of an exported project: one gate swapped, or one Q read as Q_inv. */
function mutantsOf(project: RBProject, limit = 4): Array<{ label: string; project: RBProject }> {
  const out: Array<{ label: string; project: RBProject }> = [];
  const swapIn = (circuit: Circuit, nodeId: string): Circuit => ({
    ...circuit, nodes: circuit.nodes.map((node) => (node.id === nodeId ? { ...node, type: SWAP[node.type] } : node)),
  });
  for (const id of project.circuit.nodes.filter((node) => SWAP[node.type]).map((node) => node.id).sort()) {
    out.push({ label: `top ${id} swapped`, project: { ...project, circuit: swapIn(project.circuit, id) } });
  }
  for (const module of project.hierarchy?.modules ?? []) {
    for (const node of module.circuit.nodes.filter((candidate) => SWAP[candidate.type]).sort((left, right) => (left.id < right.id ? -1 : 1))) {
      out.push({
        label: `module ${module.name}.${node.id} swapped`,
        project: { ...project, hierarchy: { ...project.hierarchy!, modules: project.hierarchy!.modules.map((m) => (m.id === module.id ? { ...m, circuit: swapIn(m.circuit, node.id) } : m)) } },
      });
    }
  }
  for (const connection of project.circuit.connections.filter((c) => typeof c.from === 'object' && c.from.portName === 'Q' && c.id)) {
    out.push({
      label: `${connection.id} reads Q_inv`,
      project: { ...project, circuit: { ...project.circuit, connections: project.circuit.connections.map((c) => (c.id === connection.id && typeof c.from === 'object' ? { ...c, from: { ...c.from, portName: 'Q_inv' } } : c)) } },
    });
  }
  if (out.length <= limit) return out;
  const step = out.length / limit;
  return Array.from({ length: limit }, (_, i) => out[Math.floor(i * step)]);
}

// ---------------------------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------------------------

interface MatrixRow {
  fixture: string;
  cls: ExampleClass;
  oracle?: string;
  vectors?: number;
  planMatchesExport?: boolean;
  browser?: { checks: number; failures: number; disagreesWithOracle: number };
  export: { status: string; codes: string[] };
  ghdl?: { outcome: string; checks: number; failures: number } | 'skipped';
  mutants?: { total: number; killed: number; survived: number; disagreed: string[] };
  note?: string;
}
const report: MatrixRow[] = [];
const useGhdl = ghdlAvailable || ghdlRequired;

describe.each(FIXTURES)('artifact consistency: $id ($cls)', (fixture) => {
  it('takes the student path from Verify to the GHDL run of the packaged files', async () => {
    resetRuntime();
    fixture.load();
    const row: MatrixRow = { fixture: fixture.id, cls: fixture.cls, export: { status: '', codes: [] } };
    report.push(row);

    if (fixture.cls === 'reference') {
      const oracle = fixture.oracle;
      expect(oracle, `${fixture.id}: a reference fixture needs an independent model`).toBeDefined();
      const { projectVectors: authored, projectIoRows } = useProjectRuntime.getState();
      const vectors = oracle!.combinational ? exhaustiveVectors(oracle!) : modelOnAuthoredStimulus(oracle!, authored, projectIoRows);
      useProjectRuntime.getState().setVectors(vectors);
      row.oracle = oracle!.source;
      row.vectors = vectors.length;
      const expectedCells = vectors.reduce((total, vector) => total + Object.keys(vector.expected ?? {}).length, 0);

      const product = runProduct();
      expect(product.refusal, `${fixture.id}: the Run was refused`).toBeUndefined();
      const run = product.run!;
      row.planMatchesExport = planKey(executedPlan(run)) === planKey(product.authority.executionVectors);
      expect(planKey(product.authority.executionVectors), `${fixture.id}: the export testbench plan differs from the run Verify executed`).toBe(planKey(executedPlan(run)));
      const checks = checkedRows(run);
      const failures = checks.filter((check) => check.actual !== check.expected);
      row.browser = { checks: checks.length, failures: failures.length, disagreesWithOracle: failures.length };
      expect(checks.length, `${fixture.id}: every model cell is a check`).toBe(expectedCells);
      expect(failures.map((f) => `t${f.tick} ${f.signal}: ${f.actual} != ${f.expected}`), `${fixture.id}: the browser disagrees with ${oracle!.source}`).toEqual([]);

      row.export = { status: product.vm.status, codes: product.vm.errors.map((error) => error.code) };
      expect(product.vm.errors.map((error) => `${error.code} ${error.message}`)).toEqual([]);
      const top = product.vm.artifacts.find((artifact) => artifact.path === 'top.vhd')!.content;
      const xdc = product.vm.artifacts.find((artifact) => artifact.path === 'top.xdc')!.content;
      expect(findVhdlXdcPortMismatches(top, xdc)).toEqual([]);
      expect(top).not.toMatch(/RBEX_/);

      if (!useGhdl) { row.ghdl = 'skipped'; return; }
      expect(ghdlAvailable, 'REDBYTE_REQUIRE_GHDL=1 but REDBYTE_GHDL is not a working ghdl').toBe(true);
      const packaged = await runPackage(fixture.id, product, expectedCells);
      row.ghdl = { outcome: packaged.outcome, checks: packaged.checks, failures: packaged.failures };
      expect({ outcome: packaged.outcome, rule: packaged.rule }, packaged.log).toEqual({ outcome: 'PASS', rule: 'status' });

      // Fault injection: every mutant gets the same verdict, vector by vector, from both engines.
      const mutants = mutantsOf(product.project);
      const tally = { total: mutants.length, killed: 0, survived: 0, disagreed: [] as string[] };
      for (const mutant of mutants) {
        resetRuntime();
        useProjectRuntime.getState().loadFromProject(mutant.project);
        useProjectRuntime.getState().setVectors(vectors);
        const faulty = runProduct();
        expect(faulty.refusal, `${mutant.label}: Run refused`).toBeUndefined();
        expect(faulty.vm.errors.map((error) => error.code), `${mutant.label}: a mutant stays exportable`).toEqual([]);
        const inBrowser = sortedEntries(browserFailuresByVector(faulty));
        const inGhdl = await runPackage(`${fixture.id}~${mutant.label}`, faulty, expectedCells);
        const agree = JSON.stringify(inBrowser) === JSON.stringify(sortedEntries(inGhdl.failuresByVector))
          && (inBrowser.length === 0 ? inGhdl.outcome === 'PASS' : inGhdl.outcome === 'FAIL');
        if (!agree) tally.disagreed.push(mutant.label);
        if (inBrowser.length > 0) tally.killed += 1; else tally.survived += 1;
        expect({ mutant: mutant.label, ghdl: sortedEntries(inGhdl.failuresByVector), outcome: inGhdl.outcome }, inGhdl.log)
          .toEqual({ mutant: mutant.label, ghdl: inBrowser, outcome: inBrowser.length === 0 ? 'PASS' : 'FAIL' });
      }
      row.mutants = tally;
      // Exhaustive vectors must kill a fault in every combinational design that has a gate to swap.
      if (oracle!.combinational && mutants.length > 0) expect(tally.killed, `${fixture.id}: no injected fault was detected`).toBeGreaterThan(0);
      return;
    }

    const product = runProduct();
    row.export = { status: product.vm.status, codes: product.vm.errors.map((error) => error.code) };

    if (fixture.cls === 'negative') {
      expect(product.vm.status, `${fixture.id} must be refused`).toBe('blocked');
      for (const code of fixture.refusedWith ?? []) expect(row.export.codes).toContain(code);
      expect(product.vm.artifacts.find((artifact) => artifact.path === 'top.vhd')?.status).not.toBe('ready');
      row.note = product.refusal ? `Run refused: ${product.refusal.slice(0, 120)}` : 'Run recorded';
      return;
    }

    if (fixture.cls === 'starter' || fixture.cls === 'unknown') {
      const undriven = product.vm.errors.filter((error) => error.code === 'RBEX4103');
      if (product.vm.status === 'blocked') {
        // An incomplete design: the package is refused by name, never shipped tied low.
        expect(undriven.length, `${fixture.id}: blocked, but not by its undriven outputs`).toBeGreaterThan(0);
        expect(product.vm.errors.filter((error) => error.code !== 'RBEX4103').map((error) => `${error.code} ${error.message}`)).toEqual([]);
        // Verify shows every open output as X rather than inventing a level.
        if (product.run) {
          const open = product.run.report.rows.filter((reportRow) => reportRow.actual === 'X');
          if (product.run.report.rows.length > 0) expect(open.length).toBeGreaterThan(0);
        }
        row.note = `blocked: ${undriven.length} undriven output(s)`;
        return;
      }
      // A starter that exports must agree with GHDL cell for cell on its authored vectors.
      expect(product.refusal).toBeUndefined();
      const run = product.run!;
      expect(planKey(product.authority.executionVectors)).toBe(planKey(executedPlan(run)));
      const checks = checkedRows(run);
      row.browser = { checks: checks.length, failures: checks.filter((check) => check.actual !== check.expected).length, disagreesWithOracle: 0 };
      if (!useGhdl) { row.ghdl = 'skipped'; return; }
      expect(ghdlAvailable, 'REDBYTE_REQUIRE_GHDL=1 but REDBYTE_GHDL is not a working ghdl').toBe(true);
      const packaged = await runPackage(fixture.id, product, checks.length);
      row.ghdl = { outcome: packaged.outcome, checks: packaged.checks, failures: packaged.failures };
      expect(sortedEntries(packaged.failuresByVector), packaged.log).toEqual(sortedEntries(browserFailuresByVector(product)));
      expect(packaged.outcome).toBe(row.browser.failures === 0 ? (checks.length > 0 ? 'PASS' : 'NO_CHECKS') : 'FAIL');
    }
  }, 600_000);
});

afterAll(() => {
  const target = process.env.REDBYTE_MATRIX_REPORT?.trim();
  if (target) writeFileSync(target, `${JSON.stringify({ ghdl: useGhdl ? 'executed' : 'skipped', rows: report }, null, 2)}\n`);
});
