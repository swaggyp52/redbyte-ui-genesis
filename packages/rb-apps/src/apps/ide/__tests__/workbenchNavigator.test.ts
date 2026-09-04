import { describe, expect, it } from 'vitest';
import { buildNavigatorIndex, searchNavigator, type NavigatorIndexInput } from '../workbenchNavigator';
import type { EngineeringRelationshipIndex, EngineeringSignalRelation } from '../engineeringRelationships';

function relation(overrides: Partial<EngineeringSignalRelation>): EngineeringSignalRelation {
  return {
    fieldId: 'sum_2',
    label: 'SUM[2]',
    direction: 'out',
    required: true,
    bus: { name: 'SUM', bit: 2 },
    nodeId: 'out-sum2',
    port: 'in',
    moduleId: 'top',
    driver: { nodeId: 'u_fa2', portName: 'SUM', nodeLabel: 'u_fa2', nodeType: 'MODULE', moduleId: 'FullAdderCell', path: 'u_fa2/SUM' },
    loads: [],
    scenarios: [{ scenarioId: 'default', scenarioName: 'Default', document: 'cases', checkTicks: [1, 2, 3], vectorCount: 16 }],
    run: null,
    board: {
      pin: 'U19',
      resource: { id: 'LD2', alias: 'LD2', label: 'LED LD2', packagePin: 'U19' } as never,
      ioStandard: 'LVCMOS33',
      artifactPort: 'SUM_2',
      xdcLines: ['set_property PACKAGE_PIN U19 [get_ports {SUM[2]}]', 'set_property IOSTANDARD LVCMOS33 [get_ports {SUM[2]}]'],
      constraintSetId: 'cs1',
      constraintLines: [27, 28],
    },
    artifacts: ['top.vhd', 'top.xdc'],
    ambiguity: [],
    ...overrides,
  };
}

function index(signals: EngineeringSignalRelation[]): EngineeringRelationshipIndex {
  return {
    signals,
    ambiguities: [],
    resolveField: (fieldId) => signals.find((entry) => entry.fieldId === fieldId) ?? null,
    resolveNode: (nodeId) => signals.find((entry) => entry.nodeId === nodeId) ?? null,
    resolveRunSignal: (signal) => signals.find((entry) => entry.label === signal) ?? null,
    resolvePin: () => [],
  };
}

function input(overrides: Partial<NavigatorIndexInput> = {}): NavigatorIndexInput {
  return {
    relationships: index([relation({}), relation({ fieldId: 'sum_3', label: 'SUM[3]', bus: { name: 'SUM', bit: 3 }, nodeId: 'out-sum3', board: null })]),
    hierarchy: {
      schemaVersion: 'rb.hierarchy.v1' as never,
      topModuleId: 'top' as never,
      activeModuleId: 'top',
      modules: [{ id: 'FullAdderCell', name: 'FullAdderCell', displayName: 'FullAdderCell', kind: 'native-visual', ports: [], circuit: { nodes: [], connections: [] } as never, createdAt: '', updatedAt: '' }],
    },
    topNodes: [
      { id: 'u_fa2', label: 'u_fa2', type: 'MODULE', config: { moduleDefinitionId: 'FullAdderCell', instanceName: 'u_fa2' } },
      { id: 'out-sum2', label: 'SUM[2]', type: 'OUTPUT' },
    ],
    topModuleName: 'rb_4_bit_adder',
    scenarios: [{ id: 'default', name: 'Default', checkCount: 80, sequential: false }],
    lastRun: null,
    runIsStale: false,
    runHistory: [],
    constraintSets: { schemaVersion: 'rb.constraint-sets.v1' as never, sets: [{ id: 'cs1', name: 'top', xdcText: '' }], activeId: 'cs1' },
    sourceModel: null,
    artifacts: [{ path: 'top.xdc', bytes: 900 }],
    problems: [],
    openDocuments: [{ kind: 'project-overview' }],
    documentLabels: { 'project-overview': 'Overview' },
    ...overrides,
  };
}

describe('workbench navigator', () => {
  it('indexes one entry per canonical object with exact documents and selections', () => {
    const entries = buildNavigatorIndex(input());
    const sum2 = entries.find((entry) => entry.id === 'signal:sum_2');
    expect(sum2?.facts).toEqual(['Driver u_fa2/SUM', 'Board LED LD2 · U19', '3 checks']);
    expect(sum2?.document).toEqual({ kind: 'schematic', moduleId: 'top' });
    expect(sum2?.selection).toEqual({ kind: 'signal', fieldId: 'sum_2', runSignal: null, nodeId: 'out-sum2' });
    expect(entries.find((entry) => entry.id === 'bus:SUM')?.title).toBe('SUM[3:2]');
    expect(entries.find((entry) => entry.id === 'instance:u_fa2')?.selection).toEqual({ kind: 'node', moduleId: 'top', nodeId: 'u_fa2' });
    const constraint = entries.find((entry) => entry.id === 'constraint:sum_2:0');
    expect(constraint?.title).toBe('top.xdc:27');
    expect(constraint?.subtitle).toBe('Constraint · SUM[2] → U19');
    expect(constraint?.document).toEqual({ kind: 'board-io', constraintSetId: 'cs1' });
    expect(entries.find((entry) => entry.id === 'board:sum_2')?.title).toBe('LED LD2 · U19');
  });

  it('groups search results by kind, requires every token, and ranks exact titles first', () => {
    const entries = buildNavigatorIndex(input());
    const groups = searchNavigator(entries, 'sum[2]');
    expect(groups.map((group) => group.kind)).toEqual(['signal', 'board', 'constraint']);
    expect(groups[0].matches[0].entry.title).toBe('SUM[2]');
    expect(searchNavigator(entries, 'u19 sum').map((group) => group.kind)).toEqual(['signal', 'board', 'constraint']);
    expect(searchNavigator(entries, 'nothing-here')).toEqual([]);
    expect(searchNavigator(entries, '')).toEqual([]);
  });

  it('exposes failures from the last run as first-class entries that land on the failing tick', () => {
    const entries = buildNavigatorIndex(
      input({
        lastRun: {
          scenarioId: 'default',
          scenarioName: 'Default',
          status: 'fail',
          schedule: 'combinational',
          firstFailingTick: 11,
          report: { rows: [{ tick: 11, signal: 'SUM[2]', expected: '1', actual: '0', status: 'fail', caseIndex: 11 }] },
        } as never,
      })
    );
    const failure = entries.find((entry) => entry.kind === 'failure');
    expect(failure?.title).toBe('Case 11 · SUM[2]');
    expect(failure?.subtitle).toBe('Default · expected 1 · observed 0');
    expect(failure?.selection).toEqual({ kind: 'case-tick', scenarioId: 'default', tick: 11 });
    expect(searchNavigator(entries, 'case 11')[0].kind).toBe('failure');
  });

  it('carries ambiguity instead of guessing a lane', () => {
    const entries = buildNavigatorIndex(input({ relationships: index([relation({ ambiguity: ['Two boundary fields normalize to sum_2'] })]) }));
    const sum2 = entries.find((entry) => entry.id === 'signal:sum_2');
    expect(sum2?.ambiguity).toBe('Two boundary fields normalize to sum_2');
    expect(sum2?.selection).toMatchObject({ runSignal: null });
  });
});
