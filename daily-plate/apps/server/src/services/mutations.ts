import {
  buildDiarySnapshot,
  virtualDaySnapshot,
  type DiaryEntry,
  type EntityType,
  type Food,
  type FoodVersion,
  type Mutation,
  type MutationPayload,
  type MutationResult,
  type Receipt,
  type Recipe,
  type RecipeVersion,
  type SavedMeal,
  MutationSchema,
} from '@daily-plate/contracts';
import { calculateRecipe, resolveQuantity, type NutrientSet } from '@daily-plate/domain';
import type { Store } from '../db/store.js';
import { canonicalDigest, nowIso } from '../ids.js';

export class MutationError extends Error {
  constructor(
    readonly code: 'invalid' | 'not-found' | 'forbidden' | 'incompatible-quantity' | 'storage',
    message: string,
  ) {
    super(message);
  }
}

export class ConflictError extends Error {
  constructor(
    readonly current: unknown,
    message = 'This was changed elsewhere.',
  ) {
    super(message);
  }
}

interface Applied {
  entityType: EntityType;
  entityId: string;
  revision: number;
}

interface AppliedSet {
  primary: Applied;
  changes: Array<{ entityType: EntityType; entityId: string; revision: number; deleted: boolean; data: unknown }>;
}

/**
 * Applies one mutation for one user inside a single SQLite transaction:
 * receipt lookup (idempotency), validation, entity write, change feed, receipt.
 * The same mutation id with the same payload returns the same receipt.
 */
