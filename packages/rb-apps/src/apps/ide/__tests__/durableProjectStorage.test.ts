// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { createJSONStorage } from 'zustand/middleware';
import { createDurableProjectRepository, decodeIdeSessionBackup, encodeIdeSessionBackup, type ProjectRepositorySaveInput } from '../projectRepository';
import { buildProjectStorageKey, IDE_PROJECT_INDEX_KEY, sessionEvidenceSaveSignature, snapshotRuntimeEvidence } from '../projectPersistence';
import { recordingStorageReplacer, recordingStorageReviver } from '../recordingStorage';
import { useProjectRuntime } from '../projectRuntime';
import { createCoalescedJsonStorage, type SessionStorageBackend } from '../durableProjectStorage';
import { importedVcdProvider, type ProviderWaveform } from '../simulationProvider';

beforeEach(() => localStorage.clear());

it('yields serialization, coalesces pending runtime snapshots without dropping records, and flush waits for the actual write', async () => {
  const writes: string[] = []; let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  const storage = { getItem: () => writes.at(-1) ?? null, removeItem() {},
    async setItem(_key: string, value: string) { if (!writes.length) await held; writes.push(value); } };
  const adapter = createCoalescedJsonStorage<{ records: number[] }>(storage,
    { replacer: recordingStorageReplacer, reviver: recordingStorageReviver }, { defer: true });
  adapter.setItem('runtime', { version: 5, state: { records: [1] } });
  expect(writes).toHaveLength(0);
  await new Promise(resolve => setTimeout(resolve, 5));
  for (let count = 2; count <= 60; count += 1) {
    adapter.setItem('runtime', { version: 5, state: { records: Array.from({ length: count }, (_, index) => index + 1) } });
  }
  let flushed = false; const finished = adapter.flush().then(() => { flushed = true; });
  await Promise.resolve(); expect(flushed).toBe(false);
  release(); await finished;
  expect(writes).toHaveLength(2);
  expect(JSON.parse(writes[1]).state.records).toEqual(Array.from({ length: 60 }, (_, index) => index + 1));
  expect(adapter.isPending()).toBe(false);
});

it('keeps a rejected deferred write failed until a successful retry, with the prior bytes readable', async () => {
  let raw = JSON.stringify({ state: { value: 'last good' }, version: 5 }); let fail = true;
  const adapter = createCoalescedJsonStorage<{ value: string }>({ getItem: () => raw, removeItem() {},
    setItem(_key, next) { if (fail) throw new Error('Controlled write failure'); raw = next; } },
    { replacer: recordingStorageReplacer, reviver: recordingStorageReviver }, { defer: true });
  adapter.setItem('runtime', { version: 5, state: { value: 'new work' } });
  await expect(adapter.flush()).rejects.toThrow('Controlled write failure');
  await expect(adapter.flush()).rejects.toThrow('Controlled write failure');
  expect(JSON.parse(raw).state.value).toBe('last good');
  fail = false; adapter.setItem('runtime', { version: 5, state: { value: 'new work' } });
  await adapter.flush(); expect(JSON.parse(raw).state.value).toBe('new work');
});

function fixtureBackend() {
  const values = new Map<string, string>();
  let hold: Promise<void> | undefined;
  let rejectNext = false;
  const backend: SessionStorageBackend = {
    async ready() {}, snapshot: () => new Map(values),
    async commit(changes) {
      if (hold) await hold;
      if (rejectNext) { rejectNext = false; throw new DOMException('Controlled quota failure', 'QuotaExceededError'); }
      for (const [key, value] of changes) { if (value === null) values.delete(key); else values.set(key, value); }
    },
  };
  return { backend, values, fail: () => { rejectNext = true; }, hold: (promise?: Promise<void>) => { hold = promise; } };
}

function input(name = 'Saved session'): ProjectRepositorySaveInput {
  return { projectId: 'durable-project', projectName: name, projectHash: 'hash-' + name,
    project: { kind: 'rb-project', version: 1, name, createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:00.000Z',
      circuit: { nodes: [], connections: [] }, meta: { projectId: 'durable-project' } } };
}

it('publishes saved only after commit and keeps reads on the last durable snapshot while writing', async () => {
  const fixture = fixtureBackend(); const repository = createDurableProjectRepository(fixture.backend);
  await repository.ready(); expect((await repository.save(input('original'))).ok).toBe(true);
  let release = () => {};
  fixture.hold(new Promise<void>(resolve => { release = resolve; }));
  const captured = input('accepted'); const pending = repository.save(captured);
  captured.projectName = 'edited after click';
  await Promise.resolve(); await Promise.resolve();
  expect(repository.getState().saveState).toBe('saving');
  const during = repository.open('durable-project');
  expect(during.ok && during.value.snapshot.projectName).toBe('original');
  release(); expect((await pending).ok).toBe(true);
  expect(repository.getState().saveState).toBe('saved');
  const opened = repository.open('durable-project');
  expect(opened.ok && opened.value.snapshot.projectName).toBe('accepted');
});

