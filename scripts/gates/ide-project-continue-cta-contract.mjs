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
  assert(ctaText.toLowerCase() === 'continue', `project primary CTA must be "Continue", got "${ctaText}"`);

  const nextTarget = await text(page.locator('[data-testid="ide-project-continue-target"]'));
  assert(nextTarget.toLowerCase().includes('add test vectors'), 'expected initial next target to require vectors');

  await continueCta.click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
});
