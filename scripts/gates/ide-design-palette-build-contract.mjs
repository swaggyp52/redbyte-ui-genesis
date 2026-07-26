#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

const UPDATE_TIMEOUT_MS = 1000;

await runIdeGate('IDE design palette build contract satisfied', async ({ page, baseUrl }) => {
  // Deterministic desktop viewport keeps design controls in-frame for interaction.
  await page.setViewportSize({ width: 1920, height: 1080 });
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.locator('[data-testid="ide-project-build-fresh-primary"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });
  await revealDesignLibrary(page);

  const baselineNodeIds = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return null;
    return (store.getState().circuit?.nodes ?? []).map((node) => node.id);
  });
  assert(Array.isArray(baselineNodeIds), 'expected baseline circuit node IDs');

  await placeFromPalette(page, '[data-testid="ide-design-palette-input"]', 'Input', { x: 0.32, y: 0.42 });
  await placeFromPalette(page, '[data-testid="ide-design-palette-input"]', 'Input', { x: 0.32, y: 0.62 });
  await placeFromPalette(page, '[data-testid="ide-design-palette-xor"]', 'XOR', { x: 0.56, y: 0.46 });
  await placeFromPalette(page, '[data-testid="ide-design-palette-output"]', 'Output', { x: 0.8, y: 0.46 });

  const circuitIds = await page.evaluate((knownNodeIds) => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return null;
    const known = new Set(Array.isArray(knownNodeIds) ? knownNodeIds : []);
    const nodes = (store.getState().circuit?.nodes ?? []).filter((node) => !known.has(node.id));
    const inputNodeIds = nodes.filter((node) => node.type === 'INPUT').map((node) => node.id).slice(0, 2);
    const xorNodeId = nodes.find((node) => node.type === 'XOR')?.id ?? null;
    const outputNodeId = nodes.find((node) => node.type === 'OUTPUT')?.id ?? null;
    return {
      inputNodeIds,
      xorNodeId,
      outputNodeId,
      nodeCount: nodes.length,
    };
  }, baselineNodeIds);

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

  const expectedConnections = [
    `${inputA}.out->${xorNodeId}.a`,
    `${inputB}.out->${xorNodeId}.b`,
    `${xorNodeId}.out->${outputNodeId}.in`,
  ];

  await page.waitForFunction((expected) => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return false;
    const serialized = (store.getState().circuit?.connections ?? []).map((entry) => {
      const fromNodeId = typeof entry.from === 'string' ? entry.from : entry.from.nodeId;
      const toNodeId = typeof entry.to === 'string' ? entry.to : entry.to.nodeId;
      const fromPort =
        typeof entry.from === 'string'
          ? entry.fromPort ?? entry.fromPin ?? 'out'
          : entry.from.portName ?? entry.from.port ?? 'out';
      const toPort =
        typeof entry.to === 'string'
          ? entry.toPort ?? entry.toPin ?? 'in'
          : entry.to.portName ?? entry.to.port ?? 'in';
      return `${fromNodeId}.${fromPort}->${toNodeId}.${toPort}`;
    });
    return expected.every((entry) => serialized.includes(entry));
  }, expectedConnections, { timeout: 10000 });

  await ensureSimPaused(page);
  await assertControlsPresent(page, [inputA, inputB], outputNodeId);

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

  await assertUniqueBoardAlias(page, 'SW0', '[data-testid="ide-design-board-input-sw0"]', { x: 0.18, y: 0.22 });
  await assertUniqueBoardAlias(page, 'LD0', '[data-testid="ide-design-board-output-ld0"]', { x: 0.82, y: 0.26 });
  await assertBoardAliasCanDeleteAndReadd(
    page,
    'SW0',
    '[data-testid="ide-design-board-input-sw0"]',
    { x: 0.22, y: 0.8 }
  );
});

