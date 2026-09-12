// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { recordingStorageReplacer, recordingStorageReviver } from '../recordingStorage';
import { useProjectRuntime } from '../projectRuntime';
import { createProjectRepository } from '../projectRepository';
import type { VerifyWaveSample } from '../verifyReport';

beforeEach(() => localStorage.clear());

it('preserves exact ticks, hierarchical names, missing/X/Z values, failures and legacy JSON', () => {
  const waveform: VerifyWaveSample[] = Array.from({ length: 512 }, (_, tick) => ({
    tick: tick * 2,
    signals: Object.fromEntries(Array.from({ length: tick % 2 ? 39 : 40 }, (_, bit) =>
      [`u_full_adder_${bit}/sum_intermediate.out`, ['0', '1', 'X', 'Z'][bit % 4]])),
    mismatches: tick === 5 ? [{ signal: 'u_full_adder_1/sum_intermediate.out', expected: '0', actual: '1' }] : [],
  }));
  const record = { waveform, otherMetadata: 'retained' };
  const plain = JSON.stringify(record);
  const packed = JSON.stringify(record, recordingStorageReplacer);
  expect(packed.length).toBeLessThan(plain.length / 4);
  expect(JSON.parse(packed, recordingStorageReviver)).toEqual(record);
  expect(JSON.parse(plain, recordingStorageReviver)).toEqual(record);
  expect(() => JSON.parse('{"$rbWaveform":1,"signals":["a"],"frames":[[0,[],[],{}]]}', recordingStorageReviver)).toThrow(/Invalid/);
  expect(() => JSON.parse('{"$rbRows":1,"columns":["actual"],"cells":[[["1"]]]}', recordingStorageReviver)).toThrow(/Invalid retained check rows/);
});

it('retains two long recordings in existing runtime and project storage and restores both', async () => {
  useProjectRuntime.getState().loadExample('full-adder');
  const initial = useProjectRuntime.getState();
  initial.setVectors(Array.from({ length: 512 }, (_, tick) => ({ ...initial.projectVectors[tick % initial.projectVectors.length], tick })));
  const execute = () => useProjectRuntime.getState().runVerification({ deterministicHash: 'fixture', rows: [], scenarioId: initial.activeScenarioId, scenarioName: '512 cases' });
  execute(); const second = execute();
  const current = useProjectRuntime.getState();
  const archive = JSON.parse(JSON.stringify(current.verifyRunArchive));
  const project = { kind: 'rb-project' as const, version: 1 as const, name: current.projectName,
    description: current.projectDescription, createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:00.000Z',
    circuit: current.circuit, vectors: current.projectVectors, meta: { projectId: current.projectId } };
  const repository = createProjectRepository({ storage: localStorage });
  const saved = repository.save({ projectId: current.projectId, projectName: current.projectName, projectHash: 'fixture', project,
    runEvidence: { lastRun: second, archive: current.verifyRunArchive, history: current.verifyRunHistory } });
  expect(saved.ok).toBe(true);
  const opened = repository.open(current.projectId);
  expect(opened.ok && JSON.parse(JSON.stringify(opened.value.snapshot.runEvidence?.archive))).toEqual(archive);
  await useProjectRuntime.persist.rehydrate();
  expect(JSON.parse(JSON.stringify(useProjectRuntime.getState().verifyRunArchive))).toEqual(archive);
});
