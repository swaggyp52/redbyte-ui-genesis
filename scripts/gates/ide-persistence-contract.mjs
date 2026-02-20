#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE persistence contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const beforeInputCount = await page.$$eval('[data-testid^="ide-design-live-input-"]', (rows) => rows.length);
  await page.locator('[data-testid="ide-design-add-io-pins"]').click();
  await page.waitForSelector('[data-testid="ide-design-action-toast"]', { timeout: 10000 });
  await page.waitForFunction(
    (before) => {
      const rows = document.querySelectorAll('[data-testid^="ide-design-live-input-"]');
      return rows.length > before;
    },
    beforeInputCount,
    { timeout: 10000 }
  );

  const afterInputCount = await page.$$eval('[data-testid^="ide-design-live-input-"]', (rows) => rows.length);
  assert(afterInputCount > beforeInputCount, 'design mutation should increase visible input rows');

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const hashBeforeReload = await text(page.locator('[data-testid="ide-project-hash-short"]'));
  assert(hashBeforeReload.length > 0, 'project hash should be visible before reload');

  await page.waitForFunction(() => {
    const saveState = document.querySelector('[data-testid="ide-save-state"]');
    return Boolean(saveState && /saved/i.test(saveState.textContent || ''));
  }, { timeout: 10000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);

  const hashAfterReload = await text(page.locator('[data-testid="ide-project-hash-short"]'));
  assert(
    hashAfterReload === hashBeforeReload,
    `project hash must persist across reload (${hashBeforeReload} vs ${hashAfterReload})`
  );

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const persistedInputCount = await page.$$eval(
    '[data-testid^="ide-design-live-input-"]',
    (rows) => rows.length
  );
  assert(
    persistedInputCount === afterInputCount,
    `mutated design should persist across reload (expected ${afterInputCount}, got ${persistedInputCount})`
  );
});

