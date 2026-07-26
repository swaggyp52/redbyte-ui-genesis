#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function assertProjectRecordVisible(page) {
  const record = page.locator('[data-testid="ide-project-bridge-disclosure"]').first();
  await record.waitFor({ state: 'visible', timeout: 10000 });
  assert(
    await record.evaluate((element) => !(element instanceof HTMLDetailsElement)),
    'project engineering record must be an ordinary visible section, not a disclosure',
  );
  await page.waitForSelector('[data-testid="ide-project-bridge"]', { timeout: 10000 });
}

async function openExamplesBrowserIfCollapsed(page) {
  let browser = page.locator('[data-testid="ide-project-examples-disclosure"]').first();
  if (!(await browser.isVisible().catch(() => false))) {
    const changeProject = page.locator('[data-testid="ide-project-change-project"]').first();
    if (await changeProject.isVisible().catch(() => false)) {
      await changeProject.click();
    }

    const openStarter = page.locator('[data-testid="ide-project-path-course-starter"]').first();
    if (await openStarter.isVisible().catch(() => false)) {
      await openStarter.click();
    }
    browser = page.locator('[data-testid="ide-project-examples-disclosure"]').first();
  }
  await browser.waitFor({ state: 'visible', timeout: 10000 });

  const expanded = await browser.getAttribute('data-expanded');
  if (expanded === 'false') {
    const toggle = page.locator('[data-testid="ide-projectx-examples-toggle"]').first();
    await toggle.click();
  }

  await page.waitForSelector('[data-testid^="ide-project-load-start-"]', { timeout: 10000 });
}

async function openLandingStarterCatalog(page) {
  const catalog = page.locator('[data-testid="ide-project-starter-catalog"]').first();
  const isOpen = await catalog.evaluate((element) => {
    if (element instanceof HTMLDetailsElement) return element.open;
    return !element.hasAttribute('hidden') && element.getAttribute('data-expanded') !== 'false';
  }).catch(() => false);
  if (isOpen) return;

  const openStarter = page.locator('[data-testid="ide-project-open-starter-primary"]').first();
  if (await openStarter.isVisible().catch(() => false)) {
    await openStarter.click();
  } else if (await catalog.locator('summary').first().isVisible().catch(() => false)) {
    await catalog.locator('summary').first().click();
  }

  await page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="ide-project-starter-catalog"]');
    if (element instanceof HTMLDetailsElement) return element.open;
    return Boolean(element && !element.hasAttribute('hidden') && element.getAttribute('data-expanded') !== 'false');
  });
}

await runIdeGate('IDE examples catalog and guarded open contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  // The project start dock is inside the hidden left dock panel — it is in the DOM
  // but not visible. Instead, confirm we're on the project landing by checking that
  // example cards are rendered in the main workspace.
  await openLandingStarterCatalog(page);
  await page.waitForSelector('[data-testid^="ide-project-landing-example-"]', { timeout: 10000 });

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

  await assertProjectRecordVisible(page);
  await openExamplesBrowserIfCollapsed(page);

  const loadButtons = page.locator('[data-testid^="ide-project-load-start-"]');
  const loadButtonCount = await loadButtons.count();
  assert(loadButtonCount >= 2, `expected >=2 loaded-state example actions, found ${loadButtonCount}`);

  let targetLoad = loadButtons.first();
  let targetExampleId = '';
  for (let index = 0; index < loadButtonCount; index += 1) {
    const candidate = loadButtons.nth(index);
    const candidateId =
      (await candidate.getAttribute('data-testid'))
        ?.replace('ide-project-load-start-', '')
        .trim() ?? '';
    if (candidateId && candidateId !== initialTargetId) {
      targetLoad = candidate;
      targetExampleId = candidateId;
      break;
    }
  }
  assert(targetExampleId.length > 0, 'target example load row must carry data-example-id');

  const targetCard = page.locator(`[data-testid="ide-projectx-example-${targetExampleId}"]`);
  const expectedName = (
    await targetCard.locator('.ide-projectx-example-card-title').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(expectedName.length > 0, 'target example card must include a visible name');

  await targetLoad.evaluate((button) => {
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

  // After loading an example the surface is STATE B (bridge visible, not start dock).
  await assertProjectRecordVisible(page);
  await openExamplesBrowserIfCollapsed(page);

  const loadedButtonClass = await targetCard.getAttribute('class');
  assert(
    (loadedButtonClass ?? '').includes('is-active'),
    `loaded example row should be active, got class "${loadedButtonClass ?? ''}"`,
  );
});
