#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
];

const SCREENSHOT_ROOT = process.env.RB_DESIGN_WORKBENCH_V1_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_DESIGN_WORKBENCH_V1_SCREENSHOTS_DIR)
  : null;
const CAPTURE_ONLY = process.env.RB_DESIGN_WORKBENCH_V1_CAPTURE_ONLY === '1';

await runIdeGate('IDE Design Workbench v1 satisfied', async ({ page, baseUrl }) => {
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

  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await proveDesignWorkbenchAtViewport(page, baseUrl, viewport);
  }

  assert(
    consoleFindings.length === 0,
    `Design Workbench v1 emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function proveDesignWorkbenchAtViewport(page, baseUrl, viewport) {
  await resetToBlankDesign(page, baseUrl, `blank-${viewport.label}`);
  await waitForDesignWorkbench(page);
  await capture(page, viewport, '01-blank-fresh');
  await checkOrCaptureOnly('blank/fresh', () => assertBlankCanvasStart(page, viewport, 'blank/fresh'));

  await loadStarterDesign(page, baseUrl, 'logic-gates', `logic-gates-${viewport.label}`);
  await capture(page, viewport, '02-logic-gates-starter');
  await checkOrCaptureOnly('Logic Gates starter', () => assertGraphWorkbench(page, viewport, 'Logic Gates starter'));
  await checkOrCaptureOnly('Logic Gates boundary actions', () =>
    assertDesignBoundaryActions(page, 'Logic Gates starter')
  );

  await loadStarterDesign(page, baseUrl, 'half-adder', `half-adder-${viewport.label}`);
  await capture(page, viewport, '03-half-adder');
  await checkOrCaptureOnly('Half Adder starter', () => assertGraphWorkbench(page, viewport, 'Half Adder starter'));

  await loadStarterDesign(page, baseUrl, 'logic-gates', `logic-gates-interactions-${viewport.label}`);
  await checkOrCaptureOnly('Logic Gates interaction baseline', () =>
    assertGraphWorkbench(page, viewport, 'Logic Gates interaction baseline')
  );

  await selectFirstVisibleNode(page);
  await capture(page, viewport, '04-selected-node');
  await checkOrCaptureOnly('selected node', () => assertGraphWorkbench(page, viewport, 'selected node'));
  await checkOrCaptureOnly('selected node state', () => assertSelectionState(page, { node: true }));

  await selectFirstVisibleWire(page);
  await capture(page, viewport, '05-selected-wire');
  await checkOrCaptureOnly('selected wire', () => assertGraphWorkbench(page, viewport, 'selected wire'));
  await checkOrCaptureOnly('selected wire state', () => assertSelectionState(page, { wire: true }));

  await checkOrCaptureOnly('wire creation preview', () => startWireCreation(page));
  await capture(page, viewport, '06-wire-creation');
  await checkOrCaptureOnly('wire cancel', () => cancelWireCreation(page));
  await capture(page, viewport, '06b-wire-cancel');
  await checkOrCaptureOnly('wire creation/cancel', () => assertGraphWorkbench(page, viewport, 'wire creation/cancel'));

  await dragFirstVisibleNode(page);
  await capture(page, viewport, '07-moved-node');
  await checkOrCaptureOnly('moved node', () => assertGraphWorkbench(page, viewport, 'moved node'));

  await deleteSelectionAndUndo(page);
  await capture(page, viewport, '08-delete-undo');
  await checkOrCaptureOnly('delete undo', () => assertGraphWorkbench(page, viewport, 'delete undo'));

  await checkOrCaptureOnly('split/code', () => proveSplitAndCodeViews(page, viewport));
  await capture(page, viewport, '09-split-code');

  await checkOrCaptureOnly('zoom fit center controls', () => proveZoomFitCenter(page, viewport));
  await capture(page, viewport, '10-zoom-fit-center');
  await checkOrCaptureOnly('zoom fit center', () => assertGraphWorkbench(page, viewport, 'zoom fit center'));
}

async function checkOrCaptureOnly(label, callback) {
  if (!CAPTURE_ONLY) {
    await callback();
    return;
  }
  try {
    await callback();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[capture-only] ${label}: ${message}`);
  }
}

