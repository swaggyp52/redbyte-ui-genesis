#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE diagnostics jump contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-project-mapping-expand-btn"]').click();
  await page.waitForSelector('[data-testid="ide-project-mapping-table"]', { timeout: 10000 });

  const firstMappingInput = page.locator('[data-testid^="ide-project-map-input-"]').first();
  const firstMappingExists = (await firstMappingInput.count()) > 0;
  assert(firstMappingExists, 'expected project mapping input to exist');

  await firstMappingInput.fill('');
  const dirtySinceExport = await text(page.locator('[data-testid="ide-project-dirty-since-export"]'));
  assert(
    dirtySinceExport === 'DIRTY',
    `expected dirty-since-export indicator to become DIRTY, got "${dirtySinceExport}"`
  );

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  const designConsoleCount = await page.locator('[data-testid="ide-design-console-diagnostics"]').count();
  assert(
    designConsoleCount === 0,
    'mapping-only drift should not fabricate Design compiler diagnostics'
  );

  const designAction = page.locator('[data-testid^="ide-design-diagnostic-action-"]').first();
  const designActionVisible = await designAction.isVisible().catch(() => false);
  if (designActionVisible) {
    await designAction.click({ force: true });
    await page.waitForFunction(
      () =>
        Boolean(document.querySelector('[data-testid="ide-mode-design"]')) ||
        Boolean(document.querySelector('[data-testid="ide-mode-project"]')),
      { timeout: 10000 }
    );
  }

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  const exportAction = page.locator('[data-testid^="ide-export-diagnostic-action-"]').first();
  const exportActionVisible = await exportAction.isVisible().catch(() => false);
  if (exportActionVisible) {
    await exportAction.click({ force: true });
    await page.waitForFunction(
      () =>
        Boolean(document.querySelector('[data-testid="ide-mode-export"]')) ||
        Boolean(document.querySelector('[data-testid="ide-mode-project"]')) ||
        Boolean(document.querySelector('[data-testid="ide-mode-design"]')),
      { timeout: 10000 }
    );
  }
});
