import { describe, expect, it } from 'vitest';
import {
  estimated,
  isExact,
  lessThan,
  nutrientSet,
  reported,
  scaleNutrients,
  sumNutrients,
  UNKNOWN,
  upperBound,
} from './nutrients.js';

/** Fixture from the screenshot example: not a verified product record. */
export const SHAKE_FIXTURE = nutrientSet({
  protein: reported('30'),
  carbs: reported('15'),
  fiber: reported('5'),
});

describe('nutrient scaling (N02 shake fixture)', () => {
  it('scales known values at 1.5 servings and keeps fat and sugar unknown', () => {
    const scaled = scaleNutrients(SHAKE_FIXTURE, '1.5');
    expect(scaled.protein).toEqual({ status: 'reported', amount: '45' });
    expect(scaled.carbs).toEqual({ status: 'reported', amount: '22.5' });
    expect(scaled.fiber).toEqual({ status: 'reported', amount: '7.5' });
    expect(scaled.fat).toEqual({ status: 'unknown' });
    expect(scaled.sugar).toEqual({ status: 'unknown' });
    expect(scaled.calories).toEqual({ status: 'unknown' });
  });

  it('scales a less-than bound as a bound and an estimate as an estimate', () => {
    const set = nutrientSet({ fiber: lessThan('1'), sugar: estimated('4') });
    const scaled = scaleNutrients(set, '2');
    expect(scaled.fiber).toEqual({ status: 'less-than', amount: '2' });
    expect(scaled.sugar).toEqual({ status: 'estimated', amount: '8' });
  });
});

describe('nutrient totals (N04, N11)', () => {
  it('keeps zero, missing and less-than distinct', () => {
    const beer = nutrientSet({ carbs: reported('12'), sugar: UNKNOWN, fiber: reported('0') });
    const yogurt = nutrientSet({ carbs: reported('6'), sugar: reported('5'), fiber: lessThan('1') });
    const totals = sumNutrients([beer, yogurt]);

    expect(totals.carbs.known).toBe('18');
    expect(totals.carbs.complete).toBe(true);

    expect(totals.sugar.known).toBe('5');
    expect(totals.sugar.unknownCount).toBe(1);
    expect(totals.sugar.complete).toBe(false);

    expect(totals.fiber.known).toBe('0');
    expect(totals.fiber.lessThanCount).toBe(1);
    expect(totals.fiber.lessThanBound).toBe('1');
    expect(upperBound(totals.fiber)).toBe('1');
    expect(totals.fiber.complete).toBe(false);
  });

  it('marks totals containing an estimate as approximate but numeric', () => {
    const totals = sumNutrients([nutrientSet({ protein: reported('80') }), nutrientSet({ protein: estimated('2') })]);
    expect(totals.protein.known).toBe('82');
    expect(totals.protein.hasEstimate).toBe(true);
    expect(totals.protein.complete).toBe(true);
    expect(isExact(totals.protein)).toBe(false);
  });

  it('an empty day has complete but empty totals', () => {
    const totals = sumNutrients([]);
    expect(totals.protein.known).toBe('0');
    expect(totals.protein.itemCount).toBe(0);
    expect(totals.protein.complete).toBe(true);
  });
});
