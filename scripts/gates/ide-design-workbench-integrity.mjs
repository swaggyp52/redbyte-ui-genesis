#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

await runIdeGate('IDE design workbench integrity satisfied', async ({ page, baseUrl }) => {
  const consoleFindings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      consoleFindings.push({ type: message.type(), text, location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    consoleFindings.push({ type: 'pageerror', text: error.message });
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  await page.goto(`${baseUrl}/?mode=project&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });

  await assertDesignGraph(page, 'starter loaded');

  await dragFirstVisibleNode(page);
  await assertRuntimeCircuitFinite(page, 'after node drag');
  await assertDesignGraph(page, 'after node drag');

  const beforeDelete = await readRuntimeCircuit(page);
  const selectedNodeId = await selectFirstVisibleNode(page);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(250);
  const afterDelete = await readRuntimeCircuit(page);
  assert(
    afterDelete.nodeCount === beforeDelete.nodeCount - 1,
    `Delete must remove exactly one selected node (${selectedNodeId}); before=${beforeDelete.nodeCount} after=${afterDelete.nodeCount}`
  );
  assert(
    afterDelete.connectionCount < beforeDelete.connectionCount,
    `Delete must remove incident wires; before=${beforeDelete.connectionCount} after=${afterDelete.connectionCount}`
  );

  await page.keyboard.press('Control+z');
  await page.waitForFunction(
    (expected) => {
      const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
      return (
        runtime?.circuit?.nodes?.length === expected.nodeCount &&
        runtime?.circuit?.connections?.length === expected.connectionCount
      );
    },
    beforeDelete,
    { timeout: 10000 }
  );
  await assertDesignGraph(page, 'after delete undo');

  for (const testId of ['ide-design-view-code', 'ide-design-view-split', 'ide-design-view-canvas']) {
    const button = page.locator(`[data-testid="${testId}"]`).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ force: true });
      await page.waitForTimeout(150);
      if (testId !== 'ide-design-view-code') {
        await assertDesignGraph(page, `after ${testId}`);
      }
    }
  }

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });
  await assertDesignGraph(page, 'after Design Verify Design');

  await page.goto(`${baseUrl}/?mode=design&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });
  await assertDesignGraph(page, 'after direct Design reload');

  assert(
    consoleFindings.length === 0,
    `Design workbench emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function assertDesignGraph(page, label) {
  let state = null;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    state = await readDesignState(page);
    if (
      state.cameraFinite &&
      state.visibleNodeCount >= 3 &&
      state.visibleWireCount >= 1 &&
      state.badAttributes.length === 0
    ) {
      break;
    }
    await page.waitForTimeout(200);
  }
  state = state ?? (await readDesignState(page));

  assert(state.mode === 'design', `${label}: expected design mode, got ${state.mode}`);
  assert(state.cameraFinite, `${label}: camera must stay finite, got ${JSON.stringify(state.camera)}`);
  assert(state.runtimeNodes >= 3, `${label}: runtime graph lost nodes (${state.runtimeNodes})`);
  assert(state.runtimeConnections >= 1, `${label}: runtime graph lost wires (${state.runtimeConnections})`);
  assert(state.editorNodes >= 3, `${label}: editor graph lost nodes (${state.editorNodes})`);
  assert(state.editorConnections >= 1, `${label}: editor graph lost wires (${state.editorConnections})`);
  assert(state.canvasRect.width >= 240, `${label}: canvas width too small (${state.canvasRect.width})`);
  assert(state.canvasRect.height >= 160, `${label}: canvas height too small (${state.canvasRect.height})`);
  assert(state.visibleNodeCount >= 3, `${label}: visible nodes disappeared (${state.visibleNodeCount})`);
  assert(state.visibleWireCount >= 1, `${label}: visible wires disappeared (${state.visibleWireCount})`);
  assert(
    state.badAttributes.length === 0,
    `${label}: SVG attributes contain NaN/Infinity: ${JSON.stringify(state.badAttributes)}`
  );
}

async function readDesignState(page) {
  return page.evaluate(() => {
    const finite = (value) => typeof value === 'number' && Number.isFinite(value);
    const rectJson = (rect) => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    const intersects = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const canvasRect = canvas?.getBoundingClientRect?.() ?? new DOMRect(0, 0, 0, 0);
    const nodes = Array.from(document.querySelectorAll('[data-node-id]'));
    const wirePaths = Array.from(document.querySelectorAll('[data-wire-id] path, [data-connection-id] path'));
    const camera = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.camera ?? null;
    const runtimeCircuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit;
    const editorCircuit = window.__RB_CIRCUIT_STORE__?.getState?.()?.circuit;
    const visibleNodeCount = nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 4 && rect.height > 4 && intersects(rect, canvasRect);
    }).length;
    const visibleWireCount = wirePaths.filter((wire) => {
      const rect = wire.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && intersects(rect, canvasRect);
    }).length;
    const badAttributes = Array.from(document.querySelectorAll('[x], [y], [width], [height], [transform], [d]'))
      .flatMap((el) => ['x', 'y', 'width', 'height', 'transform', 'd'].map((name) => [el, name, el.getAttribute(name)]))
      .filter(([, , value]) => typeof value === 'string' && /\b(?:NaN|Infinity|-Infinity)\b/.test(value))
      .slice(0, 8)
      .map(([el, name, value]) => ({ tag: el.tagName, testId: el.getAttribute('data-testid'), name, value }));
    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      camera: camera
        ? {
            x: finite(camera.x) ? camera.x : String(camera.x),
            y: finite(camera.y) ? camera.y : String(camera.y),
            zoom: finite(camera.zoom) ? camera.zoom : String(camera.zoom),
          }
        : null,
      cameraFinite: Boolean(camera && finite(camera.x) && finite(camera.y) && finite(camera.zoom)),
      canvasRect: rectJson(canvasRect),
      runtimeNodes: runtimeCircuit?.nodes?.length ?? 0,
      runtimeConnections: runtimeCircuit?.connections?.length ?? 0,
      editorNodes: editorCircuit?.nodes?.length ?? 0,
      editorConnections: editorCircuit?.connections?.length ?? 0,
      visibleNodeCount,
      visibleWireCount,
      badAttributes,
    };
  });
}

async function readRuntimeCircuit(page) {
  return page.evaluate(() => {
    const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit;
    return {
      nodeCount: circuit?.nodes?.length ?? 0,
      connectionCount: circuit?.connections?.length ?? 0,
    };
  });
}

async function assertRuntimeCircuitFinite(page, label) {
  const state = await page.evaluate(() => {
    const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
    return nodes.map((node) => {
      const x = node.position?.x ?? node.x;
      const y = node.position?.y ?? node.y;
      return { id: node.id, x, y, finite: Number.isFinite(x) && Number.isFinite(y) };
    });
  });
  const bad = state.filter((node) => !node.finite);
  assert(bad.length === 0, `${label}: runtime node positions must stay finite, got ${JSON.stringify(bad)}`);
}

async function selectFirstVisibleNode(page) {
  const selected = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const canvasRect = canvas?.getBoundingClientRect();
    if (!canvasRect) return null;
    const node = Array.from(document.querySelectorAll('[data-node-id]')).find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return (
        rect.width > 4 &&
        rect.height > 4 &&
        rect.right > canvasRect.left &&
        rect.left < canvasRect.right &&
        rect.bottom > canvasRect.top &&
        rect.top < canvasRect.bottom
      );
    });
    const nodeId = node?.getAttribute('data-node-id') ?? null;
    if (nodeId) {
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selectMultipleNodes?.([nodeId], false);
    }
    return nodeId;
  });
  assert(Boolean(selected), 'expected at least one visible node to select');
  await page.waitForTimeout(150);
  return selected;
}

async function dragFirstVisibleNode(page) {
  const node = page.locator('[data-node-id]').first();
  const box = await node.boundingBox();
  assert(Boolean(box), 'expected a visible node bounding box for drag');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y + 24, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}
