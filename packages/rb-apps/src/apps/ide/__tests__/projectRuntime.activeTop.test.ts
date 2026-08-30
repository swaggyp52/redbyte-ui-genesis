// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';

/**
 * P1-A/G — the active top-entity name has ONE writable owner: the project
 * runtime store. These tests pin its seeding, its validated command, and its
 * persistence round-trip so no surface needs a second copy.
 */

describe('projectRuntime.activeTop — single authority', () => {
  beforeEach(() => {
    act(() => {
      useProjectRuntime.getState().replaceWithBlankProject();
    });
  });

  it('seeds a name-derived top for a blank project', () => {
    expect(useProjectRuntime.getState().activeTop).toBe('untitled_project');
  });

  it('seeds the derived top from a loaded example', () => {
    act(() => {
      useProjectRuntime.getState().loadExample('half-adder');
    });
    expect(useProjectRuntime.getState().activeTop).toBe('half_adder');
  });

  it('seeds the saved top when loading a project', () => {
    act(() => {
      useProjectRuntime.getState().loadFromProject({
        kind: 'rb-project',
        version: 1,
        createdAt: '2026-08-30T00:00:00.000Z',
        updatedAt: '2026-08-30T00:00:00.000Z',
        name: 'My Design',
        circuit: { nodes: [], connections: [] },
        fpga: { board: 'Basys3', part: 'xc7a35tcpg236-1', top: 'custom_top' },
      });
    });
    expect(useProjectRuntime.getState().activeTop).toBe('custom_top');
  });

  it('sets a validated top and rejects invalid identifiers without mutating', () => {
    let ok = false;
    act(() => {
      ok = useProjectRuntime.getState().setActiveTop('my_adder').ok;
    });
    expect(ok).toBe(true);
    expect(useProjectRuntime.getState().activeTop).toBe('my_adder');

    let rejected: { ok: boolean; error?: string } = { ok: true };
    act(() => {
      rejected = useProjectRuntime.getState().setActiveTop('9bad');
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toBeTruthy();
    // Unchanged on rejection.
    expect(useProjectRuntime.getState().activeTop).toBe('my_adder');
  });

  it('resets to the name-derived default on an empty top', () => {
    act(() => {
      useProjectRuntime.getState().setActiveTop('explicit_top');
    });
    expect(useProjectRuntime.getState().activeTop).toBe('explicit_top');
    act(() => {
      useProjectRuntime.getState().setActiveTop('   ');
    });
    // Blank project name → derived default.
    expect(useProjectRuntime.getState().activeTop).toBe('untitled_project');
  });

  it('marks the project export-dirty when the active top changes', () => {
    act(() => {
      useProjectRuntime.getState().setActiveTop('dirtying_top');
    });
    expect(useProjectRuntime.getState().projectHealthCore.dirtySinceExport).toBe(true);
  });

  it('persists the active top across a merge round-trip', () => {
    act(() => {
      useProjectRuntime.getState().loadExample('half-adder');
      useProjectRuntime.getState().setActiveTop('persisted_top');
    });
    const current = useProjectRuntime.getState();
    // Simulate a persisted snapshot carrying the field (partialize includes it).
    const persisted = { ...current, activeTop: 'persisted_top' };
    const merged = mergePersistedRuntimeState(persisted, current);
    expect(merged.activeTop).toBe('persisted_top');
  });

  it('falls back to a name-derived top when a legacy snapshot lacks the field', () => {
    const current = useProjectRuntime.getState();
    const legacy: Record<string, unknown> = { ...current };
    delete legacy.activeTop;
    const merged = mergePersistedRuntimeState(legacy, current);
    // Blank project → derived default, never undefined.
    expect(typeof merged.activeTop).toBe('string');
    expect(merged.activeTop.length).toBeGreaterThan(0);
  });
});
