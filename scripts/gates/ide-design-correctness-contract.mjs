#!/usr/bin/env node

/**
 * Contract:
 * 1) Design must update combinational outputs immediately from real UI input toggles.
 * 2) No Run/Step action is required for combinational updates.
 * 3) Inspector I/O state shown to students must match expected truth tables.
 */

import { assert, runIdeGate } from './_gateHarness.mjs';

const UPDATE_TIMEOUT_MS = 250;

await runIdeGate('IDE design correctness contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await verifySignalTourTruthTable(page);
  await verifyLogicGatesTruthTable(page);
});

async function verifySignalTourTruthTable(page) {
  await loadExampleIntoDesign(page, 'signal-tour');
  await ensureSimPaused(page);
  await assertInspectorIoStatePresent(
    page,
    ['sw0_node', 'sw1_node', 'sw2_node', 'sw3_node'],
    ['ld0_node', 'ld1_node', 'ld2_node', 'ld3_node'],
  );

  const scenarios = [
    { sw0: 0, sw1: 0, sw2: 0, sw3: 0, ld0: 0, ld1: 0, ld2: 0, ld3: 0 },
    { sw0: 1, sw1: 0, sw2: 0, sw3: 0, ld0: 1, ld1: 0, ld2: 0, ld3: 0 },
    { sw0: 0, sw1: 1, sw2: 0, sw3: 1, ld0: 0, ld1: 1, ld2: 0, ld3: 1 },
    { sw0: 1, sw1: 1, sw2: 1, sw3: 1, ld0: 1, ld1: 1, ld2: 1, ld3: 1 },
  ];

  for (const scenario of scenarios) {
    await setInputBit(page, 'sw0_node', scenario.sw0);
    await setInputBit(page, 'sw1_node', scenario.sw1);
    await setInputBit(page, 'sw2_node', scenario.sw2);
    await setInputBit(page, 'sw3_node', scenario.sw3);
    await assertOutputBit(page, 'ld0_node', scenario.ld0);
    await assertOutputBit(page, 'ld1_node', scenario.ld1);
    await assertOutputBit(page, 'ld2_node', scenario.ld2);
    await assertOutputBit(page, 'ld3_node', scenario.ld3);
  }
}

async function verifyLogicGatesTruthTable(page) {
  await loadExampleIntoDesign(page, 'logic-gates');
  await ensureSimPaused(page);
  await assertInspectorIoStatePresent(page, ['sw0_node', 'sw1_node'], ['ld0_node', 'ld1_node', 'ld2_node']);

  const scenarios = [
    { sw0: 0, sw1: 0, ld0: 0, ld1: 0, ld2: 0 },
    { sw0: 1, sw1: 0, ld0: 0, ld1: 1, ld2: 1 },
    { sw0: 0, sw1: 1, ld0: 0, ld1: 1, ld2: 1 },
    { sw0: 1, sw1: 1, ld0: 1, ld1: 1, ld2: 0 },
  ];

  for (const scenario of scenarios) {
    await setInputBit(page, 'sw0_node', scenario.sw0);
    await setInputBit(page, 'sw1_node', scenario.sw1);
    await assertOutputBit(page, 'ld0_node', scenario.ld0);
    await assertOutputBit(page, 'ld1_node', scenario.ld1);
    await assertOutputBit(page, 'ld2_node', scenario.ld2);
  }
}

