import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransport,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { Db } from '../db/database.js';
import { newId, nowIso } from '../ids.js';

export interface PasskeyRow {
  id: string;
  userId: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports: AuthenticatorTransport[];
  deviceType: string | null;
  backedUp: boolean;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const CHALLENGE_TTL_MS = 5 * 60_000;

export interface PasskeyConfig {
  rpId: string;
  rpName: string;
  origins: string[];
}

export class Passkeys {
  constructor(
    private readonly db: Db,
    private readonly config: PasskeyConfig,
  ) {}

  listForUser(userId: string): PasskeyRow[] {
    const rows = this.db.prepare('select * from passkeys where user_id = ?').all(userId) as Array<Record<string, unknown>>;
    return rows.map(mapRow);
  }

  get(id: string): PasskeyRow | undefined {
    const row = this.db.prepare('select * from passkeys where id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : undefined;
  }

  remove(userId: string, id: string): boolean {
    return this.db.prepare('delete from passkeys where id = ? and user_id = ?').run(id, userId).changes > 0;
  }

  private storeChallenge(purpose: 'register' | 'login', challenge: string, userId: string | null, sessionId: string | null): string {
    const id = newId();
    this.db.prepare('delete from challenges where expires_at < ?').run(nowIso());
    this.db
      .prepare('insert into challenges (id, purpose, challenge, user_id, session_id, expires_at, created_at) values (?, ?, ?, ?, ?, ?, ?)')
      .run(id, purpose, challenge, userId, sessionId, new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(), nowIso());
    return id;
  }

  /** Consumes a challenge exactly once. */
  private takeChallenge(id: string, purpose: 'register' | 'login'): { challenge: string; userId: string | null; sessionId: string | null } | undefined {
    const tx = this.db.transaction(() => {
      const row = this.db.prepare('select * from challenges where id = ? and purpose = ?').get(id, purpose) as
        | { challenge: string; user_id: string | null; session_id: string | null; expires_at: string }
        | undefined;
      if (!row) return undefined;
      this.db.prepare('delete from challenges where id = ?').run(id);
      if (row.expires_at < nowIso()) return undefined;
      return { challenge: row.challenge, userId: row.user_id, sessionId: row.session_id };
    });
    return tx();
  }

  async registrationOptions(user: { id: string; displayName: string }, sessionId: string): Promise<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }> {
    const existing = this.listForUser(user.id);
    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpId,
      userName: user.displayName,
      userDisplayName: user.displayName,
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    const challengeId = this.storeChallenge('register', options.challenge, user.id, sessionId);
    return { challengeId, options };
  }

  async verifyRegistration(challengeId: string, userId: string, sessionId: string, response: RegistrationResponseJSON, label?: string): Promise<{ ok: true; passkeyId: string } | { ok: false; reason: string }> {
    const ch = this.takeChallenge(challengeId, 'register');
    if (!ch) return { ok: false, reason: 'Challenge expired or already used.' };
    if (ch.userId !== userId || ch.sessionId !== sessionId) return { ok: false, reason: 'Challenge does not belong to this session.' };
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: this.config.origins,
        expectedRPID: this.config.rpId,
        requireUserVerification: false,
      });
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Verification failed.' };
    }
    if (!verification.verified || !verification.registrationInfo) return { ok: false, reason: 'Passkey could not be verified.' };
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    this.db
      .prepare('insert into passkeys (id, user_id, public_key, counter, transports, device_type, backed_up, label, created_at, last_used_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
      .run(credential.id, userId, Buffer.from(credential.publicKey), credential.counter, JSON.stringify(credential.transports ?? []), credentialDeviceType, credentialBackedUp ? 1 : 0, label?.slice(0, 60) ?? null, nowIso());
    return { ok: true, passkeyId: credential.id };
  }

  async authenticationOptions(): Promise<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }> {
    const options = await generateAuthenticationOptions({ rpID: this.config.rpId, userVerification: 'preferred', allowCredentials: [] });
    const challengeId = this.storeChallenge('login', options.challenge, null, null);
    return { challengeId, options };
  }

  async verifyAuthentication(challengeId: string, response: AuthenticationResponseJSON): Promise<{ ok: true; userId: string; passkeyId: string } | { ok: false; reason: string }> {
    const ch = this.takeChallenge(challengeId, 'login');
    if (!ch) return { ok: false, reason: 'Challenge expired or already used.' };
    const passkey = this.get(response.id);
    if (!passkey) return { ok: false, reason: 'Unknown passkey.' };
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: this.config.origins,
        expectedRPID: this.config.rpId,
        credential: { id: passkey.id, publicKey: passkey.publicKey, counter: passkey.counter, transports: passkey.transports },
        requireUserVerification: false,
      });
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : 'Verification failed.' };
    }
    if (!verification.verified) return { ok: false, reason: 'Passkey could not be verified.' };
    this.db.prepare('update passkeys set counter = ?, last_used_at = ? where id = ?').run(verification.authenticationInfo.newCounter, nowIso(), passkey.id);
    return { ok: true, userId: passkey.userId, passkeyId: passkey.id };
  }
}

function mapRow(r: Record<string, unknown>): PasskeyRow {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    publicKey: toArrayBufferBytes(r.public_key as Buffer),
    counter: r.counter as number,
    transports: JSON.parse((r.transports as string) || '[]') as AuthenticatorTransport[],
    deviceType: (r.device_type as string | null) ?? null,
    backedUp: r.backed_up === 1,
    label: (r.label as string | null) ?? null,
    createdAt: r.created_at as string,
    lastUsedAt: (r.last_used_at as string | null) ?? null,
  };
}

function toArrayBufferBytes(buf: Buffer): Uint8Array<ArrayBuffer> {
  const copy = new ArrayBuffer(buf.byteLength);
  const view = new Uint8Array(copy);
  view.set(buf);
  return view;
}
