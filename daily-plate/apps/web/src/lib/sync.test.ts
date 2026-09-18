import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, CSRF_HEADER, SESSION_COOKIE } from '@daily-plate/server/app';
import { loadConfig } from '@daily-plate/server/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Bootstrap, DiaryEntry, FoodVersion } from '@daily-plate/contracts';
import { DailyPlateDb, getMeta } from './db.js';
import { ApiClient, OfflineError } from './api.js';
import { SyncEngine } from './sync.js';
import { addFoodEntry, deleteEntry, updateEntry, upsertFood, withdrawIfUnsent } from './actions.js';
import { buildDayView } from './selectors.js';

/** Bridges the phone's fetch to the real server without a socket. */
function injectFetch(app: FastifyInstance, cookieRef: { value: string }, hooks: { offline?: () => boolean; dropResponseOnce?: { url: RegExp; armed: boolean } } = {}) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (hooks.offline?.()) throw new TypeError('Failed to fetch');
    const headers: Record<string, string> = { cookie: cookieRef.value };
    for (const [k, v] of Object.entries((init?.headers as Record<string, string>) ?? {})) headers[k] = v;
    const res = await app.inject({ method: (init?.method ?? 'GET') as 'GET' | 'POST' | 'DELETE', url, headers, ...(init?.body ? { payload: String(init.body) } : {}) });
    const set = res.cookies.find((c) => c.name === SESSION_COOKIE);
    if (set) cookieRef.value = `${SESSION_COOKIE}=${set.value}`;
    if (hooks.dropResponseOnce?.armed && hooks.dropResponseOnce.url.test(url)) {
      hooks.dropResponseOnce.armed = false;
      throw new TypeError('Failed to fetch');
    }
    return new Response(res.body, { status: res.statusCode, headers: { 'content-type': 'application/json' } });
  };
}

const SHAKE_VERSION = (foodId: string, id: string): Omit<FoodVersion, 'foodId' | 'version' | 'createdAt'> => ({
  id,
  name: 'My shake',
  preparation: 'as-sold',
  basis: { kind: 'serving', servingText: '1 bottle' },
  nutrients: {
    protein: { status: 'reported', amount: '30' },
    carbs: { status: 'reported', amount: '15' },
    fat: { status: 'unknown' },
    fiber: { status: 'reported', amount: '5' },
    sugar: { status: 'unknown' },
    calories: { status: 'unknown' },
  },
  portions: [{ id: 'bottle', name: 'bottle', servings: '1' }],
  defaultQuantity: { amount: '1', unit: { kind: 'portion', portionId: 'bottle' } },
  provenance: { provider: 'user', fetchedAt: '2026-09-18T12:00:00.000Z', normalizationVersion: 'user-1' },
});
void SHAKE_VERSION;

let app: FastifyInstance;
let dataDir: string;
let dbCounter = 0;
let online = true;
const cookie = { value: '' };
const drop = { url: /mutations/, armed: false };

async function signUp(): Promise<void> {
  const { token } = app.ctx.invites.create({ displayName: 'Mom' });
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/invite/redeem', headers: { [CSRF_HEADER]: '1' }, payload: { token, timeZone: 'America/New_York' } });
  cookie.value = `${SESSION_COOKIE}=${res.cookies.find((c) => c.name === SESSION_COOKIE)!.value}`;
}

function phone(db: DailyPlateDb): { api: ApiClient; engine: SyncEngine } {
  const api = new ApiClient({ fetchImpl: injectFetch(app, cookie, { offline: () => !online, dropResponseOnce: drop }) as typeof fetch });
  const engine = new SyncEngine(db, api, () => online);
  return { api, engine };
}

beforeEach(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-web-'));
  const config = loadConfig({ dataDir, dbPath: path.join(dataDir, 'db.sqlite'), origins: ['http://localhost:8787'], secureCookies: false, logLevel: 'silent', version: 'test', webDistDir: undefined });
  app = await buildApp({ config, logger: false });
  await app.ready();
  online = true;
  drop.armed = false;
  await signUp();
});

