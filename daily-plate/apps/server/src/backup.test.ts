import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { backupDatabase, pruneBackups, restoreToScratch, verifyBackup } from './backup.js';
import { cleanup, entryFor, makeTestApp, SHAKE_FOOD, signUp, type TestApp } from './test-helpers.js';
import type { Bootstrap } from '@daily-plate/contracts';
import { openDatabase, MIN_SQLITE_VERSION, compareVersions, sqliteVersion } from './db/database.js';
import { Store } from './db/store.js';

let t: TestApp;
beforeEach(async () => {
  t = await makeTestApp();
});
afterEach(async () => {
  await t.close();
  cleanup(t.dataDir);
});

describe('D03 backup and isolated restore', () => {
  it('takes a consistent snapshot while WAL is active and restores it into scratch with the same records', async () => {
    const me = await signUp(t, 'Mom');
    await me.mutate([{ type: 'food.upsert', ...SHAKE_FOOD }]);
    const boot = (await me.get('/api/v1/bootstrap')).json() as Bootstrap;
    await me.mutate([{ type: 'diary.add', entry: entryFor('entry-b-0001', boot.foods[0]!.currentVersionId, '1.5') }]);

    const backupDir = path.join(t.dataDir, 'backups');
    const result = await backupDatabase(t.app.ctx.db, backupDir, 'daily');
    expect(fs.existsSync(result.file)).toBe(true);
    expect((fs.statSync(result.file).mode & 0o777).toString(8)).toBe('600');

    const verify = verifyBackup(result.file);
    expect(verify.ok).toBe(true);
    expect(verify.integrity).toBe('ok');
    expect(verify.counts).toMatchObject({ users: 1, foods: 1, food_versions: 1, diary_entries: 1, mutation_receipts: 2 });

    // Write after the snapshot: the snapshot must not contain it.
    await me.mutate([{ type: 'diary.add', entry: entryFor('entry-b-0002', boot.foods[0]!.currentVersionId, '1') }]);
    const restored = restoreToScratch(result.file, path.join(t.dataDir, 'scratch'));
    expect(restored.verify.counts.diary_entries).toBe(1);
    const db = openDatabase(restored.path);
    const store = new Store(db);
    const entries = store.listEntries(me.userId, '2026-09-18', '2026-09-18');
    expect(entries[0]?.snapshot?.nutrients.protein).toEqual({ status: 'reported', amount: '45' });
    expect(store.getGoals(me.userId).training.carbs).toBe('165');
    db.close();
    // Live database untouched by the scratch restore.
    expect(t.app.ctx.store.listEntries(me.userId, '2026-09-18', '2026-09-18')).toHaveLength(2);
  });

  it('prunes to seven daily and four weekly snapshots and keeps pre-migration ones', () => {
    const dir = path.join(t.dataDir, 'prune');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 10; i += 1) fs.writeFileSync(path.join(dir, `daily-plate-daily-2026-09-${String(i + 1).padStart(2, '0')}T00-00-00-000Z.db`), '');
    for (let i = 0; i < 6; i += 1) fs.writeFileSync(path.join(dir, `daily-plate-weekly-2026-08-${String(i + 1).padStart(2, '0')}T00-00-00-000Z.db`), '');
    fs.writeFileSync(path.join(dir, 'daily-plate-premigration-2026-07-01T00-00-00-000Z.db'), '');
    const removed = pruneBackups(dir);
    expect(removed).toHaveLength(5);
    const left = fs.readdirSync(dir);
    expect(left.filter((f) => f.includes('-daily-'))).toHaveLength(7);
    expect(left.filter((f) => f.includes('-weekly-'))).toHaveLength(4);
    expect(left.filter((f) => f.includes('-premigration-'))).toHaveLength(1);
    expect(left).toContain('daily-plate-daily-2026-09-10T00-00-00-000Z.db');
  });
});

describe('engine gate', () => {
  it('the bundled SQLite is at or above the WAL-reset fix and runs in WAL + synchronous FULL', () => {
    const v = sqliteVersion(t.app.ctx.db);
    expect(compareVersions(v, MIN_SQLITE_VERSION)).toBeGreaterThanOrEqual(0);
    expect(t.app.ctx.db.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(t.app.ctx.db.pragma('synchronous', { simple: true })).toBe(2);
    expect(t.app.ctx.db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(compareVersions('3.51.2', '3.51.3')).toBe(-1);
    expect(compareVersions('3.53.4', '3.51.3')).toBe(1);
  });
});
