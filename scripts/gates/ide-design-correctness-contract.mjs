#!/usr/bin/env node

/**
 * Contract:
 * 1) Design must update combinational outputs immediately from real UI input toggles.
 * 2) No Run/Step action is required for combinational updates.
 * 3) Inspector I/O state shown to students must match expected truth tables.
 */

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

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
  await loadStarterProject(page, { exactExampleId: exampleId });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await revealDesignInspector(page);
  await page.waitForSelector('[data-testid="ide-design-inspector-io-state"]', { timeout: 10000 });
}

async function revealDesignInspector(page) {
  if (await page.locator('[data-testid="ide-design-inspector-io-state"]').first().isVisible().catch(() => false)) {
    return;
  }
  const inspectorToggle = page.locator('[data-testid="ide-workbench-dock-toggle-right"]').first();
  if (await inspectorToggle.isVisible().catch(() => false)) {
    await clickElement(inspectorToggle);
    await page.waitForSelector('[data-testid="ide-inspector"]', { timeout: 5000 });
  }
}

async function revealDesignLibrary(page) {
  if (await page.locator('[data-testid="ide-left-dock"]').first().isVisible().catch(() => false)) {
    return;
  }
  const libraryToggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
  assert(
    await libraryToggle.isVisible().catch(() => false),
    'design surface must expose a restorable library rail before input editing',
  );
  await clickElement(libraryToggle);
  await page.waitForSelector('[data-testid="ide-left-dock"]', { timeout: 5000 });
}

async function openExamplesBrowserIfPresent(page) {
  const browser = page.locator('[data-testid="ide-project-examples-disclosure"]').first();
  if (!(await browser.count().catch(() => 0))) return;

  const expanded = (await browser.getAttribute('data-expanded').catch(() => 'true')) !== 'false';
  if (expanded) return;

  const toggle = page.locator('[data-testid="ide-projectx-examples-toggle"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    await clickElement(toggle);
  }
}

async function clickExampleSelector(page, exampleId) {
  const selectors = [
    `[data-testid="ide-project-load-start-${exampleId}"]`,
    `[data-testid="ide-projectx-example-load-${exampleId}"] button`,
    `[data-testid="ide-projectx-path-step-${exampleId}"]`,
    `[data-testid="ide-project-landing-example-${exampleId}"]`,
    `[data-testid="ide-project-lab-card-${exampleId}"]`,
  ];
  for (const selector of selectors) {
    const candidate = page.locator(selector).first();
    if (!(await candidate.isVisible().catch(() => false))) {
      continue;
    }
    await clickElement(candidate);
    return true;
  }
  return false;
}

async function confirmExampleReplacementIfNeeded(page) {
  const confirmButton = page.locator('[data-testid="ide-example-confirm"]').first();
  if (await confirmButton.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirmButton.click();
  }
}

async function clickElement(locator) {
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error('expected clickable HTMLElement');
    }
    element.click();
  });
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
  await revealDesignInspector(page);

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
  await revealDesignLibrary(page);

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
