// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';
import { createEmptyConstraintSets } from '../constraintSets';

const rt = () => useProjectRuntime.getState();

function persistedCandidate(extra: Record<string, unknown>) {
  const current = rt();
  return {
    projectId: 'rb-cs-test',
    projectName: 'CS Test',
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

describe('projectRuntime constraint-sets authority', () => {
  beforeEach(() => {
    rt().resetToActiveExample();
  });

  it('starts empty', () => {
    expect(rt().constraintSets).toEqual(createEmptyConstraintSets());
  });

  it('adds sets (first becomes active), renames, sets active, and removes', () => {
    const a = rt().addConstraintSet('Basys3', 'set_property PACKAGE_PIN V17 [get_ports a]');
    expect(a.ok).toBe(true);
    const b = rt().addConstraintSet('Variant', 'set_property PACKAGE_PIN W17 [get_ports a]');
    expect(b.ok).toBe(true);
    expect(rt().constraintSets.sets).toHaveLength(2);
    // first added is active
    expect(rt().constraintSets.activeId).toBe((a as { id: string }).id);
    expect(rt().projectHealthCore.dirtySinceExport).toBe(true);

    // duplicate name rejected
    const dup = rt().addConstraintSet('Basys3', 'x');
    expect(dup.ok).toBe(false);

    // set active to the variant
    rt().setActiveConstraintSet((b as { id: string }).id);
    expect(rt().constraintSets.activeId).toBe((b as { id: string }).id);

    // rename
    const r = rt().renameConstraintSet((a as { id: string }).id, 'Basys3 rev A');
    expect(r.ok).toBe(true);
    expect(rt().constraintSets.sets.find((s) => s.id === (a as { id: string }).id)?.name).toBe('Basys3 rev A');

    // remove the active variant → activation falls back to the first remaining
    rt().removeConstraintSet((b as { id: string }).id);
    expect(rt().constraintSets.sets).toHaveLength(1);
    expect(rt().constraintSets.activeId).toBe((a as { id: string }).id);
  });

  it('persists and restores constraint sets across reload', () => {
    const doc = {
      schemaVersion: '1.0' as const,
      sets: [{ id: 'xdc-basys3', name: 'Basys3', xdcText: 'set_property PACKAGE_PIN V17 [get_ports a]' }],
      activeId: 'xdc-basys3',
    };
    const merged = mergePersistedRuntimeState(persistedCandidate({ constraintSets: doc }), rt());
    expect(merged.constraintSets.sets.map((s) => s.name)).toEqual(['Basys3']);
    expect(merged.constraintSets.activeId).toBe('xdc-basys3');
  });

  it('seeds a constraint set from an imported XDC source on project load', () => {
    rt().loadFromProject({
      kind: 'rb-project',
      version: 1,
      name: 'Imported',
      createdAt: '2026-03-09T00:00:00.000Z',
      updatedAt: '2026-03-09T00:00:00.000Z',
      circuit: { nodes: [], connections: [] },
      hdl: {
        top: 'top',
        sources: [
          { path: 'constraints/basys3.xdc', language: 'xdc', text: 'set_property PACKAGE_PIN V17 [get_ports a]' },
        ],
      },
    } as never);
    expect(rt().constraintSets.sets.map((s) => s.name)).toEqual(['constraints/basys3.xdc']);
    expect(rt().constraintSets.activeId).not.toBeNull();
  });
});
