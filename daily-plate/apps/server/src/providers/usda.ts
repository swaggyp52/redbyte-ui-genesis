import type { FoodCandidate, NutrientSetDto } from '@daily-plate/contracts';
import { normalize, type NutrientValue, type Preparation } from '@daily-plate/domain';

export const USDA_NORMALIZATION_VERSION = 'usda-1';
export const USDA_ATTRIBUTION = 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central (CC0).';

/** Subset of the documented search response shape. */
export interface UsdaSearchFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  gtinUpc?: string;
  foodNutrients?: Array<{ nutrientId?: number; nutrientName?: string; nutrientNumber?: string; unitName?: string; value?: number }>;
}

export interface UsdaSearchResponse {
  totalHits?: number;
  foods?: UsdaSearchFood[];
}

const NUTRIENT_NUMBERS = {
  protein: ['203'],
  fat: ['204'],
  carbs: ['205'],
  fiber: ['291'],
  sugar: ['269', '2000'],
  calories: ['208', '957', '958'],
} as const;

function pick(food: UsdaSearchFood, numbers: readonly string[], expectUnit: 'G' | 'KCAL'): NutrientValue {
  for (const number of numbers) {
    const n = food.foodNutrients?.find((x) => x.nutrientNumber === number);
    if (!n || typeof n.value !== 'number' || !Number.isFinite(n.value)) continue;
    const unit = (n.unitName ?? '').toUpperCase();
    if (expectUnit === 'G' && unit !== 'G') continue;
    if (expectUnit === 'KCAL' && unit !== 'KCAL') continue;
    return { status: 'reported', amount: normalize(Number(n.value.toFixed(3))) };
  }
  return { status: 'unknown' };
}

function preparationFrom(description: string): Preparation {
  const d = description.toLowerCase();
  if (/\braw\b/.test(d)) return 'raw';
  if (/\bcooked\b|\broasted\b|\bboiled\b|\bgrilled\b|\bbaked\b/.test(d)) return 'cooked';
  if (/\bdry\b|\buncooked\b/.test(d)) return 'dry';
  if (/\bprepared\b/.test(d)) return 'prepared';
  if (/\bdrained\b/.test(d)) return 'drained';
  return 'unspecified';
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Normalizes one USDA search hit. Search results report nutrients per 100 g
 * (per 100 ml for branded liquids stated in ml). Missing nutrients are unknown,
 * never zero.
 */
export function normalizeUsdaFood(food: UsdaSearchFood, fetchedAt = new Date().toISOString()): FoodCandidate {
  const warnings: string[] = [];
  const unit = (food.servingSizeUnit ?? '').toLowerCase();
  const liquid = unit === 'ml' || unit === 'mlt';
  const basis = liquid ? ({ kind: 'per100ml' } as const) : ({ kind: 'per100g' } as const);
  if (liquid) warnings.push('Values treated as per 100 ml for a liquid product; confirm against the label.');

  const nutrients: NutrientSetDto = {
    protein: pick(food, NUTRIENT_NUMBERS.protein, 'G'),
    carbs: pick(food, NUTRIENT_NUMBERS.carbs, 'G'),
    fat: pick(food, NUTRIENT_NUMBERS.fat, 'G'),
    fiber: pick(food, NUTRIENT_NUMBERS.fiber, 'G'),
    sugar: pick(food, NUTRIENT_NUMBERS.sugar, 'G'),
    calories: pick(food, NUTRIENT_NUMBERS.calories, 'KCAL'),
  };

  const portions: FoodCandidate['portions'] = [];
  let sourceServingText: string | undefined;
  if (typeof food.servingSize === 'number' && food.servingSize > 0 && (unit === 'g' || unit === 'grm' || liquid)) {
    const size = normalize(Number(food.servingSize.toFixed(3)));
    const household = food.householdServingFullText?.trim();
    const name = household && household.length > 0 ? household : `serving (${size} ${liquid ? 'ml' : 'g'})`;
    sourceServingText = `${household ? `${household} = ` : ''}${size} ${liquid ? 'ml' : 'g'}`;
    portions.push(liquid ? { id: 'serving', name, ml: size } : { id: 'serving', name, grams: size });
  }

  const brand = [food.brandName, food.brandOwner].filter((b): b is string => Boolean(b && b.trim()))[0];
  const candidate: FoodCandidate = {
    provider: 'usda',
    providerId: String(food.fdcId),
    name: food.dataType === 'Branded' ? titleCase(food.description.trim()) : food.description.trim(),
    preparation: preparationFrom(food.description),
    basis,
    nutrients,
    portions,
    attribution: USDA_ATTRIBUTION,
    normalizationVersion: USDA_NORMALIZATION_VERSION,
    needsLabelConfirmation: false,
    warnings,
  };
  if (brand) candidate.brand = titleCase(brand.trim());
  if (food.gtinUpc && /^\d{6,14}$/.test(food.gtinUpc)) candidate.barcode = food.gtinUpc;
  if (sourceServingText) candidate.sourceServingText = sourceServingText;
  void fetchedAt;
  return candidate;
}

export function normalizeUsdaSearch(body: unknown): FoodCandidate[] {
  const response = body as UsdaSearchResponse;
  if (!response || !Array.isArray(response.foods)) return [];
  return response.foods.filter((f): f is UsdaSearchFood => Boolean(f) && typeof f === 'object' && typeof f.fdcId === 'number' && typeof f.description === 'string').map((f) => normalizeUsdaFood(f));
}

export function usdaSearchUrl(query: string, apiKey: string, pageSize = 12): string {
  const u = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  u.searchParams.set('query', query);
  u.searchParams.set('pageSize', String(pageSize));
  u.searchParams.set('dataType', 'Foundation,SR Legacy,Branded');
  u.searchParams.set('api_key', apiKey);
  return u.toString();
}
