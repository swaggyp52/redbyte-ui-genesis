import { describe, expect, it } from 'vitest';
import {
  LAB_WORKSPACE_MODES,
  getWorkspaceModeIndex,
  LAB_WORKSPACE_MODE_HINTS,
  LAB_WORKSPACE_MODE_LABELS,
} from '../apps/labWorkspace/workspaceUx';

describe('workspace UX contract', () => {
  it('defines deterministic mode order and labels', () => {
    expect(LAB_WORKSPACE_MODES).toEqual(['build', 'simulate', 'hardware', 'submit']);
    expect(LAB_WORKSPACE_MODE_LABELS.submit).toBe('Package');
    expect(LAB_WORKSPACE_MODE_HINTS.build.length).toBeGreaterThan(0);
  });

  it('returns stable index for known modes and fallback for unknown', () => {
    expect(getWorkspaceModeIndex('build')).toBe(0);
    expect(getWorkspaceModeIndex('submit')).toBe(3);
    expect(getWorkspaceModeIndex('unknown' as never)).toBe(0);
  });
});
