#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE design build-fast contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  await page.locator('[data-testid="ide-design-board-input-sw0"]').click();
  await page.locator('[data-testid="ide-design-board-input-sw1"]').click();
  await page.locator('[data-testid="ide-design-board-output-ld0"]').click();
  const paletteToast = await text(page.locator('[data-testid="ide-design-action-toast"]'));
  assert(
    paletteToast.toLowerCase().includes('added'),
    'board-first palette should confirm node insertion via toast'
  );

  const startWire = page.locator('[data-testid="ide-design-tool-wire"]');
  assert(await visible(startWire), 'start wire shortcut control must be visible');
  await startWire.click();
  const wireCue = page.locator('[data-testid="ide-design-wire-cue"]');
  assert(await visible(wireCue), 'wire cue must appear when wire mode is active');

  await page.locator('[data-testid="ide-design-add-and-starter"]').click();
  await page.waitForSelector('[data-testid^="switch-toggle-"]', { timeout: 10000 });

  const toggles = page.locator('[data-testid^="switch-toggle-"]:not([data-testid$="-container"])');
  const toggleCount = await toggles.count();
  assert(toggleCount >= 2, `expected at least two switch toggles, got ${toggleCount}`);
  await toggles.nth(0).click();
  await toggles.nth(1).click();
  await page.waitForSelector('[data-testid^="ide-design-live-output-"]', { timeout: 10000 });

  const lastChange = await text(page.locator('[data-testid="ide-design-last-change"]'));
  assert(lastChange.includes('='), 'last-change line must include computed value summary');
  assert(lastChange.toLowerCase().includes('from'), 'last-change line must include source explanation');
});

