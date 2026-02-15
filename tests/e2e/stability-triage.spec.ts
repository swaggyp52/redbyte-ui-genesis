import { test, expect } from '@playwright/test';
import { createFailureWatcher } from './helpers';

const EXTRA_FLAGS = process.env.E2E_FLAGS || '';
const OS_URL = `/os/?e2e=1&boot=1${EXTRA_FLAGS ? `&${EXTRA_FLAGS}` : ''}`;

test.describe('v1 stability triage smoke', () => {
  test.describe.configure({ timeout: 30_000 });

  test('dashboard opens and studio launch is explicit', async ({ page }) => {
    const { failPromise, dispose } = createFailureWatcher(page, 'http://127.0.0.1:4173');

    try {
      await page.goto(OS_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      await Promise.race([
        failPromise,
        expect(page.getByTestId('home-screen-root')).toBeVisible({ timeout: 10_000 }),
      ]);

      await Promise.race([
        failPromise,
        page.getByRole('button', { name: 'Open Studio' }).click(),
      ]);

      const studioRoot = page.getByTestId('lab-workspace-root');
      const blockModal = page.getByTestId('studio-launch-block-modal');

      await Promise.race([
        failPromise,
        expect(studioRoot.or(blockModal)).toBeVisible({ timeout: 10_000 }),
      ]);

      if (await blockModal.isVisible()) {
        await expect(blockModal).toContainText(/Complete First Run Wizard/i);
      } else {
        await expect(studioRoot).toBeVisible();
      }
    } finally {
      dispose();
    }
  });
});
