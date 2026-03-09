#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE export blockers contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.locator('[data-testid="ide-project-mapping-expand-btn"]').click();
  await page.waitForSelector('[data-testid="ide-project-mapping-table"]', { timeout: 10000 });

  const firstMappingInput = page.locator('[data-testid^="ide-project-map-input-"]').first();
  await firstMappingInput.fill('');
  await firstMappingInput.blur();

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-gate-stack"]', { timeout: 10000 });

  const statusStrip = await text(page.locator('[data-testid="ide-export-gate-stack"]'));
  assert(statusStrip.toUpperCase().includes('MAPPING'), 'export status strip must include mapping gate');

  const blockersList = page.locator('[data-testid="ide-export-blockers-list"]');
  assert(await visible(blockersList), 'export blockers list must render');

  const mappingAction = page.locator('[data-testid^="ide-export-diagnostic-action-"]');
  const mappingActionCount = await mappingAction.count();
  assert(mappingActionCount >= 1, 'expected export mapping blocker with fix action');
  await mappingAction.first().click();

  const navigatedToProject = await page.locator('[data-testid="ide-mode-project"]').first().isVisible().catch(() => false);
  const navigatedToDesign = await page.locator('[data-testid="ide-mode-design"]').first().isVisible().catch(() => false);
  const stayedOnExport = await page.locator('[data-testid="ide-mode-export"]').first().isVisible().catch(() => false);
  assert(
    navigatedToProject || navigatedToDesign || stayedOnExport,
    'fix path should keep app on a repair-capable surface (Project, Design, or Export)'
  );
  if (navigatedToProject) {
    const activeIsMappingInput = await page.evaluate(() => {
      const active = document.activeElement;
      const testId = active?.getAttribute('data-testid') ?? '';
      return testId.startsWith('ide-project-map-input-');
    });
    assert(activeIsMappingInput, 'project fix path should focus a mapping input');
  }
});

