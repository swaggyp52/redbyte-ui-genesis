import {
  buildDiarySnapshot,
  virtualDaySnapshot,
  type DaySnapshot,
  type DayType,
  type DiaryEntry,
  type Food,
  type FoodCandidate,
  type FoodVersion,
  type GoalTemplateDto,
  type MealSlot,
  type Mutation,
  type MutationPayload,
  type NewFood,
  type Quantity,
  type Recipe,
  type RecipeVersion,
  type SavedMeal,
  type User,
} from '@daily-plate/contracts';
import { calculateRecipe, resolveQuantity, type NutrientSet } from '@daily-plate/domain';
import { getMeta, setMeta, type DailyPlateDb } from './db.js';

const uuid = (): string => crypto.randomUUID();
const nowIso = (): string => new Date().toISOString();

async function enqueue(db: DailyPlateDb, payload: MutationPayload, entityType: string, entityId: string): Promise<Mutation> {
  const last = await db.outbox.orderBy('order').last();
  const mutation: Mutation = { schemaVersion: 1, mutationId: uuid(), clientTime: nowIso(), payload };
  await db.outbox.put({ mutationId: mutation.mutationId, order: (last?.order ?? 0) + 1, mutation, entityType, entityId, status: 'pending', attempts: 0, createdAt: mutation.clientTime });
  return mutation;
}

export interface AddFoodInput {
  version: FoodVersion;
  quantity: Quantity;
  mealSlot: MealSlot;
  localDate: string;
  timeZone: string;
  groupId?: string;
}

export class ActionError extends Error {}