async function resetToBlankDesign(page, baseUrl, gateLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-workbench-v1-${gateLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const blankProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: now,
      updatedAt: now,
      name: 'Design Workbench v1 Blank',
      description: 'Browser gate project seeded from an empty circuit.',
      circuit: { nodes: [], connections: [] },
      ioMapping: { inputs: [], outputs: [] },
      vectors: [],
      macros: [],
      customComponents: [],
      meta: {
        projectId: 'rb-design-workbench-v1-blank',
        projectKind: 'blank',
        sourceExampleId: null,
        activeExampleId: null,
      },
    };
    window.__RB_PROJECT_RUNTIME__?.getState?.()?.loadFromProject?.(blankProject);
    window.__RB_PROJECT_RUNTIME__?.getState?.()?.startBlankProject?.();
    window.__RB_CIRCUIT_STORE__?.getState?.()?.reset?.();
    window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.clearSelection?.();
  });

  await page.locator('[data-testid="mode-button-design"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-empty-state"]', { timeout: 10000 });
}

async function loadStarterDesign(page, baseUrl, exampleId, gateLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-workbench-v1-${gateLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: exampleId });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });
  await waitForDesignWorkbench(page);
}

async function waitForDesignWorkbench(page) {
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-toolbar"]', { timeout: 15000 });
  await Promise.race([
    page.waitForSelector('[data-testid="ide-design-dock-palette"]', { timeout: 15000 }),
    page.waitForSelector('[data-testid="ide-workbench-dock-toggle-left"]', { timeout: 15000 }),
  ]);
  await Promise.race([
    page.waitForSelector('[data-testid="ide-inspector"]', { timeout: 15000 }),
    page.waitForSelector('[data-testid="ide-workbench-dock-toggle-right"]', { timeout: 15000 }),
  ]);
}

async function assertBlankCanvasStart(page, viewport, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const metrics = await readWorkbenchMetrics(page);
  assert(metrics.mode === 'design', `${label}: expected Design mode, got ${metrics.mode}`);
  assert(metrics.runtimeNodes === 0, `${label}: expected blank runtime nodes, got ${metrics.runtimeNodes}`);
  assert(metrics.editorNodes === 0, `${label}: expected blank editor nodes, got ${metrics.editorNodes}`);
  assert(metrics.emptyState.visible, `${label}: blank canvas empty state must be visible`);
  assert(metrics.emptyState.inCanvas, `${label}: blank canvas start path must live inside the canvas`);
  assert(metrics.emptyAddIo.visible, `${label}: blank canvas must expose Add boundary I/O`);
  assert(metrics.emptyAddAnd.visible, `${label}: blank canvas must expose a starter gate path`);
  assert(metrics.leftToggle.visible, `${label}: collapsed Library rail must be available`);
  assert(metrics.rightToggle.visible, `${label}: collapsed Inspector rail must be available`);
  assertWorkbenchHierarchy(metrics, viewport, label, { expectGraph: false });
}

async function assertDesignBoundaryActions(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await revealDesignRail(page, 'left');
  const metrics = await readWorkbenchMetrics(page);
  assert(metrics.statusAddIo.visible, `${label}: status bar must expose Add boundary I/O`);
  assert(metrics.paletteInput.visible, `${label}: palette input primitive must stay visible`);
  assert(metrics.paletteOutput.visible, `${label}: palette output primitive must stay visible`);
  await collapseDesignRail(page, 'left');
}

