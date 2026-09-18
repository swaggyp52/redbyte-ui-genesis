import type { Db } from '../db/database.js';
import { newId, newToken, nowIso, sha256 } from '../ids.js';

export interface SessionRow {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
}

export interface SessionPolicy {
  idleDays: number;
  absoluteDays: number;
}

const DAY_MS = 86_400_000;

export class Sessions {
  constructor(
    private readonly db: Db,
    private readonly policy: SessionPolicy,
  ) {}

  create(userId: string, userAgent?: string): { token: string; session: SessionRow } {
    const token = newToken(32);
    const now = Date.now();
    const session: SessionRow = {
      id: newId(),
      userId,
      createdAt: new Date(now).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      idleExpiresAt: new Date(now + this.policy.idleDays * DAY_MS).toISOString(),
      absoluteExpiresAt: new Date(now + this.policy.absoluteDays * DAY_MS).toISOString(),
      revokedAt: null,
    };
    this.db
      .prepare('insert into sessions (id, token_hash, user_id, created_at, last_seen_at, idle_expires_at, absolute_expires_at, revoked_at, user_agent) values (?, ?, ?, ?, ?, ?, ?, NULL, ?)')
      .run(session.id, sha256(token), userId, session.createdAt, session.lastSeenAt, session.idleExpiresAt, session.absoluteExpiresAt, userAgent?.slice(0, 200) ?? null);
    return { token, session };
  }

  /** Validates a token; slides the idle expiry on use. */
  resolve(token: string | undefined): SessionRow | undefined {
    if (!token || token.length < 20) return undefined;
    const row = this.db.prepare('select * from sessions where token_hash = ?').get(sha256(token)) as
      | { id: string; user_id: string; created_at: string; last_seen_at: string; idle_expires_at: string; absolute_expires_at: string; revoked_at: string | null }
      | undefined;
    if (!row || row.revoked_at) return undefined;
    const now = Date.now();
    if (Date.parse(row.idle_expires_at) < now || Date.parse(row.absolute_expires_at) < now) return undefined;
    // Slide idle expiry at most once per hour to avoid a write on every request.
    if (now - Date.parse(row.last_seen_at) > 3_600_000) {
      const idle = new Date(Math.min(now + this.policy.idleDays * DAY_MS, Date.parse(row.absolute_expires_at))).toISOString();
      this.db.prepare('update sessions set last_seen_at = ?, idle_expires_at = ? where id = ?').run(new Date(now).toISOString(), idle, row.id);
      row.idle_expires_at = idle;
    }
    return {
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      idleExpiresAt: row.idle_expires_at,
      absoluteExpiresAt: row.absolute_expires_at,
      revokedAt: row.revoked_at,
    };
  }

  revoke(sessionId: string): void {
    this.db.prepare('update sessions set revoked_at = ? where id = ? and revoked_at is null').run(nowIso(), sessionId);
  }

  revokeAllForUser(userId: string, exceptSessionId?: string): number {
    const info = this.db.prepare('update sessions set revoked_at = ? where user_id = ? and revoked_at is null and id <> ?').run(nowIso(), userId, exceptSessionId ?? '');
    return info.changes;
  }

  listForUser(userId: string): SessionRow[] {
    const rows = this.db.prepare('select * from sessions where user_id = ? order by created_at desc').all(userId) as Array<Record<string, string | null>>;
    return rows.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      createdAt: r.created_at as string,
      lastSeenAt: r.last_seen_at as string,
      idleExpiresAt: r.idle_expires_at as string,
      absoluteExpiresAt: r.absolute_expires_at as string,
      revokedAt: r.revoked_at ?? null,
    }));
  }
}

export interface InviteRow {
  id: string;
  userId: string | null;
  displayName: string | null;
  expiresAt: string;
  redeemedAt: string | null;
}

export class Invites {
  constructor(
    private readonly db: Db,
    private readonly lifetimeMinutes: number,
  ) {}

  /** Creates a one-use, high-entropy invite. `userId` binds it to an existing account for recovery. */
  create(options: { userId?: string; displayName?: string } = {}): { token: string; invite: InviteRow } {
    const token = newToken(32);
    const invite: InviteRow = {
      id: newId(),
      userId: options.userId ?? null,
      displayName: options.displayName ?? null,
      expiresAt: new Date(Date.now() + this.lifetimeMinutes * 60_000).toISOString(),
      redeemedAt: null,
    };
    this.db
      .prepare('insert into invites (id, token_hash, user_id, display_name, expires_at, redeemed_at, created_at) values (?, ?, ?, ?, ?, NULL, ?)')
      .run(invite.id, sha256(token), invite.userId, invite.displayName, invite.expiresAt, nowIso());
    return { token, invite };
  }

  /** Atomically redeems: returns undefined when unknown, expired or already used. */
  redeem(token: string): InviteRow | undefined {
    const hash = sha256(token);
    const now = nowIso();
    const tx = this.db.transaction((): InviteRow | undefined => {
      const row = this.db.prepare('select * from invites where token_hash = ?').get(hash) as
        | { id: string; user_id: string | null; display_name: string | null; expires_at: string; redeemed_at: string | null }
        | undefined;
      if (!row || row.redeemed_at || row.expires_at < now) return undefined;
      this.db.prepare('update invites set redeemed_at = ? where id = ? and redeemed_at is null').run(now, row.id);
      return { id: row.id, userId: row.user_id, displayName: row.display_name, expiresAt: row.expires_at, redeemedAt: now };
    });
    return tx();
  }

  /** Read-only check for the bootstrap screen; never consumes the invite. */
  peek(token: string): { valid: boolean; recovery: boolean; displayName: string | null } {
    const row = this.db.prepare('select user_id, display_name, expires_at, redeemed_at from invites where token_hash = ?').get(sha256(token)) as
      | { user_id: string | null; display_name: string | null; expires_at: string; redeemed_at: string | null }
      | undefined;
    if (!row || row.redeemed_at || row.expires_at < nowIso()) return { valid: false, recovery: false, displayName: null };
    return { valid: true, recovery: row.user_id !== null, displayName: row.display_name };
  }
}
