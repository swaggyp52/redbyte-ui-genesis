#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

async function openBridgeDisclosure(page) {
  const disclosure = page.locator('[data-testid="ide-project-bridge-disclosure"]').first();
  await disclosure.waitFor({ state: 'visible', timeout: 10000 });

  const isOpen = await disclosure.evaluate((element) => {
    if (!(element instanceof HTMLDetailsElement)) {
      throw new Error('project bridge disclosure must be a details element');
    }
    return element.open;
  });

  if (!isOpen) {
    await disclosure.evaluate((element) => {
      if (!(element instanceof HTMLDetailsElement)) {
        throw new Error('project bridge disclosure must be a details element');
      }
      element.open = true;
    });
  }

  await page.waitForSelector('[data-testid="ide-project-bridge"]', { timeout: 10000 });
}

async function openExamplesBrowserIfCollapsed(page) {
  const browser = page.locator('[data-testid="ide-project-examples-disclosure"]').first();
  await browser.waitFor({ state: 'visible', timeout: 10000 });

  const expanded = await browser.getAttribute('data-expanded');
  if (expanded === 'false') {
    const toggle = page.locator('[data-testid="ide-projectx-examples-toggle"]').first();
    await toggle.click();
  }

  await page.waitForSelector('[data-testid^="ide-project-load-start-"]', { timeout: 10000 });
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

  const bridgeDisclosure = page.locator('[data-testid="ide-project-bridge-disclosure"]').first();
  await bridgeDisclosure.waitFor({ state: 'visible', timeout: 10000 });
  const bridgeStartsCollapsed = await bridgeDisclosure.evaluate((element) => {
    if (!(element instanceof HTMLDetailsElement)) {
      throw new Error('project bridge disclosure must be a details element');
    }
    return !element.open;
  });
  assert(bridgeStartsCollapsed, 'project bridge internals must start tucked behind a closed disclosure');
  await openBridgeDisclosure(page);
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
  await openBridgeDisclosure(page);
  await openExamplesBrowserIfCollapsed(page);

  const loadedButtonClass = await targetCard.getAttribute('class');
  assert(
    (loadedButtonClass ?? '').includes('is-active'),
    `loaded example row should be active, got class "${loadedButtonClass ?? ''}"`,
  );
});
