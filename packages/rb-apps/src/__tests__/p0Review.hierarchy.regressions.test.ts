// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { useProjectRuntime } from '../apps/ide/projectRuntime';
import { createEmptyProjectHierarchy, createModuleFromSelection, rederiveModulePortRefs } from '../apps/ide/projectHierarchy';
import { ghdlAvailable, ghdlRequired } from './helpers/ghdlHarness';
import { artifactText, at, browserFailureCount, NOW, projectOf, resetRuntime, runPackage, runProduct, wire } from './helpers/productPath';

/**
 * Regressions for the 2026-10-27 adversarial review of hierarchical export (P0 branch
 * a9127d88d). The simulator flattens instances: a wire into "A" reaches every bit of A, a wire
 * into "A(i)" reaches bit i (or a scalar A), and an unconnected module input leaves each pin
 * inside at its own unconnected level. The exported structure must mean the same, or refuse.
 */

const useGhdl = ghdlAvailable || ghdlRequired;
const vec = (tick: number, inputs: Record<string, number>, expected: Record<string, number>): TestVector =>
  ({ tick, inputs, expected } as TestVector);
const sw = (id: string, label: string): Node => ({ id, type: 'INPUT', label, ...at(0) });
const led = (id: string, label: string): Node => ({ id, type: 'OUTPUT', label, ...at(600) });
const part = (id: string, type: string): Node => ({ id, type, ...at(300) });
const exhaustive = (inputs: string[], fn: (v: Record<string, number>) => Record<string, number>): TestVector[] =>
  Array.from({ length: 2 ** inputs.length }, (_unused, n) => {
    const values = Object.fromEntries(inputs.map((name, bit) => [name, (n >> bit) & 1]));
    return vec(n, values, fn(values));
  });
const isTo = (c: Circuit['connections'][number], nodeId: string, port?: string) =>
  typeof c.to === 'object' && c.to.nodeId === nodeId && (port === undefined || c.to.portName === port);

beforeEach(() => resetRuntime());

async function expectAgreement(label: string, expectedChecks: number) {
  const product = runProduct();
  expect(product.run, product.refusal).toBeDefined();
  expect(browserFailureCount(product.run!), 'Verify against the hand-written expectations').toBe(0);
  expect(product.vm.status, product.vm.errors.map((error) => `${error.code} ${error.message}`).join('\n')).toBe('ok');
  if (!useGhdl) return product;
  const packaged = await runPackage(label, product, expectedChecks);
  expect(packaged.outcome, packaged.log).toBe('PASS');
  return product;
}

/** Module "Cell": a DFlipFlop (CLK, D, EN from ports) into a NOT. */
function dffCell() {
  const base: Circuit = {
    nodes: [sw('clk', 'CLK'), sw('d', 'D'), sw('en', 'EN'), part('ff', 'DFlipFlop'), part('n', 'NOT'), led('y', 'Y')],
    connections: [wire('a1', 'clk', 'out', 'ff', 'CLK'), wire('a2', 'd', 'out', 'ff', 'D'), wire('a3', 'en', 'out', 'ff', 'EN'),
      wire('a4', 'ff', 'Q', 'n', 'in'), wire('a5', 'n', 'out', 'y', 'in')],
  };
  return createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Cell', instanceName: 'u_c', selectedNodeIds: ['ff', 'n'], nowIso: NOW });
}

