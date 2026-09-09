// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';
import { findVerifyRunLedgerEntry, getRuntimeVerifyRunId } from '../runArchive';

function fixture(): RBProject {
  return {
    kind: 'rb-project', version: 1, name: 'Two distinct experiments',
    createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z',
    circuit: {
      nodes: [
        { id: 'input', type: 'INPUT', label: 'A', position: { x: 0, y: 0 }, config: {}, state: {} },
        { id: 'output', type: 'OUTPUT', label: 'Y', position: { x: 200, y: 0 }, config: {}, state: {} },
      ],
      connections: [{ from: { nodeId: 'input', portName: 'out' }, to: { nodeId: 'output', portName: 'in' } }],
    },
    ioMapping: {
      inputs: [{ id: 'a', nodeId: 'input', port: 'out', label: 'A', pin: 'SW0' }],
      outputs: [{ id: 'y', nodeId: 'output', port: 'in', label: 'Y', pin: 'LD0' }],
    },
    vectors: [{ tick: 0, inputs: { a: 0 }, expected: { y: 1 } }, { tick: 1, inputs: { a: 1 }, expected: { y: 1 } }],
    meta: { projectId: 'run-archive-project' },
  };
}

let ordinal = 0;
function run() {
  const state = useProjectRuntime.getState();
  ordinal += 1;
  return state.runVerification({
    scenarioId: state.activeScenarioId, scenarioName: 'Experiment', rows: [],
    deterministicHash: `test-run-${ordinal}`, ranAtIso: `2026-09-08T00:00:${String(ordinal).padStart(2, '0')}.000Z`,
  });
}

