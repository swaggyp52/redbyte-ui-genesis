import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, makeTestApp, signUp, type TestApp } from './test-helpers.js';
import { CSRF_HEADER, SESSION_COOKIE } from './app.js';

let t: TestApp;
beforeEach(async () => {
  t = await makeTestApp();
});
afterEach(async () => {
  await t.close();
  cleanup(t.dataDir);
});

describe('S01 unauthenticated requests', () => {
  it('expose no diary, search, export or changes', async () => {
    for (const url of ['/api/v1/bootstrap', '/api/v1/days/2026-09-18', '/api/v1/changes', '/api/v1/foods/search?q=banana', '/api/v1/foods/barcode/0012345678905']) {
      const res = await t.app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(401);
    }
    const post = await t.app.inject({ method: 'POST', url: '/api/v1/export', headers: { [CSRF_HEADER]: '1' }, payload: {} });
    expect(post.statusCode).toBe(401);
    const health = await t.app.inject({ method: 'GET', url: '/healthz' });
    expect(health.json()).toEqual({ ok: true });
  });

  it('a bad cookie is just unauthenticated', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { cookie: `${SESSION_COOKIE}=not-a-real-token-at-all-0000000000` } });
    expect(res.statusCode).toBe(401);
  });
});

describe('S03 invites', () => {
  it('a GET (link preview) can never redeem; peek does not consume; redeem is one-use', async () => {
    const { token } = t.app.ctx.invites.create({ displayName: 'Mom' });
    const preview = await t.app.inject({ method: 'GET', url: `/api/v1/auth/invite/redeem?token=${token}` });
    expect(preview.statusCode).toBe(404);
    const peek1 = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/peek', headers: { [CSRF_HEADER]: '1' }, payload: { token } });
    expect(peek1.json()).toEqual({ valid: true, recovery: false, displayName: 'Mom' });
    const peek2 = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/peek', headers: { [CSRF_HEADER]: '1' }, payload: { token } });
    expect((peek2.json() as { valid: boolean }).valid).toBe(true);

    const redeem = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/redeem', headers: { [CSRF_HEADER]: '1' }, payload: { token, timeZone: 'America/New_York' } });
    expect(redeem.statusCode).toBe(200);
    expect(redeem.cookies.find((c) => c.name === SESSION_COOKIE)).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });

    const replay = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/redeem', headers: { [CSRF_HEADER]: '1' }, payload: { token } });
    expect(replay.statusCode).toBe(400);
    const peek3 = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/peek', headers: { [CSRF_HEADER]: '1' }, payload: { token } });
    expect((peek3.json() as { valid: boolean }).valid).toBe(false);
  });

  it('expired and unknown invites are refused', async () => {
    const { token } = t.app.ctx.invites.create({});
    t.app.ctx.db.prepare("update invites set expires_at = '2000-01-01T00:00:00.000Z'").run();
    const expired = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/redeem', headers: { [CSRF_HEADER]: '1' }, payload: { token } });
    expect(expired.statusCode).toBe(400);
    const unknown = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/redeem', headers: { [CSRF_HEADER]: '1' }, payload: { token: 'x'.repeat(43) } });
    expect(unknown.statusCode).toBe(400);
  });

  it('a recovery invite binds a new session to the existing account', async () => {
    const me = await signUp(t, 'Mom');
    const { token } = t.app.ctx.invites.create({ userId: me.userId });
    const redeem = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/redeem', headers: { [CSRF_HEADER]: '1' }, payload: { token } });
    expect(redeem.statusCode).toBe(200);
    expect(redeem.json()).toMatchObject({ authenticated: true, userId: me.userId, recovery: true });
    expect(t.app.ctx.store.listUsers()).toHaveLength(1);
  });
});

describe('O06 sessions', () => {
  it('logout revokes; revoked and expired sessions are refused', async () => {
    const me = await signUp(t);
    expect((await me.get('/api/v1/auth/session')).json()).toMatchObject({ authenticated: true, passkeyCount: 0 });
    const logout = await me.post('/api/v1/auth/logout');
    expect(logout.status).toBe(200);
    expect((await me.get('/api/v1/bootstrap')).status).toBe(401);

    const again = await signUp(t);
    t.app.ctx.db.prepare("update sessions set idle_expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await again.get('/api/v1/bootstrap')).status).toBe(401);
  });

  it('revoke-others keeps the current session only', async () => {
    const a = await signUp(t, 'Mom');
    const { token } = t.app.ctx.invites.create({ userId: a.userId });
    const second = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/redeem', headers: { [CSRF_HEADER]: '1' }, payload: { token } });
    const cookieB = `${SESSION_COOKIE}=${second.cookies.find((c) => c.name === SESSION_COOKIE)!.value}`;
    const revoke = await a.post('/api/v1/auth/sessions/revoke-others');
    expect(revoke.json()).toEqual({ revoked: 1 });
    expect((await a.get('/api/v1/bootstrap')).status).toBe(200);
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/bootstrap', headers: { cookie: cookieB } })).statusCode).toBe(401);
  });
});

describe('passkey ceremony plumbing', () => {
  it('issues registration options bound to the session and rejects a replayed challenge', async () => {
    const me = await signUp(t, 'Mom');
    const opts = await me.post('/api/v1/auth/passkey/register/options');
    expect(opts.status).toBe(200);
    const body = opts.json() as { challengeId: string; options: { rp: { id: string }; challenge: string; authenticatorSelection: { residentKey: string } } };
    expect(body.options.rp.id).toBe('localhost');
    expect(body.options.authenticatorSelection.residentKey).toBe('required');
    const bogus = await me.post('/api/v1/auth/passkey/register/verify', { challengeId: body.challengeId, response: { id: 'x', rawId: 'x', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'e30' }, clientExtensionResults: {} } });
    expect(bogus.status).toBe(400);
    const replay = await me.post('/api/v1/auth/passkey/register/verify', { challengeId: body.challengeId, response: {} });
    expect(replay.status).toBe(400);
    expect((replay.json() as { message: string }).message).toMatch(/expired or already used/);
  });

  it('login options need no session and a wrong assertion never creates one', async () => {
    const opts = await t.app.inject({ method: 'POST', url: '/api/v1/auth/passkey/login/options', headers: { [CSRF_HEADER]: '1' } });
    expect(opts.statusCode).toBe(200);
    const { challengeId } = opts.json() as { challengeId: string };
    const verify = await t.app.inject({ method: 'POST', url: '/api/v1/auth/passkey/login/verify', headers: { [CSRF_HEADER]: '1' }, payload: { challengeId, response: { id: 'unknown-credential', rawId: 'x', type: 'public-key', response: { clientDataJSON: 'e30', authenticatorData: 'e30', signature: 'e30' }, clientExtensionResults: {} } } });
    expect(verify.statusCode).toBe(401);
    expect(verify.cookies.find((c) => c.name === SESSION_COOKIE)).toBeUndefined();
  });
});

describe('S05 security headers', () => {
  it('sets a restrictive CSP and no-referrer', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