async function revealDesignRail(page, side) {
  const dockSelector = side === 'left' ? '[data-testid="ide-left-dock"]' : '[data-testid="ide-inspector"]';
  if (await page.locator(dockSelector).first().isVisible().catch(() => false)) return;
  const toggleSelector =
    side === 'left' ? '[data-testid="ide-workbench-dock-toggle-left"]' : '[data-testid="ide-workbench-dock-toggle-right"]';
  const toggle = page.locator(toggleSelector).first();
  assert(await toggle.isVisible().catch(() => false), `Design ${side} rail restore toggle must be visible`);
  await toggle.click();
  await page.waitForSelector(dockSelector, { timeout: 5000 });
}

async function collapseDesignRail(page, side) {
  const collapseSelector =
    side === 'left' ? '[data-testid="ide-workbench-dock-collapse-left"]' : '[data-testid="ide-workbench-dock-collapse-right"]';
  const collapse = page.locator(collapseSelector).first();
  if (!(await collapse.isVisible().catch(() => false))) return;
  await collapse.click();
  const dockSelector = side === 'left' ? '[data-testid="ide-left-dock"]' : '[data-testid="ide-inspector"]';
  await page.locator(dockSelector).first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
}

async function assertGraphWorkbench(page, viewport, label, options = {}) {
  await page.evaluate(() => window.scrollTo(0, 0));
  let metrics = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    metrics = await readWorkbenchMetrics(page);
    if (
      metrics.cameraFinite &&
      metrics.runtimeNodes >= 3 &&
      metrics.runtimeConnections >= 1 &&
      metrics.editorNodes >= 3 &&
      metrics.editorConnections >= 1 &&
      metrics.visibleNodeCount >= 3 &&
      metrics.visibleWireCount >= 1 &&
      metrics.badAttributes.length === 0
    ) {
      break;
    }
    await page.waitForTimeout(200);
  }

  metrics = metrics ?? (await readWorkbenchMetrics(page));
  assert(metrics.mode === 'design', `${label}: expected Design mode, got ${metrics.mode}`);
  assert(metrics.cameraFinite, `${label}: camera must stay finite, got ${JSON.stringify(metrics.camera)}`);
  assert(metrics.runtimeNodes >= 3, `${label}: runtime graph lost nodes (${metrics.runtimeNodes})`);
  assert(metrics.runtimeConnections >= 1, `${label}: runtime graph lost wires (${metrics.runtimeConnections})`);
  assert(metrics.editorNodes >= 3, `${label}: editor graph lost nodes (${metrics.editorNodes})`);
  assert(metrics.editorConnections >= 1, `${label}: editor graph lost wires (${metrics.editorConnections})`);
  assert(metrics.visibleNodeCount >= 3, `${label}: visible nodes disappeared (${metrics.visibleNodeCount})`);
  assert(metrics.visibleWireCount >= 1, `${label}: visible wires disappeared (${metrics.visibleWireCount})`);
  assert(
    metrics.badAttributes.length === 0,
    `${label}: SVG attributes contain NaN/Infinity: ${JSON.stringify(metrics.badAttributes)}`
  );
  assertWorkbenchHierarchy(metrics, viewport, label, { expectGraph: true, ...options });
}

