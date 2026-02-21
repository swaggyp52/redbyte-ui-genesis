#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE canvas LOD contract satisfied', async ({ page, baseUrl }) => {
  // Load example to get nodes on canvas
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.locator('[data-testid="ide-project-open-example-and-gate-basics"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });
  await page.waitForTimeout(300);

  // Verify default LOD is full (zoom ~ 1.0)
  const defaultLod = await page
    .locator('[data-node-id]').first()
    .getAttribute('data-lod').catch(() => null);
  assert(defaultLod === 'full', `default lod must be "full", got "${defaultLod}"`);

  // Zoom out until data-lod becomes 'minimal' (or max 25 clicks)
  let lodAfterZoomOut = defaultLod;
  for (let i = 0; i < 25 && lodAfterZoomOut !== 'minimal'; i++) {
    await page.locator('[data-testid="ide-design-zoom-out"]').click();
    await page.waitForTimeout(50);
    lodAfterZoomOut = await page
      .locator('[data-node-id]').first()
      .getAttribute('data-lod').catch(() => null);
  }
  assert(
    lodAfterZoomOut === 'minimal',
    `lod must reach "minimal" after zooming out, stopped at "${lodAfterZoomOut}"`
  );

  // Zoom back in until data-lod becomes 'full' (or max 25 clicks)
  let lodAfterZoomIn = lodAfterZoomOut;
  for (let i = 0; i < 25 && lodAfterZoomIn !== 'full'; i++) {
    await page.locator('[data-testid="ide-design-zoom-in"]').click();
    await page.waitForTimeout(50);
    lodAfterZoomIn = await page
      .locator('[data-node-id]').first()
      .getAttribute('data-lod').catch(() => null);
  }
  assert(
    lodAfterZoomIn === 'full',
    `lod must return to "full" after zooming in, stopped at "${lodAfterZoomIn}"`
  );
});
