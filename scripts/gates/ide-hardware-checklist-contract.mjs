#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE hardware checklist contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  // The checklist is a property of a design with boundary I/O: a fresh profile opens on the
  // blank home project, whose Board has nothing to map and offers no after-mapping tools, so
  // the gate first opens a starter the way a student does.
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.waitForSelector(
    '[data-testid="ide-project-import-primary"], [data-testid="ide-project-continue-cta"], [data-testid^="ide-project-landing-example-"]',
    { timeout: 10000 },
  );
  await loadStarterProject(page, { preferredLabStarterTestId: 'ide-project-landing-example-signal-tour' });

  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });
  await page.locator('[data-testid="ide-hw-after-mapping-tools"]').first().waitFor({ state: 'visible', timeout: 15000 });
  // Board Check is the board-side checklist: it walks the recorded vectors step by step at the
  // board, or offers to generate them. Pre-flight - a fourth mode that restated Package's trust
  // state and the Vivado handoff here - is retired; that reading belongs to Build & Export.
  await page.locator('[data-testid="ide-hw-mode-btn-bringup"]').first().click();

  // The checklist lives in the left support dock, which a fresh profile opens collapsed; the
  // strip's own control reveals it (the persisted preference is the reader's, not the gate's).
  const checklist = page.locator('[data-testid="ide-hw-bringup-dock"]');
  if (!(await visible(checklist))) {
    const showLeftDock = page.locator('[data-testid="ide-show-left-dock"]').first();
    if (await visible(showLeftDock)) {
      await showLeftDock.click();
      await checklist.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    }
  }
  const stepOrGenerate = page
    .locator('[data-testid="ide-hw-bringup-step"], [data-testid="ide-hw-bringup-generate"]')
    .first();
  const ifWrong = page.locator('[data-testid="ide-hw-mode-toggle"]');

  assert(await visible(checklist), 'hardware checklist panel must render');
  assert(
    await visible(stepOrGenerate),
    'hardware checklist must show a step to perform or the way to generate its vectors',
  );
  assert(await visible(ifWrong), 'hardware if-wrong panel must render');
});
