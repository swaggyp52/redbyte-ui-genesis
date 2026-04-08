#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE design wire interaction contract satisfied', async ({ page, baseUrl }) => {
  // Use a deterministic desktop viewport so wire hit targets remain in-frame.
  await page.setViewportSize({ width: 1920, height: 1080 });
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { preferredLabStarterTestId: 'ide-project-landing-example-logic-gates' });

  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });

  const andCount = await page.locator('[data-testid^="node-AND-"]').count();
  assert(andCount > 0, 'AND node must exist after starter insertion');
  const andNode = page.locator('[data-testid^="node-AND-"]').last();
  const aPortCount = await andNode.locator('[data-port-id="a"]').count();
  const bPortCount = await andNode.locator('[data-port-id="b"]').count();
  assert(aPortCount > 0, 'AND node must expose port "a"');
  assert(bPortCount > 0, 'AND node must expose port "b"');

  const wireLocator = page.locator('[data-wire-id]').first();
  assert((await page.locator('[data-wire-id]').count()) > 0, 'expected at least one wire after starter insertion');
  await wireLocator.click({ force: true });

  const selectedWire = await page.evaluate(() => {
    const logicStore = window.__RB_LOGIC_VIEW_STORE__;
    const circuitStore = window.__RB_CIRCUIT_STORE__;
    if (!logicStore?.getState || !circuitStore?.getState) return null;
    const selected = Array.from(logicStore.getState().selection?.wires ?? []);
    if (selected.length !== 1) return null;
    const selectedWireId = selected[0];
    const circuit = circuitStore.getState().circuit;
    const connection = (circuit?.connections ?? []).find((entry) => {
      const fromNodeId = typeof entry.from === 'string' ? entry.from : entry.from.nodeId;
      const toNodeId = typeof entry.to === 'string' ? entry.to : entry.to.nodeId;
      const fromPortName =
        typeof entry.from === 'string'
          ? entry.fromPort ?? entry.fromPin ?? 'out'
          : entry.from.portName ?? entry.from.port ?? 'out';
      const toPortName =
        typeof entry.to === 'string'
          ? entry.toPort ?? entry.toPin ?? 'in'
          : entry.to.portName ?? entry.to.port ?? 'in';
      const wireId = `${fromNodeId}.${fromPortName}-${toNodeId}.${toPortName}`;
      return wireId === selectedWireId;
    });
    if (!connection) return null;
    const fromNodeId = typeof connection.from === 'string' ? connection.from : connection.from.nodeId;
    const toNodeId = typeof connection.to === 'string' ? connection.to : connection.to.nodeId;
    const fromPort =
      typeof connection.from === 'string'
        ? connection.fromPort ?? connection.fromPin ?? 'out'
        : connection.from.portName ?? connection.from.port ?? 'out';
    const toPort =
      typeof connection.to === 'string'
        ? connection.toPort ?? connection.toPin ?? 'in'
        : connection.to.portName ?? connection.to.port ?? 'in';
    return {
      wireId: selectedWireId,
      fromNodeId,
      fromPort,
      toNodeId,
      toPort,
      wireCount: circuit?.connections?.length ?? 0,
    };
  });

  assert(Boolean(selectedWire), 'clicking a wire should select exactly one wire');
  assert(selectedWire.wireCount > 0, 'wire count should be positive before delete');

  await page.locator('[data-testid="logic-canvas-svg"]').click({ position: { x: 10, y: 10 } });
  await page.waitForFunction(
    () => {
      const logicStore = window.__RB_LOGIC_VIEW_STORE__;
      if (!logicStore?.getState) return false;
      return (logicStore.getState().selection?.wires?.size ?? 0) === 0;
    },
    undefined,
    { timeout: 10000 }
  );

  await wireLocator.click({ force: true });
  await page.waitForFunction(
    () => {
      const logicStore = window.__RB_LOGIC_VIEW_STORE__;
      if (!logicStore?.getState) return false;
      return (logicStore.getState().selection?.wires?.size ?? 0) === 1;
    },
    undefined,
    { timeout: 10000 }
  );

  await page.keyboard.press('Delete');
  await page.waitForFunction(
    (expectedCount) => {
      const circuitStore = window.__RB_CIRCUIT_STORE__;
      if (!circuitStore?.getState) return false;
      return (circuitStore.getState().circuit?.connections?.length ?? -1) === expectedCount;
    },
    selectedWire.wireCount - 1,
    { timeout: 10000 }
  );

  await page
    .locator(`[data-node-id="${selectedWire.fromNodeId}"] [data-port-id="${selectedWire.fromPort}"]`)
    .first()
    .click({ force: true });
  await page
    .locator(`[data-node-id="${selectedWire.toNodeId}"] [data-port-id="${selectedWire.toPort}"]`)
    .first()
    .click({ force: true });

  await page.waitForFunction(
    (expectedCount) => {
      const circuitStore = window.__RB_CIRCUIT_STORE__;
      if (!circuitStore?.getState) return false;
      return (circuitStore.getState().circuit?.connections?.length ?? -1) === expectedCount;
    },
    selectedWire.wireCount,
    { timeout: 10000 }
  );

  await page.keyboard.press('Control+z');
  await page.waitForFunction(
    (expectedCount) => {
      const circuitStore = window.__RB_CIRCUIT_STORE__;
      if (!circuitStore?.getState) return false;
      return (circuitStore.getState().circuit?.connections?.length ?? -1) === expectedCount;
    },
    selectedWire.wireCount - 1,
    { timeout: 10000 }
  );
});
