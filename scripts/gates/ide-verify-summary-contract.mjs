#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function loadLogicGatesExample(page) {
  const starterButton = page.locator('[data-testid="ide-project-load-start-logic-gates"]').first();
  if (await starterButton.isVisible().catch(() => false)) {
    await starterButton.click();
    return;
  }

  const examplesDisclosure = page.locator('[data-testid="ide-project-examples-disclosure"]').first();
  const disclosureVisible = await examplesDisclosure.isVisible().catch(() => false);
  if (disclosureVisible) {
    await examplesDisclosure.evaluate((element) => {
      if (element instanceof HTMLDetailsElement) {
        element.open = true;
      }
    });
    await starterButton.scrollIntoViewIfNeeded();
    await starterButton.click();
    return;
  }

  throw new Error('logic-gates starter entry point was not visible');
}

await runIdeGate('IDE verify summary contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-project"]').click();
  await loadLogicGatesExample(page);
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
