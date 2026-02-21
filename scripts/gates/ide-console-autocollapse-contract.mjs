#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE console autocollapse contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  const consolePanel = page.locator('[data-testid="ide-workbench-console"]').first();
  assert(await visible(consolePanel), 'workbench console must be visible');

  const initialStateAttr = await consolePanel.getAttribute('data-console-state');
  const initialClass = await consolePanel.getAttribute('class');
  const initialState =
    initialStateAttr ??
    (initialClass?.includes('is-collapsed') ? 'collapsed' : initialClass?.includes('is-expanded') ? 'expanded' : null);
  const initialBox = await consolePanel.boundingBox();
  assert(initialState === 'collapsed', `console must start collapsed, got "${initialState ?? ''}"`);
  assert(Boolean(initialBox), 'initial console bounding box unavailable');
  assert(initialBox.height <= 52, `collapsed console must be compact (<=52px), got ${initialBox.height}`);

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const expandedStateAttr = await consolePanel.getAttribute('data-console-state');
  const expandedClass = await consolePanel.getAttribute('class');
  const expandedState =
    expandedStateAttr ??
    (expandedClass?.includes('is-collapsed') ? 'collapsed' : expandedClass?.includes('is-expanded') ? 'expanded' : null);
  const expandedBox = await consolePanel.boundingBox();
  assert(
    expandedState === 'blocking' || expandedState === 'expanded',
    `console must expand when diagnostics/errors are present, got "${expandedState ?? ''}"`
  );
  assert(Boolean(expandedBox), 'expanded console bounding box unavailable');
  assert(expandedBox.height >= 120, `expanded console must provide usable space (>=120px), got ${expandedBox.height}`);
});