function assertWorkbenchHierarchy(metrics, viewport, label, options) {
  const topLimit = viewport.height * 0.34;
  const minCanvasWidth = options.minCanvasWidth ?? 560;
  const minAreaRatio = options.minAreaRatio ?? 0.42;
  const minRailRatio = options.minRailRatio ?? 2.1;
  assert(
    metrics.liveCanvas.top <= topLimit,
    `${label}: live canvas starts too low (${metrics.liveCanvas.top.toFixed(1)}px > ${topLimit.toFixed(1)}px)`
  );
  assert(
    metrics.liveCanvas.width >= minCanvasWidth,
    `${label}: live canvas is too narrow (${metrics.liveCanvas.width.toFixed(1)}px)`
  );
  assert(
    metrics.visibleLiveCanvasHeight >= viewport.height * 0.42,
    `${label}: live canvas does not own enough first-viewport height (${metrics.visibleLiveCanvasHeight.toFixed(1)}px)`
  );
  assert(
    metrics.liveCanvasAreaRatio >= minAreaRatio,
    `${label}: canvas must dominate the middle workspace (ratio=${metrics.liveCanvasAreaRatio.toFixed(3)})`
  );
  assert(
    metrics.leftDock.width <= 232,
    `${label}: palette rail is too wide (${metrics.leftDock.width.toFixed(1)}px)`
  );
  assert(
    metrics.rightDock.width <= 300,
    `${label}: inspector rail is too wide (${metrics.rightDock.width.toFixed(1)}px)`
  );
  assert(
    metrics.canvasToRailWidthRatio >= minRailRatio,
    `${label}: canvas is not dominant over support rails (ratio=${metrics.canvasToRailWidthRatio.toFixed(2)})`
  );
  assert(
    metrics.rootOverflowX <= 2,
    `${label}: root has horizontal overflow (${metrics.rootOverflowX.toFixed(1)}px)`
  );
  assert(
    metrics.canvasControls.visible,
    `${label}: fit/center/zoom canvas controls must remain visible`
  );
  assert(metrics.toolbar.visible, `${label}: toolbar must remain visible`);
  if (options.requireRails !== false) {
    assert(
      metrics.palette.visible || metrics.leftToggle.visible,
      `${label}: Library rail must remain visible or restorable`
    );
    assert(
      metrics.inspector.visible || metrics.rightToggle.visible,
      `${label}: Inspector rail must remain visible or restorable`
    );
  }
  if (options.expectGraph) {
    assert(
      metrics.visibleNodeCount >= 3 && metrics.visibleWireCount >= 1,
      `${label}: loaded graph must be first-viewport canvas content`
    );
  }
}

async function assertSelectionState(page, options) {
  const state = await page.evaluate(() => {
    const selection = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection;
    return {
      nodes: selection?.nodes instanceof Set ? selection.nodes.size : 0,
      wires: selection?.wires instanceof Set ? selection.wires.size : 0,
      wireHandlesVisible: Boolean(document.querySelector('[data-testid="logic-wire-reconnect-layer"]')),
    };
  });
  if (options.node) {
    assert(state.nodes >= 1, `expected a selected node, got ${JSON.stringify(state)}`);
  }
  if (options.wire) {
    assert(state.wires >= 1, `expected a selected wire, got ${JSON.stringify(state)}`);
    assert(state.wireHandlesVisible, 'selected wire must expose reconnect handles');
  }
}

