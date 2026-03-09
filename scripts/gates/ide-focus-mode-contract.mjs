#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE focus mode contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  // Ensure focus mode is off at start (clear any persisted state)
  await page.evaluate(() => {
    window.localStorage.removeItem('rb.ide.workbench.focus.design');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  // Measure workspace and docks in normal mode
  const workspaceBefore = await page
    .locator('[data-testid="ide-mode-body"]').first().boundingBox();
  assert(workspaceBefore !== null, 'workspace must have bounding box in normal mode');

  const leftDockBefore = await page
    .locator('[data-testid="ide-left-dock"]').first().boundingBox();
  assert(leftDockBefore !== null && leftDockBefore.width > 0, 'left dock must be visible in normal mode');

  const rightDockBefore = await page
    .locator('[data-testid="ide-inspector"]').first().boundingBox();
  assert(rightDockBefore !== null && rightDockBefore.width > 0, 'right dock must be visible in normal mode');

  // Enter focus mode
  await page.locator('[data-testid="ide-workbench-focus-toggle"]').click();
  await page.waitForTimeout(100);

  // Shell must have data-focus-mode="1"
  const focusAttr = await page
    .locator('[data-testid="ide-mode-design"]').first().getAttribute('data-focus-mode');
  assert(focusAttr === '1', `data-focus-mode must be "1" after entering focus, got "${focusAttr}"`);

  // Workspace must be wider
  const workspaceAfter = await page
    .locator('[data-testid="ide-mode-body"]').first().boundingBox();
  assert(
    workspaceAfter !== null && workspaceAfter.width > workspaceBefore.width,
    `workspace must be wider in focus mode (before: ${workspaceBefore.width}, after: ${workspaceAfter?.width})`
  );

  // Left and right docks must be hidden
  const leftDockAfter = await page
    .locator('[data-testid="ide-left-dock"]').first().boundingBox();
  assert(
    leftDockAfter === null || leftDockAfter.width === 0,
    `left dock must be hidden in focus mode (got width: ${leftDockAfter?.width})`
  );

  const rightDockAfter = await page
    .locator('[data-testid="ide-inspector"]').first().boundingBox();
  assert(
    rightDockAfter === null || rightDockAfter.width === 0,
    `right dock must be hidden in focus mode (got width: ${rightDockAfter?.width})`
  );

  // Exit focus mode
  await page.locator('[data-testid="ide-workbench-focus-toggle"]').click();
  await page.waitForTimeout(100);

  const focusAttrAfterExit = await page
    .locator('[data-testid="ide-mode-design"]').first().getAttribute('data-focus-mode');
  assert(focusAttrAfterExit === '0', `data-focus-mode must be "0" after exiting focus, got "${focusAttrAfterExit}"`);

  const leftDockRestored = await page
    .locator('[data-testid="ide-left-dock"]').first().boundingBox();
  assert(
    leftDockRestored !== null && leftDockRestored.width > 0,
    'left dock must be visible again after exiting focus mode'
  );
});
