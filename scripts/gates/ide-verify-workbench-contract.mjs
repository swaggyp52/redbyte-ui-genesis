#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE verify workbench contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 10000 });

  await page.locator('[data-testid="ide-verify-vector-fail"]').click();
  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const label = document.querySelector('[data-testid="ide-verify-status-label"]');
      return Boolean(label && /FAIL/i.test(label.textContent || ''));
    },
    { timeout: 10000 }
  );
  await page.waitForSelector('[data-testid="ide-verify-workspace-waveform"]', { timeout: 10000 });

  const filterState = (
    (await page.locator('[data-testid="ide-verify-signal-filter-state"]').first().textContent().catch(() => '')) ??
    ''
  ).toLowerCase();
  assert(
    filterState.includes('relevant'),
    `verify signal list must default to relevant signals, got "${filterState}"`
  );

  const signalRowsBefore = await page.locator('[data-testid="ide-verify-signal-list"] button').count();
  const showAllButtonVisible = await page
    .locator('[data-testid="ide-verify-show-all-signals"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(showAllButtonVisible, 'verify signal list must expose Show all signals toggle');
  await page.locator('[data-testid="ide-verify-show-all-signals"]').click();
  const signalRowsAfter = await page.locator('[data-testid="ide-verify-signal-list"] button').count();
  assert(
    signalRowsAfter >= signalRowsBefore,
    `showing all signals must not reduce signal rows (before=${signalRowsBefore}, after=${signalRowsAfter})`
  );

  const centerBounds = await page.locator('[data-testid="ide-mode-body"]').boundingBox();
  const waveformBounds = await page
    .locator('[data-testid="ide-verify-workspace-waveform"]')
    .boundingBox();
  assert(Boolean(centerBounds), 'verify workspace center region must be measurable');
  assert(Boolean(waveformBounds), 'verify waveform region must be measurable');
  const centerArea = (centerBounds?.width ?? 0) * (centerBounds?.height ?? 0);
  const waveformArea = (waveformBounds?.width ?? 0) * (waveformBounds?.height ?? 0);
  assert(
    centerArea > 0 && waveformArea >= centerArea * 0.35,
    `verify waveform workspace must dominate center area (wave=${waveformArea}, center=${centerArea})`
  );

  const tickCursorVisible = await page
    .locator('[data-testid="ide-verify-tick-scrubber"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(tickCursorVisible, 'verify tick cursor must be visible after a run');

  const vectorEditorVisible = await page
    .locator('[data-testid="ide-verify-add-vector-form"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(vectorEditorVisible, 'verify vector editor must render in workbench inspector');

  const mismatchRows = page.locator('[data-testid^="ide-verify-mismatch-row-"]');
  const mismatchCount = await mismatchRows.count();
  assert(mismatchCount > 0, 'verify mismatch table must render failing rows');

  const firstMismatchTick = (
    (await mismatchRows.first().locator('button').first().textContent().catch(() => '')) ?? ''
  ).trim();
  assert(firstMismatchTick.length > 0, 'verify mismatch rows must expose jump-to-tick control');
  await mismatchRows.first().locator('button').first().click();

  const selectedTick = (
    (await page.locator('[data-testid="ide-verify-selected-tick"]').first().textContent().catch(() => '')) ??
    ''
  ).trim();
  assert(
    selectedTick === firstMismatchTick,
    `clicking mismatch row must move tick cursor (expected ${firstMismatchTick}, got ${selectedTick})`
  );

  await page.locator('[data-testid="ide-verify-vector-pass"]').click();
  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const label = document.querySelector('[data-testid="ide-verify-status-label"]');
      return Boolean(label && /PASS/i.test(label.textContent || ''));
    },
    { timeout: 10000 }
  );

  const exportDisabled = await page
    .locator('[data-testid="ide-verify-export-testbench"]')
    .first()
    .isDisabled();
  assert(!exportDisabled, 'verify export-testbench must be enabled only after PASS run');
});
