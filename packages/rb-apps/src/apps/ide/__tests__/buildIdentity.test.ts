import { describe, expect, it } from 'vitest';
import { resolveIdeBuildIdentity } from '../buildIdentity';

describe('resolveIdeBuildIdentity', () => {
  it('uses the build git sha as the visible release marker', () => {
    const identity = resolveIdeBuildIdentity({
      gitSha: 'fb5063a8d2f8440570cb4809af3f311c7f3af2db',
      buildDate: '2026-03-09',
      mode: 'production',
    });

    expect(identity.shortSha).toBe('fb5063a');
    expect(identity.fullSha).toBe('fb5063a8d2f8440570cb4809af3f311c7f3af2db');
    expect(identity.envLabel).toBe('prod');
    expect(identity.title).toContain('Build fb5063a');
  });

  it('falls back to a dev label when no build metadata is available', () => {
    const identity = resolveIdeBuildIdentity({
      gitSha: '',
      buildDate: '',
      mode: 'development',
    });

    expect(identity.shortSha).toBe('dev');
    expect(identity.envLabel).toBe('dev');
  });
});
