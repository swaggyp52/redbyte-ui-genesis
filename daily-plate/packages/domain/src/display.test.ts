import { describe, expect, it } from 'vitest';
import { totalSentence, valueCopy } from './display.js';
import { estimated, lessThan, nutrientSet, reported, sumNutrients, UNKNOWN } from './nutrients.js';

describe('display copy (6.3)', () => {
  it('describes missing and bound values honestly', () => {
    const totals = sumNutrients([
      nutrientSet({ sugar: reported('12'), fiber: reported('9'), protein: reported('80') }),
      nutrientSet({ sugar: UNKNOWN, fiber: lessThan('1'), protein: estimated('2') }),
    ]);
    expect(totalSentence('sugar', totals.sugar)).toBe('Sugar: 12 g known — 1 item missing sugar');
    expect(totalSentence('fiber', totals.fiber)).toBe('Fiber: 9 g — plus less than 1 g');
    expect(totalSentence('protein', totals.protein)).toBe('Protein: about 82 g');
  });

  it('formats single values', () => {
    expect(valueCopy('fat', UNKNOWN)).toBe('not known yet');
    expect(valueCopy('fiber', lessThan('1'))).toBe('less than 1 g');
    expect(valueCopy('carbs', reported('22.5'))).toBe('22.5 g');
    expect(valueCopy('calories', reported('116.4'))).toBe('116 kcal');
  });
});
