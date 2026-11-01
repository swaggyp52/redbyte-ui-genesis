#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

// What this protects: the mode rail is a stable spine. It is always visible, it does not
// change width as the student moves through the workflow, and every mode publishes its own
// marker and mounts a workspace.
//
// Migrated 2026-09-06. Three things in this gate had gone stale against a deliberately
// replaced interface, and each is corrected rather than dropped:
//   · the rail was `ide-left-rail`, deleted with IdeLeftRail.tsx in 24de703b6 (2026-07-25).
//     It is `ide-workspace-rail` now.
//   · the width was a literal 68..80px band ("canonical 72px"). The rail is 56px, and it is
//     declared in rem so it grows with the reader's text - so the gate reads the token and
//     asserts the rendered rail agrees with it, which cannot drift again.
//   · hardware and export were required to mount a console. The bottom panel is opt-in per
//     surface preference now, not a property of the mode; that behaviour is owned by
//     ide:gate:console-autocollapse-contract, which was migrated to the opt-in path.
//
// Import is not a primary-rail mode (utility entry only); there is no `mode-button-import`.
const MODES = ['project', 'design', 'verify', 'hardware', 'export'];

await runIdeGate('IDE layout contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  const modeRail = page.locator('[data-testid="ide-workspace-rail"]').first();
  assert(await visible(modeRail), 'mode rail must be visible');
  const initialBox = await modeRail.boundingBox();
  assert(Boolean(initialBox), 'mode rail bounds unavailable');
  const declaredRailWidth = await page.evaluate(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--wb-rail-w').trim();
    if (!raw) return null;
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;visibility:hidden;width:${raw}`;
    document.body.appendChild(probe);
    const measured = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.round(measured * 100) / 100;
  });
  assert(declaredRailWidth !== null, '--wb-rail-w is not declared, so the rail has no owner');
  assert(
    Math.abs(initialBox.width - declaredRailWidth) <= 1,
    `mode rail renders ${initialBox.width}px but --wb-rail-w declares ${declaredRailWidth}px`
  );

  for (const mode of MODES) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 10000 });
    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
    const marker = await modeRoot.getAttribute('data-ide-mode-marker');
    assert(marker === mode, `mode marker mismatch for ${mode}: ${marker}`);

    // Which modes mount a workbench dock is a property of the surface AND of what is loaded -
    // measured 2026-09-06, with no project open Project shows the Start Center and mounts no
    // dock at all, while Board and Package own their left regions inside the surface. Docks
    // are asserted where that context exists: ide:gate:shell-layout-integrity checks the
    // contextual docks per mode with a project loaded (contextualDockViolationCount). This
    // gate keeps what is invariant for every mode with or without a project.
    assert(await visible(modeRoot.locator('[data-testid="ide-mode-body"]')), `mode=${mode} missing workspace`);

    const railBox = await modeRail.boundingBox();
    assert(Boolean(railBox), `mode rail bounds unavailable in mode=${mode}`);
    assert(
      Math.abs(railBox.width - initialBox.width) <= 2,
      `mode rail width drifted in mode=${mode}: ${railBox.width}px`
    );
  }
});
