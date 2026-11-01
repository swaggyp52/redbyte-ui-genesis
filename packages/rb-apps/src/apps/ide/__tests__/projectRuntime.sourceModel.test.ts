// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';
import { addSourceFile, createEmptyProjectSourceModel } from '../projectSourceModel';
import type { RBProject } from '../../../export/projectFormat';

const rt = () => useProjectRuntime.getState();

function persistedCandidate(extra: Record<string, unknown>) {
  const current = rt();
  return {
    projectId: 'rb-src-test',
    projectName: 'Source Test',
    projectDescription: '',
    lastSavedAt: 'Autosaved',
    activeExampleId: null,
    projectIoRows: [],
    projectVectors: [],
    customVectors: [],
    circuit: { nodes: [], connections: [] },
    verifyRunHistory: [],
    sim: current.sim,
    projectHealthCore: current.projectHealthCore,
    ...extra,
  } as never;
}

describe('projectRuntime source-model authority', () => {
  beforeEach(() => {
    rt().resetToActiveExample();
  });

  it('populates the source model on load from an imported project (hdl → sourceModel)', () => {
    const project: RBProject = {
      kind: 'rb-project',
      version: 1,
      name: 'Imported',
      createdAt: '2026-03-09T00:00:00.000Z',
      updatedAt: '2026-03-09T00:00:00.000Z',
      circuit: { nodes: [], connections: [] },
      hdl: { top: 'student_top', sources: [{ path: 'top.vhd', language: 'vhdl', text: 'entity student_top;' }] },
    } as RBProject;
    rt().loadFromProject(project);
    const model = rt().sourceModel;
    expect(model.files.map((f) => f.path)).toEqual(['top.vhd']);
    expect(model.topEntity).toBe('student_top');
    expect(model.files[0].fileset).toBe('design');
  });

  it('setSourceModel replaces the authority and marks dirty-since-export', () => {
    const model = addSourceFile(createEmptyProjectSourceModel(), { path: 'rtl/a.vhd', text: '' });
    rt().setSourceModel(model);
    expect(rt().sourceModel.files).toHaveLength(1);
    expect(rt().projectHealthCore.dirtySinceExport).toBe(true);
  });

  it('restores a persisted source model on merge (survives reload)', () => {
    const model = addSourceFile(createEmptyProjectSourceModel(), { path: 'rtl/top.vhd', text: 'entity top;' });
    const merged = mergePersistedRuntimeState(persistedCandidate({ sourceModel: model }), rt());
    expect(merged.sourceModel.files.map((f) => f.path)).toEqual(['rtl/top.vhd']);
  });

  it('defaults to an empty source model when none is persisted', () => {
    const merged = mergePersistedRuntimeState(persistedCandidate({}), rt());
    expect(merged.sourceModel.files).toEqual([]);
  });
});
