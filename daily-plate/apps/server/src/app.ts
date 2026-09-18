import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import type { ServerConfig } from './config.js';
import { openDatabase, sqliteVersion, type Db } from './db/database.js';
import { Store } from './db/store.js';
import { Invites, Sessions, type SessionRow } from './auth/sessions.js';
import { Passkeys } from './auth/passkeys.js';
import { SearchService } from './services/search.js';
import type { FetchLike } from './providers/http.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerApiRoutes } from './routes/api.js';

export const SESSION_COOKIE = 'dp_session';
export const CSRF_HEADER = 'x-daily-plate';

export interface AppOptions {
  config: ServerConfig;
  db?: Db;
  fetchImpl?: FetchLike;
  logger?: boolean;
}

export interface AppContext {
  config: ServerConfig;
  db: Db;
  store: Store;
  sessions: Sessions;
  invites: Invites;
  passkeys: Passkeys;
  search: SearchService;
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionRow | undefined;
  }
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { config } = options;
  const db = options.db ?? openDatabase(config.dbPath);
  const store = new Store(db);
  const ctx: AppContext = {
    config,
    db,
    store,
    sessions: new Sessions(db, { idleDays: config.sessionIdleDays, absoluteDays: config.sessionAbsoluteDays }),
    invites: new Invites(db, config.inviteMinutes),
    passkeys: new Passkeys(db, { rpId: config.rpId, rpName: config.rpName, origins: config.origins }),
    search: new SearchService(store, {
      usdaApiKey: config.usdaApiKey,
      userAgent: `DailyPlate/${config.version} (private family food journal; contact: ${config.providerContact})`,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    }),
  };

  const app = Fastify({
    logger: options.logger === false ? false : { level: config.logLevel, redact: ['req.headers.cookie', 'req.headers.authorization'] },
    bodyLimit: 512 * 1024,
    trustProxy: true,
    disableRequestLogging: true,
  });
  app.decorate('ctx', ctx);

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"],
        'font-src': ["'self'"],
        'media-src': ["'self'", 'blob:'],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'object-src': ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginEmbedderPolicy: false,
    hsts: config.secureCookies ? { maxAge: 15_552_000, includeSubDomains: false } : false,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });

  // Resolve the session on every request; enforce CSRF defenses on state changes.
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    req.session = ctx.sessions.resolve(req.cookies[SESSION_COOKIE]);
    if (req.url.startsWith('/api/') && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const origin = req.headers.origin;
      if (origin && !config.origins.includes(origin)) return reply.code(403).send({ error: 'origin-not-allowed' });
      if (req.headers[CSRF_HEADER] !== '1') return reply.code(403).send({ error: 'missing-app-header' });
    }
    return undefined;
  });

  app.setErrorHandler((error: unknown, req, reply) => {
    const err = error as { statusCode?: number; message?: string; name?: string; code?: string };
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      req.log.error({ err: { message: err.message, name: err.name } }, 'request failed');
      return reply.code(500).send({ error: 'internal' });
    }
    return reply.code(status).send({ error: err.code ?? 'request-error', message: status === 429 ? 'Too many requests. Try again shortly.' : err.message });
  });

  app.get('/healthz', { config: { rateLimit: false } }, async () => ({ ok: true }));

  await app.register(registerAuthRoutes, { prefix: '/api/v1/auth' });
  await app.register(registerApiRoutes, { prefix: '/api/v1' });

  app.get('/api/*', async (_req, reply) => reply.code(404).send({ error: 'not-found' }));

  if (config.webDistDir && fs.existsSync(config.webDistDir)) {
    const root = path.resolve(config.webDistDir);
    await app.register(fastifyStatic, {
      root,
      prefix: '/',
      wildcard: false,
      index: false,
      setHeaders(reply, filePath) {
        const base = path.basename(filePath);
        if (base === 'sw.js' || base === 'index.html' || base === 'manifest.webmanifest') reply.header('Cache-Control', 'no-cache');
        else if (filePath.includes(`${path.sep}assets${path.sep}`)) reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      },
    });
    app.get('/', async (_req, reply) => reply.sendFile('index.html'));
    app.get('/*', async (req, reply) => {
      const rel = req.url.split('?')[0] ?? '/';
      const candidate = path.join(root, rel);
      if (candidate.startsWith(root) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return reply.sendFile(rel);
      reply.header('Cache-Control', 'no-cache');
      return reply.sendFile('index.html');
    });
  }

  app.addHook('onClose', async () => {
    if (!options.db) db.close();
  });

  app.log.info({ sqlite: sqliteVersion(db), node: process.version, version: config.version }, 'daily plate ready');
  return app;
}

export function requireSession(req: FastifyRequest, reply: FastifyReply): SessionRow | undefined {
  if (!req.session) {
    void reply.code(401).send({ error: 'unauthenticated' });
    return undefined;
  }
  return req.session;
}
