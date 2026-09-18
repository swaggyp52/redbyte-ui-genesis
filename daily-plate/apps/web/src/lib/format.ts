import { formatDisplay, MACRO_KEYS, NUTRIENT_UNITS, pluralPortion, type MacroKey, type NutrientKey, type NutrientSet, type NutrientValue } from '@daily-plate/domain';
import type { FoodVersion, Quantity } from '@daily-plate/contracts';

export function grams(value: string, places = 1): string {
  return formatDisplay(value, places);
}

export function valueShort(key: NutrientKey, v: NutrientValue): string {
  const unit = NUTRIENT_UNITS[key];
  switch (v.status) {
    case 'reported':
      return `${formatDisplay(v.amount, key === 'calories' ? 0 : 1)} ${unit}`;
    case 'estimated':
      return `~${formatDisplay(v.amount, key === 'calories' ? 0 : 1)} ${unit}`;
    case 'less-than':
      return `<${formatDisplay(v.amount, 1)} ${unit}`;
    case 'unknown':
      return '?';
  }
}

/** "P 45 · C 22.5 · F ?" */
export function macroLine(n: NutrientSet): string {
  const letters: Record<MacroKey, string> = { protein: 'P', carbs: 'C', fat: 'F' };
  return MACRO_KEYS.map((k) => {
    const v = n[k];
    return `${letters[k]} ${v.status === 'unknown' ? '?' : formatDisplay(v.amount, 1)}`;
  }).join(' · ');
}

export function unitName(unit: Quantity['unit'], version: Pick<FoodVersion, 'portions' | 'basis'>, amount?: string): string {
  const plural = amount !== undefined && amount !== '1';
  switch (unit.kind) {
    case 'serving':
      return plural ? 'servings' : 'serving';
    case 'portion': {
      const p = version.portions.find((x) => x.id === unit.portionId);
      return p ? pluralPortion(p.name, amount ?? '1') : 'portion';
    }
    case 'mass':
      return unit.unit;
    case 'volume':
      return unit.unit === 'floz' ? 'fl oz' : 'ml';
  }
}

export function quantityLabel(q: Quantity, version: Pick<FoodVersion, 'portions' | 'basis'>): string {
  return `${q.amount} ${unitName(q.unit, version, q.amount)}`;
}

export function dayTitle(localDate: string, today: string): string {
  if (localDate === today) return 'Today';
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const yesterday = new Date(Date.UTC(...(today.split('-').map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date.getTime() === yesterday.getTime()) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export function longDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function basisLabel(version: Pick<FoodVersion, 'basis'>): string {
  switch (version.basis.kind) {
    case 'serving':
      return `per ${version.basis.servingText}`;
    case 'per100g':
      return 'per 100 g';
    case 'per100ml':
      return 'per 100 ml';
  }
}
