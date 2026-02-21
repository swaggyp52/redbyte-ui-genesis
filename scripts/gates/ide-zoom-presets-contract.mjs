#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE zoom presets contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  // Zoom preset strip must be present
  const strip = page.locator('[data-testid="ide-design-zoom-presets"]').first();
  const stripBox = await strip.boundingBox();
  assert(stripBox !== null, 'zoom preset strip must be visible');

  // All 4 numeric presets must be present
  for (const pct of [50, 75, 100, 125]) {
    const btn = page.locator(`[data-testid="ide-design-zoom-preset-${pct}"]`).first();
    const box = await btn.boundingBox();
    assert(box !== null, `zoom preset button ${pct}% must be visible`);
  }

  // Fit preset must be present
  const fitBtn = page.locator('[data-testid="ide-design-zoom-preset-fit"]').first();
  const fitBox = await fitBtn.boundingBox();
  assert(fitBox !== null, 'zoom preset Fit button must be visible');

  // Click 50% — zoom indicator should reflect change
  await page.locator('[data-testid="ide-design-zoom-preset-50"]').click();
  await page.waitForTimeout(150);
  const zoomText50 = await page
    .locator('[data-testid="ide-design-zoom-indicator"]').first().textContent().catch(() => '');
  // zoomPercent rounds to nearest integer; 50% = zoom 0.5 = "50%"
  assert(
    (zoomText50 ?? '').includes('50'),
    `after clicking 50%, zoom indicator should show 50, got "${zoomText50}"`
  );

  // Click 100% — zoom indicator should reflect change
  await page.locator('[data-testid="ide-design-zoom-preset-100"]').click();
  await page.waitForTimeout(150);
  const zoomText100 = await page
    .locator('[data-testid="ide-design-zoom-indicator"]').first().textContent().catch(() => '');
  assert(
    (zoomText100 ?? '').includes('100'),
    `after clicking 100%, zoom indicator should show 100, got "${zoomText100}"`
  );
});
