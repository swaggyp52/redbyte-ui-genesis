import { formatDisplay } from './decimal.js';
import { NUTRIENT_LABELS, NUTRIENT_UNITS, type NutrientKey, type NutrientTotal, type NutrientValue, upperBound } from './nutrients.js';

/** Honest, human copy for a nutrient total. Pure so the UI and tests share it. */
export interface TotalCopy {
  /** The main number to show, already rounded for display. */
  value: string;
  unit: string;
  /** "about" prefix when estimates contribute. */
  approximate: boolean;
  /** Secondary explanation, e.g. "1 item missing sugar" or "plus less than 1 g". */
  note?: string;
  /** True when the number should be shown as provisional. */
  provisional: boolean;
}

export function totalCopy(key: NutrientKey, total: NutrientTotal, places = key === 'calories' ? 0 : 1): TotalCopy {
  const unit = NUTRIENT_UNITS[key];
  const label = NUTRIENT_LABELS[key].toLowerCase();
  const notes: string[] = [];
  if (total.lessThanCount > 0) {
    notes.push(`plus less than ${formatDisplay(total.lessThanBound, places)} ${unit}`);
  }
  if (total.unknownCount > 0) {
    notes.push(`${total.unknownCount} item${total.unknownCount === 1 ? '' : 's'} missing ${label}`);
  }
  const copy: TotalCopy = {
    value: formatDisplay(total.known, places),
    unit,
    approximate: total.hasEstimate,
    provisional: !total.complete,
  };
  if (notes.length > 0) copy.note = notes.join(' · ');
  return copy;
}

/** e.g. "12 g known — 1 item missing sugar" */
export function totalSentence(key: NutrientKey, total: NutrientTotal): string {
  const c = totalCopy(key, total);
  const head = `${NUTRIENT_LABELS[key]}: ${c.approximate ? 'about ' : ''}${c.value} ${c.unit}${total.unknownCount > 0 ? ' known' : ''}`;
  return c.note ? `${head} — ${c.note}` : head;
}

export function valueCopy(key: NutrientKey, value: NutrientValue, places = key === 'calories' ? 0 : 1): string {
  const unit = NUTRIENT_UNITS[key];
  switch (value.status) {
    case 'reported':
      return `${formatDisplay(value.amount, places)} ${unit}`;
    case 'estimated':
      return `about ${formatDisplay(value.amount, places)} ${unit}`;
    case 'less-than':
      return `less than ${formatDisplay(value.amount, places)} ${unit}`;
    case 'unknown':
      return 'not known yet';
  }
}

export function upperBoundCopy(key: NutrientKey, total: NutrientTotal): string {
  return `${formatDisplay(upperBound(total), key === 'calories' ? 0 : 1)} ${NUTRIENT_UNITS[key]}`;
}