async function placeFromPalette(page, buttonSelector, expectedLabel, placementRatio) {
  await revealDesignLibrary(page);

  const beforeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? -1;
  });

  await clickElement(page.locator(buttonSelector).first());

  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    return canvas?.getAttribute('data-placement-active') === '1';
  }, { timeout: 5000 });

  const cueText = (await page.locator('[data-testid="ide-design-placement-cue"]').textContent()) ?? '';
  assert(
    cueText.toLowerCase().includes(String(expectedLabel).toLowerCase()),
    `placement cue mismatch for ${expectedLabel}: ${cueText}`
  );

  const afterPaletteClickCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? -1;
  });
  assert(
    afterPaletteClickCount === beforeCount,
    `${expectedLabel} should not spawn until the canvas is clicked (${beforeCount} -> ${afterPaletteClickCount})`
  );

  await clickCanvasBlank(page, placementRatio.x, placementRatio.y);

  await page.waitForFunction(
    (expectedCount) => {
      const store = window.__RB_CIRCUIT_STORE__;
      const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
      if (!store?.getState || !canvas) return false;
      return (
        (store.getState().circuit?.nodes?.length ?? -1) >= expectedCount &&
        canvas.getAttribute('data-placement-active') === '0'
      );
    },
    beforeCount + 1,
    { timeout: 5000 }
  );
}

async function clickPort(page, nodeId, portName) {
  const selector = `[data-node-id="${nodeId}"] [data-port-id="${portName}"]`;
  await page
    .locator(selector)
    .first()
    .evaluate((element) => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });
}

async function ensureSimPaused(page) {
  const pauseVisible = await page.locator('[data-testid="ide-design-sim-pause"]').first().isVisible().catch(() => false);
  if (pauseVisible) {
    await page.locator('[data-testid="ide-design-sim-pause"]').click();
  }
  const runVisible = await page.locator('[data-testid="ide-design-sim-run"]').first().isVisible().catch(() => false);
  if (runVisible) return;

  // Current passive Design sessions keep simulation state in the story strip
  // instead of exposing transport buttons. The assertions below still verify
  // that input toggles do not advance the tick.
  await page.locator('[data-testid="ide-design-sim-tick"]').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => null);
}

async function assertControlsPresent(page, inputNodeIds, outputNodeId) {
  await ensureLiveInputsExpanded(page);
  for (const nodeId of inputNodeIds) {
    await page.waitForSelector(`[data-testid="ide-design-input-toggle-${nodeId}"]`, {
      timeout: 10000,
    });
  }
  await page.waitForSelector(`[data-testid="node-OUTPUT-${outputNodeId}"]`, {
    timeout: 10000,
  });
}

async function setInputBit(page, nodeId, value) {
  const target = String(value);
  const toggleSelector = `[data-testid="ide-design-input-toggle-${nodeId}"]`;
  await ensureLiveInputsExpanded(page);
  const currentPressed = await page
    .locator(toggleSelector)
    .first()
    .getAttribute('aria-pressed');
  const current = currentPressed === 'true' ? '1' : currentPressed === 'false' ? '0' : null;
  assert(current === '0' || current === '1', `expected binary input toggle state for ${nodeId}, got "${currentPressed}"`);
  if (current === target) return;

  const tickBefore = await readTick(page);
  await page.locator(toggleSelector).first().click();

  await page.waitForFunction(
    ({ selector, expected }) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const pressed = element.getAttribute('aria-pressed');
      return (pressed === 'true' ? '1' : pressed === 'false' ? '0' : '') === expected;
    },
    { selector: toggleSelector, expected: target },
    { timeout: UPDATE_TIMEOUT_MS },
  );

  const tickAfter = await readTick(page);
  if (tickBefore !== null && tickAfter !== null) {
    assert(
      tickAfter === tickBefore,
      `combinational input toggle should not advance tick (${nodeId} ${tickBefore} -> ${tickAfter})`,
    );
  }
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

async function revealDesignLibrary(page) {
  if (await page.locator('[data-testid="ide-left-dock"]').first().isVisible().catch(() => false)) {
    return;
  }
  const libraryToggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
  assert(
    await libraryToggle.isVisible().catch(() => false),
    'design surface must expose a restorable library rail before palette interaction',
  );
  await libraryToggle.click();
  await page.waitForSelector('[data-testid="ide-left-dock"]', { timeout: 5000 });
}

