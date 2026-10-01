#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, designInputIds, selectDesignInput } from './_gateHarness.mjs';

await runIdeGate('IDE live simulation contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  // Fit the circuit into view so that viewport-culled switch nodes become visible.
  const fitButton = page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first();
  await fitButton.evaluate((button) => button.click());

  const inputIds = await designInputIds(page);
  assert(inputIds.length >= 1, `expected a circuit input, found ${inputIds.length}`);
  const targetId = inputIds[0];
  const targetToggle = await selectDesignInput(page, targetId);
  const before = await targetToggle.getAttribute('aria-pressed');
  assert(before === 'true' || before === 'false', 'input inspector must expose binary state');
  await targetToggle.click();
  await page.waitForFunction((previous) => document.querySelector('[data-testid="ide-design-inspector-input-toggle"]')?.getAttribute('aria-pressed') !== previous, before);
  assert(await targetToggle.getAttribute('aria-pressed') !== before, 'input must change after toggling');
});