it('keeps the previous snapshot and index on failed save and offers a complete storage-independent recovery download', async () => {
  const fixture = fixtureBackend(); const repository = createDurableProjectRepository(fixture.backend);
  await repository.ready(); await repository.save(input('last good'));
  const before = new Map(fixture.values); fixture.fail();
  const failed = await repository.save(input('new work'));
  expect(failed).toMatchObject({ ok: false, error: { code: 'quota-exceeded' } });
  expect(repository.getState().saveState).toBe('save-failed');
  expect(fixture.values).toEqual(before);
  const recovered = decodeIdeSessionBackup(JSON.parse(encodeIdeSessionBackup(input('new work'))));
  expect(recovered.project.name).toBe('new work');
  expect(fixture.values).toEqual(before);
  expect((await repository.save(input('retry'))).ok).toBe(true);
  expect(repository.getState().saveState).toBe('saved');
});

it('does not replace a malformed migrated save and rejects damaged imported recordings', async () => {
  const fixture = fixtureBackend();
  fixture.values.set(buildProjectStorageKey('durable-project'), '{original malformed bytes');
  fixture.values.set(IDE_PROJECT_INDEX_KEY, '[]');
  const repository = createDurableProjectRepository(fixture.backend); await repository.ready();
  expect(repository.open('durable-project')).toMatchObject({ ok: false, error: { code: 'corrupt-snapshot' } });
  expect(await repository.save(input())).toMatchObject({ ok: false, error: { code: 'corrupt-snapshot' } });
  expect(fixture.values.get(buildProjectStorageKey('durable-project'))).toBe('{original malformed bytes');
  const backup = JSON.parse(encodeIdeSessionBackup(input()));
  backup.snapshot.runEvidence = { archive: [{ deterministicHash: 'claimed', waveform: 'damaged', report: { rows: [] } }] };
  expect(() => decodeIdeSessionBackup(backup)).toThrow(/damaged/);
});

it('retains external VCD values, provenance and analyzer context through saved reopen and recovery backup', async () => {
  const waveform: ProviderWaveform = { provider: importedVcdProvider('external.vcd'), signals: [{ key: 'bus', name: 'u_top.bus', width: 4 }],
    changes: [{ key: 'bus', time: 0, value: 'xxxx' }, { key: 'bus', time: 8, value: '10z1' }], endTime: 8, notes: ['Source supplied externally'], timescaleLabel: '1ns' };
  useProjectRuntime.getState().loadExample('full-adder');
  const emptySignature = sessionEvidenceSaveSignature(snapshotRuntimeEvidence(useProjectRuntime.getState()));
  useProjectRuntime.getState().setImportedWaveform(waveform);
  useProjectRuntime.getState().setVcdAnalyzerConfig({ selectedKeys: ['bus'], cursorTime: 8, radixByKey: { bus: 'hex' }, search: 'top' });
  const evidence = snapshotRuntimeEvidence(useProjectRuntime.getState());
  expect(sessionEvidenceSaveSignature(evidence)).not.toBe(emptySignature);
  const saved = { ...input(), runEvidence: evidence };
  const fixture = fixtureBackend(); const repository = createDurableProjectRepository(fixture.backend); await repository.ready();
  expect((await repository.save(saved)).ok).toBe(true);
  const opened = repository.open(saved.projectId); if (!opened.ok) throw Error(opened.error.message);
  useProjectRuntime.getState().loadFromProject(opened.value.project, undefined, { runEvidence: opened.value.snapshot.runEvidence });
  expect(useProjectRuntime.getState().importedWaveform).toEqual(waveform);
  expect(useProjectRuntime.getState().vcdAnalyzer).toEqual(evidence.vcdAnalyzer);
  expect(decodeIdeSessionBackup(JSON.parse(encodeIdeSessionBackup(saved))).snapshot.runEvidence?.importedWaveform).toEqual(waveform);
  const malformed = JSON.parse(encodeIdeSessionBackup(saved));
  malformed.snapshot.runEvidence.importedWaveform.provider.executesInBrowser = true;
  expect(() => decodeIdeSessionBackup(malformed)).toThrow(/damaged/);
  useProjectRuntime.getState().loadFromProject(input().project);
  expect(useProjectRuntime.getState().importedWaveform).toBeNull();
});

