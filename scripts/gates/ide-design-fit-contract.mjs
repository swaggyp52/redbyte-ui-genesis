#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE design fit contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const fitButton = page.locator('[data-testid="ide-design-fit-circuit"]').first();
  const zoomPill = page.locator('[data-testid="ide-design-command-zoom"]').first();
  assert(await visible(canvas), 'design canvas must be visible');
  assert(await visible(fitButton), 'fit-to-circuit control must be visible');
  assert(await visible(zoomPill), 'zoom control indicator must be visible');

  await page.locator('[data-testid="ide-design-add-and-starter"]').click();
  await fitButton.click();

  const [rootBox, canvasBox] = await Promise.all([
    page.locator('[data-testid="ide-mode-design"]').first().boundingBox(),
    canvas.boundingBox(),
  ]);
  assert(Boolean(rootBox), 'design mode bounds unavailable');
  assert(Boolean(canvasBox), 'design canvas bounds unavailable');

  const widthRatio = canvasBox.width / rootBox.width;
  const heightRatio = canvasBox.height / rootBox.height;
  assert(widthRatio >= 0.42, `design canvas should remain dominant by width (${widthRatio.toFixed(3)})`);
  assert(heightRatio >= 0.24, `design canvas should remain dominant by height (${heightRatio.toFixed(3)})`);
});
