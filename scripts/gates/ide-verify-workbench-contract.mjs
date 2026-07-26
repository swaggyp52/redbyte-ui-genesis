#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  saveObservedOutputs,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function hasVisibleExactText(page, value) {
  return page.getByText(value, { exact: true }).evaluateAll((elements) =>
    elements.some((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 1 &&
        rect.height > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || '1') !== 0
      );
    })
  );
}

await runIdeGate('IDE verify workbench contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await Promise.race([
    page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 }),
    page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 10000 }),
  ]);
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 10000 });

  await setVerifyRunMode(page, 'observe');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-workspace-waveform"]', { timeout: 10000 });

  let editableExpectedCell = page.locator('[data-testid^="ide-stimulus-expected-"]').first();
  let editableExpectedCellVisible = await editableExpectedCell.isVisible().catch(() => false);
  if (!editableExpectedCellVisible) {
    const initialSummaryText = (
      (await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')) ??
      ''
    ).toUpperCase();
    assert(
      initialSummaryText.includes('OBSERVATION ONLY') || initialSummaryText.includes('STIMULUS ONLY'),
      `verify default runs without expected-output cells must stay observation-first, got "${initialSummaryText}"`
    );

    const saveExpectedSelector = await saveObservedOutputs(page);
    assert(
      saveExpectedSelector,
      'observation-first runs must expose Save observed outputs so checks can be added secondarily'
    );
    await page.waitForTimeout(200);

    const checksToggle = page.locator('[data-testid="ide-stimulus-checks-toggle"]').first();
    assert(
      await checksToggle.isVisible().catch(() => false),
      'observation-first runs must expose Edit checks so saved output checks can be reviewed secondarily'
    );
    await checksToggle.click();
    await page.waitForTimeout(150);

    editableExpectedCell = page.locator('[data-testid^="ide-stimulus-expected-"]').first();
    editableExpectedCellVisible = await editableExpectedCell.isVisible().catch(() => false);
  }
  assert(editableExpectedCellVisible, 'verify must expose an editable expected-output cell after checks are saved');
  assert(
    await hasVisibleExactText(page, 'Expected · Unset = no check'),
    'verify student flow must explain that an unset expected value creates no Compare check'
  );
  const verifyPanelText = ((await page.locator('[data-testid="ide-verify-panel"]').textContent()) ?? '').toLowerCase();
  for (const stalePhrase of ['manual assertions', 'output assertions (optional)', 'assertion-backed']) {
    assert(
      !verifyPanelText.includes(stalePhrase),
      `verify primary student path must not surface stale wording "${stalePhrase}"`
    );
  }
  assert(
    await page.locator('[data-testid="ide-vcb-use-saved-checks"]').first().isVisible().catch(() => false),
    'verify command deck must expose Compare checks in the student flow'
  );

  const leftDock = page.locator('[data-testid="ide-left-dock"]').first();
  const leftDockVisible = await leftDock.isVisible().catch(() => false);
  assert(!leftDockVisible, 'verify must start on the collapsed signals rail, not an expanded left dock');
  assert(
    await page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first().isVisible().catch(() => false),
    'verify must keep a collapsed left rail toggle visible by default'
  );
  assert(
    !(await page.locator('[data-testid="ide-workbench-dock-toggle-right"]').first().isVisible().catch(() => false)),
    'verify must keep secondary analysis out of the shell rails by default'
  );

  const expectedTitleBefore = await editableExpectedCell.getAttribute('title');
  await editableExpectedCell.scrollIntoViewIfNeeded();
  await editableExpectedCell.click();
  await page.waitForTimeout(150);
  const expectedTitleAfter = await editableExpectedCell.getAttribute('title');
  assert(
    expectedTitleBefore !== expectedTitleAfter,
    `post-run expected-output cells must remain directly editable (before=${expectedTitleBefore}, after=${expectedTitleAfter})`
  );

  assert(
    await setVerifyRunMode(page, 'compare'),
    'verify must allow switching from Observe only to Compare checks after expected outputs are saved'
  );
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 10000 });

  const failureSummary = page.locator('[data-testid="ide-verify-summary-status"]').first();
  const failureSummaryText = (
    (await failureSummary.textContent().catch(() => '')) ??
    ''
  ).toUpperCase();
  assert(
    failureSummaryText.includes('ASSERTIONS DIFFER') || failureSummaryText.includes('CHECKS NEED REVIEW'),
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

  const centerBounds = await page.locator('[data-testid="ide-mode-body"]').boundingBox();
  const panelBodyBounds = await page.locator('[data-testid="ide-verify-panel"] .ide-panel-body').boundingBox();
  const workspaceBounds = await page.locator('[data-testid="ide-verify-workspace"]').boundingBox();
  const waveformBounds = await page
    .locator('[data-testid="ide-verify-workspace-waveform"]')
    .boundingBox();
  const waveformPreviewBounds = await page
    .locator('[data-testid="ide-verify-waveform-preview"]')
    .boundingBox();
  const bannerLocator = page.locator('[data-testid="ide-verify-banner"]').first();
  const bannerVisible = await bannerLocator.isVisible().catch(() => false);
  const bannerBounds = bannerVisible ? await bannerLocator.boundingBox() : null;
  const commandBarBounds = await page.locator('[data-testid="ide-verify-command-bar"]').boundingBox();
  assert(Boolean(centerBounds), 'verify workspace center region must be measurable');
  assert(Boolean(panelBodyBounds), 'verify panel body must be measurable');
  assert(Boolean(workspaceBounds), 'verify workspace must be measurable');
  assert(Boolean(waveformBounds), 'verify waveform region must be measurable');
  assert(Boolean(waveformPreviewBounds), 'verify waveform preview must be measurable');
  assert(
    (waveformPreviewBounds?.width ?? 0) >= 480 && (waveformPreviewBounds?.height ?? 0) >= 210,
    `verify waveform preview must stay meaningfully visible by default (preview=${waveformPreviewBounds?.width ?? 0}x${waveformPreviewBounds?.height ?? 0})`
  );
  const workspaceTotalWidth = (workspaceBounds?.width ?? 0);
  const workbenchBounds = await page.locator('[data-testid="ide-verify-region-stimulus"]').boundingBox();
  const waveformRegionBounds = await page.locator('[data-testid="ide-verify-region-waveform"]').boundingBox();
  assert(Boolean(workbenchBounds), 'verify workbench region must be measurable');
  assert(Boolean(waveformRegionBounds), 'verify waveform region must be measurable');
  const workbenchShare = workspaceTotalWidth > 0 ? ((workbenchBounds?.width ?? 0) / workspaceTotalWidth) : 0;
  const waveformShare = workspaceTotalWidth > 0 ? ((waveformRegionBounds?.width ?? 0) / workspaceTotalWidth) : 0;
  assert(
    workbenchShare >= 0.38,
    `verify workbench must own a real share of the workspace at desktop widths (share=${workbenchShare.toFixed(3)})`
  );
  assert(
    waveformShare >= 0.49,
    `verify waveform must remain the dominant evidence companion at desktop widths (share=${waveformShare.toFixed(3)})`
  );
  assert(
    (workspaceBounds?.width ?? 0) >= (panelBodyBounds?.width ?? 0) * 0.85,
    `verify workspace must own most of the panel width at desktop sizes (workspace=${workspaceBounds?.width ?? 0}, panel=${panelBodyBounds?.width ?? 0})`
  );
  assert(
    ((bannerBounds?.height ?? 0) + (commandBarBounds?.height ?? 0)) <= 72,
    `verify top chrome must stay compact at desktop sizes (banner=${bannerBounds?.height ?? 0}, command=${commandBarBounds?.height ?? 0})`
  );

  const secondaryAssertionGrid = page.locator('[data-testid="ide-assertion-canvas"]').first();
  assert(
    !(await secondaryAssertionGrid.isVisible().catch(() => false)),
    'the read-only assertion grid must stay out of the primary waveform workspace by default'
  );

  const drawerToggle = page.locator('[data-testid="ide-verify-drawer-toggle"]').first();
  await drawerToggle.click();
  await page.waitForSelector('[data-testid="ide-verify-analysis-tab-nav"]', { timeout: 10000 });
  await page.getByRole('button', { name: 'Vectors' }).first().click();
  await page.waitForSelector('[data-testid="ide-assertion-canvas"]', { timeout: 10000 });
  assert(
    await secondaryAssertionGrid.isVisible().catch(() => false),
    'the read-only assertion grid must remain available from the secondary analysis drawer'
  );
  await drawerToggle.click();
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
