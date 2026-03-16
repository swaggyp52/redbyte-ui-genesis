#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE design placement contract satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-palette-and"]', { timeout: 10000 });

  const baselineNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? -1;
  });
  assert(baselineNodeCount >= 0, 'baseline node count unavailable');

  await page.locator('[data-testid="ide-design-palette-and"]').first().click();

  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    return canvas?.getAttribute('data-placement-active') === '1';
  }, { timeout: 5000 });

  const cueText = (await page.locator('[data-testid="ide-design-placement-cue"]').textContent()) ?? '';
  assert(cueText.toLowerCase().includes('and'), `expected AND placement cue, got: ${cueText}`);

  const afterPaletteClickCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? -1;
  });
  assert(
    afterPaletteClickCount === baselineNodeCount,
    `palette click should not spawn immediately (${baselineNodeCount} -> ${afterPaletteClickCount})`
  );

  await page.keyboard.press('Escape');

  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    return canvas?.getAttribute('data-placement-active') === '0';
  }, { timeout: 5000 });

  const afterEscapeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? -1;
  });
  assert(afterEscapeCount === baselineNodeCount, 'Escape should cancel placement without mutating the circuit');

  await page.locator('[data-testid="ide-design-palette-input"]').first().click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    return canvas?.getAttribute('data-placement-active') === '1';
  }, { timeout: 5000 });

  const canvas = page.locator('[data-testid="ide-design-live-canvas"]');
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), 'design canvas bounds unavailable for placement click');
  await page.mouse.click(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.45);

  await page.waitForFunction(
    (expectedCount) => {
      const store = window.__RB_CIRCUIT_STORE__;
      const canvasEl = document.querySelector('[data-testid="ide-design-live-canvas"]');
      if (!store?.getState || !canvasEl) return false;
      const selection = window.__RB_LOGIC_VIEW_STORE__?.getState?.().selection?.nodes;
      return (
        (store.getState().circuit?.nodes?.length ?? -1) >= expectedCount &&
        canvasEl.getAttribute('data-placement-active') === '0' &&
        selection instanceof Set &&
        selection.size === 1
      );
    },
    baselineNodeCount + 1,
    { timeout: 5000 }
  );
});
