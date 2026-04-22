#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE project readiness contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page);
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  // Launchpad cards plus the mapping summary strip now carry readiness on Project.
  await page.waitForSelector('[data-testid="ide-project-command-strip"]', { timeout: 10000 });
  const mappingStat = page.locator('[data-testid="ide-project-mapping-stat"]').first();
  assert(await visible(mappingStat), 'project mapping status strip must render');
  assert(
    await visible(page.locator('[data-testid="ide-project-open-map-pins"]').first()),
    'project must hand mapping edits off to Map Pins'
  );

  const mappingTable = page.locator('[data-testid="ide-project-mapping-table"]').first();
  if (!(await visible(mappingTable))) {
    await page.locator('[data-testid="ide-project-mapping-expand-btn"]').click();
    await page.waitForSelector('[data-testid="ide-project-mapping-table"]', { timeout: 10000 });
  }
  const firstLockedBinding = page.locator('[data-testid^="ide-project-pin-field-"]').first();
  assert(
    await visible(firstLockedBinding),
    'project mapping rows must stay visible as read-only binding summaries'
  );
});

