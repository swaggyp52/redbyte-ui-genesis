#!/usr/bin/env node
import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE shell chrome contract satisfied', async ({ page, baseUrl }) => {
  await page.addInitScript(() => localStorage.setItem('rb-onboarding-v1-seen', '1'));
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="ide-root"]').waitFor();
  const topbar = page.locator('[data-testid="ide-top-bar"]');
  const rail = page.locator('[data-testid="ide-workspace-rail"]');
  assert(await visible(topbar) && await visible(rail), 'command bar and stage navigation must be visible');
  assert((await topbar.boundingBox()).height <= 56, 'command chrome must remain compact');
  assert((await rail.boundingBox()).width <= 80, 'stage rail must not consume the workspace');
  const stages = rail.locator('[role="tablist"] [role="tab"]');
  const expected = ['project', 'design', 'verify', 'hardware', 'export'];
  assert(await stages.count() === expected.length, 'workflow must contain exactly five ordered stages');
  const ids = await stages.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid')));
  assert(JSON.stringify(ids) === JSON.stringify(expected.map(mode => `mode-button-${mode}`)), 'workflow order must follow Project to Build & Export');
  const importUtility = rail.locator('[data-testid="mode-button-import"]');
  assert(await visible(importUtility), 'Import utility must be reachable');
  assert(await rail.locator('[role="tablist"] [data-testid="mode-button-import"]').count() === 0, 'Import must remain separate from the five-stage workflow');
  assert(await visible(page.locator('[data-testid="ide-menubar"]')), 'file and workspace commands must remain accessible');
  for (const mode of [...expected, 'import']) {
    const tab = page.locator(`[data-testid="mode-button-${mode}"]`);
    await tab.focus();
    await page.keyboard.press('Enter');
    await page.locator(`[data-testid="ide-mode-${mode}"]`).waitFor({ state: 'visible' });
    assert(await tab.getAttribute(mode === 'import' ? 'data-state' : 'aria-selected') === (mode === 'import' ? 'current' : 'true'), `${mode}: active navigation must agree with the workspace`);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="ide-mode-import"]').waitFor();
  assert(await page.locator('[data-testid="mode-button-import"]').getAttribute('data-state') === 'current', 'reload must preserve active utility navigation');
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert(overflow <= 1, `shell must remain within viewport (${overflow}px overflow)`);
});
