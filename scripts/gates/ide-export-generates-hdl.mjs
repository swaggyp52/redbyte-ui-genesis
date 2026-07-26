#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE export generates HDL contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-artifact-preview"]', { timeout: 10000 });

  const tabs = page.locator('[data-testid="ide-export-artifact-tabs"] button');
  const tabCount = await tabs.count();
  assert(tabCount >= 2, `expected at least two artifact tabs, got ${tabCount}`);

  const vhdlTab = page.locator('[data-testid="ide-export-file-top-vhd"]').first();
  if (await vhdlTab.isVisible().catch(() => false)) {
    await vhdlTab.click();
  }

  const previewPath = page.locator('[data-testid="ide-export-preview-path"]').first();
  assert(await visible(previewPath), 'export preview path must be visible');
  const pathText = ((await previewPath.textContent()) ?? '').trim().toLowerCase();
  assert(pathText.includes('.vhd') || pathText.includes('.v'), `expected HDL artifact path, got "${pathText}"`);

  const previewCode = page.locator('[data-testid="ide-export-preview-code"]').first();
  const previewText = ((await previewCode.textContent()) ?? '').toLowerCase();
  assert(previewText.includes('entity') || previewText.includes('architecture') || previewText.includes('module'), 'HDL preview content must include HDL keywords');
});
