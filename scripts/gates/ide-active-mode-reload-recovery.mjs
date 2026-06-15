#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}

function activeModeFromUrl(page) {
  return new URL(page.url()).searchParams.get('mode');
}

async function assertModeRouteAndReload(page, mode, label) {
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });

  const routeMode = activeModeFromUrl(page);
  assert(
    routeMode === mode,
    `${label} should sync route mode=${mode} before reload; got ${routeMode ?? '(missing)'}`
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });

  const topbarMode = await text(page.locator('[data-testid="ide-topbar-mode-label"]'));
  assert(
    topbarMode.toLowerCase() === (mode === 'hardware' ? 'map pins' : mode),
    `${label} should restore ${mode} after reload; topbar showed "${topbarMode}"`
  );
}

await runIdeGate('IDE active mode reload recovery satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => {
    localStorage.clear();
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
});
