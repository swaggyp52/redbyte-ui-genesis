import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase, sqliteVersion, MIN_SQLITE_VERSION } from './db/database.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);
const stubDir = process.env.DP_PROVIDER_STUB_DIR;
if (stubDir && process.env.NODE_ENV === 'production') throw new Error('DP_PROVIDER_STUB_DIR is a test-only setting and is refused in production');
const app = await buildApp({ config, db, ...(stubDir ? { fetchImpl: (await import('./providers/stub.js')).fixtureFetch(stubDir) } : {}) });
if (stubDir) app.log.warn({ stubDir }, 'provider stub active: USDA/OFF answers come from fixtures, not live services');

const close = async (signal: string): Promise<void> => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  db.close();
  process.exit(0);
};
process.on('SIGINT', () => void close('SIGINT'));
process.on('SIGTERM', () => void close('SIGTERM'));

await app.listen({ host: config.host, port: config.port });
app.log.info({ host: config.host, port: config.port, dataDir: config.dataDir, sqlite: sqliteVersion(db), minSqlite: MIN_SQLITE_VERSION }, 'listening');
