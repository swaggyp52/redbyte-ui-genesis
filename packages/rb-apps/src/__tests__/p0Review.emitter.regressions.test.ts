// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { useProjectRuntime } from '../apps/ide/projectRuntime';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { ghdlAvailable, ghdlRequired } from './helpers/ghdlHarness';
import { artifactText, at, browserFailureCount, projectOf, resetRuntime, runPackage, runProduct, wire } from './helpers/productPath';

/**
 * Regressions for the 2026-10-27 adversarial review of the flat VHDL emitter (P0 branch
 * a9127d88d). The browser and the shipped HDL must agree, or Export must refuse by name; it
 * never drives a board pin from a port the simulator does not read or publish.
 */

const useGhdl = ghdlAvailable || ghdlRequired;
const vec = (tick: number, inputs: Record<string, number>, expected: Record<string, number>): TestVector =>
  ({ tick, inputs, expected } as TestVector);
const sw = (id: string, label: string): Node => ({ id, type: 'INPUT', label, ...at(0) });
const led = (id: string, label: string): Node => ({ id, type: 'OUTPUT', label, ...at(300) });

beforeEach(() => resetRuntime());

describe('power-on state of stateful parts (review P1-1)', () => {
  // The documented power-on contract: a DLatch (cross-coupled NANDs, enable low) settles to
  // Q=1; edge-triggered parts start at Q=0. Inputs are held low, so tick 0 shows power-on.
  const parts: Array<{ type: string; pins: string[]; config?: Record<string, unknown>; q: number }> = [
    { type: 'DLatch', pins: ['D', 'EN'], q: 1 },
    { type: 'DFlipFlop', pins: ['D', 'CLK'], q: 0 },
    { type: 'Register1', pins: ['D', 'CLK'], config: { width: 1, resetKind: 'none', hasEnable: false, clockPolarity: 'rising_edge' }, q: 0 },
    { type: 'TFlipFlop', pins: ['T', 'CLK'], q: 0 },
    { type: 'JKFlipFlop', pins: ['J', 'K', 'CLK'], q: 0 },
  ];
  for (const part of parts) {
    it(`${part.type} starts at Q=${part.q} in Verify and in the shipped HDL`, async () => {
      const inputs = part.pins.map((pin, index) => sw(`i_${pin}`, `SW${index}`));
      const circuit: Circuit = {
        nodes: [...inputs, { id: 'p', type: part.type, ...at(150), config: part.config ?? {} }, led('q', 'LD0'), led('qn', 'LD1')],
        connections: [
          ...part.pins.map((pin) => wire(`w_${pin}`, `i_${pin}`, 'out', 'p', pin)),
          wire('wq', 'p', 'Q', 'q', 'in'), wire('wqn', 'p', 'Q_inv', 'qn', 'in'),
        ],
      };
      const zeros = Object.fromEntries(part.pins.map((pin) => [`i_${pin}`, 0]));
      useProjectRuntime.getState().loadFromProject(projectOf(`power-on-${part.type}`, circuit,
        part.pins.map((pin, index) => [`i_${pin}`, `SW${index}`] as [string, string]), [['q', 'LD0'], ['qn', 'LD1']],
        [vec(0, zeros, { q: part.q, qn: 1 - part.q })]));
      const product = runProduct();
      expect(product.run, product.refusal).toBeDefined();
      expect(browserFailureCount(product.run!), 'Verify power-on').toBe(0);
      expect(product.vm.status).toBe('ok');
      if (!useGhdl) return;
      const packaged = await runPackage(`review-p1-1-power-on-${part.type}`, product, 2);
      expect(packaged.outcome, packaged.log).toBe('PASS');
    }, 120_000);
  }
});

