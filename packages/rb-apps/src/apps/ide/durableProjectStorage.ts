import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware';

/** Transactional storage behind the existing runtime and ProjectRepository owners.
 * Payloads keep their existing keys/encodings. Revisions prevent a stale tab from
 * replacing a newer save; tombstones prevent deleted legacy records resurfacing.
 */
export const IDE_SESSION_DATABASE = 'redbyte-ide-sessions-v1';
const STORE = 'records';
const RUNTIME_KEY = 'rb.ide.project-runtime.v1';

interface StoredRecord { key: string; value: string | null; revision: number }
export interface SessionStorageBackend {
  ready(): Promise<void>;
  snapshot(): Map<string, string>;
  commit(changes: ReadonlyMap<string, string | null>): Promise<void>;
}

export class SessionStorageConflict extends Error {
  constructor() {
    super('Another tab saved this session. Your work is still open. Download a session backup, then reload this tab to read the newer save.');
    this.name = 'SessionStorageConflict';
  }
}

export function isIdeSessionKey(key: string): boolean {
  return key === RUNTIME_KEY || key === 'rb.ide.sessionMeta.v1' || key === 'rb.ide.projects.v1.index' || key.startsWith('rb.ide.project.v1:');
}

export function createIndexedDbSessionStorage(options: {
  indexedDB: IDBFactory;
  legacyStorage?: Storage | null;
  databaseName?: string;
}): SessionStorageBackend {
  let database: IDBDatabase;
  const records = new Map<string, StoredRecord>();
  let initialization: Promise<void> | undefined;
  let writes: Promise<void> = Promise.resolve();

  const readAll = (): Promise<StoredRecord[]> => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const request = transaction.objectStore(STORE).getAll();
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not read saved sessions.'));
    transaction.onerror = () => { /* onabort owns the result */ };
  });

  const write = (changes: ReadonlyMap<string, string | null>): Promise<void> => new Promise((resolve, reject) => {
    if (!changes.size) { resolve(); return; }
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(STORE, 'readwrite', { durability: 'strict' });
    } catch (error) { reject(error); return; }
    const store = transaction.objectStore(STORE);
    const next: StoredRecord[] = [];
    let failure: Error | null = null;
    for (const [key, value] of changes) {
      const expectedRevision = records.get(key)?.revision ?? 0;
      const request = store.get(key);
      request.onsuccess = () => {
        const current: StoredRecord | undefined = request.result;
        if ((current?.revision ?? 0) !== expectedRevision) {
          failure = new SessionStorageConflict();
          transaction.abort();
          return;
        }
        const record = { key, value, revision: expectedRevision + 1 };
        try { store.put(record); next.push(record); }
        catch (error) {
          failure = error instanceof Error ? error : new Error('The session could not be written.');
          transaction.abort();
        }
      };
    }
    transaction.oncomplete = () => {
      for (const record of next) records.set(record.key, record);
      resolve();
    };
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('The session write was interrupted. The previous save is unchanged.'));
    transaction.onerror = () => { /* onabort owns the result */ };
  });

  const ready = (): Promise<void> => initialization ??= (async () => {
    database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = options.indexedDB.open(options.databaseName ?? IDE_SESSION_DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error('Saved-session storage could not be opened.'));
      request.onblocked = () => reject(new Error('Close older RedByte tabs, then reload to open saved-session storage.'));
    });
    for (const record of await readAll()) records.set(record.key, record);
    const migration = new Map<string, string | null>();
    const legacy = options.legacyStorage;
    if (legacy) {
      for (let index = 0; index < legacy.length; index += 1) {
        const key = legacy.key(index);
        if (key && isIdeSessionKey(key) && !records.has(key)) {
          const value = legacy.getItem(key);
          if (value !== null) migration.set(key, value);
        }
      }
    }
    if (migration.size) {
      try { await write(migration); }
      catch (error) {
        // A second tab may have finished this same migration first. Read it and
        // accept only byte-identical values; never replace newer browser data.
        if (!(error instanceof SessionStorageConflict)) throw error;
      }
      const readback = new Map((await readAll()).map(record => [record.key, record]));
      for (const [key, value] of migration) {
        if (readback.get(key)?.value !== value) throw new Error('Legacy session migration could not be verified. The original browser records remain unchanged.');
      }
      for (const record of readback.values()) records.set(record.key, record);
    }
    // Original localStorage bytes are deliberately retained, including malformed
    // records. Only the existing repository decoder decides whether they open.
  })();

  return {
    ready,
    snapshot: () => new Map([...records.values()].flatMap(record => record.value === null ? [] : [[record.key, record.value]])),
    commit(changes) {
      const captured = new Map(changes);
      const pending = writes.then(async () => { await ready(); await write(captured); });
      writes = pending.catch(() => undefined);
      return pending;
    },
  };
}

