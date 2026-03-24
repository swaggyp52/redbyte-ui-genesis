#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

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

async function ensureVerifyVectorsReady(page) {
  const candidates = [
    '[data-testid="ide-verify-generate-basic-vectors"]',
    '[data-testid="ide-verify-generate-basic-vectors-footer"]',
    '[data-testid="ide-verify-trace-generate-basics"]',
  ];
  for (const selector of candidates) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      await button.click();
      return 'generated';
    }
  }

  const runBar = page.locator('[data-testid="ide-verify-workstation-run-bar"]').first();
  const runBarVisible = await visible(runBar).catch(() => false);
  const runBarText = runBarVisible ? await text(runBar) : '';
  if (/vector/i.test(runBarText)) {
    return 'existing';
  }

  throw new Error('verify had neither a visible generate-basics action nor an existing ready-vector state');
}

await runIdeGate('IDE export ready contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

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
  await ensureVerifyVectorsReady(page);
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
    /PASS|READY|CURRENT|COMPLETE/i.test(statusStrip),
    `export status strip must report a ready verify state, got "${statusStrip}"`
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

  const summaryDownloadButton = page.locator('[data-testid="ide-export-rebuild-btn"]').first();
  assert(await visible(summaryDownloadButton), 'summary download button must be visible in export hero');
  const summaryDownloadEnabled = await summaryDownloadButton.isEnabled().catch(() => false);
  assert(summaryDownloadEnabled, 'summary download button must be enabled after verify PASS');

  await summaryDownloadButton.scrollIntoViewIfNeeded();

  const summaryButtonOwnsCenterHit = await summaryDownloadButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    return Boolean(top && (top === button || button.contains(top)));
  });
  assert(
    summaryButtonOwnsCenterHit,
    'summary download button center hit-target must not be intercepted by overlapping export content'
  );

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    summaryDownloadButton.click(),
  ]);
  const suggestedName = (download.suggestedFilename?.() ?? '').toLowerCase();
  assert(
    suggestedName.endsWith('.zip'),
    `summary download should emit a zip artifact, got "${suggestedName || 'unknown'}"`
  );
});
