import { describe, expect, it } from 'vitest';
import { decodeRBProject, deriveSourceModel, encodeRBProject } from '../projectFormat';
import type { RBProject } from '../projectFormat';
import {
  addSourceFile,
  createEmptyProjectSourceModel,
} from '../../apps/ide/projectSourceModel';

function baseProject(overrides: Partial<RBProject> = {}): RBProject {
  return {
    kind: 'rb-project',
    version: 1,
    name: 'source-model-fixture',
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
    circuit: { nodes: [], connections: [] },
    ...overrides,
  } as RBProject;
}

describe('RBProject source-model persistence', () => {
  it('round-trips a project that carries a source model', () => {
    let model = createEmptyProjectSourceModel();
    model = addSourceFile(model, { path: 'rtl/top.vhd', text: 'entity top;', fileset: 'design' });
    model = addSourceFile(model, { path: 'sim/top_tb.vhd', text: 'entity top_tb;', fileset: 'simulation' });
    model = { ...model, topEntity: 'top' };

    const project = baseProject({ sourceModel: model });
    const decoded = decodeRBProject(encodeRBProject(project));

    expect(decoded.sourceModel).toBeDefined();
    expect(decoded.sourceModel?.files.map((f) => f.path)).toEqual(['rtl/top.vhd', 'sim/top_tb.vhd']);
    expect(decoded.sourceModel?.topEntity).toBe('top');
    // encode∘decode is idempotent with a source model present.
    const encoded1 = encodeRBProject(decoded);
    expect(encodeRBProject(decodeRBProject(encoded1))).toBe(encoded1);
  });

  it('omits the source model entirely when absent (no format drift)', () => {
    const encoded = encodeRBProject(baseProject());
    expect(encoded).not.toContain('sourceModel');
    expect(decodeRBProject(encoded).sourceModel).toBeUndefined();
  });

  it('omits an empty source model rather than emitting an empty object', () => {
    const encoded = encodeRBProject(baseProject({ sourceModel: createEmptyProjectSourceModel() }));
    expect(encoded).not.toContain('sourceModel');
  });
});

describe('deriveSourceModel', () => {
  it('returns the first-class source model when present', () => {
    const model = addSourceFile(createEmptyProjectSourceModel(), { path: 'rtl/top.vhd', text: '' });
    const derived = deriveSourceModel(baseProject({ sourceModel: model }));
    expect(derived.files.map((f) => f.path)).toEqual(['rtl/top.vhd']);
  });

  it('bridges from the legacy hdl toolchain input when the source model is absent', () => {
    const project = baseProject({
      hdl: { top: 'student_top', sources: [{ path: 'top.vhd', language: 'vhdl', text: 'entity student_top;' }] },
    });
    const derived = deriveSourceModel(project);
    expect(derived.topEntity).toBe('student_top');
    expect(derived.files).toHaveLength(1);
    expect(derived.files[0]).toMatchObject({ path: 'top.vhd', language: 'vhdl', fileset: 'design' });
  });

  it('returns an empty model when neither source model nor hdl exists', () => {
    expect(deriveSourceModel(baseProject()).files).toEqual([]);
  });
});
