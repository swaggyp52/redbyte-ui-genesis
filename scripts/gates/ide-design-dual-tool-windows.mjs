#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  openLogicGatesStarter,
} from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { label: 'classroom-stable', width: 1366, height: 768, minCanvasWidth: 850, minCanvasHeight: 380 },
  { label: 'wide-stable', width: 1920, height: 1080, minCanvasWidth: 1400, minCanvasHeight: 620 },
];

await runIdeGate('IDE Design support docks remain stable', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const failures = [];

  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await clearStudentContextOnce(page, baseUrl, viewport.label);
      await openLogicGatesStarter(page, baseUrl, `design-dual-tool-windows-${viewport.label}`);
      await assertBuildHash(page, viewport.label);
      await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });

      const projectSignature = await readProjectSignature(page);
      const initial = await readDockState(page);
      if (viewport.width >= 1920) {
        assert(initial.layoutMode === 'wide', `${viewport.label}: expected wide layout, got ${initial.layoutMode}`);
      }
      assert(initial.left.visible, `${viewport.label}: Library must be open by default ${JSON.stringify(initial)}`);
      assert(initial.right.visible, `${viewport.label}: Inspector must remain a stable support region ${JSON.stringify(initial)}`);
      assert(!initial.leftToggle.visible && !initial.rightToggle.visible, `${viewport.label}: v3 must not render retired restore rails`);
      assertStableCanvas(initial, viewport, 'default workspace');

      const selectedNodeId = await clickFirstVisibleNode(page);
      await page.waitForTimeout(120);
      const inspectorOpen = await readDockState(page);
      assert(
        inspectorOpen.selection.nodes.includes(selectedNodeId),
        `${viewport.label}: clicking ${selectedNodeId} must establish a real Inspector selection ${JSON.stringify(inspectorOpen.selection)}`
      );
      assert(inspectorOpen.left.visible && inspectorOpen.right.visible, `${viewport.label}: selection must not change stable dock geometry`);
      assertStableCanvas(inspectorOpen, viewport, 'selected-node workspace');
      assert(
        Math.abs(inspectorOpen.canvas.width - initial.canvas.width) <= 2,
        `${viewport.label}: selection must not resize the primary canvas ${JSON.stringify({ initial, inspectorOpen })}`
      );
      await assertProjectSignature(page, projectSignature, `${viewport.label}/Inspector selection`);

      await reloadDesign(page);
      await assertBuildHash(page, `${viewport.label}/reload`);
      const reloaded = await readDockState(page);
      assert(reloaded.left.visible, `${viewport.label}: reload must return transient dock UI to the default Library state`);
      assert(reloaded.right.visible, `${viewport.label}: reload must preserve the stable Inspector region`);
      assert(!reloaded.leftToggle.visible && !reloaded.rightToggle.visible, `${viewport.label}: reload must not restore retired rails`);
      assertStableCanvas(reloaded, viewport, 'reloaded default');
      await assertProjectSignature(page, projectSignature, `${viewport.label}/reload persistence`);
      await assertNoRootOverflow(page, viewport.label);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Design support-dock browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Design support-dock failures:\n${failures.join('\n')}`);
});

async function clearStudentContextOnce(page, baseUrl, label) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-support-docks-reset-${label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
}

async function clickFirstVisibleNode(page) {
  const canvas = await page.locator('[data-testid="ide-design-live-canvas"]').first().boundingBox();
  assert(canvas, 'Design live canvas must have a browser-visible bounding box');

  const nodes = page.locator('[data-node-id]');
  const count = await nodes.count();
  for (let index = 0; index < count; index += 1) {
    const node = nodes.nth(index);
    const box = await node.boundingBox();
    if (!box || box.width <= 4 || box.height <= 4 || !intersects(box, canvas)) continue;
    const nodeId = await node.getAttribute('data-node-id');
    if (!nodeId) continue;
    await node.click({ position: { x: box.width / 2, y: box.height / 2 } });
    return nodeId;
  }

  throw new Error('Design canvas must expose a visible node that can be selected with a real click');
}

function intersects(first, second) {
  return (
    first.x + first.width > second.x &&
    first.x < second.x + second.width &&
    first.y + first.height > second.y &&
    first.y < second.y + second.height
  );
}

async function reloadDesign(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  if (!(await page.locator('[data-testid="ide-mode-design"]').first().isVisible().catch(() => false))) {
    const designMode = page.locator('[data-testid="mode-button-design"]').first();
    await designMode.waitFor({ state: 'visible', timeout: 10000 });
    await designMode.click();
  }
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  await page.waitForTimeout(180);
}

async function readDockState(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { visible: false, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visible =
        bounds.width > 1 &&
        bounds.height > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
      return {
        visible,
        left: Math.round(bounds.left),
        top: Math.round(bounds.top),
        right: Math.round(bounds.right),
        bottom: Math.round(bounds.bottom),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const shell = document.querySelector('[data-testid="ide-mode-design"]');
    const canvasElement = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const canvasBounds = canvasElement?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
    const visibleNodeCount = Array.from(document.querySelectorAll('[data-node-id]')).filter((node) => {
      const bounds = node.getBoundingClientRect();
      return (
        bounds.width > 4 &&
        bounds.height > 4 &&
        bounds.right > canvasBounds.left &&
        bounds.left < canvasBounds.right &&
        bounds.bottom > canvasBounds.top &&
        bounds.top < canvasBounds.bottom
      );
    }).length;
    const selection = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection;

    return {
      layoutMode: shell?.getAttribute('data-layout-mode') ?? '',
      supportDockPolicy: shell?.getAttribute('data-support-dock-policy') ?? '',
      leftDockState: shell?.getAttribute('data-left-dock-state') ?? '',
      rightDockState: shell?.getAttribute('data-right-dock-state') ?? '',
      left: rect('[data-testid="ide-left-dock"]'),
      right: rect('[data-testid="ide-right-dock"]'),
      leftToggle: rect('[data-testid="ide-workbench-dock-toggle-left"]'),
      rightToggle: rect('[data-testid="ide-workbench-dock-toggle-right"]'),
      canvas: rect('[data-testid="ide-design-live-canvas"]'),
      canvasPointerEvents: canvasElement ? window.getComputedStyle(canvasElement).pointerEvents : 'missing',
      visibleNodeCount,
      selection: {
        nodes: selection?.nodes instanceof Set ? Array.from(selection.nodes) : [],
        wires: selection?.wires instanceof Set ? Array.from(selection.wires) : [],
      },
    };
  });
}

function assertStableCanvas(state, viewport, label) {
  assert(
    state.supportDockPolicy === 'stable',
    `${viewport.label}/${label}: Design must declare the stable support-region policy ${JSON.stringify(state)}`
  );
  const visibleDockCount = Number(state.left.visible) + Number(state.right.visible);
  assert(
    visibleDockCount === 2,
    `${viewport.label}/${label}: Library and Inspector must remain predictable beside the canvas ${JSON.stringify(state)}`
  );
  assert(state.canvas.visible, `${viewport.label}/${label}: live canvas must remain visible ${JSON.stringify(state)}`);
  assert(
    state.canvas.width >= viewport.minCanvasWidth && state.canvas.height >= viewport.minCanvasHeight,
    `${viewport.label}/${label}: support tools must preserve a usable canvas ${JSON.stringify(state)}`
  );
  assert(state.canvasPointerEvents !== 'none', `${viewport.label}/${label}: live canvas must remain interactive`);
  assert(state.visibleNodeCount > 0, `${viewport.label}/${label}: at least one circuit node must remain visible`);
  if (state.left.visible) {
    assert(state.left.right <= state.canvas.left + 1, `${viewport.label}/${label}: Library must not overlay the canvas`);
  }
  if (state.right.visible) {
    assert(state.canvas.right <= state.right.left + 1, `${viewport.label}/${label}: Inspector must not overlay the canvas`);
  }
}

async function readProjectSignature(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const stable = (value) => {
      if (Array.isArray(value)) return value.map(stable);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
      }
      return value;
    };
    const portRef = (value, fallbackPort) =>
      typeof value === 'string'
        ? { nodeId: value, portName: fallbackPort }
        : {
            nodeId: value?.nodeId ?? null,
            portName: value?.portName ?? value?.port ?? fallbackPort,
          };
    const nodes = (state?.circuit?.nodes ?? [])
      .map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label ?? null,
        x: node.position?.x ?? node.x ?? null,
        y: node.position?.y ?? node.y ?? null,
        rotation: node.rotation ?? 0,
        config: stable(node.config ?? node.params ?? {}),
      }))
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));
    const connections = (state?.circuit?.connections ?? [])
      .map((connection) => ({
        from: portRef(connection.from, connection.fromPin ?? connection.fromPort ?? 'out'),
        to: portRef(connection.to, connection.toPin ?? connection.toPort ?? 'in'),
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return JSON.stringify(
      stable({
        projectName: state?.projectName ?? null,
        nodes,
        connections,
      })
    );
  });
}

async function assertProjectSignature(page, expected, label) {
  const actual = await readProjectSignature(page);
  assert(actual === expected, `${label}: support-dock actions must not mutate or lose the persisted project`);
}
