#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export', 'import'];

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE primary CTA contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  for (const mode of MODES) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 10000 });

    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
    const ctaLocator = modeRoot.locator('[data-testid="ide-primary-cta"]');
    const count = await ctaLocator.count();
    assert(count === 1, `mode=${mode} expected exactly one ide-primary-cta, found ${count}`);

    const isVisible = await ctaLocator.first().isVisible().catch(() => false);
    assert(isVisible, `mode=${mode} ide-primary-cta must be visible`);

    if (mode === 'project') {
      const continueButton = modeRoot.locator('[data-testid="ide-project-continue-cta"]').first();
      const continueLabel = await text(continueButton);
      assert(
        continueLabel.toLowerCase().startsWith('continue'),
        `mode=project primary CTA should start with Continue, got "${continueLabel}"`
      );

      await continueButton.click();
      await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
    }
  }
});
