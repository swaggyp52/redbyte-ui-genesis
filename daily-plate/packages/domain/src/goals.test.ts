import { describe, expect, it } from 'vitest';
import { DEFAULT_GOAL_TEMPLATE, macroProgress, snapshotForDay } from './goals.js';
import { emptyTotal, addToTotal, reported, UNKNOWN } from './nutrients.js';

describe('goal presets (N01)', () => {
  it('uses the exact stated values', () => {
    expect(DEFAULT_GOAL_TEMPLATE.rest).toEqual({ protein: '140', carbs: '130', fat: '45' });
    expect(DEFAULT_GOAL_TEMPLATE.training).toEqual({ protein: '145', carbs: '165', fat: '40' });
    expect(DEFAULT_GOAL_TEMPLATE.secondary).toEqual({});
  });

  it('snapshots the chosen day type without touching the template', () => {
    const snap = snapshotForDay(DEFAULT_GOAL_TEMPLATE, '2026-09-18', 'training', 1);
    expect(snap.targets.carbs).toBe('165');
    snap.targets.carbs = '999';
    expect(DEFAULT_GOAL_TEMPLATE.training.carbs).toBe('165');
  });
});

describe('macro progress', () => {
  it('reports remaining and over neutrally', () => {
    const t = addToTotal(emptyTotal(), reported('82'));
    const p = macroProgress(t, '140');
    expect(p.remaining).toBe('58');
    expect(p.over).toBe(false);
    expect(p.provisional).toBe(false);

    const over = macroProgress(addToTotal(emptyTotal(), reported('148')), '140');
    expect(over.over).toBe(true);
    expect(over.overBy).toBe('8');
    expect(over.remaining).toBe('-8');
    expect(over.fraction).toBe(1);
  });

  it('marks remaining provisional when an item is missing the nutrient', () => {
    let t = addToTotal(emptyTotal(), reported('20'));
    t = addToTotal(t, UNKNOWN);
    const p = macroProgress(t, '45');
    expect(p.remaining).toBe('25');
    expect(p.provisional).toBe(true);
  });
});
