import type { RBProject } from '../../export/projectFormat';
import { encodeRBProject } from '../../export/projectFormat';
import { compareCodepoint } from '../../export/codepointSort';
import type { VerifyScenario } from './verifyScenario';
import {
  buildProjectStorageKey,
  decodePersistedIdeProject,
  IDE_PROJECT_INDEX_KEY,
  IDE_PROJECT_KEY_PREFIX,
  IDE_PROJECT_STORAGE_VERSION,
  normalizeProjectIndexEntry,
  parsePersistedIdeProjectSnapshot,
  type PersistedIdeProjectIndexEntry,
  type PersistedIdeProjectSnapshot,
  type PersistedIdeRunEvidence,
} from './projectPersistence';

/**
 * ProjectRepository is the single Milestone A persistence boundary for the IDE.
 *
 * Its browser-local implementation deliberately keeps the established
 * `rb.ide.projects.v1.index` and `rb.ide.project.v1:<projectId>` records. This
 * facade adds explicit operation/error/recovery contracts without creating a
 * competing store or changing the portable RBProject payload.
 */
export const PROJECT_REPOSITORY_VERSION = 1 as const;

export const PROJECT_REPOSITORY_STORAGE_LOCATION = {
  kind: 'browser-local',
  label: 'This browser on this device',
  backing: 'localStorage',
} as const;

export type ProjectRepositoryOperation =
  | 'list'
  | 'open'
  | 'save'
  | 'autosave'
  | 'checkpoint'
  | 'recover';

export type ProjectRepositoryErrorCode =
  | 'storage-unavailable'
  | 'storage-access-denied'
  | 'invalid-project-id'
  | 'invalid-project-payload'
  | 'not-found'
  | 'corrupt-index'
  | 'corrupt-snapshot'
  | 'unsupported-version'
  | 'decode-failed'
  | 'quota-exceeded'
  | 'write-failed'
  | 'recovery-superseded';

export interface ProjectRepositoryError {
  version: typeof PROJECT_REPOSITORY_VERSION;
  operation: ProjectRepositoryOperation;
  code: ProjectRepositoryErrorCode;
  message: string;
  recoverable: boolean;
  projectId?: string;
}

export type ProjectRepositoryResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: ProjectRepositoryError;
    };

export interface ProjectRepositorySaveInput {
  projectId: string;
  projectName: string;
  projectHash: string;
  project: RBProject;
  scenarios?: VerifyScenario[];
  activeScenarioId?: string;
  /** This project's own run evidence, so reopening it restores the trace, not just a row. */
  runEvidence?: PersistedIdeRunEvidence;
  savedAtIso?: string;
}

export interface ProjectRepositorySaveValue {
  version: typeof PROJECT_REPOSITORY_VERSION;
  operation: 'save' | 'autosave' | 'checkpoint';
  snapshot: PersistedIdeProjectSnapshot;
  warnings: ProjectRepositoryError[];
  storageLocation: typeof PROJECT_REPOSITORY_STORAGE_LOCATION;
}

export interface ProjectRepositoryOpenValue {
  version: typeof PROJECT_REPOSITORY_VERSION;
  snapshot: PersistedIdeProjectSnapshot;
  project: RBProject;
  storageLocation: typeof PROJECT_REPOSITORY_STORAGE_LOCATION;
}

export interface ProjectRepositoryListValue {
  version: typeof PROJECT_REPOSITORY_VERSION;
  projects: PersistedIdeProjectIndexEntry[];
  warnings: ProjectRepositoryError[];
  storageLocation: typeof PROJECT_REPOSITORY_STORAGE_LOCATION;
}

/**
 * A checkpoint is a pointer to the exact canonical snapshot written before a
 * project-identity replacement. It is not a history stack. If another write
 * supersedes that snapshot, recovery fails explicitly instead of opening newer
 * data under an older checkpoint label.
 */
