import type {
  Change,
  DaySnapshot,
  DiaryEntry,
  Dismissal,
  EntityType,
  Food,
  FoodVersion,
  GoalTemplateDto,
  Receipt,
  Recipe,
  RecipeVersion,
  SavedMeal,
  User,
} from '@daily-plate/contracts';
import { DEFAULT_GOAL_TEMPLATE } from '@daily-plate/domain';
import type { Db } from './database.js';
import { newId, nowIso } from '../ids.js';

/**
 * Store: thin typed access to rows. Entities are stored as JSON documents with
 * a few indexed columns; every read is scoped by user id.
 */
export class Store {
  constructor(readonly db: Db) {}

  /* ---------- users ---------- */

  createUser(displayName: string, timeZone: string): User {
    const id = newId();
    const createdAt = nowIso();
    this.db
      .prepare('insert into users (id, display_name, time_zone, training_weekdays, setup_confirmed_at, revision, created_at) values (?, ?, ?, ?, NULL, 1, ?)')
      .run(id, displayName, timeZone, '[]', createdAt);
    const t = DEFAULT_GOAL_TEMPLATE;
    this.db
      .prepare('insert into goal_templates (user_id, rest, training, secondary, revision, updated_at) values (?, ?, ?, ?, 1, ?)')
      .run(id, JSON.stringify(t.rest), JSON.stringify(t.training), JSON.stringify(t.secondary), createdAt);
    return this.getUser(id) as User;
  }

