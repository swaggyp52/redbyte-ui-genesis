#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE shell density contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const topBar = page.locator('[data-testid="ide-top-bar"]').first();
  const leftRail = page.locator('[data-testid="ide-left-rail"]').first();

  assert(await visible(topBar), 'top bar must be visible');
  assert(await visible(leftRail), 'left rail must be visible');
  const consoleCount = await page.locator('[data-testid="ide-workbench-console"]').count();

  const [topBarBox, leftRailBox] = await Promise.all([
    topBar.boundingBox(),
    leftRail.boundingBox(),
  ]);

  assert(Boolean(topBarBox), 'top bar bounding box unavailable');
  assert(Boolean(leftRailBox), 'left rail bounding box unavailable');

  assert(topBarBox.height <= 52, `top bar must stay dense (<=52px), got ${topBarBox.height}`);
  assert(
    leftRailBox.width <= 72,
    `left rail width must stay compact (<=72px), got ${leftRailBox.width}`
  );

  if (consoleCount > 0) {
    const consolePanel = page.locator('[data-testid="ide-workbench-console"]').first();
    const consoleStateAttr = await consolePanel.getAttribute('data-console-state');
    const consoleClass = await consolePanel.getAttribute('class');
    const consoleState =
      consoleStateAttr ??
      (consoleClass?.includes('is-collapsed') ? 'collapsed' : consoleClass?.includes('is-expanded') ? 'expanded' : null);
    assert(
      consoleState === 'collapsed',
      `console should default to collapsed when empty, got state="${consoleState ?? ''}"`
    );
  }
});
