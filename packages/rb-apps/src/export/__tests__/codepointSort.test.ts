import { describe, expect, it } from 'vitest';
import { compareCodepoint, sortCodepoint, sortByCodepoint } from '../codepointSort';

describe('compareCodepoint', () => {
  it('returns -1, 0, 1 for less, equal, greater', () => {
    expect(compareCodepoint('a', 'b')).toBe(-1);
    expect(compareCodepoint('b', 'a')).toBe(1);
    expect(compareCodepoint('x', 'x')).toBe(0);
  });

  it('sorts uppercase before lowercase (ASCII order)', () => {
    // 'A' = 65, 'a' = 97 — codepoint puts uppercase first
    expect(compareCodepoint('A', 'a')).toBe(-1);
    expect(compareCodepoint('Z', 'a')).toBe(-1);
  });

  it('sorts digits before letters', () => {
    expect(compareCodepoint('0', 'A')).toBe(-1);
    expect(compareCodepoint('9', 'a')).toBe(-1);
  });

  it('handles empty strings', () => {
    expect(compareCodepoint('', '')).toBe(0);
    expect(compareCodepoint('', 'a')).toBe(-1);
    expect(compareCodepoint('a', '')).toBe(1);
  });

  it('is locale-independent for accented characters', () => {
    // In some locales, 'ä' sorts near 'a'. In codepoint order, 'ä' (U+00E4) > 'z' (U+007A)
    expect(compareCodepoint('ä', 'z')).toBe(1);
  });
});

describe('sortCodepoint', () => {
  it('sorts strings in codepoint order', () => {
    expect(sortCodepoint(['c', 'a', 'b'])).toEqual(['a', 'b', 'c']);
    expect(sortCodepoint(['sw[1]', 'sw[0]', 'sw[2]'])).toEqual(['sw[0]', 'sw[1]', 'sw[2]']);
  });

  it('produces stable ordering across runs', () => {
    const input = ['led[0]', 'LED[0]', 'sw[0]', 'SW[0]', 'clk', 'CLK'];
    const run1 = sortCodepoint([...input]);
    const run2 = sortCodepoint([...input]);
    expect(run1).toEqual(run2);
    // Uppercase before lowercase in codepoint order
    expect(run1).toEqual(['CLK', 'LED[0]', 'SW[0]', 'clk', 'led[0]', 'sw[0]']);
  });
});

describe('sortByCodepoint', () => {
  it('sorts objects by a key function', () => {
    const items = [
      { name: 'charlie', value: 3 },
      { name: 'alice', value: 1 },
      { name: 'bob', value: 2 },
    ];
    const sorted = sortByCodepoint(items, (item) => item.name);
    expect(sorted.map((i) => i.name)).toEqual(['alice', 'bob', 'charlie']);
  });
});
