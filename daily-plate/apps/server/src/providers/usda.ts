import type { FoodCandidate, NutrientSetDto, Portion } from '@daily-plate/contracts';
import { div, normalize, type NutrientValue, type Preparation } from '@daily-plate/domain';

export const USDA_NORMALIZATION_VERSION = 'usda-2';
export const USDA_ATTRIBUTION = 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central (CC0).';
/** Documented data types: reference foods, legacy reference, survey foods (FNDDS) and manufacturer labels. */
export const USDA_DATA_TYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'] as const;
export const USDA_PAGE_SIZE = 10;

/* ---------- documented response shapes (subset) ---------- */

export interface UsdaSearchNutrient {
  nutrientId?: number;
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
}

export interface UsdaDetailNutrient {
  nutrient?: { id?: number; number?: string; name?: string; unitName?: string };
  amount?: number;
}

export interface UsdaFoodPortion {
  id?: number;
  amount?: number;
  gramWeight?: number;
  portionDescription?: string;
  modifier?: string;
  measureUnit?: { id?: number; name?: string; abbreviation?: string };
  sequenceNumber?: number;
}

export interface UsdaFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  gtinUpc?: string;
  publicationDate?: string;
  /** Search hits use the flat shape; detail records use the nested shape. */
  foodNutrients?: Array<UsdaSearchNutrient | UsdaDetailNutrient>;
  foodPortions?: UsdaFoodPortion[];
  labelNutrients?: Record<string, { value?: number } | undefined>;
}

export interface UsdaSearchResponse {
  totalHits?: number;
  currentPage?: number;
  totalPages?: number;
  foods?: UsdaFood[];
}

const NUTRIENT_NUMBERS = {
  protein: ['203'],
  fat: ['204'],
  carbs: ['205'],
  fiber: ['291'],
  sugar: ['269', '2000'],
  calories: ['208', '957', '958'],
} as const;

/** Nutrient ids for the same fields, used when a record carries ids but no numbers. */
const NUTRIENT_IDS = {
  protein: [1003],
  fat: [1004],
  carbs: [1005],
  fiber: [1079],
  sugar: [1063, 2000],
  calories: [1008, 2047, 2048],
} as const;

interface FlatNutrient {
  number: string | undefined;
  id: number | undefined;
  unit: string;
  value: number | undefined;
}

function flatten(n: UsdaSearchNutrient | UsdaDetailNutrient): FlatNutrient {
  if ('nutrient' in n && n.nutrient) {
    return { number: n.nutrient.number, id: n.nutrient.id, unit: (n.nutrient.unitName ?? '').toUpperCase(), value: n.amount };
  }
  const s = n as UsdaSearchNutrient;
  return { number: s.nutrientNumber, id: s.nutrientId, unit: (s.unitName ?? '').toUpperCase(), value: s.value };
}

function pick(food: UsdaFood, key: keyof typeof NUTRIENT_NUMBERS, expectUnit: 'G' | 'KCAL'): NutrientValue {
  const list = (food.foodNutrients ?? []).map(flatten);
  const numbers: readonly string[] = NUTRIENT_NUMBERS[key];
  const ids: readonly number[] = NUTRIENT_IDS[key];
  for (const n of list) {
    const byNumber = n.number !== undefined && numbers.includes(n.number);
    const byId = !byNumber && n.id !== undefined && ids.includes(n.id);
    if (!byNumber && !byId) continue;
    if (typeof n.value !== 'number' || !Number.isFinite(n.value)) continue;
    if (n.unit !== expectUnit) continue;
    return { status: 'reported', amount: normalize(Number(n.value.toFixed(3))) };
  }
  return { status: 'unknown' };
}

