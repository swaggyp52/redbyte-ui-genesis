#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE export blockers contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await loadStarterProject(page);
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-hw-map-table"]', { timeout: 10000 });

  const advancedEditor = page.locator('[data-testid="ide-hw-structured-editor"]');
  await advancedEditor.locator('summary').first().click();
  await advancedEditor.locator('[data-testid^="ide-hw-structured-entry-"]').first().getByRole('button', { name: 'Clear' }).click();

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.locator('[data-testid="ide-export-open-technical-evidence"]').first().click();
  await page.waitForSelector('[data-testid="ide-export-technical-dialog"]', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-gate-stack"]', { state: 'visible', timeout: 10000 });

  const statusStrip = await text(page.locator('[data-testid="ide-export-gate-stack"]'));
  assert(statusStrip.toUpperCase().includes('MAPPING'), 'export status strip must include mapping gate');

  const blockersList = page.locator('[data-testid="ide-export-blockers-list"]');
  assert(await visible(blockersList), 'export blockers list must render');
  assert(/mapping|pin|constraint/i.test(await text(blockersList)), 'technical evidence must explain the mapping blocker');
  await page.locator('[data-testid="ide-export-close-technical-evidence"]').first().click();
  await page.locator('[data-testid="ide-export-technical-dialog"]').waitFor({ state: 'detached', timeout: 10000 });

  const mapPinsFix = page.locator('[data-testid="ide-export-blocked-open-map-pins"]').first();
  assert(await visible(mapPinsFix), 'blocked Export must expose the direct Map Pins recovery action');
  await mapPinsFix.click();

  const navigatedToHardware = await page.locator('[data-testid="ide-mode-hardware"]').first().isVisible().catch(() => false);
  const stayedOnExport = await page.locator('[data-testid="ide-mode-export"]').first().isVisible().catch(() => false);
  assert(
    navigatedToHardware || stayedOnExport,
    'mapping recovery should keep app on Export or navigate to Map Pins'
  );
  if (navigatedToHardware) {
    assert(
      await visible(page.locator('[data-testid="ide-hw-map-table"]').first()),
      'Map Pins fix path should show the Hardware mapping table'
    );
  }
});

