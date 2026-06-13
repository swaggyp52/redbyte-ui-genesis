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
  await clickWireHitPath(page, wireLocator);
  await waitForSingleWireSelection(page, null, 'initial wire click should select one wire');

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
  await waitForWireSelectionCount(page, 0, 'canvas click should clear wire selection');
  await waitForWireDomSelection(page, selectedWire.wireId, false, 'canvas click should clear selected wire styling');

  await clickWireHitPath(page, wireLocator);
  await waitForSingleWireSelection(page, selectedWire.wireId, 'second wire click should reselect the same wire');

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

async function clickWireHitPath(page, wireLocator) {
  const hitPath = wireLocator.locator('path').first();
  const point = await hitPath
    .evaluate((path) => {
      if (!(path instanceof SVGPathElement)) return null;
      const ctm = path.getScreenCTM();
      if (!ctm) return null;
      const midpoint = path.getPointAtLength(path.getTotalLength() / 2);
      const screenPoint = new DOMPoint(midpoint.x, midpoint.y).matrixTransform(ctm);
      return { x: screenPoint.x, y: screenPoint.y };
    })
    .catch(() => null);

  if (point) {
    await page.mouse.click(point.x, point.y);
    return;
  }

  await wireLocator.click({ force: true });
}

async function waitForSingleWireSelection(page, expectedWireId, label) {
  await waitForWireSelection(page, { label, expectedWireId, expectedCount: 1 });
}

async function waitForWireSelectionCount(page, expectedCount, label) {
  await waitForWireSelection(page, { label, expectedCount });
}

async function waitForWireSelection(page, expectation) {
  try {
    await page.waitForFunction(
      ({ label, expectedWireId, expectedCount }) => {
        const logicStore = window.__RB_LOGIC_VIEW_STORE__;
        if (!logicStore?.getState) return false;
        const selected = Array.from(logicStore.getState().selection?.wires ?? []);
        window.__RB_DESIGN_WIRE_GATE_LAST_SELECTION__ = { label, selected, expectedWireId, expectedCount };
        if (selected.length !== expectedCount) return false;
        return expectedWireId ? selected[0] === expectedWireId : true;
      },
      expectation,
      { timeout: 10000 }
    );
  } catch (error) {
    const state = await page
      .evaluate(() => window.__RB_DESIGN_WIRE_GATE_LAST_SELECTION__ ?? null)
      .catch(() => null);
    throw new Error(
      `${expectation.label}: ${error instanceof Error ? error.message : String(error)}; state=${JSON.stringify(state)}`
    );
  }
}

async function waitForWireDomSelection(page, wireId, expectedSelected, label) {
  try {
    await page.waitForFunction(
      ({ expectedWireId, selected }) => {
        const wire = document.querySelector(`[data-wire-id="${expectedWireId}"]`);
        return wire?.getAttribute('data-wire-selected') === (selected ? '1' : '0');
      },
      { expectedWireId: wireId, selected: expectedSelected },
      { timeout: 10000 }
    );
  } catch (error) {
    const state = await page
      .evaluate((expectedWireId) => {
        const wire = document.querySelector(`[data-wire-id="${expectedWireId}"]`);
        return {
          wireId: expectedWireId,
          dataWireSelected: wire?.getAttribute('data-wire-selected') ?? null,
          selected: Array.from(window.__RB_LOGIC_VIEW_STORE__?.getState?.().selection?.wires ?? []),
        };
      }, wireId)
      .catch(() => null);
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}; state=${JSON.stringify(state)}`);
  }
}