  getUser(id: string): User | undefined {
    const row = this.db.prepare('select * from users where id = ?').get(id) as
      | { id: string; display_name: string; time_zone: string; training_weekdays: string; setup_confirmed_at: string | null; revision: number }
      | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      displayName: row.display_name,
      timeZone: row.time_zone,
      trainingWeekdays: JSON.parse(row.training_weekdays) as number[],
      setupConfirmedAt: row.setup_confirmed_at,
      revision: row.revision,
    };
  }

  listUsers(): User[] {
    const ids = this.db.prepare('select id from users order by created_at').all() as { id: string }[];
    return ids.map((r) => this.getUser(r.id) as User);
  }

  saveUser(user: User): void {
    this.db
      .prepare('update users set display_name = ?, time_zone = ?, training_weekdays = ?, setup_confirmed_at = ?, revision = ? where id = ?')
      .run(user.displayName, user.timeZone, JSON.stringify(user.trainingWeekdays), user.setupConfirmedAt, user.revision, user.id);
  }

  /* ---------- goals ---------- */

  getGoals(userId: string): GoalTemplateDto {
    const row = this.db.prepare('select * from goal_templates where user_id = ?').get(userId) as
      | { rest: string; training: string; secondary: string; revision: number; updated_at: string }
      | undefined;
    if (!row) throw new Error('goal template missing');
    return {
      rest: JSON.parse(row.rest),
      training: JSON.parse(row.training),
      secondary: JSON.parse(row.secondary),
      revision: row.revision,
      updatedAt: row.updated_at,
    };
  }

  saveGoals(userId: string, goals: GoalTemplateDto): void {
    this.db
      .prepare('update goal_templates set rest = ?, training = ?, secondary = ?, revision = ?, updated_at = ? where user_id = ?')
      .run(JSON.stringify(goals.rest), JSON.stringify(goals.training), JSON.stringify(goals.secondary), goals.revision, goals.updatedAt, userId);
  }

  /* ---------- day snapshots ---------- */

  getDay(userId: string, localDate: string): DaySnapshot | undefined {
    const row = this.db.prepare('select * from day_snapshots where user_id = ? and local_date = ?').get(userId, localDate) as
      | { local_date: string; day_type: 'rest' | 'training'; targets: string; secondary: string; template_revision: number; revision: number; updated_at: string }
      | undefined;
    if (!row) return undefined;
    return {
      localDate: row.local_date,
      dayType: row.day_type,
      targets: JSON.parse(row.targets),
      secondary: JSON.parse(row.secondary),
      templateRevision: row.template_revision,
      revision: row.revision,
      updatedAt: row.updated_at,
    };
  }

  listDays(userId: string, from: string, to: string): DaySnapshot[] {
    const rows = this.db.prepare('select local_date from day_snapshots where user_id = ? and local_date between ? and ? order by local_date').all(userId, from, to) as { local_date: string }[];
    return rows.map((r) => this.getDay(userId, r.local_date) as DaySnapshot);
  }

  saveDay(userId: string, day: DaySnapshot): void {
    this.db
      .prepare(
        `insert into day_snapshots (user_id, local_date, day_type, targets, secondary, template_revision, revision, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (user_id, local_date) do update set day_type = excluded.day_type, targets = excluded.targets, secondary = excluded.secondary,
           template_revision = excluded.template_revision, revision = excluded.revision, updated_at = excluded.updated_at`,
      )
      .run(userId, day.localDate, day.dayType, JSON.stringify(day.targets), JSON.stringify(day.secondary), day.templateRevision, day.revision, day.updatedAt);
  }

  /* ---------- foods ---------- */

  getFood(userId: string, id: string): Food | undefined {
    const row = this.db.prepare('select data from foods where id = ? and user_id = ?').get(id, userId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Food) : undefined;
  }

  listFoods(userId: string, includeHidden = true): Food[] {
    const rows = this.db.prepare(`select data from foods where user_id = ? ${includeHidden ? '' : 'and hidden = 0'} order by updated_at`).all(userId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Food);
  }

  saveFood(userId: string, food: Food): void {
    this.db
      .prepare(
        `insert into foods (id, user_id, data, name_lower, revision, hidden, updated_at) values (?, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set data = excluded.data, name_lower = excluded.name_lower, revision = excluded.revision, hidden = excluded.hidden, updated_at = excluded.updated_at
         where foods.user_id = excluded.user_id`,
      )
      .run(food.id, userId, JSON.stringify(food), food.name.toLowerCase(), food.revision, food.hidden ? 1 : 0, food.updatedAt);
  }

  getFoodVersion(userId: string, id: string): FoodVersion | undefined {
    const row = this.db.prepare('select data from food_versions where id = ? and user_id = ?').get(id, userId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as FoodVersion) : undefined;
  }

  listFoodVersions(userId: string): FoodVersion[] {
    const rows = this.db.prepare('select data from food_versions where user_id = ? order by created_at').all(userId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as FoodVersion);
  }

  listFoodVersionsByBarcode(userId: string, barcode: string): FoodVersion[] {
    const rows = this.db.prepare('select data from food_versions where user_id = ? and barcode = ? order by created_at desc').all(userId, barcode) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as FoodVersion);
  }

  nextFoodVersionNumber(foodId: string): number {
    const row = this.db.prepare('select coalesce(max(version), 0) as v from food_versions where food_id = ?').get(foodId) as { v: number };
    return row.v + 1;
  }

  saveFoodVersion(userId: string, version: FoodVersion): void {
    this.db
      .prepare('insert into food_versions (id, food_id, user_id, version, barcode, data, created_at) values (?, ?, ?, ?, ?, ?, ?)')
      .run(version.id, version.foodId, userId, version.version, version.barcode ?? null, JSON.stringify(version), version.createdAt);
  }

  /* ---------- diary ---------- */

  getEntry(userId: string, id: string): DiaryEntry | undefined {
    const row = this.db.prepare('select data from diary_entries where id = ? and user_id = ?').get(id, userId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as DiaryEntry) : undefined;
  }

  listEntries(userId: string, from: string, to: string, includeDeleted = false): DiaryEntry[] {
    const rows = this.db
      .prepare(`select data from diary_entries where user_id = ? and local_date between ? and ? ${includeDeleted ? '' : 'and deleted = 0'} order by local_date, created_at`)
      .all(userId, from, to) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as DiaryEntry);
  }

  listAllEntries(userId: string): DiaryEntry[] {
    const rows = this.db.prepare('select data from diary_entries where user_id = ? and deleted = 0 order by local_date, created_at').all(userId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as DiaryEntry);
  }

  saveEntry(userId: string, entry: DiaryEntry): void {
    this.db
      .prepare(
        `insert into diary_entries (id, user_id, local_date, data, revision, deleted, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)
         on conflict (id) do update set local_date = excluded.local_date, data = excluded.data, revision = excluded.revision, deleted = excluded.deleted, updated_at = excluded.updated_at
         where diary_entries.user_id = excluded.user_id`,
      )
      .run(entry.id, userId, entry.localDate, JSON.stringify(entry), entry.revision, entry.deleted ? 1 : 0, entry.createdAt, entry.updatedAt);
  }

  entryExistsForAnyUser(id: string): boolean {
    return Boolean(this.db.prepare('select 1 from diary_entries where id = ?').get(id));
  }

  /* ---------- meals ---------- */

  getMeal(userId: string, id: string): SavedMeal | undefined {
    const row = this.db.prepare('select data from saved_meals where id = ? and user_id = ?').get(id, userId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as SavedMeal) : undefined;
  }

  listMeals(userId: string): SavedMeal[] {
    const rows = this.db.prepare('select data from saved_meals where user_id = ? and deleted = 0 order by updated_at').all(userId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as SavedMeal);
  }

  saveMeal(userId: string, meal: SavedMeal): void {
    this.db
      .prepare(
        `insert into saved_meals (id, user_id, data, revision, deleted, updated_at) values (?, ?, ?, ?, ?, ?)
         on conflict (id) do update set data = excluded.data, revision = excluded.revision, deleted = excluded.deleted, updated_at = excluded.updated_at
         where saved_meals.user_id = excluded.user_id`,
      )
      .run(meal.id, userId, JSON.stringify(meal), meal.revision, meal.deleted ? 1 : 0, meal.updatedAt);
  }

  /* ---------- recipes ---------- */

  getRecipe(userId: string, id: string): Recipe | undefined {
    const row = this.db.prepare('select data from recipes where id = ? and user_id = ?').get(id, userId) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as Recipe) : undefined;
  }

  listRecipes(userId: string): Recipe[] {
    const rows = this.db.prepare('select data from recipes where user_id = ? and deleted = 0 order by updated_at').all(userId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Recipe);
  }

  saveRecipe(userId: string, recipe: Recipe): void {
    this.db
      .prepare(
        `insert into recipes (id, user_id, data, revision, deleted, updated_at) values (?, ?, ?, ?, ?, ?)
         on conflict (id) do update set data = excluded.data, revision = excluded.revision, deleted = excluded.deleted, updated_at = excluded.updated_at
         where recipes.user_id = excluded.user_id`,
      )
      .run(recipe.id, userId, JSON.stringify(recipe), recipe.revision, recipe.deleted ? 1 : 0, recipe.updatedAt);
  }

  listRecipeVersions(userId: string): RecipeVersion[] {
    const rows = this.db.prepare('select data from recipe_versions where user_id = ? order by created_at').all(userId) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as RecipeVersion);
  }

  nextRecipeVersionNumber(recipeId: string): number {
    const row = this.db.prepare('select coalesce(max(version), 0) as v from recipe_versions where recipe_id = ?').get(recipeId) as { v: number };
    return row.v + 1;
  }

  saveRecipeVersion(userId: string, version: RecipeVersion): void {
    this.db
      .prepare('insert into recipe_versions (id, recipe_id, user_id, version, data, created_at) values (?, ?, ?, ?, ?, ?)')
      .run(version.id, version.recipeId, userId, version.version, JSON.stringify(version), version.createdAt);
  }

  /* ---------- dismissals ---------- */

  listDismissals(userId: string): Dismissal[] {
    const rows = this.db.prepare('select key, kind, created_at from dismissals where user_id = ?').all(userId) as { key: string; kind: 'meal-combo' | 'suggestion'; created_at: string }[];
    return rows.map((r) => ({ key: r.key, kind: r.kind, createdAt: r.created_at }));
  }

  saveDismissal(userId: string, d: Dismissal): void {
    this.db.prepare('insert or replace into dismissals (user_id, key, kind, created_at) values (?, ?, ?, ?)').run(userId, d.key, d.kind, d.createdAt);
  }

  /* ---------- receipts / changes ---------- */

  getReceipt(userId: string, mutationId: string): { digest: string; result: unknown } | undefined {
    const row = this.db.prepare('select payload_digest, result from mutation_receipts where user_id = ? and mutation_id = ?').get(userId, mutationId) as
      | { payload_digest: string; result: string }
      | undefined;
    return row ? { digest: row.payload_digest, result: JSON.parse(row.result) } : undefined;
  }

  saveReceipt(userId: string, mutationId: string, digest: string, result: unknown): void {
    this.db
      .prepare('insert into mutation_receipts (user_id, mutation_id, payload_digest, result, committed_at) values (?, ?, ?, ?, ?)')
      .run(userId, mutationId, digest, JSON.stringify(result), nowIso());
  }

  appendChange(userId: string, entityType: EntityType, entityId: string, revision: number, deleted: boolean, data: unknown): number {
    const info = this.db
      .prepare('insert into change_feed (user_id, entity_type, entity_id, revision, deleted, data, created_at) values (?, ?, ?, ?, ?, ?, ?)')
      .run(userId, entityType, entityId, revision, deleted ? 1 : 0, data === undefined ? null : JSON.stringify(data), nowIso());
    return Number(info.lastInsertRowid);
  }

  listChanges(userId: string, cursor: number, limit: number): { changes: Change[]; more: boolean } {
    const rows = this.db
      .prepare('select seq, entity_type, entity_id, revision, deleted, data from change_feed where user_id = ? and seq > ? order by seq limit ?')
      .all(userId, cursor, limit + 1) as { seq: number; entity_type: EntityType; entity_id: string; revision: number; deleted: number; data: string | null }[];
    const more = rows.length > limit;
    const changes = rows.slice(0, limit).map((r) => ({
      seq: r.seq,
      entityType: r.entity_type,
      entityId: r.entity_id,
      revision: r.revision,
      deleted: r.deleted === 1,
      data: r.data === null ? undefined : (JSON.parse(r.data) as unknown),
    }));
    return { changes, more };
  }

  latestSeq(userId: string): number {
    const row = this.db.prepare('select coalesce(max(seq), 0) as s from change_feed where user_id = ?').get(userId) as { s: number };
    return row.s;
  }

  /* ---------- provider cache ---------- */

  getCache(provider: string, key: string): { status: string; payload: unknown; fetchedAt: string } | undefined {
    const row = this.db.prepare('select status, payload, fetched_at from provider_cache where provider = ? and cache_key = ? and expires_at > ?').get(provider, key, nowIso()) as
      | { status: string; payload: string | null; fetched_at: string }
      | undefined;
    if (!row) return undefined;
    return { status: row.status, payload: row.payload === null ? null : JSON.parse(row.payload), fetchedAt: row.fetched_at };
  }

  putCache(provider: string, key: string, status: string, payload: unknown, ttlMs: number): void {
    const now = Date.now();
    this.db
      .prepare('insert or replace into provider_cache (provider, cache_key, status, payload, fetched_at, expires_at) values (?, ?, ?, ?, ?, ?)')
      .run(provider, key, status, payload === undefined ? null : JSON.stringify(payload), new Date(now).toISOString(), new Date(now + ttlMs).toISOString());
  }

  /* ---------- meta ---------- */

  getMeta(key: string): string | undefined {
    const row = this.db.prepare('select value from meta where key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare('insert or replace into meta (key, value) values (?, ?)').run(key, value);
  }

  counts(): Record<string, number> {
    const tables = ['users', 'foods', 'food_versions', 'diary_entries', 'saved_meals', 'recipes', 'recipe_versions', 'day_snapshots', 'mutation_receipts', 'change_feed', 'passkeys', 'sessions'];
    const out: Record<string, number> = {};
    for (const t of tables) out[t] = (this.db.prepare(`select count(*) as c from ${t}`).get() as { c: number }).c;
    return out;
  }
}

export type { Receipt };
