import { describe, expect, it } from 'vitest';
import { resolveQuantity, type FoodQuantityContext } from './quantities.js';
import { round } from './decimal.js';

const shake: FoodQuantityContext = {
  basis: { kind: 'serving', servingText: '1 bottle (325 ml)', servingMl: '325' },
  portions: [
    { id: 'bottle', name: 'bottle', servings: '1' },
    { id: 'half', name: 'half bottle', servings: '0.5' },
  ],
};

const chickenPer100g: FoodQuantityContext = {
  basis: { kind: 'per100g' },
  portions: [{ id: 'breast', name: 'breast', grams: '120' }],
};

const beerPer100ml: FoodQuantityContext = {
  basis: { kind: 'per100ml' },
  portions: [
    { id: 'bottle12', name: '12 fl oz bottle', ml: '354.882' },
    { id: 'can16', name: '16 fl oz can', ml: '473.176' },
  ],
};

describe('resolveQuantity (N05, N06)', () => {
  it('resolves servings and named portions for a serving basis', () => {
    expect(resolveQuantity(shake, { amount: '1.5', unit: { kind: 'serving' } })).toMatchObject({ ok: true, factor: '1.5' });
    expect(resolveQuantity(shake, { amount: '1', unit: { kind: 'portion', portionId: 'half' } })).toMatchObject({ ok: true, factor: '0.5' });
    expect(resolveQuantity(shake, { amount: '2', unit: { kind: 'portion', portionId: 'bottle' } })).toMatchObject({ ok: true, factor: '2', label: '2 bottle' });
  });

  it('resolves grams and ounces against per-100 g without double scaling', () => {
    expect(resolveQuantity(chickenPer100g, { amount: '150', unit: { kind: 'mass', unit: 'g' } })).toMatchObject({ ok: true, factor: '1.5' });
    const oz = resolveQuantity(chickenPer100g, { amount: '4', unit: { kind: 'mass', unit: 'oz' } });
    expect(oz.ok).toBe(true);
    if (oz.ok) expect(round(oz.factor, 4)).toBe('1.134');
    expect(resolveQuantity(chickenPer100g, { amount: '1', unit: { kind: 'portion', portionId: 'breast' } })).toMatchObject({ ok: true, factor: '1.2' });
  });

  it('distinguishes a 12 fl oz bottle from a 16 fl oz can (N03)', () => {
    const bottle = resolveQuantity(beerPer100ml, { amount: '2', unit: { kind: 'portion', portionId: 'bottle12' } });
    const can = resolveQuantity(beerPer100ml, { amount: '2', unit: { kind: 'portion', portionId: 'can16' } });
    expect(bottle.ok && can.ok).toBe(true);
    if (bottle.ok && can.ok) {
      expect(round(bottle.factor, 3)).toBe('7.098');
      expect(round(can.factor, 3)).toBe('9.464');
      expect(bottle.factor).not.toBe(can.factor);
    }
  });

  it('refuses mass/volume conversion without a density', () => {
    expect(resolveQuantity(beerPer100ml, { amount: '100', unit: { kind: 'mass', unit: 'g' } })).toMatchObject({ ok: false, error: { code: 'density-required' } });
    expect(resolveQuantity(chickenPer100g, { amount: '100', unit: { kind: 'volume', unit: 'ml' } })).toMatchObject({ ok: false, error: { code: 'density-required' } });
  });

  it('refuses grams for a serving basis with no serving mass', () => {
    expect(resolveQuantity(shake, { amount: '100', unit: { kind: 'mass', unit: 'g' } })).toMatchObject({ ok: false, error: { code: 'incompatible-unit' } });
    const ml = resolveQuantity(shake, { amount: '650', unit: { kind: 'volume', unit: 'ml' } });
    expect(ml).toMatchObject({ ok: true, factor: '2' });
  });

  it('refuses unknown portions and servings on a per-100 basis', () => {
    expect(resolveQuantity(shake, { amount: '1', unit: { kind: 'portion', portionId: 'nope' } })).toMatchObject({ ok: false, error: { code: 'unknown-portion' } });
    expect(resolveQuantity(chickenPer100g, { amount: '1', unit: { kind: 'serving' } })).toMatchObject({ ok: false, error: { code: 'incompatible-unit' } });
  });
});
