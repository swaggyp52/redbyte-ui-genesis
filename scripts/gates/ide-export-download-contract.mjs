#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
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
      return;
    }
  }
}

await runIdeGate('IDE export download contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await ensureVerifyVectorsReady(page);
  const runSelectors = ['[data-testid="ide-verify-run"]', '[data-testid="ide-verify-run-secondary"]', '[data-testid="ide-verify-empty-run"]'];
  let runClicked = false;
  for (const selector of runSelectors) {
    const candidate = page.locator(selector).first();
    const isVisible = await candidate.isVisible().catch(() => false);
    if (isVisible) {
      await candidate.click();
      runClicked = true;
      break;
    }
  }
  assert(runClicked, 'verify run button must be visible before export checks');
  await waitForVerifyResult(page, { timeout: 15000 });

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 10000 });

  const downloadAllVisible = await page
    .locator('[data-testid="ide-export-rebuild-btn"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(downloadAllVisible, 'evidence capsule action must be visible');

  const readmePreviewVisible = await page
    .locator('[data-testid="ide-export-readme-preview"]')
    .first()
    .isVisible()
    .catch(() => false);
  const blockedHintVisible = await page
    .locator('[data-testid="ide-export-vivado-command"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(
    readmePreviewVisible || blockedHintVisible,
    'Vivado command section (ready or blocked) must be visible'
  );

  const vivadoChecklistVisible = await page
    .locator('[data-testid="ide-export-vivado-checklist"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(vivadoChecklistVisible, 'Vivado checklist must be visible');
});

