import { describe, expect, it } from 'vitest';
import { contextSuggestions, macroFitIdeas } from './suggest.js';
import { nutrientSet, reported } from './nutrients.js';

describe('contextSuggestions', () => {
  const now = new Date('2026-09-18T12:00:00Z');
  it('prefers recent, repeated, same-slot foods and caps at three', () => {
    const history = [
      { foodId: 'shake', occurredAt: '2026-09-17T12:00:00Z', mealSlot: 'lunch' as const },
      { foodId: 'shake', occurredAt: '2026-09-16T12:00:00Z', mealSlot: 'lunch' as const },
      { foodId: 'eggs', occurredAt: '2026-09-17T08:00:00Z', mealSlot: 'breakfast' as const },
      { foodId: 'salad', occurredAt: '2026-08-01T12:00:00Z', mealSlot: 'lunch' as const },
      { foodId: 'soup', occurredAt: '2026-09-17T12:30:00Z', mealSlot: 'lunch' as const },
      { foodId: 'apple', occurredAt: '2026-09-17T15:00:00Z', mealSlot: 'snack' as const },
    ];
    const result = contextSuggestions(history, { now, mealSlot: 'lunch' });
    expect(result).toHaveLength(3);
    expect(result[0]?.foodId).toBe('shake');
    expect(result.map((r) => r.foodId)).not.toContain('salad');
  });

  it('honors exclusions', () => {
    const history = [{ foodId: 'shake', occurredAt: '2026-09-17T12:00:00Z', mealSlot: 'lunch' as const }];
    expect(contextSuggestions(history, { now, mealSlot: 'lunch', excludeFoodIds: ['shake'] })).toEqual([]);
  });
});

describe('macroFitIdeas (5.5, 11)', () => {
  const targets = { protein: '140', carbs: '130', fat: '45' };
  it('returns transparent arithmetic and rejects candidates missing a macro', () => {
    const ideas = macroFitIdeas({
      remaining: { protein: '30', carbs: '20', fat: '10' },
      targets,
      candidates: [
        { id: 'yogurt', name: 'Greek yogurt', nutrients: nutrientSet({ protein: reported('20'), carbs: reported('8'), fat: reported('0')}) },
        { id: 'shake', name: 'My shake', nutrients: nutrientSet({ protein: reported('30'), carbs: reported('15') }) },
        { id: 'cake', name: 'Cake', nutrients: nutrientSet({ protein: reported('4'), carbs: reported('60'), fat: reported('20') }) },
      ],
    });
    expect(ideas.map((i) => i.candidateId)).not.toContain('shake');
    expect(ideas[0]?.candidateId).toBe('yogurt');
    expect(ideas[0]?.multiple).toBe('1.5');
    expect(ideas[0]?.adds).toEqual({ protein: '30', carbs: '12', fat: '0' });
    expect(ideas[0]?.remainingAfter).toEqual({ protein: '0', carbs: '8', fat: '10' });
  });

  it('returns nothing when there are no eligible candidates', () => {
    expect(macroFitIdeas({ remaining: { protein: '1', carbs: '1', fat: '1' }, targets, candidates: [] })).toEqual([]);
  });
});
