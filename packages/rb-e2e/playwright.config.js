import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests',
    testMatch: /.*\.spec\.ts/,
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    use: {
        headless: true,
        baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? 'http://127.0.0.1:4173',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
    reporter: [['list'], ['html', { open: 'never' }]],
});
