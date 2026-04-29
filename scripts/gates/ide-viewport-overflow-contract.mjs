#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export'];

await runIdeGate('IDE viewport overflow contract satisfied', async ({ page, baseUrl }) => {
  // Set a standard classroom viewport
  await page.setViewportSize({ width: 1366, height: 768 });
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  for (const mode of MODES) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });

    // Check for horizontal overflow: scrollWidth should not exceed clientWidth
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    assert(
      scrollWidth <= clientWidth,
      `mode=${mode} has horizontal overflow: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`
    );

    // Check that the workbench main area (or surface shell) is visible and not zero size
    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
    const bbox = await modeRoot.boundingBox();
    assert(
      bbox !== null && bbox.width > 100 && bbox.height > 100,
      `mode=${mode} surface has insufficient bounds: ${JSON.stringify(bbox)}`
    );
  }

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.locator('[data-testid="ide-project-import-primary"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert(
    scrollWidth <= clientWidth,
    `mode=import has horizontal overflow: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`
  );
  const importRoot = page.locator('[data-testid="ide-mode-import"]').first();
  const bbox = await importRoot.boundingBox();
  assert(
    bbox !== null && bbox.width > 100 && bbox.height > 100,
    `mode=import surface has insufficient bounds: ${JSON.stringify(bbox)}`
  );
});
