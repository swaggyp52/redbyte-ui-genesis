#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function ensureVerifyVectorsReady(page) {
  const candidates = [
    '[data-testid="ide-verify-generate-basic-vectors"]',
    '[data-testid="ide-verify-generate-basic-vectors-footer"]',
    '[data-testid="ide-verify-generate-all-combos"]',
    '[data-testid="ide-verify-guided-clock-pattern"]',
    '[data-testid="ide-verify-trace-generate-basics"]',
  ];
  for (const selector of candidates) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      await button.click();
      return;
    }
  }
}

await runIdeGate('IDE export download contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await ensureVerifyVectorsReady(page);
  const runSelectors = [
    '[data-testid="ide-vcb-run"]',
    '[data-testid="ide-verify-run"]',
    '[data-testid="ide-verify-run-secondary"]',
    '[data-testid="ide-verify-empty-run"]',
  ];
  let runClicked = false;
  for (const selector of runSelectors) {
    const candidate = page.locator(selector).first();
    const isVisible = await candidate.isVisible().catch(() => false);
    if (isVisible) {
      await candidate.click();
      runClicked = true;
      break;
    }
  }
  assert(runClicked, 'verify run button must be visible before export checks');
  await waitForVerifyResult(page, { timeout: 15000 });

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 10000 });

  const inspector = page.locator('[data-testid="ide-export-package-inspector-v1"]').first();
  assert(await inspector.isVisible().catch(() => false), 'Export readiness hero must be visible');
  const packageState = await inspector.getAttribute('data-export-package-state');
  assert(['draft', 'ready'].includes(packageState ?? ''), `Export must expose a buildable package state, got ${packageState}`);

  const currentAction = page.locator(
    '[data-testid="ide-export-package-build-v1"], [data-testid="ide-export-package-download-v1"]'
  );
  assert((await currentAction.count()) === 1, 'Export must expose exactly one current build/download action');
  assert(await currentAction.first().isVisible().catch(() => false), 'current build/download action must be visible');
  assert(!(await currentAction.first().isDisabled().catch(() => true)), 'current build/download action must be enabled');

  // Build & Export opens on the handoff dossier now - the thing the student came to produce -
  // and the artifact browser is the second document, reached from it. The boundary line and the
  // file list both live there, so the gate opens Artifacts the way a reader would.
  const openFiles = page.locator('[data-testid="ide-package-handoff-open-files"]').first();
  if (await openFiles.count()) {
    await openFiles.click();
    await page.waitForTimeout(400);
  }

  const e0Boundary = await page.locator('[data-testid="ide-export-e0-boundary-summary"]').first().textContent();
  assert(/Browser E0/i.test(e0Boundary ?? ''), 'Export readiness must name Browser E0 package generation');
  assert(/external/i.test(e0Boundary ?? ''), 'Export readiness must keep Vivado and board proof external');

  const packageFiles = page.locator('[data-testid="ide-export-package-files"]').first();
  await packageFiles.waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid="ide-export-file-browser"]').first().waitFor({ state: 'visible', timeout: 10000 });

  const readme = page.locator('[data-testid="ide-export-file-readme-txt"]').first();
  assert(await readme.isVisible().catch(() => false), 'README.txt must be available in generated files');
  await readme.click();
  await page.waitForFunction(
    () => (document.querySelector('[data-testid="ide-export-preview-path"]')?.textContent ?? '').trim() === 'README.txt',
    { timeout: 10000 }
  );
  const readmePreview = await page.locator('[data-testid="ide-export-preview-code"]').first().textContent();
  assert(/E0/i.test(readmePreview ?? ''), 'README preview must state the E0 package boundary');
  assert(/Vivado/i.test(readmePreview ?? ''), 'README preview must retain downstream Vivado guidance');

  const checklist = await page.locator('[data-testid="ide-export-upstream-readiness"]').first().textContent();
  assert(/Board & Constraints/i.test(checklist ?? ''), 'readiness details must retain Board & Constraints status');
});

