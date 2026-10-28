// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { useProjectRuntime } from '../apps/ide/projectRuntime';
import { createEmptyProjectHierarchy, createModuleFromSelection } from '../apps/ide/projectHierarchy';
import { ghdlAvailable, ghdlRequired } from './helpers/ghdlHarness';
import {
  artifactText, at, browserFailureCount, NOW, projectOf, projectWithMapping, resetRuntime, runPackage, runProduct, wire,
} from './helpers/productPath';

/**
 * Regressions for the 2026-10-27 adversarial review of the generated testbench (P0 branch
 * a9127d88d). Each case takes the student's path (Verify, then Export from the same runtime
 * state) and runs the packaged Open Project files in GHDL. Expectations are written by hand from
 * the design's intent, never read from the engine. The browser and the shipped self-checking
 * testbench must agree check for check, or Export must refuse by name.
 */

const useGhdl = ghdlAvailable || ghdlRequired;
const vec = (tick: number, inputs: Record<string, number>, expected: Record<string, number>): TestVector =>
  ({ tick, inputs, expected } as TestVector);

beforeEach(() => resetRuntime());

/** Y_1 = A and B on LD0, Y1 = A or B on LD1: two row ids that differ only by punctuation. */
function punctuationTwinsProject(expectedOnBoth: (a: number, b: number) => number) {
  const nodes: Node[] = [
    { id: 'a', type: 'INPUT', label: 'A', ...at(0) }, { id: 'b', type: 'INPUT', label: 'B', ...at(0, 60) },
    { id: 'g1', type: 'AND', ...at(100) }, { id: 'g2', type: 'OR', ...at(100, 60) },
    { id: 'y_1', type: 'OUTPUT', label: 'Y_1', ...at(200) }, { id: 'y1', type: 'OUTPUT', label: 'Y1', ...at(200, 60) },
  ];
  const connections = [wire('w1', 'a', 'out', 'g1', 'a'), wire('w2', 'b', 'out', 'g1', 'b'), wire('w3', 'a', 'out', 'g2', 'a'),
    wire('w4', 'b', 'out', 'g2', 'b'), wire('w5', 'g1', 'out', 'y_1', 'in'), wire('w6', 'g2', 'out', 'y1', 'in')];
  const vectors = [0, 1, 2, 3].map((n) => {
    const a = n & 1;
    const b = (n >> 1) & 1;
    return vec(n, { a, b }, { y_1: expectedOnBoth(a, b), y1: expectedOnBoth(a, b) });
  });
  return projectWithMapping('punctuation-twins', { nodes, connections }, {
    inputs: [{ id: 'a', nodeId: 'a', port: 'out', label: 'A', pin: 'SW0' }, { id: 'b', nodeId: 'b', port: 'out', label: 'B', pin: 'SW1' }],
    outputs: [{ id: 'y_1', nodeId: 'y_1', port: 'in', label: 'Y_1', pin: 'LD0' }, { id: 'y1', nodeId: 'y1', port: 'in', label: 'Y1', pin: 'LD1' }],
  }, vectors);
}

describe('testbench assertion targets (review P0-1: punctuation twins)', () => {
  it('checks each output row on its own LED, so a wrong OR output fails in the shipped bench as in Verify', async () => {
    // The student expects AND on both; Y1 is an OR, wrong at a=1,b=0 and a=0,b=1.
    useProjectRuntime.getState().loadFromProject(punctuationTwinsProject((a, b) => a & b));
    const product = runProduct();
    expect(product.run).toBeDefined();
    expect(browserFailureCount(product.run!)).toBe(2);
    expect(product.vm.status).toBe('ok');
    const bench = artifactText(product, 'testbench.vhd');
    const checksOn = (port: string) => (bench.match(new RegExp(`assert ${port.replace(/[()]/g, '\\$&')} = `, 'g')) ?? []).length;
    expect(checksOn('LED(0)'), 'Y_1 checks').toBe(4);
    expect(checksOn('LED(1)'), 'Y1 checks').toBe(4);
    if (!useGhdl) return;
    const packaged = await runPackage('review-p0-1-twins', product, 8);
    expect(packaged.outcome).toBe('FAIL');
    expect(packaged.failures).toBe(2);
  }, 120_000);

  it('passes the same twins when every expectation is right', async () => {
    useProjectRuntime.getState().loadFromProject(punctuationTwinsProject((a, b) => a & b));
    const project = punctuationTwinsProject((a, b) => a & b);
    project.vectors = project.vectors!.map((vector) => {
      const a = Number(vector.inputs.a);
      const b = Number(vector.inputs.b);
      return { ...vector, expected: { y_1: a & b, y1: a | b } };
    });
    useProjectRuntime.getState().loadFromProject(project);
    const product = runProduct();
    expect(browserFailureCount(product.run!)).toBe(0);
    expect(product.vm.status).toBe('ok');
    if (!useGhdl) return;
    const packaged = await runPackage('review-p0-1-twins-right', product, 8);
    expect(packaged.outcome).toBe('PASS');
    expect(packaged.checks).toBe(8);
  }, 120_000);
});

