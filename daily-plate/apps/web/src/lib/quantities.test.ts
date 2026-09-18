import { describe, expect, it } from 'vitest';
import { parsePhrase } from '@daily-plate/domain';
import type { FoodVersion } from '@daily-plate/contracts';
import { quantityForPhrase } from './quantities.js';

const base: Omit<FoodVersion, 'basis' | 'portions' | 'defaultQuantity'> = {
  id: 'v1',
  foodId: 'f1',
  version: 1,
  name: 'x',
  preparation: 'unspecified',
  nutrients: { protein: { status: 'unknown' }, carbs: { status: 'unknown' }, fat: { status: 'unknown' }, fiber: { status: 'unknown' }, sugar: { status: 'unknown' }, calories: { status: 'unknown' } },
  provenance: { provider: 'user', fetchedAt: '2026-09-18T00:00:00.000Z', normalizationVersion: 'user-1' },
  createdAt: '2026-09-18T00:00:00.000Z',
};

describe('quantityForPhrase', () => {
  it('"2 eggs" uses the egg portion even when the food was last logged in grams', () => {
    const eggs: FoodVersion = { ...base, basis: { kind: 'per100g' }, portions: [{ id: 'large', name: 'large', grams: '50' }] };
    const r = quantityForPhrase(parsePhrase('2 eggs'), eggs, { pin: null, lastQuantity: { amount: '120', unit: { kind: 'mass', unit: 'g' } } });
    expect(r.quantity).toEqual({ amount: '2', unit: { kind: 'portion', portionId: 'large' } });
    expect(r.hint).toBeUndefined();
  });

  it('"half my shake" refers to the defined serving, not half a gram', () => {
    const shake: FoodVersion = { ...base, basis: { kind: 'serving', servingText: '1 bottle', servingMl: '325' }, portions: [{ id: 'bottle', name: 'bottle', servings: '1' }] };
    const r = quantityForPhrase(parsePhrase('half my shake'), shake, { pin: null, lastQuantity: { amount: '200', unit: { kind: 'volume', unit: 'ml' } } });
    expect(r.quantity).toEqual({ amount: '0.5', unit: { kind: 'portion', portionId: 'bottle' } });
  });

  it('a count for a grams-only food is not silently turned into grams', () => {
    const chicken: FoodVersion = { ...base, basis: { kind: 'per100g' }, portions: [], defaultQuantity: { amount: '100', unit: { kind: 'mass', unit: 'g' } } };
    const r = quantityForPhrase(parsePhrase('2 chicken'), chicken, { pin: null });
    expect(r.quantity).toEqual({ amount: '100', unit: { kind: 'mass', unit: 'g' } });
    expect(r.hint).toMatch(/of what/);
  });

  it('explicit units are honoured and a pinned count unit wins', () => {
    const shake: FoodVersion = { ...base, basis: { kind: 'serving', servingText: '1 bottle', servingMl: '325' }, portions: [{ id: 'bottle', name: 'bottle', servings: '1' }, { id: 'half', name: 'half bottle', servings: '0.5' }] };
    expect(quantityForPhrase(parsePhrase('250 ml shake'), shake).quantity).toEqual({ amount: '250', unit: { kind: 'volume', unit: 'ml' } });
    expect(quantityForPhrase(parsePhrase('2 shake'), shake, { pin: { order: 0, quantity: { amount: '1', unit: { kind: 'portion', portionId: 'half' } } } }).quantity).toEqual({ amount: '2', unit: { kind: 'portion', portionId: 'half' } });
    expect(quantityForPhrase(parsePhrase('shake'), shake, { pin: null, lastQuantity: { amount: '1.5', unit: { kind: 'serving' } } }).quantity).toEqual({ amount: '1.5', unit: { kind: 'serving' } });
  });
});
