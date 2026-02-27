#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

const UPDATE_TIMEOUT_MS = 250;

await runIdeGate('IDE design palette build contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });

  const resetApplied = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return false;
    store.getState().reset();
    return true;
  });
  assert(resetApplied, 'expected circuit store reset API');

  await page.waitForFunction(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return false;
    const circuit = store.getState().circuit;
    return Array.isArray(circuit?.nodes) && circuit.nodes.length === 0;
  });

  await page.locator('[data-testid="ide-design-palette-input"]').first().click();
  await page.locator('[data-testid="ide-design-palette-input"]').first().click();
  await page.locator('[data-testid="ide-design-palette-xor"]').first().click();
  await page.locator('[data-testid="ide-design-palette-output"]').first().click();

  const circuitIds = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return null;
    const nodes = store.getState().circuit?.nodes ?? [];
    const inputNodeIds = nodes.filter((node) => node.type === 'INPUT').map((node) => node.id).slice(0, 2);
    const xorNodeId = nodes.find((node) => node.type === 'XOR')?.id ?? null;
    const outputNodeId = nodes.find((node) => node.type === 'OUTPUT')?.id ?? null;
    return {
      inputNodeIds,
      xorNodeId,
      outputNodeId,
      nodeCount: nodes.length,
    };
  });

  assert(Boolean(circuitIds), 'expected circuit ids from store');
  assert(circuitIds.nodeCount >= 4, `expected at least 4 nodes, got ${circuitIds.nodeCount}`);
  assert(circuitIds.inputNodeIds.length === 2, 'expected two INPUT nodes');
  assert(Boolean(circuitIds.xorNodeId), 'expected XOR node');
  assert(Boolean(circuitIds.outputNodeId), 'expected OUTPUT node');

  const [inputA, inputB] = circuitIds.inputNodeIds;
  const xorNodeId = circuitIds.xorNodeId;
  const outputNodeId = circuitIds.outputNodeId;

  await clickPort(page, inputA, 'out');
  await clickPort(page, xorNodeId, 'a');
  await clickPort(page, inputB, 'out');
  await clickPort(page, xorNodeId, 'b');
  await clickPort(page, xorNodeId, 'out');
  await clickPort(page, outputNodeId, 'in');

  await page.waitForFunction((expectedCount) => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return false;
    return (store.getState().circuit?.connections?.length ?? -1) >= expectedCount;
  }, 3, { timeout: 10000 });

  await ensureSimPaused(page);
  await assertLiveRowsPresent(page, [inputA, inputB], [outputNodeId]);

  const scenarios = [
    { a: 0, b: 0, out: 0 },
    { a: 0, b: 1, out: 1 },
    { a: 1, b: 0, out: 1 },
    { a: 1, b: 1, out: 0 },
  ];

  for (const scenario of scenarios) {
    await setInputBit(page, inputA, scenario.a);
    await setInputBit(page, inputB, scenario.b);
    await assertOutputBit(page, outputNodeId, scenario.out);
  }
});

async function clickPort(page, nodeId, portName) {
  const selector = `[data-node-id="${nodeId}"] [data-port-id="${portName}"]`;
  await page.locator(selector).first().click({ force: true });
}

async function ensureSimPaused(page) {
  const pauseVisible = await page.locator('[data-testid="ide-design-sim-pause"]').first().isVisible().catch(() => false);
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
  assert(current === '0' || current === '1', `expected binary input value for ${nodeId}, got "${current}"`);
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
  assert(actual === String(expected), `expected ${nodeId}=${expected}, got "${actual}"`);
}

async function readTick(page) {
  const value = Number.parseInt(await text(page.locator('[data-testid="ide-design-sim-tick"]')), 10);
  assert(Number.isFinite(value), 'expected numeric sim tick');
  return value;
}

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}
