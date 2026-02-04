import { defineConfig } from '@playwright/test';

// DEV-mode Playwright config used for render-storm instrumentation.
// Runs against `vite` dev server so `import.meta.env.DEV` is true.
const PW_MODE = process.env.PW_MODE ?? (process.env.CI ? 'ci' : 'local');

const trace =
  PW_MODE === 'local' ? 'off' :
    PW_MODE === 'ci' ? 'on-first-retry' :
      PW_MODE === 'debug' ? 'on-first-retry' :
        PW_MODE === 'debug-full' ? 'on' :
          'off';

const screenshot =
  PW_MODE === 'local' ? 'off' :
    PW_MODE === 'ci' ? 'only-on-failure' :
      PW_MODE === 'debug' ? 'only-on-failure' :
        PW_MODE === 'debug-full' ? 'on' :
          'off';

const video =
  PW_MODE === 'debug-full' ? 'on-first-retry' : 'off';

console.log(`[PW:dev] mode=${PW_MODE} CI=${!!process.env.CI} artifacts=trace:${trace}/screenshot:${screenshot}/video:${video}`);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,

  use: {
    headless: process.env.CI ? true : false,
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://127.0.0.1:4173',
    trace,
    video,
    screenshot,
  },

  webServer: {
    // DEV server so `import.meta.env.DEV` instrumentation is active.
    command: 'pnpm --filter @redbyte/playground exec vite --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        serviceWorkers: 'block',
        launchOptions: {
          args: [
            '--disable-gpu',
            '--use-gl=swiftshader',
            '--enable-unsafe-swiftshader',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-features=ServiceWorker',
          ],
        },
      },
    },
  ],

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
});
