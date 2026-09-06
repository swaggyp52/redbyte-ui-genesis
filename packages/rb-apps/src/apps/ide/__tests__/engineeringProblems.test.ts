import { describe, expect, it } from 'vitest';
import { buildEngineeringProblems, countProblems, type EngineeringProblemsInput } from '../engineeringProblems';
import type { EngineeringRelationshipIndex, EngineeringSignalRelation } from '../engineeringRelationships';
import type { RuntimeVerifyRun } from '../projectRuntime';

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
    scenarios: [],
    run: null,
    board: null,
    artifacts: [],
    ambiguity: [],
    ...overrides,
  };
}

function index(signals: EngineeringSignalRelation[], ambiguities: { fieldId: string; reason: string }[] = []): EngineeringRelationshipIndex {
  return {
    signals,
    ambiguities,
    resolveField: (fieldId) => signals.find((entry) => entry.fieldId === fieldId) ?? null,
    resolveNode: (nodeId) => signals.find((entry) => entry.nodeId === nodeId) ?? null,
    resolveRunSignal: (signal) => signals.find((entry) => entry.label.toLowerCase() === signal.toLowerCase()) ?? null,
    resolvePin: () => [],
  };
}

function baseInput(overrides: Partial<EngineeringProblemsInput> = {}): EngineeringProblemsInput {
  return {
    blockingIssues: [],
    designDiagnostics: [],
    designIssues: [],
    relationships: index([relation({})]),
    exportErrors: [],
    exportWarnings: [],
    mappingProjection: [],
    lastRun: null,
    runIsStale: false,
    activeConstraintSetId: null,
    importFidelity: null,
    isSequential: false,
    hasCircuit: true,
    ...overrides,
  };
}

const failingRun = {
  scenarioId: 'default',
  scenarioName: 'Default',
  status: 'fail',
  simulationStatus: 'complete',
  schedule: 'combinational',
  firstFailingTick: 5,
  report: {
    rows: [
      { tick: 5, signal: 'SUM[2]', expected: '1', actual: '0', status: 'fail', caseIndex: 5 },
      { tick: 7, signal: 'SUM[2]', expected: '0', actual: '1', status: 'fail', caseIndex: 7 },
      { tick: 1, signal: 'CARRY', expected: '0', actual: '0', status: 'pass', caseIndex: 1 },
    ],
  },
} as unknown as RuntimeVerifyRun;

describe('buildEngineeringProblems', () => {
  it('reports one problem per failing signal with the first failure and the owning object', () => {
    const problems = buildEngineeringProblems(baseInput({ lastRun: failingRun }));
    const failure = problems.find((problem) => problem.code === 'check-failed');
    expect(failure).toBeDefined();
    expect(failure?.message).toBe('SUM[2]: 2 checks fail in Default');
    expect(failure?.detail).toContain('case 5');
    expect(failure?.object).toEqual({ kind: 'case-tick', scenarioId: 'default', tick: 5 });
    expect(failure?.document).toEqual({ kind: 'cases', scenarioId: 'default' });
    expect(failure?.freshness).toBe('current');
    expect(problems.filter((problem) => problem.code === 'check-failed')).toHaveLength(1);
  });

  it('marks stale evidence and keeps the failure but downgrades nothing silently', () => {
    const problems = buildEngineeringProblems(baseInput({ lastRun: failingRun, runIsStale: true }));
    const stale = problems.find((problem) => problem.code === 'evidence-stale');
    expect(stale?.severity).toBe('info');
    expect(stale?.freshness).toBe('stale');
    expect(problems.find((problem) => problem.code === 'check-failed')?.freshness).toBe('stale');
  });

  it('turns an unmapped required port into a board error and suppresses the duplicate export diagnostic', () => {
    const problems = buildEngineeringProblems(
      baseInput({
        mappingProjection: [
          {
            logicalSignalId: 'sum_2',
            logicalLabel: 'SUM[2]',
            direction: 'out',
            artifactPortName: 'SUM_2',
            boardResourceId: null,
            boardResourceLabel: null,
            packagePin: null,
            ioStandard: 'LVCMOS33',
            exactXdcLine: '',
            required: true,
            conflictState: 'missing-pin',
          },
        ],
        exportErrors: [
          {
            id: 'x1',
            code: 'unmapped-port',
            title: 'Port SUM_2 is unmapped',
            message: 'no pin',
            hint: [],
            port: 'SUM_2',
            severity: 'error',
            owner: { kind: 'mapping', id: 'SUM_2' },
            actions: [],
            canonical: {} as never,
          } as never,
        ],
        activeConstraintSetId: 'cs1',
      })
    );
    const board = problems.filter((problem) => problem.category === 'board');
    expect(board).toHaveLength(1);
    expect(board[0].message).toBe('SUM[2] has no board resource');
    expect(board[0].document).toEqual({ kind: 'board-io', constraintSetId: 'cs1' });
    expect(problems.some((problem) => problem.id === 'export:x1')).toBe(false);
  });

  it('surfaces identity ambiguity as a warning that names the object', () => {
    const problems = buildEngineeringProblems(
      baseInput({ relationships: index([relation({})], [{ fieldId: 'sum_2', reason: 'Two boundary fields normalize to sum_2' }]) })
    );
    const ambiguity = problems.find((problem) => problem.category === 'identity');
    expect(ambiguity?.severity).toBe('warning');
    expect(ambiguity?.message).toBe('SUM[2] cannot be followed unambiguously');
    expect(ambiguity?.objectLabel).toBe('SUM[2]');
  });

  it('orders errors before warnings before notes and counts them', () => {
    const problems = buildEngineeringProblems(
      baseInput({
        lastRun: failingRun,
        runIsStale: true,
        importFidelity: 'partial',
        relationships: index([relation({})], [{ fieldId: 'sum_2', reason: 'dup' }]),
      })
    );
    expect(problems.map((problem) => problem.severity)).toEqual(['error', 'warning', 'info', 'info']);
    expect(countProblems(problems)).toEqual({ error: 1, warning: 1, info: 2, total: 4 });
  });
});
