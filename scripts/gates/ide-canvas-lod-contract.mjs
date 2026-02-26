#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE canvas LOD contract satisfied', async ({ page, baseUrl }) => {
  // Load example to get nodes on canvas
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.locator('[data-testid="ide-project-load-start-logic-gates"]').click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });
  await page.waitForTimeout(300);

  // Verify default LOD is full (zoom ~ 1.0)
  const defaultLod = await page
    .locator('[data-node-id]').first()
    .getAttribute('data-lod').catch(() => null);
  assert(defaultLod === 'full', `default lod must be "full", got "${defaultLod}"`);

  // Use preset zoom controls (always visible) to drive LOD transitions.
  await page.locator('[data-testid="ide-design-zoom-preset-50"]').click();
  await page.waitForTimeout(120);
  const lodAfterZoomOut = await page
    .locator('[data-node-id]').first()
    .getAttribute('data-lod').catch(() => null);
  assert(
    lodAfterZoomOut === 'minimal' || lodAfterZoomOut === 'compact',
    `lod must reduce after zooming out, stopped at "${lodAfterZoomOut}"`
  );

  await page.locator('[data-testid="ide-design-zoom-preset-125"]').click();
  await page.waitForTimeout(120);
  const lodAfterZoomIn = await page
    .locator('[data-node-id]').first()
    .getAttribute('data-lod').catch(() => null);
  assert(
    lodAfterZoomIn === 'full',
    `lod must return to "full" after zooming in, stopped at "${lodAfterZoomIn}"`
  );
});

