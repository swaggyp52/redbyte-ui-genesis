#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

// Default student entries must boot the current IDE without exposing the retired
// launcher modal. The harness owns a preview when no explicit gate URL is given.
await runIdeGate('IDE default launcher hidden contract satisfied', async ({ page, baseUrl }) => {
  const consoleLines = [];
  page.on('console', message => consoleLines.push(message.text()));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  const origin = new URL(baseUrl).origin;
  for (const entryPath of ['/', '/os/']) {
    const consoleStart = consoleLines.length;
    await page.goto(origin + entryPath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await page.getByTestId('ide-root').waitFor({ state: 'visible', timeout: 15000 });
    const rail = page.getByTestId('ide-workspace-rail');
    assert(await visible(rail), entryPath + ': current IDE navigation must be visible');
    const stageIds = await rail.locator('[role="tablist"] [role="tab"]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('data-testid')));
    assert(JSON.stringify(stageIds) === JSON.stringify(['project', 'design', 'verify', 'hardware', 'export'].map(mode => 'mode-button-' + mode)),
      entryPath + ': exactly five ordered student workflow stages must be available');
    assert(await visible(rail.getByTestId('mode-button-import')), entryPath + ': Import / Recover utility must be reachable');
    assert(await rail.locator('[role="tablist"] [data-testid="mode-button-import"]').count() === 0,
      entryPath + ': Import / Recover utility must stay separate from student stages');
    const mode = await page.evaluate(() => document.documentElement.getAttribute('data-redbyte-mode'));
    assert(mode === 'ide', entryPath + ': default route must boot IDE mode, got ' + mode);
    assert(consoleLines.slice(consoleStart).some(line => line.includes('[RB_BOOT] mode=IDE') &&
      line.includes('entry=ide-bootstrap.ts') && line.includes('config=vite.config.ts')),
      entryPath + ': fresh IDE boot proof must identify its current entry and config');
    assert(!await visible(page.locator('[data-app-id="launcher"]')),
      entryPath + ': launcher app must remain hidden on default load');
    assert(!await visible(page.getByTestId('app-grid')),
      entryPath + ': launcher app grid must remain hidden on default load');
    assert(await page.getByTestId('desktop-shell').count() === 0,
      entryPath + ': retired desktop shell must not mount');
  }
});
