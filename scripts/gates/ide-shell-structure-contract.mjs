#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE shell structure contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  const topBar = page.locator('[data-testid="ide-top-bar"]').first();
  const leftRail = page.locator('[data-testid="ide-left-rail"]').first();
  assert(await visible(topBar), 'top bar must be visible on IDE route');
  assert(await visible(leftRail), 'left rail must be visible on IDE route');

  const shellCount = await page.locator('[data-testid="desktop-shell"]').count();
  assert(shellCount === 0, 'desktop shell must not mount on default IDE route');

  const modeRoot = page.locator('[data-testid="ide-mode-project"]').first();
  assert(await visible(modeRoot), 'project mode marker must be visible');

  await page.locator('[data-testid="mode-button-design"]').click();
  assert(await visible(page.locator('[data-testid="ide-mode-design"]').first()), 'design mode marker missing');
  await page.locator('[data-testid="mode-button-verify"]').click();
  assert(await visible(page.locator('[data-testid="ide-mode-verify"]').first()), 'verify mode marker missing');

  const activeButton = page.locator('[data-active="true"]').first();
  assert(await visible(activeButton), 'left rail must expose active marker via data-active');
});