async function loadExampleIntoDesign(page, exampleId) {
  if (!(await page.locator('[data-testid="ide-mode-project"]').isVisible().catch(() => false))) {
    await page.locator('[data-testid="mode-button-project"]').click();
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  }

  const examplesDisclosure = page.locator('[data-testid="ide-project-examples-disclosure"]').first();
  const hasExamplesDisclosure = await examplesDisclosure.count().catch(() => 0);
  if (hasExamplesDisclosure) {
    const disclosureOpen = await examplesDisclosure.evaluate((element) =>
      element instanceof HTMLDetailsElement ? element.open : false
    ).catch(() => false);
    const summary = examplesDisclosure.locator('summary').first();
    const summaryVisible = await summary.isVisible().catch(() => false);
    if (!disclosureOpen && summaryVisible) {
      await summary.click();
    }
  }

  const selectors = [
    `[data-testid="ide-project-load-start-${exampleId}"]`,
    `[data-testid="ide-project-landing-example-${exampleId}"]`,
    `[data-testid="ide-project-lab-card-${exampleId}"]`,
  ];
  let clicked = false;
  for (const selector of selectors) {
    const candidate = page.locator(selector).first();
    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }
    await candidate.click();
    clicked = true;
    break;
  }
  assert(clicked, `expected project example selector for ${exampleId}`);

  const confirmVisible = await page
    .locator('[data-testid="ide-example-confirm-modal"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (confirmVisible) {
    await page.locator('[data-testid="ide-example-confirm"]').click();
  }

  if (!(await page.locator('[data-testid="ide-mode-design"]').isVisible().catch(() => false))) {
    await page.locator('[data-testid="mode-button-design"]').click();
  }
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-inspector-io-state"]', { timeout: 10000 });
}

async function ensureSimPaused(page) {
  const pauseVisible = await page
    .locator('[data-testid="ide-design-sim-pause"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (pauseVisible) {
    await page.locator('[data-testid="ide-design-sim-pause"]').click();
  }
  // The correctness contract must not depend on Run/Step controls being visible.
  // It only verifies that real input toggles update current Design state.
}

async function assertInspectorIoStatePresent(page, inputNodeIds, outputNodeIds) {
  for (const nodeId of inputNodeIds) {
    await page.waitForSelector(`[data-testid="ide-design-inspector-input-${nodeId}-value"]`, {
      timeout: 10000,
    });
  }
  for (const nodeId of outputNodeIds) {
    await page.waitForSelector(`[data-testid="ide-design-inspector-output-${nodeId}-value"]`, {
      timeout: 10000,
    });
  }
}

async function setInputBit(page, nodeId, value) {
  const target = String(value);
  const inputValueSelector = `[data-testid="ide-design-inspector-input-${nodeId}-value"]`;
  const current = await text(page.locator(inputValueSelector));
  assert(
    current === '0' || current === '1',
    `expected binary input value for ${nodeId}, got "${current}"`,
  );
  if (current === target) return;

  await ensureLiveInputsExpanded(page);
  await page.locator(`[data-testid="ide-design-input-toggle-${nodeId}"]`).click();

  await page.waitForFunction(
    ({ selector, expected }) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      return (element.textContent || '').trim() === expected;
    },
    { selector: inputValueSelector, expected: target },
    { timeout: UPDATE_TIMEOUT_MS },
  );
}

async function ensureLiveInputsExpanded(page) {
  const firstToggle = page.locator('[data-testid^="ide-design-input-toggle-"]').first();
  if (await firstToggle.isVisible().catch(() => false)) {
    return;
  }

  const disclosureToggle = page.locator('[data-testid="ide-design-live-inputs-toggle"]').first();
  const isVisible = await disclosureToggle.isVisible().catch(() => false);
  assert(isVisible, 'design live inputs toggle must be visible before input editing');
  await disclosureToggle.click();
  await firstToggle.waitFor({ state: 'visible', timeout: 5000 });
}

async function assertOutputBit(page, nodeId, expected) {
  const selector = `[data-testid="ide-design-inspector-output-${nodeId}-value"]`;
  await page.waitForFunction(
    ({ outputSelector, expectedValue }) => {
      const element = document.querySelector(outputSelector);
      if (!element) return false;
      return (element.textContent || '').trim() === expectedValue;
    },
    { outputSelector: selector, expectedValue: String(expected) },
    { timeout: UPDATE_TIMEOUT_MS },
  );
  const actual = await text(page.locator(selector));
  assert(
    actual === String(expected),
    `expected ${nodeId}=${expected}, got "${actual}"`,
  );
}

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}