export function applyMutation(store: Store, userId: string, raw: unknown): MutationResult {
  const parsed = MutationSchema.safeParse(raw);
  if (!parsed.success) {
    const id = typeof raw === 'object' && raw && 'mutationId' in raw && typeof (raw as { mutationId: unknown }).mutationId === 'string' ? (raw as { mutationId: string }).mutationId : '00000000-0000-4000-8000-000000000000';
    return { status: 'rejected', mutationId: id, error: { code: 'invalid', message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') } };
  }
  const mutation = parsed.data;
  const digest = canonicalDigest(mutation.payload);

  const run = store.db.transaction((): MutationResult => {
    const existing = store.getReceipt(userId, mutation.mutationId);
    if (existing) {
      if (existing.digest !== digest) {
        return { status: 'rejected', mutationId: mutation.mutationId, error: { code: 'payload-mismatch', message: 'This mutation id was already used with a different payload.' } };
      }
      const prior = existing.result as MutationResult;
      if (prior.status === 'committed') return { status: 'duplicate', mutationId: mutation.mutationId, receipt: prior.receipt };
      return prior;
    }
    let result: MutationResult;
    try {
      const applied = apply(store, userId, mutation);
      const seq = appendChanges(store, userId, applied);
      const receipt: Receipt = {
        mutationId: mutation.mutationId,
        entityType: applied.primary.entityType,
        entityId: applied.primary.entityId,
        revision: applied.primary.revision,
        seq,
        committedAt: nowIso(),
      };
      result = { status: 'committed', mutationId: mutation.mutationId, receipt };
    } catch (err) {
      if (err instanceof ConflictError) {
        result = { status: 'conflict', mutationId: mutation.mutationId, error: { code: 'conflict', message: err.message }, current: err.current };
        // Conflicts are not receipted: the client may retry with a fresh base revision.
        return result;
      }
      if (err instanceof MutationError) {
        result = { status: 'rejected', mutationId: mutation.mutationId, error: { code: err.code, message: err.message } };
        return result;
      }
      throw err;
    }
    store.saveReceipt(userId, mutation.mutationId, digest, result);
    return result;
  });
  return run();
}

function appendChanges(store: Store, userId: string, applied: AppliedSet): number {
  let last = 0;
  for (const c of applied.changes) last = store.appendChange(userId, c.entityType, c.entityId, c.revision, c.deleted, c.data);
  return last;
}

function apply(store: Store, userId: string, mutation: Mutation): AppliedSet {
  const p = mutation.payload;
  switch (p.type) {
    case 'diary.add':
      return diaryAdd(store, userId, p);
    case 'diary.update':
      return diaryUpdate(store, userId, p);
    case 'diary.delete':
      return diaryDelete(store, userId, p.entryId, p.baseRevision, true);
    case 'diary.restore':
      return diaryDelete(store, userId, p.entryId, p.baseRevision, false);
    case 'food.upsert':
      return foodUpsert(store, userId, p);
    case 'food.update':
      return foodUpdate(store, userId, p);
    case 'meal.upsert':
      return mealUpsert(store, userId, p);
    case 'meal.delete':
      return mealDelete(store, userId, p);
    case 'recipe.upsert':
      return recipeUpsert(store, userId, p);
    case 'recipe.delete':
      return recipeDelete(store, userId, p);
    case 'day.setType':
      return daySetType(store, userId, p);
    case 'goals.update':
      return goalsUpdate(store, userId, p);
    case 'user.update':
      return userUpdate(store, userId, p);
    case 'dismissal.add': {
      const d = { key: p.key, kind: p.kind, createdAt: nowIso() };
      store.saveDismissal(userId, d);
      return { primary: { entityType: 'dismissal', entityId: p.key, revision: 1 }, changes: [{ entityType: 'dismissal', entityId: p.key, revision: 1, deleted: false, data: d }] };
    }
  }
}

/** Ensures a persisted goal snapshot exists for a date the user is writing to. */
function ensureDay(store: Store, userId: string, localDate: string): AppliedSet['changes'] {
  if (store.getDay(userId, localDate)) return [];
  const user = store.getUser(userId);
  if (!user) throw new MutationError('forbidden', 'Unknown user');
  const goals = store.getGoals(userId);
  const day = { ...virtualDaySnapshot(goals, user, localDate), revision: 1, updatedAt: nowIso() };
  store.saveDay(userId, day);
  return [{ entityType: 'day', entityId: localDate, revision: 1, deleted: false, data: day }];
}

function materializeEntry(store: Store, userId: string, input: Extract<MutationPayload, { type: 'diary.add' }>['entry']): Omit<DiaryEntry, 'revision' | 'deleted' | 'createdAt' | 'updatedAt'> {
  if (input.kind === 'draft') {
    if (!input.draft) throw new MutationError('invalid', 'A draft entry needs its text.');
    const { foodId: _f, foodVersionId: _v, quantity: _q, factor: _fa, snapshot: _s, ...rest } = input;
    return { ...rest, kind: 'draft' };
  }
  if (!input.foodVersionId || !input.quantity) throw new MutationError('invalid', 'A food entry needs a food version and a quantity.');
  const version = store.getFoodVersion(userId, input.foodVersionId);
  if (!version) throw new MutationError('not-found', 'That food is not in your foods.');
  const built = buildDiarySnapshot(version, input.quantity);
  if (!built.ok) throw new MutationError('incompatible-quantity', built.error.message);
  const { draft: _d, ...rest } = input;
  return { ...rest, kind: 'food', foodId: version.foodId, foodVersionId: version.id, factor: built.factor, snapshot: built.snapshot };
}

function diaryAdd(store: Store, userId: string, p: Extract<MutationPayload, { type: 'diary.add' }>): AppliedSet {
  if (store.entryExistsForAnyUser(p.entry.id)) {
    const mine = store.getEntry(userId, p.entry.id);
    if (!mine) throw new MutationError('forbidden', 'Entry id is not available.');
    // Same user re-adding an existing id with a new mutation id: treat as conflict, never a silent duplicate.
    throw new ConflictError(mine, 'This entry already exists.');
  }
  const now = nowIso();
  const entry: DiaryEntry = { ...materializeEntry(store, userId, p.entry), revision: 1, deleted: false, createdAt: now, updatedAt: now };
  const dayChanges = ensureDay(store, userId, entry.localDate);
  store.saveEntry(userId, entry);
  touchFoodUsage(store, userId, entry);
  return { primary: { entityType: 'entry', entityId: entry.id, revision: 1 }, changes: [...dayChanges, { entityType: 'entry', entityId: entry.id, revision: 1, deleted: false, data: entry }] };
}

function touchFoodUsage(store: Store, userId: string, entry: DiaryEntry): void {
  if (entry.kind !== 'food' || !entry.foodId || !entry.quantity) return;
  const food = store.getFood(userId, entry.foodId);
  if (!food) return;
  // Remember the last deliberately chosen quantity as a proposable default (never overrides a pin).
  const updated: Food = { ...food, lastQuantity: entry.quantity, updatedAt: nowIso() };
  store.saveFood(userId, updated);
}

function diaryUpdate(store: Store, userId: string, p: Extract<MutationPayload, { type: 'diary.update' }>): AppliedSet {
  const current = store.getEntry(userId, p.entryId);
  if (!current) throw new MutationError('not-found', 'That entry is not in your diary.');
  if (current.revision !== p.baseRevision) throw new ConflictError(current);
  if (p.entry.id !== p.entryId) throw new MutationError('invalid', 'Entry id mismatch.');
  const next: DiaryEntry = { ...materializeEntry(store, userId, p.entry), revision: current.revision + 1, deleted: current.deleted, createdAt: current.createdAt, updatedAt: nowIso() };
  const dayChanges = ensureDay(store, userId, next.localDate);
  store.saveEntry(userId, next);
  return { primary: { entityType: 'entry', entityId: next.id, revision: next.revision }, changes: [...dayChanges, { entityType: 'entry', entityId: next.id, revision: next.revision, deleted: false, data: next }] };
}

function diaryDelete(store: Store, userId: string, entryId: string, baseRevision: number, deleted: boolean): AppliedSet {
  const current = store.getEntry(userId, entryId);
  if (!current) throw new MutationError('not-found', 'That entry is not in your diary.');
  if (current.revision !== baseRevision) throw new ConflictError(current);
  const next: DiaryEntry = { ...current, deleted, revision: current.revision + 1, updatedAt: nowIso() };
  store.saveEntry(userId, next);
  return { primary: { entityType: 'entry', entityId: next.id, revision: next.revision }, changes: [{ entityType: 'entry', entityId: next.id, revision: next.revision, deleted, data: next }] };
}

function validatePortions(version: { portions: { id: string }[]; defaultQuantity?: { unit: { kind: string; portionId?: string } } | undefined }): void {
  const ids = new Set<string>();
  for (const p of version.portions) {
    if (ids.has(p.id)) throw new MutationError('invalid', 'Duplicate portion id.');
    ids.add(p.id);
  }
  const dq = version.defaultQuantity;
  if (dq && dq.unit.kind === 'portion' && dq.unit.portionId && !ids.has(dq.unit.portionId)) throw new MutationError('invalid', 'Default quantity refers to an unknown portion.');
}

function foodUpsert(store: Store, userId: string, p: Extract<MutationPayload, { type: 'food.upsert' }>): AppliedSet {
  validatePortions(p.version);
  const now = nowIso();
  const existing = store.getFood(userId, p.food.id);
  if (!existing && store.db.prepare('select 1 from foods where id = ?').get(p.food.id)) throw new MutationError('forbidden', 'Food id is not available.');
  if (existing && p.baseRevision !== undefined && existing.revision !== p.baseRevision) throw new ConflictError(existing);
  const versionNumber = store.nextFoodVersionNumber(p.food.id);
  if (store.db.prepare('select 1 from food_versions where id = ?').get(p.version.id)) throw new MutationError('forbidden', 'Food version id is not available.');
  const version: FoodVersion = { ...p.version, foodId: p.food.id, version: versionNumber, createdAt: now };
  // A version's quantity must be resolvable at its default so logging never fails later.
  if (version.defaultQuantity) {
    const r = resolveQuantity({ basis: version.basis, portions: version.portions }, version.defaultQuantity);
    if (!r.ok) throw new MutationError('incompatible-quantity', r.error.message);
  }
  const food: Food = existing
    ? { ...existing, ...p.food, currentVersionId: version.id, revision: existing.revision + 1, updatedAt: now }
    : { ...p.food, currentVersionId: version.id, revision: 1, updatedAt: now };
  store.saveFood(userId, food);
  store.saveFoodVersion(userId, version);
  return {
    primary: { entityType: 'food', entityId: food.id, revision: food.revision },
    changes: [
      { entityType: 'foodVersion', entityId: version.id, revision: version.version, deleted: false, data: version },
      { entityType: 'food', entityId: food.id, revision: food.revision, deleted: false, data: food },
    ],
  };
}

function foodUpdate(store: Store, userId: string, p: Extract<MutationPayload, { type: 'food.update' }>): AppliedSet {
  const existing = store.getFood(userId, p.foodId);
  if (!existing) throw new MutationError('not-found', 'That food is not in your foods.');
  if (existing.revision !== p.baseRevision) throw new ConflictError(existing);
  if (p.changes.pin) {
    const version = store.getFoodVersion(userId, existing.currentVersionId);
    if (!version) throw new MutationError('storage', 'Food version missing.');
    const r = resolveQuantity({ basis: version.basis, portions: version.portions }, p.changes.pin.quantity);
    if (!r.ok) throw new MutationError('incompatible-quantity', r.error.message);
  }
  const food: Food = { ...existing, ...stripUndefined(p.changes), revision: existing.revision + 1, updatedAt: nowIso() };
  store.saveFood(userId, food);
  return { primary: { entityType: 'food', entityId: food.id, revision: food.revision }, changes: [{ entityType: 'food', entityId: food.id, revision: food.revision, deleted: false, data: food }] };
}

/** Drops undefined keys so a partial change set never blanks a required field. */
function stripUndefined<T extends object>(obj: T): { [K in keyof T]-?: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as { [K in keyof T]-?: Exclude<T[K], undefined> };
}

function mealUpsert(store: Store, userId: string, p: Extract<MutationPayload, { type: 'meal.upsert' }>): AppliedSet {
  for (const item of p.meal.items) {
    const version = store.getFoodVersion(userId, item.foodVersionId);
    if (!version || version.foodId !== item.foodId) throw new MutationError('not-found', 'A meal item refers to a food that is not yours.');
    const r = resolveQuantity({ basis: version.basis, portions: version.portions }, item.quantity);
    if (!r.ok) throw new MutationError('incompatible-quantity', r.error.message);
  }
  const existing = store.getMeal(userId, p.meal.id);
  if (!existing && store.db.prepare('select 1 from saved_meals where id = ?').get(p.meal.id)) throw new MutationError('forbidden', 'Meal id is not available.');
  if (existing && p.baseRevision !== undefined && existing.revision !== p.baseRevision) throw new ConflictError(existing);
  const meal: SavedMeal = { ...p.meal, revision: existing ? existing.revision + 1 : 1, deleted: false, updatedAt: nowIso() };
  store.saveMeal(userId, meal);
  return { primary: { entityType: 'meal', entityId: meal.id, revision: meal.revision }, changes: [{ entityType: 'meal', entityId: meal.id, revision: meal.revision, deleted: false, data: meal }] };
}

function mealDelete(store: Store, userId: string, p: Extract<MutationPayload, { type: 'meal.delete' }>): AppliedSet {
  const existing = store.getMeal(userId, p.mealId);
  if (!existing) throw new MutationError('not-found', 'That meal is not in your foods.');
  if (existing.revision !== p.baseRevision) throw new ConflictError(existing);
  const meal: SavedMeal = { ...existing, deleted: true, revision: existing.revision + 1, updatedAt: nowIso() };
  store.saveMeal(userId, meal);
  return { primary: { entityType: 'meal', entityId: meal.id, revision: meal.revision }, changes: [{ entityType: 'meal', entityId: meal.id, revision: meal.revision, deleted: true, data: meal }] };
}

function recipeUpsert(store: Store, userId: string, p: Extract<MutationPayload, { type: 'recipe.upsert' }>): AppliedSet {
  const now = nowIso();
  const existing = store.getRecipe(userId, p.recipeId);
  if (!existing && store.db.prepare('select 1 from recipes where id = ?').get(p.recipeId)) throw new MutationError('forbidden', 'Recipe id is not available.');
  if (existing && p.baseRevision !== undefined && existing.revision !== p.baseRevision) throw new ConflictError(existing);

  const ingredients = p.ingredients.map((i) => {
    const version = store.getFoodVersion(userId, i.foodVersionId);
    if (!version || version.foodId !== i.foodId) throw new MutationError('not-found', 'An ingredient refers to a food that is not yours.');
    const r = resolveQuantity({ basis: version.basis, portions: version.portions }, i.quantity);
    if (!r.ok) throw new MutationError('incompatible-quantity', `${version.name}: ${r.error.message}`);
    return { input: { ...i, factor: r.factor }, nutrients: version.nutrients as NutrientSet };
  });
  const calc = calculateRecipe(
    ingredients.map((i) => ({ nutrients: i.nutrients, factor: i.input.factor })),
    p.yieldServings,
  );

  const foodId = existing?.foodId ?? p.foodId;
  if (!existing && store.db.prepare('select 1 from foods where id = ?').get(foodId)) throw new MutationError('forbidden', 'Food id is not available.');
  if (store.db.prepare('select 1 from food_versions where id = ?').get(p.foodVersionId)) throw new MutationError('forbidden', 'Food version id is not available.');
  if (store.db.prepare('select 1 from recipe_versions where id = ?').get(p.recipeVersionId)) throw new MutationError('forbidden', 'Recipe version id is not available.');
  const foodVersion: FoodVersion = {
    id: p.foodVersionId,
    foodId,
    version: store.nextFoodVersionNumber(foodId),
    name: p.name,
    preparation: 'prepared',
    basis: { kind: 'serving', servingText: `1 ${p.servingName}` },
    nutrients: calc.perServing,
    portions: [{ id: 'serving', name: p.servingName, servings: '1' }],
    defaultQuantity: { amount: '1', unit: { kind: 'portion', portionId: 'serving' } },
    provenance: { provider: 'recipe', providerId: p.recipeId, fetchedAt: now, normalizationVersion: 'recipe-1' },
    createdAt: now,
  };
  const recipeVersion: RecipeVersion = {
    id: p.recipeVersionId,
    recipeId: p.recipeId,
    version: store.nextRecipeVersionNumber(p.recipeId),
    name: p.name,
    ingredients: ingredients.map((i) => i.input),
    yieldServings: p.yieldServings,
    servingName: p.servingName,
    perServing: calc.perServing,
    incomplete: calc.incomplete,
    foodVersionId: foodVersion.id,
    createdAt: now,
  };
  const existingFood = store.getFood(userId, foodId);
  const food: Food = existingFood
    ? { ...existingFood, name: p.name, currentVersionId: foodVersion.id, revision: existingFood.revision + 1, updatedAt: now }
    : { id: foodId, name: p.name, aliases: [], currentVersionId: foodVersion.id, pin: null, suggestEligible: true, tags: [], hidden: false, revision: 1, updatedAt: now };
  const recipe: Recipe = { id: p.recipeId, name: p.name, foodId, currentVersionId: recipeVersion.id, revision: existing ? existing.revision + 1 : 1, deleted: false, updatedAt: now };

  store.saveFood(userId, food);
  store.saveFoodVersion(userId, foodVersion);
  store.saveRecipe(userId, recipe);
  store.saveRecipeVersion(userId, recipeVersion);
  return {
    primary: { entityType: 'recipe', entityId: recipe.id, revision: recipe.revision },
    changes: [
      { entityType: 'foodVersion', entityId: foodVersion.id, revision: foodVersion.version, deleted: false, data: foodVersion },
      { entityType: 'food', entityId: food.id, revision: food.revision, deleted: false, data: food },
      { entityType: 'recipeVersion', entityId: recipeVersion.id, revision: recipeVersion.version, deleted: false, data: recipeVersion },
      { entityType: 'recipe', entityId: recipe.id, revision: recipe.revision, deleted: false, data: recipe },
    ],
  };
}

function recipeDelete(store: Store, userId: string, p: Extract<MutationPayload, { type: 'recipe.delete' }>): AppliedSet {
  const existing = store.getRecipe(userId, p.recipeId);
  if (!existing) throw new MutationError('not-found', 'That recipe is not in your foods.');
  if (existing.revision !== p.baseRevision) throw new ConflictError(existing);
  const now = nowIso();
  const recipe: Recipe = { ...existing, deleted: true, revision: existing.revision + 1, updatedAt: now };
  store.saveRecipe(userId, recipe);
  const changes: AppliedSet['changes'] = [{ entityType: 'recipe', entityId: recipe.id, revision: recipe.revision, deleted: true, data: recipe }];
  const food = store.getFood(userId, existing.foodId);
  if (food && !food.hidden) {
    const hidden: Food = { ...food, hidden: true, pin: null, revision: food.revision + 1, updatedAt: now };
    store.saveFood(userId, hidden);
    changes.push({ entityType: 'food', entityId: hidden.id, revision: hidden.revision, deleted: false, data: hidden });
  }
  return { primary: { entityType: 'recipe', entityId: recipe.id, revision: recipe.revision }, changes };
}

function daySetType(store: Store, userId: string, p: Extract<MutationPayload, { type: 'day.setType' }>): AppliedSet {
  const user = store.getUser(userId);
  if (!user) throw new MutationError('forbidden', 'Unknown user');
  const goals = store.getGoals(userId);
  const existing = store.getDay(userId, p.localDate);
  const fresh = virtualDaySnapshot(goals, user, p.localDate, p.dayType);
  const day = { ...fresh, revision: existing ? existing.revision + 1 : 1, updatedAt: nowIso() };
  store.saveDay(userId, day);
  return { primary: { entityType: 'day', entityId: day.localDate, revision: day.revision }, changes: [{ entityType: 'day', entityId: day.localDate, revision: day.revision, deleted: false, data: day }] };
}

function goalsUpdate(store: Store, userId: string, p: Extract<MutationPayload, { type: 'goals.update' }>): AppliedSet {
  const current = store.getGoals(userId);
  if (current.revision !== p.baseRevision) throw new ConflictError(current);
  const goals = { rest: p.rest, training: p.training, secondary: p.secondary, revision: current.revision + 1, updatedAt: nowIso() };
  store.saveGoals(userId, goals);
  // Historical day snapshots are deliberately untouched.
  return { primary: { entityType: 'goals', entityId: 'goals', revision: goals.revision }, changes: [{ entityType: 'goals', entityId: 'goals', revision: goals.revision, deleted: false, data: goals }] };
}

function userUpdate(store: Store, userId: string, p: Extract<MutationPayload, { type: 'user.update' }>): AppliedSet {
  const current = store.getUser(userId);
  if (!current) throw new MutationError('forbidden', 'Unknown user');
  if (current.revision !== p.baseRevision) throw new ConflictError(current);
  const { setupConfirmed, ...rest } = p.changes;
  const user = { ...current, ...stripUndefined(rest), revision: current.revision + 1 };
  if (setupConfirmed) user.setupConfirmedAt = nowIso();
  store.saveUser(user);
  return { primary: { entityType: 'user', entityId: user.id, revision: user.revision }, changes: [{ entityType: 'user', entityId: user.id, revision: user.revision, deleted: false, data: user }] };
}
