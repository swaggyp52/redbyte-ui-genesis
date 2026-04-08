#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function ensureVerifyVectorsReady(page) {
  const candidates = [
    '[data-testid="ide-verify-generate-basic-vectors"]',
    '[data-testid="ide-verify-generate-basic-vectors-footer"]',
    '[data-testid="ide-verify-generate-all-combos"]',
    '[data-testid="ide-verify-guided-clock-pattern"]',
    '[data-testid="ide-verify-trace-generate-basics"]',
  ];
  for (const selector of candidates) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      await button.click();
      return 'generated';
    }
  }

  const runBar = page.locator('[data-testid="ide-verify-workstation-run-bar"]').first();
  const runBarVisible = await runBar.isVisible().catch(() => false);
  const runBarText = runBarVisible ? ((await runBar.textContent()) ?? '').trim() : '';
  if (/vector/i.test(runBarText)) {
    return 'existing';
  }

  throw new Error('verify had neither a visible generate-basics action nor an existing ready-vector state');
}

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
  await page.waitForSelector('[data-testid="ide-project-start-dock"]', { timeout: 10000 });

  await loadStarterProject(page);

  if (!(await page.locator('[data-testid="ide-mode-design"]').isVisible({ timeout: 2000 }).catch(() => false))) {
    await page.locator('[data-testid="mode-button-design"]').click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  }

  await page.waitForSelector('[data-testid="ide-guided-strip"]', { timeout: 10000 });

  const stripOnDesign = page.locator('[data-testid="ide-guided-strip"]').first();
  assert(await visible(stripOnDesign), 'guided strip must be visible on design surface');

  await page
    .locator('[data-testid^="ide-design-live-input-"]')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  // 2. Verify: generate basics -> run -> PASS/FAIL banner
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const stripOnVerify = page.locator('[data-testid="ide-guided-strip"]').first();
  assert(await visible(stripOnVerify), 'guided strip must be visible on verify surface');

  await ensureVerifyVectorsReady(page);
  const vectorTable = page.locator('[data-testid="ide-verify-vectors-table"]').first();
  const vectorTableVisible = await visible(vectorTable).catch(() => false);
  const runFooter = page.locator('[data-testid="ide-verify-workstation-run-bar"]').first();
  const runFooterVisible = await visible(runFooter).catch(() => false);
  const runFooterText = runFooterVisible ? ((await runFooter.textContent()) ?? '').trim() : '';
  assert(
    vectorTableVisible || /vector/i.test(runFooterText),
    'verify must surface authored vectors after generating basics',
  );

  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 10000 });

  const verifyBanner = page.locator('[data-testid="ide-verify-banner"]').first();
  assert(await visible(verifyBanner), 'verify summary banner must be visible after run');

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
    /PASS|FAIL|TRACE|ASSERTIONS|SIMULATION/i.test(statusLabel),
    `verify status must reflect a completed compare/simulation state, got "${statusLabel}"`,
  );

  // 3. Export: gate state + Vivado command contract
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const exportPanel = page.locator('[data-testid="ide-export-panel"]').first();
  assert(await visible(exportPanel), 'export panel must be visible');

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

  const downloadBlock = page.locator('[data-testid="ide-export-download-block"]').first();
  assert(
    await visible(downloadBlock),
    'export download block must be visible',
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
  //   ide-hardware-blocked-hero         — when prerequisites are still missing
  // Both encode the Build → Verify → Export → Program trust chain.
  await page.locator('[data-testid="ide-hw-mode-btn-proof"]').click();
  await page.waitForSelector('[data-testid="ide-hw-proof-dock"]', { timeout: 5000 });

  const hasProgramCta = await page
    .locator('[data-testid="ide-hardware-program-handoff-cta"]')
    .first()
    .isVisible()
    .catch(() => false);
  const hasBlockedHero = await page
    .locator('[data-testid="ide-hardware-blocked-hero"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(
    hasProgramCta || hasBlockedHero,
    'proof mode must show either the program handoff CTA or a prerequisite blocker — ' +
    'the Build → Verify → Export → Program path must be represented',
  );
});