it('retains ten 512-case recordings from three configurations, preserves exact identity and receipts, and reproduces the oldest after reopening', async () => {
  const originalStorage = useProjectRuntime.persist.getOptions().storage;
  const runtimeValues = new Map<string, string>();
  const memory = { getItem: (key: string) => runtimeValues.get(key) ?? null, setItem: (key: string, value: string) => { runtimeValues.set(key, value); }, removeItem: (key: string) => { runtimeValues.delete(key); } };
  useProjectRuntime.persist.setOptions({ storage: createJSONStorage(() => memory, { replacer: recordingStorageReplacer, reviver: recordingStorageReviver }) });
  try {
    useProjectRuntime.getState().loadExample('full-adder');
    const starter = useProjectRuntime.getState();
    const cases = structuredClone(starter.projectVectors);
    for (let index = 0; index < 10; index += 1) {
      const configuration = index % 3;
      if (index < 3) {
        const vectors = Array.from({ length: 512 }, (_, tick) => ({ ...structuredClone(cases[(tick + configuration) % cases.length]), tick, id: `authored-${configuration}-${tick}` }));
        useProjectRuntime.getState().setVectors(vectors);
      }
      const state = useProjectRuntime.getState();
      const prior = state.verifyRunArchive[configuration];
      state.runVerification({ scenarioId: state.activeScenarioId, scenarioName: '512 authored cases', deterministicHash: 'fixture-' + configuration,
        rows: [], ...(index >= 3 ? { reproduceRunId: prior.runId } : {}) });
    }
    const current = useProjectRuntime.getState();
    expect(current.verifyRunArchive).toHaveLength(10);
    expect(new Set(current.verifyRunArchive.map(run => run.identity?.stimulus)).size).toBe(3);
    const archive = JSON.parse(JSON.stringify(current.verifyRunArchive));
    const receipt = { status: 'ok' as const, hash: 'package-source', packageHash: 'a'.repeat(64), downloadedAtIso: '2026-09-12T00:00:00.000Z' };
    const savedInput: ProjectRepositorySaveInput = { projectId: current.projectId, projectName: current.projectName, projectHash: 'fixture-current',
      project: { ...input().project, name: current.projectName, circuit: current.circuit, vectors: current.projectVectors,
        ioMapping: { inputs: current.projectIoRows.filter(row => row.direction === 'in'), outputs: current.projectIoRows.filter(row => row.direction === 'out') },
        meta: { projectId: current.projectId } },
      scenarios: current.scenarios, activeScenarioId: current.activeScenarioId,
      runEvidence: { lastRun: current.verifyLastRun, archive: current.verifyRunArchive, history: current.verifyRunHistory, exportHistory: [receipt] } };
    const fixture = fixtureBackend(); const repository = createDurableProjectRepository(fixture.backend); await repository.ready();
    expect((await repository.save(savedInput)).ok).toBe(true);
    const reopened = createDurableProjectRepository(fixture.backend); await reopened.ready();
    const opened = reopened.open(current.projectId); expect(opened.ok).toBe(true); if (!opened.ok) throw Error(opened.error.message);
    expect(JSON.parse(JSON.stringify(opened.value.snapshot.runEvidence?.archive))).toEqual(archive);
    expect(opened.value.snapshot.runEvidence?.exportHistory).toEqual([receipt]);
    useProjectRuntime.getState().loadFromProject(opened.value.project, { scenarios: opened.value.snapshot.scenarios, activeScenarioId: opened.value.snapshot.activeScenarioId }, { runEvidence: opened.value.snapshot.runEvidence });
    expect(useProjectRuntime.getState().exportHistory).toEqual([receipt]);
    expect(useProjectRuntime.getState().projectHealthCore.lastExport).toEqual(receipt);
    const first = useProjectRuntime.getState().verifyRunArchive[0];
    const reproduced = useProjectRuntime.getState().runVerification({ reproduceRunId: first.runId, scenarioId: first.scenarioId, scenarioName: first.scenarioName, deterministicHash: first.deterministicHash, rows: [] });
    expect(reproduced.outputDigest).toBe(first.outputDigest);
    expect(reproduced.nativeTrace).toEqual(first.nativeTrace);
    expect(reproduced.executionInput?.vectors.map(vector => vector.id)).toEqual(first.executionInput?.vectors.map(vector => vector.id));
    const session = encodeIdeSessionBackup(savedInput);
    expect(decodeIdeSessionBackup(JSON.parse(session)).snapshot.runEvidence?.archive).toEqual(JSON.parse(JSON.stringify(current.verifyRunArchive)));
    const rawRuntime = [...runtimeValues.values()].reduce((sum, value) => sum + value.length, 0);
    const storedProject = [...fixture.values.values()].reduce((sum, value) => sum + value.length, 0);
    console.log(JSON.stringify({ workload: '10 x 512 cases / 3 configurations', runtimeCharsAfterReproduction: rawRuntime, repositoryChars: storedProject, sessionBackupChars: session.length,
      duplicateLastRun: Boolean(current.verifyRunArchive.some(run => run.runId === current.verifyLastRun?.runId)), storageAuthority: 'runtime recovery + explicit project snapshot; native IndexedDB quota tested separately' }));
  } finally { useProjectRuntime.persist.setOptions({ storage: originalStorage }); }
}, 30000);
