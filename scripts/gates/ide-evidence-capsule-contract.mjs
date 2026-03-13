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
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
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
  await clickVerifyRun(page);
  await page.waitForFunction(
    () => /PASS|FAIL|TRACE/i.test(document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? ''),
    { timeout: 15000 }
  );
  const initialVerifyStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]'));

  const setOracle = page.locator('[data-testid="ide-verify-set-oracle"]').first();
  // Only use Set Oracle to materialize expectations when the initial run is trace/fail.
  // If Verify already reports PASS, reapplying the oracle is unnecessary and the current
  // logic-gates starter can rerun into FAIL because it changes the authored expectation set.
  if (!/PASS/i.test(initialVerifyStatus) && (await setOracle.isVisible().catch(() => false))) {
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

  // The current Export surface no longer exposes the old capsule build/file-list flow for
  // this starter project. Evidence and rebuild/download behavior are now split: dedicated
  // export gates cover download actions, while this contract verifies the evidence metadata,
  // trust/advisory state, and debug report UI rendered on the Export surface.
  const evidenceState = await text(page.locator('[data-testid="ide-export-capsule-build-state"] span:last-child'));
  assert(
    /Blocked|Unverified|Trusted|Downloaded/i.test(evidenceState),
    `export evidence state must be materialized, got "${evidenceState}"`
  );

  const verifyDeterminismVisible = await page
    .locator('[data-testid="ide-export-determinism-verify"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(verifyDeterminismVisible, 'verify-hash embedded determinism row must be visible');

  const evidenceDetails = page.locator('[data-testid="ide-export-evidence-details"]').first();
  const evidenceDetailsVisible = await evidenceDetails.isVisible().catch(() => false);
  assert(evidenceDetailsVisible, 'debug report evidence details must be visible');
  await evidenceDetails.locator('summary').first().click();

  const copyReportVisible = await page
    .locator('[data-testid="ide-export-copy-debug-report"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(copyReportVisible, 'copy debug report action must be visible');

  const blockersVisible = await page
    .locator('[data-testid="ide-export-blockers-list"]')
    .first()
    .isVisible()
    .catch(() => false);
  const unverifiedCalloutVisible = await page
    .locator('[data-testid="ide-export-unverified-callout"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(
    blockersVisible || unverifiedCalloutVisible || /Trusted|Downloaded/i.test(evidenceState),
    'export evidence surface must show either blockers, an unverified advisory, or a trusted state'
  );
});