describe('complete recorded experiments', () => {
  beforeEach(() => {
    localStorage.clear(); ordinal = 0;
    useProjectRuntime.getState().loadFromProject(fixture());
  });

  it('returns to each scenario recording and retains the exact failed observations after repair', () => {
    const a = useProjectRuntime.getState().activeScenarioId;
    const failed = run();
    expect(failed.status).toBe('fail');
    const failedBytes = JSON.stringify(useProjectRuntime.getState().verifyRunArchive[0]);
    useProjectRuntime.getState().duplicateScenario();
    const b = useProjectRuntime.getState().activeScenarioId;
    expect(b).not.toBe(a);
    expect(useProjectRuntime.getState().verifyLastRun).toBeUndefined();
    useProjectRuntime.getState().setVectors([{ tick: 4, inputs: { a: 1 }, expected: { y: 1 } }]);
    const bRun = run();
    useProjectRuntime.getState().switchScenario(a);
    expect(useProjectRuntime.getState().verifyLastRun?.runId).toBe(failed.runId);
    expect(useProjectRuntime.getState().projectVectors.map((vector) => vector.tick)).toEqual([0, 1]);
    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(false);
    useProjectRuntime.getState().setVectors([{ tick: 0, inputs: { a: 0 }, expected: { y: 0 } }]);
    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(true);
    const repaired = run();
    expect(repaired.status).toBe('pass');
    const state = useProjectRuntime.getState();
    expect(state.verifyRunArchive).toHaveLength(3);
    expect(JSON.stringify(state.verifyRunArchive.find((entry) => entry.runId === failed.runId))).toBe(failedBytes);
    state.selectRecordedRun(getRuntimeVerifyRunId(failed));
    expect(useProjectRuntime.getState().verifyLastRun?.runId).toBe(failed.runId);
    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceVerify).toBe(true);
    state.selectRecordedRun(getRuntimeVerifyRunId(bRun));
    expect(useProjectRuntime.getState().verifyLastRun?.runId).toBe(failed.runId);
    state.switchScenario(b);
    expect(useProjectRuntime.getState().verifyLastRun?.runId).toBe(bRun.runId);
    expect(useProjectRuntime.getState().projectVectors[0].tick).toBe(4);
    expect(findVerifyRunLedgerEntry(useProjectRuntime.getState().verifyRunHistory, bRun)?.scenarioId).toBe(b);
  });

  it('captures detached topology, keeps it on reload, and does not invent it for legacy runs', () => {
    const recorded = run();
    expect(recorded.circuitSnapshot?.connections).toHaveLength(1);
    const bytes = JSON.stringify(recorded.circuitSnapshot);
    const current = useProjectRuntime.getState();
    const edited = structuredClone(current.circuit);
    edited.connections = [];
    current.applyCircuitMutation(edited);
    expect(JSON.stringify(useProjectRuntime.getState().verifyLastRun?.circuitSnapshot)).toBe(bytes);
    const persisted = JSON.parse(JSON.stringify(useProjectRuntime.getState()));
    const reloaded = mergePersistedRuntimeState(persisted, useProjectRuntime.getState());
    expect(JSON.stringify(reloaded.verifyRunArchive[0].circuitSnapshot)).toBe(bytes);
    expect(reloaded.verifyRunArchive[0].circuitSnapshot).not.toBe(recorded.circuitSnapshot);
    delete persisted.verifyLastRun.circuitSnapshot;
    delete persisted.verifyRunArchive;
    const legacy = mergePersistedRuntimeState(persisted, useProjectRuntime.getState());
    expect(legacy.verifyRunArchive).toHaveLength(1);
    expect(legacy.verifyRunArchive[0].circuitSnapshot).toBeUndefined();
  });

  it('reopens both scenario recordings, drops foreign archives, and re-owns copies', () => {
    const aRun = run();
    useProjectRuntime.getState().duplicateScenario();
    useProjectRuntime.getState().setVectors([{ tick: 5, inputs: { a: 1 }, expected: {} }]);
    const bRun = run();
    const saved = useProjectRuntime.getState();
    const scenarios = structuredClone(saved.scenarios);
    const archive = structuredClone(saved.verifyRunArchive);
    const history = structuredClone(saved.verifyRunHistory);
    saved.loadFromProject(fixture(), { scenarios, activeScenarioId: bRun.scenarioId }, {
      runEvidence: { lastRun: bRun, archive, history },
    });
    useProjectRuntime.getState().switchScenario(aRun.scenarioId);
    expect(useProjectRuntime.getState().verifyLastRun?.runId).toBe(aRun.runId);
    useProjectRuntime.getState().setProjectIdentity({ projectId: 'copied-project', markDirty: false });
    expect(useProjectRuntime.getState().verifyRunArchive.every((entry) => entry.projectId === 'copied-project')).toBe(true);
    const candidate = JSON.parse(JSON.stringify(useProjectRuntime.getState()));
    candidate.verifyRunArchive[0].projectId = 'foreign-project';
    candidate.verifyLastRun = undefined;
    const reopened = mergePersistedRuntimeState(candidate, useProjectRuntime.getState());
    expect(reopened.verifyRunArchive.some((entry) => entry.projectId === 'foreign-project')).toBe(false);
  });

  it('preserves a modern check-free observation and the other scenario archive on browser reload', () => {
    const checked = run();
    useProjectRuntime.getState().createScenario();
    useProjectRuntime.getState().setVectors([{ tick: 0, inputs: { a: 1 }, expected: {} }]);
    const observed = run();
    expect(observed.runKind).toBe('trace');
    expect(observed.assertionStatus).toBe('not-configured');
    const persisted = JSON.parse(JSON.stringify(useProjectRuntime.getState()));
    const reloaded = mergePersistedRuntimeState(persisted, useProjectRuntime.getState());
    expect(reloaded.verifyLastRun?.runId).toBe(observed.runId);
    expect(reloaded.verifyLastRun?.waveform).toEqual(observed.waveform);
    expect(reloaded.verifyRunArchive.map((entry) => entry.runId)).toEqual([checked.runId, observed.runId]);
    expect(reloaded.projectHealthCore.lastVerify?.runKind).toBe('trace');
  });
});
