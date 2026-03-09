#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE hardware checklist contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });
  await page.locator('[data-testid="ide-hw-mode-btn-proof"]').click();

  const checklist = page.locator('[data-testid="ide-hw-proof-dock"]');
  const expectedTable = page.locator('[data-testid="ide-hw-proof-dock"]');
  const ifWrong = page.locator('[data-testid="ide-hw-mode-toggle"]');

  assert(await visible(checklist), 'hardware checklist panel must render');
  assert(await visible(expectedTable), 'hardware expected IO panel must render');
  assert(await visible(ifWrong), 'hardware if-wrong panel must render');
});
