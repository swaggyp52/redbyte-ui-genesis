// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { mergePersistedRuntimeState, useProjectRuntime } from '../projectRuntime';
import type { ProjectHealthExportResult } from '../projectHealth';

/**
 * P1-F — recordExport keeps a bounded, persisted export ledger in addition to
 * the single lastExport pointer, so the package workspace can compare
 * successive packages.
 */

function ex(partial: Partial<ProjectHealthExportResult>): ProjectHealthExportResult {
  return { status: 'ok', ...partial };
}

describe('projectRuntime.exportHistory', () => {
  beforeEach(() => {
    act(() => {
      useProjectRuntime.getState().replaceWithBlankProject();
    });
  });

  it('starts empty', () => {
    expect(useProjectRuntime.getState().exportHistory).toEqual([]);
  });

  it('appends every recordExport while keeping lastExport as the current pointer', () => {
    act(() => {
      useProjectRuntime.getState().recordExport(ex({ packageHash: 'aaa', downloadKind: 'project' }));
      useProjectRuntime.getState().recordExport(ex({ packageHash: 'bbb', downloadKind: 'kit' }));
    });
    const state = useProjectRuntime.getState();
    expect(state.exportHistory.map((e) => e.packageHash)).toEqual(['aaa', 'bbb']);
    expect(state.projectHealthCore.lastExport?.packageHash).toBe('bbb');
  });

  it('bounds the ledger to 20 entries', () => {
    act(() => {
      for (let i = 0; i < 30; i += 1) {
        useProjectRuntime.getState().recordExport(ex({ packageHash: `h${i}` }));
      }
    });
    const history = useProjectRuntime.getState().exportHistory;
    expect(history).toHaveLength(20);
    expect(history[history.length - 1].packageHash).toBe('h29');
  });

  it('round-trips the ledger through a persisted merge', () => {
    act(() => {
      useProjectRuntime.getState().recordExport(ex({ packageHash: 'persisted' }));
    });
    const current = useProjectRuntime.getState();
    const merged = mergePersistedRuntimeState({ ...current }, current);
    expect(merged.exportHistory.map((e) => e.packageHash)).toEqual(['persisted']);
  });

  it('defaults to an empty ledger for a legacy snapshot without the field', () => {
    const current = useProjectRuntime.getState();
    const legacy: Record<string, unknown> = { ...current };
    delete legacy.exportHistory;
    const merged = mergePersistedRuntimeState(legacy, current);
    expect(merged.exportHistory).toEqual([]);
  });
});
