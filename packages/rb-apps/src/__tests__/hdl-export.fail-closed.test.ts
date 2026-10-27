// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import { getVhdlLogicNodeTypes, inputPinsOf, outputPortsOf } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../export/projectFormat';
import {
  createEmptyProjectHierarchy,
  createModuleFromSelection,
  placeModuleInstance,
  type ProjectHierarchyDocument,
} from '../apps/ide/projectHierarchy';
import { generateHierarchicalVhdlProject } from '../apps/ide/hierarchicalVhdl';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { isDesignOwnedExportDiagnostic } from '../apps/ide/projectWorkflowAuthority';
import { exportProjectAsBasys3 } from '../fpga/boards/basys3/basys3ExportService';
import { findVhdlXdcPortMismatches } from '../fpga/boards/basys3/basys3Bundle';
import { generateJourneySource } from '../apps/ide/signalJourney';

/**
 * Defect C: the exported HDL must never fabricate a value. Every primitive the
 * simulator runs is expressed exactly; anything that cannot be is a named,
 * blocking diagnostic, and the design itself is left untouched. Cases E1..E16
 * are the probes from the 2026-10-25 audit (all fail-open at 8cfb1eef6).
 */

const NOW = '2026-10-25T00:00:00.000Z';
const at = (x: number, y = 0) => ({ position: { x, y } });
const wire = (id: string, from: string, fromPort: string, to: string, toPort: string) =>
  ({ id, from: { nodeId: from, portName: fromPort }, to: { nodeId: to, portName: toPort } });

/** A tiny double-inverter module, so a project has a hierarchy (forces the hierarchical emitter). */
function notModule(hierarchy: ProjectHierarchyDocument = createEmptyProjectHierarchy(), name = 'Inv') {
  const base: Circuit = {
    nodes: [
      { id: 'mi', type: 'INPUT', label: 'A', ...at(0) },
      { id: 'mn', type: 'NOT', ...at(100) },
      { id: 'mn2', type: 'NOT', ...at(150) },
      { id: 'mo', type: 'OUTPUT', label: 'Y', ...at(200) },
    ],
    connections: [wire('c1', 'mi', 'out', 'mn', 'in'), wire('c2', 'mn', 'out', 'mn2', 'in'), wire('c3', 'mn2', 'out', 'mo', 'in')],
  };
  return createModuleFromSelection(base, hierarchy, {
    moduleName: name, instanceName: 'u_inv', selectedNodeIds: ['mn', 'mn2'], nowIso: NOW,
  });
}

function project(
  name: string,
  circuit: Circuit,
  hierarchy: ProjectHierarchyDocument | undefined,
  inputs: Array<[string, string, string]>,
  outputs: Array<[string, string, string]>,
  vectors?: TestVector[],
): RBProject {
  return {
    kind: 'rb-project', version: 1, createdAt: NOW, updatedAt: NOW,
    name, circuit, hierarchy,
    ioMapping: {
      inputs: inputs.map(([nodeId, label, pin]) => ({ id: nodeId, nodeId, port: 'out', label, pin })),
      outputs: outputs.map(([nodeId, label, pin]) => ({ id: nodeId, nodeId, port: 'in', label, pin })),
    },
    vectors,
    hdl: { top: 'probe_top', sources: [] },
    fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'probe_top' },
  } as RBProject;
}

/** Concurrent statements that tie a structural net to a literal '0' (a fabricated constant). */
function fabricatedZeros(vhdl: string): string[] {
  return vhdl.split('\n').filter((line) => /^ {2}n_\w+\s*<=\s*'0';/.test(line));
}

/** Every combination of three switches, with expectations from an independent formula. */
function threeSwitchVectors(expect: (a: number, b: number, c: number) => Record<string, number>): TestVector[] {
  const vectors: TestVector[] = [];
  for (let i = 0; i < 8; i += 1) {
    const a = i & 1;
    const b = (i >> 1) & 1;
    const c = (i >> 2) & 1;
    vectors.push({ tick: i, inputs: { sw0: a, sw1: b, sw2: c }, expected: expect(a, b, c) });
  }
  return vectors;
}

