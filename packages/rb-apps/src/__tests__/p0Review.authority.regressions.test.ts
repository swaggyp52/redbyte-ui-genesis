// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExportSurface } from '../apps/ide/surfaces/ExportSurface';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { useProjectRuntime } from '../apps/ide/projectRuntime';
import { buildTopEntityName, normalizeTopEntityName } from '../apps/ide/topEntity';
import { materializeVectorsForClockPolicy } from '../apps/ide/verifyClockPolicy';
import { ghdlAvailable, ghdlRequired } from './helpers/ghdlHarness';
import { artifactText, at, browserFailureCount, projectOf, resetRuntime, runPackage, runProduct, wire } from './helpers/productPath';

/**
 * Regressions for the 2026-10-27 adversarial review of Verify/Export authority (P0 branch
 * a9127d88d): the export plan is the plan Verify ran, refusals are named where the run is made,
 * and nothing marked blocked leaves the workbench.
 */

const useGhdl = ghdlAvailable || ghdlRequired;
const vec = (tick: number, inputs: Record<string, number>, expected: Record<string, number>): TestVector =>
  ({ tick, inputs, expected } as TestVector);
const sw = (id: string, label: string): Node => ({ id, type: 'INPUT', label, ...at(0) });
const led = (id: string, label: string): Node => ({ id, type: 'OUTPUT', label, ...at(300) });

beforeEach(() => resetRuntime());
afterEach(cleanup);

function andProject(vectors: TestVector[]) {
  const circuit: Circuit = { nodes: [sw('a', 'SW0'), sw('b', 'SW1'), { id: 'g', type: 'AND', ...at(100) }, led('y', 'LD0')],
    connections: [wire('w1', 'a', 'out', 'g', 'a'), wire('w2', 'b', 'out', 'g', 'b'), wire('w3', 'g', 'out', 'y', 'in')] };
  return projectOf('and-gate', circuit, [['a', 'SW0'], ['b', 'SW1']], [['y', 'LD0']], vectors);
}

describe('custom vectors (review P1-3: Verify runs them, so the bench checks them)', () => {
  it('ships the scenario and the custom rows Verify ran, and the run stays current', async () => {
    useProjectRuntime.getState().loadFromProject(andProject([vec(0, { a: 0, b: 0 }, { y: 0 }), vec(1, { a: 1, b: 0 }, { y: 0 })]));
    useProjectRuntime.getState().setCustomVectors([
      { id: 'custom-1', tick: 2, inputs: { a: 0, b: 1 }, expected: { y: 0 } },
      { id: 'custom-2', tick: 3, inputs: { a: 1, b: 1 }, expected: { y: 1 } },
    ] as never);
    const product = runProduct();
    expect(product.checkCount).toBe(4);
    expect(browserFailureCount(product.run!)).toBe(0);
    expect(product.authority.runtimeEvidenceCurrent).toBe(true);
    expect(product.vm.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.note ?? '').not.toMatch(/STALE/);
    if (!useGhdl) return;
    const packaged = await runPackage('review-f1-custom-vectors', product, 4);
    expect(packaged.outcome, packaged.log).toBe('PASS');
    expect(packaged.checks).toBe(4);
  }, 120_000);
});

describe('Auto reset sequence (review P1-4: never drives an active-low reset as active-high)', () => {
  it('keeps the authored levels of an active-low reset, so the design is not held in reset', async () => {
    // A gate-built synchronous active-low reset: D = SW0 and rst_n into a Register1 on the board clock.
    const circuit: Circuit = {
      nodes: [sw('clk', 'CLK'), sw('d', 'SW0'), sw('rst_n', 'rst_n'), { id: 'g', type: 'AND', ...at(100) },
        { id: 'r', type: 'Register1', ...at(200), config: { width: 1, resetKind: 'none', hasEnable: false, clockPolarity: 'rising_edge' } }, led('q', 'LD0')],
      connections: [wire('w1', 'd', 'out', 'g', 'a'), wire('w2', 'rst_n', 'out', 'g', 'b'), wire('w3', 'g', 'out', 'r', 'D'),
        wire('w4', 'clk', 'out', 'r', 'CLK'), wire('w5', 'r', 'Q', 'q', 'in')],
    };
    // Each Auto cycle samples after its rising edge: Q = D and rst_n of that cycle.
    useProjectRuntime.getState().loadFromProject(projectOf('active-low-reset', circuit, [['clk', 'CLK100MHZ'], ['d', 'SW0'], ['rst_n', 'SW1']], [['q', 'LD0']],
      [vec(0, { d: 1, rst_n: 1 }, { q: 1 }), vec(1, { d: 0, rst_n: 1 }, { q: 0 }), vec(2, { d: 1, rst_n: 0 }, { q: 0 }), vec(3, { d: 1, rst_n: 1 }, { q: 1 })]));
    const product = runProduct();
    expect(product.run?.clockPolicy?.overrideMode).toBe('auto');
    const executed = materializeVectorsForClockPolicy({
      vectors: product.run!.executionInput?.vectors ?? [], ioRows: product.run!.executionInput?.ioRows ?? [], policy: product.run!.clockPolicy ?? null,
    });
    expect(executed.slice(0, 4).map((vector) => vector.inputs.rst_n)).toEqual([1, 1, 0, 1]);
    expect(browserFailureCount(product.run!)).toBe(0);
    if (!useGhdl) return;
    const packaged = await runPackage('review-f2-active-low-reset', product, 4);
    expect(packaged.outcome, packaged.log).toBe('PASS');
  }, 120_000);
});

