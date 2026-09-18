import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase, type Db } from './db/database.js';
import { Store } from './db/store.js';

export interface BackupResult {
  file: string;
  bytes: number;
  startedAt: string;
  finishedAt: string;
}

/** Consistent snapshot through SQLite's online backup API (never a file copy that ignores the WAL). */
export async function backupDatabase(db: Db, backupDir: string, label = 'daily'): Promise<BackupResult> {
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupDir, `daily-plate-${label}-${stamp}.db`);
  await db.backup(file);
  fs.chmodSync(file, 0o600);
  const bytes = fs.statSync(file).size;
  return { file, bytes, startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString() };
}

export interface VerifyResult {
  ok: boolean;
  integrity: string;
  schemaVersion: number;
  counts: Record<string, number>;
  sqliteVersion: string;
}

/** Opens a snapshot read-only in isolation and checks it is a coherent database. */
export function verifyBackup(file: string): VerifyResult {
  const db = new Database(file, { readonly: true });
  try {
    const integrity = (db.prepare('pragma integrity_check').get() as { integrity_check: string }).integrity_check;
    const schemaVersion = (db.prepare('select max(version) as v from schema_migrations').get() as { v: number | null }).v ?? 0;
    const store = new Store(db);
    const counts = store.counts();
    const version = (db.prepare('select sqlite_version() as v').get() as { v: string }).v;
    return { ok: integrity === 'ok' && schemaVersion > 0, integrity, schemaVersion, counts, sqliteVersion: version };
  } finally {
    db.close();
  }
}

/** Restores a snapshot into a scratch directory and runs migrations + a read check; the live database is untouched. */
export function restoreToScratch(file: string, scratchDir: string): { path: string; verify: VerifyResult } {
  fs.mkdirSync(scratchDir, { recursive: true, mode: 0o700 });
  const target = path.join(scratchDir, 'restored-daily-plate.db');
  fs.copyFileSync(file, target);
  const db = openDatabase(target);
  db.close();
  return { path: target, verify: verifyBackup(target) };
}

export interface RetentionPolicy {
  daily: number;
  weekly: number;
}

/** Keeps the newest N daily and N weekly snapshots plus any pre-migration snapshots. */
export function pruneBackups(backupDir: string, policy: RetentionPolicy = { daily: 7, weekly: 4 }): string[] {
  if (!fs.existsSync(backupDir)) return [];
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('daily-plate-') && f.endsWith('.db'))
    .sort()
    .reverse();
  const removed: string[] = [];
  const keepCount: Record<string, number> = { daily: policy.daily, weekly: policy.weekly };
  const seen: Record<string, number> = { daily: 0, weekly: 0 };
  for (const f of files) {
    const label = f.split('-')[2] ?? '';
    if (label === 'premigration') continue;
    if (!(label in keepCount)) continue;
    seen[label] = (seen[label] ?? 0) + 1;
    if ((seen[label] ?? 0) > (keepCount[label] ?? 0)) {
      fs.unlinkSync(path.join(backupDir, f));
      removed.push(f);
    }
  }
  return removed;
}
