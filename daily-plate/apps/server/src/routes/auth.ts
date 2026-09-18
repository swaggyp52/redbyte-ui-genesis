import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { InviteRedeemSchema, type SessionInfo } from '@daily-plate/contracts';
import { requireSession, SESSION_COOKIE } from '../app.js';

const CHALLENGE_COOKIE = 'dp_challenge';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const { ctx } = app;
  const cookieOptions = { httpOnly: true, secure: ctx.config.secureCookies, sameSite: 'lax' as const, path: '/' };

  const setSession = (reply: Parameters<typeof requireSession>[1], token: string): void => {
    reply.setCookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: ctx.config.sessionAbsoluteDays * 86_400 });
  };

  const sessionInfo = (userId: string | undefined, expiresAt?: string): SessionInfo => {
    if (!userId) return { authenticated: false };
    const user = ctx.store.getUser(userId);
    if (!user) return { authenticated: false };
    const info: SessionInfo = { authenticated: true, userId: user.id, displayName: user.displayName, passkeyCount: ctx.passkeys.listForUser(user.id).length };
    if (expiresAt) info.expiresAt = expiresAt;
    return info;
  };

  app.get('/session', async (req) => sessionInfo(req.session?.userId, req.session?.idleExpiresAt));

  // Peek never redeems; a link preview GET cannot consume an invite because redeem is POST only.
  app.post('/invite/peek', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ token: z.string().min(20).max(200) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid' });
    return ctx.invites.peek(body.data.token);
  });

  app.post('/invite/redeem', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = InviteRedeemSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid' });
    const invite = ctx.invites.redeem(body.data.token);
    if (!invite) return reply.code(400).send({ error: 'invite-invalid', message: 'This invitation is no longer valid. Ask for a new one.' });
    let userId = invite.userId;
    if (!userId) {
      const user = ctx.store.createUser(body.data.displayName ?? invite.displayName ?? 'You', body.data.timeZone ?? 'UTC');
      userId = user.id;
    } else if (body.data.timeZone) {
      const user = ctx.store.getUser(userId);
      if (user && user.timeZone !== body.data.timeZone) ctx.store.saveUser({ ...user, timeZone: body.data.timeZone, revision: user.revision + 1 });
    }
    const { token, session } = ctx.sessions.create(userId, req.headers['user-agent']);
    setSession(reply, token);
    return { ...sessionInfo(userId, session.idleExpiresAt), recovery: invite.userId !== null };
  });

  app.post('/logout', async (req, reply) => {
    if (req.session) ctx.sessions.revoke(req.session.id);
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
    return { ok: true };
  });

  app.post('/passkey/register/options', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const user = ctx.store.getUser(session.userId);
    if (!user) return reply.code(401).send({ error: 'unauthenticated' });
    const { challengeId, options } = await ctx.passkeys.registrationOptions(user, session.id);
    return { challengeId, options };
  });

  app.post('/passkey/register/verify', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const body = z.object({ challengeId: z.string().min(8), response: z.unknown(), label: z.string().max(60).optional() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid' });
    const result = await ctx.passkeys.verifyRegistration(body.data.challengeId, session.userId, session.id, body.data.response as never, body.data.label);
    if (!result.ok) return reply.code(400).send({ error: 'passkey-failed', message: result.reason });
    return { ok: true, passkeyId: result.passkeyId, passkeyCount: ctx.passkeys.listForUser(session.userId).length };
  });

  app.post('/passkey/login/options', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (_req, reply) => {
    const { challengeId, options } = await ctx.passkeys.authenticationOptions();
    reply.setCookie(CHALLENGE_COOKIE, challengeId, { ...cookieOptions, maxAge: 300 });
    return { challengeId, options };
  });

  app.post('/passkey/login/verify', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = z.object({ challengeId: z.string().min(8), response: z.unknown() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid' });
    const bound = req.cookies[CHALLENGE_COOKIE];
    if (bound && bound !== body.data.challengeId) return reply.code(400).send({ error: 'passkey-failed', message: 'Challenge mismatch.' });
    const result = await ctx.passkeys.verifyAuthentication(body.data.challengeId, body.data.response as never);
    reply.clearCookie(CHALLENGE_COOKIE, cookieOptions);
    if (!result.ok) return reply.code(401).send({ error: 'passkey-failed', message: result.reason });
    const { token, session } = ctx.sessions.create(result.userId, req.headers['user-agent']);
    setSession(reply, token);
    return sessionInfo(result.userId, session.idleExpiresAt);
  });

  app.get('/passkeys', async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    return { passkeys: ctx.passkeys.listForUser(session.userId).map((p) => ({ id: p.id, label: p.label, createdAt: p.createdAt, lastUsedAt: p.lastUsedAt, deviceType: p.deviceType })) };
  });

  app.delete('/passkeys/:id', async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const id = (req.params as { id: string }).id;
    return { removed: ctx.passkeys.remove(session.userId, id) };
  });

  app.post('/sessions/revoke-others', async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    return { revoked: ctx.sessions.revokeAllForUser(session.userId, session.id) };
  });
}
