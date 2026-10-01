#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE route contract satisfied', async ({ page, baseUrl }) => {
  const consoleLines = [];
  page.on('console', (message) => consoleLines.push(message.text()));
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));

  // This contract owns the literal default route and its launcher query.
  // The shared harness may resolve its IDE base to /os; retain origin-root proof.
  const rootUrl = new URL(baseUrl).origin;
  // The former desktop launcher was deleted with rb-shell (9f31efe95).
  // Keep exercising the old query: it must not restore a parallel shell or
  // bypass the current IDE boot/navigation contract.
  for (const entryPath of ['/', '/?launcher=1']) {
    const consoleStart = consoleLines.length;
    await page.goto(rootUrl + entryPath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await page.getByTestId('ide-root').waitFor({ state: 'visible', timeout: 15000 });
    if (entryPath.includes('launcher')) {
      assert(new URL(page.url()).searchParams.get('launcher') === '1',
        'legacy launcher query must reach the current entry without being discarded');
    }
    const rail = page.getByTestId('ide-workspace-rail');
    assert(await visible(rail), entryPath + ': current workspace navigation must be visible');
    const stages = await rail.locator('[role="tablist"] [role="tab"]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('data-testid')));
    assert(JSON.stringify(stages) === JSON.stringify(['project', 'design', 'verify', 'hardware', 'export'].map(mode => 'mode-button-' + mode)),
      entryPath + ': exactly five ordered student workflow stages must be visible');
    assert(await visible(rail.getByTestId('mode-button-import')), entryPath + ': Import / Recover must remain a reachable utility');
    assert(await rail.locator('[role="tablist"] [data-testid="mode-button-import"]').count() === 0,
      entryPath + ': Import / Recover must remain separate from the student workflow');

    const mode = await page.evaluate(() => document.documentElement.getAttribute('data-redbyte-mode'));
    assert(mode === 'ide', entryPath + ': expected data-redbyte-mode="ide", received ' + mode);
    assert(await page.getByTestId('desktop-shell').count() === 0 && !await visible(page.getByTestId('desktop-shell')),
      entryPath + ': retired desktop shell must not mount');
    assert(consoleLines.slice(consoleStart).some(line => line.includes('[RB_BOOT] mode=IDE') &&
      line.includes('entry=ide-bootstrap.ts') && line.includes('config=vite.config.ts')),
      entryPath + ': missing fresh IDE boot proof log with config=vite.config.ts');
  }
});
