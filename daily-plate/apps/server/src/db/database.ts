import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS } from './migrations.js';

export type Db = Database.Database;

/** SQLite documents a rare WAL-reset issue fixed in 3.51.3; require a patched engine. */
export const MIN_SQLITE_VERSION = '3.51.3';

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function sqliteVersion(db: Db): string {
  const row = db.prepare('select sqlite_version() as v').get() as { v: string };
  return row.v;
}

export interface OpenOptions {
  /** Skip the engine gate (tests only). */
  skipEngineGate?: boolean;
  readonly?: boolean;
}

export function openDatabase(dbPath: string, options: OpenOptions = {}): Db {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  }
  const db = new Database(dbPath, { readonly: options.readonly ?? false });
  const version = sqliteVersion(db);
  if (!options.skipEngineGate && compareVersions(version, MIN_SQLITE_VERSION) < 0) {
    db.close();
    throw new Error(`Bundled SQLite ${version} is older than required ${MIN_SQLITE_VERSION}`);
  }
  if (!options.readonly) {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = FULL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    if (dbPath !== ':memory:') {
      try {
        fs.chmodSync(dbPath, 0o600);
      } catch {
        /* best effort on non-POSIX filesystems */
      }
    }
    migrate(db);
  }
  return db;
}

export function migrate(db: Db): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  const applied = new Set((db.prepare('select version from schema_migrations').all() as { version: number }[]).map((r) => r.version));
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('insert into schema_migrations (version, name, applied_at) values (?, ?, ?)').run(m.version, m.name, new Date().toISOString());
    })();
  }
}

export function schemaVersion(db: Db): number {
  const row = db.prepare('select max(version) as v from schema_migrations').get() as { v: number | null };
  return row.v ?? 0;
}
