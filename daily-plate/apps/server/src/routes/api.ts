import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ExportRequestSchema, MutationBatchSchema, virtualDaySnapshot, type Bootstrap, type MutationResult } from '@daily-plate/contracts';
import { isLocalDate, localDateFor, shiftLocalDate } from '@daily-plate/domain';
import { requireSession } from '../app.js';
import { applyMutation } from '../services/mutations.js';

const BOOTSTRAP_DAYS = 30;

export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  const { ctx } = app;

  app.get('/bootstrap', async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const user = ctx.store.getUser(session.userId);
    if (!user) return reply.code(401).send({ error: 'unauthenticated' });
    const today = localDateFor(new Date(), user.timeZone);
    const from = shiftLocalDate(today, -(BOOTSTRAP_DAYS - 1));
    const to = shiftLocalDate(today, 1);
    const body: Bootstrap = {
      serverVersion: ctx.config.version,
      user,
      goals: ctx.store.getGoals(user.id),
      foods: ctx.store.listFoods(user.id, true),
      foodVersions: ctx.store.listFoodVersions(user.id),
      meals: ctx.store.listMeals(user.id),
      recipes: ctx.store.listRecipes(user.id),
      recipeVersions: ctx.store.listRecipeVersions(user.id),
      days: ctx.store.listDays(user.id, from, to),
      entries: ctx.store.listEntries(user.id, from, to, true),
      dismissals: ctx.store.listDismissals(user.id),
      cursor: ctx.store.latestSeq(user.id),
      window: { from, to },
    };
    return body;
  });

  app.get('/changes', async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const q = z.object({ cursor: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(500).default(200) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid' });
    const { changes, more } = ctx.store.listChanges(session.userId, q.data.cursor, q.data.limit);
    const cursor = changes.length > 0 ? changes[changes.length - 1]!.seq : q.data.cursor;
    return { changes, cursor, more };
  });

  app.post('/mutations', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const body = MutationBatchSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid', message: body.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    const results: MutationResult[] = [];
    for (const mutation of body.data.mutations) {
      // Each mutation commits independently; a rejected one never hides a committed one.
      results.push(applyMutation(ctx.store, session.userId, mutation));
    }
    return { results, cursor: ctx.store.latestSeq(session.userId) };
  });

  app.get('/foods/search', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const q = z.object({ q: z.string().trim().min(1).max(100), mode: z.enum(['local', 'online']).default('local'), page: z.coerce.number().int().min(1).max(20).default(1) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'invalid' });
    return ctx.search.search(session.userId, q.data.q, q.data.mode, q.data.page);
  });

  app.get('/foods/details/:provider/:id', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const params = z.object({ provider: z.literal('usda'), id: z.string().min(1).max(20) }).safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid' });
    return ctx.search.details(params.data.provider, params.data.id);
  });

  app.get('/foods/barcode/:barcode', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const raw = (req.params as { barcode: string }).barcode;
    if (raw.length > 32) return reply.code(400).send({ error: 'invalid' });
    const remote = (req.query as { remote?: string }).remote === '1';
    const result = await ctx.search.barcode(session.userId, raw, remote);
    if ('error' in result) return reply.code(400).send({ error: result.error });
    return result;
  });

  app.get('/days/:localDate', async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const localDate = (req.params as { localDate: string }).localDate;
    if (!isLocalDate(localDate)) return reply.code(400).send({ error: 'invalid' });
    const user = ctx.store.getUser(session.userId);
    if (!user) return reply.code(401).send({ error: 'unauthenticated' });
    const day = ctx.store.getDay(user.id, localDate) ?? virtualDaySnapshot(ctx.store.getGoals(user.id), user, localDate);
    return { day, entries: ctx.store.listEntries(user.id, localDate, localDate) };
  });

  app.post('/export', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return undefined;
    const body = ExportRequestSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: 'invalid' });
    const user = ctx.store.getUser(session.userId);
    if (!user) return reply.code(401).send({ error: 'unauthenticated' });
    const from = body.data.from ?? '0000-01-01';
    const to = body.data.to ?? '9999-12-31';
    reply.header('Content-Disposition', 'attachment; filename="daily-plate-export.json"');
    return {
      exportedAt: new Date().toISOString(),
      user: { displayName: user.displayName, timeZone: user.timeZone },
      goals: ctx.store.getGoals(user.id),
      days: ctx.store.listDays(user.id, from, to),
      entries: ctx.store.listEntries(user.id, from, to),
      foods: ctx.store.listFoods(user.id, true),
      foodVersions: ctx.store.listFoodVersions(user.id),
      meals: ctx.store.listMeals(user.id),
      recipes: ctx.store.listRecipes(user.id),
      recipeVersions: ctx.store.listRecipeVersions(user.id),
    };
  });
}
