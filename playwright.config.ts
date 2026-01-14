import { defineConfig } from '@playwright/test';

// Artifact policy per run intent (all modes bounded to prevent teardown hangs):
// - local: fast iteration, no artifacts
// - ci: bounded evidence on flakes (trace/screenshot on retry)
// - debug: bounded evidence on all failures (safe for iteration)
// - debug-full: always-on trace (may hang, explicit opt-in only)
const PW_MODE = process.env.PW_MODE ?? (process.env.CI ? 'ci' : 'local');

const trace =
  PW_MODE === 'local' ? 'off' :
  PW_MODE === 'ci' ? 'on-first-retry' :
  PW_MODE === 'debug' ? 'on-first-retry' : // Bounded - safe
  PW_MODE === 'debug-full' ? 'on' : // Unbounded - may hang
  'off';

const screenshot =
  PW_MODE === 'local' ? 'off' :
  PW_MODE === 'ci' ? 'only-on-failure' :
  PW_MODE === 'debug' ? 'only-on-failure' : // Bounded - safe
  PW_MODE === 'debug-full' ? 'on' : // Unbounded - may hang
  'off';

const video =
  PW_MODE === 'debug-full' ? 'on-first-retry' : 'off';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 15_000,  // Reduced from 60s

  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:4173',
    trace,
    video,
    screenshot,
  },

  // Run against the production-like preview server
  webServer: {
    command: 'pnpm --filter @redbyte/playground exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Scope GPU-off and stability flags to Chromium project used by CE tests
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        serviceWorkers: 'block',
        // launchOptions: {
        //   args: [
        //     // SAFETY: Disable GPU and sandbox for stability
        //     '--disable-gpu',
        //     '--disable-software-rasterizer',
        //     '--disable-dev-shm-usage',
        //     '--no-sandbox',
        //     '--disable-features=ServiceWorker',
        //   ],
        // },
      },
    },
  ],

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
});
