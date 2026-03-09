#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
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
    const visible = await button.isVisible().catch(() => false);
    if (visible) {
      await button.click();
      return;
    }
  }
  throw new Error('verify run button was not visible in any supported state');
}

await runIdeGate('IDE export ready contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

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
    () => {
      const status = document.querySelector('[data-testid="ide-verify-summary-status"]');
      return Boolean(status && /(PASS|TRACE|FAIL)/i.test(status.textContent || ''));
    },
    { timeout: 10000 }
  );
  const setOracle = page.locator('[data-testid="ide-verify-set-oracle"]').first();
  if (await setOracle.isVisible().catch(() => false)) {
    await setOracle.click();
    await clickVerifyRun(page);
    await page.waitForFunction(
      () => {
        const status = document.querySelector('[data-testid="ide-verify-summary-status"]');
        return Boolean(status && /PASS/i.test(status.textContent || ''));
      },
      { timeout: 10000 }
    );
  }

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-gate-stack"]', { timeout: 10000 });

  const statusStrip = await text(page.locator('[data-testid="ide-export-gate-stack"]'));
  assert(statusStrip.toUpperCase().includes('VERIFY'), 'export gate stack must include verify gate row');
  assert(
    statusStrip.toUpperCase().includes('PASS'),
    'export status strip must report verify PASS reliability'
  );

  const requiredArtifacts = [
    'top.vhd',
    'top.xdc',
    'testbench.vhd',
    'readme.txt',
    'vivado_import.tcl',
  ];
  const artifactPlan = page.locator('[data-testid="ide-export-artifact-plan"]').first();
  assert(await visible(artifactPlan), 'artifact plan must be visible');
  const artifactPlanText = ((await artifactPlan.textContent()) ?? '').toLowerCase();
  for (const fileName of requiredArtifacts) {
    assert(
      artifactPlanText.includes(fileName),
      `missing required artifact from export plan: ${fileName}`
    );
  }
});


