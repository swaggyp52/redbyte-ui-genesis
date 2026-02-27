#!/usr/bin/env node

/**
 * Contract:
 * 1) Design must update combinational outputs immediately from real UI input toggles.
 * 2) No Run/Step action is required for combinational updates.
 * 3) Input/output rows shown to students must match expected truth tables.
 */

import { assert, runIdeGate } from './_gateHarness.mjs';

const UPDATE_TIMEOUT_MS = 250;

await runIdeGate('IDE design correctness contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await verifyLogicGatesTruthTable(page);
  await verifyHalfAdderTruthTable(page);
  await verifyFullAdderTruthTable(page);
});

async function verifyLogicGatesTruthTable(page) {
  await loadExampleIntoDesign(page, 'logic-gates');
  await ensureSimPaused(page);
  await assertLiveRowsPresent(page, ['sw0_node', 'sw1_node'], ['ld0_node', 'ld1_node', 'ld2_node']);

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

async function verifyHalfAdderTruthTable(page) {
  await loadExampleIntoDesign(page, 'half-adder');
  await ensureSimPaused(page);
  await assertLiveRowsPresent(page, ['sw0_node', 'sw1_node'], ['ld0_node', 'ld1_node']);

  const scenarios = [
    { sw0: 0, sw1: 0, ld0: 0, ld1: 0 }, // carry, sum
    { sw0: 0, sw1: 1, ld0: 0, ld1: 1 },
    { sw0: 1, sw1: 0, ld0: 0, ld1: 1 },
    { sw0: 1, sw1: 1, ld0: 1, ld1: 0 },
  ];

  for (const scenario of scenarios) {
    await setInputBit(page, 'sw0_node', scenario.sw0);
    await setInputBit(page, 'sw1_node', scenario.sw1);
    await assertOutputBit(page, 'ld0_node', scenario.ld0);
    await assertOutputBit(page, 'ld1_node', scenario.ld1);
  }
}

async function verifyFullAdderTruthTable(page) {
  await loadExampleIntoDesign(page, 'full-adder');
  await ensureSimPaused(page);
  await assertLiveRowsPresent(page, ['sw0_node', 'sw1_node', 'sw2_node'], ['ld0_node', 'ld1_node']);

  const scenarios = [
    { sw0: 0, sw1: 0, sw2: 0, ld0: 0, ld1: 0 },
    { sw0: 0, sw1: 0, sw2: 1, ld0: 0, ld1: 1 },
    { sw0: 0, sw1: 1, sw2: 0, ld0: 0, ld1: 1 },
    { sw0: 0, sw1: 1, sw2: 1, ld0: 1, ld1: 0 },
    { sw0: 1, sw1: 0, sw2: 0, ld0: 0, ld1: 1 },
    { sw0: 1, sw1: 0, sw2: 1, ld0: 1, ld1: 0 },
    { sw0: 1, sw1: 1, sw2: 0, ld0: 1, ld1: 0 },
    { sw0: 1, sw1: 1, sw2: 1, ld0: 1, ld1: 1 },
  ];

  for (const scenario of scenarios) {
    await setInputBit(page, 'sw0_node', scenario.sw0);
    await setInputBit(page, 'sw1_node', scenario.sw1);
    await setInputBit(page, 'sw2_node', scenario.sw2);
    await assertOutputBit(page, 'ld0_node', scenario.ld0);
    await assertOutputBit(page, 'ld1_node', scenario.ld1);
  }
}

async function loadExampleIntoDesign(page, exampleId) {
  if (!(await page.locator('[data-testid="ide-mode-project"]').isVisible().catch(() => false))) {
    await page.locator('[data-testid="mode-button-project"]').click();
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  }

  const quickStartButton = page.locator(`[data-testid="ide-project-load-start-${exampleId}"]`).first();
  const quickStartVisible = await quickStartButton.isVisible().catch(() => false);
  if (quickStartVisible) {
    await quickStartButton.click();
  } else {
    const openExampleButton = page.locator(`[data-testid="ide-project-open-example-${exampleId}"]`).first();
    assert(
      await openExampleButton.isVisible().catch(() => false),
      `expected project example selector for ${exampleId}`,
    );
    await openExampleButton.click();
  }

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
  await page.waitForSelector('[data-testid="ide-design-live-signals"]', { timeout: 10000 });
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
  await page.waitForSelector('[data-testid="ide-design-sim-run"]', { timeout: 5000 });
}

async function assertLiveRowsPresent(page, inputNodeIds, outputNodeIds) {
  for (const nodeId of inputNodeIds) {
    await page.waitForSelector(`[data-testid="ide-design-live-input-${nodeId}"]`, {
      timeout: 10000,
    });
  }
  for (const nodeId of outputNodeIds) {
    await page.waitForSelector(`[data-testid="ide-design-live-output-${nodeId}"]`, {
      timeout: 10000,
    });
  }
}

async function setInputBit(page, nodeId, value) {
  const target = String(value);
  const inputCodeSelector = `[data-testid="ide-design-live-input-${nodeId}"] code`;
  const current = await text(page.locator(inputCodeSelector));
  assert(
    current === '0' || current === '1',
    `expected binary input value for ${nodeId}, got "${current}"`,
  );
  if (current === target) return;

  const tickBefore = await readTick(page);
  await page.locator(`[data-testid="ide-design-input-toggle-${nodeId}"]`).click();

  await page.waitForFunction(
    ({ selector, expected }) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      return (element.textContent || '').trim() === expected;
    },
    { selector: inputCodeSelector, expected: target },
    { timeout: UPDATE_TIMEOUT_MS },
  );

  const tickAfter = await readTick(page);
  assert(
    tickAfter === tickBefore,
    `combinational input toggle should not advance tick (${nodeId} ${tickBefore} -> ${tickAfter})`,
  );
}

async function assertOutputBit(page, nodeId, expected) {
  const selector = `[data-testid="ide-design-live-output-${nodeId}"] code`;
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

async function readTick(page) {
  const value = Number.parseInt(await text(page.locator('[data-testid="ide-design-sim-tick"]')), 10);
  assert(Number.isFinite(value), 'expected numeric sim tick');
  return value;
}

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}
