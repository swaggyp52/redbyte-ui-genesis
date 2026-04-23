#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export'];
const MODE_EXPECTATIONS = {
  project: { leftDock: 'hidden', rightDock: 'hidden', console: 'hidden' },
  design: { leftDock: 'visible', rightDock: 'visible', console: 'hidden' },
  hardware: { leftDock: 'visible', rightDock: 'visible', console: 'hidden' },
  export: { leftDock: 'hidden', rightDock: 'visible', console: 'visible' },
  import: { leftDock: 'visible', rightDock: 'hidden', console: 'hidden' },
};

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
  if (landingVisible) {
    const firstExample = page.locator('[data-testid^="ide-project-landing-example-"]').first();
    const exampleVisible = await firstExample.isVisible().catch(() => false);
    assert(exampleVisible, 'project landing must surface at least one starter example');
    await firstExample.click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  }

  for (const mode of MODES) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
    await modeRoot.waitFor({ state: 'visible', timeout: 10000 });

    if (mode !== 'verify') {
      const expectation = MODE_EXPECTATIONS[mode];
      const leftDockVisible = await visible(modeRoot.locator('[data-testid="ide-left-dock"]'));
      if (expectation.leftDock === 'visible') {
        assert(leftDockVisible, `mode=${mode} missing left dock`);
      } else {
        assert(!leftDockVisible, `mode=${mode} should not show a duplicate left dock`);
      }
      assert(await visible(modeRoot.locator('[data-testid="ide-mode-body"]')), `mode=${mode} missing workspace`);

      const inspectorVisible = await modeRoot.locator('[data-testid="ide-inspector"]').first().isVisible().catch(() => false);
      const rightRailVisible = await modeRoot
        .locator('[data-testid="ide-workbench-dock-toggle-right"]')
        .first()
        .isVisible()
        .catch(() => false);
      if (expectation.rightDock === 'visible') {
        assert(inspectorVisible, `mode=${mode} missing right dock`);
      } else if (expectation.rightDock === 'collapsed') {
        assert(!inspectorVisible, `mode=${mode} inspector should start collapsed`);
        assert(rightRailVisible, `mode=${mode} missing collapsed inspector rail`);
      } else {
        assert(!inspectorVisible, `mode=${mode} inspector should be hidden by default`);
        assert(!rightRailVisible, `mode=${mode} should not show an inspector rail`);
      }

      const consoleCount = await modeRoot.locator('[data-testid="ide-workbench-console"]').count();
      if (expectation.console === 'hidden') {
        assert(consoleCount === 0, `mode=${mode} workbench console should be hidden by default`);
      } else {
        assert(consoleCount >= 1, `mode=${mode} missing workbench console`);
      }
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
  const preRunTestbenchVisible =
    await visible(verifyRoot.locator('[data-testid="ide-stimulus-canvas"]')) ||
    await visible(verifyRoot.locator('.ide-verify-scenario-builder')) ||
    await visible(verifyRoot.locator('[data-testid="ide-verify-session-hero"]'));
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
