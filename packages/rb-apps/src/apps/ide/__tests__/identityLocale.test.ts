// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { elaborateCircuit } from '@redbyte/rb-logic-core';
import { canonicalizeSemanticCircuit } from '../../../circuit/semanticCircuit';
import type { RBProject } from '../../../export/projectFormat';
import { IDE_EXAMPLES } from '../examplesCatalog';
import { elaborateProjectHierarchy } from '../projectHierarchy';
import { useProjectRuntime, type RuntimeVerifyRun } from '../projectRuntime';

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

interface Identity { irHash: string; design: string; run: RuntimeVerifyRun['identity'] }

function identityOf(load: () => void): Identity {
  localStorage.clear();
  load();
  const state = useProjectRuntime.getState();
  const circuit = canonicalizeSemanticCircuit(elaborateProjectHierarchy(state.circuit, state.hierarchy));
  const run = state.runVerification({ scenarioId: state.activeScenarioId, scenarioName: 'Collation',
    deterministicHash: 'collation', rows: [], ranAtIso: '2026-10-26T00:00:00.000Z' });
  return { irHash: elaborateCircuit(circuit).ir.irHash, design: run.identity!.design, run: run.identity };
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
