#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function dismissOnboardingIfPresent(page) {
  const skipButton = page.locator('[data-testid="ide-onboarding-skip"]').first();
  const overlay = page.locator('[data-testid="ide-onboarding-overlay"]').first();
  const visible = await skipButton.isVisible().catch(() => false);
  if (!visible) return;
  await skipButton.click();
  await overlay.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
}

await runIdeGate('IDE project overview contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await dismissOnboardingIfPresent(page);

  const landingVisible = await page
    .locator('[data-testid="ide-project-landing"]')
    .first()
    .isVisible()
    .catch(() => false);

  if (landingVisible) {
    const landingTitle = await text(page.locator('.ide-project-landing-title'));
    assert(
      /project home|start your lab/i.test(landingTitle),
      `project landing title should explain the start state, got "${landingTitle}"`
    );

    const buildFreshVisible = await page
      .locator('[data-testid="ide-project-build-fresh-primary"]')
      .first()
      .isVisible()
      .catch(() => false);
    assert(buildFreshVisible, 'project landing must offer Build Fresh as a primary action');

    const importUtilityVisible = await page
      .locator('[data-testid="ide-project-import-primary"]')
      .first()
      .isVisible()
      .catch(() => false);

    assert(importUtilityVisible, 'project landing must offer Import HDL as a primary action');

    const importCardVisible = await page
      .locator('[data-testid="ide-project-landing-import"]')
      .first()
      .isVisible()
      .catch(() => false);
    assert(!importCardVisible, 'project landing must not promote import as a peer start card');

    return;
  }

  const identityVisible = await page
    .locator('[data-testid="ide-project-panel-identity"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(identityVisible, 'project identity panel must render');

  const mappingVisible = await page
    .locator('[data-testid="ide-project-panel-mapping"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(mappingVisible, 'project mapping panel must render');

  const readinessVisible = await page
    .locator('[data-testid="ide-project-panel-readiness"], [data-testid="ide-project-readiness-summary"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(readinessVisible, 'project readiness panel must render');

  const unmappedText = await text(page.locator('[data-testid="ide-project-unmapped-count"]'));
  assert(unmappedText.toLowerCase().includes('unmapped'), 'project unmapped count must be visible');

  const continueVisible = await page
    .locator('[data-testid="ide-project-continue-cta"]')
    .first()
    .isVisible()
    .catch(() => false);
  assert(continueVisible, 'project primary Continue CTA must render');

  await page.locator('[data-testid="ide-project-mapping-expand-btn"]').click();
  await page.waitForSelector('[data-testid="ide-project-mapping-table"]', { timeout: 10000 });
  const firstMappingInput = page.locator('[data-testid^="ide-project-map-input-"]').first();
  await firstMappingInput.fill('');
  await firstMappingInput.blur();

  await page.waitForFunction(() => {
    const statusCell = document.querySelector(
      '[data-testid="ide-project-mapping-table"] tbody tr td:nth-child(5)'
    );
    return Boolean(statusCell && /missing/i.test(statusCell.textContent || ''));
  });

  const nextUnmappedText = await text(page.locator('[data-testid="ide-project-unmapped-count"]'));
  const match = /^(\d+)/.exec(nextUnmappedText);
  const count = match ? Number.parseInt(match[1] ?? '0', 10) : 0;
  assert(count >= 1, `project unmapped count should increase after clearing a mapping, got "${nextUnmappedText}"`);
});
