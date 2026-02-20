#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

await runIdeGate('IDE project continue CTA contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

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
