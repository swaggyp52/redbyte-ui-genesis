import { div, mul, type Decimal } from './decimal.js';

/**
 * Nutrient basis: what the stored nutrient numbers describe.
 * - serving: the label's stated serving (with optional known mass/volume)
 * - per100g: per 100 grams (typical USDA/OFF representation)
 * - per100ml: per 100 millilitres (beverages)
 */
export type NutrientBasis =
  | { kind: 'serving'; servingText: string; servingGrams?: Decimal; servingMl?: Decimal }
  | { kind: 'per100g' }
  | { kind: 'per100ml' };

export type Preparation = 'unspecified' | 'as-sold' | 'raw' | 'cooked' | 'dry' | 'prepared' | 'drained' | 'undrained';

export const PREPARATION_LABELS: Record<Preparation, string> = {
  unspecified: '',
  'as-sold': 'as sold',
  raw: 'raw',
  cooked: 'cooked',
  dry: 'dry',
  prepared: 'prepared',
  drained: 'drained',
  undrained: 'undrained',
};

/**
 * A named portion belongs to one food version. "Bottle" for her shake is not
 * "bottle" for a beer. Exactly one of the relationships must be present.
 */
export interface Portion {
  id: string;
  name: string;
  /** Multiple of the serving basis (serving basis only). */
  servings?: Decimal;
  grams?: Decimal;
  ml?: Decimal;
}

export type QuantityUnit =
  | { kind: 'serving' }
  | { kind: 'portion'; portionId: string }
  | { kind: 'mass'; unit: 'g' | 'oz' }
  | { kind: 'volume'; unit: 'ml' | 'floz' };

export interface Quantity {
  amount: Decimal;
  unit: QuantityUnit;
}

export const GRAMS_PER_OUNCE: Decimal = '28.349523125';
export const ML_PER_FLUID_OUNCE: Decimal = '29.5735295625';

export interface FoodQuantityContext {
  basis: NutrientBasis;
  portions: Portion[];
}

export type ResolveError =
  | { code: 'unknown-portion'; message: string }
  | { code: 'incompatible-unit'; message: string }
  | { code: 'density-required'; message: string };

export type ResolveResult = { ok: true; factor: Decimal; label: string } | { ok: false; error: ResolveError };

function fail(code: ResolveError['code'], message: string): ResolveResult {
  return { ok: false, error: { code, message } };
}

/** Converts a mass quantity to grams. */
export function toGrams(amount: Decimal, unit: 'g' | 'oz'): Decimal {
  return unit === 'g' ? amount : mul(amount, GRAMS_PER_OUNCE);
}

/** Converts a volume quantity to millilitres. */
export function toMl(amount: Decimal, unit: 'ml' | 'floz'): Decimal {
  return unit === 'ml' ? amount : mul(amount, ML_PER_FLUID_OUNCE);
}

/** How many times the nutrient basis a mass of `grams` represents. */
function gramsToFactor(basis: NutrientBasis, grams: Decimal): ResolveResult {
  switch (basis.kind) {
    case 'per100g':
      return { ok: true, factor: div(grams, '100'), label: `${grams} g` };
    case 'serving':
      if (!basis.servingGrams) {
        return fail('incompatible-unit', 'This food does not say how many grams one serving is.');
      }
      return { ok: true, factor: div(grams, basis.servingGrams), label: `${grams} g` };
    case 'per100ml':
      return fail('density-required', 'This food is measured by volume; grams cannot be converted without a density.');
  }
}

function mlToFactor(basis: NutrientBasis, ml: Decimal): ResolveResult {
  switch (basis.kind) {
    case 'per100ml':
      return { ok: true, factor: div(ml, '100'), label: `${ml} ml` };
    case 'serving':
      if (!basis.servingMl) {
        return fail('incompatible-unit', 'This food does not say how many millilitres one serving is.');
      }
      return { ok: true, factor: div(ml, basis.servingMl), label: `${ml} ml` };
    case 'per100g':
      return fail('density-required', 'This food is measured by weight; millilitres cannot be converted without a density.');
  }
}

/**
 * Resolves a quantity to the factor by which the food version's nutrient
 * basis must be multiplied. Never converts mass to volume or vice versa.
 */
export function resolveQuantity(food: FoodQuantityContext, quantity: Quantity): ResolveResult {
  const { amount, unit } = quantity;
  switch (unit.kind) {
    case 'serving': {
      if (food.basis.kind !== 'serving') {
        return fail('incompatible-unit', 'This food has no stated serving; use grams or a saved portion.');
      }
      return { ok: true, factor: amount, label: `${amount} × ${food.basis.servingText}` };
    }
    case 'portion': {
      const portion = food.portions.find((p) => p.id === unit.portionId);
      if (!portion) return fail('unknown-portion', 'That portion is not saved for this food.');
      const label = `${amount} ${portion.name}`;
      if (portion.servings !== undefined) {
        if (food.basis.kind !== 'serving') return fail('incompatible-unit', 'Portion is in servings but this food has no serving basis.');
        return { ok: true, factor: mul(amount, portion.servings), label };
      }
      if (portion.grams !== undefined) {
        const r = gramsToFactor(food.basis, mul(amount, portion.grams));
        return r.ok ? { ...r, label } : r;
      }
      if (portion.ml !== undefined) {
        const r = mlToFactor(food.basis, mul(amount, portion.ml));
        return r.ok ? { ...r, label } : r;
      }
      return fail('unknown-portion', 'That portion has no size.');
    }
    case 'mass': {
      const r = gramsToFactor(food.basis, toGrams(amount, unit.unit));
      return r.ok ? { ...r, label: `${amount} ${unit.unit}` } : r;
    }
    case 'volume': {
      const r = mlToFactor(food.basis, toMl(amount, unit.unit));
      return r.ok ? { ...r, label: `${amount} ${unit.unit === 'floz' ? 'fl oz' : 'ml'}` } : r;
    }
  }
}

export function unitLabel(unit: QuantityUnit, portions: Portion[]): string {
  switch (unit.kind) {
    case 'serving':
      return 'serving';
    case 'portion':
      return portions.find((p) => p.id === unit.portionId)?.name ?? 'portion';
    case 'mass':
      return unit.unit;
    case 'volume':
      return unit.unit === 'floz' ? 'fl oz' : 'ml';
  }
}
