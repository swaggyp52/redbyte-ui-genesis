#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE hardware checklist contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });

  const checklist = page.locator('[data-testid="ide-hardware-checklist"]');
  const expectedTable = page.locator('[data-testid="ide-hardware-expected-io-table"]');
  const ifWrong = page.locator('[data-testid="ide-hardware-if-wrong"]');

  assert(await visible(checklist), 'hardware checklist panel must render');
  assert(await visible(expectedTable), 'hardware expected IO panel must render');
  assert(await visible(ifWrong), 'hardware if-wrong panel must render');
});
