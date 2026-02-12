import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearProjectAutosaveByProjectId,
  getCanonicalProjectAutosaveKey,
  getCanonicalProjectAutosaveMetaKey,
  getCanonicalProjectAutosaveDirtyKey,
  loadProjectAutosaveDirtyState,
  loadRecentProjects,
  markProjectSubmissionCheckpoint,
  saveProjectAutosaveMeta,
  saveProjectAutosaveDirtyState,
  saveRbprojAutosave,
  upsertRecentProject,
} from '../utils/rbprojAutosave';
import { createRBProject } from '../export/projectFormat';

describe('rbproj recent project persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('orders recent projects by most recent open time', () => {
    upsertRecentProject({
      projectId: 'proj-a',
      name: 'Project A',
      appHint: 'logic-playground',
      hasUnsaved: false,
      lastOpenedAt: 10,
    });
    upsertRecentProject({
      projectId: 'proj-b',
      name: 'Project B',
      appHint: 'ece-lab',
      hasUnsaved: false,
      lastOpenedAt: 20,
    });

    const recent = loadRecentProjects();
    expect(recent.map((entry) => entry.projectId)).toEqual(['proj-b', 'proj-a']);
  });

  it('overlays dirty-state flags from canonical autosave dirty keys', () => {
    upsertRecentProject({
      projectId: 'proj-dirty',
      name: 'Dirty Project',
      appHint: 'logic-playground',
      hasUnsaved: false,
      lastOpenedAt: 50,
    });

    saveProjectAutosaveDirtyState('proj-dirty', {
      version: 1,
      dirty: true,
      lastSavedHash: 'dirty-hash',
      savedAtMs: 99,
    });

    const [entry] = loadRecentProjects();
    expect(entry.hasUnsaved).toBe(true);
    expect(entry.lastSavedHash).toBe('dirty-hash');
    expect(entry.autosaveSavedAtMs).toBe(99);
  });

  it('clears autosave payloads and recent entry for a project', () => {
    const projectId = 'proj-clear';
    saveRbprojAutosave(getCanonicalProjectAutosaveKey(projectId), {
      version: 1,
      savedAtMs: 1,
      contentHash: 'hash-clear',
      projectJson: '{"kind":"rb-project","version":1}',
    });
    saveProjectAutosaveMeta(getCanonicalProjectAutosaveMetaKey(projectId), {
      version: 1,
      codec: 'rbproj',
      projectId,
      savedAtMs: 1,
      contentHash: 'hash-clear',
      appSurface: 'logic-playground',
    });
    saveProjectAutosaveDirtyState(projectId, {
      version: 1,
      dirty: true,
      savedAtMs: 1,
      lastSavedHash: 'hash-clear',
    });
    upsertRecentProject({
      projectId,
      name: 'Clear Me',
      appHint: 'logic-playground',
      hasUnsaved: true,
      lastOpenedAt: 1,
    });

    clearProjectAutosaveByProjectId(projectId);

    expect(localStorage.getItem(getCanonicalProjectAutosaveKey(projectId))).toBeNull();
    expect(localStorage.getItem(getCanonicalProjectAutosaveMetaKey(projectId))).toBeNull();
    expect(localStorage.getItem(getCanonicalProjectAutosaveDirtyKey(projectId))).toBeNull();
    expect(loadRecentProjects()).toEqual([]);
  });

  it('marks project clean and records last submission checkpoint metadata', () => {
    const projectId = 'proj-submit';
    const project = createRBProject({
      name: 'Submission Ready',
      circuit: { nodes: [], connections: [] },
      meta: {
        projectId,
        appSurface: 'logic-playground',
      },
    });

    saveProjectAutosaveDirtyState(projectId, {
      version: 1,
      dirty: true,
      savedAtMs: 80,
      lastSavedHash: 'hash-before-submit',
    });
    upsertRecentProject({
      projectId,
      name: 'Submission Ready',
      appHint: 'logic-playground',
      hasUnsaved: true,
      lastOpenedAt: 80,
    });

    markProjectSubmissionCheckpoint(project, {
      bundleId: 'bundle-submit-1234',
      submittedAtMs: 120,
    });

    const [entry] = loadRecentProjects();
    expect(entry.hasUnsaved).toBe(false);
    expect(entry.lastSubmissionBundleId).toBe('bundle-submit-1234');
    expect(entry.lastSubmissionAtMs).toBe(120);
    expect(loadProjectAutosaveDirtyState(projectId)?.dirty).toBe(false);
  });
});