/** E1: FullAdder, NAND3 and PowerSource at the top of a hierarchical project. */
function e1Project(vectors?: TestVector[]): RBProject {
  const inv = notModule();
  const nodes: Node[] = [
    { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0, 0) },
    { id: 'sw1', type: 'INPUT', label: 'SW1', ...at(0, 50) },
    { id: 'sw2', type: 'INPUT', label: 'SW2', ...at(0, 100) },
    { id: 'vcc', type: 'PowerSource', ...at(0, 150) },
    { id: 'fa', type: 'FullAdder', ...at(100, 0) },
    { id: 'n3', type: 'NAND3', ...at(100, 100) },
    ...['ld0', 'ld1', 'ld2', 'ld3', 'ld4'].map((id, i) => ({ id, type: 'OUTPUT', label: id.toUpperCase(), ...at(300, i * 50) })),
  ];
  const placed = placeModuleInstance({ nodes, connections: [] }, inv.definition, { x: 200, y: 200 }, 'u_inv0');
  const id = placed.instance.id;
  const circuit: Circuit = {
    nodes: placed.circuit.nodes,
    connections: [
      // Design-canvas pin names (chip metadata): A/B/Cin in, Sum/Cout out.
      wire('k1', 'sw0', 'out', 'fa', 'A'), wire('k2', 'sw1', 'out', 'fa', 'B'), wire('k3', 'sw2', 'out', 'fa', 'Cin'),
      wire('k4', 'fa', 'Sum', 'ld0', 'in'), wire('k5', 'fa', 'Cout', 'ld1', 'in'),
      wire('k6', 'sw0', 'out', 'n3', 'a'), wire('k7', 'sw1', 'out', 'n3', 'b'), wire('k8', 'sw2', 'out', 'n3', 'c'),
      wire('k9', 'n3', 'out', 'ld2', 'in'),
      wire('k10', 'vcc', 'out', 'ld3', 'in'),
      wire('k11', 'sw0', 'out', id, 'A'), wire('k12', id, 'Y', 'ld4', 'in'),
    ],
  };
  return project('e1', circuit, inv.hierarchy,
    [['sw0', 'SW0', 'SW0'], ['sw1', 'SW1', 'SW1'], ['sw2', 'SW2', 'SW2']],
    [['ld0', 'LD0', 'LD0'], ['ld1', 'LD1', 'LD1'], ['ld2', 'LD2', 'LD2'], ['ld3', 'LD3', 'LD3'], ['ld4', 'LD4', 'LD4']],
    vectors);
}

const E1_EXPECTED = (a: number, b: number, c: number) => ({
  ld0: a ^ b ^ c,
  ld1: (a & b) | (c & (a ^ b)),
  ld2: a & b & c ? 0 : 1,
  ld3: 1,
  ld4: a,
});

