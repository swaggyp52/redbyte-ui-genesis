// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import {
  mergePersistedRuntimeState,
  useProjectRuntime,
  type RuntimeVerifyRun,
  type VerifyRunLedgerEntry,
  type VerifyRunMeta,
} from '../projectRuntime';
import { deriveRunScope, restampRunEvidenceProject, scopeRunEvidenceToProject } from '../runScope';
import { buildVerifyCircuitEvidenceHash, buildVerifyMappingEvidenceHash, toProjectIoMapping } from '../verifyProjectHash';
import { computeScenarioContentHash } from '../verifyScenario';
import type { IoMapping } from '@redbyte/rb-utils';

/**
 * P2.5H P0 — run evidence is scoped to the project that produced it, and
 * "stale" names the input that changed. A run from another project is never
 * rendered under a STALE strip; an unchanged project keeps current evidence
 * across a reload.
 */

function makeRun(overrides: Partial<RuntimeVerifyRun> & { circuitHash?: string }): RuntimeVerifyRun {
  const { circuitHash, ...rest } = overrides;
  return {
    scenarioId: 'default',
    scenarioName: 'Default',
    runKind: 'verify',
    status: 'pass',
    deterministicHash: 'h-run',
    reportHash: 'r-run',
    generatedAtIso: '2026-01-01T00:00:00.000Z',
    schedule: 'combinational',
    meta: {} as VerifyRunMeta,
    report: {
      schemaVersion: 'rb.verify-report.v1',
      scenarioId: 'default',
      scenarioName: 'Default',
      status: 'pass',
      deterministicHash: 'h-run',
      rows: [],
      vectors: [],
      inputsAtTick: {},
      signalRoles: {},
      generatedAtIso: '2026-01-01T00:00:00.000Z',
      reportHash: 'r-run',
    },
    waveform: [],
    evidence: circuitHash
      ? { circuitHash, ioRows: [], vectors: [], normalizationMap: [], preflight: [], failures: [] }
      : undefined,
    ...rest,
  };
}

function makeEntry(overrides: Partial<VerifyRunLedgerEntry>): VerifyRunLedgerEntry {
  return {
    runId: 'run-1',
    ranAtIso: '2026-01-01T00:00:00.000Z',
    status: 'pass',
    passedRows: 1,
    failedRows: 0,
    firstFailure: null,
    circuitHash: 'c',
    vectorsHash: 'v',
    mappingHash: 'm',
    projectHash: 'p-current',
    didCircuitChangeSinceLast: false,
    didVectorsChangeSinceLast: false,
    didMappingChangeSinceLast: false,
    ...overrides,
  };
}

describe('runScope — ownership', () => {
  it('drops a run and ledger entries owned by another project, stamps legacy ones', () => {
    const scoped = scopeRunEvidenceToProject({
      projectId: 'rb-a',
      run: makeRun({ projectId: 'rb-b' }),
      history: [
        makeEntry({ runId: 'legacy' }),
        makeEntry({ runId: 'mine', projectId: 'rb-a' }),
        makeEntry({ runId: 'theirs', projectId: 'rb-b' }),
      ],
    });
    expect(scoped.run).toBeUndefined();
    expect(scoped.droppedForeign).toBe(true);
    expect(scoped.history.map((entry) => `${entry.runId}:${entry.projectId}`)).toEqual([
      'legacy:rb-a',
      'mine:rb-a',
    ]);
  });

  it('keeps an unowned (legacy) run and stamps it with the envelope project', () => {
    const scoped = scopeRunEvidenceToProject({ projectId: 'rb-a', run: makeRun({}), history: [] });
    expect(scoped.run?.projectId).toBe('rb-a');
    expect(scoped.droppedForeign).toBe(false);
  });

  it('restamps evidence after Save As / Duplicate', () => {
    const restamped = restampRunEvidenceProject({
      projectId: 'rb-copy',
      run: makeRun({ projectId: 'rb-a' }),
      history: [makeEntry({ projectId: 'rb-a' })],
    });
    expect(restamped.run?.projectId).toBe('rb-copy');
    expect(restamped.history[0].projectId).toBe('rb-copy');
  });
});

