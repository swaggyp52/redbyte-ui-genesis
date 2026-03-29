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
    const buildFresh = page.locator('[data-testid="ide-project-landing-fresh"]').first();
    const buildFreshText = await text(buildFresh);
    assert(
      buildFreshText.toLowerCase().includes('build fresh'),
      `project landing must expose Build Fresh, got "${buildFreshText}"`
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

  const nextTarget = await text(page.locator('[data-testid="ide-project-continue-target"]'));
  assert(nextTarget.toLowerCase().includes('verify'), 'expected initial next target to route to Verify');

  await continueCta.click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
});