/** Branded detail records carry label values per serving; used only when the per-100 field is missing. */
function pickLabel(food: UsdaFood, key: 'protein' | 'fat' | 'carbohydrates' | 'fiber' | 'sugars' | 'calories'): number | undefined {
  const v = food.labelNutrients?.[key]?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function preparationFrom(description: string): Preparation {
  const d = description.toLowerCase();
  if (/\braw\b/.test(d)) return 'raw';
  if (/\bcooked\b|\broasted\b|\bboiled\b|\bgrilled\b|\bbaked\b|\bfried\b/.test(d)) return 'cooked';
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

export function isBranded(food: UsdaFood): boolean {
  return food.dataType === 'Branded';
}

/**
 * Liquids: USDA's branded documentation states values are per 100 g or per
 * 100 ml according to the serving size unit. A serving unit of ml/MLT is the
 * only signal the API gives; it is surfaced as a warning, not hidden.
 */
function liquidBasis(food: UsdaFood): boolean {
  const unit = (food.servingSizeUnit ?? '').toLowerCase();
  return unit === 'ml' || unit === 'mlt';
}

/** Turns a documented food portion into a named portion measured for ONE unit ("cup", "large", "slice"). */
export function portionFromUsda(p: UsdaFoodPortion, index: number): Portion | undefined {
  if (typeof p.gramWeight !== 'number' || !(p.gramWeight > 0)) return undefined;
  const desc = (p.portionDescription ?? '').trim();
  const modifier = (p.modifier ?? '').trim();
  const unitName = (p.measureUnit?.name ?? '').trim();
  let count = typeof p.amount === 'number' && p.amount > 0 ? p.amount : 1;
  let name = desc;
  const leading = /^(\d+(?:\.\d+)?|\d+\/\d+)\s+(.*)$/.exec(desc);
  if (leading) {
    const n = leading[1]!.includes('/') ? Number(leading[1]!.split('/')[0]) / Number(leading[1]!.split('/')[1]) : Number(leading[1]);
    if (n > 0) count = n;
    name = leading[2]!.trim();
  }
  if (name.length === 0 || /^quantity not specified$/i.test(name)) {
    const unit = unitName && unitName !== 'undetermined' ? unitName : '';
    name = [unit, modifier].filter(Boolean).join(', ');
  }
  if (name.length === 0) return undefined;
  const grams = div(normalize(Number(p.gramWeight.toFixed(3))), normalize(count), 3);
  return { id: `usda-${p.id ?? index}`, name: name.slice(0, 120), grams };
}

/** Normalizes one search hit or detail record; nutrients per 100 g (per 100 ml for branded liquids). */
export function normalizeUsdaFood(food: UsdaFood): FoodCandidate {
  const warnings: string[] = [];
  const liquid = isBranded(food) && liquidBasis(food);
  const basis = liquid ? ({ kind: 'per100ml' } as const) : ({ kind: 'per100g' } as const);
  if (liquid) warnings.push('Values treated as per 100 ml (USDA states branded liquids by volume); confirm against the label.');

  let nutrients: NutrientSetDto = {
    protein: pick(food, 'protein', 'G'),
    carbs: pick(food, 'carbs', 'G'),
    fat: pick(food, 'fat', 'G'),
    fiber: pick(food, 'fiber', 'G'),
    sugar: pick(food, 'sugar', 'G'),
    calories: pick(food, 'calories', 'KCAL'),
  };

  // Branded detail: label nutrients are per serving; convert to the per-100 basis only when the serving size is known.
  const servingSize = typeof food.servingSize === 'number' && food.servingSize > 0 ? food.servingSize : undefined;
  if (isBranded(food) && food.labelNutrients && servingSize) {
    const factor = div('100', normalize(Number(servingSize.toFixed(3))), 6);
    const fromLabel = (key: keyof NutrientSetDto, labelKey: Parameters<typeof pickLabel>[1]): NutrientValue => {
      if (nutrients[key].status !== 'unknown') return nutrients[key];
      const v = pickLabel(food, labelKey);
      if (v === undefined) return { status: 'unknown' };
      return { status: 'reported', amount: normalize(Number((v * Number(factor)).toFixed(3))) };
    };
    nutrients = {
      protein: fromLabel('protein', 'protein'),
      carbs: fromLabel('carbs', 'carbohydrates'),
      fat: fromLabel('fat', 'fat'),
      fiber: fromLabel('fiber', 'fiber'),
      sugar: fromLabel('sugar', 'sugars'),
      calories: fromLabel('calories', 'calories'),
    };
  }

  const portions: Portion[] = [];
  let sourceServingText: string | undefined;
  const unit = (food.servingSizeUnit ?? '').toLowerCase();
  if (servingSize && (unit === 'g' || unit === 'grm' || liquid)) {
    const size = normalize(Number(servingSize.toFixed(3)));
    const household = food.householdServingFullText?.trim();
    const name = household && household.length > 0 ? household : `serving (${size} ${liquid ? 'ml' : 'g'})`;
    sourceServingText = `${household ? `${household} = ` : ''}${size} ${liquid ? 'ml' : 'g'}`;
    portions.push(liquid ? { id: 'serving', name, ml: size } : { id: 'serving', name, grams: size });
  }
  for (const [i, p] of (food.foodPortions ?? []).entries()) {
    if (portions.length >= 12) break;
    const portion = portionFromUsda(p, i);
    if (portion && !portions.some((x) => x.name.toLowerCase() === portion.name.toLowerCase())) portions.push(portion);
  }

  const brand = [food.brandName, food.brandOwner].filter((b): b is string => Boolean(b && b.trim()))[0];
  const candidate: FoodCandidate = {
    provider: 'usda',
    providerId: String(food.fdcId),
    name: isBranded(food) ? titleCase(food.description.trim()) : food.description.trim(),
    preparation: preparationFrom(food.description),
    basis,
    nutrients,
    portions,
    attribution: USDA_ATTRIBUTION,
    normalizationVersion: USDA_NORMALIZATION_VERSION,
    needsLabelConfirmation: false,
    warnings,
    kind: isBranded(food) ? 'branded' : 'generic',
    ...(food.dataType ? { dataType: food.dataType } : {}),
    hasDetails: !isBranded(food),
  };
  if (brand) candidate.brand = titleCase(brand.trim());
  if (food.gtinUpc && /^\d{6,14}$/.test(food.gtinUpc)) candidate.barcode = food.gtinUpc;
  if (sourceServingText) candidate.sourceServingText = sourceServingText;
  return candidate;
}

export function isUsdaFood(value: unknown): value is UsdaFood {
  return Boolean(value) && typeof value === 'object' && typeof (value as UsdaFood).fdcId === 'number' && typeof (value as UsdaFood).description === 'string';
}

export function normalizeUsdaSearch(body: unknown): { candidates: FoodCandidate[]; totalHits: number; totalPages: number; currentPage: number } {
  const response = body as UsdaSearchResponse;
  if (!response || !Array.isArray(response.foods)) return { candidates: [], totalHits: 0, totalPages: 0, currentPage: 1 };
  return {
    candidates: response.foods.filter(isUsdaFood).map((f) => normalizeUsdaFood(f)),
    totalHits: typeof response.totalHits === 'number' ? response.totalHits : response.foods.length,
    totalPages: typeof response.totalPages === 'number' ? response.totalPages : 1,
    currentPage: typeof response.currentPage === 'number' ? response.currentPage : 1,
  };
}

export function normalizeUsdaDetail(body: unknown): FoodCandidate | undefined {
  return isUsdaFood(body) ? normalizeUsdaFood(body) : undefined;
}

export function usdaSearchUrl(query: string, apiKey: string, page = 1, pageSize = USDA_PAGE_SIZE, dataTypes: readonly string[] = USDA_DATA_TYPES): string {
  const u = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  u.searchParams.set('query', query);
  u.searchParams.set('pageSize', String(pageSize));
  u.searchParams.set('pageNumber', String(page));
  u.searchParams.set('dataType', dataTypes.join(','));
  u.searchParams.set('api_key', apiKey);
  return u.toString();
}

/** Documented GTIN lookup: a branded search whose returned gtinUpc must equal the code. */
export function usdaGtinSearchUrl(barcode: string, apiKey: string): string {
  return usdaSearchUrl(barcode, apiKey, 1, 5, ['Branded']);
}

export function usdaDetailUrl(fdcId: string, apiKey: string): string {
  const u = new URL(`https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(fdcId)}`);
  u.searchParams.set('api_key', apiKey);
  return u.toString();
}

/** GTIN equality ignoring leading zeros (GTIN-12 vs GTIN-13 padding); never a name match. */
export function sameGtin(a: string, b: string): boolean {
  const strip = (s: string): string => s.replace(/\D/g, '').replace(/^0+/, '');
  const x = strip(a);
  const y = strip(b);
  return x.length > 0 && x === y;
}
