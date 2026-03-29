#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

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

async function clickVerifyRun(page) {
  const candidates = [
    '[data-testid="ide-verify-run"]',
    '[data-testid="ide-verify-run-secondary"]',
    '[data-testid="ide-verify-empty-run"]',
    '[data-testid="ide-verify-stale-primary-rerun"]',
  ];
  for (const selector of candidates) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;
    await button.click();
    return;
  }
  throw new Error('verify run button was not visible in any supported state');
}

async function authorMinimalVerifyVector(page) {
  const runAlreadyVisible = await page
    .locator('[data-testid="ide-verify-run"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (runAlreadyVisible) {
    return;
  }

  const legacyTickInput = page.locator('[data-testid="ide-verify-add-vector-tick"]').first();
  const legacyTickVisible = await legacyTickInput.isVisible().catch(() => false);

  if (legacyTickVisible) {
    await legacyTickInput.fill('11');
    const firstInput = page.locator('[data-testid^="ide-verify-add-vector-input-"]').first();
    const firstInputVisible = await firstInput.isVisible().catch(() => false);
    if (firstInputVisible) {
      await firstInput.selectOption('1');
    }
    await page.locator('[data-testid="ide-verify-add-vector-submit"]').first().click();
    return;
  }

  const addTickButton = page.locator('[data-testid="ide-stimulus-add-tick"]').first();
  const addTickVisible = await addTickButton.isVisible().catch(() => false);
  const guidedGenerateButton = page
    .locator(
      '[data-testid="ide-verify-generate-basic-vectors-footer"], [data-testid="ide-verify-generate-all-combos"], [data-testid="ide-verify-guided-clock-pattern"]'
    )
    .first();
  const guidedGenerateVisible = await guidedGenerateButton.isVisible().catch(() => false);
  if (guidedGenerateVisible) {
    await guidedGenerateButton.click();
    return;
  }
  if (!addTickVisible) {
    throw new Error('verify authoring controls unavailable (neither legacy form nor StimulusCanvas found)');
  }

  await addTickButton.click();
  const firstStimulusCell = page.locator('[data-testid^="ide-stimulus-cell-"]').first();
  await firstStimulusCell.waitFor({ state: 'visible', timeout: 10000 });
  await firstStimulusCell.click();
}

async function clickGenerateBasicsIfVisible(page) {
  const button = page
    .locator(
      '[data-testid="ide-verify-generate-basic-vectors"], [data-testid="ide-verify-generate-basic-vectors-footer"], [data-testid="ide-verify-generate-all-combos"]'
    )
    .first();
  const isVisible = await button.isVisible().catch(() => false);
  if (isVisible) {
    await button.click();
  }
}

async function waitForCondition(page, label, predicate, timeout = 30000) {
  try {
    await page.waitForFunction(predicate, { timeout });
  } catch {
    throw new Error(`timed out waiting for condition: ${label}`);
  }
}

async function mutateDesignCircuit(page) {
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });

  const baselineNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? -1;
  });
  assert(baselineNodeCount >= 0, 'baseline node count unavailable for project-health mutation');

  const candidates = [
    page.locator('[data-testid="ide-design-palette-input"]').first(),
    page.locator('[data-testid="ide-design-palette-and"]').first(),
  ];

  let activated = false;
  for (const button of candidates) {
    const isVisible = await button.isVisible().catch(() => false);
    if (!isVisible) continue;
    await button.click();
    activated = await page
      .waitForFunction(() => {
        const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
        return canvas?.getAttribute('data-placement-active') === '1';
      }, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (activated) break;
  }

  assert(activated, 'no canonical design mutation control activated placement mode');

  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), 'design canvas bounds unavailable for mutation placement');
  const clickPoints = [
    [0.25, 0.45],
    [0.35, 0.55],
    [0.5, 0.5],
    [0.65, 0.4],
  ];

  let mutated = false;
  for (const [xFactor, yFactor] of clickPoints) {
    await page.mouse.click(bounds.x + bounds.width * xFactor, bounds.y + bounds.height * yFactor);
    mutated = await page
      .waitForFunction(
        (expectedCount) => {
          const store = window.__RB_CIRCUIT_STORE__;
          const canvasEl = document.querySelector('[data-testid="ide-design-live-canvas"]');
          if (!store?.getState || !canvasEl) return false;
          return (
            (store.getState().circuit?.nodes?.length ?? -1) >= expectedCount &&
            canvasEl.getAttribute('data-placement-active') === '0'
          );
        },
        baselineNodeCount + 1,
        { timeout: 2500 }
      )
      .then(() => true)
      .catch(() => false);
    if (mutated) break;
  }

  assert(mutated, 'design mutation did not materialize a new node');
}

await runIdeGate('IDE project health live contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await dismissOnboardingIfPresent(page);

  const landingVisible = await page
    .locator('[data-testid="ide-project-landing"]')
    .first()
    .isVisible()
    .catch(() => false);

  if (landingVisible) {
    const firstExample = page.locator('[data-testid^="ide-project-landing-example-"]').first();
    const exampleVisible = await firstExample.isVisible().catch(() => false);
    assert(exampleVisible, 'project landing must surface at least one starter example');
    await firstExample.click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
    await page.locator('[data-testid="mode-button-project"]').click();
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  }

  const initialCta = await text(page.locator('[data-testid="ide-project-continue-target"]'));
  assert(
    initialCta.toLowerCase().includes('verify'),
    `expected initial project continue target to route Verify, got "${initialCta}"`
  );

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-add-vector-form"]', { timeout: 10000 });

  await authorMinimalVerifyVector(page);
  await clickGenerateBasicsIfVisible(page);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 10000 });

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  await waitForCondition(
    page,
    'project mode reflects verify status/hash and clean marker',
    () => {
      const status = document.querySelector('[data-testid="ide-project-last-verify-status"]')?.textContent ?? '';
      const hash = document.querySelector('[data-testid="ide-project-last-verify-hash"]')?.textContent ?? '';
      const dirty = document.querySelector('[data-testid="ide-project-dirty-since-verify"]')?.textContent ?? '';
      return /^(PASS|FAIL)$/i.test(status.trim()) && hash.trim().length > 0 && !/[—-]/.test(hash.trim()) && /^CLEAN$/i.test(dirty.trim());
    },
    10000
  );

  const verifyStatus = await text(page.locator('[data-testid="ide-project-last-verify-status"]'));
  assert(
    verifyStatus === 'PASS' || verifyStatus === 'FAIL',
    `expected project last verify status PASS/FAIL, got "${verifyStatus}"`
  );
  const verifyHash = await text(page.locator('[data-testid="ide-project-last-verify-hash"]'));
  assert(
    verifyHash.length > 0 && verifyHash.toLowerCase() !== 'pending',
    `expected project last verify hash to be populated, got "${verifyHash}"`
  );

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-design-workspace"]', { timeout: 10000 });
  await mutateDesignCircuit(page);

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });

  const dirtySinceVerify = await text(page.locator('[data-testid="ide-project-dirty-since-verify"]'));
  assert(
    dirtySinceVerify === 'DIRTY',
    `expected dirty-since-verify indicator to be DIRTY, got "${dirtySinceVerify}"`
  );
  const ctaAfterMutation = await text(page.locator('[data-testid="ide-project-continue-target"]'));
  assert(
    ctaAfterMutation.toLowerCase().includes('verify'),
    `expected project continue target to route Verify after design mutation, got "${ctaAfterMutation}"`
  );
});