describe('board outputs bind only the port the simulator reads (review P1-3, P1-4, P1-5)', () => {
  it('refuses an OUTPUT wired on a port it does not read, which Verify shows as X', () => {
    const circuit: Circuit = { nodes: [sw('a', 'SW0'), { id: 'n', type: 'NOT', ...at(100) }, led('y', 'LD0')],
      connections: [wire('w1', 'a', 'out', 'n', 'in'), wire('w2', 'n', 'out', 'y', 'a')] };
    useProjectRuntime.getState().loadFromProject(projectOf('output-port-a', circuit, [['a', 'SW0']], [['y', 'LD0']],
      [vec(0, { a: 0 }, { y: 1 }), vec(1, { a: 1 }, { y: 0 })]));
    const product = runProduct();
    expect(product.run!.report.rows.every((row) => row.actual === 'X')).toBe(true);
    expect(product.vm.status).toBe('blocked');
    const codes = product.vm.errors.map((error) => error.code);
    expect(codes).toContain('RBEX4103');
    expect(artifactText(product, 'top.vhd')).not.toMatch(/LED\s*<=\s*not_0/);
  });

  it('never drives a LED from a gate input when an output row names the gate\'s "in"', () => {
    const circuit: Circuit = { nodes: [sw('a', 'SW0'), sw('b', 'SW1'), { id: 'g', type: 'AND', ...at(100) }],
      connections: [wire('w1', 'a', 'out', 'g', 'in1'), wire('w2', 'b', 'out', 'g', 'in2')] };
    const vm = buildExportViewModel(projectOf('row-on-gate-in', circuit, [['a', 'SW0'], ['b', 'SW1']], [['g', 'LD0']]));
    const top = vm.artifacts.find((artifact) => artifact.path === 'top.vhd')?.content ?? '';
    expect(top).not.toMatch(/<=\s*SW\(0\)\s*;/);
    expect(vm.status).toBe('blocked');
  });

  it('refuses a gate that reads a board OUTPUT, which publishes nothing in the simulator', () => {
    const circuit: Circuit = { nodes: [sw('a', 'SW0'), led('l0', 'LD0'), { id: 'n', type: 'NOT', ...at(150) }, led('y', 'LD1')],
      connections: [wire('w1', 'a', 'out', 'l0', 'in'), wire('w2', 'l0', 'out', 'n', 'in'), wire('w3', 'n', 'out', 'y', 'in')] };
    useProjectRuntime.getState().loadFromProject(projectOf('read-output-out', circuit, [['a', 'SW0']], [['l0', 'LD0'], ['y', 'LD1']],
      [vec(0, { a: 0 }, { l0: 0, y: 1 }), vec(1, { a: 1 }, { l0: 1, y: 1 })]));
    const product = runProduct();
    expect(product.vm.status).toBe('blocked');
    expect(artifactText(product, 'top.vhd')).not.toMatch(/not\s+LED/);
  });
});

describe('shipped text (review P2)', () => {
  it('keeps a project name with a line break inside its comment header, so the package analyses', async () => {
    const circuit: Circuit = { nodes: [sw('a', 'SW0'), sw('b', 'SW1'), { id: 'g', type: 'AND', ...at(100) }, led('y', 'LD0')],
      connections: [wire('w1', 'a', 'out', 'g', 'a'), wire('w2', 'b', 'out', 'g', 'b'), wire('w3', 'g', 'out', 'y', 'in')] };
    const project = projectOf('header', circuit, [['a', 'SW0'], ['b', 'SW1']], [['y', 'LD0']],
      [0, 1, 2, 3].map((n) => vec(n, { a: n & 1, b: n >> 1 }, { y: (n & 1) & (n >> 1) })));
    useProjectRuntime.getState().loadFromProject({ ...project, name: 'Lab 2\nwait' });
    const product = runProduct();
    for (const artifact of product.vm.artifacts.filter((entry) => entry.path.endsWith('.vhd'))) {
      for (const line of artifact.content.split('\n').slice(0, 8)) {
        if (/wait/.test(line)) expect(line.trimStart().startsWith('--'), `${artifact.path}: ${line}`).toBe(true);
      }
    }
    if (!useGhdl) return;
    const packaged = await runPackage('review-p2-header-newline', product, 4);
    expect(packaged.outcome, packaged.log).toBe('PASS');
  }, 120_000);

  it('ships no mis-decoded characters in any artifact or note', () => {
    const circuit: Circuit = { nodes: [sw('a', 'SW0'), led('y', 'LD0')], connections: [wire('w1', 'a', 'out', 'y', 'in')] };
    useProjectRuntime.getState().loadFromProject(projectOf('mojibake', circuit, [['a', 'SW0']], [['y', 'LD0']], [vec(0, { a: 1 }, {})]));
    const product = runProduct();
    for (const artifact of product.vm.artifacts) {
      expect(`${artifact.content}\n${artifact.note ?? ''}`, artifact.path).not.toMatch(/â€/);
    }
    // The trace-only notes are built from literals in the view model: none may be mis-decoded.
    const source = readFileSync(join(__dirname, '..', 'apps', 'ide', 'viewmodels', 'buildExportViewModel.ts'), 'utf8');
    expect(source).not.toMatch(/â€/);
  });
});
