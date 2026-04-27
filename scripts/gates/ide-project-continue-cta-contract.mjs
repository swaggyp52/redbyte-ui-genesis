#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE project continue CTA contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const landingVisible = await page
    .locator('[data-testid="ide-project-landing"]')
    .first()
    .isVisible()
    .catch(() => false);

  if (landingVisible) {
    const buildFresh = page.locator('[data-testid="ide-project-build-fresh-primary"]').first();
    const buildFreshText = await text(buildFresh);
    assert(
      buildFreshText.toLowerCase().includes('build fresh'),
      `project landing must expose Build Fresh primary action, got "${buildFreshText}"`
    );
    await buildFresh.click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
    return;
  }

  const continueCta = page.locator('[data-testid="ide-project-continue-cta"]').first();
  const ctaText = await text(continueCta);
  assert(
    ctaText.toLowerCase().startsWith('continue'),
    `project primary CTA must start with "Continue", got "${ctaText}"`
  );

  // Reconciliation R2: the legacy hero's `ide-project-continue-target` was removed.
  // The command strip's primary CTA text is the canonical "Continue to <surface>" label.
  const nextTargetText = ctaText;
  assert(
    nextTargetText.toLowerCase().includes('verify'),
    `expected initial next target to route to Verify, got "${nextTargetText}"`
  );

  await continueCta.click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
});
