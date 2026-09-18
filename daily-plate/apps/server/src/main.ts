import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase, sqliteVersion, MIN_SQLITE_VERSION } from './db/database.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);
const app = await buildApp({ config, db });

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
