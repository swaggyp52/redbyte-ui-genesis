#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function waitForCondition(page, label, predicate, arg, timeout = 10000) {
  try {
    if (arg === undefined) {
      await page.waitForFunction(predicate, { timeout });
    } else {
      await page.waitForFunction(predicate, arg, { timeout });
    }
  } catch {
    throw new Error(`timed out waiting for condition: ${label}`);
  }
}

await runIdeGate('IDE persistence contract satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  // Suppress first-visit onboarding.
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const beforeNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? 0;
  });
  await page.locator('[data-testid="ide-design-palette-input"]').first().click();
  await waitForCondition(
    page,
    'design placement mode activation in persistence gate',
    () => {
      const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
      return canvas?.getAttribute('data-placement-active') === '1';
    },
    undefined,
    10000
  );

  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), 'design canvas bounds unavailable for persistence mutation');
  await page.mouse.click(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.45);

  await waitForCondition(
    page,
    'design node count increase in persistence gate',
    (before) => {
      const store = window.__RB_CIRCUIT_STORE__;
      const nodes = store?.getState?.().circuit?.nodes?.length ?? 0;
      return nodes > before;
    },
    beforeNodeCount,
    10000
  );

  const afterNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? 0;
  });
  assert(afterNodeCount > beforeNodeCount, 'design mutation should increase node count');

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const hashBeforeReload = await text(page.locator('[data-testid="ide-project-hash-short"]'));
  assert(hashBeforeReload.length > 0, 'project hash should be visible before reload');

  await page.waitForTimeout(400);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);

  const projectModeVisibleAfterReload = await page
    .locator('[data-testid="ide-mode-project"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (!projectModeVisibleAfterReload) {
    await page.locator('[data-testid="mode-button-project"]').click();
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  }

  const hashAfterReload = await text(page.locator('[data-testid="ide-project-hash-short"]'));
  assert(hashAfterReload.length > 0, 'project hash should be visible after reload');

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  const persistedNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? 0;
  });
  assert(
    persistedNodeCount === afterNodeCount,
    `mutated design should persist across reload (expected ${afterNodeCount}, got ${persistedNodeCount})`
  );
});
