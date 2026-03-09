#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export', 'import'];

await runIdeGate('IDE layout contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  const leftRail = page.locator('[data-testid="ide-left-rail"]').first();
  assert(await visible(leftRail), 'left rail must be visible');
  const initialBox = await leftRail.boundingBox();
  assert(Boolean(initialBox), 'left rail bounds unavailable');
  assert(
    initialBox.width >= 48 && initialBox.width <= 60,
    `left rail width out of contract range: ${initialBox.width}px`
  );

  for (const mode of MODES) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 10000 });
    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
    const marker = await modeRoot.getAttribute('data-ide-mode-marker');
    assert(marker === mode, `mode marker mismatch for ${mode}: ${marker}`);

    assert(await visible(modeRoot.locator('[data-testid="ide-left-dock"]')), `mode=${mode} missing left dock`);
    assert(await visible(modeRoot.locator('[data-testid="ide-mode-body"]')), `mode=${mode} missing workspace`);
    const consoleLocator = modeRoot.locator('[data-testid="ide-workbench-console"]').first();
    const consoleCount = await modeRoot.locator('[data-testid="ide-workbench-console"]').count();
    assert(consoleCount === 1, `mode=${mode} missing console`);
    const consoleState = await consoleLocator.getAttribute('data-console-state');
    assert(
      consoleState === 'collapsed' || consoleState === 'expanded' || consoleState === 'blocking',
      `mode=${mode} unexpected console state "${consoleState ?? ''}"`
    );

    const railBox = await leftRail.boundingBox();
    assert(Boolean(railBox), `left rail bounds unavailable in mode=${mode}`);
    assert(
      Math.abs(railBox.width - initialBox.width) <= 2,
      `left rail width drifted in mode=${mode}: ${railBox.width}px`
    );
  }
});