describe('hierarchical emitter expresses every supported primitive', () => {
  it('E1: FullAdder, NAND3 and PowerSource at the top are exported, not tied to 0', () => {
    const hier = generateHierarchicalVhdlProject(e1Project())!;
    expect(hier.diagnostics).toEqual([]);
    expect(fabricatedZeros(hier.topVhd)).toEqual([]);
    expect(hier.topVhd).toMatch(/n_vcc_out <= '1';/);
    expect(hier.topVhd).toMatch(/n_fa_sum <= SW\(0\) xor SW\(1\) xor SW\(2\);/);
    expect(hier.topVhd).toMatch(/n_fa_carry <= \(SW\(0\) and SW\(1\)\) or \(SW\(2\) and \(SW\(0\) xor SW\(1\)\)\);/);
    expect(hier.topVhd).toMatch(/n_n3_out <= not \(SW\(0\) and SW\(1\) and SW\(2\)\);/);
    expect(hier.topVhd).toMatch(/LED\(0\) <= n_fa_sum;\s+LED\(1\) <= n_fa_carry;\s+LED\(2\) <= n_n3_out;\s+LED\(3\) <= n_vcc_out;/);
    expect(buildExportViewModel(e1Project()).status).toBe('ok');
  });

  /**
   * One part at the top of a hierarchical project, every input wired under the name the
   * simulator reads it by first (inputPinsOf) and its outputs read under the names it
   * publishes (outputPortsOf), or under `extraInputs` as well.
   */
  function primitiveProject(type: string, config: Record<string, unknown> = {}, extraInputs: string[] = []) {
    const inv = notModule();
    const pins = inputPinsOf(type, config) ?? [];
    const outputs = (outputPortsOf(type, config) ?? []).map((port) => port.names[0]);
    const nodes: Node[] = [
      { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0) },
      { id: 'clk', type: 'INPUT', label: 'CLK100MHZ', ...at(0, 50) },
      { id: 'p', type, config, ...at(100) },
      { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(300) },
      { id: 'ld1', type: 'OUTPUT', label: 'LD1', ...at(300, 50) },
    ];
    const placed = placeModuleInstance({ nodes, connections: [] }, inv.definition, { x: 200, y: 200 }, 'u_inv0');
    const circuit: Circuit = {
      nodes: placed.circuit.nodes,
      connections: [
        ...pins.map((pin, i) => wire(`i${i}`, pin.role === 'clock' ? 'clk' : 'sw0', 'out', 'p', pin.names[0])),
        ...extraInputs.map((port, i) => wire(`x${i}`, 'sw0', 'out', 'p', port)),
        wire('o0', 'p', outputs[0] ?? 'out', 'ld0', 'in'),
        wire('o1', 'p', outputs[1] ?? outputs[0] ?? 'out', 'ld1', 'in'),
      ],
    };
    return project('prim', circuit, inv.hierarchy,
      [['sw0', 'SW0', 'SW0'], ['clk', 'CLK100MHZ', 'CLK100MHZ']], [['ld0', 'LD0', 'LD0'], ['ld1', 'LD1', 'LD1']]);
  }

  /** Width-1 registers: the scalar export expresses only one bit (wider words block by name). */
  const SCALAR = { width: 1 };
  const configFor = (type: string) => (['Register1', 'RegisterBus', 'StateBank'].includes(type) ? SCALAR : {});

  it.each(getVhdlLogicNodeTypes().filter((type) => !['Ground', 'PowerSource'].includes(type) && inputPinsOf(type) !== null))(
    '%s at the top of a hierarchical project uses the shared primitive emitter',
    (type) => {
      const hier = generateHierarchicalVhdlProject(primitiveProject(type, configFor(type)))!;
      expect(hier.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(fabricatedZeros(hier.topVhd)).toEqual([]);
      expect(hier.topVhd).not.toContain('RBEX');
      expect(hier.topVhd).toMatch(/LED\(0\) <= n_p_\w+;/);
    },
  );

  it.each(getVhdlLogicNodeTypes().filter((type) => inputPinsOf(type) === null))(
    '%s, which the simulator does not define, blocks by name instead of shipping invented logic',
    (type) => {
      const hier = generateHierarchicalVhdlProject(primitiveProject(type))!;
      expect(hier.diagnostics.map((d) => d.message).join('\n')).toMatch(new RegExp(`Unsupported synth subset node type "${type}" on node "p"`));
      const vm = buildExportViewModel(primitiveProject(type));
      expect(vm.status).not.toBe('ok');
      expect(vm.errors.map((e) => e.code)).toContain('RBEX4100');
    },
  );

  it.each([
    ['AND', 'A', 'RBEX4104'],
    ['FullAdder', 'a', 'RBEX4104'],
    ['NOT', 'a', 'RBEX4104'],
    ['XOR', 'a', 'RBEX4105'],
    ['DFlipFlop', 'in', 'RBEX4105'],
  ] as const)('%s with an extra wire into "%s" blocks by name (%s), flat and hierarchical', (type, port, code) => {
    // The simulator ignores a wire into a name it does not read, and reads only the first of
    // two names of one input: exported hardware could only copy that silently.
    const withExtra = primitiveProject(type, {}, [port]);
    const hier = generateHierarchicalVhdlProject(withExtra)!;
    expect(hier.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join('\n')).toContain(`"${port}"`);
    const vm = buildExportViewModel(withExtra);
    expect(vm.status).not.toBe('ok');
    expect(vm.errors.map((e) => e.code)).toContain(code);
    const named = vm.errors.find((e) => e.code === code)!;
    expect(named.canonical.location?.nodeId).toBe('p');
    expect(isDesignOwnedExportDiagnostic(named.code)).toBe(true);
  });

  it('reads a part only through the output names the simulator publishes', () => {
    // A FullAdder publishes Sum and Cout; "sum" carries nothing in the simulator.
    const lower = primitiveProject('FullAdder');
    const circuit = { ...lower.circuit, connections: lower.circuit.connections.map((c) => (c.id === 'o0' ? wire('o0', 'p', 'sum', 'ld0', 'in') : c)) };
    const vm = buildExportViewModel({ ...lower, circuit });
    expect(vm.status).not.toBe('ok');
    expect(vm.errors.map((e) => e.message).join('\n')).toMatch(/Unresolved driver "p\.sum"/);
  });

  it('E2: a leaf module Register1 keeps its async clear and clock enable', () => {
    const base: Circuit = {
      nodes: [
        { id: 'd', type: 'INPUT', label: 'D', ...at(0, 0) },
        { id: 'clk', type: 'INPUT', label: 'CLK', ...at(0, 50) },
        { id: 'rst', type: 'INPUT', label: 'RST', ...at(0, 100) },
        { id: 'en', type: 'INPUT', label: 'EN', ...at(0, 150) },
        { id: 'r', type: 'Register1', config: { resetKind: 'async_clear', hasEnable: true }, ...at(100, 50) },
        { id: 'nq', type: 'NOT', ...at(150, 50) },
        { id: 'q', type: 'OUTPUT', label: 'Q', ...at(200, 50) },
      ],
      connections: [
        wire('a1', 'd', 'out', 'r', 'D'), wire('a2', 'clk', 'out', 'r', 'CLK'), wire('a3', 'rst', 'out', 'r', 'RST'),
        wire('a4', 'en', 'out', 'r', 'EN'), wire('a5', 'r', 'Q', 'nq', 'in'), wire('a6', 'nq', 'out', 'q', 'in'),
      ],
    };
    const created = createModuleFromSelection(base, createEmptyProjectHierarchy(), {
      moduleName: 'RegCell', instanceName: 'u_reg', selectedNodeIds: ['r', 'nq'], nowIso: NOW,
    });
    const hier = generateHierarchicalVhdlProject(project('e2', created.circuit, created.hierarchy,
      [['d', 'D', 'SW0'], ['clk', 'CLK', 'CLK100MHZ'], ['rst', 'RST', 'BTNC'], ['en', 'EN', 'SW1']], [['q', 'Q', 'LD0']]))!;
    const module = hier.moduleSources[0].text;
    expect(module).toMatch(/process \(\w+, \w+\)\s+begin\s+if \w+ = '1' then\s+\w+ <= '0';\s+elsif rising_edge/);
    expect(module).toMatch(/if \w+ = '1' then\s+\w+ <= \w+;\s+end if;/);
  });

  it('E5: a structural module with FullAdder and PowerSource drives its outputs', () => {
    const leaf = notModule(createEmptyProjectHierarchy(), 'Leaf');
    const base: Circuit = {
      nodes: [
        { id: 'a', type: 'INPUT', label: 'A', ...at(0, 0) },
        { id: 'b', type: 'INPUT', label: 'B', ...at(0, 50) },
        { id: 'fa', type: 'FullAdder', ...at(100, 0) },
        { id: 'vcc', type: 'PowerSource', ...at(100, 100) },
        { id: 's', type: 'OUTPUT', label: 'S', ...at(200, 0) },
        { id: 'h', type: 'OUTPUT', label: 'H', ...at(200, 100) },
      ],
      // The simulator reads a FullAdder as A, B, Cin and publishes Sum (inputPinsOf/outputPortsOf).
      connections: [
        wire('m1', 'a', 'out', 'fa', 'A'), wire('m2', 'b', 'out', 'fa', 'B'), wire('m3', 'fa', 'Sum', 's', 'in'),
        wire('m4', 'vcc', 'out', 'h', 'in'), wire('m5', 'vcc', 'out', 'fa', 'Cin'),
      ],
    };
    const mid = createModuleFromSelection(base, leaf.hierarchy, {
      moduleName: 'Mid', instanceName: 'u_mid', selectedNodeIds: ['fa', 'vcc'], nowIso: NOW,
    });
    const leafDef = mid.hierarchy.modules.find((m) => m.name === 'Leaf')!;
    const midDef = mid.hierarchy.modules.find((m) => m.name === 'Mid')!;
    const placedInMid = placeModuleInstance(midDef.circuit, leafDef, { x: 300, y: 0 }, 'u_leaf0');
    const hierarchy: ProjectHierarchyDocument = {
      ...mid.hierarchy,
      modules: mid.hierarchy.modules.map((m) => (m.id === midDef.id ? { ...m, circuit: placedInMid.circuit } : m)),
    };
    const hier = generateHierarchicalVhdlProject(project('e5', mid.circuit, hierarchy,
      [['a', 'A', 'SW0'], ['b', 'B', 'SW1']], [['s', 'S', 'LD0'], ['h', 'H', 'LD1']]))!;
    const midText = hier.moduleSources.find((source) => source.entityName === 'Mid')!.text;
    expect(hier.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(midText).toContain('architecture structural of Mid');
    expect(fabricatedZeros(midText)).toEqual([]);
    expect(midText).toMatch(/n_vcc_out <= '1';/);
    expect(midText).toMatch(/n_fa_sum <= \w+ xor \w+ xor n_vcc_out;/);
  });

  it('E3: a vector module port is associated bit by bit at the instance', () => {
    const base: Circuit = {
      nodes: [
        { id: 'A0', type: 'INPUT', label: 'A[0]', ...at(0, 0) },
        { id: 'A1', type: 'INPUT', label: 'A[1]', ...at(0, 60) },
        { id: 'Y0', type: 'OUTPUT', label: 'Y[0]', ...at(340, 0) },
        { id: 'Y1', type: 'OUTPUT', label: 'Y[1]', ...at(340, 60) },
        { id: 'n0', type: 'NOT', ...at(150, 0) },
        { id: 'x1', type: 'XOR', ...at(240, 60) },
      ],
      connections: [
        wire('v1', 'A0', 'out', 'n0', 'in'), wire('v2', 'n0', 'out', 'Y0', 'in'), wire('v3', 'n0', 'out', 'x1', 'a'),
        wire('v4', 'A1', 'out', 'x1', 'b'), wire('v5', 'x1', 'out', 'Y1', 'in'),
      ],
    };
    const inv = createModuleFromSelection(base, createEmptyProjectHierarchy(), {
      moduleName: 'InvBus', instanceName: 'u_inv', selectedNodeIds: ['n0', 'x1'], nowIso: NOW,
    });
    const hier = generateHierarchicalVhdlProject(project('e3', inv.circuit, inv.hierarchy,
      [['A0', 'A[0]', 'SW0'], ['A1', 'A[1]', 'SW1']], [['Y0', 'Y[0]', 'LD0'], ['Y1', 'Y[1]', 'LD1']]))!;
    expect(hier.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(hier.topVhd).not.toMatch(/=> '0'/);
    expect(hier.topVhd).not.toMatch(/\b\w+_\b(?![(])/);
    // Declared order, left to right: A(1 downto 0).
    expect(hier.topVhd).toMatch(/A\(1\) => A\(1\),\s+A\(0\) => A\(0\),\s+Y => n_u_inv_Y/);
    expect(hier.topVhd).toMatch(/Y\(0\) <= n_u_inv_Y\(0\);\s+Y\(1\) <= n_u_inv_Y\(1\);/);
    expect(hier.topVhd).toMatch(/signal n_u_inv_Y : STD_LOGIC_VECTOR\(1 downto 0\);/);
  });

  it('E14: a 4-NAND D-latch ships as the latch the export gate validated', () => {
    const inv = notModule();
    const nodes: Node[] = [
      { id: 'd', type: 'INPUT', label: 'D', ...at(0) },
      { id: 'en', type: 'INPUT', label: 'EN', ...at(0, 50) },
      { id: 's', type: 'NAND', ...at(100) }, { id: 'h', type: 'NAND', ...at(100, 50) },
      { id: 'q', type: 'NAND', ...at(200) }, { id: 'qn', type: 'NAND', ...at(200, 50) },
      { id: 'lq', type: 'OUTPUT', label: 'Q', ...at(300) },
      { id: 'ly', type: 'OUTPUT', label: 'Y', ...at(300, 100) },
    ];
    const placed = placeModuleInstance({ nodes, connections: [] }, inv.definition, { x: 200, y: 150 }, 'u_inv0');
    const id = placed.instance.id;
    const circuit: Circuit = { nodes: placed.circuit.nodes, connections: [
      wire('l1', 'd', 'out', 's', 'a'), wire('l2', 'en', 'out', 's', 'b'),
      wire('l3', 's', 'out', 'h', 'a'), wire('l4', 'en', 'out', 'h', 'b'),
      wire('l5', 's', 'out', 'q', 'a'), wire('l6', 'qn', 'out', 'q', 'b'),
      wire('l7', 'h', 'out', 'qn', 'a'), wire('l8', 'q', 'out', 'qn', 'b'),
      wire('l9', 'q', 'out', 'lq', 'in'),
      wire('l10', 'd', 'out', id, 'A'), wire('l11', id, 'Y', 'ly', 'in'),
    ] };
    const hier = generateHierarchicalVhdlProject(project('e14', circuit, inv.hierarchy,
      [['d', 'D', 'V17'], ['en', 'EN', 'V16']], [['lq', 'Q', 'U16'], ['ly', 'Y', 'E19']]))!;
    expect(hier.topVhd).toMatch(/process \(\w+, \w+\)\s+begin\s+if \w+ = '1' then/);
    expect(hier.topVhd.match(/<= not \(\w+ and \w+\);/g) ?? []).toHaveLength(0);
  });

  it('E10: the shipped top.vhd and top.xdc share one port naming authority', () => {
    const inv = notModule();
    const nodes: Node[] = [
      { id: 'a', type: 'INPUT', label: 'A', ...at(0) },
      { id: 'b', type: 'INPUT', label: 'B', ...at(0, 50) },
      { id: 'g', type: 'AND', ...at(100) },
      { id: 'y', type: 'OUTPUT', label: 'Y', ...at(300) },
    ];
    const placed = placeModuleInstance({ nodes, connections: [] }, inv.definition, { x: 200, y: 0 }, 'u_inv0');
    const id = placed.instance.id;
    const circuit: Circuit = { nodes: placed.circuit.nodes, connections: [
      wire('q1', 'a', 'out', 'g', 'a'), wire('q2', 'b', 'out', 'g', 'b'),
      wire('q3', 'g', 'out', id, 'A'), wire('q4', id, 'Y', 'y', 'in'),
    ] };
    const vm = buildExportViewModel(project('e10', circuit, inv.hierarchy, [['a', 'A', 'SW0'], ['b', 'B', 'SW1']], [['y', 'Y', 'LD0']]));
    const top = vm.artifacts.find((a) => a.path === 'top.vhd')!.content;
    const xdc = vm.artifacts.find((a) => a.path === 'top.xdc')!.content;
    expect(top).toContain('Generated by RedByte from the native visual project hierarchy.');
    expect(findVhdlXdcPortMismatches(top, xdc)).toEqual([]);
    expect(vm.status).toBe('ok');
  });
});

describe('constructs the HDL cannot express block the package by name', () => {
  const blockedBy = (proj: RBProject, pattern: RegExp) => {
    const before = JSON.stringify(proj);
    const vm = buildExportViewModel(proj);
    expect(vm.status).toBe('blocked');
    const error = vm.errors.find((entry) => pattern.test(entry.message));
    expect(error, vm.errors.map((e) => e.message).join('\n')).toBeDefined();
    expect(vm.artifacts.find((a) => a.path === 'top.vhd')?.status).toBe('blocked');
    // The design is preserved exactly: export never rewrites the circuit.
    expect(JSON.stringify(proj)).toBe(before);
    return { vm, error: error! };
  };

  it('E6: a flat Delay is RBEX4100, design-owned, and blocks checked runs', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0) },
        { id: 'dl', type: 'Delay', ...at(100) },
        { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(200) },
      ],
      connections: [wire('d1', 'sw0', 'out', 'dl', 'in'), wire('d2', 'dl', 'out', 'ld0', 'in')],
    };
    const { error } = blockedBy(project('e6', circuit, undefined, [['sw0', 'SW0', 'SW0']], [['ld0', 'LD0', 'LD0']]),
      /Unsupported synth subset node type "Delay" on node "dl"/);
    expect(error.code).toBe('RBEX4100');
    expect(isDesignOwnedExportDiagnostic(error.code)).toBe(true);
  });

  it('E12: a flat Counter4Bit is RBEX4100', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'clk', type: 'INPUT', label: 'CLK', ...at(0) },
        { id: 'c', type: 'Counter4Bit', ...at(100) },
        { id: 'q0', type: 'OUTPUT', label: 'Q0', ...at(300) },
      ],
      connections: [wire('z1', 'clk', 'out', 'c', 'CLK'), wire('z2', 'c', 'Q0', 'q0', 'in')],
    };
    const { error } = blockedBy(project('e12', circuit, undefined, [['clk', 'CLK', 'CLK100MHZ']], [['q0', 'Q0', 'LD0']]),
      /Unsupported synth subset node type "Counter4Bit"/);
    expect(error.code).toBe('RBEX4100');
  });

  it('a Delay at the top of a hierarchical project is RBEX4100 with its file', () => {
    const inv = notModule();
    const nodes: Node[] = [
      { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0) },
      { id: 'dl', type: 'Delay', ...at(100) },
      { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(200) },
      { id: 'ld1', type: 'OUTPUT', label: 'LD1', ...at(200, 50) },
    ];
    const placed = placeModuleInstance({ nodes, connections: [] }, inv.definition, { x: 100, y: 100 }, 'u_inv0');
    const id = placed.instance.id;
    const proj = project('hd', { nodes: placed.circuit.nodes, connections: [
      wire('d1', 'sw0', 'out', 'dl', 'in'), wire('d2', 'dl', 'out', 'ld0', 'in'),
      wire('d3', 'sw0', 'out', id, 'A'), wire('d4', id, 'Y', 'ld1', 'in'),
    ] }, inv.hierarchy, [['sw0', 'SW0', 'SW0']], [['ld0', 'LD0', 'LD0'], ['ld1', 'LD1', 'LD1']]);
    const hier = generateHierarchicalVhdlProject(proj)!;
    expect(hier.diagnostics).toEqual([expect.objectContaining({
      severity: 'error', definitionId: 'top', path: 'top.vhd', nodeId: 'dl',
      message: expect.stringMatching(/^Unsupported synth subset node type "Delay" on node "dl" \(in top\.vhd\)\. Fix: /),
    })]);
    expect(hier.topVhd).toContain('-- RBEX4100 unsupported primitive Delay (dl): not exported');
    expect(fabricatedZeros(hier.topVhd)).toEqual([]);
    blockedBy(proj, /Unsupported synth subset node type "Delay" on node "dl"/);
  });

  it('a Delay inside a leaf module is RBEX4100 naming the module file', () => {
    const base: Circuit = {
      nodes: [
        { id: 'i', type: 'INPUT', label: 'A', ...at(0) },
        { id: 'dl', type: 'Delay', ...at(100) },
        { id: 'nx', type: 'NOT', ...at(150) },
        { id: 'o', type: 'OUTPUT', label: 'Y', ...at(200) },
      ],
      connections: [wire('a', 'i', 'out', 'dl', 'in'), wire('b', 'dl', 'out', 'nx', 'in'), wire('c', 'nx', 'out', 'o', 'in')],
    };
    const created = createModuleFromSelection(base, createEmptyProjectHierarchy(), {
      moduleName: 'Slow', instanceName: 'u_slow', selectedNodeIds: ['dl', 'nx'], nowIso: NOW,
    });
    const proj = project('leafdelay', created.circuit, created.hierarchy, [['i', 'A', 'SW0']], [['o', 'Y', 'LD0']]);
    const hier = generateHierarchicalVhdlProject(proj)!;
    // The NOT reading the Delay is named too: its driver has no exported signal. (Before exact
    // driver resolution, the module input bound to the Delay's own id was substituted for the
    // Delay's output, a silent short-circuit hidden only because the package was blocked.)
    expect(hier.diagnostics.map((d) => d.message)).toEqual([
      expect.stringMatching(/^Unsupported synth subset node type "Delay" on node "dl"\. Fix: .* \[in slow\.vhd\]$/),
      expect.stringMatching(/^Unresolved driver "dl\.out" on node "dl": .* \[in slow\.vhd\]$/),
    ]);
    blockedBy(proj, /Unsupported synth subset node type "Delay"/);
  });

  it('E4: an instance whose definition is missing is a named error', () => {
    const inv = notModule();
    const nodes: Node[] = [
      { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0) },
      { id: 'ghost', type: 'Ghost', label: 'u_ghost', config: { moduleDefinitionId: 'module-deleted', instanceName: 'u_ghost', nativeVisualModule: true }, ...at(100) },
      { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(200) },
      { id: 'ld1', type: 'OUTPUT', label: 'LD1', ...at(200, 50) },
    ];
    const placed = placeModuleInstance({ nodes, connections: [] }, inv.definition, { x: 100, y: 100 }, 'u_inv0');
    const id = placed.instance.id;
    const proj = project('e4', { nodes: placed.circuit.nodes, connections: [
      wire('g1', 'sw0', 'out', 'ghost', 'A'), wire('g2', 'ghost', 'Y', 'ld0', 'in'),
      wire('g3', 'sw0', 'out', id, 'A'), wire('g4', id, 'Y', 'ld1', 'in'),
    ] }, inv.hierarchy, [['sw0', 'SW0', 'SW0']], [['ld0', 'LD0', 'LD0'], ['ld1', 'LD1', 'LD1']]);
    const hier = generateHierarchicalVhdlProject(proj)!;
    expect(hier.diagnostics.map((d) => d.message).join('\n')).toMatch(/Module instance "ghost" references missing definition "module-deleted"/);
    expect(fabricatedZeros(hier.topVhd)).toEqual([]);
    expect(buildExportViewModel(proj).status).toBe('blocked');
    // The Meridian Source lens and recordings carry the same limitation.
    const journey = generateJourneySource(proj.circuit, proj.hierarchy, [
      { id: 'sw0', nodeId: 'sw0', port: 'out', label: 'SW0', pin: 'SW0', direction: 'in' },
      { id: 'ld0', nodeId: 'ld0', port: 'in', label: 'LD0', pin: 'LD0', direction: 'out' },
      { id: 'ld1', nodeId: 'ld1', port: 'in', label: 'LD1', pin: 'LD1', direction: 'out' },
    ] as never, 'probe_top');
    expect(journey.diagnostics?.join('\n')).toMatch(/references missing definition "module-deleted"/);
  });

  it('E8: a module may not be named after a built-in part or a VHDL reserved word', () => {
    for (const name of ['AND', 'Full Adder', 'Register1', 'signal', 'Register']) {
      expect(() => notModule(createEmptyProjectHierarchy(), name), name).toThrow(/Choose another name/);
    }
    // A saved project that already has such a module is reported, not rewritten.
    const inv = notModule(createEmptyProjectHierarchy(), 'Inv');
    const renamed = { ...inv.hierarchy, modules: inv.hierarchy.modules.map((m) => ({ ...m, name: 'AND' })) };
    const hier = generateHierarchicalVhdlProject(project('e8', inv.circuit, renamed, [['mi', 'A', 'SW0']], [['mo', 'Y', 'LD0']]))!;
    expect(hier.diagnostics.map((d) => d.message).join('\n')).toMatch(/Module name "AND" is a VHDL reserved word/);
  });
});