describe('instance inputs (review P0-1, P0-2, P0-3)', () => {
  it('an unconnected module input reads the inner pin\'s own level (a DFlipFlop EN reads 1), never a made-up 0', async () => {
    const cell = dffCell();
    const top: Circuit = {
      nodes: cell.circuit.nodes.filter((node) => node.id !== 'en'),
      connections: cell.circuit.connections.filter((c) => !isTo(c, cell.instance.id, 'EN')),
    };
    // EN reads 1, so every board-clock edge captures D: Y = not D.
    useProjectRuntime.getState().loadFromProject(projectOf('unconnected-en', top, [['clk', 'CLK100MHZ'], ['d', 'SW0']], [['y', 'LD0']],
      [vec(0, { d: 1 }, { y: 0 }), vec(1, { d: 0 }, { y: 1 }), vec(2, { d: 1 }, { y: 0 })], cell.hierarchy));
    const product = await expectAgreement('review-a1-unconnected-en', 3);
    expect(artifactText(product, 'top.vhd')).not.toMatch(/EN\s*=>\s*'0'/);
  }, 120_000);

  it('a wire into a whole vector input drives every bit, as the simulator does', async () => {
    const base: Circuit = {
      nodes: [sw('a0', 'A[0]'), sw('a1', 'A[1]'), part('n0', 'NOT'), part('g', 'AND'), part('n1', 'NOT'), led('y', 'Y'), led('z', 'Z')],
      connections: [wire('w1', 'a0', 'out', 'n0', 'in'), wire('w2', 'a1', 'out', 'n1', 'in'), wire('w3', 'n0', 'out', 'g', 'a'),
        wire('w4', 'n1', 'out', 'g', 'b'), wire('w5', 'g', 'out', 'y', 'in'), wire('w6', 'n1', 'out', 'z', 'in')],
    };
    const cell = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Vec', instanceName: 'u_v', selectedNodeIds: ['n0', 'n1', 'g'], nowIso: NOW });
    const top: Circuit = {
      nodes: cell.circuit.nodes.filter((node) => node.id !== 'a1'),
      connections: [...cell.circuit.connections.filter((c) => !isTo(c, cell.instance.id)), wire('t1', 'a0', 'out', cell.instance.id, 'A')],
    };
    useProjectRuntime.getState().loadFromProject(projectOf('whole-vector-in', top, [['a0', 'SW0']], [['y', 'LD0'], ['z', 'LD1']],
      exhaustive(['a0'], (v) => ({ y: 1 - v.a0, z: 1 - v.a0 })), cell.hierarchy));
    await expectAgreement('review-a2-whole-vector', 4);
  }, 120_000);

  it('a wire into "A(0)" of a scalar input reaches A, as the simulator does', async () => {
    const base: Circuit = {
      nodes: [sw('a', 'A'), sw('b', 'B'), part('g', 'OR'), part('n', 'NOT'), led('y', 'Y')],
      connections: [wire('w1', 'a', 'out', 'g', 'a'), wire('w2', 'b', 'out', 'g', 'b'), wire('w3', 'g', 'out', 'n', 'in'), wire('w4', 'n', 'out', 'y', 'in')],
    };
    const cell = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Nor2', instanceName: 'u_n', selectedNodeIds: ['g', 'n'], nowIso: NOW });
    const top: Circuit = {
      nodes: cell.circuit.nodes,
      connections: cell.circuit.connections.map((c) => (isTo(c, cell.instance.id, 'A') ? { ...c, to: { nodeId: cell.instance.id, portName: 'A(0)' } } : c)),
    };
    useProjectRuntime.getState().loadFromProject(projectOf('scalar-bit-in', top, [['a', 'SW0'], ['b', 'SW1']], [['y', 'LD0']],
      exhaustive(['a', 'b'], (v) => ({ y: 1 - (v.a | v.b) })), cell.hierarchy));
    await expectAgreement('review-a3-scalar-bit', 4);
  }, 120_000);

  it('refuses "A[0]", a name no module input has, which both engines ignore', () => {
    const base: Circuit = {
      nodes: [sw('a', 'A'), sw('b', 'B'), part('g', 'OR'), part('n', 'NOT'), led('y', 'Y')],
      connections: [wire('w1', 'a', 'out', 'g', 'a'), wire('w2', 'b', 'out', 'g', 'b'), wire('w3', 'g', 'out', 'n', 'in'), wire('w4', 'n', 'out', 'y', 'in')],
    };
    const cell = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Nor2', instanceName: 'u_n', selectedNodeIds: ['g', 'n'], nowIso: NOW });
    const top: Circuit = {
      nodes: cell.circuit.nodes,
      connections: cell.circuit.connections.map((c) => (isTo(c, cell.instance.id, 'A') ? { ...c, to: { nodeId: cell.instance.id, portName: 'A[0]' } } : c)),
    };
    useProjectRuntime.getState().loadFromProject(projectOf('bracket-bit-in', top, [['a', 'SW0'], ['b', 'SW1']], [['y', 'LD0']], [], cell.hierarchy));
    const product = runProduct();
    expect(product.vm.status).toBe('blocked');
    expect(product.vm.errors.map((error) => error.code)).toContain('RBEX4104');
  });
});

