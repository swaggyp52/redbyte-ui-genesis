// @vitest-environment jsdom
//
// Deleting a saved project is the one repository operation that takes bytes away, so its
// boundaries are asserted exactly: the named snapshot and index entry go, every other project
// keeps its bytes, an unknown id is refused rather than silently "done", and a recovery
// checkpoint - a separate safety net - is left where it is.

import { beforeEach, describe, expect, it } from 'vitest';
import type { RBProject } from '../../../export/projectFormat';
import { createProjectRepository } from '../projectRepository';
import { IDE_PROJECT_INDEX_KEY } from '../projectPersistence';

function buildProject(projectId: string, name: string): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-09-11T00:00:00.000Z',
    updatedAt: '2026-09-11T00:00:00.000Z',
    name,
    description: '',
    circuit: { nodes: [], connections: [] },
    ioMapping: { inputs: [], outputs: [] },
    vectors: [],
    meta: { projectId, projectName: name },
  } as unknown as RBProject;
}

function saveTwo() {
  const repository = createProjectRepository({ storage: localStorage });
  for (const [id, name, at] of [
    ['keep-me', 'Keep Me', '2026-09-11T10:00:00.000Z'],
    ['drop-me', 'Drop Me', '2026-09-11T11:00:00.000Z'],
  ] as const) {
    const saved = repository.save({
      projectId: id,
      projectName: name,
      projectHash: `${id}-hash`,
      project: buildProject(id, name),
      savedAtIso: at,
    });
    expect(saved.ok).toBe(true);
  }
  return repository;
}

describe('ProjectRepository.remove', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes exactly the named project - its snapshot and its index entry - and nothing else', () => {
    const repository = saveTwo();
    const keysBefore = Object.keys(localStorage).sort();
    const keepSnapshot = keysBefore.find((key) => key.includes('keep-me'));
    const dropSnapshot = keysBefore.find((key) => key.includes('drop-me'));
    expect(keepSnapshot && dropSnapshot).toBeTruthy();
    const keepBytes = localStorage.getItem(keepSnapshot!);

    const removed = repository.remove('drop-me');
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.value.projectId).toBe('drop-me');

    expect(localStorage.getItem(dropSnapshot!)).toBeNull();
    expect(localStorage.getItem(keepSnapshot!)).toBe(keepBytes);
    const listed = repository.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.projects.map((entry) => entry.projectId)).toEqual(['keep-me']);
    expect(JSON.parse(localStorage.getItem(IDE_PROJECT_INDEX_KEY) ?? '[]').map((entry: { projectId: string }) => entry.projectId)).toEqual(['keep-me']);
    expect(repository.open('drop-me').ok).toBe(false);
    expect(repository.open('keep-me').ok).toBe(true);
  });

  it('refuses an id that is not saved here instead of reporting a deletion that did not happen', () => {
    const repository = saveTwo();
    const removed = repository.remove('never-saved');
    expect(removed.ok).toBe(false);
    if (!removed.ok) expect(removed.error.code).toBe('not-found');
    const listed = repository.list();
    if (listed.ok) expect(listed.value.projects).toHaveLength(2);
  });

  it('leaves a recovery checkpoint alone: deleting the saved copy is not deleting the safety net', () => {
    const repository = saveTwo();
    const checkpoint = repository.checkpoint(
      {
        projectId: 'drop-me',
        projectName: 'Drop Me',
        projectHash: 'drop-me-hash',
        project: buildProject('drop-me', 'Drop Me'),
        savedAtIso: '2026-09-11T11:00:00.000Z',
      },
      'before-replace'
    );
    expect(checkpoint.ok).toBe(true);
    expect(repository.getState().recoveryAvailable).toBe(true);
    expect(repository.remove('drop-me').ok).toBe(true);
    expect(repository.getState().recoveryAvailable).toBe(true);
    expect(repository.getState().recoveryCheckpoint?.projectId).toBe('drop-me');
  });
});
