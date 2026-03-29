#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function clickVerifyRun(page) {
  const candidates = [
    '[data-testid="ide-verify-run"]',
    '[data-testid="ide-verify-run-secondary"]',
    '[data-testid="ide-verify-empty-run"]',
    '[data-testid="ide-verify-stale-primary-rerun"]',
  ];
  for (const selector of candidates) {
    const button = page.locator(selector).first();
    const visible = await button.isVisible().catch(() => false);
    if (visible) {
      await button.click();
      return;
    }
  }
  throw new Error('verify run button was not visible in any supported state');
}

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
  const runBarVisible = await visible(runBar).catch(() => false);
  const runBarText = runBarVisible ? await text(runBar) : '';
  if (/vector/i.test(runBarText)) {
    return 'existing';
  }

  throw new Error('verify had neither a visible generate-basics action nor an existing ready-vector state');
}

await runIdeGate('IDE export ready contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await ensureVerifyVectorsReady(page);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 10000 });

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-gate-stack"]', { timeout: 10000 });

  const statusStrip = await text(page.locator('[data-testid="ide-export-gate-stack"]'));
  assert(statusStrip.toUpperCase().includes('VERIFY'), 'export gate stack must include verify gate row');
  assert(
    /PASS|READY|CURRENT|COMPLETE/i.test(statusStrip),
    `export status strip must report a ready verify state, got "${statusStrip}"`
  );

  const requiredArtifacts = [
    'top.vhd',
    'top.xdc',
    'testbench.vhd',
    'readme.txt',
    'vivado_import.tcl',
  ];
  const artifactPlan = page.locator('[data-testid="ide-export-artifact-plan"]').first();
  assert(await visible(artifactPlan), 'artifact plan must be visible');
  const artifactPlanText = ((await artifactPlan.textContent()) ?? '').toLowerCase();
  for (const fileName of requiredArtifacts) {
    assert(
      artifactPlanText.includes(fileName),
      `missing required artifact from export plan: ${fileName}`
    );
  }

  const summaryDownloadButton = page.locator('[data-testid="ide-export-rebuild-btn"]').first();
  assert(await visible(summaryDownloadButton), 'summary download button must be visible in export hero');
  const summaryDownloadEnabled = await summaryDownloadButton.isEnabled().catch(() => false);
  assert(summaryDownloadEnabled, 'summary download button must be enabled once export is current');

  await summaryDownloadButton.scrollIntoViewIfNeeded();

  const summaryButtonOwnsCenterHit = await summaryDownloadButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    return Boolean(top && (top === button || button.contains(top)));
  });
  assert(
    summaryButtonOwnsCenterHit,
    'summary download button center hit-target must not be intercepted by overlapping export content'
  );

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    summaryDownloadButton.click(),
  ]);
  const suggestedName = (download.suggestedFilename?.() ?? '').toLowerCase();
  assert(
    suggestedName.endsWith('.zip'),
    `summary download should emit a zip artifact, got "${suggestedName || 'unknown'}"`
  );
});
