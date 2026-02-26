#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE export artifact explorer contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 15000 });

  const tree = page.locator('[data-testid="ide-export-artifact-tabs"]').first();
  const preview = page.locator('[data-testid="ide-export-artifact-preview"]').first();
  assert(await visible(tree), 'export artifact tree must render');
  assert(await visible(preview), 'export artifact preview must render');

  const treeItems = page.locator('[data-testid^="ide-export-artifact-tab-"]');
  const itemCount = await treeItems.count();
  assert(itemCount >= 2, `expected at least 2 artifact tree items, got ${itemCount}`);

  const initialPath = await text(page.locator('[data-testid="ide-export-preview-path"]'));
  await treeItems.nth(1).click();
  await page.waitForFunction(
    (before) => {
      const marker = document.querySelector('[data-testid="ide-export-preview-path"]');
      if (!marker) return false;
      return (marker.textContent || '').trim() !== before.trim();
    },
    initialPath,
    { timeout: 10000 }
  );
  const nextPath = await text(page.locator('[data-testid="ide-export-preview-path"]'));
  assert(nextPath.length > 0, 'export preview path must remain populated after selecting tree item');
  assert(nextPath !== initialPath, 'selecting a tree item must update active preview');
});
