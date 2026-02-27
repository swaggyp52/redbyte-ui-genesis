#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE project readiness contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  // Launchpad cards are now the readiness representation (replaced the old checklist table)
  await page.waitForSelector('[data-testid="ide-project-panel-readiness"]', { timeout: 10000 });
  const launchpadCards = await page
    .locator('[data-testid^="ide-launchpad-"]')
    .count();
  assert(launchpadCards === 3, `expected 3 launchpad cards, found ${launchpadCards}`);

  const mappingStat = page.locator('[data-testid="ide-project-mapping-stat"]').first();
  assert(await visible(mappingStat), 'project mapping status strip must render');

  await page.locator('[data-testid="ide-project-mapping-expand-btn"]').click();
  await page.waitForSelector('[data-testid="ide-project-mapping-table"]', { timeout: 10000 });

  const firstMappingInput = page.locator('[data-testid^="ide-project-map-input-"]').first();
  await firstMappingInput.fill('');
  await firstMappingInput.blur();
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="ide-project-unmapped-count"]');
    return Boolean(node && /unmapped/i.test(node.textContent || ''));
  }, { timeout: 10000 });
});

