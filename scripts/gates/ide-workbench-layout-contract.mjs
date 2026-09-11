#!/usr/bin/env node

// What this protects: a student can start work in one move, every workspace mounts its own
// body, and Simulate opens on the testbench - the thing you edit - rather than on a waveform
// that has nothing in it yet, gaining the waveform only once a run exists.
//
// Migrated 2026-09-06. Three things had gone stale against a deliberately replaced interface:
//   · the landing expected `ide-project-landing-example-*` on a flat page. The Start Center is
//     a sectioned library that opens on Course labs, and the harness already knows that path
//     (loadStarterProject), so the gate uses it.
//   · the dock table named `ide-inspector` and `ide-workbench-dock-toggle-*`, both deleted with
//     IdeLeftRail.tsx in 24de703b6 (2026-07-25). The right dock is `ide-right-dock` and it is
//     contextual on selection, which ide:gate:shell-layout-integrity already asserts per mode
//     (contextualDockViolationCount); this gate no longer keeps a second, staler copy.
//   · every mode was told whether to mount a console. The bottom panel is opt-in per surface
//     preference now; ide:gate:console-autocollapse-contract owns that behaviour.
// What is kept is what still has no other owner: the one-move start, a body per mode, and the
// testbench-before-waveform invariant on Simulate.

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export'];

async function clickIfVisible(locator) {
  const target = locator.first();
  if (!await target.count()) return false;
  if (!await target.isVisible().catch(() => false)) return false;
  await target.click();
  return true;
}

async function clickEnabledVerifyRunButton(root) {
  for (const testId of ['ide-vcb-run', 'ide-verify-run-secondary', 'ide-verify-run', 'ide-verify-stale-rerun']) {
    const button = root.locator(`[data-testid="${testId}"]`).first();
    if (!await button.count()) continue;
    const visibleButton = await button.isVisible().catch(() => false);
    if (!visibleButton) continue;
    const disabled = await button.evaluate((element) => element.hasAttribute('disabled')).catch(() => true);
    if (disabled) continue;
    await button.click();
    return testId;
  }
  return null;
}

await runIdeGate('IDE workbench layout contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  const landingVisible = await page
    .locator('[data-testid="ide-project-landing"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(landingVisible, 'first use must land on the Start Center');
  // One move from the landing to real work. The harness owns the current path so that this
  // gate does not carry its own copy of the Start Center's structure.
  await loadStarterProject(page);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  for (const mode of MODES) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
    await modeRoot.waitFor({ state: 'visible', timeout: 10000 });

    if (mode !== 'verify') {
      assert(await visible(modeRoot.locator('[data-testid="ide-mode-body"]')), `mode=${mode} missing workspace`);
      // Nothing retired may come back. These ids were deleted with the old shell; a gate that
      // finds one again is looking at a regression, not at a new feature.
      const retired = await modeRoot
        .locator('[data-testid="ide-inspector"], [data-testid^="ide-workbench-dock-toggle-"]')
        .count();
      assert(retired === 0, `mode=${mode} mounted a retired shell control`);
    }
  }

  await page.locator('[data-testid="mode-button-verify"]').click();
  const verifyRoot = page.locator('[data-testid="ide-mode-verify"]').first();
  await verifyRoot.waitFor({ state: 'visible', timeout: 10000 });
  const leftDock = verifyRoot.locator('[data-testid="ide-left-dock"]').first();
  const leftDockRail = verifyRoot.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
  const workspace = verifyRoot.locator('[data-testid="ide-mode-body"]').first();
  const preRunWaveformVisible = await verifyRoot
    .locator('[data-testid="ide-verify-workspace-waveform"]')
    .first()
    .isVisible()
    .catch(() => false);
  // The thing you edit before a run is the case grid. `ide-verify-session-hero` and the
  // scenario-builder class are from the pre-P2.5 composition and no element carries either.
  const preRunTestbenchVisible =
    await visible(verifyRoot.locator('[data-testid="ide-case-lab"]')) ||
    await visible(verifyRoot.locator('[data-testid="ide-stimulus-canvas"]'));
  const preRunPrimaryVisible =
    await visible(verifyRoot.locator('[data-testid="ide-vcb-run"]')) ||
    await visible(verifyRoot.locator('[data-testid="ide-verify-generate-basic-vectors-footer"]')) ||
    await visible(verifyRoot.locator('[data-testid="ide-verify-run-secondary"]')) ||
    await visible(verifyRoot.locator('[data-testid="ide-verify-run"]'));

  const leftDockVisible = await leftDock.isVisible().catch(() => false);
  const leftRailVisible = await leftDockRail.isVisible().catch(() => false);
  const workspaceBox = await workspace.boundingBox();
  const leftBox = leftDockVisible ? await leftDock.boundingBox() : null;
  const leftRailBox = leftRailVisible ? await leftDockRail.boundingBox() : null;
  const layoutMode = await verifyRoot.getAttribute('data-layout-mode');

  assert(Boolean(workspaceBox), 'failed to read verify workspace geometry');
  assert(Boolean(layoutMode), 'verify root missing data-layout-mode');
  assert(
    layoutMode === 'wide' || layoutMode === 'standard' || layoutMode === 'compact',
    `unexpected verify layout mode: ${layoutMode}`
  );
  assert(preRunTestbenchVisible, 'verify pre-run missing testbench workspace');
  assert(preRunPrimaryVisible, 'verify pre-run missing primary action');
  assert(!preRunWaveformVisible, 'verify pre-run should be testbench-first, not waveform-first');

  await clickIfVisible(
    verifyRoot.locator(
      '[data-testid="ide-verify-generate-basic-vectors-footer"], [data-testid="ide-verify-generate-all-combos"], [data-testid="ide-verify-guided-clock-pattern"]'
    )
  );
  const runButtonTestId = await clickEnabledVerifyRunButton(verifyRoot);
  assert(Boolean(runButtonTestId), 'verify missing enabled run action after preparation');

  await page.waitForFunction(() => {
    return Boolean(document.querySelector('[data-testid="ide-verify-workspace-waveform"]'));
  }, { timeout: 30000 });
  const verifyWaveformVisible = await verifyRoot
    .locator('[data-testid="ide-verify-workspace-waveform"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(verifyWaveformVisible, 'verify post-run missing waveform workspace');
  const verifyDockBox = leftBox ?? leftRailBox;
  if (verifyDockBox) {
    assert(workspaceBox.width > verifyDockBox.width, 'workspace should be wider than the verify signal dock');
  }
  // Verify now uses a collapsible lower analysis drawer in place of the legacy right dock.
  // Note: vertical resize handles are intentionally disabled in the current product
  // (CSS: display:none; pointer-events:none). The resize-drag assertion is omitted
  // to reflect current canonical product truth.
});
