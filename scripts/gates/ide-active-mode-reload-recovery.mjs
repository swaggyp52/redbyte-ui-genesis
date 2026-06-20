#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}

function activeModeFromUrl(page) {
  return new URL(page.url()).searchParams.get('mode');
}

async function assertModeRouteAndReload(page, mode, label) {
  await assertModeRoute(page, mode, label);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await assertModeRoute(page, mode, `${label} after reload`);
}

async function assertModeRoute(page, mode, label) {
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });

  const routeMode = activeModeFromUrl(page);
  assert(
    routeMode === mode,
    `${label} should sync route mode=${mode}; got ${routeMode ?? '(missing)'} at ${page.url()}`
  );

  const topbarMode = await text(page.locator('[data-testid="ide-topbar-mode-label"]'));
  assert(
    topbarMode.toLowerCase() === (mode === 'hardware' ? 'map pins' : mode),
    `${label} should show ${mode}; topbar showed "${topbarMode}"`
  );
}

async function clickModeAndAssert(page, mode, label) {
  await page.locator(`[data-testid="mode-button-${mode}"]`).click();
  await assertModeRoute(page, mode, label);
}

async function navigateHistoryAndAssert(page, direction, mode, label) {
  if (direction === 'back') {
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null);
  } else {
    await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => null);
  }
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await assertModeRoute(page, mode, label);
}

await runIdeGate('IDE active mode reload recovery satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=active-mode-reload-recovery`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await assertModeRouteAndReload(page, 'design', 'Project starter load');

  await page.locator('[data-testid="mode-button-verify"]').click();
  await assertModeRouteAndReload(page, 'verify', 'Left rail Verify navigation');

  await clickModeAndAssert(page, 'project', 'Left rail Project navigation');
  await clickModeAndAssert(page, 'design', 'Left rail Design navigation');
  await clickModeAndAssert(page, 'verify', 'Left rail Verify navigation before history');

  await navigateHistoryAndAssert(page, 'back', 'design', 'Browser Back from Verify');
  await navigateHistoryAndAssert(page, 'back', 'project', 'Browser Back from Design');
  await navigateHistoryAndAssert(page, 'forward', 'design', 'Browser Forward to Design');
  await navigateHistoryAndAssert(page, 'forward', 'verify', 'Browser Forward to Verify');
});
