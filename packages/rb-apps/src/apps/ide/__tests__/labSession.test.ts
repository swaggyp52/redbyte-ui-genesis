import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveLabSessionMeta,
  loadLabSessionMeta,
  clearLabSessionMeta,
  shouldKeepHydratedRuntime,
  type LabSessionMeta,
} from '../persistence/labSession';

const VALID_META: LabSessionMeta = {
  version: 1,
  savedAt: 1700000000000,
  projectId: 'test-project-1',
  currentMode: 'design',
  activeExampleId: 'signal-tour',
  probedKeys: ['node1.out', 'node2.in'],
};

beforeEach(() => {
  localStorage.clear();
});

describe('loadLabSessionMeta', () => {
  it('returns null when nothing saved', () => {
    expect(loadLabSessionMeta()).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    localStorage.setItem('rb.ide.sessionMeta.v1', 'not-valid-json{{{');
    expect(loadLabSessionMeta()).toBeNull();
  });

  it('returns null when version mismatches', () => {
    localStorage.setItem('rb.ide.sessionMeta.v1', JSON.stringify({ ...VALID_META, version: 2 }));
    expect(loadLabSessionMeta()).toBeNull();
  });

  it('returns null when projectId is missing', () => {
    const { projectId: _p, ...rest } = VALID_META;
    localStorage.setItem('rb.ide.sessionMeta.v1', JSON.stringify(rest));
    expect(loadLabSessionMeta()).toBeNull();
  });
});

describe('saveLabSessionMeta + loadLabSessionMeta round-trip', () => {
  it('round-trips a valid session', () => {
    saveLabSessionMeta(VALID_META);
    const result = loadLabSessionMeta();
    expect(result).not.toBeNull();
    expect(result!.projectId).toBe('test-project-1');
    expect(result!.currentMode).toBe('design');
    expect(result!.activeExampleId).toBe('signal-tour');
    expect(result!.probedKeys).toEqual(['node1.out', 'node2.in']);
    expect(result!.version).toBe(1);
  });

  it('survives null activeExampleId', () => {
    saveLabSessionMeta({ ...VALID_META, activeExampleId: null });
    const result = loadLabSessionMeta();
    expect(result?.activeExampleId).toBeNull();
  });

  it('survives empty probedKeys', () => {
    saveLabSessionMeta({ ...VALID_META, probedKeys: [] });
    const result = loadLabSessionMeta();
    expect(result?.probedKeys).toEqual([]);
  });
});

describe('clearLabSessionMeta', () => {
  it('removes the session so load returns null', () => {
    saveLabSessionMeta(VALID_META);
    clearLabSessionMeta();
    expect(loadLabSessionMeta()).toBeNull();
  });
});

describe('interrupted metadata writes', () => {
  it('preserves a hydrated newer project or closed home when the metadata points to older work', () => {
    expect(shouldKeepHydratedRuntime(VALID_META, 'newer-project', true)).toBe(true);
    expect(shouldKeepHydratedRuntime(VALID_META, 'closed-home', true)).toBe(true);
    expect(shouldKeepHydratedRuntime(null, 'newer-project', true)).toBe(true);
  });
  it('keeps metadata-only legacy reopen and matching-session navigation available', () => {
    expect(shouldKeepHydratedRuntime(VALID_META, 'placeholder-project', false)).toBe(false);
    expect(shouldKeepHydratedRuntime(VALID_META, VALID_META.projectId, true)).toBe(false);
  });
});
