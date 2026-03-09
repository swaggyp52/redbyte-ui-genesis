#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE verify flow contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });

  // Empty state must be visible before run
  const emptyState = page.locator('[data-testid="ide-verify-empty-state"]').first();
  assert(await visible(emptyState), 'empty state must render before any run');

  // Signal list left dock renders
  const signalList = page.locator('[data-testid="ide-verify-signal-list"]').first();
  assert(await visible(signalList), 'signal list dock must render');

  // Generate basic vectors
  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();
  const vectorTable = page.locator('[data-testid="ide-verify-vectors-table"]').first();
  assert(await visible(vectorTable), 'vector table must render after generating basics');

  const vectorRows = await page
    .locator('[data-testid="ide-verify-vectors-table"] tbody tr')
    .filter({ has: page.locator('code') })
    .count();
  assert(vectorRows >= 3, `at least 3 vector rows must appear after generate basics, got ${vectorRows}`);

  // Run verification
  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const label = document.querySelector('[data-testid="ide-verify-summary-status"]');
      return Boolean(label && !/IDLE/i.test(label.textContent || ''));
    },
    { timeout: 10000 }
  );

  // Workbench (waveform area) must replace empty state
  const workbench = page.locator('[data-testid="ide-verify-workbench"]').first();
  assert(await visible(workbench), 'verify workbench must render after run');

  // Waveform panel must be present
  const waveformPanel = page.locator('[data-testid="ide-verify-workspace-waveform"]').first();
  assert(await visible(waveformPanel), 'waveform panel must render after run');

  // Status must not be IDLE
  const statusText = (
    await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')
  )?.trim();
  assert(
    Boolean(statusText && !/IDLE/i.test(statusText)),
    `status must not be IDLE after run, got "${statusText}"`
  );

  // Jump-to-first-fail button must exist (even if disabled)
  const jumpButton = page.locator('[data-testid="ide-verify-jump-first-fail"]').first();
  assert(await visible(jumpButton), 'jump-to-first-fail button must render after run');
});

