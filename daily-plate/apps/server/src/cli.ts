#!/usr/bin/env node
/**
 * Tiny operator CLI. Usage:
 *   plate invite [--name "Mom"] [--recover <userId>]
 *   plate users
 *   plate sessions <userId> | plate revoke <userId>
 *   plate passkeys <userId>
 *   plate backup [--dir <backupDir>] [--label daily|weekly|premigration]
 *   plate verify-backup <file>
 *   plate restore-check <file> [--scratch <dir>]
 *   plate version
 */
import path from 'node:path';
import { loadConfig } from './config.js';
import { openDatabase, schemaVersion, sqliteVersion, MIN_SQLITE_VERSION } from './db/database.js';
import { Store } from './db/store.js';
import { Invites, Sessions } from './auth/sessions.js';
import { Passkeys } from './auth/passkeys.js';
import { backupDatabase, pruneBackups, restoreToScratch, verifyBackup } from './backup.js';

const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const config = loadConfig();

function main(): number {
  switch (command) {
    case 'invite': {
      const db = openDatabase(config.dbPath);
      const invites = new Invites(db, config.inviteMinutes);
      const recover = flag('recover');
      const name = flag('name');
      const { token, invite } = invites.create({ ...(recover ? { userId: recover } : {}), ...(name ? { displayName: name } : {}) });
      const base = config.origins[0] ?? `http://localhost:${config.port}`;
      console.log(`Invite created (expires ${invite.expiresAt}${recover ? ', recovery for existing account' : ''}).`);
      console.log(`Send this link once, privately:\n  ${base}/#invite=${token}`);
      db.close();
      return 0;
    }
    case 'users': {
      const db = openDatabase(config.dbPath);
      const store = new Store(db);
      for (const u of store.listUsers()) console.log(`${u.id}  ${u.displayName}  ${u.timeZone}  setup=${u.setupConfirmedAt ? 'yes' : 'no'}`);
      db.close();
      return 0;
    }
    case 'sessions': {
      const userId = args[1];
      if (!userId) return usage();
      const db = openDatabase(config.dbPath);
      for (const s of new Sessions(db, { idleDays: config.sessionIdleDays, absoluteDays: config.sessionAbsoluteDays }).listForUser(userId)) {
        console.log(`${s.id}  created=${s.createdAt}  lastSeen=${s.lastSeenAt}  idleExpires=${s.idleExpiresAt}  revoked=${s.revokedAt ?? '-'}`);
      }
      db.close();
      return 0;
    }
    case 'revoke': {
      const userId = args[1];
      if (!userId) return usage();
      const db = openDatabase(config.dbPath);
      const n = new Sessions(db, { idleDays: config.sessionIdleDays, absoluteDays: config.sessionAbsoluteDays }).revokeAllForUser(userId);
      console.log(`Revoked ${n} session(s). A disconnected phone keeps its local copy until it reconnects and is refused.`);
      db.close();
      return 0;
    }
    case 'passkeys': {
      const userId = args[1];
      if (!userId) return usage();
      const db = openDatabase(config.dbPath);
      for (const p of new Passkeys(db, { rpId: config.rpId, rpName: config.rpName, origins: config.origins }).listForUser(userId)) {
        console.log(`${p.id}  label=${p.label ?? '-'}  created=${p.createdAt}  lastUsed=${p.lastUsedAt ?? '-'}  backedUp=${p.backedUp}`);
      }
      db.close();
      return 0;
    }
    case 'backup': {
      const dir = flag('dir') ?? path.join(config.dataDir, 'backups');
      const label = flag('label') ?? 'daily';
      const db = openDatabase(config.dbPath);
      void backupDatabase(db, dir, label).then((r) => {
        db.close();
        const v = verifyBackup(r.file);
        const removed = pruneBackups(dir);
        console.log(JSON.stringify({ ...r, verify: v, pruned: removed }, null, 2));
        process.exit(v.ok ? 0 : 2);
      });
      return -1;
    }
    case 'verify-backup': {
      const file = args[1];
      if (!file) return usage();
      const v = verifyBackup(file);
      console.log(JSON.stringify(v, null, 2));
      return v.ok ? 0 : 2;
    }
    case 'restore-check': {
      const file = args[1];
      if (!file) return usage();
      const scratch = flag('scratch') ?? path.join(config.dataDir, 'restore-scratch');
      const r = restoreToScratch(file, scratch);
      console.log(JSON.stringify(r, null, 2));
      return r.verify.ok ? 0 : 2;
    }
    case 'version': {
      const db = openDatabase(config.dbPath);
      console.log(JSON.stringify({ app: config.version, node: process.version, arch: process.arch, sqlite: sqliteVersion(db), minSqlite: MIN_SQLITE_VERSION, schema: schemaVersion(db), dbPath: config.dbPath }, null, 2));
      db.close();
      return 0;
    }
    default:
      return usage();
  }
}

function usage(): number {
  console.log('usage: plate <invite|users|sessions|revoke|passkeys|backup|verify-backup|restore-check|version> [args]');
  return 1;
}

const code = main();
if (code >= 0) process.exit(code);
