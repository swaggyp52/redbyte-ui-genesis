import { add, cmp, mul, type Decimal } from './decimal.js';

export const NUTRIENT_KEYS = ['protein', 'carbs', 'fat', 'fiber', 'sugar', 'calories'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** The three macros the user set explicit daily targets for. */
export const MACRO_KEYS = ['protein', 'carbs', 'fat'] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  fiber: 'Fiber',
  sugar: 'Sugar',
  calories: 'Calories',
};

export const NUTRIENT_UNITS: Record<NutrientKey, string> = {
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  fiber: 'g',
  sugar: 'g',
  calories: 'kcal',
};

/**
 * A nutrient value is never a bare number. Unknown is not zero; "less than 1 g"
 * is an upper bound, not 0 or 0.5; an estimate stays labeled as an estimate.
 */
export type NutrientValue =
  | { status: 'reported'; amount: Decimal }
  | { status: 'estimated'; amount: Decimal }
  | { status: 'less-than'; amount: Decimal }
  | { status: 'unknown' };

export type NutrientStatus = NutrientValue['status'];

export type NutrientSet = Record<NutrientKey, NutrientValue>;

export const UNKNOWN: NutrientValue = { status: 'unknown' };

export function reported(amount: Decimal | number): NutrientValue {
  return { status: 'reported', amount: String(amount) };
}
export function estimated(amount: Decimal | number): NutrientValue {
  return { status: 'estimated', amount: String(amount) };
}
export function lessThan(amount: Decimal | number): NutrientValue {
  return { status: 'less-than', amount: String(amount) };
}

/** Builds a NutrientSet; any key not provided is explicitly unknown. */
export function nutrientSet(partial: Partial<NutrientSet>): NutrientSet {
  const out = {} as NutrientSet;
  for (const key of NUTRIENT_KEYS) out[key] = partial[key] ?? UNKNOWN;
  return out;
}

export function hasAmount(v: NutrientValue): v is Exclude<NutrientValue, { status: 'unknown' }> {
  return v.status !== 'unknown';
}

/** Scales one value by a factor. Unknown stays unknown; a bound stays a bound. */
export function scaleValue(value: NutrientValue, factor: Decimal | number): NutrientValue {
  if (value.status === 'unknown') return value;
  return { status: value.status, amount: mul(value.amount, factor) };
}

export function scaleNutrients(set: NutrientSet, factor: Decimal | number): NutrientSet {
  const out = {} as NutrientSet;
  for (const key of NUTRIENT_KEYS) out[key] = scaleValue(set[key], factor);
  return out;
}

/**
 * The aggregated state of one nutrient across several items. `known` is the
 * sum of reported and estimated amounts; `lessThanBound` is the sum of
 * less-than upper bounds; `unknownCount` says how many items contributed
 * nothing. `complete` is true only when every item had an exact or estimated
 * amount.
 */
export interface NutrientTotal {
  known: Decimal;
  hasEstimate: boolean;
  unknownCount: number;
  lessThanCount: number;
  lessThanBound: Decimal;
  itemCount: number;
  complete: boolean;
}

export type NutrientTotals = Record<NutrientKey, NutrientTotal>;

export function emptyTotal(): NutrientTotal {
  return {
    known: '0',
    hasEstimate: false,
    unknownCount: 0,
    lessThanCount: 0,
    lessThanBound: '0',
    itemCount: 0,
    complete: true,
  };
}

export function addToTotal(total: NutrientTotal, value: NutrientValue): NutrientTotal {
  const next: NutrientTotal = { ...total, itemCount: total.itemCount + 1 };
  switch (value.status) {
    case 'reported':
      next.known = add(next.known, value.amount);
      break;
    case 'estimated':
      next.known = add(next.known, value.amount);
      next.hasEstimate = true;
      break;
    case 'less-than':
      next.lessThanCount += 1;
      next.lessThanBound = add(next.lessThanBound, value.amount);
      break;
    case 'unknown':
      next.unknownCount += 1;
      break;
  }
  next.complete = next.unknownCount === 0 && next.lessThanCount === 0;
  return next;
}

export function sumNutrients(sets: NutrientSet[]): NutrientTotals {
  const out = {} as NutrientTotals;
  for (const key of NUTRIENT_KEYS) {
    let total = emptyTotal();
    for (const set of sets) total = addToTotal(total, set[key]);
    out[key] = total;
  }
  return out;
}

/** Upper bound of a total: known plus all less-than bounds. */
export function upperBound(total: NutrientTotal): Decimal {
  return add(total.known, total.lessThanBound);
}

/**
 * True when a numeric total can be shown as exact. Estimates are still
 * shown numerically but flagged approximate by the caller.
 */
export function isExact(total: NutrientTotal): boolean {
  return total.complete && !total.hasEstimate;
}

/** Sorts nutrient values for deterministic display; utility for tests. */
export function compareValues(a: NutrientValue, b: NutrientValue): number {
  if (a.status === 'unknown' || b.status === 'unknown') return a.status === b.status ? 0 : a.status === 'unknown' ? 1 : -1;
  return cmp(a.amount, b.amount);
}
