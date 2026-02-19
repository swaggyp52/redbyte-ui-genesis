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

  const q2MappingInput = page.locator('[data-testid="ide-project-map-input-q2"]');
  const q2Exists = (await q2MappingInput.count()) > 0;
  assert(q2Exists, 'expected deterministic q2 mapping input in Project mode');

  await q2MappingInput.fill('');
  const dirtySinceExport = await text(page.locator('[data-testid="ide-project-dirty-since-export"]'));
  assert(
    dirtySinceExport === 'DIRTY',
    `expected dirty-since-export indicator to become DIRTY, got "${dirtySinceExport}"`
  );

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-console-diagnostics"]', { timeout: 10000 });

  const designDiagnosticRow = page
    .locator('[data-testid^="ide-design-diagnostic-"]')
    .filter({ hasText: 'q2' })
    .first();
  const designDiagnosticVisible = await designDiagnosticRow.isVisible().catch(() => false);
  assert(designDiagnosticVisible, 'expected a q2 diagnostic in Design diagnostics drawer');

  await designDiagnosticRow.locator('[data-testid^="ide-design-diagnostic-action-"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('data-testid') === 'ide-project-map-input-q2',
    { timeout: 10000 }
  );

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  const exportDiagnosticRow = page
    .locator('[data-testid^="ide-export-diagnostic-"]')
    .filter({ hasText: 'q2' })
    .first();
  const exportDiagnosticVisible = await exportDiagnosticRow.isVisible().catch(() => false);
  assert(exportDiagnosticVisible, 'expected a q2 diagnostic in Export diagnostics list');

  await exportDiagnosticRow.locator('[data-testid^="ide-export-diagnostic-action-"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('data-testid') === 'ide-project-map-input-q2',
    { timeout: 10000 }
  );
});