describe('flat emitter resolves every output port exactly', () => {
  const topOf = (proj: RBProject) => {
    const result = exportProjectAsBasys3(proj);
    return { result, top: result.bundle?.topVhd ?? '' };
  };

  it('E16: a Q_inv consumer whose id sorts before the flip-flop reads Q_inv', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'clk', type: 'INPUT', label: 'CLK100MHZ', ...at(0) },
        { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0, 50) },
        { id: 'z_ff', type: 'DFlipFlop', ...at(100) },
        { id: 'a_not', type: 'NOT', ...at(200) },
        { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(300) },
      ],
      connections: [
        wire('w1', 'clk', 'out', 'z_ff', 'CLK'), wire('w2', 'sw0', 'out', 'z_ff', 'D'),
        wire('w3', 'z_ff', 'Q_inv', 'a_not', 'in'), wire('w4', 'a_not', 'out', 'ld0', 'in'),
      ],
    };
    const { top } = topOf(project('e16', circuit, undefined, [['clk', 'CLK100MHZ', 'CLK100MHZ'], ['sw0', 'SW0', 'SW0']], [['ld0', 'LD0', 'LD0']]));
    expect(top).toMatch(/not_0 <= not dff_0_inv;/);
  });

  it('E1c: FullAdder Sum/Cout (Design-canvas pin names) drive the LEDs', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0, 0) },
        { id: 'sw1', type: 'INPUT', label: 'SW1', ...at(0, 50) },
        { id: 'sw2', type: 'INPUT', label: 'SW2', ...at(0, 100) },
        { id: 'fa', type: 'FullAdder', ...at(100, 0) },
        { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(300, 0) },
        { id: 'ld1', type: 'OUTPUT', label: 'LD1', ...at(300, 50) },
      ],
      connections: [
        wire('k1', 'sw0', 'out', 'fa', 'A'), wire('k2', 'sw1', 'out', 'fa', 'B'), wire('k3', 'sw2', 'out', 'fa', 'Cin'),
        wire('k4', 'fa', 'Sum', 'ld0', 'in'), wire('k5', 'fa', 'Cout', 'ld1', 'in'),
      ],
    };
    const { result, top } = topOf(project('e1c', circuit, undefined,
      [['sw0', 'SW0', 'SW0'], ['sw1', 'SW1', 'SW1'], ['sw2', 'SW2', 'SW2']], [['ld0', 'LD0', 'LD0'], ['ld1', 'LD1', 'LD1']]));
    expect(result.errors).toEqual([]);
    expect(top).toMatch(/<= fa_0_sum;/);
    expect(top).toMatch(/<= fa_0_carry;/);
    expect(top).not.toMatch(/<= fa_0;/);
  });

  it('E15: a NOT with an open input drives 1, as in the simulator', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0) },
        { id: 'g', type: 'AND', ...at(100) },
        { id: 'n', type: 'NOT', ...at(100, 50) },
        { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(200) },
        { id: 'ld1', type: 'OUTPUT', label: 'LD1', ...at(200, 50) },
      ],
      connections: [wire('a', 'sw0', 'out', 'g', 'a'), wire('b', 'sw0', 'out', 'g', 'b'), wire('c', 'g', 'out', 'ld0', 'in'), wire('d', 'n', 'out', 'ld1', 'in')],
    };
    const { top } = topOf(project('e15', circuit, undefined, [['sw0', 'SW0', 'SW0']], [['ld0', 'LD0', 'LD0'], ['ld1', 'LD1', 'LD1']]));
    expect(top).toMatch(/not_0 <= not '0';/);
  });

  it('an output port a part does not have is an error and an undeclared marker, never a guess', () => {
    const circuit: Circuit = {
      nodes: [
        { id: 'clk', type: 'INPUT', label: 'CLK100MHZ', ...at(0) },
        { id: 'sw0', type: 'INPUT', label: 'SW0', ...at(0, 50) },
        { id: 'ff', type: 'DFlipFlop', ...at(100) },
        { id: 'ld0', type: 'OUTPUT', label: 'LD0', ...at(300) },
      ],
      connections: [wire('w1', 'clk', 'out', 'ff', 'CLK'), wire('w2', 'sw0', 'out', 'ff', 'D'), wire('w3', 'ff', 'Qbar', 'ld0', 'in')],
    };
    const { result, top } = topOf(project('qbar', circuit, undefined, [['clk', 'CLK100MHZ', 'CLK100MHZ'], ['sw0', 'SW0', 'SW0']], [['ld0', 'LD0', 'LD0']]));
    expect(top).toContain('RBEX_UNRESOLVED_ff_Qbar');
    expect(result.errors.map((e) => e.message).join('\n')).toMatch(/Unresolved driver "ff\.Qbar"/);
  });
});

