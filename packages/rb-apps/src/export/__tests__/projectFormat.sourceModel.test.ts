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
  it.each(['sourceModel', 'constraintSets'])('refuses an unsupported %s schema instead of discarding authoring content', field => {
    const document = { ...baseProject(), [field]: { schemaVersion: '2.0', files: [{ path: 'future.bin', text: 'preserve me' }] } };
    expect(() => decodeRBProject(JSON.stringify(document))).toThrow(`Unsupported ${field} schema 2.0`);
  });

  it('promotes legacy mixed HDL/XDC/Tcl originals before narrowing the toolchain projection', () => {
    const originals = [
      { path: 'rtl/top.vhd', language: 'vhdl', text: 'entity top;' },
      { path: 'pins.xdc', language: 'xdc', text: 'if {$keep} { arbitrary Tcl }\r\n' },
      { path: 'build.tcl', language: 'tcl', text: 'unsupported original script\n' },
      { path: 'notes.dat', language: 'unknown', text: 'opaque original\r\n' },
    ];
    const decoded = decodeRBProject(JSON.stringify({ ...baseProject(), hdl: { top: 'original_top', sources: originals } }));
    const reopened = decodeRBProject(encodeRBProject(decoded));
    expect(reopened.hdl?.sources).toEqual([originals[0]]);
    expect(reopened.hdl?.top).toBe('original_top');
    expect(reopened.sourceModel?.topEntity).toBe('original_top');
    for (const source of originals) {
      expect(reopened.sourceModel?.files.find(file => file.path === source.path)?.text).toBe(source.text);
    }
  });

  it.each([
    { schemaVersion: '1.0', files: [{ path: 'rtl/top.vhd', text: 42 }] },
    { schemaVersion: '1.0', files: [{ path: 'same.vhd', text: 'first' }, { path: 'same.vhd', text: 'second' }] },
    { schemaVersion: '1.0', files: null },
  ])('refuses malformed source authority without dropping original authoring content', sourceModel => {
    expect(() => decodeRBProject(JSON.stringify({ ...baseProject(), sourceModel }))).toThrow(/Invalid project: source model/);
  });

  it('preserves opaque utility text that the simulator cannot execute', () => {
    const model = addSourceFile(createEmptyProjectSourceModel(), { path: 'notes/opaque.dat', text: 'opaque\r\nbytes retained\n', language: 'unknown', fileset: 'utility' });
    const decoded = decodeRBProject(encodeRBProject(baseProject({ sourceModel: model })));
    expect(decoded.sourceModel?.files).toEqual(model.files);
  });
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

  it('preserves an explicit empty authoring model without promoting generated HDL', () => {
    const encoded = encodeRBProject(baseProject({ sourceModel: createEmptyProjectSourceModel() }));
    expect(decodeRBProject(encoded).sourceModel).toEqual(createEmptyProjectSourceModel());
    expect(deriveSourceModel(decodeRBProject(encoded)).files).toEqual([]);
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