async function assertOutputBit(page, nodeId, expected) {
  const selector = `[data-testid="node-OUTPUT-${nodeId}"]`;
  await page.waitForFunction(
    ({ outputSelector, expectedValue }) => {
      const element = document.querySelector(outputSelector);
      if (!element) return false;
      return (element.getAttribute('data-sim-value') || '').trim() === expectedValue;
    },
    { outputSelector: selector, expectedValue: String(expected) },
    { timeout: UPDATE_TIMEOUT_MS },
  );
  const actual = await page.locator(selector).first().getAttribute('data-sim-value');
  assert(actual === String(expected), `expected ${nodeId}=${expected}, got "${actual}"`);
}

async function clickCanvasBlank(page, xRatio, yRatio) {
  const canvas = page.locator('[data-testid="ide-design-live-canvas"]');
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), 'design canvas bounds unavailable for placement click');
  await page.mouse.click(
    bounds.x + bounds.width * xRatio,
    bounds.y + bounds.height * yRatio
  );
}

async function readTick(page) {
  const tickText = await page.evaluate(() => {
    const element = document.querySelector('[data-testid="ide-design-sim-tick"]');
    return element?.textContent?.trim() ?? '';
  });
  const value = Number.parseInt(tickText, 10);
  return Number.isFinite(value) ? value : null;
}

async function assertUniqueBoardAlias(page, alias, selector, placementRatio) {
  const before = await readBoardAliasNodeCount(page, alias);
  const button = page.locator(selector).first();
  const disabledBefore = await button.isDisabled().catch(() => false);
  if (!disabledBefore) {
    await clickElement(button);
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
      return canvas?.getAttribute('data-placement-active') === '1';
    }, { timeout: 5000 });
    await clickCanvasBlank(page, placementRatio.x, placementRatio.y);
  }
  const disabledAfter = await button.isDisabled().catch(() => false);
  assert(disabledAfter, `${alias} palette entry should become disabled once placed`);
  const after = await readBoardAliasNodeCount(page, alias);
  const expected = disabledBefore ? before : before + 1;
  assert(
    after === expected,
    `${alias} should be unique (expected ${expected} node(s), got ${after})`
  );
  assert(after >= 1, `${alias} should resolve to a visible node after placement`);
  assert(after <= 1, `${alias} should never appear more than once (got ${after})`);
}

