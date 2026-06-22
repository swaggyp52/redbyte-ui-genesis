import { digestValue } from '../../utils/digest';

export const PROJECT_RUNTIME_STORAGE_KEY = 'rb.ide.project-runtime.v1';
export const PROJECT_RUNTIME_JOURNAL_KEY = 'rb.ide.project-runtime.v2.journal';
export const PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY = 'rb.ide.project-runtime.v2.lastKnownGood';
export const PROJECT_RUNTIME_RECOVERY_STATUS_KEY = 'rb.ide.project-runtime.v2.recoveryStatus';
export const PROJECT_RECOVERY_POINT_PREFIX = 'rb.ide.project-recovery.v2:';
export const PROJECT_INDEX_STORAGE_KEY = 'rb.ide.projects.v1.index';
export const PROJECT_SNAPSHOT_KEY_PREFIX = 'rb.ide.project.v1:';
export const SESSION_META_STORAGE_KEY = 'rb.ide.sessionMeta.v1';
export const LEGACY_PROJECT_AUTOSAVE_KEY = 'rb-autosave-circuit';
export const LEGACY_DOC_AUTOSAVE_KEY = 'rb-project-autosave';

const FACADE_SCHEMA = 'redbyte.project-storage.facade.v2' as const;
const FACADE_SCHEMA_VERSION = 2 as const;
const MAX_RECOVERY_POINTS_PER_PROJECT = 6;

export type ProjectStoragePayloadKind = 'runtime' | 'snapshot' | 'session' | 'legacy-autosave' | 'index';
export type ProjectStorageSaveStatus = 'ok' | 'conflict' | 'quota' | 'unavailable' | 'error';
export type ProjectStorageLoadStatus =
  | 'ok'
  | 'missing'
  | 'malformed'
  | 'recovered'
  | 'future-schema'
  | 'unavailable';

export interface BrowserStorageLike {
  readonly length?: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
}

export interface ProjectStorageEnvelope {
  schema: typeof FACADE_SCHEMA;
  schemaVersion: typeof FACADE_SCHEMA_VERSION;
  key: string;
  payloadKind: ProjectStoragePayloadKind;
  projectId: string;
  projectName: string;
  revision: number;
  writerId: string;
  savedAtIso: string;
  checksum: string;
  payloadRaw: string;
}

export interface ProjectStorageJournal {
  schema: typeof FACADE_SCHEMA;
  schemaVersion: typeof FACADE_SCHEMA_VERSION;
  status: 'pending' | 'committed' | 'failed';
  key: string;
  payloadKind: ProjectStoragePayloadKind;
  projectId: string;
  projectName: string;
  revision: number;
  writerId: string;
  startedAtIso: string;
  committedAtIso?: string;
  checksum: string;
  errorKind?: ProjectStorageSaveStatus;
}

export interface ProjectStorageSaveResult {
  status: ProjectStorageSaveStatus;
  key: string;
  revision: number;
  checksum: string;
  writerId: string;
  error?: string;
}

export interface ProjectStorageLoadResult {
  status: ProjectStorageLoadStatus;
  key: string;
  payloadRaw: string | null;
  source: 'current' | 'last-known-good' | 'recovery-point' | 'none';
  revision: number;
  projectId: string | null;
  projectName: string | null;
  checksum: string | null;
  error?: string;
}

export interface ProjectStorageHealth {
  schemaVersion: typeof FACADE_SCHEMA_VERSION;
  runtimeStatePresent: boolean;
  lastKnownGoodPresent: boolean;
  pendingJournal: boolean;
  journalStatus: ProjectStorageJournal['status'] | 'missing' | 'malformed';
  recoveryPointCount: number;
  redbyteKeyCount: number;
  approxBytes: number;
  quotaState: 'ok' | 'near-limit' | 'unavailable';
  lastRecoveryStatus: string;
}

export interface ProjectStorageBackup {
  schema: typeof FACADE_SCHEMA;
  schemaVersion: typeof FACADE_SCHEMA_VERSION;
  exportedAtIso: string;
  keys: Record<string, string>;
}

let moduleWriterId: string | null = null;

