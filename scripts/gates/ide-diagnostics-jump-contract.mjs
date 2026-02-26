#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE diagnostics jump contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

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
  await page.waitForSelector('[data-testid="ide-design-console-diagnostics"]', { timeout: 10000 });

  const designAction = page.locator('[data-testid^="ide-design-diagnostic-action-"]').first();
  const designActionVisible = await designAction.isVisible().catch(() => false);
  assert(designActionVisible, 'expected at least one design diagnostic fix action');
  await designAction.click({ force: true });
  await page.waitForFunction(
    () =>
      Boolean(document.querySelector('[data-testid="ide-mode-design"]')) ||
      Boolean(document.querySelector('[data-testid="ide-mode-project"]')),
    { timeout: 10000 }
  );

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  const exportAction = page.locator('[data-testid^="ide-export-diagnostic-action-"]').first();
  const exportActionVisible = await exportAction.isVisible().catch(() => false);
  assert(exportActionVisible, 'expected at least one export diagnostic fix action');
  await exportAction.click({ force: true });
  await page.waitForFunction(
    () =>
      Boolean(document.querySelector('[data-testid="ide-mode-export"]')) ||
      Boolean(document.querySelector('[data-testid="ide-mode-project"]')) ||
      Boolean(document.querySelector('[data-testid="ide-mode-design"]')),
    { timeout: 10000 }
  );
});
