#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function text(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').trim();
}

await runIdeGate('IDE evidence capsule contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  assert(await setVerifyRunMode(page, 'compare'), 'evidence capsule gate requires Compare checks before Export trust inspection');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 10000 });
  const packageInspector = page.locator('[data-testid="ide-export-package-inspector-v1"]').first();
  const packageState = await packageInspector.getAttribute('data-export-package-state');
  assert(/ready|draft|blocked/i.test(packageState ?? ''), `export package state must be materialized, got "${packageState}"`);
  assert(/E0/i.test(await text(page.locator('[data-testid="ide-export-e0-boundary-summary"]'))), 'Export must expose the browser-E0 evidence boundary');

  await page.locator('[data-testid="ide-export-open-technical-evidence"]').first().click();
  await page.waitForSelector('[data-testid="ide-export-technical-dialog"]', { state: 'visible', timeout: 10000 });
  const verifyProvenance = await text(page.locator('[data-testid="ide-export-gate-verify"]'));
  assert(/Verify evidence/i.test(verifyProvenance) && /Ready|Current/i.test(verifyProvenance), `technical evidence must show current Compare provenance, got "${verifyProvenance}"`);
  assert(await page.locator('[data-testid="ide-export-deterministic-checks"]').first().isVisible(), 'deterministic package checks must be visible');
  assert(await page.locator('[data-testid="ide-export-copy-report"]').first().isVisible(), 'copy debug report action must be visible');
  assert(await page.locator('[data-testid="ide-export-blockers-list"]').first().isVisible(), 'technical diagnostics must be visible');
});
