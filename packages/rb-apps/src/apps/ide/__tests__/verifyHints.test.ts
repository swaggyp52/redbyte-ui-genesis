/**
 * Unit tests for getVerifyHint() fact-grounded selection logic.
 *
 * Each test proves:
 *   1. The triggering context fires the expected hint (non-null, contains key phrase)
 *   2. A minimal baseline context (all flags false/null) fires nothing — no false positives
 *
 * Priority rule: first matching hint wins. Tests verify the correct hint fires
 * even when multiple conditions could theoretically be true.
 */

import { describe, it, expect } from 'vitest';
import { getVerifyHint, type VerifyHintContext } from '../verifyHints';

/** All-false baseline — no hint should fire on this context */
const BASE: VerifyHintContext = {
  hasDff: false,
  mappingComplete: true,
  allTicksFail: false,
  onlyFirstTickFails: false,
  mismatch: null,
  hasFloatingOutputWarning: false,
};

describe('getVerifyHint — baseline', () => {
  it('returns null when no condition is triggered', () => {
    expect(getVerifyHint(BASE)).toBeNull();
  });
});

describe('getVerifyHint — Hint 1: unmapped pins', () => {
  it('fires when mappingComplete is false', () => {
    const ctx: VerifyHintContext = { ...BASE, mappingComplete: false };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toBeNull();
    expect(hint).toContain('pins are not mapped');
  });

  it('does NOT fire when mappingComplete is true', () => {
    const hint = getVerifyHint({ ...BASE, mappingComplete: true });
    expect(hint).toBeNull();
  });

  it('fires before floating-output hint when both conditions are true (priority)', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      mappingComplete: false,
      hasFloatingOutputWarning: true,
    };
    const hint = getVerifyHint(ctx);
    expect(hint).toContain('pins are not mapped');
  });
});

describe('getVerifyHint — Hint 2: floating/undriven output', () => {
  it('fires when hasFloatingOutputWarning is true', () => {
    const ctx: VerifyHintContext = { ...BASE, hasFloatingOutputWarning: true };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toBeNull();
    expect(hint).toContain('undriven');
  });

  it('does NOT fire when hasFloatingOutputWarning is false', () => {
    expect(getVerifyHint({ ...BASE, hasFloatingOutputWarning: false })).toBeNull();
  });
});

describe('getVerifyHint — Hint 3: all ticks fail', () => {
  it('fires when allTicksFail is true', () => {
    const ctx: VerifyHintContext = { ...BASE, allTicksFail: true };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toBeNull();
    expect(hint).toContain('Every tick fails');
  });

  it('does NOT fire when only some ticks fail', () => {
    const ctx: VerifyHintContext = { ...BASE, allTicksFail: false, mismatch: { expected: '1', actual: '0' } };
    // hasDff is false, so hint 7 fires instead
    const hint = getVerifyHint(ctx);
    expect(hint).not.toContain('Every tick fails');
  });
});

describe('getVerifyHint — Hint 4: only first tick fails', () => {
  it('fires when onlyFirstTickFails is true', () => {
    const ctx: VerifyHintContext = { ...BASE, onlyFirstTickFails: true };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toBeNull();
    expect(hint).toContain('first tick fails');
  });

  it('does NOT fire when other ticks also fail', () => {
    expect(getVerifyHint({ ...BASE, onlyFirstTickFails: false })).toBeNull();
  });

  it('fires before DFF hints when DFF is also present (priority)', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      hasDff: true,
      onlyFirstTickFails: true,
      mismatch: { expected: '1', actual: '0' },
    };
    const hint = getVerifyHint(ctx);
    expect(hint).toContain('first tick fails');
  });
});

describe('getVerifyHint — Hint 5: DFF output should be HIGH but is LOW', () => {
  it('fires when hasDff=true, expected="1", actual="0"', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      hasDff: true,
      mismatch: { expected: '1', actual: '0' },
    };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toBeNull();
    expect(hint).toContain('Output should be HIGH but is LOW');
  });

  it('does NOT fire for combinational circuit (hasDff=false)', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      hasDff: false,
      mismatch: { expected: '1', actual: '0' },
    };
    const hint = getVerifyHint(ctx);
    // Hint 7 (combinational mismatch) fires instead
    expect(hint).not.toContain('Output should be HIGH but is LOW');
    expect(hint).toContain('Combinational mismatch');
  });

  it('does NOT fire when direction is reversed (expected=0, actual=1)', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      hasDff: true,
      mismatch: { expected: '0', actual: '1' },
    };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toContain('Output should be HIGH but is LOW');
  });
});

describe('getVerifyHint — Hint 6: DFF output should be LOW but is HIGH', () => {
  it('fires when hasDff=true, expected="0", actual="1"', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      hasDff: true,
      mismatch: { expected: '0', actual: '1' },
    };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toBeNull();
    expect(hint).toContain('Output should be LOW but is HIGH');
  });

  it('does NOT fire when direction is reversed (expected=1, actual=0)', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      hasDff: true,
      mismatch: { expected: '1', actual: '0' },
    };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toContain('Output should be LOW but is HIGH');
  });

  it('does NOT fire when mismatch is null', () => {
    expect(getVerifyHint({ ...BASE, hasDff: true, mismatch: null })).toBeNull();
  });
});

describe('getVerifyHint — Hint 7: combinational mismatch', () => {
  it('fires when hasDff=false and mismatch is non-null (1→0 direction)', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      hasDff: false,
      mismatch: { expected: '1', actual: '0' },
    };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toBeNull();
    expect(hint).toContain('Combinational mismatch');
  });

  it('fires when hasDff=false and mismatch is non-null (0→1 direction)', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      hasDff: false,
      mismatch: { expected: '0', actual: '1' },
    };
    const hint = getVerifyHint(ctx);
    expect(hint).toContain('Combinational mismatch');
  });

  it('does NOT fire when hasDff=true (DFF hints take precedence)', () => {
    const ctx: VerifyHintContext = {
      ...BASE,
      hasDff: true,
      mismatch: { expected: '1', actual: '0' },
    };
    const hint = getVerifyHint(ctx);
    expect(hint).not.toContain('Combinational mismatch');
  });

  it('does NOT fire when mismatch is null', () => {
    expect(getVerifyHint({ ...BASE, hasDff: false, mismatch: null })).toBeNull();
  });
});
