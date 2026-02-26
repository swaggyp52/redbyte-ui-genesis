#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE verify summary contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-project"]').click();
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
  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const status = document.querySelector('[data-testid="ide-verify-summary-status"]');
      return Boolean(status && /PASS|FAIL|TRACE/i.test(status.textContent || ''));
    },
    { timeout: 10000 }
  );

  const statusText = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  if (/FAIL/i.test(statusText)) {
    const failStrip = await text(page.locator('[data-testid="ide-verify-strip-fail-count"]'));
    assert(
      failStrip.includes('fail') && /at t\d+/i.test(failStrip),
      `verify fail summary must include fail count and first failing tick, got "${failStrip}"`
    );

    const jumpFirst = page.locator('[data-testid="ide-verify-jump-first-failure"]').first();
    const jumpVisible = await jumpFirst.isVisible().catch(() => false);
    assert(jumpVisible, 'jump-to-first-failure action must be visible on FAIL');

    const beforeTick = await text(page.locator('[data-testid="ide-verify-selected-tick"]'));
    await jumpFirst.click();
    const afterTick = await text(page.locator('[data-testid="ide-verify-selected-tick"]'));
    assert(afterTick.length > 0, 'selected tick must remain populated after jump');
    assert(beforeTick.length > 0, 'selected tick must be visible before jump');
  }
});

