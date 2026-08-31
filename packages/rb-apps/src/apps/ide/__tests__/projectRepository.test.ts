// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import {
  buildProjectStorageKey,
  IDE_PROJECT_INDEX_KEY,
  loadIdeProjectSnapshot,
  saveIdeProjectSnapshot,
} from '../projectPersistence';
import {
  createProjectRepository,
  PROJECT_REPOSITORY_STORAGE_LOCATION,
  PROJECT_REPOSITORY_VERSION,
  type ProjectRepositoryStorage,
} from '../projectRepository';
import type { VerifyScenario } from '../verifyScenario';

describe('ProjectRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses the existing project keys and round-trips portable project plus scenario state', () => {
    const repository = createProjectRepository({
      storage: localStorage,
      now: () => new Date('2026-08-01T12:00:00.000Z'),
    });
    const scenario = buildScenario('scenario-1', 'Truth table');

    const saved = repository.save({
      projectId: 'project-alpha',
      projectName: 'Project Alpha',
      projectHash: 'hash-alpha',
      project: buildProject('project-alpha', 'Project Alpha'),
      scenarios: [scenario],
      activeScenarioId: scenario.id,
    });

    expect(saved.ok).toBe(true);
    expect(localStorage.getItem(buildProjectStorageKey('project-alpha'))).not.toBeNull();
    expect(localStorage.getItem(IDE_PROJECT_INDEX_KEY)).not.toBeNull();
    expect(loadIdeProjectSnapshot('project-alpha')?.activeScenarioId).toBe('scenario-1');

    const listed = repository.list();
    expect(listed).toMatchObject({
      ok: true,
      value: {
        version: PROJECT_REPOSITORY_VERSION,
        projects: [{ projectId: 'project-alpha', projectName: 'Project Alpha' }],
        warnings: [],
        storageLocation: PROJECT_REPOSITORY_STORAGE_LOCATION,
      },
    });

    const opened = repository.open('project-alpha');
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.value.project.name).toBe('Project Alpha');
      expect(opened.value.snapshot.scenarios).toEqual([scenario]);
    }
  });

  it('opens snapshots written by the legacy helper without migrating or copying them', () => {
    const project = buildProject('legacy-project', 'Legacy Project');
    expect(
      saveIdeProjectSnapshot({
        projectId: 'legacy-project',
        projectName: 'Legacy Project',
        projectHash: 'legacy-hash',
        project,
        savedAtIso: '2026-07-31T12:00:00.000Z',
      })
    ).not.toBeNull();

    const repository = createProjectRepository({ storage: localStorage });
    const opened = repository.open('legacy-project');

    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.value.snapshot.projectHash).toBe('legacy-hash');
      expect(opened.value.project.meta?.projectId).toBe('legacy-project');
    }
  });

  it('publishes autosaving and saved states with a real saved time', () => {
    const repository = createProjectRepository({ storage: localStorage });
    const observedStates: string[] = [];
    repository.subscribe((state) => observedStates.push(state.saveState));

    const result = repository.autosave({
      projectId: 'autosave-project',
      projectName: 'Autosave Project',
      projectHash: 'autosave-hash',
      project: buildProject('autosave-project', 'Autosave Project'),
      savedAtIso: '2026-08-01T12:03:00.000Z',
    });

    expect(result.ok).toBe(true);
    expect(observedStates).toEqual(['autosaving', 'saved']);
    expect(repository.getState()).toMatchObject({
      availability: 'ready',
      saveState: 'saved',
      lastSavedAtIso: '2026-08-01T12:03:00.000Z',
      recoveryAvailable: false,
      storageLocation: PROJECT_REPOSITORY_STORAGE_LOCATION,
    });
  });

  it('creates an exact pre-replacement checkpoint and recovers it after a new identity is saved', () => {
    const repository = createProjectRepository({ storage: localStorage });
    const checkpoint = repository.checkpoint(
      {
        projectId: 'before-replacement',
        projectName: 'Before Replacement',
        projectHash: 'before-hash',
        project: buildProject('before-replacement', 'Before Replacement'),
        savedAtIso: '2026-08-01T12:05:00.000Z',
      },
      'Before Build Fresh'
    );
    expect(checkpoint.ok).toBe(true);
    if (!checkpoint.ok) return;

    expect(repository.getState()).toMatchObject({
      recoveryAvailable: true,
      recoveryCheckpoint: {
        projectId: 'before-replacement',
        reason: 'Before Build Fresh',
      },
    });

    expect(
      repository.save({
        projectId: 'replacement',
        projectName: 'Replacement',
        projectHash: 'replacement-hash',
        project: buildProject('replacement', 'Replacement'),
        savedAtIso: '2026-08-01T12:06:00.000Z',
      }).ok
    ).toBe(true);

    const recovered = repository.recover(checkpoint.value);
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.value.project.name).toBe('Before Replacement');
      expect(recovered.value.snapshot.projectHash).toBe('before-hash');
    }
  });

  it('refuses a checkpoint that a newer save has superseded', () => {
    const repository = createProjectRepository({ storage: localStorage });
    const checkpoint = repository.checkpoint({
      projectId: 'same-project',
      projectName: 'Same Project',
      projectHash: 'hash-one',
      project: buildProject('same-project', 'Same Project'),
      savedAtIso: '2026-08-01T12:10:00.000Z',
    });
    expect(checkpoint.ok).toBe(true);
    if (!checkpoint.ok) return;

    expect(
      repository.autosave({
        projectId: 'same-project',
        projectName: 'Same Project',
        projectHash: 'hash-two',
        project: buildProject('same-project', 'Same Project Updated'),
        savedAtIso: '2026-08-01T12:11:00.000Z',
      }).ok
    ).toBe(true);

    const recovered = repository.recover(checkpoint.value);
    expect(recovered).toMatchObject({
      ok: false,
      error: { code: 'recovery-superseded', projectId: 'same-project' },
    });
    expect(repository.getState().recoveryAvailable).toBe(false);
  });

  it('returns a quota error and rolls back a partial two-record save', () => {
    const storage = new MemoryStorage();
    const repository = createProjectRepository({ storage });
    const first = repository.save({
      projectId: 'quota-project',
      projectName: 'Quota Project',
      projectHash: 'hash-before',
      project: buildProject('quota-project', 'Before'),
      savedAtIso: '2026-08-01T12:15:00.000Z',
    });
    expect(first.ok).toBe(true);
    const previousSnapshot = storage.getItem(buildProjectStorageKey('quota-project'));
    const previousIndex = storage.getItem(IDE_PROJECT_INDEX_KEY);

    storage.failSetForKey = IDE_PROJECT_INDEX_KEY;
    const second = repository.save({
      projectId: 'quota-project',
      projectName: 'Quota Project',
      projectHash: 'hash-after',
      project: buildProject('quota-project', 'After'),
      savedAtIso: '2026-08-01T12:16:00.000Z',
    });

    expect(second).toMatchObject({
      ok: false,
      error: { code: 'quota-exceeded', operation: 'save', recoverable: true },
    });
    expect(repository.getState()).toMatchObject({
      availability: 'degraded',
      saveState: 'save-failed',
    });
    expect(storage.getItem(buildProjectStorageKey('quota-project'))).toBe(previousSnapshot);
    expect(storage.getItem(IDE_PROJECT_INDEX_KEY)).toBe(previousIndex);
  });

  it('recovers valid project records for listing when the index is corrupt without overwriting it', () => {
    const repository = createProjectRepository({ storage: localStorage });
    expect(
      repository.save({
        projectId: 'recoverable-project',
        projectName: 'Recoverable Project',
        projectHash: 'recoverable-hash',
        project: buildProject('recoverable-project', 'Recoverable Project'),
      }).ok
    ).toBe(true);
    localStorage.setItem(IDE_PROJECT_INDEX_KEY, '{damaged-index');

    const listed = repository.list();

    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.projects.map((project) => project.projectId)).toEqual([
        'recoverable-project',
      ]);
      expect(listed.value.warnings).toMatchObject([{ code: 'corrupt-index' }]);
    }
    expect(localStorage.getItem(IDE_PROJECT_INDEX_KEY)).toBe('{damaged-index');
    expect(repository.getState().availability).toBe('degraded');
  });

  it('repairs a corrupt index from valid snapshots only when a save succeeds', () => {
    const repository = createProjectRepository({ storage: localStorage });
    expect(
      repository.save({
        projectId: 'recoverable-project',
        projectName: 'Recoverable Project',
        projectHash: 'hash-before',
        project: buildProject('recoverable-project', 'Recoverable Project'),
        savedAtIso: '2026-08-01T12:20:00.000Z',
      }).ok
    ).toBe(true);
    localStorage.setItem(IDE_PROJECT_INDEX_KEY, '{damaged-index');

    expect(repository.list()).toMatchObject({
      ok: true,
      value: {
        projects: [{ projectId: 'recoverable-project', projectHash: 'hash-before' }],
        warnings: [{ code: 'corrupt-index' }],
      },
    });
    expect(repository.open('recoverable-project')).toMatchObject({
      ok: true,
      value: { snapshot: { projectHash: 'hash-before' } },
    });
    expect(localStorage.getItem(IDE_PROJECT_INDEX_KEY)).toBe('{damaged-index');

    const repaired = repository.save({
      projectId: 'recoverable-project',
      projectName: 'Recoverable Project Updated',
      projectHash: 'hash-after',
      project: buildProject('recoverable-project', 'Recoverable Project Updated'),
      savedAtIso: '2026-08-01T12:21:00.000Z',
    });

    expect(repaired).toMatchObject({
      ok: true,
      value: {
        snapshot: { projectHash: 'hash-after' },
        warnings: [{ code: 'corrupt-index', operation: 'save' }],
      },
    });
    expect(JSON.parse(localStorage.getItem(IDE_PROJECT_INDEX_KEY) ?? 'null')).toEqual([
      {
        projectId: 'recoverable-project',
        projectName: 'Recoverable Project Updated',
        savedAtIso: '2026-08-01T12:21:00.000Z',
        projectHash: 'hash-after',
      },
    ]);
    expect(repository.open('recoverable-project')).toMatchObject({
      ok: true,
      value: { project: { name: 'Recoverable Project Updated' } },
    });
    expect(repository.getState()).toMatchObject({
      availability: 'ready',
      saveState: 'saved',
      lastError: null,
    });
  });

  it('omits but preserves corrupt snapshots while rebuilding a damaged index', () => {
    const repository = createProjectRepository({ storage: localStorage });
    expect(
      repository.save({
        projectId: 'valid-existing',
        projectName: 'Valid Existing',
        projectHash: 'valid-hash',
        project: buildProject('valid-existing', 'Valid Existing'),
        savedAtIso: '2026-08-01T12:22:00.000Z',
      }).ok
    ).toBe(true);
    const damagedKey = buildProjectStorageKey('damaged-project');
    localStorage.setItem(damagedKey, '{not-project-json');
    localStorage.setItem(IDE_PROJECT_INDEX_KEY, '{damaged-index');

    const repaired = repository.save({
      projectId: 'new-project',
      projectName: 'New Project',
      projectHash: 'new-hash',
      project: buildProject('new-project', 'New Project'),
      savedAtIso: '2026-08-01T12:23:00.000Z',
    });

    expect(repaired).toMatchObject({
      ok: true,
      value: {
        warnings: [
          { code: 'corrupt-index', operation: 'save' },
          { code: 'corrupt-snapshot', projectId: 'damaged-project' },
        ],
      },
    });
    expect(localStorage.getItem(damagedKey)).toBe('{not-project-json');
    expect(JSON.parse(localStorage.getItem(IDE_PROJECT_INDEX_KEY) ?? 'null')).toEqual([
      {
        projectId: 'new-project',
        projectName: 'New Project',
        savedAtIso: '2026-08-01T12:23:00.000Z',
        projectHash: 'new-hash',
      },
      {
        projectId: 'valid-existing',
        projectName: 'Valid Existing',
        savedAtIso: '2026-08-01T12:22:00.000Z',
        projectHash: 'valid-hash',
      },
    ]);
    expect(repository.getState()).toMatchObject({
      availability: 'degraded',
      saveState: 'saved',
      lastError: { code: 'corrupt-snapshot', projectId: 'damaged-project' },
    });

    expect(
      repository.autosave({
        projectId: 'damaged-project',
        projectName: 'Damaged Project',
        projectHash: 'replacement-hash',
        project: buildProject('damaged-project', 'Replacement'),
      })
    ).toMatchObject({
      ok: false,
      error: { code: 'corrupt-snapshot', projectId: 'damaged-project' },
    });
    expect(localStorage.getItem(damagedKey)).toBe('{not-project-json');
  });

  it('keeps the original corrupt index bytes when a repair write fails', () => {
    const storage = new MemoryStorage();
    const repository = createProjectRepository({ storage });
    expect(
      repository.save({
        projectId: 'valid-existing',
        projectName: 'Valid Existing',
        projectHash: 'valid-hash',
        project: buildProject('valid-existing', 'Valid Existing'),
        savedAtIso: '2026-08-01T12:24:00.000Z',
      }).ok
    ).toBe(true);
    storage.setItem(IDE_PROJECT_INDEX_KEY, '{damaged-index');
    storage.failSetForKey = IDE_PROJECT_INDEX_KEY;

    const failedRepair = repository.save({
      projectId: 'new-project',
      projectName: 'New Project',
      projectHash: 'new-hash',
      project: buildProject('new-project', 'New Project'),
      savedAtIso: '2026-08-01T12:25:00.000Z',
    });

    expect(failedRepair).toMatchObject({
      ok: false,
      error: { code: 'quota-exceeded', operation: 'save' },
    });
    expect(storage.getItem(IDE_PROJECT_INDEX_KEY)).toBe('{damaged-index');
    expect(storage.getItem(buildProjectStorageKey('new-project'))).toBeNull();
    expect(repository.open('valid-existing')).toMatchObject({ ok: true });
  });

  it('surfaces corrupt snapshot bytes without deleting or rewriting them', () => {
    const repository = createProjectRepository({ storage: localStorage });
    const key = buildProjectStorageKey('damaged-project');
    localStorage.setItem(key, '{not-project-json');

    const opened = repository.open('damaged-project');

    expect(opened).toMatchObject({
      ok: false,
      error: { code: 'corrupt-snapshot', projectId: 'damaged-project' },
    });
    expect(localStorage.getItem(key)).toBe('{not-project-json');
  });

  it('refuses to autosave over corrupt project bytes', () => {
    const repository = createProjectRepository({ storage: localStorage });
    const key = buildProjectStorageKey('damaged-project');
    localStorage.setItem(key, '{not-project-json');

    const saved = repository.autosave({
      projectId: 'damaged-project',
      projectName: 'Damaged Project',
      projectHash: 'replacement-hash',
      project: buildProject('damaged-project', 'Replacement'),
    });

    expect(saved).toMatchObject({
      ok: false,
      error: {
        operation: 'autosave',
        code: 'corrupt-snapshot',
        projectId: 'damaged-project',
      },
    });
    expect(localStorage.getItem(key)).toBe('{not-project-json');
    expect(repository.getState()).toMatchObject({
      availability: 'degraded',
      saveState: 'save-failed',
    });
  });
});

function buildProject(projectId: string, name: string): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    name,
    circuit: { nodes: [], connections: [] },
    meta: { projectId, projectKind: 'custom', scenarioAuthority: 'authored' },
  };
}

function buildScenario(id: string, name: string): VerifyScenario {
  return {
    id,
    name,
    vectors: [],
    version: 1,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  };
}

class MemoryStorage implements ProjectRepositoryStorage {
  private readonly values = new Map<string, string>();
  failSetForKey: string | null = null;

  get length(): number {
    return this.values.size;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (key === this.failSetForKey) {
      throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }
}
