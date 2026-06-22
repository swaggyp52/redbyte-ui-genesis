import { describe, expect, it } from 'vitest';
import {
  PROJECT_INDEX_STORAGE_KEY,
  PROJECT_RUNTIME_JOURNAL_KEY,
  PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY,
  PROJECT_RUNTIME_RECOVERY_STATUS_KEY,
  PROJECT_RUNTIME_STORAGE_KEY,
  type BrowserStorageLike,
  acquireWriteLease,
  exportProjectBackup,
  getProjectStorageHealth,
  importProjectBackup,
  listRecoveryPoints,
  loadProject,
  saveProject,
  saveProjectIndex,
  saveSnapshot,
} from '../projectStorageFacade';

class MemoryStorage implements BrowserStorageLike {
  private readonly items = new Map<string, string>();
  throwOnSet: ((key: string, value: string) => unknown) | null = null;

  get length(): number {
    return this.items.size;
  }

  key(index: number): string | null {
    return [...this.items.keys()].sort()[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      const thrown = this.throwOnSet(key, value);
      if (thrown) throw thrown;
    }
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

function runtimePayload(projectName = 'Durable Lab', projectId = 'rb-durable-lab'): string {
  return JSON.stringify({
    state: {
      projectId,
      projectName,
      circuit: { nodes: [], connections: [] },
      projectHealthCore: { dirtySinceVerify: true },
    },
    version: 5,
  });
}

describe('projectStorageFacade', () => {
  it('journals runtime saves and writes last-known-good recovery points', () => {
    const storage = new MemoryStorage();
    const result = saveProject({
      payloadRaw: runtimePayload('Journaled Lab'),
      storage,
      writerId: 'writer-a',
    });

    expect(result.status).toBe('ok');
    expect(storage.getItem(PROJECT_RUNTIME_STORAGE_KEY)).toContain('Journaled Lab');
    expect(JSON.parse(storage.getItem(PROJECT_RUNTIME_JOURNAL_KEY) ?? '{}')).toMatchObject({
      status: 'committed',
      revision: 1,
      writerId: 'writer-a',
    });
    expect(JSON.parse(storage.getItem(PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY) ?? '{}')).toMatchObject({
      projectName: 'Journaled Lab',
      revision: 1,
    });
    expect(listRecoveryPoints({ storage })).toHaveLength(1);
    expect(getProjectStorageHealth(storage)).toMatchObject({
      runtimeStatePresent: true,
      lastKnownGoodPresent: true,
      journalStatus: 'committed',
      recoveryPointCount: 1,
    });
  });

  it('recovers from malformed current runtime using last-known-good and records recovery status', () => {
    const storage = new MemoryStorage();
    saveProject({
      payloadRaw: runtimePayload('Last Good Lab'),
      storage,
      writerId: 'writer-a',
    });
    storage.setItem(PROJECT_RUNTIME_STORAGE_KEY, '{"state": {"projectName": ');

    const recovered = loadProject({ storage });

    expect(recovered.status).toBe('recovered');
    expect(recovered.source).toBe('last-known-good');
    expect(recovered.projectName).toBe('Last Good Lab');
    expect(storage.getItem(PROJECT_RUNTIME_RECOVERY_STATUS_KEY)).toContain('last-known-good');
  });

  it('fails closed when only a future-schema last-known-good can recover malformed runtime', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROJECT_RUNTIME_STORAGE_KEY, '{"state": {"projectName": ');
    storage.setItem(
      PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY,
      JSON.stringify({
        schema: 'redbyte.project-storage.facade.v2',
        schemaVersion: 99,
        key: PROJECT_RUNTIME_STORAGE_KEY,
        payloadRaw: runtimePayload('Future Lab'),
      })
    );

    const recovered = loadProject({ storage });

    expect(recovered.status).toBe('future-schema');
    expect(recovered.payloadRaw).toBeNull();
  });

  it('classifies quota pressure without marking the save committed', () => {
    const storage = new MemoryStorage();
    storage.throwOnSet = (key) => {
      if (key === PROJECT_RUNTIME_STORAGE_KEY) {
        return { name: 'QuotaExceededError' };
      }
      return null;
    };

    const result = saveProject({
      payloadRaw: runtimePayload('Quota Lab'),
      storage,
      writerId: 'writer-a',
    });

    expect(result.status).toBe('quota');
    expect(storage.getItem(PROJECT_RUNTIME_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(PROJECT_RUNTIME_JOURNAL_KEY) ?? '{}')).toMatchObject({
      status: 'failed',
      errorKind: 'quota',
    });
  });

  it('blocks stale-tab overwrites when the caller holds an older revision', () => {
    const storage = new MemoryStorage();
    const first = saveProject({
      payloadRaw: runtimePayload('First Writer'),
      storage,
      writerId: 'writer-a',
    });
    const staleLease = acquireWriteLease({
      storage,
      writerId: 'writer-b',
    });
    expect(first.revision).toBe(1);

    saveProject({
      payloadRaw: runtimePayload('Second Writer'),
      storage,
      writerId: 'writer-a',
    });
    const stale = saveProject({
      payloadRaw: runtimePayload('Stale Writer'),
      storage,
      writerId: 'writer-b',
      expectedRevision: staleLease.revision,
    });

    expect(stale.status).toBe('conflict');
    expect(storage.getItem(PROJECT_RUNTIME_STORAGE_KEY)).toContain('Second Writer');
  });

  it('keeps saved snapshots and index behind the same facade boundary', () => {
    const storage = new MemoryStorage();
    const snapshot = JSON.stringify({
      version: 1,
      projectId: 'rb-saved',
      projectName: 'Saved Lab',
      savedAtIso: '2026-06-22T00:00:00.000Z',
      projectHash: 'hash',
      rbprojJson: '{"kind":"rb-project"}',
    });

    expect(
      saveSnapshot({
        projectId: 'rb-saved',
        projectName: 'Saved Lab',
        projectHash: 'hash',
        snapshotRaw: snapshot,
        storage,
      }).status
    ).toBe('ok');
    expect(saveProjectIndex(JSON.stringify([{ projectId: 'rb-saved' }]), storage).status).toBe('ok');
    expect(storage.getItem('rb.ide.project.v1:rb-saved')).toBe(snapshot);
    expect(storage.getItem(PROJECT_INDEX_STORAGE_KEY)).toContain('rb-saved');
  });

  it('exports and imports a recovery backup without clearing unrelated browser data', () => {
    const storage = new MemoryStorage();
    storage.setItem('unrelated-key', 'keep');
    saveProject({
      payloadRaw: runtimePayload('Backup Lab'),
      storage,
      writerId: 'writer-a',
    });
    const backup = exportProjectBackup(storage);
    const target = new MemoryStorage();
    target.setItem('unrelated-key', 'keep');

    const imported = importProjectBackup(backup, target);

    expect(imported.status).toBe('ok');
    expect(imported.restoredKeys).toBeGreaterThan(0);
    expect(target.getItem('unrelated-key')).toBe('keep');
    expect(loadProject({ storage: target }).projectName).toBe('Backup Lab');
  });
});
