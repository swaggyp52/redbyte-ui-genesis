export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unassigned';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack', 'unassigned'];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  unassigned: 'Other',
};

/** A sensible default meal slot from the local hour; the user can always change it. */
export function defaultMealSlot(localHour: number): MealSlot {
  if (localHour < 10) return 'breakfast';
  if (localHour < 14) return 'lunch';
  if (localHour < 16) return 'snack';
  if (localHour < 21) return 'dinner';
  return 'snack';
}

export interface LoggedFoodOccurrence {
  localDate: string;
  mealSlot: MealSlot;
  foodId: string;
}

export interface RepeatedCombination {
  key: string;
  foodIds: string[];
  mealSlot: MealSlot;
  dates: string[];
}

export const REPEAT_THRESHOLD_DAYS = 3;

/**
 * Finds groups of two or more foods logged together in the same meal slot on
 * at least REPEAT_THRESHOLD_DAYS separate days. This is an explicit product
 * rule for offering "Save this as a meal?", never an automatic action.
 */
export function findRepeatedCombinations(occurrences: LoggedFoodOccurrence[], dismissedKeys: Iterable<string> = []): RepeatedCombination[] {
  const dismissed = new Set(dismissedKeys);
  const byDaySlot = new Map<string, Set<string>>();
  for (const o of occurrences) {
    const k = `${o.localDate}|${o.mealSlot}`;
    let set = byDaySlot.get(k);
    if (!set) {
      set = new Set();
      byDaySlot.set(k, set);
    }
    set.add(o.foodId);
  }
  const combos = new Map<string, RepeatedCombination>();
  for (const [k, foods] of byDaySlot) {
    if (foods.size < 2) continue;
    const [localDate, mealSlot] = k.split('|') as [string, MealSlot];
    const foodIds = [...foods].sort();
    const key = `${mealSlot}:${foodIds.join(',')}`;
    if (dismissed.has(key)) continue;
    let combo = combos.get(key);
    if (!combo) {
      combo = { key, foodIds, mealSlot, dates: [] };
      combos.set(key, combo);
    }
    if (!combo.dates.includes(localDate)) combo.dates.push(localDate);
  }
  return [...combos.values()].filter((c) => c.dates.length >= REPEAT_THRESHOLD_DAYS).map((c) => ({ ...c, dates: [...c.dates].sort() }));
}
