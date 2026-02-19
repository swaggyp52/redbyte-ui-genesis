#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

const DRAG_DELTA = { x: 136, y: 88 };

await runIdeGate('IDE design multiselect contract satisfied', async ({ page, baseUrl }) => {
  await runDeterministicPass(page, baseUrl);
});

async function runDeterministicPass(page, baseUrl) {
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  await resetWorkspace(page);
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });

  await ensureSnapEnabled(page);
  await page.locator('[data-testid="ide-design-add-and-starter"]').click();

  await page.waitForFunction(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (!store?.getState) return false;
    return store.getState().circuit.nodes.length >= 4;
  }, undefined, { timeout: 10000 });
  await fitCameraToNodes(page);

  const marqueeResult = await marqueeSelectNodes(page);
  assert(marqueeResult.selectedCount > 1, `expected marquee to select >1 node, got ${marqueeResult.selectedCount}`);
  assert(marqueeResult.boundsVisible, 'selection bounds box marker missing');
  assert(marqueeResult.countBadgeVisible, 'selection count badge marker missing');
  assert(
    marqueeResult.countBadgeText.includes('selected'),
    `selection count badge text mismatch: "${marqueeResult.countBadgeText}"`
  );

  const beforeDragPositions = await getSelectedNodePositions(page);
  assert(beforeDragPositions.length > 1, 'expected selected node positions for multiselect drag');

  const anchorId = beforeDragPositions[0]?.id;
  assert(Boolean(anchorId), 'missing anchor node id for deterministic drag');
  const anchorLocator = page.locator(`g[data-node-id="${anchorId}"]`).first();
  const anchorBox = await anchorLocator.boundingBox();
  assert(Boolean(anchorBox), `missing anchor bounds for node ${anchorId}`);

  const startX = anchorBox.x + anchorBox.width / 2;
  const startY = anchorBox.y + anchorBox.height / 2;
  const endX = startX + DRAG_DELTA.x;
  const endY = startY + DRAG_DELTA.y;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.waitForSelector('[data-testid="logic-selection-delta"]', { timeout: 5000 });
  await page.waitForSelector('[data-testid="logic-snap-guides"]', { timeout: 5000 });
  await page.waitForSelector('[data-testid="logic-snap-indicator"]', { timeout: 5000 });
  await page.mouse.up();

  await page.waitForTimeout(120);

  const afterDragPositions = await getSelectedNodePositions(page);
  assert(afterDragPositions.length === beforeDragPositions.length, 'selected node count changed during drag');
  assert(
    JSON.stringify(afterDragPositions) !== JSON.stringify(beforeDragPositions),
    'drag operation did not change selected node positions'
  );
  assertDeterministicGroupDelta(beforeDragPositions, afterDragPositions);

  const baselineNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? -1;
  });
  assert(baselineNodeCount > 0, `invalid baseline node count: ${baselineNodeCount}`);

  await page.locator('[data-testid="ide-design-tool-delete"]').click();
  await page.waitForFunction(
    (baseline) => {
      const store = window.__RB_CIRCUIT_STORE__;
      if (!store?.getState) return false;
      return store.getState().circuit.nodes.length < baseline;
    },
    baselineNodeCount,
    { timeout: 10000 }
  );

  let restoredNodeCount = await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    return store?.getState?.().circuit?.nodes?.length ?? -1;
  });
  for (let attempt = 0; attempt < 12 && restoredNodeCount !== baselineNodeCount; attempt++) {
    const undoButton = page.locator('[data-testid="ide-design-tool-undo"]');
    const canUndo = await undoButton.isEnabled().catch(() => false);
    if (!canUndo) break;
    await undoButton.click();
    await page.waitForTimeout(80);
    restoredNodeCount = await page.evaluate(() => {
      const store = window.__RB_CIRCUIT_STORE__;
      return store?.getState?.().circuit?.nodes?.length ?? -1;
    });
  }

  assert(
    restoredNodeCount === baselineNodeCount,
    `undo did not restore node count after bulk delete (expected ${baselineNodeCount}, got ${restoredNodeCount})`
  );

}

async function resetWorkspace(page) {
  await page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    if (store?.getState) {
      store.getState().reset();
    }
  });
}

async function ensureSnapEnabled(page) {
  const snapButton = page.locator('[data-testid="ide-design-tool-snap"]').first();
  const snapText = ((await snapButton.textContent()) ?? '').toLowerCase();
  if (!snapText.includes('on')) {
    await snapButton.click();
  }
}

