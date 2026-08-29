#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

// Semantic contract: the application exposes exactly ONE visible <main>
// landmark per screen. The workbench shell owns it (ide-mode-body); nested
// workbench content must use section/article/aside/div. The lazy-loading
// fallback substitutes for the shell main while a surface chunk loads and is
// therefore also a single landmark, never an extra one.

async function countVisibleMains(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('main')).filter((el) => {
      if (el.closest('[hidden]')) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return el.getClientRects().length > 0;
    }).length
  );
}

async function assertSingleMain(page, label) {
  const count = await countVisibleMains(page);
  assert(count === 1, `${label}: expected exactly one visible main landmark, got ${count}`);
}

await runIdeGate('IDE exposes one visible main landmark per screen', async ({ page, baseUrl }) => {
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await assertSingleMain(page, 'Project (cold start)');

  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.locator('[data-testid="mode-button-project"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await assertSingleMain(page, 'Project (loaded)');

  const modes = [
    ['design', 'ide-mode-design'],
    ['verify', 'ide-mode-verify'],
    ['hardware', 'ide-mode-hardware'],
    ['export', 'ide-mode-export'],
  ];
  for (const [mode, marker] of modes) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).first().click();
    await page.waitForSelector(`[data-testid="${marker}"]`, { timeout: 15000 });
    // Allow the lazy surface chunk to finish so the shell main is the landmark.
    await page.waitForTimeout(400);
    await assertSingleMain(page, mode);
  }
});