afterEach(async () => {
  await app.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function freshDb(name = `dp-test-${dbCounter++}`): DailyPlateDb {
  return new DailyPlateDb(name);
}

async function serverEntries(): Promise<DiaryEntry[]> {
  const res = await app.inject({ method: 'GET', url: '/api/v1/days/2026-09-18', headers: { cookie: cookie.value } });
  return (res.json() as { entries: DiaryEntry[] }).entries;
}

describe('O01 offline add, close, reopen, reconcile', () => {
  it('keeps the entry and the queue across reopen and commits exactly once when back online', async () => {
    const name = `dp-o01-${dbCounter++}`;
    let db = freshDb(name);
    let { engine } = phone(db);
    await engine.bootstrap();
    const { version } = await upsertFood(db, { food: { id: 'food-shake-0001', name: 'My shake', aliases: [], pin: null, suggestEligible: true, tags: [], hidden: false }, version: SHAKE_VERSION('food-shake-0001', 'food-shake-0001-v1') });
    await engine.sync();
    expect(await db.outbox.count()).toBe(0);

    online = false;
    const { entry } = await addFoodEntry(db, { version, quantity: { amount: '1.5', unit: { kind: 'serving' } }, mealSlot: 'lunch', localDate: '2026-09-18', timeZone: 'America/New_York' });
    expect(entry.snapshot?.nutrients.protein).toEqual({ status: 'reported', amount: '45' });
    await engine.sync();
    expect(engine.getStatus().state).toBe('offline');
    expect(engine.getStatus().pending).toBe(1);
    const outbox = await db.outbox.toArray();
    const view = buildDayView('2026-09-18', (await db.days.get('2026-09-18'))!, await db.entries.toArray(), outbox);
    expect(view.entries[0]?.saveState).toBe('pending');
    expect(view.progress.protein.remaining).toBe('95');
    expect(await serverEntries()).toHaveLength(0);

    // "Close the app": drop the in-memory handles and reopen the same IndexedDB.
    engine.dispose();
    db.close();
    db = new DailyPlateDb(name);
    ({ engine } = phone(db));
    expect(await db.outbox.count()).toBe(1);
    expect((await db.entries.get(entry.id))?.snapshot?.nutrients.carbs).toEqual({ status: 'reported', amount: '22.5' });

    online = true;
    await engine.sync();
    expect(engine.getStatus().state).toBe('idle');
    expect(await db.outbox.count()).toBe(0);
    const committed = await serverEntries();
    expect(committed).toHaveLength(1);
    expect(committed[0]?.id).toBe(entry.id);
    const local = await db.entries.get(entry.id);
    expect(local?.revision).toBe(1);
    const view2 = buildDayView('2026-09-18', (await db.days.get('2026-09-18'))!, await db.entries.toArray(), await db.outbox.toArray());
    expect(view2.entries[0]?.saveState).toBe('saved');
    engine.dispose();
    db.close();
  });
});

describe('O02 lost response then retry', () => {
  it('produces exactly one committed entry with a stable receipt', async () => {
    const db = freshDb();
    const { engine } = phone(db);
    await engine.bootstrap();
    const { version } = await upsertFood(db, { food: { id: 'food-shake-0002', name: 'My shake', aliases: [], pin: null, suggestEligible: true, tags: [], hidden: false }, version: SHAKE_VERSION('food-shake-0002', 'food-shake-0002-v1') });
    await engine.sync();
    await addFoodEntry(db, { version, quantity: { amount: '1', unit: { kind: 'serving' } }, mealSlot: 'lunch', localDate: '2026-09-18', timeZone: 'America/New_York' });
    drop.armed = true; // the Pi commits, the phone never hears back
    await engine.sync();
    expect(engine.getStatus().state).toBe('offline');
    expect(await db.outbox.count()).toBe(1);
    expect((await db.outbox.toArray())[0]?.status).toBe('pending');
    expect(await serverEntries()).toHaveLength(1);
    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
    expect(await serverEntries()).toHaveLength(1);
    engine.dispose();
    db.close();
  });
});

describe('U01/U05 withdraw, undo, edit while unsent', () => {
  it('an unsent add can be withdrawn without ever reaching the Pi; edits rewrite the unsent add', async () => {
    const db = freshDb();
    const { engine } = phone(db);
    await engine.bootstrap();
    const { version } = await upsertFood(db, { food: { id: 'food-shake-0003', name: 'My shake', aliases: [], pin: null, suggestEligible: true, tags: [], hidden: false }, version: SHAKE_VERSION('food-shake-0003', 'food-shake-0003-v1') });
    await engine.sync();
    online = false;
    const { entry } = await addFoodEntry(db, { version, quantity: { amount: '1', unit: { kind: 'serving' } }, mealSlot: 'lunch', localDate: '2026-09-18', timeZone: 'America/New_York' });
    const edited = await updateEntry(db, entry, { quantity: { amount: '2', unit: { kind: 'serving' } } });
    expect(edited.revision).toBe(1);
    expect(await db.outbox.count()).toBe(1);
    expect((await db.outbox.toArray())[0]?.mutation.payload.type).toBe('diary.add');
    expect(await withdrawIfUnsent(db, entry.id)).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.entries.get(entry.id)).toBeUndefined();
    online = true;
    await engine.sync();
    expect(await serverEntries()).toHaveLength(0);

    // Committed entry: delete queues a tombstone; undo restores.
    const { entry: second } = await addFoodEntry(db, { version, quantity: { amount: '1', unit: { kind: 'serving' } }, mealSlot: 'lunch', localDate: '2026-09-18', timeZone: 'America/New_York' });
    await engine.sync();
    expect(await withdrawIfUnsent(db, second.id)).toBe(false);
    const current = (await db.entries.get(second.id))!;
    const { undo } = await deleteEntry(db, current);
    await engine.sync();
    expect(await serverEntries()).toHaveLength(0);
    await undo();
    await engine.sync();
    expect(await serverEntries()).toHaveLength(1);
    expect((await db.entries.get(second.id))?.revision).toBe(3);
    engine.dispose();
    db.close();
  });
});

describe('O04 conflicts', () => {
  it('a stale edit becomes an attention item; the user can keep the Pi version or retry on top of it', async () => {
    const db = freshDb();
    const { engine } = phone(db);
    await engine.bootstrap();
    const { version } = await upsertFood(db, { food: { id: 'food-shake-0004', name: 'My shake', aliases: [], pin: null, suggestEligible: true, tags: [], hidden: false }, version: SHAKE_VERSION('food-shake-0004', 'food-shake-0004-v1') });
    await engine.sync();
    const { entry } = await addFoodEntry(db, { version, quantity: { amount: '1', unit: { kind: 'serving' } }, mealSlot: 'lunch', localDate: '2026-09-18', timeZone: 'America/New_York' });
    await engine.sync();

    // Another device changes the same entry on the Pi.
    const other = await app.inject({
      method: 'POST',
      url: '/api/v1/mutations',
      headers: { cookie: cookie.value, [CSRF_HEADER]: '1' },
      payload: { mutations: [{ schemaVersion: 1, mutationId: crypto.randomUUID(), clientTime: new Date().toISOString(), payload: { type: 'diary.update', entryId: entry.id, baseRevision: 1, entry: { id: entry.id, localDate: '2026-09-18', timeZone: 'America/New_York', occurredAt: entry.occurredAt, mealSlot: 'dinner', kind: 'food', foodVersionId: version.id, quantity: { amount: '3', unit: { kind: 'serving' } } } } }] },
    });
    expect((other.json() as { results: Array<{ status: string }> }).results[0]?.status).toBe('committed');

    // This phone, unaware, edits from revision 1.
    const stale = (await db.entries.get(entry.id))!;
    await updateEntry(db, stale, { mealSlot: 'snack' });
    await engine.sync();
    expect(engine.getStatus().attention).toBe(1);
    const item = (await db.outbox.toArray())[0]!;
    expect(item.status).toBe('attention');
    expect((item.conflictCurrent as DiaryEntry).mealSlot).toBe('dinner');
    const view = buildDayView('2026-09-18', (await db.days.get('2026-09-18'))!, await db.entries.toArray(), await db.outbox.toArray());
    expect(view.entries[0]?.saveState).toBe('attention');

    await engine.retryAttentionOnCurrent(item.mutationId);
    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
    const final = await serverEntries();
    expect(final[0]?.mealSlot).toBe('snack');
    expect(final[0]?.revision).toBe(3);
    expect((await db.entries.get(entry.id))?.revision).toBe(3);
    engine.dispose();
    db.close();
  });

  it('discarding a conflicted change restores the Pi version locally', async () => {
    const db = freshDb();
    const { engine } = phone(db);
    await engine.bootstrap();
    const { version } = await upsertFood(db, { food: { id: 'food-shake-0005', name: 'My shake', aliases: [], pin: null, suggestEligible: true, tags: [], hidden: false }, version: SHAKE_VERSION('food-shake-0005', 'food-shake-0005-v1') });
    await engine.sync();
    const { entry } = await addFoodEntry(db, { version, quantity: { amount: '1', unit: { kind: 'serving' } }, mealSlot: 'lunch', localDate: '2026-09-18', timeZone: 'America/New_York' });
    await engine.sync();
    await app.inject({
      method: 'POST',
      url: '/api/v1/mutations',
      headers: { cookie: cookie.value, [CSRF_HEADER]: '1' },
      payload: { mutations: [{ schemaVersion: 1, mutationId: crypto.randomUUID(), clientTime: new Date().toISOString(), payload: { type: 'diary.delete', entryId: entry.id, baseRevision: 1 } }] },
    });
    await updateEntry(db, (await db.entries.get(entry.id))!, { mealSlot: 'snack' });
    await engine.sync();
    const item = (await db.outbox.toArray())[0]!;
    expect(item.status).toBe('attention');
    await engine.discardAttention(item.mutationId);
    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
    expect((await db.entries.get(entry.id))?.deleted).toBe(true);
    engine.dispose();
    db.close();
  });
});

describe('O06 session expiry and account isolation on one phone', () => {
  it('keeps pending work when the session is gone and refuses to bootstrap another account over it', async () => {
    const db = freshDb();
    const { engine } = phone(db);
    await engine.bootstrap();
    const { version } = await upsertFood(db, { food: { id: 'food-shake-0006', name: 'My shake', aliases: [], pin: null, suggestEligible: true, tags: [], hidden: false }, version: SHAKE_VERSION('food-shake-0006', 'food-shake-0006-v1') });
    await engine.sync();
    await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie: cookie.value, [CSRF_HEADER]: '1' } });
    await addFoodEntry(db, { version, quantity: { amount: '1', unit: { kind: 'serving' } }, mealSlot: 'lunch', localDate: '2026-09-18', timeZone: 'America/New_York' });
    await engine.sync();
    expect(engine.getStatus().state).toBe('unauthenticated');
    expect(await db.outbox.count()).toBe(1);
    expect((await db.outbox.toArray())[0]?.status).toBe('pending');

    // A different account signs in on this phone.
    await signUp();
    await expect(engine.bootstrap()).rejects.toThrow(/different account/);
    expect(await db.outbox.count()).toBe(1);
    expect((await getMeta<{ displayName: string }>(db, 'user'))?.displayName).toBe('Mom');
    engine.dispose();
    db.close();
  });
});

describe('ApiClient', () => {
  it('turns network failures into OfflineError and 401 into unauthenticated', async () => {
    const api = new ApiClient({ fetchImpl: (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch });
    await expect(api.session()).rejects.toBeInstanceOf(OfflineError);
    let flagged = false;
    const api2 = new ApiClient({ fetchImpl: (async () => new Response('{}', { status: 401 })) as typeof fetch, onUnauthenticated: () => { flagged = true; } });
    await expect(api2.bootstrap()).rejects.toMatchObject({ status: 401 });
    expect(flagged).toBe(true);
  });
});
