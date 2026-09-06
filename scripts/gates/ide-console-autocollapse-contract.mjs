#!/usr/bin/env node

// What this protects: the diagnostics console never takes the workspace on its own. It is not
// there until the student asks for it; when they do it opens as a strip, not as a panel; and
// moving between workspaces does not expand it behind their back. Only a blocking diagnostic
// may claim the room, because only a blocking diagnostic stops the work.
//
// Migrated 2026-09-06. This gate used to assume the console was always mounted and only ever
// checked which state it was in. The bottom panel became opt-in per surface preference, so the
// old assertions could not run at all - the first `count()` was 0 and every check after it was
// skipped or timed out. The behaviour above has no other owner, so the gate was retargeted to
// the opt-in path rather than retired.

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const CONSOLE = '[data-testid="ide-workbench-console"]';

async function consoleState(page) {
  const panel = page.locator(CONSOLE).first();
  if ((await page.locator(CONSOLE).count()) === 0) return 'absent';
  const attr = await panel.getAttribute('data-console-state');
  if (attr) return attr;
  const cls = (await panel.getAttribute('class')) ?? '';
  if (cls.includes('is-blocking')) return 'blocking';
  if (cls.includes('is-collapsed')) return 'collapsed';
  if (cls.includes('is-expanded')) return 'expanded';
  return 'unknown';
}

await runIdeGate('IDE console autocollapse contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=verify`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  // A workspace with no project has nothing to report and nothing to open, so the contract is
  // only meaningful once there is work on screen.
  await loadStarterProject(page);
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  // ① Nothing is wrong, so nothing takes the room.
  assert(
    (await consoleState(page)) === 'absent',
    'the console must not mount itself on a workspace with no blocking diagnostic'
  );
  const problems = page.locator('[data-testid="ide-status-problems"]').first();
  if (await problems.count()) {
    const text = ((await problems.textContent()) ?? '').trim();
    assert(
      /no problems/i.test(text),
      `with no console mounted the status bar must still report the problem count, got "${text}"`
    );
  }

  // ② Where a workspace has output to give, asking for it produces a strip.
  //    Measured 2026-09-06: Design is the workspace that offers one with a clean project;
  //    the others mount nothing at all until something needs saying, which is the same
  //    contract read from the other side.
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  const reveal = page.locator('[data-testid="ide-show-bottom-dock"]').first();
  assert(
    await reveal.count(),
    'a workspace that has a console must offer a way to open it while it is closed'
  );
  await reveal.click();
  await page.waitForSelector(CONSOLE, { timeout: 10000 });
  const opened = await consoleState(page);
  assert(
    opened === 'collapsed',
    `opening the bottom panel must give a collapsed strip, not an expanded panel, got "${opened}"`
  );

  // The shell root and the panel must agree; they used to disagree, with the root reporting
  // "expanded" for a panel that was a 28px strip.
  const rootState = await page
    .locator('[data-testid="ide-mode-design"]')
    .first()
    .getAttribute('data-console-state');
  assert(
    rootState === opened,
    `the shell root says the console is "${rootState}" while the console says "${opened}"`
  );

  // ③ Moving to another workspace does not expand it.
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  const afterMove = await consoleState(page);
  assert(
    afterMove === 'collapsed' || afterMove === 'blocking' || afterMove === 'absent',
    `changing workspace must not expand the console; it must stay a strip unless something blocks, got "${afterMove}"`
  );
});
