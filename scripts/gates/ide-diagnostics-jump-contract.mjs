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
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-hw-map-table"]', { timeout: 10000 });

  const firstMappingRow = page.locator('[data-testid^="ide-hw-map-row-"]').first();
  assert(await firstMappingRow.isVisible().catch(() => false), 'expected Hardware map row to exist');
  await firstMappingRow.click();
  const rowSelected = await firstMappingRow.getAttribute('aria-pressed');
  assert(rowSelected === 'true', 'Hardware map row should be selectable without creating Design diagnostics');

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

  await page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const row = runtime?.projectIoRows?.find((entry) => entry.required && String(entry.pin ?? '').trim().length > 0);
    if (!runtime?.setMappingPin || !row) throw new Error('Unable to seed a mapping diagnostic.');
    runtime.setMappingPin(row.id, '');
  });
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  const exportAction = page.locator('[data-testid="ide-export-blocked-open-map-pins"]').first();
  assert(await exportAction.isVisible().catch(() => false), 'Export mapping diagnostic must expose a direct Map Pins recovery action');
  await exportAction.click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 10000 });
  assert(
    await page.locator('[data-testid="ide-hw-map-table"]').first().isVisible().catch(() => false),
    'Export mapping recovery must navigate to the Map Pins assignment table'
  );
});
