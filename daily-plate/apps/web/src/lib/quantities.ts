import type { Food, FoodVersion, Quantity } from '@daily-plate/contracts';
import type { ParsedPhrase } from '@daily-plate/domain';

export interface PhraseQuantity {
  quantity: Quantity | undefined;
  hint?: string;
}

const isCountUnit = (u: Quantity['unit'] | undefined): u is Quantity['unit'] => Boolean(u && (u.kind === 'portion' || u.kind === 'serving'));

/**
 * Turns a typed quantity into a concrete quantity for one food.
 * A count ("2 eggs", "half my shake") means that many of the food's own unit:
 * a named portion or its serving. It never becomes grams because the food was
 * last logged by weight; when no piece/serving exists the amount is dropped
 * and a hint explains why.
 */
export function quantityForPhrase(parsed: ParsedPhrase, version: FoodVersion, food?: Pick<Food, 'pin' | 'lastQuantity'>): PhraseQuantity {
  const q = parsed.quantity;
  const base = food?.pin?.quantity ?? food?.lastQuantity ?? version.defaultQuantity;
  if (!q) return { quantity: base };
  switch (q.unit) {
    case 'count': {
      if (isCountUnit(base?.unit)) return { quantity: { amount: q.amount, unit: base!.unit } };
      const servingPortion = version.portions.find((p) => p.servings !== undefined) ?? version.portions[0];
      if (servingPortion) return { quantity: { amount: q.amount, unit: { kind: 'portion', portionId: servingPortion.id } } };
      if (version.basis.kind === 'serving') return { quantity: { amount: q.amount, unit: { kind: 'serving' } } };
      return { quantity: base, hint: `"${q.amount}" of what? This food has no piece or serving size, so choose grams or millilitres.` };
    }
    case 'serving':
      return { quantity: { amount: q.amount, unit: { kind: 'serving' } } };
    case 'g':
    case 'oz':
      return { quantity: { amount: q.amount, unit: { kind: 'mass', unit: q.unit } } };
    case 'ml':
    case 'floz':
      return { quantity: { amount: q.amount, unit: { kind: 'volume', unit: q.unit } } };
  }
}
