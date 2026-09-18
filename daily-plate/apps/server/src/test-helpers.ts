import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance, InjectOptions } from 'fastify';
import type { Mutation, MutationPayload } from '@daily-plate/contracts';
import { buildApp, CSRF_HEADER, SESSION_COOKIE } from './app.js';
import { loadConfig, type ServerConfig } from './config.js';
import type { FetchLike } from './providers/http.js';
import { randomUUID } from 'node:crypto';

export interface TestApp {
  app: FastifyInstance;
  config: ServerConfig;
  dataDir: string;
  close: () => Promise<void>;
}

export async function makeTestApp(options: { dataDir?: string; fetchImpl?: FetchLike; usdaApiKey?: string } = {}): Promise<TestApp> {
  const dataDir = options.dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'daily-plate-test-'));
  const config = loadConfig({
    dataDir,
    dbPath: path.join(dataDir, 'daily-plate.db'),
    rpId: 'localhost',
    origins: ['http://localhost:8787'],
    secureCookies: false,
    usdaApiKey: options.usdaApiKey,
    logLevel: 'silent',
    version: 'test',
    webDistDir: undefined,
  });
  const app = await buildApp({ config, logger: false, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) });
  await app.ready();
  return {
    app,
    config,
    dataDir,
    close: async () => {
      await app.close();
    },
  };
}

export function cleanup(dataDir: string): void {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

export interface Client {
  cookie: string;
  userId: string;
  get: (url: string) => Promise<{ status: number; json: () => unknown }>;
  post: (url: string, body?: unknown) => Promise<{ status: number; json: () => unknown }>;
  mutate: (payloads: MutationPayload[]) => Promise<{ status: number; results: Array<Record<string, unknown>> }>;
}

export async function signUp(t: TestApp, displayName = 'Test User', timeZone = 'America/New_York'): Promise<Client> {
  const { token } = t.app.ctx.invites.create({ displayName });
  const res = await t.app.inject({ method: 'POST', url: '/api/v1/auth/invite/redeem', headers: { [CSRF_HEADER]: '1' }, payload: { token, displayName, timeZone } });
  if (res.statusCode !== 200) throw new Error(`redeem failed: ${res.statusCode} ${res.body}`);
  const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
  if (!cookie) throw new Error('no session cookie');
  const userId = (res.json() as { userId: string }).userId;
  return makeClient(t, `${SESSION_COOKIE}=${cookie.value}`, userId);
}

export function makeClient(t: TestApp, cookie: string, userId: string): Client {
  const call = async (opts: InjectOptions) => {
    const res = await t.app.inject({ ...opts, headers: { ...(opts.headers ?? {}), cookie, [CSRF_HEADER]: '1' } });
    return { status: res.statusCode, json: () => res.json() as unknown };
  };
  return {
    cookie,
    userId,
    get: (url) => call({ method: 'GET', url }),
    post: (url, body) => call({ method: 'POST', url, payload: body as Record<string, unknown> }),
    mutate: async (payloads) => {
      const mutations: Mutation[] = payloads.map((payload) => ({ schemaVersion: 1, mutationId: randomUUID(), clientTime: new Date().toISOString(), payload }));
      const res = await call({ method: 'POST', url: '/api/v1/mutations', payload: { mutations } });
      const body = res.json() as { results?: Array<Record<string, unknown>>; message?: string };
      if (res.status !== 200) throw new Error(`mutations failed: ${res.status} ${body.message ?? ''}`);
      return { status: res.status, results: body.results ?? [] };
    },
  };
}

export function mutation(payload: MutationPayload, mutationId = randomUUID()): Mutation {
  return { schemaVersion: 1, mutationId, clientTime: new Date().toISOString(), payload };
}

/** The screenshot shake fixture as a custom food. Not a verified product record. */
export const SHAKE_FOOD = {
  food: { id: 'food-shake-0001', name: 'My shake', aliases: ['shake', 'my shake'], pin: null, suggestEligible: true, tags: ['drink' as const], hidden: false },
  version: {
    id: 'food-shake-0001-v1',
    name: 'My shake',
    preparation: 'as-sold' as const,
    basis: { kind: 'serving' as const, servingText: '1 bottle' },
    nutrients: {
      protein: { status: 'reported' as const, amount: '30' },
      carbs: { status: 'reported' as const, amount: '15' },
      fat: { status: 'unknown' as const },
      fiber: { status: 'reported' as const, amount: '5' },
      sugar: { status: 'unknown' as const },
      calories: { status: 'unknown' as const },
    },
    portions: [
      { id: 'bottle', name: 'bottle', servings: '1' },
      { id: 'half', name: 'half bottle', servings: '0.5' },
    ],
    defaultQuantity: { amount: '1', unit: { kind: 'portion' as const, portionId: 'bottle' } },
    provenance: { provider: 'user' as const, fetchedAt: '2026-09-18T12:00:00.000Z', normalizationVersion: 'user-1' },
  },
};

export function entryFor(id: string, foodVersionId: string, amount: string, unit: { kind: 'serving' } | { kind: 'portion'; portionId: string } = { kind: 'serving' }, localDate = '2026-09-18') {
  return {
    id,
    localDate,
    timeZone: 'America/New_York',
    occurredAt: `${localDate}T12:00:00.000Z`,
    mealSlot: 'lunch' as const,
    kind: 'food' as const,
    foodVersionId,
    quantity: { amount, unit },
  };
}