export interface ProjectRecoveryCheckpoint {
  version: typeof PROJECT_REPOSITORY_VERSION;
  projectId: string;
  projectHash: string;
  savedAtIso: string;
  reason: string;
  storageLocation: typeof PROJECT_REPOSITORY_STORAGE_LOCATION;
}

export type ProjectRepositorySaveState =
  | 'idle'
  | 'saving'
  | 'autosaving'
  | 'saved'
  | 'save-failed';

export interface ProjectRepositoryState {
  version: typeof PROJECT_REPOSITORY_VERSION;
  availability: 'ready' | 'degraded' | 'unavailable';
  saveState: ProjectRepositorySaveState;
  lastSavedAtIso: string | null;
  storageLocation: typeof PROJECT_REPOSITORY_STORAGE_LOCATION;
  recoveryAvailable: boolean;
  recoveryCheckpoint: ProjectRecoveryCheckpoint | null;
  lastError: ProjectRepositoryError | null;
}

export interface ProjectRepositoryStorage {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export interface ProjectRepositoryOptions {
  storage?: ProjectRepositoryStorage | null;
  now?: () => Date;
}

export interface ProjectRepository {
  readonly version: typeof PROJECT_REPOSITORY_VERSION;
  readonly storageLocation: typeof PROJECT_REPOSITORY_STORAGE_LOCATION;
  getState(): ProjectRepositoryState;
  subscribe(listener: (state: ProjectRepositoryState) => void): () => void;
  list(): ProjectRepositoryResult<ProjectRepositoryListValue>;
  open(projectId: string): ProjectRepositoryResult<ProjectRepositoryOpenValue>;
  save(input: ProjectRepositorySaveInput): ProjectRepositoryResult<ProjectRepositorySaveValue>;
  autosave(input: ProjectRepositorySaveInput): ProjectRepositoryResult<ProjectRepositorySaveValue>;
  checkpoint(
    input: ProjectRepositorySaveInput,
    reason?: string
  ): ProjectRepositoryResult<ProjectRecoveryCheckpoint>;
  recover(
    checkpoint: ProjectRecoveryCheckpoint
  ): ProjectRepositoryResult<ProjectRepositoryOpenValue>;
}

interface ParsedProjectIndex {
  entries: PersistedIdeProjectIndexEntry[];
  warnings: ProjectRepositoryError[];
  missing: boolean;
}

interface RebuiltProjectIndex {
  entries: PersistedIdeProjectIndexEntry[];
  warnings: ProjectRepositoryError[];
}

const MAX_INDEX_ENTRIES = 40;

export function createProjectRepository(
  options: ProjectRepositoryOptions = {}
): ProjectRepository {
  const now = options.now ?? (() => new Date());
  const hasInjectedStorage = Object.prototype.hasOwnProperty.call(options, 'storage');
  const listeners = new Set<(state: ProjectRepositoryState) => void>();
  let state: ProjectRepositoryState = {
    version: PROJECT_REPOSITORY_VERSION,
    availability: 'ready',
    saveState: 'idle',
    lastSavedAtIso: null,
    storageLocation: PROJECT_REPOSITORY_STORAGE_LOCATION,
    recoveryAvailable: false,
    recoveryCheckpoint: null,
    lastError: null,
  };

  const getState = (): ProjectRepositoryState => ({
    ...state,
    recoveryCheckpoint: state.recoveryCheckpoint
      ? { ...state.recoveryCheckpoint }
      : null,
    lastError: state.lastError ? { ...state.lastError } : null,
  });

  const setState = (next: Partial<ProjectRepositoryState>): void => {
    state = { ...state, ...next };
    const snapshot = getState();
    for (const listener of listeners) listener(snapshot);
  };

  const resolveStorage = (
    operation: ProjectRepositoryOperation,
    projectId?: string
  ): ProjectRepositoryResult<ProjectRepositoryStorage> => {
    try {
      const storage = hasInjectedStorage
        ? options.storage ?? null
        : typeof localStorage === 'undefined'
          ? null
          : localStorage;
      if (!storage) {
        return {
          ok: false,
          error: createError(
            operation,
            'storage-unavailable',
            'Browser-local project storage is unavailable.',
            false,
            projectId
          ),
        };
      }
      return { ok: true, value: storage };
    } catch (error) {
      return {
        ok: false,
        error: classifyStorageError(error, operation, projectId, 'storage-access-denied'),
      };
    }
  };

  const registerFailure = (
    error: ProjectRepositoryError,
    isSaveOperation = false
  ): void => {
    setState({
      availability:
        error.code === 'storage-unavailable' || error.code === 'storage-access-denied'
          ? 'unavailable'
          : 'degraded',
      saveState: isSaveOperation ? 'save-failed' : state.saveState,
      lastError: error,
    });
  };

  const registerReadHealth = (warnings: ProjectRepositoryError[]): void => {
    setState({
      availability: warnings.length > 0 ? 'degraded' : 'ready',
      lastError: warnings[0] ?? null,
    });
  };

  const openWithOperation = (
    projectId: string,
    operation: 'open' | 'recover'
  ): ProjectRepositoryResult<ProjectRepositoryOpenValue> => {
    const normalizedId = projectId.trim();
    if (!normalizedId) {
      const error = createError(
        operation,
        'invalid-project-id',
        'Choose a project with a valid local project id.',
        true
      );
      registerFailure(error);
      return { ok: false, error };
    }

    const storageResult = resolveStorage(operation, normalizedId);
    if (!storageResult.ok) {
      registerFailure(storageResult.error);
      return storageResult;
    }
    const snapshotResult = readSnapshot(
      storageResult.value,
      normalizedId,
      operation
    );
    if (!snapshotResult.ok) {
      registerFailure(snapshotResult.error);
      return snapshotResult;
    }
    const project = decodePersistedIdeProject(snapshotResult.value);
    if (!project) {
      const error = createError(
        operation,
        'decode-failed',
        'The saved project payload could not be decoded. The stored bytes were left unchanged.',
        true,
        normalizedId
      );
      registerFailure(error);
      return { ok: false, error };
    }

    registerReadHealth([]);
    return {
      ok: true,
      value: {
        version: PROJECT_REPOSITORY_VERSION,
        snapshot: snapshotResult.value,
        project,
        storageLocation: PROJECT_REPOSITORY_STORAGE_LOCATION,
      },
    };
  };

  const persist = (
    input: ProjectRepositorySaveInput,
    operation: 'save' | 'autosave' | 'checkpoint'
  ): ProjectRepositoryResult<ProjectRepositorySaveValue> => {
    setState({
      saveState: operation === 'autosave' ? 'autosaving' : 'saving',
      lastError: null,
    });

    const projectId = input.projectId.trim();
    if (!projectId) {
      const error = createError(
        operation,
        'invalid-project-id',
        'A project id is required before the project can be saved.',
        true
      );
      registerFailure(error, true);
      return { ok: false, error };
    }
    if (!input.projectHash.trim()) {
      const error = createError(
        operation,
        'invalid-project-payload',
        'The project save was blocked because its project hash is missing.',
        true,
        projectId
      );
      registerFailure(error, true);
      return { ok: false, error };
    }

    let snapshot: PersistedIdeProjectSnapshot;
    let snapshotJson: string;
    try {
      snapshot = {
        version: IDE_PROJECT_STORAGE_VERSION,
        projectId,
        projectName: input.projectName.trim() || 'Untitled Project',
        savedAtIso: input.savedAtIso ?? now().toISOString(),
        projectHash: input.projectHash.trim(),
        rbprojJson: encodeRBProject(input.project),
        scenarios: input.scenarios ? structuredClone(input.scenarios) : undefined,
        activeScenarioId: input.activeScenarioId,
        runEvidence: input.runEvidence ? structuredClone(input.runEvidence) : undefined,
      };
      snapshotJson = JSON.stringify(snapshot);
    } catch {
      const error = createError(
        operation,
        'invalid-project-payload',
        'The project payload could not be serialized. The previous saved project was left unchanged.',
        true,
        projectId
      );
      registerFailure(error, true);
      return { ok: false, error };
    }

    const storageResult = resolveStorage(operation, projectId);
    if (!storageResult.ok) {
      registerFailure(storageResult.error, true);
      return storageResult;
    }
    const storage = storageResult.value;
    const indexResult = readIndex(storage, operation);
    let indexEntries: PersistedIdeProjectIndexEntry[];
    let saveWarnings: ProjectRepositoryError[] = [];
    let remainingWarnings: ProjectRepositoryError[] = [];
    const indexNeedsRepair =
      (!indexResult.ok && indexResult.error.code === 'corrupt-index') ||
      (indexResult.ok && indexResult.value.warnings.length > 0);
    if (indexNeedsRepair) {
      const rebuiltIndex = rebuildIndexFromSnapshots(storage, operation);
      if (!rebuiltIndex.ok) {
        registerFailure(rebuiltIndex.error, true);
        return rebuiltIndex;
      }
      indexEntries = rebuiltIndex.value.entries;
      remainingWarnings = rebuiltIndex.value.warnings;
      saveWarnings = [
        createError(
          operation,
          'corrupt-index',
          'The damaged recent-project index was rebuilt from valid browser-local snapshots during this save. Invalid snapshot bytes were preserved and omitted.',
          true
        ),
        ...remainingWarnings,
      ];
    } else if (!indexResult.ok) {
      registerFailure(indexResult.error, true);
      return indexResult;
    } else {
      indexEntries = indexResult.value.entries;
    }

    const storageKey = buildProjectStorageKey(projectId);
    let previousSnapshot: string | null;
    let previousIndex: string | null;
    try {
      previousSnapshot = storage.getItem(storageKey);
      previousIndex = storage.getItem(IDE_PROJECT_INDEX_KEY);
    } catch (error) {
      const repositoryError = classifyStorageError(error, operation, projectId);
      registerFailure(repositoryError, true);
      return { ok: false, error: repositoryError };
    }

    if (previousSnapshot !== null) {
      const existingSnapshot = readSnapshot(storage, projectId, operation);
      if (!existingSnapshot.ok) {
        registerFailure(existingSnapshot.error, true);
        return existingSnapshot;
      }
      if (!decodePersistedIdeProject(existingSnapshot.value)) {
        const error = createError(
          operation,
          'decode-failed',
          'The existing saved project is damaged. Its stored bytes were preserved; use Save As or recovery instead of overwriting it.',
          true,
          projectId
        );
        registerFailure(error, true);
        return { ok: false, error };
      }
    }

    const indexEntry: PersistedIdeProjectIndexEntry = {
      projectId: snapshot.projectId,
      projectName: snapshot.projectName,
      savedAtIso: snapshot.savedAtIso,
      projectHash: snapshot.projectHash,
    };
    const nextIndex = sortIndexEntries([
      indexEntry,
      ...indexEntries.filter((entry) => entry.projectId !== projectId),
    ]).slice(0, MAX_INDEX_ENTRIES);

    try {
      storage.setItem(storageKey, snapshotJson);
      storage.setItem(IDE_PROJECT_INDEX_KEY, JSON.stringify(nextIndex));
    } catch (error) {
      rollbackWrite(storage, storageKey, previousSnapshot, previousIndex);
      const repositoryError = classifyStorageError(error, operation, projectId);
      registerFailure(repositoryError, true);
      return { ok: false, error: repositoryError };
    }

    const supersedesCheckpoint =
      state.recoveryCheckpoint?.projectId === projectId &&
      (state.recoveryCheckpoint.savedAtIso !== snapshot.savedAtIso ||
        state.recoveryCheckpoint.projectHash !== snapshot.projectHash);
    setState({
      availability: remainingWarnings.length > 0 ? 'degraded' : 'ready',
      saveState: 'saved',
      lastSavedAtIso: snapshot.savedAtIso,
      recoveryAvailable: supersedesCheckpoint ? false : state.recoveryAvailable,
      recoveryCheckpoint: supersedesCheckpoint ? null : state.recoveryCheckpoint,
      lastError: remainingWarnings[0] ?? null,
    });
    return {
      ok: true,
      value: {
        version: PROJECT_REPOSITORY_VERSION,
        operation,
        snapshot,
        warnings: saveWarnings,
        storageLocation: PROJECT_REPOSITORY_STORAGE_LOCATION,
      },
    };
  };

  return {
    version: PROJECT_REPOSITORY_VERSION,
    storageLocation: PROJECT_REPOSITORY_STORAGE_LOCATION,
    getState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    list() {
      const storageResult = resolveStorage('list');
      if (!storageResult.ok) {
        registerFailure(storageResult.error);
        return storageResult;
      }
      const indexResult = readIndex(storageResult.value, 'list');
      const warnings: ProjectRepositoryError[] = [];
      let indexEntries: PersistedIdeProjectIndexEntry[] = [];
      if (indexResult.ok) {
        indexEntries = indexResult.value.entries;
        warnings.push(...indexResult.value.warnings);
      } else if (indexResult.error.code === 'corrupt-index') {
        warnings.push(indexResult.error);
      } else {
        registerFailure(indexResult.error);
        return indexResult;
      }

      const candidateIds = new Set(indexEntries.map((entry) => entry.projectId));
      try {
        for (let index = 0; index < storageResult.value.length; index += 1) {
          const key = storageResult.value.key(index);
          if (key?.startsWith(IDE_PROJECT_KEY_PREFIX)) {
            const projectId = key.slice(IDE_PROJECT_KEY_PREFIX.length).trim();
            if (projectId) candidateIds.add(projectId);
          }
        }
      } catch (error) {
        const repositoryError = classifyStorageError(error, 'list');
        registerFailure(repositoryError);
        return { ok: false, error: repositoryError };
      }

      const projects: PersistedIdeProjectIndexEntry[] = [];
      for (const projectId of candidateIds) {
        const snapshotResult = readSnapshot(storageResult.value, projectId, 'list');
        if (!snapshotResult.ok) {
          warnings.push(snapshotResult.error);
          continue;
        }
        projects.push({
          projectId: snapshotResult.value.projectId,
          projectName: snapshotResult.value.projectName,
          savedAtIso: snapshotResult.value.savedAtIso,
          projectHash: snapshotResult.value.projectHash,
        });
      }

      registerReadHealth(warnings);
      return {
        ok: true,
        value: {
          version: PROJECT_REPOSITORY_VERSION,
          projects: sortIndexEntries(projects).slice(0, MAX_INDEX_ENTRIES),
          warnings,
          storageLocation: PROJECT_REPOSITORY_STORAGE_LOCATION,
        },
      };
    },
    open(projectId) {
      return openWithOperation(projectId, 'open');
    },
    save(input) {
      return persist(input, 'save');
    },
    autosave(input) {
      return persist(input, 'autosave');
    },
    checkpoint(input, reason = 'Before replacing the active project') {
      const saved = persist(input, 'checkpoint');
      if (!saved.ok) return saved;
      const checkpoint: ProjectRecoveryCheckpoint = {
        version: PROJECT_REPOSITORY_VERSION,
        projectId: saved.value.snapshot.projectId,
        projectHash: saved.value.snapshot.projectHash,
        savedAtIso: saved.value.snapshot.savedAtIso,
        reason,
        storageLocation: PROJECT_REPOSITORY_STORAGE_LOCATION,
      };
      setState({ recoveryAvailable: true, recoveryCheckpoint: checkpoint });
      return { ok: true, value: checkpoint };
    },
    recover(checkpoint) {
      if (checkpoint.version !== PROJECT_REPOSITORY_VERSION) {
        const error = createError(
          'recover',
          'unsupported-version',
          'This recovery checkpoint was created by an unsupported repository version.',
          true,
          checkpoint.projectId
        );
        registerFailure(error);
        return { ok: false, error };
      }
      const opened = openWithOperation(checkpoint.projectId, 'recover');
      if (!opened.ok) return opened;
      if (
        opened.value.snapshot.savedAtIso !== checkpoint.savedAtIso ||
        opened.value.snapshot.projectHash !== checkpoint.projectHash
      ) {
        const error = createError(
          'recover',
          'recovery-superseded',
          'A newer save replaced this recovery checkpoint. No project data was changed.',
          true,
          checkpoint.projectId
        );
        setState({
          availability: 'degraded',
          recoveryAvailable: false,
          recoveryCheckpoint: null,
          lastError: error,
        });
        return { ok: false, error };
      }
      setState({
        availability: 'ready',
        saveState: 'saved',
        lastSavedAtIso: opened.value.snapshot.savedAtIso,
        recoveryAvailable: true,
        recoveryCheckpoint: checkpoint,
        lastError: null,
      });
      return opened;
    },
  };
}

function readIndex(
  storage: ProjectRepositoryStorage,
  operation: ProjectRepositoryOperation
): ProjectRepositoryResult<ParsedProjectIndex> {
  let raw: string | null;
  try {
    raw = storage.getItem(IDE_PROJECT_INDEX_KEY);
  } catch (error) {
    return { ok: false, error: classifyStorageError(error, operation) };
  }
  if (!raw) {
    return { ok: true, value: { entries: [], warnings: [], missing: true } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: createError(
        operation,
        'corrupt-index',
        'The recent-project index is damaged. Stored project records were left unchanged.',
        true
      ),
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: createError(
        operation,
        'corrupt-index',
        'The recent-project index has an invalid shape. Stored project records were left unchanged.',
        true
      ),
    };
  }

  const entries: PersistedIdeProjectIndexEntry[] = [];
  const warnings: ProjectRepositoryError[] = [];
  for (const value of parsed) {
    const entry = normalizeProjectIndexEntry(value);
    if (entry) {
      entries.push(entry);
    } else {
      warnings.push(
        createError(
          operation,
          'corrupt-index',
          'One recent-project index row is invalid. It was preserved in storage and omitted from this view.',
          true
        )
      );
    }
  }
  return {
    ok: true,
    value: { entries: sortIndexEntries(entries), warnings, missing: false },
  };
}

function readSnapshot(
  storage: ProjectRepositoryStorage,
  projectId: string,
  operation: ProjectRepositoryOperation
): ProjectRepositoryResult<PersistedIdeProjectSnapshot> {
  let raw: string | null;
  try {
    raw = storage.getItem(buildProjectStorageKey(projectId));
  } catch (error) {
    return {
      ok: false,
      error: classifyStorageError(error, operation, projectId),
    };
  }
  if (!raw) {
    return {
      ok: false,
      error: createError(
        operation,
        'not-found',
        'No browser-local snapshot exists for this project.',
        true,
        projectId
      ),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: createError(
        operation,
        'corrupt-snapshot',
        'This project snapshot is damaged. The stored bytes were left unchanged for recovery.',
        true,
        projectId
      ),
    };
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    'version' in parsed &&
    (parsed as { version?: unknown }).version !== IDE_PROJECT_STORAGE_VERSION
  ) {
    return {
      ok: false,
      error: createError(
        operation,
        'unsupported-version',
        'This project snapshot uses an unsupported storage version. It was not changed.',
        true,
        projectId
      ),
    };
  }
  const snapshot = parsePersistedIdeProjectSnapshot(parsed);
  if (!snapshot || snapshot.projectId !== projectId) {
    return {
      ok: false,
      error: createError(
        operation,
        'corrupt-snapshot',
        'This project snapshot has invalid identity or metadata. It was not changed.',
        true,
        projectId
      ),
    };
  }
  return { ok: true, value: snapshot };
}

function rebuildIndexFromSnapshots(
  storage: ProjectRepositoryStorage,
  operation: 'save' | 'autosave' | 'checkpoint'
): ProjectRepositoryResult<RebuiltProjectIndex> {
  const candidateIds = new Set<string>();
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(IDE_PROJECT_KEY_PREFIX)) continue;
      const projectId = key.slice(IDE_PROJECT_KEY_PREFIX.length).trim();
      if (projectId) candidateIds.add(projectId);
    }
  } catch (error) {
    return { ok: false, error: classifyStorageError(error, operation) };
  }

  const entries: PersistedIdeProjectIndexEntry[] = [];
  const warnings: ProjectRepositoryError[] = [];
  for (const projectId of candidateIds) {
    const snapshotResult = readSnapshot(storage, projectId, operation);
    if (!snapshotResult.ok) {
      if (
        snapshotResult.error.code === 'corrupt-snapshot' ||
        snapshotResult.error.code === 'unsupported-version' ||
        snapshotResult.error.code === 'not-found'
      ) {
        warnings.push(snapshotResult.error);
        continue;
      }
      return snapshotResult;
    }
    if (!decodePersistedIdeProject(snapshotResult.value)) {
      warnings.push(
        createError(
          operation,
          'decode-failed',
          'One stored project payload could not be decoded. Its bytes were preserved and omitted from the rebuilt recent-project index.',
          true,
          projectId
        )
      );
      continue;
    }
    entries.push({
      projectId: snapshotResult.value.projectId,
      projectName: snapshotResult.value.projectName,
      savedAtIso: snapshotResult.value.savedAtIso,
      projectHash: snapshotResult.value.projectHash,
    });
  }

  return {
    ok: true,
    value: {
      entries: sortIndexEntries(entries).slice(0, MAX_INDEX_ENTRIES),
      warnings,
    },
  };
}

