#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE export download contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 10000 });

  const downloadAllVisible = await page
    .locator('[data-testid="ide-export-download-all"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(downloadAllVisible, 'download-all export action must be visible');

  const readmePreviewVisible = await page
    .locator('[data-testid="ide-export-readme-preview"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(readmePreviewVisible, 'README preview section must be visible');

  const vivadoChecklistVisible = await page
    .locator('[data-testid="ide-export-vivado-checklist"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(vivadoChecklistVisible, 'Vivado checklist must be visible');
});