let browserBackend: SessionStorageBackend | null | undefined;
export function getBrowserSessionStorage(): SessionStorageBackend | null {
  if (browserBackend !== undefined) return browserBackend;
  if (typeof indexedDB === 'undefined') return browserBackend = null;
  let legacyStorage: Storage | null = null;
  try { legacyStorage = localStorage; } catch { /* IndexedDB may still be available. */ }
  return browserBackend = createIndexedDbSessionStorage({ indexedDB, legacyStorage });
}

export type RuntimePersistenceStatus = { state: 'loading' | 'ready' | 'saving' | 'failed'; message: string | null };
let runtimeStatus: RuntimePersistenceStatus = { state: typeof indexedDB === 'undefined' ? 'ready' : 'loading', message: null };
const runtimeListeners = new Set<(status: RuntimePersistenceStatus) => void>();
let runtimePending: Promise<void> = Promise.resolve();
let runtimeFailure: unknown;
let runtimeSequence = 0;
let runtimeHadStoredSession = false;
const runtimeFlushers = new Set<() => Promise<void>>();
const runtimeBusyChecks = new Set<() => boolean>();
const runtimeFailures = new Map<string, unknown>();
const runtimeFailedWrites = new Map<string, { value: string | null; sequence: number }>();
const runtimeLatestWriteSequence = new Map<string, number>();
let runtimeOutstandingWrites = 0;
function reportRuntimeCompletion(): void {
  if (runtimeFailure) {
    reportRuntimeStatus({ state: 'failed', message: runtimeFailure instanceof Error ? runtimeFailure.message : 'The session could not be saved. Download a session backup before closing.' });
    return;
  }
  if (!runtimeFailure && runtimeOutstandingWrites === 0 && [...runtimeBusyChecks].every(check => !check())) {
    reportRuntimeStatus({ state: 'ready', message: null });
  }
}
export const runtimePersistence = {
  getStatus: () => runtimeStatus,
  hasStoredSession: () => runtimeHadStoredSession,
  subscribe(listener: (status: RuntimePersistenceStatus) => void) {
    runtimeListeners.add(listener);
    return () => { runtimeListeners.delete(listener); };
  },
  async flush() {
    let pending: Promise<void>;
    do {
      for (const flush of runtimeFlushers) await flush();
      pending = runtimePending; await pending;
    } while (pending !== runtimePending);
    if (runtimeFailure) throw runtimeFailure;
  },
  async retryFailedWrites() {
    // Drain current captures first, so an explicit Save retries the newest failed
    // bytes for each owner key, including navigation metadata.
    for (const flush of runtimeFlushers) { try { await flush(); } catch { /* retry below */ } }
    for (const [key, failed] of [...runtimeFailedWrites]) {
      // A newer owner write may be in flight, or complete while another key is
      // retried. Check immediately before enqueueing; never replay stale bytes.
      if (runtimeFailedWrites.get(key) !== failed || runtimeLatestWriteSequence.get(key) !== failed.sequence) continue;
      await writeRuntimeValue(key, failed.value);
    }
    await runtimePersistence.flush();
  },
  writeFailed(error: unknown, key = RUNTIME_KEY) {
    runtimeFailures.set(key, error);
    runtimeFailure = error;
    reportRuntimeStatus({ state: 'failed', message: error instanceof Error ? error.message : 'The session could not be saved. Download a session backup before closing.' });
  },
  hydrationFailed(error: unknown) {
    runtimeFailures.set(RUNTIME_KEY, error);
    runtimeFailure = error;
    reportRuntimeStatus({ state: 'failed', message: error instanceof Error ? error.message : 'The saved session is damaged. Its stored bytes have been preserved.' });
  },
};
function reportRuntimeStatus(status: RuntimePersistenceStatus): void {
  runtimeStatus = status;
  for (const listener of runtimeListeners) listener(status);
}

