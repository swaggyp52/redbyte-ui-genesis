#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE examples catalog and guarded open contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const examplesPanel = page.locator('[data-testid="ide-project-start-dock"]');
  assert(await visible(examplesPanel), 'project start dock should be visible');

  const landingExamples = page.locator('[data-testid^="ide-project-landing-example-"]');
  const landingCount = await landingExamples.count();
  assert(landingCount >= 3, `expected >=3 landing example actions, found ${landingCount}`);

  const initialTarget = landingExamples.nth(1);
  const initialTargetId =
    (await initialTarget.getAttribute('data-testid'))
      ?.replace('ide-project-landing-example-', '')
      .trim() ?? '';
  assert(initialTargetId.length > 0, 'landing example action must encode an example id');

  await initialTarget.click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-workspace"]', { timeout: 10000 });

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  await page.waitForSelector('[data-testid="ide-project-bridge"]', { timeout: 10000 });

  const targetLoad = page.locator('[data-testid="ide-project-example-load"]').nth(1);
  const targetExampleId = (await targetLoad.getAttribute('data-example-id')) ?? '';
  assert(targetExampleId.length > 0, 'target example load row must carry data-example-id');

  const targetCard = page.locator(`[data-testid="ide-project-example-${targetExampleId}"]`);
  const expectedName = (
    await targetCard.locator('.ide-project-example-btn-name').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(expectedName.length > 0, 'target example card must include a visible name');

  await targetLoad.locator('button').first().evaluate((button) => {
    if (!(button instanceof HTMLElement)) {
      throw new Error('expected example load button element');
    }
    button.click();
  });
  const ideConfirm = page.locator('[data-testid="ide-example-confirm"]').first();
  if (await ideConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ideConfirm.click();
  } else {
    const guardrailConfirm = page.getByRole('button', { name: /load/i }).first();
    if (await guardrailConfirm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guardrailConfirm.click();
    }
  }
  await page.locator('.ide-modal-backdrop').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);

  if (!(await page.locator('[data-testid="ide-mode-project"]').isVisible({ timeout: 2000 }).catch(() => false))) {
    await page.locator('[data-testid="mode-button-project"]').click();
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  }

  await page.waitForSelector('[data-testid="ide-project-start-dock"]', { timeout: 10000 });

  const loadedButtonClass = await targetCard.getAttribute('class');
  assert(
    (loadedButtonClass ?? '').includes('is-active'),
    `loaded example row should be active, got class "${loadedButtonClass ?? ''}"`,
  );
});
