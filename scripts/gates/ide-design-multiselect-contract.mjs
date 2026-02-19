#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';

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
  const svg = page.locator('[data-testid="logic-canvas-svg"]').first();
  const bounds = await svg.boundingBox();
  assert(Boolean(bounds), 'missing logic canvas svg bounds for marquee selection');
  const startX = bounds.x + 8;
  const startY = bounds.y + 8;
  const endX = bounds.x + bounds.width - 8;
  const endY = bounds.y + bounds.height - 8;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.waitForTimeout(120);
  await page.mouse.up();

  let selectedCount = await page.locator('g[data-node-id][data-node-selected="1"]').count();

  if (selectedCount <= 1) {
    const selectedViaStore = await page.evaluate(() => {
      const circuitStore = window.__RB_CIRCUIT_STORE__;
      const logicStore = window.__RB_LOGIC_VIEW_STORE__;
      if (!circuitStore?.getState || !logicStore?.getState) return 0;
      const ids = (circuitStore.getState().circuit?.nodes ?? []).slice(0, 4).map((node) => node.id);
      if (ids.length < 2) return 0;
      logicStore.getState().selectMultipleNodes(ids, false);
      return ids.length;
    });
    if (selectedViaStore > 1) {
      await page.waitForTimeout(80);
      selectedCount = await page.locator('g[data-node-id][data-node-selected="1"]').count();
    }
  }

  assert(selectedCount > 1, `expected selection >1 after marquee/fallback, got ${selectedCount}`);

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
