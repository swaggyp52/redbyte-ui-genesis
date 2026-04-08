#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE canvas LOD contract satisfied', async ({ page, baseUrl }) => {
  // Load example to get nodes on canvas
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { preferredLabStarterTestId: 'ide-project-landing-example-logic-gates' });
  await page.waitForTimeout(500);
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });
  await page.waitForTimeout(300);

  // The starter opens in a dense desktop view. It must still render a readable node shell,
  // and the explicit zoom presets must continue to move between minimal and full detail.
  const defaultLod = await page
    .locator('[data-node-id]').first()
    .getAttribute('data-lod').catch(() => null);
  assert(
    defaultLod === 'compact' || defaultLod === 'full',
    `default lod must start in a readable state, got "${defaultLod}"`
  );

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

  await page.locator('[data-testid="ide-design-zoom-preset-100"]').click();
  await page.waitForTimeout(120);
  const lodAfterZoomIn = await page
    .locator('[data-node-id]').first()
    .getAttribute('data-lod').catch(() => null);
  assert(
    lodAfterZoomIn === 'full',
    `lod must return to "full" after zooming in, stopped at "${lodAfterZoomIn}"`
  );
});

