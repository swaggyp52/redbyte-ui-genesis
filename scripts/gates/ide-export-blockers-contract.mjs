#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE export blockers contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  const firstMappingInput = page.locator('[data-testid^="ide-project-map-input-"]').first();
  await firstMappingInput.fill('');
  await firstMappingInput.blur();

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-status-strip"]', { timeout: 10000 });

  const statusStrip = await text(page.locator('[data-testid="ide-export-status-strip"]'));
  assert(statusStrip.toUpperCase().includes('BLOCKED'), 'export status strip must report BLOCKED');

  const blockersList = page.locator('[data-testid="ide-export-blockers-list"]');
  assert(await visible(blockersList), 'export blockers list must render');

  const mappingAction = page.locator(
    'article:has([data-diagnostic-code^="RBEX1"]) [data-testid^="ide-export-diagnostic-action-"]'
  );
  const mappingActionCount = await mappingAction.count();
  assert(mappingActionCount >= 1, 'expected export mapping blocker with fix action');
  await mappingAction.first().click();

  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  const activeIsMappingInput = await page.evaluate(() => {
    const active = document.activeElement;
    const testId = active?.getAttribute('data-testid') ?? '';
    return testId.startsWith('ide-project-map-input-');
  });
  assert(activeIsMappingInput, 'fix path should focus project mapping input');
});
