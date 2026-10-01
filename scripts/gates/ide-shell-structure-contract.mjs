#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE shell structure contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  const topBar = page.locator('[data-testid="ide-top-bar"]').first();
  const leftRail = page.locator('[data-testid="ide-workspace-rail"]').first();
  assert(await visible(topBar), 'top bar must be visible on IDE route');
  assert(await visible(leftRail), 'workspace navigation rail must be visible on IDE route');
  const workflow = ['project', 'design', 'verify', 'hardware', 'export'];
  const stageButtons = leftRail.locator('[role="tablist"] [role="tab"]');
  const stageIds = await stageButtons.evaluateAll(elements => elements.map(element => element.getAttribute('data-testid')));
  assert(JSON.stringify(stageIds) === JSON.stringify(workflow.map(mode => `mode-button-${mode}`)),
    'workspace rail must contain exactly five ordered student stages');
  assert(await leftRail.locator('[role="tablist"] [data-testid="mode-button-import"]').count() === 0,
    'Import / Recover must remain a separate reachable utility');
  assert(await visible(leftRail.locator('[data-testid="mode-button-import"]')), 'Import / Recover utility must be visible');

  const shellCount = await page.locator('[data-testid="desktop-shell"]').count();
  assert(shellCount === 0, 'desktop shell must not mount on default IDE route');

  const modeRoot = page.locator('[data-testid="ide-mode-project"]').first();
  assert(await visible(modeRoot), 'project mode marker must be visible');

  for (const mode of [...workflow, 'import']) {
    const button = leftRail.locator(`[data-testid="mode-button-${mode}"]`);
    await button.focus();
    await page.keyboard.press('Enter');
    await page.locator(`[data-testid="ide-mode-${mode}"]`).waitFor({ state: 'visible' });
    assert(await visible(topBar) && await visible(leftRail), `${mode}: shell navigation must remain visible`);
    if (mode === 'import') {
      assert(await button.getAttribute('data-state') === 'current' && await button.getAttribute('aria-current') === 'page',
        'utility active marker must agree with the Import surface');
      assert(await leftRail.locator('[role="tablist"] [data-active="true"]').count() === 0,
        'Import utility must not mark a student stage active');
    } else {
      assert(await button.getAttribute('data-active') === 'true' && await button.getAttribute('aria-selected') === 'true',
        `${mode}: active navigation marker must agree with the visible surface`);
      assert(await leftRail.locator('[role="tablist"] [data-active="true"]').count() === 1,
        `${mode}: exactly one student stage must be active`);
    }
  }
});
