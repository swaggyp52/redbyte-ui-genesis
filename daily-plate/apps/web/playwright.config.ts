import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'test-results', 'e2e-data');
// Workers re-evaluate this file; only the runner process may wipe the server's data.
if (!process.env.TEST_WORKER_INDEX) fs.rmSync(dataDir, { recursive: true, force: true });
process.env.DP_E2E_DATA_DIR = dataDir;
const port = 8790;
const origin = `http://localhost:${port}`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: origin,
    ...devices['iPhone 14'],
    defaultBrowserType: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iphone-chromium', use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium' } },
    // Playwright WebKit is not branded Safari and not a physical iPhone; it is a second engine, nothing more.
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'], defaultBrowserType: 'webkit' } },
  ],
  webServer: {
    command: 'node ../server/dist/main.js',
    url: `${origin}/healthz`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      DP_DATA_DIR: dataDir,
      DP_PORT: String(port),
      DP_HOST: '127.0.0.1',
      DP_ORIGINS: origin,
      DP_RP_ID: 'localhost',
      DP_SECURE_COOKIES: 'false',
      DP_WEB_DIST: path.join(here, 'dist'),
      DP_LOG_LEVEL: 'warn',
      DP_VERSION: 'e2e',
      // Provider answers come from fixtures (test-only; refused in production). Live USDA/OFF are not exercised here.
      DP_PROVIDER_STUB_DIR: path.join(here, '../../fixtures'),
      DP_USDA_API_KEY: 'fixture-stub-key',
      DP_PROVIDER_CONTACT: 'e2e@example.invalid',
    },
  },
});
