#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE design fit contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });

  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const fitButton = page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first();
  const centerSelectionButton = page.locator('[data-testid="ide-design-center-selection-canvas"]');
  const zoomPill = page.locator('[data-testid="ide-design-canvas-stat-zoom"]').first();
  assert(await visible(canvas), 'design canvas must be visible');
  assert(await visible(fitButton), 'fit-to-circuit control must be visible');
  assert((await centerSelectionButton.count()) > 0, 'center-selection control must exist');
  assert(await visible(zoomPill), 'zoom control indicator must be visible');

  const zoomText = await text(zoomPill);
  const zoomValue = Number.parseInt(zoomText.replace('%', ''), 10);
  assert(Number.isFinite(zoomValue), `zoom indicator should be numeric, got "${zoomText}"`);
  assert(
    zoomValue >= 45 && zoomValue <= 240,
    `default design zoom should be readable (${zoomValue}%)`
  );

  const occupancy = await page.evaluate(() => {
    const canvasEl = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const nodeEls = Array.from(document.querySelectorAll('[data-node-id]'));
    if (!canvasEl || nodeEls.length === 0) {
      return null;
    }
    const canvasRect = canvasEl.getBoundingClientRect();
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const node of nodeEls) {
      const rect = node.getBoundingClientRect();
      minX = Math.min(minX, rect.left);
      minY = Math.min(minY, rect.top);
      maxX = Math.max(maxX, rect.right);
      maxY = Math.max(maxY, rect.bottom);
    }
    if (!Number.isFinite(minX)) return null;
    const nodeWidth = Math.max(1, maxX - minX);
    const nodeHeight = Math.max(1, maxY - minY);
    return {
      widthRatio: nodeWidth / Math.max(1, canvasRect.width),
      heightRatio: nodeHeight / Math.max(1, canvasRect.height),
    };
  });

  assert(Boolean(occupancy), 'could not compute rendered node occupancy');
  assert(
    occupancy.widthRatio >= 0.22,
    `loaded example should be readable by width (${occupancy.widthRatio.toFixed(3)})`
  );
  assert(
    occupancy.heightRatio >= 0.16,
    `loaded example should be readable by height (${occupancy.heightRatio.toFixed(3)})`
  );

  await fitButton.evaluate((button) => button.click());
});

