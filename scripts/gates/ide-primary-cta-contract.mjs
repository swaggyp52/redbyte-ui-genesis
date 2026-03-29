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
      // ide-project-continue-cta is rendered in the showcase panel (circuit loaded state).
      // ide-project-landing-fresh / ide-project-landing-import are always rendered when
      // no circuit is loaded (landing state A).
      const continueButton = modeRoot.locator('[data-testid="ide-project-continue-cta"]').first();
      const autoMapButton = modeRoot.locator('[data-testid="ide-project-landing-fresh"]').first();
      const launchpadDesignButton = modeRoot.locator('[data-testid="ide-project-landing-import"]').first();
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
      const selectors = [
        '[data-testid="ide-verify-run"]',
        '[data-testid="ide-verify-empty-run"]',
        '[data-testid="ide-verify-generate-basic-vectors-footer"]',
        '[data-testid="ide-verify-generate-all-combos"]',
        '[data-testid="ide-verify-guided-clock-pattern"]',
        '[data-testid="ide-verify-sync-go-design"]',
      ];
      let verifyCtaVisible = false;
      for (const selector of selectors) {
        const cta = modeRoot.locator(selector).first();
        if (await cta.isVisible().catch(() => false)) {
          verifyCtaVisible = true;
          break;
        }
      }
      assert(
        verifyCtaVisible,
        'mode=verify expected a guided verify CTA or run action to be visible'
      );
      continue;
    }
    if (mode === 'hardware') {
      const modeToggle = modeRoot.locator('[data-testid="ide-hw-mode-toggle"]').first();
      const blockedPrimary = modeRoot.locator('[data-testid="ide-hardware-blocked-primary"]').first();
      const blockedSecondary = modeRoot.locator('[data-testid="ide-hardware-blocked-secondary"]').first();
      const modeToggleVisible = await modeToggle.isVisible().catch(() => false);
      const blockedPrimaryVisible = await blockedPrimary.isVisible().catch(() => false);
      const blockedSecondaryVisible = await blockedSecondary.isVisible().catch(() => false);
      assert(
        modeToggleVisible || blockedPrimaryVisible || blockedSecondaryVisible,
        'mode=hardware expected either the hardware mode toggle or a blocked-state CTA to be visible'
      );
      continue;
    }
    if (mode === 'export') {
      const rebuild = modeRoot.locator('[data-testid="ide-export-rebuild-btn"]').first();
      const generic = modeRoot.locator('[data-testid="ide-primary-cta"]').first();
      const goDesign = modeRoot.locator('[data-testid="ide-export-trust-go-design"]').first();
      const goVerify = modeRoot.locator('[data-testid="ide-export-trust-go-verify"]').first();
      const rebuildVisible = await rebuild.isVisible().catch(() => false);
      const genericVisible = await generic.isVisible().catch(() => false);
      const goDesignVisible = await goDesign.isVisible().catch(() => false);
      const goVerifyVisible = await goVerify.isVisible().catch(() => false);
      assert(
        rebuildVisible || genericVisible || goDesignVisible || goVerifyVisible,
        'mode=export expected an export CTA or blank-state guidance CTA to be visible'
      );
      continue;
    }
    if (mode === 'import') {
      const startPrimary = modeRoot.locator('[data-testid="ide-import-start-primary"]').first();
      const process = modeRoot.locator('[data-testid="ide-import-process-design"]').first();
      const startPrimaryVisible = await startPrimary.isVisible().catch(() => false);
      const processVisible = await process.isVisible().catch(() => false);
      assert(
        startPrimaryVisible || processVisible,
        'mode=import expected import start primary CTA or process-design CTA to be visible'
      );
      continue;
    }
  }
});
