#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE project health live contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const initialCta = await text(page.locator('[data-testid="ide-project-continue-target"]'));
  assert(
    initialCta.toLowerCase().includes('add test vectors'),
    `expected initial project continue target "Add Test Vectors", got "${initialCta}"`
  );

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-add-vector-form"]', { timeout: 10000 });

  await page.locator('[data-testid="ide-verify-add-vector-tick"]').fill('11');
  const firstInput = page.locator('[data-testid^="ide-verify-add-vector-input-"]').first();
  await firstInput.selectOption('1');
  await page.locator('[data-testid="ide-verify-add-vector-submit"]').click();
  await page.locator('[data-testid="ide-verify-vector-pass"]').click();
  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const label = document.querySelector('[data-testid="ide-verify-status-label"]');
      return Boolean(label && /(PASS|FAIL)/i.test(label.textContent || ''));
    },
    { timeout: 10000 }
  );

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const verifyStatus = await text(page.locator('[data-testid="ide-project-last-verify-status"]'));
  assert(
    verifyStatus === 'PASS' || verifyStatus === 'FAIL',
    `expected project last verify status PASS/FAIL, got "${verifyStatus}"`
  );
  const verifyHash = await text(page.locator('[data-testid="ide-project-last-verify-hash"]'));
  assert(
    verifyHash.length > 0 && verifyHash.toLowerCase() !== 'pending',
    `expected project last verify hash to be populated, got "${verifyHash}"`
  );

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-design-add-and-starter"]').click();

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const dirtySinceVerify = await text(page.locator('[data-testid="ide-project-dirty-since-verify"]'));
  assert(
    dirtySinceVerify === 'DIRTY',
    `expected dirty-since-verify indicator to be DIRTY, got "${dirtySinceVerify}"`
  );
  const ctaAfterMutation = await text(page.locator('[data-testid="ide-project-continue-target"]'));
  assert(
    ctaAfterMutation.toLowerCase().includes('run verification'),
    `expected project continue target "Run Verification" after design mutation, got "${ctaAfterMutation}"`
  );
});
