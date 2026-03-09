#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export', 'import'];

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE primary CTA contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  for (const mode of MODES) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 10000 });

    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
    if (mode === 'project') {
      const continueButton = modeRoot.locator('[data-testid="ide-project-cta-continue"]').first();
      const autoMapButton = modeRoot.locator('[data-testid="ide-project-cta-automap"]').first();
      const launchpadDesignButton = modeRoot.locator('[data-testid="ide-launchpad-design-cta"]').first();
      const projectContinueVisible = await continueButton.isVisible().catch(() => false);
      const autoMapVisible = await autoMapButton.isVisible().catch(() => false);
      const launchpadVisible = await launchpadDesignButton.isVisible().catch(() => false);
      assert(
        projectContinueVisible || autoMapVisible || launchpadVisible,
        'mode=project expected at least one project CTA hook to be visible'
      );
      if (!projectContinueVisible) {
        continue;
      }
      const continueLabel = await text(continueButton);
      assert(
        continueLabel.toLowerCase().startsWith('continue'),
        `mode=project primary CTA should start with Continue, got "${continueLabel}"`
      );

      await continueButton.click();
      await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
      continue;
    }
    if (mode === 'design') {
      // ide-primary-cta was removed from the DesignSurface toolbar; the Wire tool is the
      // always-visible primary action CTA in the current product.
      const cta = modeRoot.locator('[data-testid="ide-design-tool-wire"]').first();
      assert(await cta.isVisible().catch(() => false), 'mode=design wire tool (primary CTA) must be visible');
      continue;
    }
    if (mode === 'verify') {
      const runButton = modeRoot.locator('[data-testid="ide-verify-run"]').first();
      assert(await runButton.isVisible().catch(() => false), 'mode=verify verify-run button must be visible');
      continue;
    }
    if (mode === 'hardware') {
      const modeToggle = modeRoot.locator('[data-testid="ide-hw-mode-toggle"]').first();
      assert(await modeToggle.isVisible().catch(() => false), 'mode=hardware mode toggle must be visible');
      continue;
    }
    if (mode === 'export') {
      const rebuild = modeRoot.locator('[data-testid="ide-export-rebuild-btn"]').first();
      const generic = modeRoot.locator('[data-testid="ide-primary-cta"]').first();
      const rebuildVisible = await rebuild.isVisible().catch(() => false);
      const genericVisible = await generic.isVisible().catch(() => false);
      assert(rebuildVisible || genericVisible, 'mode=export expected export CTA to be visible');
      continue;
    }
    if (mode === 'import') {
      const process = modeRoot.locator('[data-testid="ide-import-process-design"]').first();
      assert(await process.isVisible().catch(() => false), 'mode=import process-design CTA must be visible');
      continue;
    }
  }
});
