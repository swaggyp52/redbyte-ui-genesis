import { test, expect } from '@playwright/test';
import { createFailureWatcher } from './helpers';

const EXTRA_FLAGS = process.env.E2E_FLAGS || '';
const OS_URL = `/os/?e2e=1&boot=1${EXTRA_FLAGS ? `&${EXTRA_FLAGS}` : ''}`;

test.describe('P1C Boot Gate', () => {
  test.describe.configure({ timeout: 30_000 });

  test('boots to Shell mount sentinel', async ({ page }) => {
    const { failPromise, dispose } = createFailureWatcher(page, 'http://127.0.0.1:4173');
    try {
      // Attach boot sentinel listener BEFORE navigation to avoid missing the signal on fast boots.
      const bootOkConsole = page.waitForEvent('console', (msg) => {
        return msg.type() === 'info' && msg.text().includes('RB_BOOT_OK');
      });

      await page.goto(OS_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      // Prefer the console signal for robustness; include a sentinel fallback for ultra-fast boots.
      const bootOkSentinel = page.waitForFunction(() => (window as any).__RB_BOOT_OK__ === true, null, {
        timeout: 15_000,
      });
      await Promise.race([
        failPromise,
        bootOkConsole,
        bootOkSentinel,
      ]);

      // Sanity: sentinel should imply we have a DOM + root container.
      await Promise.race([
        failPromise,
        expect(page.locator('#root')).toBeVisible({ timeout: 5_000 }),
      ]);
    } finally {
      dispose();
    }
  });
});
