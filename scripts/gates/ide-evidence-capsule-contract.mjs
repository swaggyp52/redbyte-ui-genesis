#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').trim();
}

await runIdeGate('IDE evidence capsule contract satisfied', async ({ page, baseUrl }) => {
  console.log('[ide-evidence] boot');
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-project-auto-suggest"]').click();
  console.log('[ide-evidence] project setup complete');

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();

  await page.locator('[data-testid="ide-verify-vector-pass"]').click();
  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const label = document.querySelector('[data-testid="ide-verify-status-label"]');
      return Boolean(label && /PASS/i.test(label.textContent || ''));
    },
    undefined,
    { timeout: 10000 }
  );
  console.log('[ide-evidence] verify pass complete');

  const verifyHash = await text(page.locator('[data-testid="ide-verify-hash"]'));
  const verifyReportHash = await text(page.locator('[data-testid="ide-verify-report-hash"]'));
  assert(verifyHash.length > 0, 'verify hash must exist before capsule build');
  assert(verifyReportHash.length > 0, 'verify report hash must exist before capsule build');

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 10000 });
  const buildStateCount = await page.locator('[data-testid="ide-export-capsule-build-state"]').count();
  console.log(`[ide-evidence] build-state marker count: ${buildStateCount}`);
  console.log('[ide-evidence] export opened');

  const blockingDiagnostics = await page
    .locator('[data-testid^="ide-export-diagnostic-"].is-error')
    .allTextContents();
  assert(
    blockingDiagnostics.length === 0,
    `expected no blocking diagnostics before capsule build, got: ${blockingDiagnostics.join(' | ')}`
  );

  await page.locator('[data-testid="ide-export-build-evidence-capsule"]').click();
  console.log('[ide-evidence] capsule build clicked');
  await page.waitForTimeout(500);
  const immediateBuildState = await text(
    page.locator('[data-testid="ide-export-capsule-build-state"] span:last-child')
  );
  console.log(`[ide-evidence] immediate build state: ${immediateBuildState || '<empty>'}`);
  await page.waitForFunction(
    () => {
      const stateEl = document.querySelector('[data-testid="ide-export-capsule-build-state"] span:last-child');
      const value = (stateEl?.textContent || '').trim().toUpperCase();
      return value === 'DONE' || value === 'ERROR';
    },
    undefined,
    { timeout: 15000 }
  );
  const buildState = await text(page.locator('[data-testid="ide-export-capsule-build-state"] span:last-child'));
  const capsuleError = await text(page.locator('[data-testid="ide-export-capsule-error"]'));
  assert(
    buildState.toUpperCase() === 'DONE',
    `capsule build must end in DONE state, got "${buildState}"${capsuleError ? `: ${capsuleError}` : ''}`
  );
  assert(
    capsuleError.length === 0,
    `capsule build reported an error: ${capsuleError}`
  );
  console.log('[ide-evidence] capsule metadata published');

  const requiredFiles = [
    'MANIFEST.json',
    'BRINGUP.md',
    'EXPECTED_IO.json',
    'rb-project.json',
    'program_and_test.tcl',
    'top.vhd',
    'top.xdc',
    'testbench.vhd',
    'vectors.json',
    'verify-report.json',
  ];
  const capsuleFilesText = await text(page.locator('[data-testid="ide-export-capsule-files"] code'));
  const capsuleFiles = capsuleFilesText
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  for (const path of requiredFiles) {
    assert(capsuleFiles.includes(path), `evidence capsule missing ${path}`);
  }

  const manifestHashUi = await text(page.locator('[data-testid="ide-export-context-manifest-hash"]'));
  assert(manifestHashUi.length > 0, 'manifest hash UI marker must be visible');
  const exportVerifyHashUi = await text(page.locator('[data-testid="ide-export-context-verify-hash"]'));
  assert(verifyHash.startsWith(exportVerifyHashUi), 'export verify hash marker must match verify hash prefix');
  assert(
    verifyReportHash.startsWith('vrf_'),
    'verify report hash must use deterministic report hash prefix'
  );
  console.log('[ide-evidence] pass path assertions complete');

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-verify-vector-fail"]').click();
  await page.locator('[data-testid="ide-verify-run"]').click();
  await page.waitForFunction(
    () => {
      const label = document.querySelector('[data-testid="ide-verify-status-label"]');
      return Boolean(label && /FAIL/i.test(label.textContent || ''));
    },
    undefined,
    { timeout: 10000 }
  );

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  console.log('[ide-evidence] fail export opened');

  const blockedVisible = await page
    .locator('[data-testid="ide-export-blocked-reason"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(blockedVisible, 'blocked callout must appear when verify is failing');

  const failDiagnostic = page
    .locator('[data-testid^="ide-export-diagnostic-"]')
    .filter({ hasText: 'RBEV1001' })
    .first();
  const failDiagnosticVisible = await failDiagnostic.isVisible().catch(() => false);
  assert(failDiagnosticVisible, 'failing verify blocker diagnostic must render in export list');

  await failDiagnostic.locator('[data-testid^="ide-export-diagnostic-action-"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  console.log('[ide-evidence] fail path jump-to-fix complete');
});