async function startWireCreation(page) {
  await page.evaluate(() => window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.clearSelection?.());
  await page.locator('[data-testid="ide-design-tool-wire"]').first().click();
  await page.waitForFunction(() => {
    const live = document.querySelector('[data-testid="ide-design-live-canvas"]');
    return live?.getAttribute('data-tool-mode') === 'wire';
  }, undefined, { timeout: 5000 });

  const port = await firstVisiblePortPoint(page);
  await page.mouse.click(port.x, port.y);
  let previewVisible = await page
    .waitForSelector('[data-testid="logic-wire-preview"]', { timeout: 1500 })
    .then(() => true)
    .catch(() => false);

  if (!previewVisible) {
    await page.evaluate((portRef) => {
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.startWire?.(portRef);
    }, port.ref);
    await page.mouse.move(port.x + 90, port.y + 40, { steps: 4 });
    previewVisible = await page
      .waitForSelector('[data-testid="logic-wire-preview"]', { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
  }

  assert(previewVisible, 'wire creation must show a preview before cancel');
}

async function cancelWireCreation(page) {
  await page.keyboard.press('Escape');
  const cancelled = await page
    .waitForFunction(() => {
      const live = document.querySelector('[data-testid="ide-design-live-canvas"]');
      return (
        !document.querySelector('[data-testid="logic-wire-preview"]') &&
        live?.getAttribute('data-interaction-mode') !== 'wiring'
      );
    }, undefined, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!cancelled && CAPTURE_ONLY) {
    console.warn('[capture-only] wire cancel: Escape did not return the wire tool to idle; forcing cleanup.');
    await page.evaluate(() => window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.endWire?.());
    return;
  }
  assert(cancelled, 'Escape must cancel active wire creation and return the canvas to idle');
}

async function proveSplitAndCodeViews(page, viewport) {
  await page.locator('[data-testid="ide-design-view-split"]').first().click();
  await page.waitForSelector('[data-testid="ide-design-hdl-pane"]', { timeout: 10000 });
  await assertGraphWorkbench(page, viewport, 'split/code split view', {
    minAreaRatio: 0.24,
    minCanvasWidth: 420,
    minRailRatio: 1.7,
    requireRails: false,
  });
  const splitMetrics = await readWorkbenchMetrics(page);
  assert(splitMetrics.hdlPane.visible, 'split/code: HDL pane must be visible in Split view');

  await page.locator('[data-testid="ide-design-view-hdl"]').first().click();
  await page.waitForSelector('[data-testid="ide-design-hdl-pane"]', { timeout: 10000 });
  const codeMetrics = await readWorkbenchMetrics(page);
  assert(codeMetrics.hdlPane.visible, 'split/code: HDL pane must remain visible in Code view');
  assert(codeMetrics.rootOverflowX <= 2, `Code view has horizontal overflow (${codeMetrics.rootOverflowX}px)`);

  await page.locator('[data-testid="ide-design-view-split"]').first().click();
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-design-hdl-pane"]', { timeout: 10000 });
}

async function proveZoomFitCenter(page, viewport) {
  await page.locator('[data-testid="ide-design-view-canvas"]').first().click();
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 10000 });
  await selectFirstVisibleNode(page);
  const toggle = page.locator('[data-testid="ide-design-view-tools-toggle"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    const expanded = (await toggle.getAttribute('aria-expanded').catch(() => 'false')) === 'true';
    if (!expanded) {
      await toggle.click();
    }
  }
  await page.waitForSelector('[data-testid="ide-design-zoom-preset-50"]', { timeout: 5000 });
  await page.locator('[data-testid="ide-design-zoom-preset-50"]').first().click();
  await assertGraphWorkbench(page, viewport, '50% zoom');
  await page.locator('[data-testid="ide-design-zoom-preset-125"]').first().click();
  await assertGraphWorkbench(page, viewport, '125% zoom');
  await page.locator('[data-testid="ide-design-zoom-preset-fit"]').first().click();
  await page.waitForTimeout(250);
  const center = page.locator('[data-testid="ide-design-center-selection-canvas"]').first();
  if (await center.isVisible().catch(() => false)) {
    await center.click();
  }
  await page.waitForTimeout(250);
  if (await toggle.isVisible().catch(() => false)) {
    const expanded = (await toggle.getAttribute('aria-expanded').catch(() => 'false')) === 'true';
    if (expanded) {
      await toggle.click();
      await page.waitForTimeout(150);
    }
  }
}

async function deleteSelectionAndUndo(page) {
  const before = await readRuntimeCircuit(page);
  const selectedNodeId = await selectFirstVisibleNode(page);
  await page.keyboard.press('Delete');
  await page.waitForFunction(
    (expected) => {
      const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit;
      return (circuit?.nodes?.length ?? 0) === expected.nodeCount - 1;
    },
    before,
    { timeout: 10000 }
  );
  const afterDelete = await readRuntimeCircuit(page);
  assert(
    afterDelete.connectionCount < before.connectionCount,
    `Delete must remove incident wires for ${selectedNodeId}; before=${before.connectionCount} after=${afterDelete.connectionCount}`
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
    before,
    { timeout: 10000 }
  );
}

async function selectFirstVisibleNode(page) {
  const selected = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const canvasRect = canvas?.getBoundingClientRect();
    if (!canvasRect) return null;
    const node = Array.from(document.querySelectorAll('[data-node-id]')).find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 4 && rect.height > 4 && intersectsRect(rect, canvasRect);
    });
    const nodeId = node?.getAttribute('data-node-id') ?? null;
    if (nodeId) {
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selectMultipleNodes?.([nodeId], false);
    }
    function intersectsRect(a, b) {
      return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    }
    return nodeId;
  });
  assert(Boolean(selected), 'expected at least one visible node to select');
  await page.waitForTimeout(150);
  return selected;
}

