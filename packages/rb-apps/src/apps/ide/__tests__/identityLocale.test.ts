// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { elaborateCircuit } from '@redbyte/rb-logic-core';
import { canonicalizeSemanticCircuit } from '../../../circuit/semanticCircuit';
import type { RBProject } from '../../../export/projectFormat';
import { IDE_EXAMPLES } from '../examplesCatalog';
import { createEmptyProjectHierarchy, createModuleFromSelection, elaborateProjectHierarchy } from '../projectHierarchy';
import { generateHierarchicalVhdlProject } from '../hierarchicalVhdl';
import { useProjectRuntime, type RuntimeVerifyRun } from '../projectRuntime';
import { planStudioRun } from '../studioRunInput';
import { deriveIdeBlockingDesignIssue } from '../ideDesignBlocking';

/**
 * RB-DEBT-016: irHash and RunIdentity must not depend on the browser's collation.
 * String.prototype.localeCompare is rebound to a fixed locale as a test double, so
 * every identity is computed once per collation. Lithuanian sorts y beside i, Danish
 * sorts aa as å after z, Estonian sorts z beside s and Turkish separates dotless I.
 */
const nativeLocaleCompare = String.prototype.localeCompare;
const LOCALES = ['lt-LT', 'da-DK', 'et-EE', 'tr-TR'] as const;

function withCollation<T>(locale: string, body: () => T): T {
  const collators = new Map<string, Intl.Collator>();
  String.prototype.localeCompare = function localeCompareDouble(
    this: string, that: string, _locales?: string | string[], options?: Intl.CollatorOptions,
  ): number {
    const key = JSON.stringify(options ?? {});
    let collator = collators.get(key);
    if (!collator) { collator = new Intl.Collator(locale, options); collators.set(key, collator); }
    return collator.compare(String(this), String(that));
  } as typeof nativeLocaleCompare;
  try { return body(); } finally { String.prototype.localeCompare = nativeLocaleCompare; }
}

interface Identity { irHash: string; design: string; replay: string; run: RuntimeVerifyRun['identity'] }

function identityOf(load: () => void): Identity {
  localStorage.clear();
  load();
  const state = useProjectRuntime.getState();
  const circuit = canonicalizeSemanticCircuit(elaborateProjectHierarchy(state.circuit, state.hierarchy));
  // The replay fingerprint Simulate stamps on a Run request, computed as the Run owner does.
  const replay = planStudioRun(state, { captureEvaluations: false, resolveBlockingIssue: deriveIdeBlockingDesignIssue }).input.deterministicHash;
  const run = state.runVerification({ scenarioId: state.activeScenarioId, scenarioName: 'Collation',
    deterministicHash: 'collation', rows: [], ranAtIso: '2026-10-26T00:00:00.000Z' });
  return { irHash: elaborateCircuit(circuit).ir.irHash, design: run.identity!.design, replay, run: run.identity };
}

/** Node and IO ids that each tailored collation orders differently from en-US. */
function collationProject(): RBProject {
  const gate = (id: string, x: number) => ({ id, type: 'AND', x, y: 0, config: {}, state: {} });
  const input = (id: string) => ({ id, type: 'INPUT', label: id, x: 0, y: 0, config: {}, state: {} });
  const output = (id: string) => ({ id, type: 'OUTPUT', label: id, x: 400, y: 0, config: {}, state: {} });
  const pairs = [['y1', 'j1'], ['aa1', 'b1'], ['z1', 't1'], ['I2', 'i1']] as const;
  const nodes: RBProject['circuit']['nodes'] = [input('a_in'), input('y_in'), input('j_in')];
  const connections: RBProject['circuit']['connections'] = [];
  const outputs: Array<{ id: string; nodeId: string; port: string; label: string; pin: string }> = [];
  pairs.flat().forEach((id, index) => {
    nodes.push(gate(id, 100 + index * 10), output(`${id}_out`));
    connections.push(
      { from: { nodeId: index % 2 === 0 ? 'y_in' : 'j_in', portName: 'out' }, to: { nodeId: id, portName: 'a' } },
      { from: { nodeId: 'a_in', portName: 'out' }, to: { nodeId: id, portName: 'b' } },
      { from: { nodeId: id, portName: 'out' }, to: { nodeId: `${id}_out`, portName: 'in' } },
    );
    outputs.push({ id: `${id}_led`, nodeId: `${id}_out`, port: 'in', label: `${id}_out`, pin: `LD${index}` });
  });
  return {
    kind: 'rb-project', version: 1, createdAt: '2026-10-26T00:00:00.000Z', updatedAt: '2026-10-26T00:00:00.000Z',
    name: 'Collation', circuit: { nodes, connections },
    ioMapping: {
      inputs: [
        { id: 'a_led', nodeId: 'a_in', port: 'out', label: 'a_in', pin: 'SW0' },
        { id: 'y_led', nodeId: 'y_in', port: 'out', label: 'y_in', pin: 'SW1' },
        { id: 'j_led', nodeId: 'j_in', port: 'out', label: 'j_in', pin: 'SW2' },
      ],
      outputs,
    },
    vectors: [{ tick: 0, inputs: { a_in: 1, y_in: 1, j_in: 0 }, expected: {} }],
    meta: { projectId: 'rb-collation' },
  };
}

