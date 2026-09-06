import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { useProjectRuntime, type RuntimeVerifyRun, type VerifyRunLedgerEntry } from '../projectRuntime';

/**
 * P2.5H §7 — reopening a saved project restores its own run evidence.
 *
 * The repository snapshot used to carry the design and the checks but not the run that
 * proved them, and `loadFromProject` cleared the evidence unconditionally. A student who
 * ran a verification, opened another project and came back was told to re-run work they
 * had already done, and the package built from that run lost its provenance. Evidence is
 * workspace-local, so it travels with the workspace snapshot, never with the portable
 * RBProject.
 */
function savedProject(projectId: string): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    name: 'Reopened Work',
    circuit: {
      nodes: [
        { id: 'in_a', type: 'INPUT', label: 'A', x: 0, y: 0 },
        { id: 'out_y', type: 'OUTPUT', label: 'Y', x: 200, y: 0 },
      ],
      connections: [
        { from: { nodeId: 'in_a', portName: 'out' }, to: { nodeId: 'out_y', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'a', nodeId: 'in_a', port: 'out', label: 'A', pin: 'V17' }],
      outputs: [{ id: 'y', nodeId: 'out_y', port: 'in', label: 'Y', pin: 'U16' }],
    },
    vectors: [{ tick: 0, inputs: { a: 1 }, expected: { y: 1 } }],
    meta: { projectId, projectKind: 'custom', scenarioAuthority: 'authored' },
  } as RBProject;
}

// Run identity lives on the ledger entry; the run itself is identified by its deterministic
// hash and the scenario it graded.
const RUN_ID = 'run-2026-01-01T00:00:00.000Z-abcdef01';
const RUN_HASH = 'deadbeefcafe0001';

const storedRun = (owner: string): RuntimeVerifyRun =>
  ({
    projectId: owner,
    scenarioId: 'default',
    scenarioName: 'Default',
    status: 'pass',
    deterministicHash: RUN_HASH,
    ranAtIso: '2026-01-01T00:00:00.000Z',
    report: {
      rows: [{ tick: 0, signal: 'Y', expected: '1', actual: '1', status: 'pass' }],
      vectors: [{ tick: 0, inputs: { a: 1 }, expected: { y: 1 } }],
      inputsAtTick: { 0: { a: 1 } },
      inputsByVectorId: {},
      signalRoles: {},
    },
    waveform: [],
    meta: {},
  }) as unknown as RuntimeVerifyRun;

const storedLedger = (owner: string): VerifyRunLedgerEntry[] => [
  {
    runId: RUN_ID,
    projectId: owner,
    status: 'pass',
  } as unknown as VerifyRunLedgerEntry,
];

describe('projectRuntime — reopening a project restores its own evidence', () => {
  it('restores the last run and the ledger, re-owned to the project being opened', () => {
    act(() => {
      useProjectRuntime.getState().loadFromProject(savedProject('rb-reopened'), undefined, {
        runEvidence: { lastRun: storedRun('rb-reopened'), history: storedLedger('rb-reopened') },
      });
    });

    const state = useProjectRuntime.getState();
    expect(state.verifyLastRun?.deterministicHash, 'the run itself must come back').toBe(RUN_HASH);
    expect(
      state.verifyLastRun?.report?.rows?.length,
      'the per-vector rows are what make it replayable; a summary row is not a trace'
    ).toBe(1);
    expect(state.verifyRunHistory.map((entry) => entry.runId)).toEqual([RUN_ID]);
    expect(
      state.verifyLastRun?.projectId,
      'restored evidence is owned by the identity that was opened'
    ).toBe(state.projectId);
    expect(state.verifyRunHistory[0]?.projectId).toBe(state.projectId);
    expect(
      state.projectHealthCore.dirtySinceVerify,
      'a project reopened with its own run is not unproven on arrival'
    ).toBe(false);
  });

  it('restores nothing when a project arrives without evidence, and says it is unproven', () => {
    act(() => {
      useProjectRuntime.getState().loadFromProject(savedProject('rb-imported'));
    });

    const state = useProjectRuntime.getState();
    expect(state.verifyLastRun, 'an import carries no evidence of its own').toBeUndefined();
    expect(state.verifyRunHistory).toEqual([]);
    expect(
      state.projectHealthCore.dirtySinceVerify,
      'with no evidence the project is unproven, which is what this flag means'
    ).toBe(true);
  });

  it('never leaves restored evidence claiming a foreign owner', () => {
    act(() => {
      useProjectRuntime.getState().loadFromProject(savedProject('rb-target'), undefined, {
        runEvidence: {
          lastRun: storedRun('rb-some-other-project'),
          history: storedLedger('rb-some-other-project'),
        },
      });
    });

    const state = useProjectRuntime.getState();
    // The snapshot travels with its project, so evidence inside it belongs to the project
    // being opened. It is re-stamped rather than left claiming an owner the workspace has
    // no way to check, which is the rule the ownership work established.
    expect(state.verifyLastRun?.projectId).toBe(state.projectId);
    expect(state.verifyLastRun?.projectId).not.toBe('rb-some-other-project');
    expect(state.verifyRunHistory[0]?.projectId).toBe(state.projectId);
  });
});
