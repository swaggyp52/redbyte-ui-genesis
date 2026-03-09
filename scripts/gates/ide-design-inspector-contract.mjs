#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE design inspector contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (store?.getState) {
      store.getState().reset();
    }
  });

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const hudCount = await page.locator('[data-testid="ide-design-tool-hud"]').count();
  assert(hudCount >= 1, 'design tool HUD marker must exist');

  const paletteCount = await page.locator('[data-testid^="ide-design-palette-"]').count();
  assert(paletteCount >= 8, `expected >=8 design primitives in palette, found ${paletteCount}`);

  await page.locator('[data-testid="ide-design-add-and-starter"]').click();
  const andNode = page.locator('[data-testid^="node-AND-"]').first();
  await andNode.waitFor({ timeout: 10000 });
  await andNode.click();

  await page.waitForSelector('[data-testid="ide-design-selection-inspector"]', { timeout: 10000 });
  const typeText = (await page.locator('[data-testid="ide-design-selection-type"]').first().textContent())?.trim();
  assert(typeText === 'AND', `expected AND in selection inspector, got ${typeText}`);

  const nodeIdText = (await page.locator('[data-testid="ide-design-selection-id"]').first().textContent())?.trim();
  assert(Boolean(nodeIdText && nodeIdText.length > 0), 'selection inspector must show node id');

  const pinCount = await page.locator('[data-testid="ide-design-selection-pins"] .ide-design-pin-pill').count();
  assert(pinCount >= 3, `expected at least 3 pin pills for AND node, found ${pinCount}`);
});