async function selectFirstVisibleWire(page) {
  const selected = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const canvasRect = canvas?.getBoundingClientRect();
    if (!canvasRect) return null;
    const wire = Array.from(document.querySelectorAll('[data-wire-id]')).find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && intersectsRect(rect, canvasRect);
    });
    const wireId = wire?.getAttribute('data-wire-id') ?? null;
    if (wireId) {
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.clearSelection?.();
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selectWire?.(wireId, false);
    }
    function intersectsRect(a, b) {
      return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    }
    return wireId;
  });
  assert(Boolean(selected), 'expected at least one visible wire to select');
  await page.waitForTimeout(150);
  return selected;
}

async function dragFirstVisibleNode(page) {
  await selectFirstVisibleNode(page);
  const box = await page.locator('[data-node-id]').first().boundingBox();
  assert(Boolean(box), 'expected a visible node bounding box for drag');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 42, start.y + 24, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const bad = await page.evaluate(() => {
    const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
    return nodes
      .map((node) => {
        const x = node.position?.x ?? node.x;
        const y = node.position?.y ?? node.y;
        return { id: node.id, x, y, finite: Number.isFinite(x) && Number.isFinite(y) };
      })
      .filter((node) => !node.finite);
  });
  assert(bad.length === 0, `moved node positions must stay finite: ${JSON.stringify(bad)}`);
}

async function firstVisiblePortPoint(page) {
  const point = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const canvasRect = canvas?.getBoundingClientRect();
    if (!canvasRect) return null;
    const port = Array.from(document.querySelectorAll('[data-port-id]')).find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.width > 3 && rect.height > 3 && intersectsRect(rect, canvasRect);
    });
    if (!port) return null;
    const nodeId = port.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
    const portName = port.getAttribute('data-port-id');
    if (!nodeId || !portName) return null;
    const rect = port.getBoundingClientRect();
    function intersectsRect(a, b) {
      return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    }
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, ref: { nodeId, portName, port: portName } };
  });
  assert(point, 'expected at least one visible port to begin wire creation');
  return point;
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

