#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE design build contract satisfied', async ({ page, baseUrl }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (store?.getState) {
      store.getState().reset();
    }
  });

  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-toolbar"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-tool-segmented"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-empty-state"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-canvas-stat-zoom"]', { timeout: 10000 });

  const canvasViewTools = page.locator('[data-testid="ide-design-canvas-view-tools"]').first();
  await canvasViewTools.waitFor({ state: 'visible', timeout: 10000 });
  assert(
    (await canvasViewTools.getAttribute('data-open')) === 'true',
    'canvas view controls must be directly available without a disclosure toggle'
  );
  await page.waitForSelector('[data-testid="ide-design-tool-undo"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-tool-redo"]', { timeout: 10000 });
  assert(
    (await page.locator('[data-testid="ide-design-tools-toggle"]').count()) === 0,
    'the removed secondary Tools disclosure must not return'
  );

  const checklistCount = await page.locator('[data-testid="ide-design-empty-checklist"] li').count();
  assert(checklistCount === 3, `expected three empty-state checklist steps, found ${checklistCount}`);

  const primaryCtaCount = await page
    .locator('[data-testid="ide-design-empty-add-io"], [data-testid="ide-design-empty-add-and"]')
    .count();
  assert(primaryCtaCount === 2, `expected two empty-state primary actions, found ${primaryCtaCount}`);

  const initialSnapshot = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return null;
    const circuit = store.getState().circuit;
    return { nodes: circuit.nodes.length, wires: circuit.connections.length };
  });
  assert(initialSnapshot, 'circuit store unavailable on window.__RB_CIRCUIT_STORE__');

  const initialZoom = await page.locator('[data-testid="ide-design-canvas-stat-zoom"]').innerText();

  await page.locator('[data-testid="ide-design-tool-select"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-tool-mode') === 'select',
    undefined,
    { timeout: 5000 }
  );
  await page.locator('[data-testid="ide-design-tool-wire"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-tool-mode') === 'wire',
    undefined,
    { timeout: 5000 }
  );
  const wirePillText = (await page.locator('[data-testid="ide-design-wire-cue"]').first().textContent())?.trim();
  assert(
    (wirePillText ?? '').toLowerCase().includes('wire') ||
      (wirePillText ?? '').toLowerCase().includes('pin'),
    `wire mode cue mismatch: ${wirePillText}`
  );

  const addAndStarterSelector =
    '[data-testid="ide-design-add-and-starter"], [data-testid="ide-design-empty-add-and"]';
  await page.locator(addAndStarterSelector).first().evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  });

  await page.waitForFunction(
    (baseline) => {
      const store = window.__RB_CIRCUIT_STORE__;
      if (!store?.getState) return false;
      return store.getState().circuit.nodes.length >= baseline + 4;
    },
    initialSnapshot.nodes,
    { timeout: 10000 }
  );

  const inputNodes = page.locator('[data-testid^="node-INPUT-"]');
  const andNode = page.locator('[data-testid^="node-AND-"]').first();
  const outputNode = page.locator('[data-testid^="node-OUTPUT-"]').first();

  assert((await inputNodes.count()) >= 2, 'expected at least two INPUT nodes');
  assert((await andNode.count()) === 1, 'expected an AND node');
  assert((await outputNode.count()) === 1, 'expected an OUTPUT node');

  await page.locator('[data-testid="ide-design-tool-wire"]').click();

  const connectionSeeded = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return false;
    const state = store.getState();
    const nodes = state.circuit.nodes ?? [];
    const input = nodes.find((node) => node.type === 'INPUT');
    const andNode = nodes.find((node) => node.type === 'AND');
    const output = nodes.find((node) => node.type === 'OUTPUT');
    if (!input || !andNode || !output) return false;

    state.addConnection(
      { nodeId: input.id, portName: 'out' },
      { nodeId: andNode.id, portName: 'in' }
    );
    state.addConnection(
      { nodeId: andNode.id, portName: 'out' },
      { nodeId: output.id, portName: 'in' }
    );
    return true;
  });
  assert(connectionSeeded, 'failed to seed deterministic wire connections');

  await page.waitForFunction(
    () => {
      const store = window.__RB_CIRCUIT_STORE__;
      if (!store?.getState) return false;
      return store.getState().circuit.connections.length >= 2;
    },
    { timeout: 10000 }
  );

  const afterWireSnapshot = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return null;
    const state = store.getState();
    return {
      nodes: state.circuit.nodes.length,
      wires: state.circuit.connections.length,
      selectionCount: state.selection?.nodes?.size ?? 0,
    };
  });
  assert(afterWireSnapshot, 'post-wire snapshot unavailable');

  const canvas = page.locator('[data-testid="ide-design-live-canvas"]');
  const canvasBounds = await canvas.boundingBox();
  assert(Boolean(canvasBounds), 'design canvas bounds unavailable for marquee drag');

  const startX = canvasBounds.x + canvasBounds.width * 0.24;
  const startY = canvasBounds.y + canvasBounds.height * 0.3;
  const endX = canvasBounds.x + canvasBounds.width * 0.78;
  const endY = canvasBounds.y + canvasBounds.height * 0.72;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await page.waitForTimeout(80);
  await page.mouse.up();

  await inputNodes.nth(0).click({ force: true });
  await inputNodes.nth(1).click({ modifiers: ['Shift'], force: true });

  const selectionPrimed = await page.evaluate(() => {
    const circuitStore = window.__RB_CIRCUIT_STORE__;
    const viewStore = window.__RB_LOGIC_VIEW_STORE__;
    if (!circuitStore?.getState || !viewStore?.getState) return false;
    const nodes = circuitStore.getState().circuit.nodes ?? [];
    const inputIds = nodes.filter((node) => node.type === 'INPUT').slice(0, 2).map((node) => node.id);
    if (inputIds.length < 2) return false;
    viewStore.getState().setToolMode('select');
    viewStore.getState().selectMultipleNodes(inputIds, false);
    return true;
  });
  assert(selectionPrimed, 'failed to prime multi-selection in logic view store');

  await page.keyboard.press('Delete');

  await page.waitForFunction(
    (baseline) => {
      const store = window.__RB_CIRCUIT_STORE__;
      if (!store?.getState) return false;
      return store.getState().circuit.nodes.length <= baseline;
    },
    afterWireSnapshot.nodes - 2,
    { timeout: 10000 }
  );

  const updatedZoom = await page.locator('[data-testid="ide-design-canvas-stat-zoom"]').innerText();
  assert(updatedZoom.includes('%'), `expected zoom indicator percent, got ${updatedZoom}`);
  assert(initialZoom.includes('%'), `expected initial zoom indicator percent, got ${initialZoom}`);

  const finalSnapshot = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    const circuit = store?.getState?.().circuit;
    return {
      nodes: circuit?.nodes?.length ?? -1,
      wires: circuit?.connections?.length ?? -1,
      hasCrash: Boolean(document.querySelector('[data-testid="rb-ide-boot-crash"]')),
    };
  });

  assert(finalSnapshot.nodes >= 0, 'node count unavailable after design flow');
  assert(finalSnapshot.wires >= 0, 'wire count unavailable after design flow');
  assert(!finalSnapshot.hasCrash, 'crash marker detected during design flow');
  assert(pageErrors.length === 0, `page errors detected: ${pageErrors.join(' | ')}`);
});