function sortIndexEntries(
  entries: PersistedIdeProjectIndexEntry[]
): PersistedIdeProjectIndexEntry[] {
  return [...entries].sort((left, right) => {
    const timeDelta =
      new Date(right.savedAtIso).getTime() - new Date(left.savedAtIso).getTime();
    if (Number.isFinite(timeDelta) && timeDelta !== 0) return timeDelta;
    return compareCodepoint(left.projectId, right.projectId);
  });
}

function rollbackWrite(
  storage: ProjectRepositoryStorage,
  projectKey: string,
  previousSnapshot: string | null,
  previousIndex: string | null
): void {
  try {
    if (previousSnapshot === null) storage.removeItem(projectKey);
    else storage.setItem(projectKey, previousSnapshot);
    if (previousIndex === null) storage.removeItem(IDE_PROJECT_INDEX_KEY);
    else storage.setItem(IDE_PROJECT_INDEX_KEY, previousIndex);
  } catch {
    // The original write error is the actionable result. A future list/open call
    // will still surface any partial browser-storage state without discarding it.
  }
}

function classifyStorageError(
  error: unknown,
  operation: ProjectRepositoryOperation,
  projectId?: string,
  fallbackCode: ProjectRepositoryErrorCode = 'write-failed'
): ProjectRepositoryError {
  const name =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return createError(
      operation,
      'quota-exceeded',
      'Browser-local storage is full. The previous saved project was left unchanged when possible.',
      true,
      projectId
    );
  }
  if (name === 'SecurityError' || name === 'NotAllowedError') {
    return createError(
      operation,
      'storage-access-denied',
      'The browser denied access to local project storage.',
      false,
      projectId
    );
  }
  return createError(
    operation,
    fallbackCode,
    fallbackCode === 'storage-access-denied'
      ? 'The browser denied access to local project storage.'
      : 'The browser could not complete the project storage operation. Existing data was left unchanged when possible.',
    fallbackCode !== 'storage-access-denied',
    projectId
  );
}

function createError(
  operation: ProjectRepositoryOperation,
  code: ProjectRepositoryErrorCode,
  message: string,
  recoverable: boolean,
  projectId?: string
): ProjectRepositoryError {
  return {
    version: PROJECT_REPOSITORY_VERSION,
    operation,
    code,
    message,
    recoverable,
    ...(projectId ? { projectId } : {}),
  };
}

export const projectRepository = createProjectRepository();
