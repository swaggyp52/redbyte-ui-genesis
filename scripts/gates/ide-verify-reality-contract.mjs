#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE verify reality contract satisfied', async ({ page, baseUrl }) => {
  // ── 1. Load AND gate example ──────────────────────────────────────────────
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await page.locator('[data-testid="ide-project-open-example-and-gate-basics"]').click();
  const confirmBtn = page.locator('[data-testid="ide-example-confirm"]');
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
  }
  await page.waitForSelector('[data-testid="ide-guided-strip"]', { timeout: 10000 });

  // ── 2. Navigate to Verify ─────────────────────────────────────────────────
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  // ── 3. Generate basics and run ────────────────────────────────────────────
  // Use the inspector-level Generate Basics button (always visible)
  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();

  const vectorTable = page.locator('[data-testid="ide-verify-vectors-table"]').first();
  assert(await visible(vectorTable), 'vector table must appear after Generate Basics');

  // Run button must be enabled now that vectors exist
  const runBtn = page.locator('[data-testid="ide-verify-run"]').first();
  const runDisabled = await runBtn.getAttribute('disabled').catch(() => null);
  assert(runDisabled === null, 'Run button must be enabled after generating basics');

  await runBtn.click();

  // Wait for non-IDLE status
  await page.waitForFunction(
    () => {
      const label = document.querySelector('[data-testid="ide-verify-status-label"]');
      return Boolean(label && !/IDLE/i.test(label.textContent || ''));
    },
    { timeout: 15000 }
  );

  // ── 4. Assert PASS or FAIL (not IDLE) ─────────────────────────────────────
  const statusLabel = (
    await page
      .locator('[data-testid="ide-verify-status-label"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  assert(
    /PASS|FAIL/i.test(statusLabel),
    `verify status must be PASS or FAIL after run, got "${statusLabel}"`
  );

  // ── 5. Assert waveform ≥8 points ─────────────────────────────────────────
  const waveformGrid = page.locator('[data-testid="ide-verify-waveform-grid"]').first();
  assert(await visible(waveformGrid), 'waveform grid must be visible after run');

  const waveformPoints = await page
    .locator('[data-testid="ide-verify-waveform-point"]')
    .count()
    .catch(() => 0);
  assert(
    waveformPoints >= 8,
    `waveform must have ≥8 tick points, got ${waveformPoints}`
  );

  // ── 6. Assert signal list ≥1 row ─────────────────────────────────────────
  const signalList = page.locator('[data-testid="ide-verify-signal-list"]').first();
  assert(await visible(signalList), 'signal list must be visible after run');

  const signalRows = await page
    .locator('[data-testid^="ide-verify-signal-"]')
    .count()
    .catch(() => 0);
  assert(
    signalRows >= 1,
    `signal list must have ≥1 row, got ${signalRows}`
  );
});