describe('identity is independent of the runtime collation (RB-DEBT-016)', () => {
  afterEach(() => { String.prototype.localeCompare = nativeLocaleCompare; });

  it.each(IDE_EXAMPLES.map(example => [example.id] as const))('%s: irHash and RunIdentity equal the en-US values', exampleId => {
    const load = () => useProjectRuntime.getState().loadExample(exampleId);
    const english = withCollation('en-US', () => identityOf(load));
    for (const locale of LOCALES) {
      const other = withCollation(locale, () => identityOf(load));
      expect(other.irHash, `${locale} irHash`).toBe(english.irHash);
      expect(other.design, `${locale} RunIdentity.design`).toBe(english.design);
      expect(other.replay, `${locale} replay fingerprint`).toBe(english.replay);
      expect(other.run, `${locale} RunIdentity`).toEqual(english.run);
    }
  });

  it('keeps irHash and RunIdentity for ids each tailored collation reorders', () => {
    const load = () => useProjectRuntime.getState().loadFromProject(collationProject());
    const english = withCollation('en-US', () => identityOf(load));
    for (const locale of LOCALES) {
      const other = withCollation(locale, () => identityOf(load));
      expect(other.irHash, `${locale} irHash`).toBe(english.irHash);
      expect(other.design, `${locale} RunIdentity.design`).toBe(english.design);
      expect(other.replay, `${locale} replay fingerprint`).toBe(english.replay);
    }
  });

  it('keeps the same canonical row for a boundary mapped twice, under every collation', () => {
    // Two equally complete rows on one LED: the survivor is persisted, so it cannot be chosen by
    // collation (Lithuanian sorts y before j; codepoint and en-US sort j first).
    const project = collationProject();
    project.ioMapping!.outputs.push({ id: 'y_led', nodeId: 'y1_out', port: 'in', label: 'y1_out', pin: 'LD9' });
    project.ioMapping!.outputs = project.ioMapping!.outputs.map(row => row.nodeId === 'y1_out' && row.id === 'y1_led' ? { ...row, id: 'j_led' } : row);
    const survivor = (locale: string) => withCollation(locale, () => {
      localStorage.clear();
      useProjectRuntime.getState().loadFromProject(structuredClone(project));
      const rows = useProjectRuntime.getState().projectIoRows.filter(row => row.nodeId === 'y1_out');
      return rows.map(row => `${row.id}:${row.pin}`);
    });
    const english = survivor('en-US');
    expect(english).toEqual(['j_led:LD0']);
    for (const locale of LOCALES) expect(survivor(locale), locale).toEqual(english);
  });

  it('orders mixed-case modules by codepoint and exports them identically, whatever the collation or creation order', () => {
    // en-US collation sorts Adder < ALU < Bcd; codepoint sorts ALU < Adder < Bcd.
    const names = ['Adder', 'Bcd', 'ALU'];
    const build = (order: readonly string[]) => {
      const nodes: RBProject['circuit']['nodes'] = [{ id: 'a', type: 'INPUT', label: 'A', x: 0, y: 0, config: {}, state: {} }];
      const connections: RBProject['circuit']['connections'] = [];
      const outputs: Array<{ id: string; nodeId: string; port: string; label: string; pin: string }> = [];
      names.forEach((name, index) => {
        nodes.push({ id: `g_${name}`, type: 'NOT', x: 200, y: index * 100, config: {}, state: {} },
          { id: `h_${name}`, type: 'NOT', x: 300, y: index * 100, config: {}, state: {} },
          { id: `y_${name}`, type: 'OUTPUT', label: `Y_${name}`, x: 400, y: index * 100, config: {}, state: {} });
        connections.push({ from: { nodeId: 'a', portName: 'out' }, to: { nodeId: `g_${name}`, portName: 'in' } },
          { from: { nodeId: `g_${name}`, portName: 'out' }, to: { nodeId: `h_${name}`, portName: 'in' } },
          { from: { nodeId: `h_${name}`, portName: 'out' }, to: { nodeId: `y_${name}`, portName: 'in' } });
        outputs.push({ id: `y_${name}`, nodeId: `y_${name}`, port: 'in', label: `Y_${name}`, pin: `LD${index}` });
      });
      let circuit = { nodes, connections } as unknown as Parameters<typeof createModuleFromSelection>[0];
      let hierarchy = createEmptyProjectHierarchy();
      for (const name of order) {
        const created = createModuleFromSelection(circuit, hierarchy, { moduleName: name, instanceName: `u_${name}`,
          selectedNodeIds: [`g_${name}`, `h_${name}`], nowIso: '2026-10-28T00:00:00.000Z' });
        circuit = created.circuit; hierarchy = created.hierarchy;
      }
      const project = { kind: 'rb-project', version: 1, createdAt: '2026-10-28T00:00:00.000Z', updatedAt: '2026-10-28T00:00:00.000Z',
        name: 'Mixed case', circuit, hierarchy, hdl: { top: 'mixed_top', sources: [] },
        ioMapping: { inputs: [{ id: 'a', nodeId: 'a', port: 'out', label: 'A', pin: 'V17' }], outputs } } as unknown as RBProject;
      const vhdl = generateHierarchicalVhdlProject(project);
      return { modules: hierarchy.modules.map((module) => module.name), sources: vhdl?.moduleSources.map((source) => source.path),
        text: [vhdl?.topVhd, ...(vhdl?.moduleSources.map((source) => source.text) ?? [])].join('\n---\n') };
    };
    const english = withCollation('en-US', () => build(names));
    expect(english.modules).toEqual(['ALU', 'Adder', 'Bcd']);
    expect(english.sources).toHaveLength(3);
    for (const locale of LOCALES) expect(withCollation(locale, () => build(names)), locale).toEqual(english);
    for (const order of [['ALU', 'Bcd', 'Adder'], ['Bcd', 'ALU', 'Adder']]) {
      // Instance ids follow creation order, so only the module order and module sources must agree.
      const permuted = withCollation('en-US', () => build(order));
      expect(permuted.modules, order.join(',')).toEqual(english.modules);
      expect(permuted.sources, order.join(',')).toEqual(english.sources);
    }
  });

  it('the test double really changes collation, so the comparisons above have teeth', () => {
    const order = (locale: string, values: string[]) => withCollation(locale, () => [...values].sort((a, b) => a.localeCompare(b)));
    expect(order('en-US', ['y1', 'j1'])).toEqual(['j1', 'y1']);
    expect(order('lt-LT', ['y1', 'j1'])).toEqual(['y1', 'j1']);
    expect(order('da-DK', ['aa1', 'b1'])).toEqual(['b1', 'aa1']);
    expect(order('et-EE', ['z1', 't1'])).toEqual(['z1', 't1']);
    expect(order('tr-TR', ['I2', 'i1'])).toEqual(['I2', 'i1']);
    expect(order('en-US', ['I2', 'i1'])).toEqual(['i1', 'I2']);
  });
});