describe('instance outputs (review P1-5, P1-6, P2)', () => {
  it('refuses reading a vector module output whole into one bit', () => {
    const base: Circuit = {
      nodes: [sw('a', 'A'), sw('b', 'B'), part('g', 'AND'), part('x', 'XOR'), led('y0', 'Y[0]'), led('y1', 'Y[1]')],
      connections: [wire('w1', 'a', 'out', 'g', 'a'), wire('w2', 'b', 'out', 'g', 'b'), wire('w3', 'a', 'out', 'x', 'a'), wire('w4', 'b', 'out', 'x', 'b'),
        wire('w5', 'g', 'out', 'y0', 'in'), wire('w6', 'x', 'out', 'y1', 'in')],
    };
    const cell = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Vout', instanceName: 'u_o', selectedNodeIds: ['g', 'x'], nowIso: NOW });
    const top: Circuit = {
      nodes: cell.circuit.nodes.filter((node) => node.id !== 'y1'),
      connections: [...cell.circuit.connections.filter((c) => !(typeof c.from === 'object' && c.from.nodeId === cell.instance.id)),
        wire('t1', cell.instance.id, 'Y', 'y0', 'in')],
    };
    useProjectRuntime.getState().loadFromProject(projectOf('whole-vector-out', top, [['a', 'SW0'], ['b', 'SW1']], [['y0', 'LD0']], [], cell.hierarchy));
    const product = runProduct();
    expect(product.vm.status).toBe('blocked');
    expect(product.vm.errors.some((error) => /Y/.test(error.message))).toBe(true);
  });

  it('refuses a hierarchical top that reads a board OUTPUT, which publishes nothing in the simulator', () => {
    const cell = dffCell();
    const top: Circuit = {
      nodes: [...cell.circuit.nodes, part('n2', 'NOT'), led('z', 'LD1')],
      connections: [...cell.circuit.connections, wire('t1', 'y', 'out', 'n2', 'in'), wire('t2', 'n2', 'out', 'z', 'in')],
    };
    useProjectRuntime.getState().loadFromProject(projectOf('read-output-hier', top, [['clk', 'CLK100MHZ'], ['d', 'SW0'], ['en', 'SW1']], [['y', 'LD0'], ['z', 'LD1']], [], cell.hierarchy));
    const product = runProduct();
    expect(product.vm.status).toBe('blocked');
  });

  it('opens a project whose module output lost its driver, and refuses to export what reads it', () => {
    const base: Circuit = {
      nodes: [sw('a', 'A'), sw('b', 'B'), part('g', 'AND'), part('x', 'XOR'), led('p', 'P'), led('q', 'Q')],
      connections: [wire('w1', 'a', 'out', 'g', 'a'), wire('w2', 'b', 'out', 'g', 'b'), wire('w3', 'a', 'out', 'x', 'a'), wire('w4', 'b', 'out', 'x', 'b'),
        wire('w5', 'g', 'out', 'p', 'in'), wire('w6', 'x', 'out', 'q', 'in')],
    };
    const cell = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Pair', instanceName: 'u_p', selectedNodeIds: ['g', 'x'], nowIso: NOW });
    const qPort = cell.definition.ports.find((port) => port.name === 'Q')!;
    const qBoundary = cell.definition.circuit.nodes.find((node) => node.config?.modulePortId === qPort.id)!;
    const edited = rederiveModulePortRefs({ ...cell.definition, circuit: {
      ...cell.definition.circuit, connections: cell.definition.circuit.connections.filter((c) => !isTo(c, qBoundary.id)) } });
    expect(edited.ports.find((port) => port.name === 'Q')!.sourceBoundary.internalRefs).toEqual([]);
    expect(() => useProjectRuntime.getState().loadFromProject(projectOf('refless-output', cell.circuit, [['a', 'SW0'], ['b', 'SW1']], [['p', 'LD0'], ['q', 'LD1']],
      [], { ...cell.hierarchy, modules: [edited] }))).not.toThrow();
    const product = runProduct();
    expect(product.vm.status).toBe('blocked');
    expect(artifactText(product, 'top.vhd')).not.toMatch(/LED\(1\)\s*<=\s*'0'/);
  });
});

