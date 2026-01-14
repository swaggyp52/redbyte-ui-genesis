import { test } from '@playwright/test';

test('JS health truth', async ({ page }) => {
  console.log('[NODE] 1: start test');

  page.on('close', () => console.log('[NODE] page close event fired'));
  page.on('crash', () => console.log('[NODE] page crash event fired'));
  page.on('pageerror', (e) => console.log('[NODE] pageerror:', e?.message ?? String(e)));

  console.log('[NODE] 2: before goto');
  await page.goto('http://127.0.0.1:4173/?boot=bisect&step=0', { waitUntil: 'load', timeout: 15000 });
  console.log('[NODE] 3: after goto');

  // Minimal wait (not page.evaluate heavy)
  await page.waitForTimeout(250);
  console.log('[NODE] 4: after wait');

  await page.close({ runBeforeUnload: true }).catch(() => {});
  console.log('[NODE] 5: after page.close');

  // This forces Playwright to flush everything it thinks it still needs
  await page.context().close().catch(() => {});
  console.log('[NODE] 6: after context.close');

  console.log('[NODE] 7: end test');
});