/** Zustand consumes this adapter; its in-memory runtime remains the only state owner. */
export const runtimeSessionStorage = {
  getItem(key: string): string | null | Promise<string | null> {
    const backend = getBrowserSessionStorage();
    if (!backend) {
      const value = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
      if (key === RUNTIME_KEY) runtimeHadStoredSession = value !== null;
      return value;
    }
    return backend.ready().then(() => {
      reportRuntimeStatus({ state: 'ready', message: null });
      const value = backend.snapshot().get(key) ?? null;
      if (key === RUNTIME_KEY) runtimeHadStoredSession = value !== null;
      return value;
    }, error => {
      reportRuntimeStatus({ state: 'failed', message: error instanceof Error ? error.message : 'Saved sessions could not be opened.' });
      throw error;
    });
  },
  setItem(key: string, value: string): void | Promise<void> {
    return writeRuntimeValue(key, value);
  },
  removeItem(key: string): void | Promise<void> {
    return writeRuntimeValue(key, null);
  },
};

function writeRuntimeValue(key: string, value: string | null): void | Promise<void> {
    const backend = getBrowserSessionStorage();
    if (!backend) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); return; }
    const sequence = ++runtimeSequence;
    runtimeLatestWriteSequence.set(key, sequence);
    runtimeOutstandingWrites += 1;
    reportRuntimeStatus({ state: 'saving', message: null });
    const pending = backend.commit(new Map([[key, value]]));
    runtimePending = pending.then(() => {
      runtimeOutstandingWrites -= 1;
      runtimeFailures.delete(key);
      runtimeFailedWrites.delete(key);
      runtimeFailure = runtimeFailures.values().next().value;
      if (sequence === runtimeSequence) reportRuntimeCompletion();
    }, error => {
      runtimeOutstandingWrites -= 1;
      runtimeFailures.set(key, error);
      runtimeFailedWrites.set(key, { value, sequence });
      runtimeFailure = error;
      reportRuntimeStatus({ state: 'failed', message: error instanceof Error ? error.message : 'The working session could not be saved. Download a session backup before closing.' });
    });
    return runtimePending;
}

interface JsonCodec {
  replacer: (key: string, value: unknown) => unknown;
  reviver: (key: string, value: unknown) => unknown;
}

/** One current recovery snapshot may wait behind an in-flight commit. Replacing
 * that pending snapshot does not remove recordings: each runtime snapshot contains
 * the complete retained archive. Immutable recording objects need no duplicate
 * cloning before serialization. This yields the input event before expensive JSON
 * work and prevents selection changes from queuing dozens of identical archives. */
export function createCoalescedJsonStorage<S>(storage: StateStorage, codec: JsonCodec, options: {
  defer: boolean;
  pending?: () => void;
  completed?: () => void;
  failed?: (error: unknown) => void;
}): PersistStorage<S> & { flush(): Promise<void>; isPending(): boolean } {
  let queued: { name: string; value: StorageValue<S> } | null = null;
  let draining: Promise<void> | null = null;
  let failure: unknown;
  const parse = (raw: string | null) => raw === null ? null : JSON.parse(raw, codec.reviver) as StorageValue<S>;
  const drain = (): Promise<void> => {
    if (draining) return draining;
    draining = (async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      try {
        while (queued) {
          const captured = queued; queued = null;
          await storage.setItem(captured.name, JSON.stringify(captured.value, codec.replacer));
        }
        failure = undefined;
      } catch (error) { failure = error; options.failed?.(error); throw error; }
      finally { draining = null; options.completed?.(); }
    })();
    // Zustand does not await fire-and-forget mutations. flush owns error delivery.
    void draining.catch(() => undefined);
    return draining;
  };
  return {
    getItem(name) {
      if (draining) return draining.then(() => storage.getItem(name)).then(parse);
      const value = storage.getItem(name);
      return value instanceof Promise ? value.then(parse) : parse(value);
    },
    setItem(name, value) {
      if (!options.defer) return storage.setItem(name, JSON.stringify(value, codec.replacer));
      queued = { name, value };
      options.pending?.();
      void drain();
    },
    async removeItem(name) { if (draining) await draining; await storage.removeItem(name); },
    async flush() { while (draining || queued) await drain(); if (failure) throw failure; },
    isPending: () => Boolean(draining || queued),
  };
}

export function createRuntimeJsonStorage<S>(codec: JsonCodec): PersistStorage<S> {
  const adapter = createCoalescedJsonStorage<S>(runtimeSessionStorage, codec, {
    defer: getBrowserSessionStorage() !== null,
    pending: () => reportRuntimeStatus({ state: 'saving', message: null }),
    completed: reportRuntimeCompletion,
    failed: error => runtimePersistence.writeFailed(error),
  });
  runtimeFlushers.add(adapter.flush);
  runtimeBusyChecks.add(adapter.isPending);
  return adapter;
}
