#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE verify summary contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  await page.locator('[data-testid="ide-verify-vector-fail"]').click();
  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const status = document.querySelector('[data-testid="ide-verify-summary-status"]');
      return Boolean(status && /FAIL/i.test(status.textContent || ''));
    },
    { timeout: 10000 }
  );

  const failTick = await text(page.locator('[data-testid="ide-verify-first-fail-tick"]'));
  assert(failTick.length > 0 && failTick.toLowerCase() !== 'n/a', 'verify summary must include first failing tick');

  const failSignal = await text(page.locator('[data-testid="ide-verify-first-fail-signal"]'));
  assert(failSignal.length > 0 && failSignal.toLowerCase() !== 'n/a', 'verify summary must include failing signal');

  const failDiff = await text(page.locator('[data-testid="ide-verify-first-fail-diff"]'));
  assert(failDiff.includes('/'), 'verify summary must include expected/actual diff');

  await page.locator('[data-testid="ide-verify-summary-fix"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-selection-id"]', { timeout: 10000 });
});
