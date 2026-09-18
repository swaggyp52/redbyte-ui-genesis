import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sumNutrients, type NutrientSet } from '@daily-plate/domain';
import type { Bootstrap, DiaryEntry, Food, FoodVersion } from '@daily-plate/contracts';
import { cleanup, entryFor, makeTestApp, mutation, SHAKE_FOOD, signUp, type Client, type TestApp } from './test-helpers.js';
import { CSRF_HEADER } from './app.js';

let t: TestApp;
let me: Client;

beforeEach(async () => {
  t = await makeTestApp();
  me = await signUp(t, 'Mom');
});

afterEach(async () => {
  await t.close();
  cleanup(t.dataDir);
});

async function addShake(client: Client): Promise<{ food: Food; version: FoodVersion }> {
  const r = await client.mutate([{ type: 'food.upsert', ...SHAKE_FOOD }]);
  expect(r.results[0]?.status).toBe('committed');
  const boot = (await client.get('/api/v1/bootstrap')).json() as Bootstrap;
  const food = boot.foods.find((f) => f.id === SHAKE_FOOD.food.id)!;
  const version = boot.foodVersions.find((v) => v.id === food.currentVersionId)!;
  return { food, version };
}

describe('Gate 1: smallest real path', () => {
  it('N01 bootstrap carries the exact presets for a new user', async () => {
    const boot = (await me.get('/api/v1/bootstrap')).json() as Bootstrap;
    expect(boot.goals.rest).toEqual({ protein: '140', carbs: '130', fat: '45' });
    expect(boot.goals.training).toEqual({ protein: '145', carbs: '165', fat: '40' });
    expect(boot.goals.secondary).toEqual({});
    expect(boot.user.displayName).toBe('Mom');
    expect(boot.user.setupConfirmedAt).toBeNull();
  });

  it('N02 logs the shake at 1.5 servings, computes totals, and recovers after restart', async () => {
    const { version } = await addShake(me);
    const add = await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0001', version.id, '1.5') }]);
    expect(add.results[0]?.status).toBe('committed');

    const day = (await me.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[]; day: { dayType: string; targets: { protein: string } } };
    expect(day.entries).toHaveLength(1);
    const entry = day.entries[0]!;
    expect(entry.factor).toBe('1.5');
    expect(entry.snapshot?.nutrients.protein).toEqual({ status: 'reported', amount: '45' });
    expect(entry.snapshot?.nutrients.carbs).toEqual({ status: 'reported', amount: '22.5' });
    expect(entry.snapshot?.nutrients.fiber).toEqual({ status: 'reported', amount: '7.5' });
    expect(entry.snapshot?.nutrients.fat).toEqual({ status: 'unknown' });
    expect(entry.snapshot?.nutrients.sugar).toEqual({ status: 'unknown' });
    expect(entry.snapshot?.sourceBadge).toBe('Your label');
    expect(entry.snapshot?.quantityLabel).toBe('1.5 × 1 bottle');
    expect(day.day.dayType).toBe('rest');
    expect(day.day.targets.protein).toBe('140');

    const totals = sumNutrients(day.entries.map((e) => e.snapshot!.nutrients as NutrientSet));
    expect(totals.protein.known).toBe('45');
    expect(totals.fat.unknownCount).toBe(1);
    expect(totals.fat.complete).toBe(false);

    // Restart: close the process-level app and reopen the same database file.
    const dataDir = t.dataDir;
    await t.close();
    t = await makeTestApp({ dataDir });
    const boot = await t.app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { cookie: me.cookie } });
    expect(boot.statusCode).toBe(200);
    const body = boot.json() as Bootstrap;
    expect(body.entries.map((e) => e.id)).toEqual(['entry-0001']);
    expect(body.entries[0]?.snapshot?.nutrients.carbs).toEqual({ status: 'reported', amount: '22.5' });
    expect(body.days.find((d) => d.localDate === '2026-09-18')?.targets.carbs).toBe('130');
  });

  it('O02 the same mutation id returns the same receipt; a new id is a real second serving', async () => {
    const { version } = await addShake(me);
    const m = mutation({ type: 'diary.add', entry: entryFor('entry-0002', version.id, '1') });
    const first = await me.post('/api/v1/mutations', { mutations: [m] });
    const second = await me.post('/api/v1/mutations', { mutations: [m] });
    const r1 = (first.json() as { results: Array<{ status: string; receipt: { seq: number; revision: number } }> }).results[0]!;
    const r2 = (second.json() as { results: Array<{ status: string; receipt: { seq: number; revision: number } }> }).results[0]!;
    expect(r1.status).toBe('committed');
    expect(r2.status).toBe('duplicate');
    expect(r2.receipt).toEqual(r1.receipt);

    const mismatch = await me.post('/api/v1/mutations', { mutations: [{ ...m, payload: { type: 'diary.add', entry: entryFor('entry-0003', version.id, '2') } }] });
    expect((mismatch.json() as { results: Array<{ status: string; error: { code: string } }> }).results[0]).toMatchObject({ status: 'rejected', error: { code: 'payload-mismatch' } });

    const another = await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0004', version.id, '1') }]);
    expect(another.results[0]?.status).toBe('committed');
    const day = (await me.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[] };
    expect(day.entries).toHaveLength(2);
  });

  it('U05 edits change the same entry; stale revisions conflict; delete and restore', async () => {
    const { version } = await addShake(me);
    await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0010', version.id, '1') }]);
    const upd = await me.mutate([{ type: 'diary.update', entryId: 'entry-0010', baseRevision: 1, entry: entryFor('entry-0010', version.id, '1', { kind: 'portion', portionId: 'half' }) }]);
    expect(upd.results[0]?.status).toBe('committed');
    const stale = await me.mutate([{ type: 'diary.update', entryId: 'entry-0010', baseRevision: 1, entry: entryFor('entry-0010', version.id, '2') }]);
    expect(stale.results[0]?.status).toBe('conflict');
    expect((stale.results[0]?.current as DiaryEntry).revision).toBe(2);

    let day = (await me.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[] };
    expect(day.entries).toHaveLength(1);
    expect(day.entries[0]?.snapshot?.nutrients.protein).toEqual({ status: 'reported', amount: '15' });
    expect(day.entries[0]?.snapshot?.quantityLabel).toBe('1 half bottle');

    // Move to yesterday.
    const moved = await me.mutate([{ type: 'diary.update', entryId: 'entry-0010', baseRevision: 2, entry: entryFor('entry-0010', version.id, '1', { kind: 'serving' }, '2026-09-17') }]);
    expect(moved.results[0]?.status).toBe('committed');
    day = (await me.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[] };
    expect(day.entries).toHaveLength(0);
    const yesterday = (await me.get('/api/v1/days/2026-09-17')).json() as { entries: DiaryEntry[] };
    expect(yesterday.entries).toHaveLength(1);

    const del = await me.mutate([{ type: 'diary.delete', entryId: 'entry-0010', baseRevision: 3 }]);
    expect(del.results[0]?.status).toBe('committed');
    expect(((await me.get('/api/v1/days/2026-09-17')).json() as { entries: DiaryEntry[] }).entries).toHaveLength(0);
    const restore = await me.mutate([{ type: 'diary.restore', entryId: 'entry-0010', baseRevision: 4 }]);
    expect(restore.results[0]?.status).toBe('committed');
    expect(((await me.get('/api/v1/days/2026-09-17')).json() as { entries: DiaryEntry[] }).entries).toHaveLength(1);
  });

  it('N08 a new label version does not rewrite a past entry', async () => {
    const { food, version } = await addShake(me);
    await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0020', version.id, '1') }]);
    const corrected = { ...SHAKE_FOOD, version: { ...SHAKE_FOOD.version, id: 'food-shake-0001-v2', nutrients: { ...SHAKE_FOOD.version.nutrients, fat: { status: 'reported' as const, amount: '3' } } }, baseRevision: food.revision + 1 };
    // food revision was bumped by lastQuantity tracking on add; read current
    const boot = (await me.get('/api/v1/bootstrap')).json() as Bootstrap;
    const current = boot.foods.find((f) => f.id === food.id)!;
    const r = await me.mutate([{ type: 'food.upsert', food: corrected.food, version: corrected.version, baseRevision: current.revision }]);
    expect(r.results[0]?.status).toBe('committed');
    const after = (await me.get('/api/v1/bootstrap')).json() as Bootstrap;
    const updatedFood = after.foods.find((f) => f.id === food.id)!;
    expect(updatedFood.currentVersionId).not.toBe(version.id);
    const newVersion = after.foodVersions.find((v) => v.id === updatedFood.currentVersionId)!;
    expect(newVersion.version).toBe(2);
    expect(newVersion.nutrients.fat).toEqual({ status: 'reported', amount: '3' });
    const past = after.entries.find((e) => e.id === 'entry-0020')!;
    expect(past.foodVersionId).toBe(version.id);
    expect(past.snapshot?.nutrients.fat).toEqual({ status: 'unknown' });
  });

  it('U06 changing default targets does not touch a day already snapshotted; day type override is per day', async () => {
    const { version } = await addShake(me);
    await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0030', version.id, '1', { kind: 'serving' }, '2026-09-10') }]);
    const setType = await me.mutate([{ type: 'day.setType', localDate: '2026-09-11', dayType: 'training' }]);
    expect(setType.results[0]?.status).toBe('committed');
    const goals = await me.mutate([{ type: 'goals.update', rest: { protein: '150', carbs: '120', fat: '50' }, training: { protein: '155', carbs: '170', fat: '45' }, secondary: { fiber: '25' }, baseRevision: 1 }]);
    expect(goals.results[0]?.status).toBe('committed');

    const d10 = (await me.get('/api/v1/days/2026-09-10')).json() as { day: { targets: { protein: string }; dayType: string } };
    expect(d10.day.targets.protein).toBe('140');
    const d11 = (await me.get('/api/v1/days/2026-09-11')).json() as { day: { targets: { protein: string }; dayType: string } };
    expect(d11.day).toMatchObject({ dayType: 'training', targets: { protein: '145' } });
    const d12 = (await me.get('/api/v1/days/2026-09-12')).json() as { day: { targets: { protein: string }; dayType: string; secondary: { fiber?: string } } };
    expect(d12.day).toMatchObject({ dayType: 'rest', targets: { protein: '150' }, secondary: { fiber: '25' } });
  });

  it('S02 a second user cannot read, change, or replay the first user\'s records', async () => {
    const { version } = await addShake(me);
    await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0040', version.id, '1') }]);
    const other = await signUp(t, 'Other');
    const day = (await other.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[] };
    expect(day.entries).toHaveLength(0);
    const boot = (await other.get('/api/v1/bootstrap')).json() as Bootstrap;
    expect(boot.foods).toHaveLength(0);
    expect(boot.cursor).toBe(0);

    const steal = await other.mutate([
      { type: 'diary.update', entryId: 'entry-0040', baseRevision: 1, entry: entryFor('entry-0040', version.id, '5') },
      { type: 'diary.delete', entryId: 'entry-0040', baseRevision: 1 },
      { type: 'diary.add', entry: entryFor('entry-0041', version.id, '1') },
      { type: 'diary.add', entry: entryFor('entry-0040', version.id, '1') },
    ]);
    expect(steal.results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected', 'rejected']);
    expect((steal.results[2] as { error: { code: string } }).error.code).toBe('not-found');
    expect((steal.results[3] as { error: { code: string } }).error.code).toBe('forbidden');
    const mine = (await me.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[] };
    expect(mine.entries[0]?.factor).toBe('1');

    const changes = (await other.get('/api/v1/changes?cursor=0')).json() as { changes: unknown[] };
    expect(changes.changes).toHaveLength(0);
  });

  it('change feed is monotonic, user scoped, and carries tombstones', async () => {
    const { version } = await addShake(me);
    const r = await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0050', version.id, '1') }, { type: 'diary.delete', entryId: 'entry-0050', baseRevision: 1 }]);
    expect(r.results.map((x) => x.status)).toEqual(['committed', 'committed']);
    const feed = (await me.get('/api/v1/changes?cursor=0')).json() as { changes: Array<{ seq: number; entityType: string; deleted: boolean; entityId: string }>; cursor: number; more: boolean };
    const seqs = feed.changes.map((c) => c.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect(feed.changes.filter((c) => c.entityType === 'entry' && c.entityId === 'entry-0050').map((c) => c.deleted)).toEqual([false, true]);
    expect(feed.changes.some((c) => c.entityType === 'day')).toBe(true);
    expect(feed.cursor).toBe(seqs[seqs.length - 1]);
    const tail = (await me.get(`/api/v1/changes?cursor=${feed.cursor}`)).json() as { changes: unknown[] };
    expect(tail.changes).toHaveLength(0);
  });

  it('U09 a draft entry is captured without claiming zero nutrients and can be resolved later', async () => {
    const draft = await me.mutate([{ type: 'diary.add', entry: { id: 'entry-0060', localDate: '2026-09-18', timeZone: 'America/New_York', occurredAt: '2026-09-18T18:00:00.000Z', mealSlot: 'dinner', kind: 'draft', draft: { text: 'Restaurant salmon plate' } } }]);
    expect(draft.results[0]?.status).toBe('committed');
    const day = (await me.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[] };
    expect(day.entries[0]?.kind).toBe('draft');
    expect(day.entries[0]?.snapshot).toBeUndefined();
    const { version } = await addShake(me);
    const resolved = await me.mutate([{ type: 'diary.update', entryId: 'entry-0060', baseRevision: 1, entry: entryFor('entry-0060', version.id, '1') }]);
    expect(resolved.results[0]?.status).toBe('committed');
    const after = (await me.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[] };
    expect(after.entries[0]?.kind).toBe('food');
    expect(after.entries[0]?.draft).toBeUndefined();
  });

  it('rejects incompatible quantities instead of guessing', async () => {
    const { version } = await addShake(me);
    const r = await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0070', version.id, '100', { kind: 'portion', portionId: 'nope' }) }]);
    expect(r.results[0]).toMatchObject({ status: 'rejected', error: { code: 'incompatible-quantity' } });
    const grams = await me.post('/api/v1/mutations', { mutations: [mutation({ type: 'diary.add', entry: { ...entryFor('entry-0071', version.id, '100'), quantity: { amount: '100', unit: { kind: 'mass', unit: 'g' } } } })] });
    expect((grams.json() as { results: Array<{ status: string }> }).results[0]?.status).toBe('rejected');
  });

  it('remembers the last deliberately chosen quantity without touching a pin', async () => {
    const { food, version } = await addShake(me);
    const pin = await me.mutate([{ type: 'food.update', foodId: food.id, baseRevision: food.revision, changes: { pin: { order: 0, quantity: { amount: '1', unit: { kind: 'portion', portionId: 'bottle' } } } } }]);
    expect(pin.results[0]?.status).toBe('committed');
    await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0080', version.id, '1', { kind: 'portion', portionId: 'half' }) }]);
    const boot = (await me.get('/api/v1/bootstrap')).json() as Bootstrap;
    const f = boot.foods.find((x) => x.id === food.id)!;
    expect(f.pin?.quantity.unit).toEqual({ kind: 'portion', portionId: 'bottle' });
    expect(f.lastQuantity?.unit).toEqual({ kind: 'portion', portionId: 'half' });
  });

  it('rejects mutations without the app header (CSRF) and with a foreign origin', async () => {
    const res = await t.app.inject({ method: 'POST', url: '/api/v1/mutations', headers: { cookie: me.cookie }, payload: { mutations: [] } });
    expect(res.statusCode).toBe(403);
    const foreign = await t.app.inject({ method: 'POST', url: '/api/v1/mutations', headers: { cookie: me.cookie, [CSRF_HEADER]: '1', origin: 'https://evil.example' }, payload: { mutations: [] } });
    expect(foreign.statusCode).toBe(403);
  });

  it('accepts a user id only from the session, never from the payload', async () => {
    const { version } = await addShake(me);
    const other = await signUp(t, 'Other');
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/mutations',
      headers: { cookie: other.cookie, [CSRF_HEADER]: '1' },
      payload: { userId: me.userId, mutations: [{ ...mutation({ type: 'diary.add', entry: entryFor('entry-0090', version.id, '1') }), userId: me.userId }] },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { results: Array<{ status: string }> }).results[0]?.status).toBe('rejected');
    expect(((await me.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[] }).entries).toHaveLength(0);
  });

  it('logs a saved meal as editable grouped entries and computes a recipe per serving', async () => {
    const { food, version } = await addShake(me);
    const eggs = await me.mutate([
      {
        type: 'food.upsert',
        food: { id: 'food-eggs-0001', name: 'Egg, large', aliases: ['eggs'], pin: null, suggestEligible: true, tags: [], hidden: false },
        version: {
          id: 'food-eggs-0001-v1',
          name: 'Egg, large',
          preparation: 'cooked',
          basis: { kind: 'serving', servingText: '1 egg (50 g)', servingGrams: '50' },
          nutrients: { protein: { status: 'reported', amount: '6' }, carbs: { status: 'reported', amount: '0.6' }, fat: { status: 'reported', amount: '5' }, fiber: { status: 'reported', amount: '0' }, sugar: { status: 'reported', amount: '0.6' }, calories: { status: 'reported', amount: '72' } },
          portions: [{ id: 'egg', name: 'egg', servings: '1' }],
          provenance: { provider: 'user', fetchedAt: '2026-09-18T12:00:00.000Z', normalizationVersion: 'user-1' },
        },
      },
    ]);
    expect(eggs.results[0]?.status).toBe('committed');
    const boot = (await me.get('/api/v1/bootstrap')).json() as Bootstrap;
    const eggFood = boot.foods.find((f) => f.id === 'food-eggs-0001')!;
    const meal = await me.mutate([{ type: 'meal.upsert', meal: { id: 'meal-0001', name: 'Usual breakfast', items: [{ foodId: food.id, foodVersionId: version.id, quantity: { amount: '1', unit: { kind: 'serving' } } }, { foodId: eggFood.id, foodVersionId: eggFood.currentVersionId, quantity: { amount: '2', unit: { kind: 'portion', portionId: 'egg' } } }], pin: null, suggestEligible: true } }]);
    expect(meal.results[0]?.status).toBe('committed');

    const groupId = randomUUID();
    const logged = await me.mutate([
      { type: 'diary.add', entry: { ...entryFor('entry-0100', version.id, '1'), groupId } },
      { type: 'diary.add', entry: { ...entryFor('entry-0101', eggFood.currentVersionId, '2', { kind: 'portion', portionId: 'egg' }), groupId } },
    ]);
    expect(logged.results.map((r) => r.status)).toEqual(['committed', 'committed']);
    const day = (await me.get('/api/v1/days/2026-09-18')).json() as { entries: DiaryEntry[] };
    expect(day.entries.every((e) => e.groupId === groupId)).toBe(true);
    expect(day.entries.find((e) => e.id === 'entry-0101')?.snapshot?.nutrients.protein).toEqual({ status: 'reported', amount: '12' });

    const recipe = await me.mutate([{ type: 'recipe.upsert', recipeId: 'recipe-0001', recipeVersionId: 'recipe-0001-rv1', foodId: 'recipe-0001-food', foodVersionId: 'recipe-0001-fv1', name: 'Egg bake', ingredients: [{ foodId: eggFood.id, foodVersionId: eggFood.currentVersionId, quantity: { amount: '6', unit: { kind: 'portion', portionId: 'egg' } } }], yieldServings: '4', servingName: 'slice' }]);
    expect(recipe.results[0]?.status).toBe('committed');
    const after = (await me.get('/api/v1/bootstrap')).json() as Bootstrap;
    const rv = after.recipeVersions.find((v) => v.recipeId === 'recipe-0001')!;
    expect(rv.perServing.protein).toEqual({ status: 'reported', amount: '9' });
    expect(rv.perServing.fat).toEqual({ status: 'reported', amount: '7.5' });
    const recipeFood = after.foods.find((f) => f.id === after.recipes[0]!.foodId)!;
    const recipeVersion = after.foodVersions.find((v) => v.id === recipeFood.currentVersionId)!;
    expect(recipeVersion.provenance.provider).toBe('recipe');
    const slice = await me.mutate([{ type: 'diary.add', entry: entryFor('entry-0102', recipeVersion.id, '1', { kind: 'portion', portionId: 'serving' }) }]);
    expect(slice.results[0]?.status).toBe('committed');

    // N09: editing the recipe creates a new version; the earlier slice keeps the old one.
    const edit = await me.mutate([{ type: 'recipe.upsert', recipeId: 'recipe-0001', recipeVersionId: 'recipe-0001-rv2', foodId: 'recipe-0001-food', foodVersionId: 'recipe-0001-fv2', name: 'Egg bake', ingredients: [{ foodId: eggFood.id, foodVersionId: eggFood.currentVersionId, quantity: { amount: '6', unit: { kind: 'portion', portionId: 'egg' } } }], yieldServings: '6', servingName: 'slice', baseRevision: 1 }]);
    expect(edit.results[0]?.status).toBe('committed');
    const final = (await me.get('/api/v1/bootstrap')).json() as Bootstrap;
    expect(final.recipeVersions).toHaveLength(2);
    const sliceEntry = final.entries.find((e) => e.id === 'entry-0102')!;
    expect(sliceEntry.foodVersionId).toBe(recipeVersion.id);
    expect(sliceEntry.snapshot?.nutrients.protein).toEqual({ status: 'reported', amount: '9' });
  });
});
