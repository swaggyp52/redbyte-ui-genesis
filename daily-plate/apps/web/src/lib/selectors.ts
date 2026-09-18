import { buildDiarySnapshot, type DaySnapshot, type DiaryEntry, type Dismissal, type Food, type FoodVersion, type MealSlot, type Quantity, type SavedMeal } from '@daily-plate/contracts';
import {
  MACRO_KEYS,
  MEAL_SLOTS,
  contextSuggestions,
  findRepeatedCombinations,
  macroFitIdeas,
  macroProgress,
  pluralPortion,
  sumNutrients,
  type Idea,
  type MacroKey,
  type MacroProgress,
  type NutrientKey,
  type NutrientSet,
  type NutrientTotals,
} from '@daily-plate/domain';
import type { OutboxItem } from './db.js';

export interface EntryView {
  entry: DiaryEntry;
  /** 'saved' once the Pi acknowledged it; 'pending' while on this phone only; 'attention' when something needs a decision. */
  saveState: 'saved' | 'pending' | 'attention';
  attentionMessage?: string;
}

export interface MealGroup {
  slot: MealSlot;
  label: string;
  entries: EntryView[];
}

export interface DayView {
  localDate: string;
  day: DaySnapshot;
  entries: EntryView[];
  groups: MealGroup[];
  totals: NutrientTotals;
  progress: Record<MacroKey, MacroProgress>;
  /** Entries missing at least one macro make the remaining numbers provisional. */
  provisional: boolean;
  entryCount: number;
}

const SLOT_LABELS: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks', unassigned: 'Other' };

export function entryViews(entries: DiaryEntry[], outbox: OutboxItem[]): EntryView[] {
  const byEntity = new Map<string, OutboxItem[]>();
  for (const o of outbox) {
    const list = byEntity.get(o.entityId) ?? [];
    list.push(o);
    byEntity.set(o.entityId, list);
  }
  return entries.map((entry) => {
    const items = byEntity.get(entry.id) ?? [];
    const attention = items.find((i) => i.status === 'attention');
    if (attention) return { entry, saveState: 'attention', ...(attention.lastError ? { attentionMessage: attention.lastError } : {}) };
    if (items.length > 0) return { entry, saveState: 'pending' };
    return { entry, saveState: 'saved' };
  });
}

export function buildDayView(localDate: string, day: DaySnapshot, entries: DiaryEntry[], outbox: OutboxItem[]): DayView {
  const live = entries.filter((e) => e.localDate === localDate && !e.deleted).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const views = entryViews(live, outbox);
  const sets = live.filter((e) => e.kind === 'food' && e.snapshot).map((e) => e.snapshot!.nutrients as NutrientSet);
  const totals = sumNutrients(sets);
  const progress = {} as Record<MacroKey, MacroProgress>;
  for (const key of MACRO_KEYS) progress[key] = macroProgress(totals[key], day.targets[key]);
  const drafts = live.filter((e) => e.kind === 'draft').length;
  const groups: MealGroup[] = MEAL_SLOTS.map((slot) => ({ slot, label: SLOT_LABELS[slot], entries: views.filter((v) => v.entry.mealSlot === slot) })).filter((g) => g.entries.length > 0);
  return {
    localDate,
    day,
    entries: views,
    groups,
    totals,
    progress,
    provisional: drafts > 0 || MACRO_KEYS.some((k) => !totals[k].complete),
    entryCount: live.length,
  };
}

export interface Shortcut {
  kind: 'food' | 'meal';
  id: string;
  name: string;
  detail: string;
  order: number;
  food?: Food;
  version?: FoodVersion;
  meal?: SavedMeal;
}

export function shortcuts(foods: Food[], versions: Map<string, FoodVersion>, meals: SavedMeal[], limit?: number): Shortcut[] {
  const out: Shortcut[] = [];
  for (const food of foods) {
    if (!food.pin || food.hidden) continue;
    const version = versions.get(food.currentVersionId);
    if (!version) continue;
    const q = food.pin.quantity;
    const u = q.unit;
    const unitName = u.kind === 'portion' ? pluralPortion(version.portions.find((p) => p.id === u.portionId)?.name ?? 'portion', q.amount) : u.kind === 'serving' ? pluralPortion('serving', q.amount) : u.kind === 'mass' ? u.unit : u.unit === 'floz' ? 'fl oz' : 'ml';
    out.push({ kind: 'food', id: food.id, name: food.name, detail: `${q.amount} ${unitName}`, order: food.pin.order, food, version });
  }
  for (const meal of meals) {
    if (!meal.pin || meal.deleted) continue;
    out.push({ kind: 'meal', id: meal.id, name: meal.name, detail: `${meal.items.length} item${meal.items.length === 1 ? '' : 's'}`, order: meal.pin.order, meal });
  }
  out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return limit ? out.slice(0, limit) : out;
}

export function recentFoods(entries: DiaryEntry[], foods: Map<string, Food>, limit = 8): Food[] {
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const e of [...entries].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
    if (e.kind !== 'food' || !e.foodId || e.deleted || seen.has(e.foodId)) continue;
    const food = foods.get(e.foodId);
    if (!food || food.hidden) continue;
    seen.add(e.foodId);
    out.push(food);
    if (out.length >= limit) break;
  }
  return out;
}

