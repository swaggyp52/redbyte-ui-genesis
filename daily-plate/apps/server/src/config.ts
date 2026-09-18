import path from 'node:path';

export interface ServerConfig {
  host: string;
  port: number;
  dataDir: string;
  dbPath: string;
  /** Relying party id for passkeys, e.g. daily-plate.example.ts.net */
  rpId: string;
  rpName: string;
  /** Expected origin(s) for passkeys and CSRF checks. */
  origins: string[];
  secureCookies: boolean;
  usdaApiKey: string | undefined;
  providerContact: string;
  webDistDir: string | undefined;
  sessionIdleDays: number;
  sessionAbsoluteDays: number;
  inviteMinutes: number;
  logLevel: string;
  version: string;
}

function env(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export function loadConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const dataDir = overrides.dataDir ?? env('DP_DATA_DIR', path.resolve(process.cwd(), 'data')) ?? 'data';
  const port = Number(env('DP_PORT', '8787'));
  const host = env('DP_HOST', '127.0.0.1') ?? '127.0.0.1';
  const rpId = env('DP_RP_ID', 'localhost') ?? 'localhost';
  const originsRaw = env('DP_ORIGINS', `http://localhost:${port},http://localhost:5173`) ?? '';
  const secure = env('DP_SECURE_COOKIES', rpId === 'localhost' ? 'false' : 'true') === 'true';
  return {
    host,
    port,
    dataDir,
    dbPath: path.join(dataDir, 'daily-plate.db'),
    rpId,
    rpName: 'Daily Plate',
    origins: originsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    secureCookies: secure,
    usdaApiKey: env('DP_USDA_API_KEY'),
    providerContact: env('DP_PROVIDER_CONTACT', 'unconfigured') ?? 'unconfigured',
    webDistDir: env('DP_WEB_DIST'),
    sessionIdleDays: Number(env('DP_SESSION_IDLE_DAYS', '30')),
    sessionAbsoluteDays: Number(env('DP_SESSION_ABSOLUTE_DAYS', '90')),
    inviteMinutes: Number(env('DP_INVITE_MINUTES', '30')),
    logLevel: env('DP_LOG_LEVEL', 'info') ?? 'info',
    version: env('DP_VERSION', '0.1.0-dev') ?? '0.1.0-dev',
    ...overrides,
  };
}
