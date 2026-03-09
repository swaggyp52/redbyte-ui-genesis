#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE design IO panel contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  // Start with empty canvas — input panel should not render yet
  const inputPanelBefore = await page
    .locator('[data-testid="ide-design-input-panel"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(!inputPanelBefore, 'input panel must not render before any inputs exist');

  // Add IO pins via the primary CTA
  await page.locator('[data-testid="ide-design-add-io-pins"]').click();
  await page.waitForSelector('[data-testid="ide-design-input-panel"]', { timeout: 8000 });

  const inputPanel = page.locator('[data-testid="ide-design-input-panel"]').first();
  assert(await visible(inputPanel), 'input panel must render when circuit has input nodes');

  const toggleCount = await page.locator('[data-testid^="ide-design-input-toggle-"]').count();
  assert(toggleCount >= 1, `input panel must have at least 1 toggle button, got ${toggleCount}`);

  const firstToggle = page.locator('[data-testid^="ide-design-input-toggle-"]').first();
  const pressedBefore = await firstToggle.getAttribute('aria-pressed');
  await firstToggle.click();
  const pressedAfter = await firstToggle.getAttribute('aria-pressed');
  assert(
    pressedBefore !== pressedAfter,
    `toggle must change aria-pressed state; was "${pressedBefore}", now "${pressedAfter}"`
  );
});
