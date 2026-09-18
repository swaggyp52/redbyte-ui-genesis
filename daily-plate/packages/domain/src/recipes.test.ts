import { describe, expect, it } from 'vitest';
import { calculateRecipe } from './recipes.js';
import { lessThan, nutrientSet, reported } from './nutrients.js';

describe('calculateRecipe (N09, 6.6)', () => {
  const lentils = nutrientSet({ protein: reported('9'), carbs: reported('20'), fat: reported('0.4'), fiber: reported('8'), sugar: reported('2'), calories: reported('116') });
  const oil = nutrientSet({ protein: reported('0'), carbs: reported('0'), fat: reported('100'), fiber: reported('0'), sugar: reported('0'), calories: reported('884') });

  it('divides batch totals by the declared yield', () => {
    // 500 g lentils (per 100 g basis => factor 5) + 20 g oil (factor 0.2), 6 bowls
    const r = calculateRecipe(
      [
        { nutrients: lentils, factor: '5' },
        { nutrients: oil, factor: '0.2' },
      ],
      '6',
    );
    expect(r.batch.protein).toEqual({ status: 'reported', amount: '45' });
    expect(r.batch.fat).toEqual({ status: 'reported', amount: '22' });
    expect(r.perServing.protein).toEqual({ status: 'reported', amount: '7.5' });
    expect(r.perServing.carbs).toEqual({ status: 'reported', amount: '16.666667' });
    expect(r.incomplete).toEqual([]);
  });

  it('does not invent a nutrient an ingredient is missing', () => {
    const stock = nutrientSet({ protein: reported('1'), carbs: reported('1') });
    const r = calculateRecipe([{ nutrients: lentils, factor: '1' }, { nutrients: stock, factor: '1' }], '2');
    expect(r.perServing.fat).toEqual({ status: 'unknown' });
    expect(r.incomplete).toEqual(['fat', 'fiber', 'sugar', 'calories']);
    expect(r.perServing.protein).toEqual({ status: 'reported', amount: '5' });
  });

  it('carries a less-than bound through as a bound', () => {
    const a = nutrientSet({ fiber: lessThan('1') });
    const b = nutrientSet({ fiber: reported('3') });
    const r = calculateRecipe([{ nutrients: a, factor: '1' }, { nutrients: b, factor: '1' }], '2');
    expect(r.perServing.fiber).toEqual({ status: 'less-than', amount: '2' });
  });

  it('rejects a non-positive yield', () => {
    expect(() => calculateRecipe([], '0')).toThrow();
  });
});
