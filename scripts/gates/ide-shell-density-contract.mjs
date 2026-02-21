#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE shell density contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  const topBar = page.locator('[data-testid="ide-top-bar"]').first();
  const leftRail = page.locator('[data-testid="ide-left-rail"]').first();
  const consolePanel = page.locator('[data-testid="ide-workbench-console"]').first();

  assert(await visible(topBar), 'top bar must be visible');
  assert(await visible(leftRail), 'left rail must be visible');
  assert(await visible(consolePanel), 'workbench console must be visible');

  const [topBarBox, leftRailBox, consoleBox] = await Promise.all([
    topBar.boundingBox(),
    leftRail.boundingBox(),
    consolePanel.boundingBox(),
  ]);

  assert(Boolean(topBarBox), 'top bar bounding box unavailable');
  assert(Boolean(leftRailBox), 'left rail bounding box unavailable');
  assert(Boolean(consoleBox), 'console bounding box unavailable');

  assert(topBarBox.height <= 52, `top bar must stay dense (<=52px), got ${topBarBox.height}`);
  assert(
    leftRailBox.width <= 72,
    `left rail width must stay compact (<=72px), got ${leftRailBox.width}`
  );

  const consoleStateAttr = await consolePanel.getAttribute('data-console-state');
  const consoleClass = await consolePanel.getAttribute('class');
  const consoleState =
    consoleStateAttr ??
    (consoleClass?.includes('is-collapsed') ? 'collapsed' : consoleClass?.includes('is-expanded') ? 'expanded' : null);
  assert(
    consoleState === 'collapsed',
    `console should default to collapsed when empty, got state="${consoleState ?? ''}"`
  );
  assert(
    consoleBox.height <= 52,
    `collapsed console height must stay compact (<=52px), got ${consoleBox.height}`
  );
});
