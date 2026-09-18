import Dexie, { type Table } from 'dexie';
import type { DaySnapshot, DiaryEntry, Dismissal, Food, FoodVersion, Mutation, Recipe, RecipeVersion, SavedMeal } from '@daily-plate/contracts';

/**
 * Outbox item: one mutation the phone has recorded but the Pi has not yet
 * acknowledged. Pending items are never evicted to make room for cache.
 */
export interface OutboxItem {
  mutationId: string;
  /** Local ordering; mutations are sent in this order. */
  order: number;
  mutation: Mutation;
  entityType: string;
  entityId: string;
  status: 'pending' | 'inflight' | 'attention';
  attempts: number;
  createdAt: string;
  lastError?: string;
  /** Server's current version when a conflict was reported. */
  conflictCurrent?: unknown;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class DailyPlateDb extends Dexie {
  foods!: Table<Food, string>;
  foodVersions!: Table<FoodVersion, string>;
  entries!: Table<DiaryEntry, string>;
  days!: Table<DaySnapshot, string>;
  meals!: Table<SavedMeal, string>;
  recipes!: Table<Recipe, string>;
  recipeVersions!: Table<RecipeVersion, string>;
  dismissals!: Table<Dismissal, string>;
  outbox!: Table<OutboxItem, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'daily-plate') {
    super(name);
    this.version(1).stores({
      foods: 'id, hidden, updatedAt',
      foodVersions: 'id, foodId, barcode',
      entries: 'id, localDate, [localDate+deleted], foodId, updatedAt',
      days: 'localDate',
      meals: 'id',
      recipes: 'id',
      recipeVersions: 'id, recipeId',
      dismissals: 'key',
      outbox: 'mutationId, order, entityId, status',
      meta: 'key',
    });
  }
}

let instance: DailyPlateDb | undefined;

export function getDb(): DailyPlateDb {
  if (!instance) instance = new DailyPlateDb();
  return instance;
}

export function setDbForTests(db: DailyPlateDb): void {
  instance = db;
}

export async function getMeta<T>(db: DailyPlateDb, key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(db: DailyPlateDb, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Clears everything except the outbox; used for a full re-bootstrap. */
export async function clearProjection(db: DailyPlateDb): Promise<void> {
  await db.transaction('rw', [db.foods, db.foodVersions, db.entries, db.days, db.meals, db.recipes, db.recipeVersions, db.dismissals], async () => {
    await Promise.all([db.foods.clear(), db.foodVersions.clear(), db.entries.clear(), db.days.clear(), db.meals.clear(), db.recipes.clear(), db.recipeVersions.clear(), db.dismissals.clear()]);
  });
}

/** Clears everything including the outbox; only after the user chose to. */
export async function clearAll(db: DailyPlateDb): Promise<void> {
  await clearProjection(db);
  await db.outbox.clear();
  await db.meta.clear();
}

/** Ask the browser to keep this origin's storage; honest about the answer. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
