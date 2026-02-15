/**
 * v1 Stability Triage Gate
 *
 * Contract: If this test fails, the demo is not safe.
 *
 * Assertions:
 *  - Desktop shell mounts and is visible
 *  - Dashboard and Studio apps are registered and discoverable
 *  - No fatal errors persisted to localStorage (fatal-capture clean)
 *  - No uncaught exceptions (failPromise rejection)
 *  - No console.error messages during boot
 *
 * Runs in CI/release chain as part of rc:check gate.
 */

import { test, expect } from '@playwright/test';
import { createFailureWatcher } from './helpers';

const EXTRA_FLAGS = process.env.E2E_FLAGS || '';
const OS_URL = `/os/?e2e=1&boot=1${EXTRA_FLAGS ? `&${EXTRA_FLAGS}` : ''}`;

/**
 * Collect and fail on any console.error messages.
 * Returns a promise that rejects if any errors are logged.
 */
function trackConsoleErrors(page: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const errors: string[] = [];
    const handler = (msg: any) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        reject(new Error(`Console error detected during boot: ${text}`));
      }
    };
    page.once('load', () => resolve());
    page.on('console', handler);
  });
}

test.describe('v1 stability triage smoke', () => {
  test.describe.configure({ timeout: 30_000 });

  test('shell boots to desktop without fatal errors', async ({ page, context }) => {
    const { failPromise, dispose } = createFailureWatcher(page, 'http://127.0.0.1:4173');
    const consoleErrorPromise = trackConsoleErrors(page);

    try {
      // Clear any stale fatal-capture state before boot
      await context.addInitScript(() => {
        localStorage.removeItem('__RB_LAST_FATAL__');
      });

      // Boot to shell
      await page.goto(OS_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      // Expect desktop shell visible = boot succeeded
      await Promise.race([
        failPromise,
        consoleErrorPromise,
        expect(page.locator('[data-testid="desktop-shell"]')).toBeVisible({ timeout: 10_000 }),
      ]);

      // Verify shell title
      await expect(page).toHaveTitle(/RedByte|Playground/i);

      // Verify NO fatal errors persisted to localStorage (assert null or undefined)
      const fatalRecord = await page.evaluate(() => {
        return localStorage.getItem('__RB_LAST_FATAL__');
      });
      expect(fatalRecord).toBeNull();

      // If we got here without failPromise rejecting, no uncaught errors
      // This validates the e2e-boot app registration includes required apps
    } finally {
      dispose();
      page.removeAllListeners('console');
    }
  });

  test('dashboard and studio apps are registered', async ({ page, context }) => {
    const { failPromise, dispose } = createFailureWatcher(page, 'http://127.0.0.1:4173');
    const consoleErrorPromise = trackConsoleErrors(page);

    try {
      // Clear any stale fatal-capture state before boot
      await context.addInitScript(() => {
        localStorage.removeItem('__RB_LAST_FATAL__');
      });

      await page.goto(OS_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      // Wait for shell to fully load
      await Promise.race([
        failPromise,
        consoleErrorPromise,
        expect(page.locator('[data-testid="desktop-shell"]')).toBeVisible({ timeout: 10_000 }),
      ]);

      // Verify dock/launcher contains buttons for Dashboard and Studio
      // Use word boundaries to avoid false matches on generic UI text
      const dashboardBtn = page.getByRole('button', { name: /\bDashboard\b/i }).first();
      const studioBtn = page.getByRole('button', { name: /\bStudio\b/i }).first();

      await expect(dashboardBtn).toBeVisible({ timeout: 5_000 });
      await expect(studioBtn).toBeVisible({ timeout: 5_000 });

      // Verify NO fatal errors persisted to localStorage (assert null or undefined)
      const fatalRecord = await page.evaluate(() => {
        return localStorage.getItem('__RB_LAST_FATAL__');
      });
      expect(fatalRecord).toBeNull();
    } finally {
      dispose();
      page.removeAllListeners('console');
    }
  });
});
