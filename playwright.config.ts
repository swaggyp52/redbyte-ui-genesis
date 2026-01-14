import { defineConfig } from '@playwright/test';

// Artifacts: default OFF locally (fast iteration), ON in CI (evidence capture)
const CI = !!process.env.CI;
const PW_ARTIFACTS = process.env.PW_ARTIFACTS; // "1" enables locally
const ARTIFACTS_ON = CI || PW_ARTIFACTS === '1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 15_000,  // Reduced from 60s

  use: {
    headless: true,
    baseURL: 'http://127.0.0.1:4173',
    trace: ARTIFACTS_ON ? 'on-first-retry' : 'off',
    video: 'off', // Heavy, causes teardown hangs with preview server
    screenshot: ARTIFACTS_ON ? 'only-on-failure' : 'off',
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
