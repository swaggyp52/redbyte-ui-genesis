#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE verify workbench contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 10000 });

  const headerRun = page.locator('[data-testid="ide-vcb-run"]').first();
  const legacyRun = page.locator('[data-testid="ide-verify-run"]').first();
  const canUseHeaderRun = await headerRun.isVisible().catch(() => false);
  if (canUseHeaderRun) {
    await headerRun.click();
  } else {
    await legacyRun.click();
  }
  await waitForVerifyResult(page, { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-workspace-waveform"]', { timeout: 10000 });

  const editableExpectedCell = page.locator('[data-testid^="ide-stimulus-expected-"]').first();
  const editableExpectedCellVisible = await editableExpectedCell.isVisible().catch(() => false);
  assert(editableExpectedCellVisible, 'verify must keep at least one expected-output cell visible after a run');

  const expectedTitleBefore = await editableExpectedCell.getAttribute('title');
  await editableExpectedCell.scrollIntoViewIfNeeded();
  await editableExpectedCell.click();
  await page.waitForTimeout(150);
  const expectedTitleAfter = await editableExpectedCell.getAttribute('title');
  assert(
    expectedTitleBefore !== expectedTitleAfter,
    `post-run expected-output cells must remain directly editable (before=${expectedTitleBefore}, after=${expectedTitleAfter})`
  );

  const rerunCompare = page.locator('[data-testid="ide-vcb-run"]').first();
  await rerunCompare.click();
  await waitForVerifyResult(page, { timeout: 10000 });

  const failureSummary = page.locator('[data-testid="ide-verify-summary-status"]').first();
  const failureSummaryText = (
    (await failureSummary.textContent().catch(() => '')) ??
    ''
  ).toUpperCase();
  assert(
    failureSummaryText.includes('ASSERTIONS DIFFER'),
    `rerunning after changing an expected cell must surface a failed compare state, got "${failureSummaryText}"`
  );

  const workbenchBody = page.locator('[data-testid="ide-verify-workbench-body"]').first();
  assert(
    await workbenchBody.isVisible().catch(() => false),
    'failed compare runs must keep the Stimulus Workbench body visible'
  );

  const inlineFailureLeft = page.locator('[data-testid="ide-verify-three-panel-left"]').first();
  const inlineFailureRight = page.locator('[data-testid="ide-verify-three-panel-right"]').first();
  assert(
    !(await inlineFailureLeft.isVisible().catch(() => false)),
    'failed compare runs must not keep an inline left failure rail in the primary waveform workspace'
  );
  assert(
    !(await inlineFailureRight.isVisible().catch(() => false)),
    'failed compare runs must not keep an inline right failure rail in the primary waveform workspace'
  );

  const waveformToolsToggle = page.locator('[data-testid="ide-verify-waveform-tools-toggle"]').first();
  assert(
    await waveformToolsToggle.isVisible().catch(() => false),
    'failed compare runs must keep the waveform tools disclosure visible'
  );
  assert(
    !(await page.locator('[data-testid="ide-verify-waveform-tools-panel"]').first().isVisible().catch(() => false)),
    'advanced waveform tools must stay hidden until explicitly opened'
  );
  assert(
    !(await page.locator('[data-testid="ide-verify-set-cursor-a"]').first().isVisible().catch(() => false)),
    'cursor tools must stay out of the primary evidence strip by default'
  );
  await waveformToolsToggle.click();
  await page.waitForSelector('[data-testid="ide-verify-waveform-tools-panel"]', { timeout: 10000 });
  assert(
    await page.locator('[data-testid="ide-verify-set-cursor-a"]').first().isVisible().catch(() => false),
    'opening waveform tools must reveal cursor controls'
  );
  await waveformToolsToggle.click();
  await page.waitForTimeout(100);

  // After a PASS run the left dock is collapsed and signal buttons are not in the DOM.
  // Open the dock first, then verify its contents.
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

  const signalFilterVisibleAfterToggle = await signalFilterState.isVisible().catch(() => false);
  if (signalFilterVisibleAfterToggle) {
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
  }

  const centerBounds = await page.locator('[data-testid="ide-mode-body"]').boundingBox();
  const panelBodyBounds = await page.locator('[data-testid="ide-verify-panel"] .ide-panel-body').boundingBox();
  const workspaceBounds = await page.locator('[data-testid="ide-verify-workspace"]').boundingBox();
  const waveformBounds = await page
    .locator('[data-testid="ide-verify-workspace-waveform"]')
    .boundingBox();
  const bannerBounds = await page.locator('[data-testid="ide-verify-banner"]').boundingBox();
  const commandBarBounds = await page.locator('[data-testid="ide-verify-command-bar"]').boundingBox();
  assert(Boolean(centerBounds), 'verify workspace center region must be measurable');
  assert(Boolean(panelBodyBounds), 'verify panel body must be measurable');
  assert(Boolean(workspaceBounds), 'verify workspace must be measurable');
  assert(Boolean(waveformBounds), 'verify waveform region must be measurable');
  const centerArea = (centerBounds?.width ?? 0) * (centerBounds?.height ?? 0);
  const waveformArea = (waveformBounds?.width ?? 0) * (waveformBounds?.height ?? 0);
  assert(
    centerArea > 0 && waveformArea >= centerArea * 0.25,
    `verify waveform workspace must remain meaningfully visible (wave=${waveformArea}, center=${centerArea})`
  );
  assert(
    (workspaceBounds?.width ?? 0) >= (panelBodyBounds?.width ?? 0) * 0.85,
    `verify workspace must own most of the panel width at desktop sizes (workspace=${workspaceBounds?.width ?? 0}, panel=${panelBodyBounds?.width ?? 0})`
  );
  assert(
    ((bannerBounds?.height ?? 0) + (commandBarBounds?.height ?? 0)) <= 72,
    `verify top chrome must stay compact at desktop sizes (banner=${bannerBounds?.height ?? 0}, command=${commandBarBounds?.height ?? 0})`
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
