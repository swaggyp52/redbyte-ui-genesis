import { describe, expect, it } from 'vitest';
import { defaultMealSlot, findRepeatedCombinations } from './meals.js';

describe('repeated combinations (5.4)', () => {
  const day = (d: string, slot: 'breakfast' | 'lunch', ids: string[]) => ids.map((foodId) => ({ localDate: d, mealSlot: slot, foodId }));

  it('offers a combination after three separate days, not three same-day logs', () => {
    const occ = [
      ...day('2026-09-01', 'breakfast', ['eggs', 'toast']),
      ...day('2026-09-02', 'breakfast', ['eggs', 'toast']),
      ...day('2026-09-02', 'breakfast', ['eggs', 'toast']),
    ];
    expect(findRepeatedCombinations(occ)).toEqual([]);
    const three = [...occ, ...day('2026-09-05', 'breakfast', ['toast', 'eggs'])];
    const found = findRepeatedCombinations(three);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ foodIds: ['eggs', 'toast'], mealSlot: 'breakfast', dates: ['2026-09-01', '2026-09-02', '2026-09-05'] });
  });

  it('respects dismissals and ignores single foods', () => {
    const occ = [
      ...day('2026-09-01', 'lunch', ['eggs', 'toast']),
      ...day('2026-09-02', 'lunch', ['eggs', 'toast']),
      ...day('2026-09-03', 'lunch', ['eggs', 'toast']),
      ...day('2026-09-01', 'breakfast', ['shake']),
      ...day('2026-09-02', 'breakfast', ['shake']),
      ...day('2026-09-03', 'breakfast', ['shake']),
    ];
    expect(findRepeatedCombinations(occ, ['lunch:eggs,toast'])).toEqual([]);
    expect(findRepeatedCombinations(occ)).toHaveLength(1);
  });

  it('defaults meal slot by hour', () => {
    expect(defaultMealSlot(7)).toBe('breakfast');
    expect(defaultMealSlot(12)).toBe('lunch');
    expect(defaultMealSlot(15)).toBe('snack');
    expect(defaultMealSlot(19)).toBe('dinner');
    expect(defaultMealSlot(22)).toBe('snack');
  });
});
