import { describe, expect, it } from 'vitest';
import {
  resolveInitialIdeModeFromSearch,
  resolveRequestedIdeMode,
  resolveRestoredIdeMode,
} from '../startupMode';

describe('startupMode', () => {
  it('returns the requested mode when the URL explicitly asks for one', () => {
    expect(resolveRequestedIdeMode('?mode=verify')).toBe('verify');
    expect(resolveRequestedIdeMode('?mode=IMPORT')).toBe('import');
  });

  it('ignores invalid mode values', () => {
    expect(resolveRequestedIdeMode('?mode=launcher')).toBeNull();
    expect(resolveRequestedIdeMode('')).toBeNull();
  });

  it('defaults initial mode to project when no explicit mode is present', () => {
    expect(resolveInitialIdeModeFromSearch('')).toBe('project');
  });

  it('routes restored sessions back to project home unless the URL asks for a mode', () => {
    expect(resolveRestoredIdeMode('')).toBe('project');
    expect(resolveRestoredIdeMode('?mode=hardware')).toBe('hardware');
  });
});