async function assertBoardAliasCanDeleteAndReadd(page, alias, selector, placementRatio) {
  const button = page.locator(selector).first();
  const aliasNodeId = await readBoardAliasNodeId(page, alias);
  assert(aliasNodeId, `${alias} should resolve to a node before delete/re-add check`);

  await page.locator(`[data-node-id="${aliasNodeId}"] .logic-node-body`).first().click({ force: true });
  await page.waitForFunction(
    (nodeId) => {
      const store = window.__RB_LOGIC_VIEW_STORE__;
      if (!store?.getState) return false;
      const selected = store.getState().selection?.nodes;
      return selected instanceof Set ? selected.has(nodeId) : false;
    },
    aliasNodeId,
    { timeout: 5000 }
  );
  const nodeDelete = page.locator('[data-testid="ide-design-inspector-delete"]').first();
  await nodeDelete.waitFor({ state: 'visible', timeout: 5000 });
  assert(!(await nodeDelete.isDisabled().catch(() => true)), `${alias} direct node delete must be enabled`);
  assert(
    !(await page.locator('[data-testid="ide-design-context-delete-wire"]').first().isVisible().catch(() => false)),
    `${alias} node selection must expose node delete instead of wire delete`
  );
  await nodeDelete.click();

  await page.waitForFunction(
    (targetAlias) => {
      const store = window.__RB_CIRCUIT_STORE__;
      if (!store?.getState) return false;
      const normalized = String(targetAlias || '').trim().toUpperCase();
      const nodes = store.getState().circuit?.nodes ?? [];
      const count = nodes.filter((node) => String(node.label || '').trim().toUpperCase() === normalized).length;
      return count === 0;
    },
    alias,
    { timeout: 5000 }
  );

  await page.waitForFunction(
    (targetAlias) => {
      const testId = `ide-design-board-input-${String(targetAlias || '').trim().toLowerCase()}`;
      const entry = document.querySelector(`[data-testid="${testId}"]`);
      return entry instanceof HTMLButtonElement && !entry.disabled;
    },
    alias,
    { timeout: 5000 },
  );
  const enabledAfterDelete = !(await button.isDisabled().catch(() => true));
  assert(enabledAfterDelete, `${alias} palette entry should re-enable after deleting its node`);

  await clickElement(button);
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    return canvas?.getAttribute('data-placement-active') === '1';
  }, { timeout: 5000 });
  await clickCanvasBlank(page, placementRatio.x, placementRatio.y);

  await page.waitForFunction(
    (targetAlias) => {
      const store = window.__RB_CIRCUIT_STORE__;
      if (!store?.getState) return false;
      const normalized = String(targetAlias || '').trim().toUpperCase();
      const nodes = store.getState().circuit?.nodes ?? [];
      const count = nodes.filter((node) => String(node.label || '').trim().toUpperCase() === normalized).length;
      return count === 1;
    },
    alias,
    { timeout: 5000 }
  );

  // Board placement selects the new node and the exclusive-dock policy may
  // replace Library with Inspector. Reopen Library before asserting that the
  // board alias is unavailable for a duplicate placement.
  await revealDesignLibrary(page);
  try {
    await page.waitForFunction(
      (targetAlias) => {
        const testId = `ide-design-board-input-${String(targetAlias || '').trim().toLowerCase()}`;
        const entry = document.querySelector(`[data-testid="${testId}"]`);
        return entry instanceof HTMLButtonElement && entry.disabled;
      },
      alias,
      { timeout: 5000 },
    );
  } catch (error) {
    const diagnostics = await readBoardAliasDiagnostics(page, alias);
    throw new Error(
      `${alias} palette entry did not disable after re-placement: ${JSON.stringify(diagnostics)} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const disabledAfterReadd = await button.isDisabled().catch(() => false);
  assert(disabledAfterReadd, `${alias} palette entry should disable again after re-placement`);
}

async function readBoardAliasNodeCount(page, alias) {
  return page.evaluate((targetAlias) => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return 0;
    const normalized = String(targetAlias || '').trim().toUpperCase();
    const nodes = store.getState().circuit?.nodes ?? [];
    return nodes.filter((node) => String(node.label || '').trim().toUpperCase() === normalized).length;
  }, alias);
}

async function readBoardAliasNodeId(page, alias) {
  return page.evaluate((targetAlias) => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return null;
    const normalized = String(targetAlias || '').trim().toUpperCase();
    const nodes = store.getState().circuit?.nodes ?? [];
    const hit = nodes.find((node) => String(node.label || '').trim().toUpperCase() === normalized);
    return hit?.id ?? null;
  }, alias);
}

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function readBoardAliasDiagnostics(page, alias) {
  return page.evaluate((targetAlias) => {
    const normalized = String(targetAlias || '').trim().toUpperCase();
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const circuitStore = window.__RB_CIRCUIT_STORE__?.getState?.();
    const testId = `ide-design-board-input-${normalized.toLowerCase()}`;
    const entry = document.querySelector(`[data-testid="${testId}"]`);
    const compactNode = (node) => ({ id: node.id, type: node.type, label: node.label });
    return {
      entry: entry instanceof HTMLButtonElement
        ? { disabled: entry.disabled, className: entry.className, title: entry.title }
        : null,
      runtimeNodes: (runtime?.circuit?.nodes ?? [])
        .filter((node) => String(node.label || '').trim().toUpperCase() === normalized)
        .map(compactNode),
      circuitStoreNodes: (circuitStore?.circuit?.nodes ?? [])
        .filter((node) => String(node.label || '').trim().toUpperCase() === normalized)
        .map(compactNode),
      ioRows: (runtime?.projectIoRows ?? []).filter((row) =>
        [row.id, row.label, row.pin].some((value) => String(value || '').trim().toUpperCase() === normalized),
      ),
    };
  }, alias);
}

async function clickElement(locator) {
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error('expected clickable HTMLElement');
    }
    element.click();
  });
}
