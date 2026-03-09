#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE fullscreen + no chrome contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  const ideRootVisible = await page.locator('[data-testid="ide-root"]').first().isVisible().catch(() => false);
  const playgroundRootVisible = await page
    .locator('[data-testid="logic-playground-root"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(ideRootVisible || playgroundRootVisible, 'fullscreen workspace root must be mounted');

  const topBarVisible = await page.locator('[data-testid="top-bar"]').isVisible().catch(() => false);
  const dockVisible = await page.locator('[data-testid="dock"]').isVisible().catch(() => false);
  const taskbarVisible = await page.locator('[data-testid="taskbar"]').isVisible().catch(() => false);

  assert(!topBarVisible, `top-bar should be hidden in fullscreen playground mode (visible=${topBarVisible})`);
  assert(!dockVisible, `dock should be hidden in fullscreen playground mode (visible=${dockVisible})`);
  assert(!taskbarVisible, `taskbar should be hidden in fullscreen playground mode (visible=${taskbarVisible})`);
});
