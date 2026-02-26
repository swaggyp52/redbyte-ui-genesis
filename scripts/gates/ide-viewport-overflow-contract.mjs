#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export', 'import'];

await runIdeGate('IDE viewport overflow contract satisfied', async ({ page, baseUrl }) => {
  // Set a standard classroom viewport
  await page.setViewportSize({ width: 1366, height: 768 });
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
});
