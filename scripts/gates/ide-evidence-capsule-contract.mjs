#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').trim();
}

async function clickVerifyRun(page) {
  const runSelectors = [
    '[data-testid="ide-verify-run"]',
    '[data-testid="ide-verify-run-secondary"]',
    '[data-testid="ide-verify-empty-run"]',
    '[data-testid="ide-verify-stale-primary-rerun"]',
  ];
  for (const selector of runSelectors) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      await button.click();
      return;
    }
  }
  throw new Error('verify run button not visible');
}

await runIdeGate('IDE evidence capsule contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-project-load-start-logic-gates"]').click();
  const replaceModalVisible = await page
    .locator('[data-testid="ide-example-confirm-modal"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (replaceModalVisible) {
    await page.locator('[data-testid="ide-example-confirm"]').click();
  }

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();
  await clickVerifyRun(page);
  await page.waitForFunction(
    () => /PASS|FAIL|TRACE/i.test(document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? ''),
    { timeout: 15000 }
  );

  const setOracle = page.locator('[data-testid="ide-verify-set-oracle"]').first();
  if (await setOracle.isVisible().catch(() => false)) {
    await setOracle.click();
    await clickVerifyRun(page);
    await page.waitForFunction(
      () => /PASS/i.test(document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? ''),
      { timeout: 15000 }
    );
  }

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 10000 });

  const verifyHashContext = await text(page.locator('[data-testid="ide-export-context-verify-hash"]'));
  assert(
    verifyHashContext.length > 0 && verifyHashContext.toLowerCase() !== 'pending',
    `export context verify hash must be materialized, got "${verifyHashContext}"`
  );

  await page.locator('[data-testid="ide-export-rebuild-btn"]').click();
  await page.waitForFunction(
    () => {
      const stateNode = document.querySelector('[data-testid="ide-export-capsule-build-state"] span:last-child');
      const state = (stateNode?.textContent ?? '').trim().toUpperCase();
      return state === 'DONE' || state === 'ERROR';
    },
    { timeout: 20000 }
  );

  const buildState = await text(page.locator('[data-testid="ide-export-capsule-build-state"] span:last-child'));
  const capsuleError = await text(page.locator('[data-testid="ide-export-capsule-error"]'));
  assert(buildState.toUpperCase() === 'DONE', `capsule build must end in DONE, got "${buildState}"`);
  assert(capsuleError.length === 0, `capsule build reported error: ${capsuleError}`);

  const capsuleFilesText = await text(page.locator('[data-testid="ide-export-capsule-files"] code'));
  const capsuleFiles = capsuleFilesText
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  assert(capsuleFiles.length >= 5, `capsule file list must include bundle artifacts, got ${capsuleFiles.length}`);
  assert(capsuleFiles.includes('MANIFEST.json'), 'capsule must include MANIFEST.json');
  assert(capsuleFiles.includes('verify-report.json'), 'capsule must include verify-report.json');

  const sealBarVisible = await page.locator('[data-testid="ide-export-seal-bar"]').first().isVisible().catch(() => false);
  assert(sealBarVisible, 'capsule seal bar must be visible');
});