describe('edits inside a module (review P0-4)', () => {
  /** Wrap: Y = A and C, W = Y xor B. */
  function wrapProject() {
    const base: Circuit = {
      nodes: [sw('a', 'A'), sw('b', 'B'), sw('c', 'C'), part('g', 'AND'), part('x', 'XOR'), led('y', 'Y'), led('w', 'W')],
      connections: [wire('w1', 'a', 'out', 'g', 'a'), wire('w2', 'c', 'out', 'g', 'b'), wire('w3', 'g', 'out', 'y', 'in'),
        wire('w4', 'g', 'out', 'x', 'a'), wire('w5', 'b', 'out', 'x', 'b'), wire('w6', 'x', 'out', 'w', 'in')],
    };
    const cell = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Wrap', instanceName: 'u_w', selectedNodeIds: ['g', 'x'], nowIso: NOW });
    return { cell, project: projectOf('module-edit', cell.circuit, [['a', 'SW0'], ['b', 'SW1'], ['c', 'SW2']], [['y', 'LD0'], ['w', 'LD1']], [], cell.hierarchy) };
  }

  it('re-routing a wire inside a module changes what Verify simulates and what Export ships alike', async () => {
    const { cell, project } = wrapProject();
    useProjectRuntime.getState().loadFromProject(project);
    const runtime = useProjectRuntime.getState();
    runtime.setActiveModule(cell.definition.id);
    const inside = useProjectRuntime.getState().hierarchy.modules.find((module) => module.id === cell.definition.id)!.circuit;
    const boundaryA = inside.nodes.find((node) => node.config?.moduleBoundary === 'input' && inside.connections.some((c) => typeof c.from === 'object' && c.from.nodeId === node.id && isTo(c, 'g', 'a')))!;
    // The AND's second input moves from boundary C to boundary A: Y = A.
    useProjectRuntime.getState().updateActiveModuleCircuit({
      nodes: inside.nodes,
      connections: inside.connections.map((c) => (isTo(c, 'g', 'b') ? { ...c, from: { nodeId: boundaryA.id, portName: 'out' } } : c)),
    });
    useProjectRuntime.getState().setActiveModule('top');
    useProjectRuntime.getState().setVectors(exhaustive(['a', 'b', 'c'], (v) => ({ y: v.a, w: v.a ^ v.b })));
    await expectAgreement('review-a4-module-edit', 16);
  }, 120_000);

  it('deleting the wire into a module output leaves it undriven in Verify and refused in Export', () => {
    const { cell, project } = wrapProject();
    useProjectRuntime.getState().loadFromProject(project);
    useProjectRuntime.getState().setActiveModule(cell.definition.id);
    const inside = useProjectRuntime.getState().hierarchy.modules.find((module) => module.id === cell.definition.id)!.circuit;
    const boundaryY = inside.nodes.find((node) => node.config?.moduleBoundary === 'output' && inside.connections.some((c) => isTo(c, node.id) && typeof c.from === 'object' && c.from.nodeId === 'g'))!;
    useProjectRuntime.getState().updateActiveModuleCircuit({ nodes: inside.nodes, connections: inside.connections.filter((c) => !isTo(c, boundaryY.id)) });
    useProjectRuntime.getState().setActiveModule('top');
    useProjectRuntime.getState().setVectors(exhaustive(['a', 'b', 'c'], (v) => ({ y: v.a & v.c, w: (v.a & v.c) ^ v.b })));
    const product = runProduct();
    const yRows = product.run!.report.rows.filter((row) => row.signal === 'y');
    expect(yRows.length).toBeGreaterThan(0);
    expect(yRows.every((row) => row.actual === 'X')).toBe(true);
    expect(product.vm.status).toBe('blocked');
  });
});