describe('runScope — currency', () => {
  const circuitA: Circuit = {
    nodes: [
      { id: 'n1', type: 'INPUT', x: 0, y: 0, label: 'A' } as Circuit['nodes'][number],
      { id: 'n2', type: 'OUTPUT', x: 10, y: 0, label: 'Y' } as Circuit['nodes'][number],
    ],
    connections: [
      { id: 'w1', from: { nodeId: 'n1', portName: 'out' }, to: { nodeId: 'n2', portName: 'in' } },
    ],
  } as Circuit;
  const circuitB: Circuit = { ...circuitA, connections: [] } as Circuit;
  const rows = [
    { id: 'a', label: 'A', direction: 'in', nodeId: 'n1', port: 'out', pin: 'V17' },
    { id: 'y', label: 'Y', direction: 'out', nodeId: 'n2', port: 'in', pin: 'U16' },
  ] as unknown as Parameters<typeof deriveRunScope>[0]['projectIoRows'];
  const mappingHash = buildVerifyMappingEvidenceHash(toProjectIoMapping([...rows]) as IoMapping);
  const scenario = {
    id: 'default',
    name: 'Default',
    version: 1,
    vectors: [{ tick: 0, inputs: { a: 0 }, expected: { y: 0 } }],
  } as unknown as Parameters<typeof deriveRunScope>[0]['scenarios'][number];

  const base = {
    projectId: 'rb-a',
    simulationCircuit: circuitA,
    projectIoRows: rows,
    scenarios: [scenario],
    dirtySinceVerify: false,
    latestVerifyLedgerEntry: makeEntry({ projectHash: 'p-current' }),
    currentVerifyProjectHash: 'p-current',
  };
  const currentRun = makeRun({
    projectId: 'rb-a',
    circuitHash: buildVerifyCircuitEvidenceHash(circuitA),
    mappingEvidenceHash: mappingHash,
    scenarioContentHash: computeScenarioContentHash(scenario),
  });

  it('is none without a run', () => {
    expect(deriveRunScope({ ...base, run: undefined }).kind).toBe('none');
  });

  it('is foreign when the run names another project, and never exposes the run', () => {
    const scope = deriveRunScope({ ...base, run: makeRun({ projectId: 'rb-b' }) });
    expect(scope.kind).toBe('foreign');
    expect(scope.run).toBeNull();
    expect(scope.detail).toBe('This evidence belongs to another project.');
  });

  it('is current when the workflow authority agrees and nothing changed (a reload)', () => {
    const scope = deriveRunScope({ ...base, run: currentRun });
    expect(scope.kind).toBe('current');
    expect(scope.reasons).toEqual([]);
    expect(scope.detail).toBeNull();
  });

  it('names the design when the circuit changed', () => {
    const scope = deriveRunScope({
      ...base,
      run: currentRun,
      simulationCircuit: circuitB,
      dirtySinceVerify: true,
      currentVerifyProjectHash: 'p-changed',
    });
    expect(scope.kind).toBe('stale');
    expect(scope.reasons).toEqual(['design']);
    expect(scope.detail).toBe('The design changed after this run.');
  });

  it('names the pin mapping when a pin changed', () => {
    const remapped = rows.map((row) => (row.id === 'y' ? { ...row, pin: 'E19' } : row)) as typeof rows;
    const scope = deriveRunScope({
      ...base,
      run: currentRun,
      projectIoRows: remapped,
      currentVerifyProjectHash: 'p-changed',
    });
    expect(scope.kind).toBe('stale');
    expect(scope.reasons).toEqual(['mapping']);
    expect(scope.detail).toBe('The pin mapping changed after this run.');
  });

  it('names the scenario when its content changed or it no longer exists', () => {
    const edited = { ...scenario, version: 2, vectors: [{ tick: 0, inputs: { a: 1 }, expected: {} }] };
    const changed = deriveRunScope({
      ...base,
      run: currentRun,
      scenarios: [edited as typeof scenario],
      currentVerifyProjectHash: 'p-changed',
    });
    expect(changed.reasons).toEqual(['scenario']);
    expect(changed.detail).toBe('The scenario changed after this run.');
    const removed = deriveRunScope({ ...base, run: currentRun, scenarios: [], currentVerifyProjectHash: 'p-changed' });
    expect(removed.detail).toBe('The scenario (it no longer exists) changed after this run.');
  });

  it('lists every changed input in one sentence', () => {
    const scope = deriveRunScope({
      ...base,
      run: currentRun,
      simulationCircuit: circuitB,
      scenarios: [],
      dirtySinceVerify: true,
      currentVerifyProjectHash: 'p-changed',
    });
    expect(scope.reasons).toEqual(['design', 'scenario']);
    expect(scope.detail).toBe('The design and the scenario (it no longer exists) changed after this run.');
  });

  it('falls back to "edited" for a run that carries no hashes but the project is dirty', () => {
    const scope = deriveRunScope({ ...base, run: makeRun({ projectId: 'rb-a' }), dirtySinceVerify: true });
    expect(scope.kind).toBe('stale');
    expect(scope.reasons).toEqual(['edited']);
    expect(scope.detail).toBe('The project changed after this run.');
  });
});

