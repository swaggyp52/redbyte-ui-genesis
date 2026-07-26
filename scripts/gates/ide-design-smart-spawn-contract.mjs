#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';

const MIN_WORLD_CENTER_SEPARATION = 64;
const MIN_SCREEN_BODY_GAP_AT_TWO_HUNDRED_PERCENT = 24;

await runIdeGate('IDE Design smart-spawn contract satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const failures = [];

  await installCleanStudentContext(page);

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await runSmartSpawnPath(page, baseUrl, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Design smart-spawn browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Design smart-spawn failures:\n${failures.join('\n')}`);
});

async function runSmartSpawnPath(page, baseUrl, viewport) {
  const label = `${viewport.label}/Design smart spawn`;
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-smart-spawn-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, label);
  await assertNoRootOverflow(page, label);

  await clickVisible(page, '[data-testid="ide-project-build-fresh-primary"]', `${label}: Build Fresh`);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });
  await assertNoRootOverflow(page, label);

  await clickVisible(page, '[data-testid="ide-design-empty-add-io"]', `${label}: Add boundary I/O`);
  await waitForNodeCount(page, 2, `${label}: boundary I/O`);

  await revealLeftDock(page);
  const beforeXorIds = await readNodeIds(page);
  await clickVisible(page, '[data-testid="ide-design-palette-xor"]', `${label}: choose XOR`);
  await waitForPlacementState(page, true, `${label}: arm XOR placement`);

  const canvasBounds = await page.locator('[data-testid="ide-design-live-canvas"]').first().boundingBox();
  assert(Boolean(canvasBounds), `${label}: Design canvas bounds unavailable`);
  await page.mouse.click(
    canvasBounds.x + canvasBounds.width * 0.55,
    canvasBounds.y + canvasBounds.height * 0.42
  );
  await waitForNodeCount(page, beforeXorIds.length + 1, `${label}: place XOR`);
  await waitForPlacementState(page, false, `${label}: finish XOR placement`);

  const xorNodeId = await findNewNodeId(page, beforeXorIds, 'XOR');
  assert(Boolean(xorNodeId), `${label}: newly placed XOR identity unavailable`);
  await centerNodeAtTwoHundredPercent(page, xorNodeId, label);

  const beforeAndIds = await readNodeIds(page);
  await clickVisible(
    page,
    '[data-testid="ide-design-quick-add-and"], [data-testid="ide-design-status-add-and"]',
    `${label}: quick Add AND`
  );
  await waitForNodeCount(page, beforeAndIds.length + 1, `${label}: quick Add AND`);
  const andNodeId = await findNewNodeId(page, beforeAndIds, 'AND');
  assert(Boolean(andNodeId), `${label}: quick-added AND identity unavailable`);

  const metrics = await readPlacementMetrics(page, xorNodeId, andNodeId);
  assertPlacementClearance(metrics, label);
}

async function centerNodeAtTwoHundredPercent(page, nodeId, label) {
  const camera = await page.evaluate((targetNodeId) => {
    const circuit = readCircuit();
    const node = circuit?.nodes?.find((entry) => entry.id === targetNodeId);
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const store = window.__RB_LOGIC_VIEW_STORE__;
    if (!node?.position || !canvas || !store?.getState) return null;
    const rect = canvas.getBoundingClientRect();
    const nextCamera = {
      x: rect.width / 2 - node.position.x * 2,
      y: rect.height / 2 - node.position.y * 2,
      zoom: 2,
    };
    store.getState().setCamera(nextCamera);
    return nextCamera;

    function readCircuit() {
      return (
        window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ??
        window.__RB_CIRCUIT_STORE__?.getState?.()?.circuit ??
        null
      );
    }
  }, nodeId);

  assert(Boolean(camera), `${label}: unable to center XOR at 200%`);
  assert(
    Math.abs(camera.x) > 1 || Math.abs(camera.y) > 1,
    `${label}: camera must be panned as well as zoomed ${JSON.stringify(camera)}`
  );
  await waitForBrowserState(
    page,
    () => Math.abs((window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.camera?.zoom ?? 0) - 2) < 0.001,
    undefined,
    `${label}: camera zoom 200%`
  );

  const centering = await page.evaluate((targetNodeId) => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]')?.getBoundingClientRect();
    const body = Array.from(document.querySelectorAll('[data-node-id]'))
      .find((element) => element.getAttribute('data-node-id') === targetNodeId)
      ?.querySelector('.logic-node-body')
      ?.getBoundingClientRect();
    if (!canvas || !body) return null;
    return {
      dx: Math.abs((body.left + body.right) / 2 - (canvas.left + canvas.right) / 2),
      dy: Math.abs((body.top + body.bottom) / 2 - (canvas.top + canvas.bottom) / 2),
    };
  }, nodeId);
  assert(
    centering && centering.dx <= 2 && centering.dy <= 2,
    `${label}: XOR must occupy the visible canvas center before quick Add ${JSON.stringify(centering)}`
  );
}

async function readPlacementMetrics(page, xorNodeId, andNodeId) {
  return page.evaluate(({ targetXorId, targetAndId }) => {
    const circuit =
      window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ??
      window.__RB_CIRCUIT_STORE__?.getState?.()?.circuit ??
      null;
    const xorNode = circuit?.nodes?.find((node) => node.id === targetXorId);
    const andNode = circuit?.nodes?.find((node) => node.id === targetAndId);
    const rectFor = (nodeId) => {
      const body = Array.from(document.querySelectorAll('[data-node-id]'))
        .find((element) => element.getAttribute('data-node-id') === nodeId)
        ?.querySelector('.logic-node-body');
      if (!body) return null;
      const rect = body.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const xorRect = xorNode ? rectFor(xorNode.id) : null;
    const andRect = andNode ? rectFor(andNode.id) : null;
    const overlapX = xorRect && andRect
      ? Math.min(xorRect.right, andRect.right) - Math.max(xorRect.left, andRect.left)
      : null;
    const overlapY = xorRect && andRect
      ? Math.min(xorRect.bottom, andRect.bottom) - Math.max(xorRect.top, andRect.top)
      : null;
    const horizontalGap = xorRect && andRect
      ? Math.max(andRect.left - xorRect.right, xorRect.left - andRect.right)
      : null;
    const verticalGap = xorRect && andRect
      ? Math.max(andRect.top - xorRect.bottom, xorRect.top - andRect.bottom)
      : null;
    return {
      xorPosition: xorNode?.position ?? null,
      andPosition: andNode?.position ?? null,
      xorRect,
      andRect,
      overlapX,
      overlapY,
      separatingGap:
        horizontalGap == null || verticalGap == null
          ? null
          : Math.max(horizontalGap, verticalGap),
      camera: window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.camera ?? null,
    };
  }, { targetXorId: xorNodeId, targetAndId: andNodeId });
}

function assertPlacementClearance(metrics, label) {
  assert(metrics.xorPosition && metrics.andPosition, `${label}: node positions missing ${JSON.stringify(metrics)}`);
  assert(metrics.xorRect && metrics.andRect, `${label}: rendered node bodies missing ${JSON.stringify(metrics)}`);
  assert(Math.abs(metrics.camera?.zoom - 2) < 0.001, `${label}: camera left 200% ${JSON.stringify(metrics.camera)}`);

  const dx = Math.abs(metrics.andPosition.x - metrics.xorPosition.x);
  const dy = Math.abs(metrics.andPosition.y - metrics.xorPosition.y);
  assert(
    dx >= MIN_WORLD_CENTER_SEPARATION || dy >= MIN_WORLD_CENTER_SEPARATION,
    `${label}: quick AND lacks one-grid-cell node-footprint clearance ${JSON.stringify(metrics)}`
  );
  assert(
    metrics.overlapX <= 0 || metrics.overlapY <= 0,
    `${label}: quick AND visibly overlaps XOR at 200% ${JSON.stringify(metrics)}`
  );
  assert(
    metrics.separatingGap >= MIN_SCREEN_BODY_GAP_AT_TWO_HUNDRED_PERCENT,
    `${label}: visible body gap below ${MIN_SCREEN_BODY_GAP_AT_TWO_HUNDRED_PERCENT}px ${JSON.stringify(metrics)}`
  );
}

async function readNodeIds(page) {
  return page.evaluate(() => {
    const circuit =
      window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ??
      window.__RB_CIRCUIT_STORE__?.getState?.()?.circuit ??
      null;
    return (circuit?.nodes ?? []).map((node) => node.id);
  });
}

async function findNewNodeId(page, knownIds, expectedType) {
  return page.evaluate(({ ids, type }) => {
    const known = new Set(ids);
    const circuit =
      window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ??
      window.__RB_CIRCUIT_STORE__?.getState?.()?.circuit ??
      null;
    return (
      (circuit?.nodes ?? []).find(
        (node) => !known.has(node.id) && String(node.type).toUpperCase() === type
      )?.id ?? null
    );
  }, { ids: knownIds, type: expectedType });
}

async function waitForNodeCount(page, minimum, label) {
  await waitForBrowserState(
    page,
    (count) => {
      const circuit =
        window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ??
        window.__RB_CIRCUIT_STORE__?.getState?.()?.circuit ??
        null;
      return (circuit?.nodes?.length ?? 0) >= count;
    },
    minimum,
    label
  );
}

async function waitForPlacementState(page, active, label) {
  await waitForBrowserState(
    page,
    (expected) =>
      document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-placement-active') ===
      (expected ? '1' : '0'),
    active,
    label
  );
}

async function waitForBrowserState(page, predicate, arg, label) {
  try {
    await page.waitForFunction(predicate, arg, { timeout: 10000 });
  } catch (error) {
    throw new Error(`${label}: timed out (${error instanceof Error ? error.message : String(error)})`);
  }
}

async function revealLeftDock(page) {
  const dock = page.locator('[data-testid="ide-left-dock"]').first();
  if (await dock.isVisible().catch(() => false)) return;
  await clickVisible(page, '[data-testid="ide-workbench-dock-toggle-left"]', 'show Design library');
  await dock.waitFor({ state: 'visible', timeout: 5000 });
}

async function clickVisible(page, selector, label) {
  const target = page.locator(selector).first();
  assert(await target.isVisible().catch(() => false), `${label}: ${selector} was not visible`);
  await target.click({ force: true });
}
