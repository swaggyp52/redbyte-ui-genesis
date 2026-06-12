#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
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
  assert(
    await setVerifyRunMode(page, 'compare'),
    'export ready proof requires Verify to expose Compare checks'
  );
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 10000 });

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  // Readiness gates live in a <details> panel; open it so the stack is visible for the contract.
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ide-export-gate-details"]');
    if (el && 'open' in el) el.open = true;
  });
  await page.waitForSelector('[data-testid="ide-export-gate-stack"]', { state: 'visible', timeout: 10000 });

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
  const artifactPlan = page.locator('[data-testid="ide-export-artifact-preview"]').first();
  assert(await visible(artifactPlan), 'artifact workspace (generated files list) must be visible');
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
  assert(summaryDownloadEnabled, 'summary primary button must be enabled once export has no blockers');

  const secondaryDownloadButton = page.locator('[data-testid="ide-export-dock-download"]').first();
  const downloadButton = await visible(secondaryDownloadButton).catch(() => false)
    ? secondaryDownloadButton
    : summaryDownloadButton;

  await downloadButton.scrollIntoViewIfNeeded();

  const summaryButtonOwnsCenterHit = await downloadButton.evaluate((button) => {
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
    downloadButton.click(),
  ]);
  const suggestedName = (download.suggestedFilename?.() ?? '').toLowerCase();
  assert(
    suggestedName.endsWith('.zip'),
    `summary download should emit a zip artifact, got "${suggestedName || 'unknown'}"`
  );
});
