/**
 * A held IndexedDB stand-in for navigation-race tests (the held-fixture backend pattern of
 * durableProjectStorage.test.ts, extended to several documents).
 *
 * The disk is what survives a navigation. Each document opens its own connection; commits on
 * one connection run first-in first-out, as the IndexedDB backend's write chain does. A
 * connection can hold the commits that touch chosen records, fail the next one, or unload: a
 * commit that has not landed when its document unloads never lands, as a browser does with
 * the transactions of a page it has left.
 */
import { vi } from 'vitest';
import type { SessionStorageBackend } from '../durableProjectStorage';
import type { RBProject } from '../../../export/projectFormat';

export const RUNTIME_RECORD = 'rb.ide.project-runtime.v1';
export const SESSION_META_RECORD = 'rb.ide.sessionMeta.v1';

type KeyMatch = (key: string) => boolean;

export interface DocumentConnection {
  readonly backend: SessionStorageBackend;
  /** Holds every commit touching a matching record until the returned release is called. */
  hold(match: KeyMatch): () => void;
  /** The next commit touching a matching record rejects; nothing in it lands. */
  failNext(match: KeyMatch, error?: unknown): void;
  /** The document goes away. Commits that have not landed never will. */
  unload(): void;
  /** The records of each commit that landed, in landing order. */
  readonly landed: string[][];
}

export interface SessionDisk {
  readonly values: Map<string, string>;
  readonly revisions: Map<string, number>;
  open(): DocumentConnection;
  runtime(): { projectId: string; projectName: string } | null;
  meta(): { projectId: string; currentMode?: string; runtimeRevision?: number } | null;
}

export function createSessionDisk(): SessionDisk {
  const values = new Map<string, string>();
  const revisions = new Map<string, number>();
  const read = (key: string) => {
    const raw = values.get(key);
    return raw === undefined ? null : JSON.parse(raw);
  };
  return {
    values,
    revisions,
    open() {
      let chain: Promise<unknown> = Promise.resolve();
      let gate: { match: KeyMatch; wait: Promise<void> } | null = null;
      let failure: { match: KeyMatch; error: unknown } | null = null;
      let unloaded = false;
      const never = new Promise<never>(() => undefined);
      const landed: string[][] = [];
      const backend: SessionStorageBackend = {
        async ready() {},
        snapshot: () => new Map(values),
        revision: (key: string) => revisions.get(key) ?? 0,
        commit(changes) {
          const captured = new Map(changes);
          const keys = [...captured.keys()];
          const run = chain.then(async () => {
            if (unloaded) return never;
            const held = gate && keys.some(gate.match) ? gate.wait : null;
            if (held) await held;
            if (unloaded) return never;
            if (failure && keys.some(failure.match)) {
              const { error } = failure;
              failure = null;
              throw error;
            }
            for (const [key, value] of captured) {
              if (value === null) values.delete(key);
              else values.set(key, value);
              revisions.set(key, (revisions.get(key) ?? 0) + 1);
            }
            landed.push(keys);
          });
          chain = run.catch(() => undefined);
          return run as Promise<void>;
        },
      } as SessionStorageBackend;
      return {
        backend,
        landed,
        hold(match) {
          let release = () => {};
          const wait = new Promise<void>((resolve) => { release = resolve; });
          const current = { match, wait };
          gate = current;
          return () => {
            if (gate === current) gate = null;
            release();
          };
        },
        failNext(match, error = new DOMException('Controlled quota failure', 'QuotaExceededError')) {
          failure = { match, error };
        },
        unload() { unloaded = true; },
      };
    },
    runtime() {
      const record = read(RUNTIME_RECORD);
      return record?.state ? { projectId: record.state.projectId, projectName: record.state.projectName } : null;
    },
    meta() {
      return read(SESSION_META_RECORD);
    },
  };
}

/** Lets deferred work run: the runtime adapter yields one task before it serializes. */
export async function settle(rounds = 3): Promise<void> {
  for (let round = 0; round < rounds; round += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Opens a fresh document on the disk: a new module graph (stores, persistence and repository
 * are module singletons), with browser storage reported present so the hosts wait for it.
 */
export async function openRuntimeDocument(disk: SessionDisk) {
  const connection = disk.open();
  vi.resetModules();
  vi.stubGlobal('indexedDB', {});
  const storage = await import('../durableProjectStorage');
  storage._setBrowserSessionStorageForTests(connection.backend);
  const { useProjectRuntime } = await import('../projectRuntime');
  const labSession = await import('../persistence/labSession');
  const { projectRepository } = await import('../projectRepository');
  await projectRepository.ready();
  if (!useProjectRuntime.persist.hasHydrated()) await useProjectRuntime.persist.rehydrate();
  return { connection, storage, persistence: storage.runtimePersistence, useProjectRuntime, labSession, projectRepository };
}

export type RuntimeDocument = Awaited<ReturnType<typeof openRuntimeDocument>>;

export function lifecycleProject(projectId: string, name: string, stem: string): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    name,
    circuit: {
      nodes: [
        { id: `${stem}_input`, type: 'INPUT', label: 'A', x: 0, y: 0 },
        { id: `${stem}_output`, type: 'OUTPUT', label: 'Y', x: 200, y: 0 },
      ],
      connections: [
        { from: { nodeId: `${stem}_input`, portName: 'out' }, to: { nodeId: `${stem}_output`, portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'a', nodeId: `${stem}_input`, port: 'out', label: 'A', pin: 'V17' }],
      outputs: [{ id: 'y', nodeId: `${stem}_output`, port: 'in', label: 'Y', pin: 'U16' }],
    },
    vectors: [{ tick: 0, inputs: { a: 1 }, expected: { y: 1 } }],
    meta: { projectId, projectKind: 'custom', scenarioAuthority: 'authored' },
  } as RBProject;
}

export const PROJECT_A = lifecycleProject('rb-durable-a', 'Stored Project A', 'stored_a');
export const PROJECT_B = lifecycleProject('rb-durable-b', 'Imported Project B', 'imported_b');

/** The session metadata the workbench writes for the open project (IdeApp's sessionMetaRef). */
export function metaFor(doc: RuntimeDocument, currentMode = 'design') {
  const state = doc.useProjectRuntime.getState();
  return {
    version: 1 as const,
    savedAt: Date.now(),
    projectId: state.projectId,
    currentMode,
    activeExampleId: state.activeExampleId ?? null,
    projectKind: state.projectKind,
    sourceExampleId: state.sourceExampleId,
    scenarioAuthority: state.scenarioAuthority,
    probedKeys: [],
  };
}

/** A disk on which project A is the stored working session, its metadata and its saved record. */
export async function diskWithStoredProject(project: RBProject = PROJECT_A): Promise<SessionDisk> {
  const disk = createSessionDisk();
  const setup = await openRuntimeDocument(disk);
  setup.useProjectRuntime.getState().loadFromProject(project);
  setup.labSession.saveLabSessionMeta(metaFor(setup));
  const state = setup.useProjectRuntime.getState();
  const saved = await setup.projectRepository.save({
    projectId: state.projectId,
    projectName: state.projectName,
    projectHash: `hash-${state.projectId}`,
    project,
  });
  if (!saved.ok) throw new Error(saved.error.message);
  await setup.persistence.flush();
  setup.connection.unload();
  if (disk.runtime()?.projectId !== project.meta?.projectId) throw new Error('fixture: the stored session does not name the seeded project');
  return disk;
}
