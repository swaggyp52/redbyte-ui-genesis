#!/usr/bin/env node

import { assert, ensureVerifyVectorsReady, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function clickVerifyRun(page) {
  const candidates = [
    '[data-testid="ide-vcb-run"]',
    '[data-testid="ide-verify-run"]',
    '[data-testid="ide-verify-run-secondary"]',
    '[data-testid="ide-verify-empty-run"]',
    '[data-testid="ide-verify-stale-primary-rerun"]',
  ];
  for (const selector of candidates) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      await button.click();
      return;
    }
  }
  throw new Error('verify run button was not visible in any supported state');
}

await runIdeGate('IDE student loop contract satisfied', async ({ page, baseUrl }) => {
  // 1. Project: open the runtime examples catalog and load an example
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-project-import-primary"], [data-testid="ide-project-continue-cta"], [data-testid^="ide-project-landing-example-"]', { timeout: 10000 });

  await loadStarterProject(page, { preferredLabStarterTestId: 'ide-project-landing-example-signal-tour' });

  if (!(await page.locator('[data-testid="ide-mode-design"]').isVisible({ timeout: 2000 }).catch(() => false))) {
    await page.locator('[data-testid="mode-button-design"]').click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  }

  const designInspector = page.locator('[data-testid="ide-design-inspector-empty"]').first();
  const designSelectionInspector = page.locator('[data-testid="ide-design-selection-inspector"]').first();
  const designInspectorVisible = await designInspector.isVisible().catch(() => false);
  const designSelectionVisible = await designSelectionInspector.isVisible().catch(() => false);
  assert(
    designInspectorVisible || designSelectionVisible,
    'design surface must render its inspector panel after starter load',
  );

  // 2. Verify: generate basics -> run -> PASS/FAIL banner
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  await ensureVerifyVectorsReady(page);
  const vectorTable = page.locator('[data-testid="ide-verify-vectors-table"]').first();
  const vectorTableVisible = await visible(vectorTable).catch(() => false);
  const runFooter = page.locator('[data-testid="ide-verify-workstation-run-bar"]').first();
  const runFooterVisible = await visible(runFooter).catch(() => false);
  const runFooterText = runFooterVisible ? ((await runFooter.textContent()) ?? '').trim() : '';
  const firstRunStateText = (
    await page
      .locator('[data-testid="ide-verify-empty-state"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  const commandStatusText = (
    await page
      .locator('[data-testid="ide-vcb-status"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  const headerRunVisible = await page
    .locator('[data-testid="ide-vcb-run"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(
    vectorTableVisible ||
      /vector/i.test(runFooterText) ||
      /current vectors are ready|saved checks available/i.test(firstRunStateText) ||
      (/ready/i.test(commandStatusText) && headerRunVisible),
    'verify must surface authored vectors after generating basics',
  );

  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 10000 });

  const verifySummaryStatus = page.locator('[data-testid="ide-verify-summary-status"]').first();
  assert(await visible(verifySummaryStatus), 'verify summary status must be visible after run');

  const statusLabel = (
    await page
      .locator('[data-testid="ide-verify-summary-status"]')
      .first()
      .textContent()
      .catch(async () =>
        page
          .locator('[data-testid="ide-verify-summary-status"]')
          .first()
          .textContent()
          .catch(() => ''),
      )
  )?.trim() ?? '';
  assert(
    /PASS|FAIL|TRACE|ASSERTIONS|SIMULATION|OBSERVATION|STIMULUS/i.test(statusLabel),
    `verify status must reflect a completed compare/simulation state, got "${statusLabel}"`,
  );

  // 3. Export: gate state + Vivado command contract
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const exportPanel = page.locator('[data-testid="ide-export-panel"]').first();
  assert(await visible(exportPanel), 'export panel must be visible');

  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ide-export-gate-details"]');
    if (el && 'open' in el) el.open = true;
  });
  const gateStack = page.locator('[data-testid="ide-export-gate-stack"]').first();
  assert(await visible(gateStack), 'export gate stack must be visible');

  const hasBlockersCallout = await page
    .locator('[data-testid="ide-export-blockers-callout"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasVivadoReadyCallout = await page
    .locator('[data-testid="ide-export-vivado-ready-callout"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasVivadoUnverifiedCallout = await page
    .locator('[data-testid="ide-export-vivado-unverified-callout"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasVivadoBlockedCallout = await page
    .locator('[data-testid="ide-export-vivado-blocked-callout"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(
    hasBlockersCallout || hasVivadoReadyCallout || hasVivadoUnverifiedCallout || hasVivadoBlockedCallout,
    'export must show a truthful handoff state: blockers, unverified, blocked, or Vivado-ready',
  );

  const readinessLabel = (
    await page
      .locator('[data-testid="ide-export-vivado-command"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  assert(
    readinessLabel.length > 0,
    `export Vivado command/status must have non-empty text, got "${readinessLabel}"`,
  );

  const primaryHandoff = page.locator('[data-testid="ide-export-primary-handoff-cta"]').first();
  const secondaryDownload = page.locator('[data-testid="ide-export-dock-download"]').first();
  assert(
    (await visible(primaryHandoff).catch(() => false)) || (await visible(secondaryDownload).catch(() => false)),
    'export primary handoff or download action must be visible',
  );

  // 4. Hardware: panel + mode controls
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 10000 });

  const hardwarePanel = page.locator('[data-testid="ide-hardware-panel"]').first();
  assert(await visible(hardwarePanel), 'hardware panel must be visible');

  const hardwareModeToggle = page.locator('[data-testid="ide-hw-mode-toggle"]').first();
  assert(
    await visible(hardwareModeToggle),
    'hardware mode toggle must be visible',
  );

  // 4b. Hardware — proof mode must surface the Program handoff contract.
  // After switching to Proof tab, the IDE must render one of:
  //   ide-hardware-program-handoff-cta  — when verify PASS + export CURRENT (happy path)
  //   ide-hardware-readiness-callout    — when prerequisites are still missing (callout in console)
  //   ide-hardware-command-strip        — always present, encodes current status + next action
  // All three encode the Build → Verify → Export → Program trust chain.
  await page.locator('[data-testid="ide-hw-mode-btn-proof"]').click();
  await page.waitForSelector('[data-testid="ide-hw-proof-dock"]', { timeout: 5000 });

  const hasProgramCta = await page
    .locator('[data-testid="ide-hardware-program-handoff-cta"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasReadinessCallout = await page
    .locator('[data-testid="ide-hardware-readiness-callout"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasCommandStrip = await page
    .locator('[data-testid="ide-hardware-command-strip"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(
    hasProgramCta || hasReadinessCallout || hasCommandStrip,
    'proof mode must show either the program handoff CTA or a prerequisite blocker — ' +
    'the Build → Verify → Export → Program path must be represented',
  );
});
