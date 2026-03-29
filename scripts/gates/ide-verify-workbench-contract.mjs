#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE verify workbench contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 10000 });

  await page.locator('[data-testid="ide-verify-run"]').click();
  await waitForVerifyResult(page, { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-workspace-waveform"]', { timeout: 10000 });
  await page.waitForFunction(
    () => {
      const signalButtons = document.querySelectorAll('[data-testid^="ide-verify-signal-"]').length;
      const showAll = document.querySelector('[data-testid="ide-verify-show-all-signals"]');
      return signalButtons > 0 || Boolean(showAll);
    },
    { timeout: 10000 }
  );

  const signalFilterState = page.locator('[data-testid="ide-verify-signal-filter-state"]').first();
  const signalFilterVisible = await signalFilterState.isVisible().catch(() => false);
  if (!signalFilterVisible) {
    const leftDockToggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
    const leftDockToggleVisible = await leftDockToggle.isVisible().catch(() => false);
    if (leftDockToggleVisible) {
      await leftDockToggle.click();
      await signalFilterState.waitFor({ state: 'visible', timeout: 10000 });
    }
  }

  const filterState = (
    (await signalFilterState.textContent().catch(() => '')) ??
    ''
  ).toLowerCase();
  assert(
    filterState.includes('relevant'),
    `verify signal list must default to relevant signals, got "${filterState}"`
  );

  const signalRowsBefore = await page.locator('[data-testid^="ide-verify-signal-"]').count();
  const showAllButton = page.locator('[data-testid="ide-verify-show-all-signals"]').first();
  const showAllButtonVisible = await showAllButton.isVisible().catch(() => false);
  if (showAllButtonVisible) {
    await showAllButton.click();
    await page.waitForTimeout(150);
    const signalRowsAfter = await page.locator('[data-testid^="ide-verify-signal-"]').count();
    assert(
      signalRowsAfter >= signalRowsBefore,
      `showing all signals must not reduce signal rows (before=${signalRowsBefore}, after=${signalRowsAfter})`
    );
  } else {
    assert(signalRowsBefore > 0, 'verify signal list must include at least one visible signal row');
  }

  const centerBounds = await page.locator('[data-testid="ide-mode-body"]').boundingBox();
  const waveformBounds = await page
    .locator('[data-testid="ide-verify-workspace-waveform"]')
    .boundingBox();
  assert(Boolean(centerBounds), 'verify workspace center region must be measurable');
  assert(Boolean(waveformBounds), 'verify waveform region must be measurable');
  const centerArea = (centerBounds?.width ?? 0) * (centerBounds?.height ?? 0);
  const waveformArea = (waveformBounds?.width ?? 0) * (waveformBounds?.height ?? 0);
  assert(
    centerArea > 0 && waveformArea >= centerArea * 0.25,
    `verify waveform workspace must remain meaningfully visible (wave=${waveformArea}, center=${centerArea})`
  );

  const tabBar = page.locator('[data-testid="ide-verify-tab-bar"]').first();
  const tabBarVisible = await tabBar.isVisible().catch(() => false);
  if (!tabBarVisible) {
    await page.locator('[data-testid="ide-verify-drawer-toggle"]').click();
    await page.waitForSelector('[data-testid="ide-verify-tab-bar"]', { timeout: 10000 });
  }

  const mismatchRows = page.locator('[data-testid="ide-verify-mismatch-list"] tbody tr');
  const mismatchCount = await mismatchRows.count();
  if (mismatchCount > 0) {
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
  }
});
