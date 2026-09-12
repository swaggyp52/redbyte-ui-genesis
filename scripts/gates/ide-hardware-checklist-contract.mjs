#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE hardware checklist contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });
  // Board Check is the board-side checklist: it walks the recorded vectors step by step at the
  // board, or offers to generate them. Pre-flight - a fourth mode that restated Package's trust
  // state and the Vivado handoff here - is retired; that reading belongs to Build & Export.
  await page.locator('[data-testid="ide-hw-mode-btn-bringup"]').click();

  const checklist = page.locator('[data-testid="ide-hw-bringup-dock"]');
  const stepOrGenerate = page
    .locator('[data-testid="ide-hw-bringup-step"], [data-testid="ide-hw-bringup-generate"]')
    .first();
  const ifWrong = page.locator('[data-testid="ide-hw-mode-toggle"]');

  assert(await visible(checklist), 'hardware checklist panel must render');
  assert(
    await visible(stepOrGenerate),
    'hardware checklist must show a step to perform or the way to generate its vectors',
  );
  assert(await visible(ifWrong), 'hardware if-wrong panel must render');
});