describe('top entity names (review P1-2: a top must analyse)', () => {
  it('never derives or accepts a reserved word or a doubled underscore as the top', () => {
    for (const name of ['Register', 'process', 'Buffer', 'a__b', 'end_']) {
      const derived = buildTopEntityName(name);
      expect(derived, name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
      expect(['register', 'process', 'buffer'], name).not.toContain(derived);
      expect(normalizeTopEntityName(name, 'fallback_top').toLowerCase(), name).not.toMatch(/^(register|process|buffer)$|__|_$/);
    }
    expect(useProjectRuntime.getState().setActiveTop('register').ok).toBe(false);
    expect(useProjectRuntime.getState().setActiveTop('a__b').ok).toBe(false);
    expect(useProjectRuntime.getState().setActiveTop('counter_top').ok).toBe(true);
  });

  it('exports a project named "Register" with a top GHDL analyses', async () => {
    const project = andProject([0, 1, 2, 3].map((n) => vec(n, { a: n & 1, b: n >> 1 }, { y: (n & 1) & (n >> 1) })));
    useProjectRuntime.getState().loadFromProject({ ...project, name: 'Register', hdl: undefined, fpga: { board: 'basys3', part: 'xc7a35tcpg236-1' } } as never);
    const product = runProduct();
    expect(product.vm.topAuthority.designTop.toLowerCase()).not.toBe('register');
    if (!useGhdl) return;
    const packaged = await runPackage('review-f4-register-name', product, 4);
    expect(packaged.outcome, packaged.log).toBe('PASS');
  }, 120_000);
});

describe('parts the simulator does not define (review P2: refused by name at Verify)', () => {
  for (const type of ['mux4', 'Mux4', 'MUX8', 'Decoder2to4']) {
    it(`refuses a ${type} by name before a Run is recorded`, () => {
      const circuit: Circuit = { nodes: [sw('a', 'SW0'), { id: 'm', type, ...at(100) }, led('y', 'LD0')],
        connections: [wire('w1', 'a', 'out', 'm', 'in'), wire('w2', 'm', 'out', 'y', 'in')] };
      useProjectRuntime.getState().loadFromProject(projectOf(`unknown-${type}`, circuit, [['a', 'SW0']], [['y', 'LD0']], [vec(0, { a: 1 }, { y: 1 })]));
      const product = runProduct();
      expect(product.run, 'no recording of a part nothing simulates').toBeUndefined();
      expect(product.refusal ?? '').toContain(type);
      expect(product.vm.errors.map((error) => error.code)).toContain('RBEX4100');
      expect(artifactText(product, 'top.vhd')).not.toMatch(/<=\s*'[01]'\s*;\s*$/m);
    });
  }
});

describe('blocked files (review P2: nothing marked blocked leaves the workbench)', () => {
  it('shows a blocked file but offers no per-file download or copy of it', () => {
    // LD1 is mapped and undriven: the package and its top.vhd are blocked (RBEX4103).
    const circuit: Circuit = { nodes: [sw('a', 'SW0'), { id: 'n', type: 'NOT', ...at(100) }, led('y', 'LD0'), led('z', 'LD1')],
      connections: [wire('w1', 'a', 'out', 'n', 'in'), wire('w2', 'n', 'out', 'y', 'in')] };
    const project = projectOf('blocked-file', circuit, [['a', 'SW0']], [['y', 'LD0'], ['z', 'LD1']], [vec(0, { a: 0 }, { y: 1 })]);
    const view = render(React.createElement(ExportSurface, { project, determinismHash: 'blocked-file' }));
    fireEvent.click(view.getByTestId('ide-export-file-top-vhd'));
    expect(view.getByTestId('ide-export-preview-path').textContent).toBe('top.vhd');
    expect((view.getByTestId('ide-export-download-current-file') as HTMLButtonElement).disabled).toBe(true);
    expect((view.getByTestId('ide-export-copy-current-file') as HTMLButtonElement).disabled).toBe(true);
  });
});
