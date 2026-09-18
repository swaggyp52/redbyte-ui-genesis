import type { FoodCandidate, NutrientSetDto } from '@daily-plate/contracts';
import { normalize, type NutrientValue } from '@daily-plate/domain';

export const OFF_NORMALIZATION_VERSION = 'off-1';
export const OFF_ATTRIBUTION = 'Product data from Open Food Facts (ODbL); contributors, licence at openfoodfacts.org.';

/** Barcodes are strings. Digits only; leading zeros are preserved. */
export function normalizeBarcode(input: string): string | undefined {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 14) return undefined;
  return digits;
}

/** Open Food Facts pads shorter codes to 13 digits; try the padded form on a miss. */
export function paddedBarcode(barcode: string): string | undefined {
  if (barcode.length >= 13) return undefined;
  if (barcode.length <= 8) return undefined;
  return barcode.padStart(13, '0');
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutrition_data_per?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  nutriments?: Record<string, number | string | undefined>;
}

export interface OffResponse {
  status?: number | string;
  status_verbose?: string;
  product?: OffProduct;
  result?: { id?: string };
}

function num(v: number | string | undefined): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function nutrient(nutriments: Record<string, number | string | undefined>, key: string, suffix: '100g' | 'serving'): NutrientValue {
  const value = num(nutriments[`${key}_${suffix}`]);
  if (value === undefined) return { status: 'unknown' };
  const modifier = nutriments[`${key}_modifier`];
  const amount = normalize(Number(value.toFixed(3)));
  if (modifier === '<') return value > 0 ? { status: 'less-than', amount } : { status: 'unknown' };
  if (modifier === '~') return { status: 'estimated', amount };
  return { status: 'reported', amount };
}

export function offProductFound(body: unknown): body is OffResponse & { product: OffProduct } {
  const r = body as OffResponse;
  if (!r || typeof r !== 'object') return false;
  if (r.status === 1 || r.status === 'success' || r.status === 'success_with_warnings') return Boolean(r.product);
  return false;
}

/**
 * Normalizes one Open Food Facts product. Carbohydrate semantics: only a
 * `carbohydrates-total` field is taken as total carbohydrate. A bare
 * `carbohydrates` value is kept as an estimate and the record is flagged for
 * label confirmation because label conventions differ by country.
 */
export function normalizeOffProduct(barcode: string, product: OffProduct): FoodCandidate {
  const warnings: string[] = [];
  const nutriments = product.nutriments ?? {};
  const per = (product.nutrition_data_per ?? '100g').toLowerCase();
  const perServing = per === 'serving';
  const suffix: '100g' | 'serving' = perServing ? 'serving' : '100g';

  const servingQty = num(product.serving_quantity);
  const servingUnit = (product.serving_quantity_unit ?? '').toLowerCase();
  const packageQty = num(product.product_quantity);
  const packageUnit = (product.product_quantity_unit ?? '').toLowerCase();
  const liquid = servingUnit === 'ml' || packageUnit === 'ml' || /\bml\b|\bcl\b|\bl\b/i.test(product.quantity ?? '');

  let basis: FoodCandidate['basis'];
  if (perServing) {
    const servingText = product.serving_size?.trim() || (servingQty ? `${servingQty} ${servingUnit || (liquid ? 'ml' : 'g')}` : 'serving');
    basis = { kind: 'serving', servingText };
    if (servingQty && servingQty > 0) {
      const size = normalize(Number(servingQty.toFixed(3)));
      if (servingUnit === 'ml' || (servingUnit === '' && liquid)) basis.servingMl = size;
      else basis.servingGrams = size;
    }
  } else {
    basis = liquid ? { kind: 'per100ml' } : { kind: 'per100g' };
  }

  let carbs: NutrientValue = nutrient(nutriments, 'carbohydrates-total', suffix);
  let needsLabelConfirmation = false;
  if (carbs.status === 'unknown') {
    const bare = nutrient(nutriments, 'carbohydrates', suffix);
    if (bare.status !== 'unknown') {
      carbs = bare.status === 'less-than' ? bare : { status: 'estimated', amount: bare.amount };
      needsLabelConfirmation = true;
      warnings.push('This record does not say whether carbohydrates include fiber. Check total carbohydrate on the label before trusting it.');
    }
  }

  const nutrients: NutrientSetDto = {
    protein: nutrient(nutriments, 'proteins', suffix),
    carbs,
    fat: nutrient(nutriments, 'fat', suffix),
    fiber: nutrient(nutriments, 'fiber', suffix),
    sugar: nutrient(nutriments, 'sugars', suffix),
    calories: nutrient(nutriments, 'energy-kcal', suffix),
  };

  const portions: FoodCandidate['portions'] = [];
  if (!perServing && servingQty && servingQty > 0) {
    const size = normalize(Number(servingQty.toFixed(3)));
    const name = product.serving_size?.trim() || `serving (${size} ${liquid ? 'ml' : 'g'})`;
    portions.push(servingUnit === 'ml' || (servingUnit === '' && liquid) ? { id: 'serving', name, ml: size } : { id: 'serving', name, grams: size });
  } else if (perServing) {
    portions.push({ id: 'serving', name: basis.kind === 'serving' ? basis.servingText : 'serving', servings: '1' });
  }
  if (packageQty && packageQty > 0 && (packageUnit === 'g' || packageUnit === 'ml')) {
    const size = normalize(Number(packageQty.toFixed(3)));
    const name = `whole package (${size} ${packageUnit})`;
    if (basis.kind === 'per100g' && packageUnit === 'g') portions.push({ id: 'package', name, grams: size });
    else if (basis.kind === 'per100ml' && packageUnit === 'ml') portions.push({ id: 'package', name, ml: size });
    else if (basis.kind === 'serving' && packageUnit === 'g' && basis.servingGrams) portions.push({ id: 'package', name, grams: size });
    else if (basis.kind === 'serving' && packageUnit === 'ml' && basis.servingMl) portions.push({ id: 'package', name, ml: size });
  }

  const name = (product.product_name_en || product.product_name || '').trim();
  const candidate: FoodCandidate = {
    provider: 'off',
    providerId: product.code ?? barcode,
    name: name.length > 0 ? name.slice(0, 120) : `Product ${barcode}`,
    barcode,
    preparation: 'as-sold',
    basis,
    nutrients,
    portions,
    attribution: OFF_ATTRIBUTION,
    normalizationVersion: OFF_NORMALIZATION_VERSION,
    needsLabelConfirmation,
    warnings,
  };
  const brand = product.brands?.split(',')[0]?.trim();
  if (brand) candidate.brand = brand.slice(0, 120);
  if (product.serving_size) candidate.sourceServingText = product.serving_size.slice(0, 200);
  if (name.length === 0) warnings.push('The product database has no name for this item; give it one.');
  return candidate;
}

export function offProductUrl(barcode: string): string {
  const u = new URL(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(barcode)}`);
  u.searchParams.set(
    'fields',
    'code,product_name,product_name_en,brands,serving_size,serving_quantity,serving_quantity_unit,nutrition_data_per,quantity,product_quantity,product_quantity_unit,nutriments',
  );
  return u.toString();
}
