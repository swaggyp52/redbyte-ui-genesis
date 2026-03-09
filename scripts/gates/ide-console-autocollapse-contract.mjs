#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE console autocollapse contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const consolePanel = page.locator('[data-testid="ide-workbench-console"]').first();
  const consoleCount = await page.locator('[data-testid="ide-workbench-console"]').count();
  assert(consoleCount >= 1, 'workbench console must exist');

  const initialStateAttr = await consolePanel.getAttribute('data-console-state');
  const initialClass = await consolePanel.getAttribute('class');
  const initialState =
    initialStateAttr ??
    (initialClass?.includes('is-collapsed') ? 'collapsed' : initialClass?.includes('is-expanded') ? 'expanded' : null);
  assert(initialState === 'collapsed', `console must start collapsed, got "${initialState ?? ''}"`);

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const expandedStateAttr = await consolePanel.getAttribute('data-console-state');
  const expandedClass = await consolePanel.getAttribute('class');
  const expandedState =
    expandedStateAttr ??
    (expandedClass?.includes('is-collapsed') ? 'collapsed' : expandedClass?.includes('is-expanded') ? 'expanded' : null);
  assert(
    expandedState === 'blocking' || expandedState === 'expanded',
    `console must expand when diagnostics/errors are present, got "${expandedState ?? ''}"`
  );
});
