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

  await page.locator('[data-testid="ide-verify-run"]').click();
  await waitForVerifyResult(page, { timeout: 10000 });

  const statusText = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  if (isVerifyFail(statusText)) {
    const failStrip = await text(page.locator('[data-testid="ide-verify-strip-fail-count"]'));
    const bannerText = await text(page.locator('[data-testid="ide-verify-banner"]'));
    const failEvidence = `${failStrip} ${bannerText}`.trim();

    const jumpFirst = page
      .locator('[data-testid="ide-verify-jump-first-failure"], [data-testid="ide-verify-run-proof-inspect"]')
      .first();
    const jumpVisible = await jumpFirst.isVisible().catch(() => false);
    const selectedTickVisible = await page
      .locator('[data-testid="ide-verify-selected-tick"]')
      .first()
      .isVisible()
      .catch(() => false);
    assert(
      /(fail|differ|mismatch)/i.test(failEvidence) && (jumpVisible || selectedTickVisible),
      `verify fail summary must include mismatch evidence and an inspectable failure, got "${failEvidence}"`
    );

    if (jumpVisible) {
      const beforeTick = await text(page.locator('[data-testid="ide-verify-selected-tick"]'));
      await jumpFirst.click();
      const afterTick = await text(page.locator('[data-testid="ide-verify-selected-tick"]'));
      assert(afterTick.length > 0, 'selected tick must remain populated after jump');
      assert(beforeTick.length > 0 || afterTick.length > 0, 'selected tick must be visible before or after jump');
    }
  }
});
