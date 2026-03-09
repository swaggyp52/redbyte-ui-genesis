#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function dismissOnboardingIfPresent(page) {
  const skipButton = page.locator('[data-testid="ide-onboarding-skip"]').first();
  const overlay = page.locator('[data-testid="ide-onboarding-overlay"]').first();
  const visible = await skipButton.isVisible().catch(() => false);
  if (!visible) return;
  await skipButton.click();
  await overlay.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
}

async function clickVerifyRun(page) {
  const candidates = [
    '[data-testid="ide-verify-run"]',
    '[data-testid="ide-verify-run-secondary"]',
    '[data-testid="ide-verify-empty-run"]',
    '[data-testid="ide-verify-stale-primary-rerun"]',
  ];
  for (const selector of candidates) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;
    await button.click();
    return;
  }
  throw new Error('verify run button was not visible in any supported state');
}

async function mutateDesignCircuit(page) {
  const candidates = [
    page.locator('[data-testid^="ide-design-board-input-"]').locator(':scope:not([disabled])').first(),
    page.locator('[data-testid^="ide-design-board-output-"]').locator(':scope:not([disabled])').first(),
    page.locator('[data-testid="ide-design-palette-and"]').first(),
  ];
  for (const button of candidates) {
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;
    await button.click();
    return;
  }
  throw new Error('no canonical design mutation control was available');
}

await runIdeGate('IDE project health live contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await dismissOnboardingIfPresent(page);

  const initialCta = await text(page.locator('[data-testid="ide-project-continue-target"]'));
  assert(
    initialCta.toLowerCase().includes('verify'),
    `expected initial project continue target to route Verify, got "${initialCta}"`
  );

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-add-vector-form"]', { timeout: 10000 });

  await page.locator('[data-testid="ide-verify-add-vector-tick"]').fill('11');
  const firstInput = page.locator('[data-testid^="ide-verify-add-vector-input-"]').first();
  await firstInput.selectOption('1');
  await page.locator('[data-testid="ide-verify-add-vector-submit"]').click();
  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();
  await clickVerifyRun(page);
  await page.waitForFunction(
    () => {
      const status = document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? '';
      const consoleHash = document.querySelector('[data-testid="ide-verify-console-hash"]')?.textContent ?? '';
      return !/^(READY|RUNNING)$/i.test(status.trim()) && /report=/i.test(consoleHash) && !/report=\s*[—-]/i.test(consoleHash);
    },
    { timeout: 10000 }
  );

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await page.waitForFunction(
    () => {
      const status = document.querySelector('[data-testid="ide-project-last-verify-status"]')?.textContent ?? '';
      const hash = document.querySelector('[data-testid="ide-project-last-verify-hash"]')?.textContent ?? '';
      const dirty = document.querySelector('[data-testid="ide-project-dirty-since-verify"]')?.textContent ?? '';
      return /^(PASS|FAIL)$/i.test(status.trim()) && hash.trim().length > 0 && !/[—-]/.test(hash.trim()) && /^CLEAN$/i.test(dirty.trim());
    },
    { timeout: 10000 }
  );

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
  await page.waitForSelector('[data-testid="ide-design-panel"]', { timeout: 10000 });
  await mutateDesignCircuit(page);

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const dirtySinceVerify = await text(page.locator('[data-testid="ide-project-dirty-since-verify"]'));
  assert(
    dirtySinceVerify === 'DIRTY',
    `expected dirty-since-verify indicator to be DIRTY, got "${dirtySinceVerify}"`
  );
  const ctaAfterMutation = await text(page.locator('[data-testid="ide-project-continue-target"]'));
  assert(
    ctaAfterMutation.toLowerCase().includes('verify'),
    `expected project continue target to route Verify after design mutation, got "${ctaAfterMutation}"`
  );
});

