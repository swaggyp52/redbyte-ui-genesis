#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { isVerifyFail, waitForVerifyResult } from './_verifyStatus.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE verify summary contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page, {
    preferredLabStarterTestId: 'ide-project-lab-card-missing-summary-fixture',
  });

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  await page.locator('[data-testid="ide-vcb-run"]').first().click();
  await waitForVerifyResult(page, { timeout: 10000 });

  const statusText = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  if (isVerifyFail(statusText)) {
    const selectedResult = page.locator('[data-testid="ide-verify-selected-result"]');
    const failEvidence = `${await text(page.locator('[data-testid="ide-run-identity"]'))} ${await text(selectedResult)}`.trim();

    const jumpFirst = page
      .locator('[data-testid="ide-verify-fail-nav-first"]')
      .first();
    const jumpVisible = await jumpFirst.isVisible().catch(() => false);
    const selectedTickVisible = await selectedResult.isVisible() && await selectedResult.getAttribute('data-tick') !== null;
    assert(
      /(fail|differ|mismatch)/i.test(failEvidence) && (jumpVisible || selectedTickVisible),
      `verify fail summary must include mismatch evidence and an inspectable failure, got "${failEvidence}"`
    );

    if (jumpVisible) {
      const beforeTick = await selectedResult.getAttribute('data-tick');
      await jumpFirst.click();
      const afterTick = await selectedResult.getAttribute('data-tick');
      assert(afterTick !== null && afterTick.length > 0, 'selected tick must remain populated after jump');
      assert((beforeTick?.length ?? 0) > 0 || afterTick.length > 0, 'selected tick must be visible before or after jump');
    }
  }
});