/** D = SW0 and SW1 into a rising-edge Register1 clocked from BTN0 by authored pulses. */
function manualClockProject(rows: Array<{ clk: number; a: number; b: number; q?: number }>) {
  const nodes: Node[] = [
    { id: 'clk', type: 'INPUT', label: 'CLK', ...at(0) },
    { id: 'a', type: 'INPUT', label: 'A', ...at(0, 60) }, { id: 'b', type: 'INPUT', label: 'B', ...at(0, 120) },
    { id: 'g', type: 'AND', ...at(100, 90) },
    { id: 'r', type: 'Register1', ...at(200), config: { width: 1, resetKind: 'none', hasEnable: false, clockPolarity: 'rising_edge' } },
    { id: 'q', type: 'OUTPUT', label: 'Q', ...at(300) },
  ];
  const connections = [wire('w1', 'a', 'out', 'g', 'a'), wire('w2', 'b', 'out', 'g', 'b'), wire('w3', 'g', 'out', 'r', 'D'),
    wire('w4', 'clk', 'out', 'r', 'CLK'), wire('w5', 'r', 'Q', 'q', 'in')];
  const vectors = rows.map((row, tick) => vec(tick, { clk: row.clk, a: row.a, b: row.b }, row.q === undefined ? {} : { q: row.q }));
  return projectOf('manual-clock', { nodes, connections }, [['clk', 'BTN0'], ['a', 'SW0'], ['b', 'SW1']], [['q', 'LD0']], vectors);
}

describe('authored clock rows (review P0-2: a row that raises the clock and changes the data)', () => {
  // Hand semantics of a row: its data settles first, then its clock edge captures. Three edges,
  // each in a row that also changes A and B, so the register captures that row's new A and B.
  const rows = [
    { clk: 0, a: 0, b: 0 },
    { clk: 1, a: 1, b: 1, q: 1 },
    { clk: 0, a: 1, b: 1, q: 1 },
    { clk: 1, a: 0, b: 1, q: 0 },
    { clk: 0, a: 0, b: 1, q: 0 },
    { clk: 1, a: 1, b: 1, q: 1 },
  ];

  it('captures the row\'s new data in Verify and in the shipped bench alike', async () => {
    useProjectRuntime.getState().loadFromProject(manualClockProject(rows));
    const product = runProduct();
    expect(product.run).toBeDefined();
    expect(browserFailureCount(product.run!)).toBe(0);
    expect(product.vm.status).toBe('ok');
    if (!useGhdl) return;
    const packaged = await runPackage('review-p0-2-manual-clock', product, 5);
    expect(packaged.outcome).toBe('PASS');
    expect(packaged.checks).toBe(5);
  }, 120_000);

  it('fails in both when the expectations assume the old data', async () => {
    const stale = rows.map((row, index) => (row.q === undefined || row.clk === 0 ? row : { ...row, q: index === 1 ? 0 : index === 3 ? 1 : 0 }));
    useProjectRuntime.getState().loadFromProject(manualClockProject(stale));
    const product = runProduct();
    const browserFailures = browserFailureCount(product.run!);
    expect(browserFailures).toBeGreaterThan(0);
    if (!useGhdl) return;
    const packaged = await runPackage('review-p0-2-manual-clock-stale', product, 5);
    expect(packaged.outcome).toBe('FAIL');
    expect(packaged.failures).toBe(browserFailures);
  }, 120_000);
});

/** A DLatch inside a module: its enable is a level input, never a generated clock. */
function latchModuleProject(vectors: TestVector[]) {
  const sw = (id: string, label: string): Node => ({ id, type: 'INPUT', label, ...at(0) });
  const base: Circuit = {
    nodes: [sw('d', 'D'), sw('e', 'E'), { id: 'l', type: 'DLatch', ...at(100) }, { id: 'n', type: 'NOT', ...at(160) },
      { id: 'y', type: 'OUTPUT', label: 'Y', ...at(220) }],
    connections: [wire('a1', 'd', 'out', 'l', 'D'), wire('a2', 'e', 'out', 'l', 'EN'), wire('a3', 'l', 'Q', 'n', 'in'), wire('a4', 'n', 'out', 'y', 'in')],
  };
  const cell = createModuleFromSelection(base, createEmptyProjectHierarchy(), { moduleName: 'Lat', instanceName: 'u_l', selectedNodeIds: ['l', 'n'], nowIso: NOW });
  return projectOf('latch-module', cell.circuit, [['d', 'SW0'], ['e', 'SW1']], [['y', 'LD0']], vectors, cell.hierarchy);
}

describe('latch enable (review P1-2: the export plan has the run\'s kind)', () => {
  it('drives the latch enable as the run did, never from a generated clock', async () => {
    // Transparent while E=1 (Y = not D), holding while E=0. Every check is taken after a row in
    // which the latch was transparent, so power-on state does not enter the expectations.
    const vectors = [
      vec(0, { d: 1, e: 1 }, { y: 0 }),
      vec(1, { d: 1, e: 0 }, { y: 0 }),
      vec(2, { d: 0, e: 0 }, { y: 0 }),
      vec(3, { d: 0, e: 1 }, { y: 1 }),
      vec(4, { d: 1, e: 0 }, { y: 1 }),
    ];
    useProjectRuntime.getState().loadFromProject(latchModuleProject(vectors));
    const product = runProduct();
    expect(product.run).toBeDefined();
    expect(browserFailureCount(product.run!)).toBe(0);
    const bench = artifactText(product, 'testbench.vhd');
    expect(bench, 'a generated clock process toggles the latch enable').not.toMatch(/clock_gen|CLK_HALF_PERIOD/);
    if (!useGhdl) return;
    const packaged = await runPackage('review-p1-2-latch-enable', product, 5);
    expect(packaged.outcome).toBe('PASS');
    expect(packaged.checks).toBe(5);
  }, 120_000);
});
