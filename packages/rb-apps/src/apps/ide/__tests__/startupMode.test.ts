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
    expect(resolveRequestedIdeMode('?mode=hq')).toBeNull();
    expect(resolveRequestedIdeMode('')).toBeNull();
  });

  it('defaults initial mode to project when no explicit mode is present', () => {
    expect(resolveInitialIdeModeFromSearch('')).toBe('project');
  });

  it('falls back initial mode to project when mode is invalid', () => {
    expect(resolveInitialIdeModeFromSearch('?mode=launcher')).toBe('project');
    expect(resolveInitialIdeModeFromSearch('?mode=hq')).toBe('project');
    expect(resolveInitialIdeModeFromSearch('?mode=')).toBe('project');
  });

  it('routes restored sessions back to project home unless the URL asks for a mode', () => {
    expect(resolveRestoredIdeMode('')).toBe('project');
    expect(resolveRestoredIdeMode('?mode=hardware')).toBe('hardware');
  });

  it('falls back restored mode to project when mode is invalid', () => {
    expect(resolveRestoredIdeMode('?mode=unsupported')).toBe('project');
  });
});
