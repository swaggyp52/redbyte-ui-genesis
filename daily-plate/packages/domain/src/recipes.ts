import { add, div, type Decimal } from './decimal.js';
import { NUTRIENT_KEYS, type NutrientKey, type NutrientSet, type NutrientValue, scaleNutrients } from './nutrients.js';

export interface RecipeIngredientInput {
  /** Nutrients of the ingredient's food version at its basis. */
  nutrients: NutrientSet;
  /** Factor by which the basis is multiplied for the amount used (from resolveQuantity). */
  factor: Decimal;
}

export interface RecipeCalculation {
  /** Nutrients for the whole batch. */
  batch: NutrientSet;
  /** Nutrients for one serving of the declared yield. */
  perServing: NutrientSet;
  /** Nutrients for which at least one ingredient had no value. */
  incomplete: NutrientKey[];
}

function combine(values: NutrientValue[]): NutrientValue {
  if (values.some((v) => v.status === 'unknown')) return { status: 'unknown' };
  let total: Decimal = '0';
  let anyLessThan = false;
  let anyEstimate = false;
  for (const v of values) {
    if (v.status === 'unknown') continue;
    total = add(total, v.amount);
    if (v.status === 'less-than') anyLessThan = true;
    if (v.status === 'estimated') anyEstimate = true;
  }
  if (anyLessThan) return { status: 'less-than', amount: total };
  if (anyEstimate) return { status: 'estimated', amount: total };
  return { status: 'reported', amount: total };
}

/**
 * Batch = sum of scaled ingredients. Per serving = batch / yield. Cooking
 * losses never invent nutrients: the recipe's nutrients are exactly the
 * ingredients', divided across the declared yield.
 */
export function calculateRecipe(ingredients: RecipeIngredientInput[], yieldServings: Decimal): RecipeCalculation {
  if (Number(yieldServings) <= 0) throw new Error('Recipe yield must be positive');
  const scaled = ingredients.map((i) => scaleNutrients(i.nutrients, i.factor));
  const batch = {} as NutrientSet;
  const perServing = {} as NutrientSet;
  const incomplete: NutrientKey[] = [];
  for (const key of NUTRIENT_KEYS) {
    const combined = combine(scaled.map((s) => s[key]));
    batch[key] = combined;
    perServing[key] = combined.status === 'unknown' ? combined : { status: combined.status, amount: div(combined.amount, yieldServings) };
    if (combined.status === 'unknown') incomplete.push(key);
  }
  return { batch, perServing, incomplete };
}