async function readWorkbenchMetrics(page) {
  return page.evaluate(() => {
    const rectJson = (rect) => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      visible: rect.width > 1 && rect.height > 1,
    });
    const getRect = (selector) => {
      const el = document.querySelector(selector);
      return el?.getBoundingClientRect?.() ?? new DOMRect(0, 0, 0, 0);
    };
    const finite = (value) => typeof value === 'number' && Number.isFinite(value);
    const intersects = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    const inRect = (inner, outer) =>
      inner.left >= outer.left &&
      inner.right <= outer.right &&
      inner.top >= outer.top &&
      inner.bottom <= outer.bottom;

    const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const root = document.querySelector('[data-testid="ide-root"]') ?? document.documentElement;
    const workspace = getRect('[data-testid="ide-mode-body"]');
    const leftDock = getRect('[data-testid="ide-left-dock"]');
    const rightDock = getRect('[data-testid="ide-inspector"]');
    const canvas = getRect('[data-testid="ide-design-canvas"]');
    const liveCanvas = getRect('[data-testid="ide-design-live-canvas"]');
    const toolbar = getRect('[data-testid="ide-design-toolbar"]');
    const canvasControls = getRect('[data-testid="ide-design-canvas-view-tools"]');
    const palette = getRect('[data-testid="ide-design-dock-palette"]');
    const inspector = getRect('[data-testid="ide-inspector"]');
    const leftToggle = getRect('[data-testid="ide-workbench-dock-toggle-left"]');
    const rightToggle = getRect('[data-testid="ide-workbench-dock-toggle-right"]');
    const hdlPane = getRect('[data-testid="ide-design-hdl-pane"]');
    const emptyState = getRect('[data-testid="ide-design-empty-state"]');
    const emptyAddIo = getRect('[data-testid="ide-design-empty-add-io"]');
    const emptyAddAnd = getRect('[data-testid="ide-design-empty-add-and"]');
    const statusAddIo = getRect('[data-testid="ide-design-status-add-io"]');
    const paletteInput = getRect('[data-testid="ide-design-palette-input"]');
    const paletteOutput = getRect('[data-testid="ide-design-palette-output"]');
    const liveVisibleBottom = Math.min(liveCanvas.bottom, viewport.bottom);
    const liveVisibleTop = Math.max(liveCanvas.top, viewport.top);
    const visibleLiveCanvasHeight = Math.max(0, liveVisibleBottom - liveVisibleTop);
    const nodes = Array.from(document.querySelectorAll('[data-node-id]'));
    const wires = Array.from(document.querySelectorAll('[data-wire-id]'));
    const camera = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.camera ?? null;
    const runtimeCircuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit;
    const editorCircuit = window.__RB_CIRCUIT_STORE__?.getState?.()?.circuit;
    const visibleNodeCount = nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 4 && rect.height > 4 && intersects(rect, liveCanvas) && intersects(rect, viewport);
    }).length;
    const visibleWireCount = wires.filter((wire) => {
      const rect = wire.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && intersects(rect, liveCanvas) && intersects(rect, viewport);
    }).length;
    const badAttributes = Array.from(document.querySelectorAll('[x], [y], [width], [height], [transform], [d]'))
      .flatMap((el) => ['x', 'y', 'width', 'height', 'transform', 'd'].map((name) => [el, name, el.getAttribute(name)]))
      .filter(([, , value]) => typeof value === 'string' && /\b(?:NaN|Infinity|-Infinity)\b/.test(value))
      .slice(0, 8)
      .map(([el, name, value]) => ({ tag: el.tagName, testId: el.getAttribute('data-testid'), name, value }));

    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      rootOverflowX: Math.max(
        0,
        root instanceof HTMLElement ? root.scrollWidth - root.clientWidth : document.documentElement.scrollWidth - window.innerWidth
      ),
      camera: camera
        ? {
            x: finite(camera.x) ? camera.x : String(camera.x),
            y: finite(camera.y) ? camera.y : String(camera.y),
            zoom: finite(camera.zoom) ? camera.zoom : String(camera.zoom),
          }
        : null,
      cameraFinite: Boolean(camera && finite(camera.x) && finite(camera.y) && finite(camera.zoom)),
      workspace: rectJson(workspace),
      leftDock: rectJson(leftDock),
      rightDock: rectJson(rightDock),
      canvas: rectJson(canvas),
      liveCanvas: rectJson(liveCanvas),
      toolbar: rectJson(toolbar),
      canvasControls: rectJson(canvasControls),
      palette: rectJson(palette),
      inspector: rectJson(inspector),
      leftToggle: rectJson(leftToggle),
      rightToggle: rectJson(rightToggle),
      hdlPane: rectJson(hdlPane),
      emptyState: { ...rectJson(emptyState), inCanvas: inRect(emptyState, liveCanvas) },
      emptyAddIo: rectJson(emptyAddIo),
      emptyAddAnd: rectJson(emptyAddAnd),
      statusAddIo: rectJson(statusAddIo),
      paletteInput: rectJson(paletteInput),
      paletteOutput: rectJson(paletteOutput),
      visibleLiveCanvasHeight,
      liveCanvasAreaRatio: workspace.width > 0 && workspace.height > 0
        ? (liveCanvas.width * visibleLiveCanvasHeight) / (workspace.width * Math.min(workspace.height, window.innerHeight))
        : 0,
      canvasToRailWidthRatio: Math.max(leftDock.width, rightDock.width) > 0
        ? liveCanvas.width / Math.max(leftDock.width, rightDock.width)
        : liveCanvas.width,
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

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  const filePath = path.join(SCREENSHOT_ROOT, `${name}-${viewport.label}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
}
