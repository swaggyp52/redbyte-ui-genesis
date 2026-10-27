// @vitest-environment jsdom
/**
 * RB-DEBT-023: the versioned acknowledgement contract of the runtime persistence surface.
 * A write is requested synchronously (a revision) and acknowledged only when the storage
 * transaction has completed; navigation and the save indicator read the acknowledged revision.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  diskWithStoredProject,
  metaFor,
  openRuntimeDocument,
  PROJECT_A,
  PROJECT_B,
  RUNTIME_RECORD,
  SESSION_META_RECORD,
  settle,
} from './sessionDiskFixture';

const runtimeOnly = (key: string) => key === RUNTIME_RECORD;
const A = PROJECT_A.meta!.projectId as string;
const B = PROJECT_B.meta!.projectId as string;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runtime persistence revisions (RB-DEBT-023)', () => {
  it('requests a revision synchronously with an import and acknowledges it only after the write lands', async () => {
    const disk = await diskWithStoredProject();
    const doc = await openRuntimeDocument(disk);
    expect(doc.useProjectRuntime.getState().projectId).toBe(A);
    const release = doc.connection.hold(runtimeOnly);
    const before = doc.persistence.currentRevision();
    doc.useProjectRuntime.getState().loadFromProject(PROJECT_B);
    const revision = doc.persistence.currentRevision();
    expect(revision).toBeGreaterThan(before);
    let durable = false;
    const waiting = doc.persistence.whenDurable(revision).then(() => { durable = true; });
    await settle();
    expect(durable).toBe(false);
    expect(doc.persistence.acknowledgedRevision()).toBeLessThan(revision);
    expect(doc.persistence.getStatus().state).toBe('saving');
    expect(disk.runtime()?.projectId).toBe(A);
    release();
    await waiting;
    expect(disk.runtime()).toEqual({ projectId: B, projectName: PROJECT_B.name });
    expect(doc.persistence.acknowledgedRevision()).toBeGreaterThanOrEqual(revision);
    expect(doc.persistence.getStatus().state).toBe('ready');
  });

  it('defaults whenDurable to the current revision', async () => {
    const disk = await diskWithStoredProject();
    const doc = await openRuntimeDocument(disk);
    const release = doc.connection.hold(runtimeOnly);
    doc.useProjectRuntime.getState().loadFromProject(PROJECT_B);
    let durable = false;
    const waiting = doc.persistence.whenDurable().then(() => { durable = true; });
    await settle();
    expect(durable).toBe(false);
    release();
    await waiting;
    expect(disk.runtime()?.projectId).toBe(B);
  });

  it('leaves the acknowledged revision unchanged and rejects its waiters when the write fails', async () => {
    const disk = await diskWithStoredProject();
    const doc = await openRuntimeDocument(disk);
    doc.connection.failNext(runtimeOnly);
    const acknowledged = doc.persistence.acknowledgedRevision();
    doc.useProjectRuntime.getState().loadFromProject(PROJECT_B);
    const revision = doc.persistence.currentRevision();
    await expect(doc.persistence.whenDurable(revision)).rejects.toThrow('Controlled quota failure');
    expect(doc.persistence.acknowledgedRevision()).toBe(acknowledged);
    expect(doc.persistence.getStatus().state).toBe('failed');
    // A waiter that arrives after the failure is told at once; it does not hang.
    await expect(doc.persistence.whenDurable(revision)).rejects.toThrow('Controlled quota failure');
    expect(disk.runtime()?.projectId).toBe(A);
  });

  it('does not delay an earlier revision behind later writes', async () => {
    const disk = await diskWithStoredProject();
    const doc = await openRuntimeDocument(disk);
    const releaseFirst = doc.connection.hold(runtimeOnly);
    doc.useProjectRuntime.getState().loadFromProject(PROJECT_B);
    const importRevision = doc.persistence.currentRevision();
    await settle();
    // The import's write is in flight. Later edits queue behind it, and are held too.
    const releaseLater = doc.connection.hold(runtimeOnly);
    doc.useProjectRuntime.getState().setProjectIdentity({ projectName: 'Renamed after import' });
    const laterRevision = doc.persistence.currentRevision();
    let importDurable = false;
    let laterDurable = false;
    const importWait = doc.persistence.whenDurable(importRevision).then(() => { importDurable = true; });
    const laterWait = doc.persistence.whenDurable(laterRevision).then(() => { laterDurable = true; });
    releaseFirst();
    await importWait;
    await settle();
    expect(importDurable).toBe(true);
    expect(laterDurable).toBe(false);
    expect(disk.runtime()).toEqual({ projectId: B, projectName: PROJECT_B.name });
    releaseLater();
    await laterWait;
    expect(disk.runtime()?.projectName).toBe('Renamed after import');
  });

  it('stays bounded under continuous edits: a revision lands with the next write that covers it', async () => {
    const disk = await diskWithStoredProject();
    const doc = await openRuntimeDocument(disk);
    const releaseFirst = doc.connection.hold(runtimeOnly);
    doc.useProjectRuntime.getState().loadFromProject(PROJECT_B);
    await settle();
    const releaseSecond = doc.connection.hold(runtimeOnly);
    const edit = (index: number) => doc.useProjectRuntime.getState().setProjectIdentity({ projectName: `Edit ${index}` });
    for (let index = 1; index <= 20; index += 1) edit(index);
    const target = doc.persistence.currentRevision();
    let targetDurable = false;
    const targetWait = doc.persistence.whenDurable(target).then(() => { targetDurable = true; });
    releaseFirst();
    await settle();
    // The queued edits were coalesced into one snapshot, now in flight. Keep editing.
    const releaseThird = doc.connection.hold(runtimeOnly);
    for (let index = 21; index <= 40; index += 1) edit(index);
    const after = doc.persistence.currentRevision();
    let afterDurable = false;
    const afterWait = doc.persistence.whenDurable(after).then(() => { afterDurable = true; });
    expect(targetDurable).toBe(false);
    releaseSecond();
    await targetWait;
    await settle();
    expect(disk.runtime()?.projectName).toBe('Edit 20');
    expect(afterDurable).toBe(false);
    releaseThird();
    await afterWait;
    expect(disk.runtime()?.projectName).toBe('Edit 40');
  });

  it('never lets session metadata name a project whose working-session record has not landed', async () => {
    const disk = await diskWithStoredProject();
    const doc = await openRuntimeDocument(disk);
    const release = doc.connection.hold(runtimeOnly);
    doc.useProjectRuntime.getState().loadFromProject(PROJECT_B);
    // The workbench writes its navigation record for the newly open project right away.
    doc.labSession.saveLabSessionMeta(metaFor(doc));
    await settle();
    expect(disk.runtime()?.projectId).toBe(A);
    expect(disk.meta()?.projectId).toBe(A);
    // The metadata is part of the requested state: durability waits for it too.
    let durable = false;
    const waiting = doc.persistence.whenDurable().then(() => { durable = true; });
    release();
    await waiting;
    expect(durable).toBe(true);
    expect(disk.runtime()?.projectId).toBe(B);
    expect(disk.meta()?.projectId).toBe(B);
    const order = doc.connection.landed.map((keys) => keys.join(','));
    expect(order.indexOf(RUNTIME_RECORD)).toBeGreaterThanOrEqual(0);
    expect(order.lastIndexOf(SESSION_META_RECORD)).toBeGreaterThan(order.indexOf(RUNTIME_RECORD));
  });

  it('recovers an interrupted write: no metadata for the failed project, then the retried record and its metadata land', async () => {
    const disk = await diskWithStoredProject();
    const doc = await openRuntimeDocument(disk);
    doc.connection.failNext(runtimeOnly);
    doc.useProjectRuntime.getState().loadFromProject(PROJECT_B);
    doc.labSession.saveLabSessionMeta(metaFor(doc));
    await expect(doc.persistence.whenDurable()).rejects.toThrow('Controlled quota failure');
    expect(disk.runtime()?.projectId).toBe(A);
    expect(disk.meta()?.projectId).toBe(A);
    expect(doc.persistence.getStatus().state).toBe('failed');
    await doc.persistence.retryFailedWrites();
    await doc.persistence.whenDurable();
    expect(disk.runtime()?.projectId).toBe(B);
    expect(disk.meta()?.projectId).toBe(B);
    expect(doc.persistence.getStatus().state).toBe('ready');
    expect(doc.persistence.acknowledgedRevision()).toBe(doc.persistence.currentRevision());
  });

  it('reopens the imported project in the next document once the import is durable', async () => {
    const disk = await diskWithStoredProject();
    const doc = await openRuntimeDocument(disk);
    const release = doc.connection.hold(runtimeOnly);
    doc.useProjectRuntime.getState().loadFromProject(PROJECT_B);
    doc.labSession.saveLabSessionMeta(metaFor(doc));
    const waiting = doc.persistence.whenDurable();
    release();
    await waiting;
    doc.connection.unload();
    const next = await openRuntimeDocument(disk);
    expect(next.useProjectRuntime.getState().projectId).toBe(B);
    expect(next.labSession.loadLabSessionMeta()?.projectId).toBe(B);
  });

  it('keeps an ordinary edit and an explicit save unchanged: one write, saved after its commit', async () => {
    const disk = await diskWithStoredProject();
    const doc = await openRuntimeDocument(disk);
    doc.useProjectRuntime.getState().setProjectIdentity({ projectName: 'Edited A' });
    expect(doc.persistence.getStatus().state).toBe('saving');
    await doc.persistence.whenDurable();
    expect(disk.runtime()?.projectName).toBe('Edited A');
    expect(doc.persistence.getStatus().state).toBe('ready');
    const state = doc.useProjectRuntime.getState();
    const saved = await doc.projectRepository.save({ projectId: state.projectId, projectName: state.projectName,
      projectHash: 'hash-edited', project: { ...PROJECT_A, name: 'Edited A' } });
    expect(saved.ok).toBe(true);
    expect(doc.projectRepository.getState().saveState).toBe('saved');
    await doc.persistence.flush();
    expect(doc.persistence.acknowledgedRevision()).toBe(doc.persistence.currentRevision());
  });
});