async function marqueeSelectNodes(page) {
  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), 'missing design canvas bounds for marquee selection');
  const nodeEnvelope = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="ide-design-live-canvas"] [data-testid="logic-canvas-svg"]');
    if (!svg) return null;
    const nodes = Array.from(svg.querySelectorAll('g[data-node-id]'));
    const boxes = nodes
      .map((node) => node.getBoundingClientRect())
      .filter((box) => box.width > 0 && box.height > 0);
    if (boxes.length === 0) return null;
    return {
      minX: Math.min(...boxes.map((box) => box.left)),
      minY: Math.min(...boxes.map((box) => box.top)),
      maxX: Math.max(...boxes.map((box) => box.right)),
      maxY: Math.max(...boxes.map((box) => box.bottom)),
    };
  });
  assert(Boolean(nodeEnvelope), 'missing node envelope for marquee selection');

  const startX = Math.max(bounds.x + 6, nodeEnvelope.minX - 18);
  const startY = Math.max(bounds.y + 6, nodeEnvelope.minY - 18);
  const endX = Math.min(bounds.x + bounds.width - 6, nodeEnvelope.maxX + 18);
  const endY = Math.min(bounds.y + bounds.height - 6, nodeEnvelope.maxY + 18);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.waitForSelector('[data-testid="logic-box-marquee"]', { timeout: 5000 });
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelectorAll('g[data-node-id][data-node-selected="1"]').length > 1,
    undefined,
    { timeout: 5000 }
  );

  const selectedCount = await page.evaluate(() => {
    const logicStore = window.__RB_LOGIC_VIEW_STORE__;
    if (!logicStore?.getState) return 0;
    const selection = logicStore.getState().selection;
    return selection?.nodes instanceof Set ? selection.nodes.size : 0;
  });
  const boundsVisible = await page.locator('[data-testid="logic-selection-bounds"]').first().isVisible().catch(() => false);
  const countBadge = page.locator('[data-testid="logic-selection-count-badge"]').first();
  const countBadgeVisible = await countBadge.isVisible().catch(() => false);
  const countBadgeText = (await countBadge.textContent().catch(() => '')) ?? '';

  return {
    selectedCount,
    boundsVisible,
    countBadgeVisible,
    countBadgeText: countBadgeText.trim(),
  };
}

async function getSelectedNodePositions(page) {
  return page.evaluate(() => {
    const store = window.__RB_CIRCUIT_STORE__;
    const logicStore = window.__RB_LOGIC_VIEW_STORE__;
    const circuit = store?.getState?.().circuit;
    const selection = logicStore?.getState?.().selection;
    if (!circuit?.nodes || !(selection?.nodes instanceof Set)) return [];
    const selectedIds = Array.from(selection.nodes).sort();

    const positions = selectedIds
      .map((id) => {
        const node = circuit.nodes.find((entry) => entry.id === id);
        const position = node?.position;
        if (!position) return null;
        return {
          id,
          x: Math.round(position.x),
          y: Math.round(position.y),
        };
      })
      .filter(Boolean);

    return positions;
  });
}

async function fitCameraToNodes(page) {
  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), 'missing canvas bounds for camera fit');

  await page.evaluate(({ width, height }) => {
    const circuitStore = window.__RB_CIRCUIT_STORE__;
    const logicStore = window.__RB_LOGIC_VIEW_STORE__;
    if (!circuitStore?.getState || !logicStore?.getState) return;

    const nodes = circuitStore.getState().circuit?.nodes ?? [];
    if (nodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      if (!node?.position) continue;
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return;

    const padding = 64;
    const worldWidth = Math.max(1, maxX - minX + padding * 2);
    const worldHeight = Math.max(1, maxY - minY + padding * 2);
    const zoom = Math.min(width / worldWidth, height / worldHeight, 1.25);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    logicStore.getState().setCamera({
      x: width / 2 - centerX * zoom,
      y: height / 2 - centerY * zoom,
      zoom,
    });
  }, { width: bounds.width, height: bounds.height });

  await page.waitForTimeout(120);
}

function assertDeterministicGroupDelta(beforePositions, afterPositions) {
  const beforeById = new Map(beforePositions.map((entry) => [entry.id, entry]));
  const afterById = new Map(afterPositions.map((entry) => [entry.id, entry]));
  assert(beforeById.size === afterById.size, 'position maps differ between pre/post drag');

  const ids = Array.from(beforeById.keys()).sort();
  assert(ids.length > 1, 'need at least two selected nodes for group delta assertion');

  const anchorBefore = beforeById.get(ids[0]);
  const anchorAfter = afterById.get(ids[0]);
  assert(anchorBefore && anchorAfter, 'missing anchor positions for deterministic group delta');

  const deltaX = anchorAfter.x - anchorBefore.x;
  const deltaY = anchorAfter.y - anchorBefore.y;

  for (const id of ids) {
    const before = beforeById.get(id);
    const after = afterById.get(id);
    assert(before && after, `missing position pair for selected node ${id}`);
    assert(
      after.x - before.x === deltaX && after.y - before.y === deltaY,
      `non-deterministic group movement detected for ${id}`
    );
  }
}