describe('runScope — runtime rehydration', () => {
  beforeEach(() => {
    act(() => {
      useProjectRuntime.getState().replaceWithBlankProject();
      useProjectRuntime.getState().loadExample('half-adder');
    });
  });

  it('keeps a run owned by the envelope project (control)', () => {
    const current = useProjectRuntime.getState();
    const envelope = {
      ...current,
      verifyLastRun: makeRun({ projectId: current.projectId, circuitHash: 'c1' }),
      verifyRunHistory: [makeEntry({ projectId: current.projectId })],
    };
    const merged = mergePersistedRuntimeState(envelope, current);
    expect(merged.verifyLastRun?.projectId).toBe(current.projectId);
    expect(merged.verifyRunHistory).toHaveLength(1);
  });

  it('stamps a legacy (unowned) run with the envelope project', () => {
    const current = useProjectRuntime.getState();
    const envelope = { ...current, verifyLastRun: makeRun({ circuitHash: 'c1' }), verifyRunHistory: [makeEntry({})] };
    const merged = mergePersistedRuntimeState(envelope, current);
    expect(merged.verifyLastRun?.projectId).toBe(current.projectId);
    expect(merged.verifyRunHistory[0].projectId).toBe(current.projectId);
  });

  it('drops a run owned by another project and clears its verify trust', () => {
    const current = useProjectRuntime.getState();
    const envelope = {
      ...current,
      verifyLastRun: makeRun({ projectId: 'rb-someone-else', circuitHash: 'c1' }),
      verifyRunHistory: [makeEntry({ projectId: 'rb-someone-else' }), makeEntry({ runId: 'legacy' })],
      projectHealthCore: {
        ...current.projectHealthCore,
        lastVerify: { status: 'pass' as const, hash: 'h-run' },
        dirtySinceVerify: false,
      },
    };
    const merged = mergePersistedRuntimeState(envelope, current);
    expect(merged.verifyLastRun).toBeUndefined();
    expect(merged.verifyRunHistory.map((entry) => entry.runId)).toEqual(['legacy']);
    expect(merged.projectHealthCore.lastVerify).toBeUndefined();
    expect(merged.projectHealthCore.dirtySinceVerify).toBe(true);
  });

  it('re-owns evidence when the project id changes through Save As', () => {
    const current = useProjectRuntime.getState();
    act(() => {
      useProjectRuntime.setState({
        verifyLastRun: makeRun({ projectId: current.projectId, circuitHash: 'c1' }),
        verifyRunHistory: [makeEntry({ projectId: current.projectId })],
      });
      useProjectRuntime.getState().setProjectIdentity({ projectId: 'rb-save-as-copy' });
    });
    const next = useProjectRuntime.getState();
    expect(next.projectId).toBe('rb-save-as-copy');
    expect(next.verifyLastRun?.projectId).toBe('rb-save-as-copy');
    expect(next.verifyRunHistory[0].projectId).toBe('rb-save-as-copy');
  });
});
