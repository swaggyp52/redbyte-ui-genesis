// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit, Node } from '@redbyte/rb-logic-core';
import type { TestVector } from '@redbyte/rb-utils';
import { buildIdeExportProject } from '../apps/ide/ideExportProject';
import { useProjectRuntime } from '../apps/ide/projectRuntime';
import { buildExportViewModel } from '../apps/ide/viewmodels/buildExportViewModel';
import { computeScenarioContentHash, getActiveScenario } from '../apps/ide/verifyScenario';
import { at, projectOf, resetRuntime, runProduct, wire } from './helpers/productPath';

/**
 * Export scenario provenance from a real Run (scenario-stale-ui-gate contracts 4-6).
 *
 * Those contracts were once proven with a hand-built "passing run" over an imported VHDL
 * counter. Since the P0 importer fix, a design it cannot rebuild opens as ports only with a named
 * refusal, and the export currency checks (stimulus, mapping and circuit evidence hashes) refuse a
 * run that was never executed; such a fixture can no longer be current, nor should it be. Here
 * the student's own path produces the run: a native AND gate, Run, then Export from that state.
 */

const vec = (tick: number, inputs: Record<string, number>, expected: Record<string, number>): TestVector =>
  ({ tick, inputs, expected } as TestVector);
const sw = (id: string, label: string): Node => ({ id, type: 'INPUT', label, ...at(0) });
const led = (id: string, label: string): Node => ({ id, type: 'OUTPUT', label, ...at(300) });

function loadAndGate(): void {
  const circuit: Circuit = { nodes: [sw('a', 'SW0'), sw('b', 'SW1'), { id: 'g', type: 'AND', ...at(100) }, led('y', 'LD0')],
    connections: [wire('w1', 'a', 'out', 'g', 'a'), wire('w2', 'b', 'out', 'g', 'b'), wire('w3', 'g', 'out', 'y', 'in')] };
  useProjectRuntime.getState().loadFromProject(projectOf('provenance-and', circuit, [['a', 'SW0'], ['b', 'SW1']], [['y', 'LD0']],
    [vec(0, { a: 0, b: 0 }, { y: 0 }), vec(1, { a: 1, b: 1 }, { y: 1 })]));
  useProjectRuntime.getState().renameScenario('My Lab');
}

function activeScenario() {
  const state = useProjectRuntime.getState();
  return getActiveScenario(state.scenarios, state.activeScenarioId)!;
}

/** Package as the student opens it now, with no new Run: the same derivation runProduct uses. */
function exportNow() {
  const state = useProjectRuntime.getState();
  return buildExportViewModel(buildIdeExportProject(state), state.verifyLastRun ?? undefined, activeScenario(), state.customVectors ?? []);
}

const testbenchNote = (vm: ReturnType<typeof buildExportViewModel>) =>
  vm.artifacts.find((artifact) => artifact.path === 'testbench.vhd')?.note ?? '';

describe('Export scenario provenance from a real Run', () => {
  beforeEach(() => resetRuntime());

  it('exportedScenario is present and current when the scenario is the one that ran', () => {
    loadAndGate();
    const product = runProduct();
    expect(product.refusal).toBeUndefined();
    expect(product.run?.status).toBe('pass');
    const scenario = activeScenario();
    expect(product.vm.exportedScenario).toBeDefined();
    expect(product.vm.exportedScenario!.isStaleComparedToLastPass).toBe(false);
    expect(product.vm.exportedScenario!.name).toBe('My Lab');
    expect(product.vm.exportedScenario!.version).toBe(scenario.version);
    expect(product.vm.exportedScenario!.contentHash).toBe(computeScenarioContentHash(scenario));
  });

  it('the testbench note names the scenario and version when fresh, and says STALE once the vectors change', () => {
    loadAndGate();
    const fresh = runProduct();
    expect(testbenchNote(fresh.vm)).toContain('My Lab');
    expect(testbenchNote(fresh.vm)).toContain(`v${activeScenario().version}`);
    expect(testbenchNote(fresh.vm)).not.toMatch(/STALE/i);

    // The same recording, after the student edits the scenario: it no longer covers what ships.
    useProjectRuntime.getState().setVectors([vec(0, { a: 0, b: 0 }, { y: 0 }), vec(1, { a: 1, b: 1 }, { y: 1 }), vec(2, { a: 1, b: 0 }, { y: 0 })]);
    expect(useProjectRuntime.getState().verifyLastRun?.runId).toBe(fresh.run?.runId);
    const stale = exportNow();
    expect(stale.exportedScenario!.isStaleComparedToLastPass).toBe(true);
    expect(testbenchNote(stale)).toMatch(/STALE/i);
  });
});
