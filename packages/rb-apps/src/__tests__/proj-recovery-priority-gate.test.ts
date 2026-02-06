// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Gate: Recovery priority order (autosave > workspace > none)

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Recovery mode decision logic (pure function for gate testing)
 */
export interface RecoveryContext {
  hasAutosaveRestore: boolean;
  hasWorkspaceCrash: boolean;
  autosaveDiscarded: boolean;
  autosaveRestored: boolean;
}

export type RecoveryMode = 'autosave' | 'workspace' | 'none';

export function decideRecoveryMode(ctx: RecoveryContext): RecoveryMode {
  // Priority 1: Autosave restore (data loss risk)
  if (ctx.hasAutosaveRestore && !ctx.autosaveDiscarded && !ctx.autosaveRestored) {
    return 'autosave';
  }

  // Priority 2: Workspace crash recovery (layout convenience)
  // Only show if autosave has been handled (restored or discarded) or never existed
  if (ctx.hasWorkspaceCrash && (ctx.autosaveRestored || ctx.autosaveDiscarded || !ctx.hasAutosaveRestore)) {
    return 'workspace';
  }

  // Priority 3: Nothing to recover
  return 'none';
}

describe('proj:recovery-priority-gate (pure deterministic gate)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-05T12:00:00.000Z'));
  });

  it('shows autosave when both autosave and workspace crash exist', () => {
    const ctx: RecoveryContext = {
      hasAutosaveRestore: true,
      hasWorkspaceCrash: true,
      autosaveDiscarded: false,
      autosaveRestored: false,
    };
    expect(decideRecoveryMode(ctx)).toBe('autosave');
  });

  it('shows workspace after autosave is discarded', () => {
    const ctx: RecoveryContext = {
      hasAutosaveRestore: true,
      hasWorkspaceCrash: true,
      autosaveDiscarded: true,
      autosaveRestored: false,
    };
    expect(decideRecoveryMode(ctx)).toBe('workspace');
  });

  it('shows workspace after autosave is restored', () => {
    const ctx: RecoveryContext = {
      hasAutosaveRestore: true,
      hasWorkspaceCrash: true,
      autosaveDiscarded: false,
      autosaveRestored: true,
    };
    expect(decideRecoveryMode(ctx)).toBe('workspace');
  });

  it('shows workspace when only crash exists (no autosave)', () => {
    const ctx: RecoveryContext = {
      hasAutosaveRestore: false,
      hasWorkspaceCrash: true,
      autosaveDiscarded: false,
      autosaveRestored: false,
    };
    expect(decideRecoveryMode(ctx)).toBe('workspace');
  });

  it('shows nothing when only autosave exists but was discarded', () => {
    const ctx: RecoveryContext = {
      hasAutosaveRestore: true,
      hasWorkspaceCrash: false,
      autosaveDiscarded: true,
      autosaveRestored: false,
    };
    expect(decideRecoveryMode(ctx)).toBe('none');
  });

  it('shows nothing when only autosave exists but was restored', () => {
    const ctx: RecoveryContext = {
      hasAutosaveRestore: true,
      hasWorkspaceCrash: false,
      autosaveDiscarded: false,
      autosaveRestored: true,
    };
    expect(decideRecoveryMode(ctx)).toBe('none');
  });

  it('shows nothing when neither autosave nor crash exists', () => {
    const ctx: RecoveryContext = {
      hasAutosaveRestore: false,
      hasWorkspaceCrash: false,
      autosaveDiscarded: false,
      autosaveRestored: false,
    };
    expect(decideRecoveryMode(ctx)).toBe('none');
  });

  it('shows autosave only once (does not re-show after discard)', () => {
    // Initial state: autosave available
    const ctx1: RecoveryContext = {
      hasAutosaveRestore: true,
      hasWorkspaceCrash: false,
      autosaveDiscarded: false,
      autosaveRestored: false,
    };
    expect(decideRecoveryMode(ctx1)).toBe('autosave');

    // After discard: should not show autosave again
    const ctx2: RecoveryContext = {
      ...ctx1,
      autosaveDiscarded: true,
    };
    expect(decideRecoveryMode(ctx2)).toBe('none');
  });

  it('suppresses workspace when autosave is active (mutual exclusion)', () => {
    const ctx: RecoveryContext = {
      hasAutosaveRestore: true,
      hasWorkspaceCrash: true,
      autosaveDiscarded: false,
      autosaveRestored: false,
    };
    
    // First decision: autosave wins
    expect(decideRecoveryMode(ctx)).toBe('autosave');

    // Verify workspace doesn't show while autosave is pending
    expect(decideRecoveryMode(ctx)).not.toBe('workspace');
  });

  it('allows workspace recovery after autosave flow completes', () => {
    // Scenario: User restores autosave, then encounters workspace crash prompt
    const steps = [
      // Step 1: Autosave shows first
      {
        hasAutosaveRestore: true,
        hasWorkspaceCrash: true,
        autosaveDiscarded: false,
        autosaveRestored: false,
      },
      // Step 2: User restores autosave
      {
        hasAutosaveRestore: true,
        hasWorkspaceCrash: true,
        autosaveDiscarded: false,
        autosaveRestored: true,
      },
    ];

    expect(decideRecoveryMode(steps[0])).toBe('autosave');
    expect(decideRecoveryMode(steps[1])).toBe('workspace');
  });

  it('maintains priority invariant across all state combinations', () => {
    // Exhaustive test: generate all 16 possible state combinations
    const allCombinations: RecoveryContext[] = [];
    for (const hasAutosave of [false, true]) {
      for (const hasCrash of [false, true]) {
        for (const discarded of [false, true]) {
          for (const restored of [false, true]) {
            allCombinations.push({
              hasAutosaveRestore: hasAutosave,
              hasWorkspaceCrash: hasCrash,
              autosaveDiscarded: discarded,
              autosaveRestored: restored,
            });
          }
        }
      }
    }

    // Verify priority invariant: autosave > workspace > none
    for (const ctx of allCombinations) {
      const mode = decideRecoveryMode(ctx);
      
      // If mode is 'autosave', must have autosave and not be handled
      if (mode === 'autosave') {
        expect(ctx.hasAutosaveRestore).toBe(true);
        expect(ctx.autosaveDiscarded).toBe(false);
        expect(ctx.autosaveRestored).toBe(false);
      }

      // If mode is 'workspace', autosave must be handled or absent
      if (mode === 'workspace') {
        expect(ctx.hasWorkspaceCrash).toBe(true);
        if (ctx.hasAutosaveRestore) {
          expect(ctx.autosaveDiscarded || ctx.autosaveRestored).toBe(true);
        }
      }

      // Mode must be one of the three valid values
      expect(['autosave', 'workspace', 'none']).toContain(mode);
    }
  });
});