const GHDL = process.env.REDBYTE_GHDL?.trim() ?? '';
const ghdlAvailable = GHDL.length > 0 && existsSync(GHDL);

describe.skipIf(!ghdlAvailable)('shipped hierarchical HDL agrees with the simulator (GHDL)', () => {
  it('E1: every switch combination passes the exported self-checking testbench', () => {
    const vm = buildExportViewModel(e1Project(threeSwitchVectors(E1_EXPECTED)));
    expect(vm.status).toBe('ok');
    const design = vm.artifacts.filter((a) => a.category === 'design-source' && a.kind === 'vhd');
    const bench = vm.artifacts.find((a) => a.path === 'testbench.vhd')!;
    const dir = mkdtempSync(join(tmpdir(), 'rb-hier-ghdl-'));
    try {
      const files = [...design.map((a) => ({ name: a.path.replace(/\//g, '_'), text: a.content })), { name: 'testbench.vhd', text: bench.content }];
      for (const file of files) writeFileSync(join(dir, file.name), file.text);
      const opts = { cwd: dir, encoding: 'utf8' as const, timeout: 60_000 };
      // Leaf-first order as packaged, then the top, then the bench.
      const ordered = [...files.filter((f) => f.name !== 'top.vhd' && f.name !== 'testbench.vhd'), files.find((f) => f.name === 'top.vhd')!, files.find((f) => f.name === 'testbench.vhd')!];
      const analyze = spawnSync(GHDL, ['-a', '--std=08', ...ordered.map((f) => f.name)], opts);
      expect(analyze.status, `${analyze.stdout}${analyze.stderr}`).toBe(0);
      expect(spawnSync(GHDL, ['-e', '--std=08', vm.topAuthority.simulationTop], opts).status).toBe(0);
      const run = spawnSync(GHDL, ['-r', '--std=08', vm.topAuthority.simulationTop], opts);
      const out = `${run.stdout}${run.stderr}`;
      expect(out).toMatch(/REDBYTE_TB_RESULT v=1 tb=\w+ status=PASS checks=40 failures=0/);
      expect(run.status, out).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