/** Writes the entry and its mutation in one IndexedDB transaction; only then may the UI show it. */
export async function addFoodEntry(db: DailyPlateDb, input: AddFoodInput): Promise<{ entry: DiaryEntry; mutationId: string }> {
  const built = buildDiarySnapshot(input.version, input.quantity);
  if (!built.ok) throw new ActionError(built.error.message);
  const now = nowIso();
  const entry: DiaryEntry = {
    id: uuid(),
    localDate: input.localDate,
    timeZone: input.timeZone,
    occurredAt: now,
    mealSlot: input.mealSlot,
    kind: 'food',
    foodId: input.version.foodId,
    foodVersionId: input.version.id,
    quantity: input.quantity,
    factor: built.factor,
    snapshot: built.snapshot,
    ...(input.groupId ? { groupId: input.groupId } : {}),
    revision: 1,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const { revision: _r, deleted: _d, createdAt: _c, updatedAt: _u, ...newEntry } = entry;
  let mutationId = '';
  await db.transaction('rw', [db.entries, db.outbox, db.days, db.meta, db.foods], async () => {
    await ensureLocalDay(db, input.localDate);
    await db.entries.put(entry);
    const food = await db.foods.get(input.version.foodId);
    if (food) await db.foods.put({ ...food, lastQuantity: input.quantity });
    mutationId = (await enqueue(db, { type: 'diary.add', entry: newEntry }, 'entry', entry.id)).mutationId;
  });
  return { entry, mutationId };
}

export async function addDraftEntry(db: DailyPlateDb, input: { text: string; note?: string; mealSlot: MealSlot; localDate: string; timeZone: string }): Promise<DiaryEntry> {
  const now = nowIso();
  const entry: DiaryEntry = {
    id: uuid(),
    localDate: input.localDate,
    timeZone: input.timeZone,
    occurredAt: now,
    mealSlot: input.mealSlot,
    kind: 'draft',
    draft: { text: input.text, ...(input.note ? { note: input.note } : {}) },
    revision: 1,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const { revision: _r, deleted: _d, createdAt: _c, updatedAt: _u, ...newEntry } = entry;
  await db.transaction('rw', [db.entries, db.outbox, db.days, db.meta], async () => {
    await ensureLocalDay(db, input.localDate);
    await db.entries.put(entry);
    await enqueue(db, { type: 'diary.add', entry: newEntry }, 'entry', entry.id);
  });
  return entry;
}

async function ensureLocalDay(db: DailyPlateDb, localDate: string): Promise<void> {
  if (await db.days.get(localDate)) return;
  const goals = await getMeta<GoalTemplateDto>(db, 'goals');
  const user = await getMeta<User>(db, 'user');
  if (!goals || !user) return;
  await db.days.put({ ...virtualDaySnapshot(goals, user, localDate), revision: 1, updatedAt: nowIso() });
}

/** True while the entry's add is still unsent (never reached the Pi), so it can simply be withdrawn. */
async function unsentAdd(db: DailyPlateDb, entryId: string) {
  const items = await db.outbox.where('entityId').equals(entryId).toArray();
  return items.find((i) => i.mutation.payload.type === 'diary.add' && i.status === 'pending');
}

export interface EntryChanges {
  version?: FoodVersion;
  quantity?: Quantity;
  mealSlot?: MealSlot;
  localDate?: string;
}

export async function updateEntry(db: DailyPlateDb, entry: DiaryEntry, changes: EntryChanges): Promise<DiaryEntry> {
  const version = changes.version ?? (entry.foodVersionId ? await db.foodVersions.get(entry.foodVersionId) : undefined);
  const quantity = changes.quantity ?? entry.quantity;
  let next: DiaryEntry = { ...entry, mealSlot: changes.mealSlot ?? entry.mealSlot, localDate: changes.localDate ?? entry.localDate, updatedAt: nowIso() };
  if (version && quantity) {
    const built = buildDiarySnapshot(version, quantity);
    if (!built.ok) throw new ActionError(built.error.message);
    const { draft: _draft, ...rest } = next;
    next = { ...rest, kind: 'food', foodId: version.foodId, foodVersionId: version.id, quantity, factor: built.factor, snapshot: built.snapshot };
  }
  await db.transaction('rw', [db.entries, db.outbox, db.days, db.meta], async () => {
    await ensureLocalDay(db, next.localDate);
    const pendingAdd = await unsentAdd(db, entry.id);
    if (pendingAdd) {
      // Never sent: rewrite the add itself under a fresh mutation id.
      const { revision: _r, deleted: _d, createdAt: _c, updatedAt: _u, ...newEntry } = next;
      await db.outbox.delete(pendingAdd.mutationId);
      await enqueue(db, { type: 'diary.add', entry: newEntry }, 'entry', entry.id);
      await db.entries.put(next);
      return;
    }
    const base = entry.revision;
    next = { ...next, revision: base + 1 };
    const { revision: _r, deleted: _d, createdAt: _c, updatedAt: _u, ...newEntry } = next;
    await db.entries.put(next);
    await enqueue(db, { type: 'diary.update', entryId: entry.id, baseRevision: base, entry: newEntry }, 'entry', entry.id);
  });
  return next;
}

/** Removes an entry. Returns how to undo: withdraw (was unsent) or restore (was committed). */
export async function deleteEntry(db: DailyPlateDb, entry: DiaryEntry): Promise<{ undo: () => Promise<void> }> {
  let mode: 'withdrawn' | 'deleted' = 'deleted';
  let deleted: DiaryEntry = entry;
  await db.transaction('rw', [db.entries, db.outbox], async () => {
    const pendingAdd = await unsentAdd(db, entry.id);
    if (pendingAdd) {
      mode = 'withdrawn';
      await db.outbox.delete(pendingAdd.mutationId);
      await db.entries.delete(entry.id);
      return;
    }
    deleted = { ...entry, deleted: true, revision: entry.revision + 1, updatedAt: nowIso() };
    await db.entries.put(deleted);
    await enqueue(db, { type: 'diary.delete', entryId: entry.id, baseRevision: entry.revision }, 'entry', entry.id);
  });
  return {
    undo: async () => {
      if (mode === 'withdrawn') {
        const { revision: _r, deleted: _d, createdAt: _c, updatedAt: _u, ...newEntry } = entry;
        await db.transaction('rw', [db.entries, db.outbox], async () => {
          await db.entries.put(entry);
          await enqueue(db, { type: 'diary.add', entry: newEntry }, 'entry', entry.id);
        });
        return;
      }
      await restoreEntry(db, deleted);
    },
  };
}

export async function restoreEntry(db: DailyPlateDb, entry: DiaryEntry): Promise<void> {
  await db.transaction('rw', [db.entries, db.outbox], async () => {
    const pendingDelete = (await db.outbox.where('entityId').equals(entry.id).toArray()).find((i) => i.mutation.payload.type === 'diary.delete' && i.status === 'pending');
    if (pendingDelete) {
      await db.outbox.delete(pendingDelete.mutationId);
      await db.entries.put({ ...entry, deleted: false, revision: entry.revision - 1 });
      return;
    }
    await db.entries.put({ ...entry, deleted: false, revision: entry.revision + 1, updatedAt: nowIso() });
    await enqueue(db, { type: 'diary.restore', entryId: entry.id, baseRevision: entry.revision }, 'entry', entry.id);
  });
}

/** Withdraws an add that has not been sent yet; returns false if it already left the phone. */
export async function withdrawIfUnsent(db: DailyPlateDb, entryId: string): Promise<boolean> {
  let withdrawn = false;
  await db.transaction('rw', [db.entries, db.outbox], async () => {
    const pendingAdd = await unsentAdd(db, entryId);
    if (!pendingAdd) return;
    await db.outbox.delete(pendingAdd.mutationId);
    await db.entries.delete(entryId);
    withdrawn = true;
  });
  return withdrawn;
}

export async function setDayType(db: DailyPlateDb, localDate: string, dayType: DayType): Promise<DaySnapshot | undefined> {
  const goals = await getMeta<GoalTemplateDto>(db, 'goals');
  const user = await getMeta<User>(db, 'user');
  if (!goals || !user) return undefined;
  const existing = await db.days.get(localDate);
  const day: DaySnapshot = { ...virtualDaySnapshot(goals, user, localDate, dayType), revision: (existing?.revision ?? 0) + 1, updatedAt: nowIso() };
  await db.transaction('rw', [db.days, db.outbox], async () => {
    await db.days.put(day);
    await enqueue(db, { type: 'day.setType', localDate, dayType }, 'day', localDate);
  });
  return day;
}

export interface UpsertFoodInput {
  food: NewFood;
  version: Omit<FoodVersion, 'foodId' | 'version' | 'createdAt'>;
}

export async function upsertFood(db: DailyPlateDb, input: UpsertFoodInput): Promise<{ food: Food; version: FoodVersion }> {
  const existing = await db.foods.get(input.food.id);
  const now = nowIso();
  const versionNumber = (await db.foodVersions.where('foodId').equals(input.food.id).count()) + 1;
  const version: FoodVersion = { ...input.version, foodId: input.food.id, version: versionNumber, createdAt: now };
  if (version.defaultQuantity) {
    const r = resolveQuantity({ basis: version.basis, portions: version.portions }, version.defaultQuantity);
    if (!r.ok) throw new ActionError(r.error.message);
  }
  const food: Food = existing
    ? { ...existing, ...input.food, currentVersionId: version.id, revision: existing.revision + 1, updatedAt: now }
    : { ...input.food, currentVersionId: version.id, revision: 1, updatedAt: now };
  await db.transaction('rw', [db.foods, db.foodVersions, db.outbox], async () => {
    await db.foods.put(food);
    await db.foodVersions.put(version);
    await enqueue(db, { type: 'food.upsert', food: input.food, version: input.version, ...(existing ? { baseRevision: existing.revision } : {}) }, 'food', food.id);
  });
  return { food, version };
}

/** Turns a provider candidate into a saved personal food (new version 1). */
export function candidateToFoodInput(candidate: FoodCandidate, overrides: { name?: string; nutrients?: NutrientSet; defaultQuantity?: Quantity; aliases?: string[] } = {}): UpsertFoodInput {
  const foodId = uuid();
  const versionId = uuid();
  const defaultQuantity = overrides.defaultQuantity ?? (candidate.portions[0] ? { amount: '1', unit: { kind: 'portion' as const, portionId: candidate.portions[0].id } } : candidate.basis.kind === 'serving' ? { amount: '1', unit: { kind: 'serving' as const } } : { amount: '100', unit: { kind: 'mass' as const, unit: 'g' as const } });
  const nutrients = overrides.nutrients ?? candidate.nutrients;
  const userCorrected = overrides.nutrients ? (Object.keys(nutrients) as Array<keyof NutrientSet>).filter((k) => JSON.stringify(nutrients[k]) !== JSON.stringify(candidate.nutrients[k])) : [];
  return {
    food: { id: foodId, name: overrides.name ?? candidate.name, aliases: overrides.aliases ?? [], pin: null, suggestEligible: true, tags: [], hidden: false },
    version: {
      id: versionId,
      name: overrides.name ?? candidate.name,
      ...(candidate.brand ? { brand: candidate.brand } : {}),
      ...(candidate.barcode ? { barcode: candidate.barcode } : {}),
      preparation: candidate.preparation,
      basis: candidate.basis,
      nutrients,
      portions: candidate.portions,
      defaultQuantity,
      provenance: {
        provider: candidate.provider,
        providerId: candidate.providerId,
        fetchedAt: nowIso(),
        ...(candidate.sourceServingText ? { sourceServingText: candidate.sourceServingText } : {}),
        normalizationVersion: candidate.normalizationVersion,
        attribution: candidate.attribution,
        ...(userCorrected.length > 0 ? { userCorrected } : {}),
      },
    },
  };
}

export async function updateFood(db: DailyPlateDb, food: Food, changes: Extract<MutationPayload, { type: 'food.update' }>['changes']): Promise<Food> {
  const next: Food = { ...food, ...stripUndefined(changes), revision: food.revision + 1, updatedAt: nowIso() };
  await db.transaction('rw', [db.foods, db.outbox], async () => {
    await db.foods.put(next);
    await enqueue(db, { type: 'food.update', foodId: food.id, baseRevision: food.revision, changes }, 'food', food.id);
  });
  return next;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

export async function saveMeal(db: DailyPlateDb, meal: Omit<SavedMeal, 'revision' | 'deleted' | 'updatedAt'>): Promise<SavedMeal> {
  const existing = await db.meals.get(meal.id);
  const next: SavedMeal = { ...meal, revision: (existing?.revision ?? 0) + 1, deleted: false, updatedAt: nowIso() };
  await db.transaction('rw', [db.meals, db.outbox], async () => {
    await db.meals.put(next);
    await enqueue(db, { type: 'meal.upsert', meal, ...(existing ? { baseRevision: existing.revision } : {}) }, 'meal', meal.id);
  });
  return next;
}

export async function deleteMeal(db: DailyPlateDb, meal: SavedMeal): Promise<void> {
  await db.transaction('rw', [db.meals, db.outbox], async () => {
    await db.meals.put({ ...meal, deleted: true, revision: meal.revision + 1, updatedAt: nowIso() });
    await enqueue(db, { type: 'meal.delete', mealId: meal.id, baseRevision: meal.revision }, 'meal', meal.id);
  });
}

export interface LogMealInput {
  meal: SavedMeal;
  mealSlot: MealSlot;
  localDate: string;
  timeZone: string;
  /** Items the user removed for today ("usual breakfast, but no toast"). */
  skipFoodIds?: string[];
}

export async function logMeal(db: DailyPlateDb, input: LogMealInput): Promise<DiaryEntry[]> {
  const groupId = uuid();
  const skip = new Set(input.skipFoodIds ?? []);
  const entries: DiaryEntry[] = [];
  for (const item of input.meal.items) {
    if (skip.has(item.foodId)) continue;
    const version = await db.foodVersions.get(item.foodVersionId);
    if (!version) throw new ActionError('A food in this meal is missing on this phone.');
    const { entry } = await addFoodEntry(db, { version, quantity: item.quantity, mealSlot: input.mealSlot, localDate: input.localDate, timeZone: input.timeZone, groupId });
    entries.push(entry);
  }
  return entries;
}

export interface UpsertRecipeInput {
  recipeId?: string;
  name: string;
  servingName: string;
  yieldServings: string;
  ingredients: Array<{ foodId: string; foodVersionId: string; quantity: Quantity }>;
}

export async function upsertRecipe(db: DailyPlateDb, input: UpsertRecipeInput): Promise<{ recipe: Recipe; version: RecipeVersion; foodVersion: FoodVersion }> {
  const existing = input.recipeId ? await db.recipes.get(input.recipeId) : undefined;
  const recipeId = input.recipeId ?? uuid();
  const foodId = existing?.foodId ?? uuid();
  const foodVersionId = uuid();
  const recipeVersionId = uuid();
  const now = nowIso();
  const resolved = [];
  for (const i of input.ingredients) {
    const v = await db.foodVersions.get(i.foodVersionId);
    if (!v) throw new ActionError('An ingredient is missing on this phone.');
    const r = resolveQuantity({ basis: v.basis, portions: v.portions }, i.quantity);
    if (!r.ok) throw new ActionError(`${v.name}: ${r.error.message}`);
    resolved.push({ ...i, factor: r.factor, nutrients: v.nutrients as NutrientSet });
  }
  const calc = calculateRecipe(resolved.map((r) => ({ nutrients: r.nutrients, factor: r.factor })), input.yieldServings);
  const foodVersion: FoodVersion = {
    id: foodVersionId,
    foodId,
    version: (await db.foodVersions.where('foodId').equals(foodId).count()) + 1,
    name: input.name,
    preparation: 'prepared',
    basis: { kind: 'serving', servingText: `1 ${input.servingName}` },
    nutrients: calc.perServing,
    portions: [{ id: 'serving', name: input.servingName, servings: '1' }],
    defaultQuantity: { amount: '1', unit: { kind: 'portion', portionId: 'serving' } },
    provenance: { provider: 'recipe', providerId: recipeId, fetchedAt: now, normalizationVersion: 'recipe-1' },
    createdAt: now,
  };
  const version: RecipeVersion = {
    id: recipeVersionId,
    recipeId,
    version: (await db.recipeVersions.where('recipeId').equals(recipeId).count()) + 1,
    name: input.name,
    ingredients: resolved.map(({ foodId: f, foodVersionId: fv, quantity, factor }) => ({ foodId: f, foodVersionId: fv, quantity, factor })),
    yieldServings: input.yieldServings,
    servingName: input.servingName,
    perServing: calc.perServing,
    incomplete: calc.incomplete,
    foodVersionId,
    createdAt: now,
  };
  const existingFood = await db.foods.get(foodId);
  const food: Food = existingFood
    ? { ...existingFood, name: input.name, currentVersionId: foodVersionId, revision: existingFood.revision + 1, updatedAt: now }
    : { id: foodId, name: input.name, aliases: [], currentVersionId: foodVersionId, pin: null, suggestEligible: true, tags: [], hidden: false, revision: 1, updatedAt: now };
  const recipe: Recipe = { id: recipeId, name: input.name, foodId, currentVersionId: recipeVersionId, revision: (existing?.revision ?? 0) + 1, deleted: false, updatedAt: now };
  await db.transaction('rw', [db.foods, db.foodVersions, db.recipes, db.recipeVersions, db.outbox], async () => {
    await db.foods.put(food);
    await db.foodVersions.put(foodVersion);
    await db.recipes.put(recipe);
    await db.recipeVersions.put(version);
    await enqueue(
      db,
      {
        type: 'recipe.upsert',
        recipeId,
        recipeVersionId,
        foodId,
        foodVersionId,
        name: input.name,
        ingredients: input.ingredients,
        yieldServings: input.yieldServings,
        servingName: input.servingName,
        ...(existing ? { baseRevision: existing.revision } : {}),
      },
      'recipe',
      recipeId,
    );
  });
  return { recipe, version, foodVersion };
}

export async function deleteRecipe(db: DailyPlateDb, recipe: Recipe): Promise<void> {
  await db.transaction('rw', [db.recipes, db.foods, db.outbox], async () => {
    await db.recipes.put({ ...recipe, deleted: true, revision: recipe.revision + 1, updatedAt: nowIso() });
    const food = await db.foods.get(recipe.foodId);
    if (food) await db.foods.put({ ...food, hidden: true, pin: null, revision: food.revision + 1 });
    await enqueue(db, { type: 'recipe.delete', recipeId: recipe.id, baseRevision: recipe.revision }, 'recipe', recipe.id);
  });
}

export async function updateGoals(db: DailyPlateDb, goals: GoalTemplateDto, next: Pick<GoalTemplateDto, 'rest' | 'training' | 'secondary'>): Promise<void> {
  await db.transaction('rw', [db.meta, db.outbox], async () => {
    await setMeta(db, 'goals', { ...goals, ...next, revision: goals.revision + 1, updatedAt: nowIso() });
    await enqueue(db, { type: 'goals.update', ...next, baseRevision: goals.revision }, 'goals', 'goals');
  });
}

export async function updateUser(db: DailyPlateDb, user: User, changes: Extract<MutationPayload, { type: 'user.update' }>['changes']): Promise<User> {
  const { setupConfirmed, ...rest } = changes;
  const next: User = { ...user, ...stripUndefined(rest), revision: user.revision + 1, ...(setupConfirmed ? { setupConfirmedAt: nowIso() } : {}) };
  await db.transaction('rw', [db.meta, db.outbox], async () => {
    await setMeta(db, 'user', next);
    await enqueue(db, { type: 'user.update', baseRevision: user.revision, changes }, 'user', user.id);
  });
  return next;
}

export async function dismiss(db: DailyPlateDb, key: string, kind: 'meal-combo' | 'suggestion'): Promise<void> {
  await db.transaction('rw', [db.dismissals, db.outbox], async () => {
    await db.dismissals.put({ key, kind, createdAt: nowIso() });
    await enqueue(db, { type: 'dismissal.add', key, kind }, 'dismissal', key);
  });
}