export function suggestionsAroundNow(entries: DiaryEntry[], foods: Map<string, Food>, now: Date, slot: MealSlot, dismissals: Dismissal[], pinnedIds: Iterable<string>): Food[] {
  const dismissed = new Set(dismissals.filter((d) => d.kind === 'suggestion').map((d) => d.key));
  const history = entries.filter((e) => e.kind === 'food' && e.foodId && !e.deleted).map((e) => ({ foodId: e.foodId!, occurredAt: e.occurredAt, mealSlot: e.mealSlot }));
  const exclude = new Set<string>([...dismissed, ...pinnedIds]);
  for (const [id, f] of foods) if (f.hidden || !f.suggestEligible) exclude.add(id);
  return contextSuggestions(history, { now, mealSlot: slot, excludeFoodIds: exclude, limit: 3 })
    .map((s) => foods.get(s.foodId))
    .filter((f): f is Food => Boolean(f));
}

export interface IdeaView extends Idea {
  kind: 'food' | 'meal';
  food?: Food;
  version?: FoodVersion;
  meal?: SavedMeal;
}

/** User-invoked arithmetic ideas from foods she has saved and allowed. Alcohol-tagged foods are never offered. */
export function ideasFromMyFoods(view: DayView, foods: Food[], versions: Map<string, FoodVersion>, meals: SavedMeal[], dismissals: Dismissal[]): { ideas: IdeaView[]; provisional: boolean } {
  const dismissed = new Set(dismissals.filter((d) => d.kind === 'suggestion').map((d) => d.key));
  const candidates: Array<{ id: string; name: string; nutrients: NutrientSet; kind: 'food' | 'meal'; food?: Food; version?: FoodVersion; meal?: SavedMeal; multiples?: string[] }> = [];
  for (const food of foods) {
    if (food.hidden || !food.suggestEligible || food.tags.includes('alcohol') || dismissed.has(food.id)) continue;
    const version = versions.get(food.currentVersionId);
    if (!version) continue;
    const q = food.pin?.quantity ?? food.lastQuantity ?? version.defaultQuantity;
    if (!q) continue;
    const scaled = scaledNutrients(version, q);
    if (!scaled) continue;
    candidates.push({ id: food.id, name: food.name, nutrients: scaled, kind: 'food', food, version });
  }
  for (const meal of meals) {
    if (meal.deleted || !meal.suggestEligible || dismissed.has(meal.id)) continue;
    const parts: NutrientSet[] = [];
    let ok = true;
    for (const item of meal.items) {
      const v = versions.get(item.foodVersionId);
      const s = v ? scaledNutrients(v, item.quantity) : undefined;
      if (!s) {
        ok = false;
        break;
      }
      parts.push(s);
    }
    if (!ok) continue;
    const t = sumNutrients(parts);
    const nutrients = {} as NutrientSet;
    for (const key of Object.keys(t) as NutrientKey[]) nutrients[key] = t[key].complete ? { status: t[key].hasEstimate ? 'estimated' : 'reported', amount: t[key].known } : { status: 'unknown' };
    candidates.push({ id: meal.id, name: meal.name, nutrients, kind: 'meal', meal, multiples: ['1'] });
  }
  const remaining = {} as Record<MacroKey, string>;
  for (const key of MACRO_KEYS) remaining[key] = view.progress[key].remaining;
  const ideas = macroFitIdeas({ remaining, targets: view.day.targets, candidates, limit: 3 });
  const byId = new Map(candidates.map((c) => [c.id, c]));
  return {
    ideas: ideas.map((i) => {
      const c = byId.get(i.candidateId)!;
      return { ...i, kind: c.kind, ...(c.food ? { food: c.food } : {}), ...(c.version ? { version: c.version } : {}), ...(c.meal ? { meal: c.meal } : {}) };
    }),
    provisional: view.provisional,
  };
}

function scaledNutrients(version: FoodVersion, quantity: Quantity): NutrientSet | undefined {
  const r = buildDiarySnapshot(version, quantity);
  return r.ok ? (r.snapshot.nutrients as NutrientSet) : undefined;
}

export interface MealOffer {
  key: string;
  foodIds: string[];
  names: string[];
  mealSlot: MealSlot;
  days: number;
}

/** "Save this as a meal?" after the same combination on three separate days. */
export function mealOffers(entries: DiaryEntry[], foods: Map<string, Food>, meals: SavedMeal[], dismissals: Dismissal[]): MealOffer[] {
  const dismissed = dismissals.filter((d) => d.kind === 'meal-combo').map((d) => d.key);
  const existing = new Set(meals.filter((m) => !m.deleted).map((m) => [...new Set(m.items.map((i) => i.foodId))].sort().join(',')));
  const occurrences = entries.filter((e) => e.kind === 'food' && e.foodId && !e.deleted).map((e) => ({ localDate: e.localDate, mealSlot: e.mealSlot, foodId: e.foodId! }));
  return findRepeatedCombinations(occurrences, dismissed)
    .filter((c) => !existing.has(c.foodIds.join(',')))
    .map((c) => ({ key: c.key, foodIds: c.foodIds, names: c.foodIds.map((id) => foods.get(id)?.name ?? 'a food'), mealSlot: c.mealSlot, days: c.dates.length }))
    .slice(0, 1);
}