export function createProjectRuntimeStorage(storage?: BrowserStorageLike) {
  return {
    getItem: (key: string): string | null => loadProject({ key, storage }).payloadRaw,
    setItem: (key: string, value: string): void => {
      const result = saveProject({
        key,
        payloadRaw: value,
        payloadKind: 'runtime',
        storage,
      });
      // Runtime persistence must not crash the editor. Explicit save paths still
      // return failure; the event emitted by saveProject drives the recovery UI.
    },
    removeItem: (key: string): void => {
      const target = resolveStorage(storage);
      if (!target) return;
      try {
        target.removeItem(key);
      } catch {
        // Zustand treats remove failures as non-recoverable; keep removal best-effort.
      }
    },
  };
}

export function saveProject(input: {
  key?: string;
  payloadRaw: string;
  payloadKind?: ProjectStoragePayloadKind;
  storage?: BrowserStorageLike;
  writerId?: string;
  expectedRevision?: number | null;
  projectId?: string | null;
  projectName?: string | null;
  savedAtIso?: string;
}): ProjectStorageSaveResult {
  const key = input.key ?? PROJECT_RUNTIME_STORAGE_KEY;
  const storage = resolveStorage(input.storage);
  const writerId = input.writerId ?? getProjectStorageWriterId();
  const checksum = digestValue(input.payloadRaw);
  if (!storage) {
    notifyProjectStorageFailure({ key, status: 'unavailable', writerId });
    return { status: 'unavailable', key, revision: 0, checksum, writerId };
  }

  const currentRevision = getLatestRevision(storage, key);
  const expectedRevision = input.expectedRevision ?? null;
  if (
    expectedRevision !== null &&
    currentRevision > expectedRevision &&
    getLatestWriterId(storage, key) !== writerId
  ) {
    notifyProjectStorageFailure({ key, status: 'conflict', writerId });
    return { status: 'conflict', key, revision: currentRevision, checksum, writerId };
  }

  const meta = readPayloadMeta(input.payloadRaw);
  const revision = currentRevision + 1;
  const savedAtIso = input.savedAtIso ?? new Date().toISOString();
  const envelope: ProjectStorageEnvelope = {
    schema: FACADE_SCHEMA,
    schemaVersion: FACADE_SCHEMA_VERSION,
    key,
    payloadKind: input.payloadKind ?? 'runtime',
    projectId: normalizeStorageLabel(input.projectId ?? meta.projectId, 'unknown-project'),
    projectName: normalizeStorageLabel(input.projectName ?? meta.projectName, 'Untitled Project'),
    revision,
    writerId,
    savedAtIso,
    checksum,
    payloadRaw: input.payloadRaw,
  };
  const pendingJournal: ProjectStorageJournal = {
    schema: FACADE_SCHEMA,
    schemaVersion: FACADE_SCHEMA_VERSION,
    status: 'pending',
    key,
    payloadKind: envelope.payloadKind,
    projectId: envelope.projectId,
    projectName: envelope.projectName,
    revision,
    writerId,
    startedAtIso: savedAtIso,
    checksum,
  };

  try {
    storage.setItem(PROJECT_RUNTIME_JOURNAL_KEY, JSON.stringify(pendingJournal));
    storage.setItem(key, input.payloadRaw);
    if (key === PROJECT_RUNTIME_STORAGE_KEY) {
      storage.setItem(PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY, JSON.stringify(envelope));
      writeRecoveryPoint(storage, envelope);
    }
    const committedJournal: ProjectStorageJournal = {
      ...pendingJournal,
      status: 'committed',
      committedAtIso: new Date().toISOString(),
    };
    storage.setItem(PROJECT_RUNTIME_JOURNAL_KEY, JSON.stringify(committedJournal));
    return { status: 'ok', key, revision, checksum, writerId };
  } catch (error) {
    const status = classifyStorageError(error);
    try {
      const failedJournal: ProjectStorageJournal = {
        ...pendingJournal,
        status: 'failed',
        errorKind: status,
      };
      storage.setItem(PROJECT_RUNTIME_JOURNAL_KEY, JSON.stringify(failedJournal));
    } catch {
      // If quota blocks even the failed journal, the current pending journal remains the signal.
    }
    notifyProjectStorageFailure({ key, status, writerId, error });
    return {
      status,
      key,
      revision,
      checksum,
      writerId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function loadProject(input: {
  key?: string;
  storage?: BrowserStorageLike;
} = {}): ProjectStorageLoadResult {
  const key = input.key ?? PROJECT_RUNTIME_STORAGE_KEY;
  const storage = resolveStorage(input.storage);
  if (!storage) {
    return emptyLoadResult(key, 'unavailable');
  }

  const currentRaw = safeGetItem(storage, key);
  if (typeof currentRaw === 'string' && isValidStoragePayloadRaw(currentRaw)) {
    const meta = readPayloadMeta(currentRaw);
    return {
      status: 'ok',
      key,
      payloadRaw: currentRaw,
      source: 'current',
      revision: getLatestRevision(storage, key),
      projectId: meta.projectId,
      projectName: meta.projectName,
      checksum: digestValue(currentRaw),
    };
  }

  const lastKnownGood = readEnvelope(storage, PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY);
  if (lastKnownGood.status === 'future-schema') {
    return emptyLoadResult(key, 'future-schema', 'Last-known-good storage uses a newer schema.');
  }
  if (lastKnownGood.envelope?.key === key && isValidStoragePayloadRaw(lastKnownGood.envelope.payloadRaw)) {
    recordRecoveryStatus(storage, {
      status: 'recovered',
      source: 'last-known-good',
      key,
      projectId: lastKnownGood.envelope.projectId,
      projectName: lastKnownGood.envelope.projectName,
      revision: lastKnownGood.envelope.revision,
    });
    return {
      status: 'recovered',
      key,
      payloadRaw: lastKnownGood.envelope.payloadRaw,
      source: 'last-known-good',
      revision: lastKnownGood.envelope.revision,
      projectId: lastKnownGood.envelope.projectId,
      projectName: lastKnownGood.envelope.projectName,
      checksum: lastKnownGood.envelope.checksum,
    };
  }

  const recovery = listRecoveryPoints({ storage })
    .filter((point) => point.key === key && isValidStoragePayloadRaw(point.payloadRaw))
    .sort((left, right) => right.revision - left.revision)[0];
  if (recovery) {
    recordRecoveryStatus(storage, {
      status: 'recovered',
      source: 'recovery-point',
      key,
      projectId: recovery.projectId,
      projectName: recovery.projectName,
      revision: recovery.revision,
    });
    return {
      status: 'recovered',
      key,
      payloadRaw: recovery.payloadRaw,
      source: 'recovery-point',
      revision: recovery.revision,
      projectId: recovery.projectId,
      projectName: recovery.projectName,
      checksum: recovery.checksum,
    };
  }

  if (typeof currentRaw === 'string') {
    recordRecoveryStatus(storage, {
      status: 'malformed',
      source: 'none',
      key,
      projectId: null,
      projectName: null,
      revision: 0,
    });
    return emptyLoadResult(key, 'malformed', 'Current project storage is malformed and no recovery point exists.');
  }

  return emptyLoadResult(key, 'missing');
}

export function saveSnapshot(input: {
  projectId: string;
  projectName: string;
  projectHash: string;
  snapshotRaw: string;
  storage?: BrowserStorageLike;
}): ProjectStorageSaveResult {
  const projectId = input.projectId.trim();
  return saveProject({
    key: buildProjectStorageKey(projectId),
    payloadRaw: input.snapshotRaw,
    payloadKind: 'snapshot',
    projectId,
    projectName: input.projectName,
    storage: input.storage,
  });
}

export function saveProjectIndex(rawIndex: string, storage?: BrowserStorageLike): ProjectStorageSaveResult {
  return saveProject({
    key: PROJECT_INDEX_STORAGE_KEY,
    payloadRaw: rawIndex,
    payloadKind: 'index',
    projectId: 'project-index',
    projectName: 'Saved Projects Index',
    storage,
  });
}

export function buildProjectStorageKey(projectId: string): string {
  return `${PROJECT_SNAPSHOT_KEY_PREFIX}${projectId.trim()}`;
}

export function saveSessionMetaRaw(raw: string, storage?: BrowserStorageLike): ProjectStorageSaveResult {
  const meta = readSessionMeta(raw);
  return saveProject({
    key: SESSION_META_STORAGE_KEY,
    payloadRaw: raw,
    payloadKind: 'session',
    projectId: meta.projectId,
    projectName: meta.currentMode ? `Session ${meta.currentMode}` : 'Session metadata',
    storage,
  });
}

export function loadSessionMetaRaw(storage?: BrowserStorageLike): string | null {
  return safeGetItem(resolveStorage(storage), SESSION_META_STORAGE_KEY);
}

export function clearSessionMeta(storage?: BrowserStorageLike): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(SESSION_META_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

export function saveLegacyAutosaveRaw(raw: string, storage?: BrowserStorageLike): ProjectStorageSaveResult {
  const meta = readPayloadMeta(raw);
  return saveProject({
    key: LEGACY_PROJECT_AUTOSAVE_KEY,
    payloadRaw: raw,
    payloadKind: 'legacy-autosave',
    projectId: meta.projectId,
    projectName: meta.projectName,
    storage,
  });
}

export function loadLegacyAutosaveRaw(storage?: BrowserStorageLike): string | null {
  return safeGetItem(resolveStorage(storage), LEGACY_PROJECT_AUTOSAVE_KEY);
}

export function clearLegacyAutosave(storage?: BrowserStorageLike): void {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(LEGACY_PROJECT_AUTOSAVE_KEY);
  } catch {
    // Best effort only.
  }
}

export function listRecoveryPoints(input: {
  storage?: BrowserStorageLike;
  projectId?: string | null;
} = {}): ProjectStorageEnvelope[] {
  const storage = resolveStorage(input.storage);
  if (!storage) return [];
  return listStorageKeys(storage)
    .filter((key) => key.startsWith(PROJECT_RECOVERY_POINT_PREFIX))
    .map((key) => readEnvelope(storage, key).envelope)
    .filter((point): point is ProjectStorageEnvelope => {
      if (!point) return false;
      if (input.projectId && point.projectId !== input.projectId) return false;
      return true;
    })
    .sort((left, right) => right.revision - left.revision);
}

export function restoreRecoveryPoint(input: {
  recoveryKey: string;
  storage?: BrowserStorageLike;
}): ProjectStorageLoadResult {
  const storage = resolveStorage(input.storage);
  if (!storage) return emptyLoadResult(PROJECT_RUNTIME_STORAGE_KEY, 'unavailable');
  const point = readEnvelope(storage, input.recoveryKey).envelope;
  if (!point) return emptyLoadResult(PROJECT_RUNTIME_STORAGE_KEY, 'missing');
  try {
    storage.setItem(point.key, point.payloadRaw);
    recordRecoveryStatus(storage, {
      status: 'recovered',
      source: 'recovery-point',
      key: point.key,
      projectId: point.projectId,
      projectName: point.projectName,
      revision: point.revision,
    });
  } catch (error) {
    notifyProjectStorageFailure({ key: point.key, status: classifyStorageError(error), writerId: point.writerId, error });
  }
  return {
    status: 'recovered',
    key: point.key,
    payloadRaw: point.payloadRaw,
    source: 'recovery-point',
    revision: point.revision,
    projectId: point.projectId,
    projectName: point.projectName,
    checksum: point.checksum,
  };
}

export function exportProjectBackup(storage?: BrowserStorageLike): string {
  const target = resolveStorage(storage);
  const backup: ProjectStorageBackup = {
    schema: FACADE_SCHEMA,
    schemaVersion: FACADE_SCHEMA_VERSION,
    exportedAtIso: new Date().toISOString(),
    keys: {},
  };
  if (!target) return JSON.stringify(backup, null, 2);
  for (const key of listStorageKeys(target)) {
    if (isProjectStorageKey(key)) {
      const raw = safeGetItem(target, key);
      if (typeof raw === 'string') backup.keys[key] = raw;
    }
  }
  return JSON.stringify(backup, null, 2);
}

export function importProjectBackup(rawBackup: string, storage?: BrowserStorageLike): {
  restoredKeys: number;
  status: 'ok' | 'invalid' | 'future-schema' | 'unavailable';
} {
  const target = resolveStorage(storage);
  if (!target) return { restoredKeys: 0, status: 'unavailable' };
  let parsed: Partial<ProjectStorageBackup>;
  try {
    parsed = JSON.parse(rawBackup) as Partial<ProjectStorageBackup>;
  } catch {
    return { restoredKeys: 0, status: 'invalid' };
  }
  if (parsed.schema !== FACADE_SCHEMA || typeof parsed.schemaVersion !== 'number') {
    return { restoredKeys: 0, status: 'invalid' };
  }
  if (parsed.schemaVersion > FACADE_SCHEMA_VERSION) {
    return { restoredKeys: 0, status: 'future-schema' };
  }
  if (!parsed.keys || typeof parsed.keys !== 'object') {
    return { restoredKeys: 0, status: 'invalid' };
  }
  let restoredKeys = 0;
  for (const [key, value] of Object.entries(parsed.keys)) {
    if (!isProjectStorageKey(key) || typeof value !== 'string') continue;
    target.setItem(key, value);
    restoredKeys += 1;
  }
  return { restoredKeys, status: 'ok' };
}

export function getProjectStorageHealth(storage?: BrowserStorageLike): ProjectStorageHealth {
  const target = resolveStorage(storage);
  if (!target) {
    return {
      schemaVersion: FACADE_SCHEMA_VERSION,
      runtimeStatePresent: false,
      lastKnownGoodPresent: false,
      pendingJournal: false,
      journalStatus: 'missing',
      recoveryPointCount: 0,
      redbyteKeyCount: 0,
      approxBytes: 0,
      quotaState: 'unavailable',
      lastRecoveryStatus: 'unavailable',
    };
  }

  const keys = listStorageKeys(target).filter(isRedByteStorageKey);
  const journal = readJournal(target);
  const approxBytes = keys.reduce((total, key) => {
    const value = safeGetItem(target, key);
    return total + key.length + (value?.length ?? 0);
  }, 0);
  return {
    schemaVersion: FACADE_SCHEMA_VERSION,
    runtimeStatePresent: Boolean(safeGetItem(target, PROJECT_RUNTIME_STORAGE_KEY)),
    lastKnownGoodPresent: Boolean(readEnvelope(target, PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY).envelope),
    pendingJournal: journal?.status === 'pending',
    journalStatus: journal?.status ?? (safeGetItem(target, PROJECT_RUNTIME_JOURNAL_KEY) ? 'malformed' : 'missing'),
    recoveryPointCount: listRecoveryPoints({ storage: target }).length,
    redbyteKeyCount: keys.length,
    approxBytes,
    quotaState: approxBytes > 4_000_000 ? 'near-limit' : 'ok',
    lastRecoveryStatus: safeGetItem(target, PROJECT_RUNTIME_RECOVERY_STATUS_KEY) ?? 'none',
  };
}

export function subscribeToExternalChanges(
  callback: (event: StorageEvent) => void,
  key = PROJECT_RUNTIME_STORAGE_KEY
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage) return;
    if (event.key !== key) return;
    if (!event.newValue || event.newValue === event.oldValue) return;
    callback(event);
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

export function acquireWriteLease(input: {
  key?: string;
  writerId?: string;
  storage?: BrowserStorageLike;
} = {}): { writerId: string; revision: number } {
  const key = input.key ?? PROJECT_RUNTIME_STORAGE_KEY;
  const storage = resolveStorage(input.storage);
  const writerId = input.writerId ?? getProjectStorageWriterId();
  return {
    writerId,
    revision: storage ? getLatestRevision(storage, key) : 0,
  };
}

export function readExternalRuntimeProjectLabel(raw: string): string | null {
  return readPayloadMeta(raw).projectName;
}

export function getProjectStorageWriterId(): string {
  if (moduleWriterId) return moduleWriterId;
  const key = 'rb.ide.project-storage.writer.v2';
  try {
    if (typeof sessionStorage !== 'undefined') {
      const existing = sessionStorage.getItem(key);
      if (existing) {
        moduleWriterId = existing;
        return existing;
      }
      moduleWriterId = makeWriterId();
      sessionStorage.setItem(key, moduleWriterId);
      return moduleWriterId;
    }
  } catch {
    // Fall back to an in-memory writer id.
  }
  moduleWriterId = makeWriterId();
  return moduleWriterId;
}

function writeRecoveryPoint(storage: BrowserStorageLike, envelope: ProjectStorageEnvelope): void {
  const recoveryKey = `${PROJECT_RECOVERY_POINT_PREFIX}${envelope.projectId}:${String(envelope.revision).padStart(8, '0')}`;
  storage.setItem(recoveryKey, JSON.stringify(envelope));

  const older = listRecoveryPoints({ storage, projectId: envelope.projectId })
    .filter((point) => `${PROJECT_RECOVERY_POINT_PREFIX}${point.projectId}:${String(point.revision).padStart(8, '0')}` !== recoveryKey)
    .slice(MAX_RECOVERY_POINTS_PER_PROJECT - 1);
  for (const point of older) {
    try {
      storage.removeItem(`${PROJECT_RECOVERY_POINT_PREFIX}${point.projectId}:${String(point.revision).padStart(8, '0')}`);
    } catch {
      // Best effort cleanup.
    }
  }
}

function readEnvelope(storage: BrowserStorageLike, key: string): {
  envelope: ProjectStorageEnvelope | null;
  status: 'ok' | 'missing' | 'malformed' | 'future-schema';
} {
  const raw = safeGetItem(storage, key);
  if (!raw) return { envelope: null, status: 'missing' };
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectStorageEnvelope>;
    if (parsed.schema !== FACADE_SCHEMA || typeof parsed.schemaVersion !== 'number') {
      return { envelope: null, status: 'malformed' };
    }
    if (parsed.schemaVersion > FACADE_SCHEMA_VERSION) {
      return { envelope: null, status: 'future-schema' };
    }
    if (parsed.schemaVersion !== FACADE_SCHEMA_VERSION) {
      return { envelope: null, status: 'malformed' };
    }
    if (
      typeof parsed.key !== 'string' ||
      typeof parsed.payloadRaw !== 'string' ||
      typeof parsed.projectId !== 'string' ||
      typeof parsed.projectName !== 'string' ||
      typeof parsed.revision !== 'number' ||
      typeof parsed.writerId !== 'string' ||
      typeof parsed.savedAtIso !== 'string' ||
      typeof parsed.checksum !== 'string'
    ) {
      return { envelope: null, status: 'malformed' };
    }
    if (digestValue(parsed.payloadRaw) !== parsed.checksum) {
      return { envelope: null, status: 'malformed' };
    }
    return { envelope: parsed as ProjectStorageEnvelope, status: 'ok' };
  } catch {
    return { envelope: null, status: 'malformed' };
  }
}

function readJournal(storage: BrowserStorageLike): ProjectStorageJournal | null {
  const raw = safeGetItem(storage, PROJECT_RUNTIME_JOURNAL_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectStorageJournal>;
    if (parsed.schema !== FACADE_SCHEMA || parsed.schemaVersion !== FACADE_SCHEMA_VERSION) return null;
    if (parsed.status !== 'pending' && parsed.status !== 'committed' && parsed.status !== 'failed') return null;
    if (typeof parsed.key !== 'string' || typeof parsed.revision !== 'number') return null;
    return parsed as ProjectStorageJournal;
  } catch {
    return null;
  }
}

function getLatestRevision(storage: BrowserStorageLike, key: string): number {
  const journal = readJournal(storage);
  const journalRevision = journal?.key === key ? journal.revision : 0;
  const lastKnownGood = readEnvelope(storage, PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY).envelope;
  const lkgRevision = lastKnownGood?.key === key ? lastKnownGood.revision : 0;
  return Math.max(journalRevision, lkgRevision, 0);
}

function getLatestWriterId(storage: BrowserStorageLike, key: string): string | null {
  const journal = readJournal(storage);
  if (journal?.key === key) return journal.writerId;
  const lastKnownGood = readEnvelope(storage, PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY).envelope;
  return lastKnownGood?.key === key ? lastKnownGood.writerId : null;
}

function recordRecoveryStatus(
  storage: BrowserStorageLike,
  status: {
    status: ProjectStorageLoadStatus;
    source: ProjectStorageLoadResult['source'];
    key: string;
    projectId: string | null;
    projectName: string | null;
    revision: number;
  }
): void {
  try {
    storage.setItem(
      PROJECT_RUNTIME_RECOVERY_STATUS_KEY,
      JSON.stringify({
        schema: FACADE_SCHEMA,
        schemaVersion: FACADE_SCHEMA_VERSION,
        atIso: new Date().toISOString(),
        ...status,
      })
    );
  } catch {
    // Recovery status is support metadata only.
  }
}

function readPayloadMeta(raw: string): { projectId: string | null; projectName: string | null } {
  try {
    const parsed = JSON.parse(raw) as {
      name?: unknown;
      meta?: { projectId?: unknown };
      state?: { projectId?: unknown; projectName?: unknown };
      projectId?: unknown;
      projectName?: unknown;
    };
    const state = parsed && typeof parsed === 'object' ? parsed.state : undefined;
    return {
      projectId:
        typeof state?.projectId === 'string'
          ? state.projectId
          : typeof parsed?.meta?.projectId === 'string'
            ? parsed.meta.projectId
            : typeof parsed?.projectId === 'string'
              ? parsed.projectId
              : null,
      projectName:
        typeof state?.projectName === 'string'
          ? state.projectName
          : typeof parsed?.name === 'string'
            ? parsed.name
            : typeof parsed?.projectName === 'string'
              ? parsed.projectName
              : null,
    };
  } catch {
    return { projectId: null, projectName: null };
  }
}

function readSessionMeta(raw: string): { projectId: string | null; currentMode: string | null } {
  try {
    const parsed = JSON.parse(raw) as { projectId?: unknown; currentMode?: unknown };
    return {
      projectId: typeof parsed.projectId === 'string' ? parsed.projectId : null,
      currentMode: typeof parsed.currentMode === 'string' ? parsed.currentMode : null,
    };
  } catch {
    return { projectId: null, currentMode: null };
  }
}

function isValidStoragePayloadRaw(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

function emptyLoadResult(
  key: string,
  status: ProjectStorageLoadStatus,
  error?: string
): ProjectStorageLoadResult {
  return {
    status,
    key,
    payloadRaw: null,
    source: 'none',
    revision: 0,
    projectId: null,
    projectName: null,
    checksum: null,
    error,
  };
}

function resolveStorage(storage?: BrowserStorageLike | null): BrowserStorageLike | null {
  if (storage) return storage;
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

function safeGetItem(storage: BrowserStorageLike | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function listStorageKeys(storage: BrowserStorageLike): string[] {
  const keys = new Set<string>();
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) keys.add(key);
    }
  }
  if (typeof Object.keys === 'function') {
    for (const key of Object.keys(storage as object)) {
      keys.add(key);
    }
  }
  return [...keys].sort();
}

function isRedByteStorageKey(key: string): boolean {
  return key.startsWith('rb.') || key.startsWith('rb-');
}

function isProjectStorageKey(key: string): boolean {
  return (
    key === PROJECT_RUNTIME_STORAGE_KEY ||
    key === PROJECT_RUNTIME_JOURNAL_KEY ||
    key === PROJECT_RUNTIME_LAST_KNOWN_GOOD_KEY ||
    key === PROJECT_RUNTIME_RECOVERY_STATUS_KEY ||
    key === PROJECT_INDEX_STORAGE_KEY ||
    key === SESSION_META_STORAGE_KEY ||
    key === LEGACY_PROJECT_AUTOSAVE_KEY ||
    key === LEGACY_DOC_AUTOSAVE_KEY ||
    key.startsWith(PROJECT_SNAPSHOT_KEY_PREFIX) ||
    key.startsWith(PROJECT_RECOVERY_POINT_PREFIX)
  );
}

function classifyStorageError(error: unknown): ProjectStorageSaveStatus {
  const candidate = error as { name?: string; code?: number };
  if (
    candidate?.name === 'QuotaExceededError' ||
    candidate?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    candidate?.code === 22 ||
    candidate?.code === 1014
  ) {
    return 'quota';
  }
  return 'error';
}

function notifyProjectStorageFailure(input: {
  key: string;
  status: ProjectStorageSaveStatus;
  writerId: string;
  error?: unknown;
}): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(
    new CustomEvent('redbyte:project-storage-failure', {
      detail: {
        key: input.key,
        status: input.status,
        writerId: input.writerId,
        message: input.error instanceof Error ? input.error.message : undefined,
      },
    })
  );
}

function normalizeStorageLabel(value: string | null | undefined, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || fallback;
}

function makeWriterId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to deterministic-ish local id.
  }
  return `writer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
