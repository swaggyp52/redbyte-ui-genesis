#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
];

const RESPONSIVE_CANVAS_TOOL_IDS = new Map([
  ['ide-design-zoom-out', 'ide-design-overflow-zoom-out'],
  ['ide-design-zoom-in', 'ide-design-overflow-zoom-in'],
  ['ide-design-fit-circuit-canvas', 'ide-design-overflow-fit'],
  ['ide-design-zoom-reset', 'ide-design-overflow-reset'],
  ['ide-design-center-selection-canvas', 'ide-design-overflow-center-selection'],
]);

const SCREENSHOT_ROOT = process.env.RB_DESIGN_CANVAS_DIRECT_WORKBENCH_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_DESIGN_CANVAS_DIRECT_WORKBENCH_SCREENSHOTS_DIR)
  : null;

await runIdeGate('IDE Design canvas direct workbench satisfied', async ({ page, baseUrl }) => {
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
    await loadStarterDesign(page, baseUrl, viewport.label);
    await capture(page, viewport, '01-loaded-design');

    const loadedMetrics = await readDirectCanvasMetrics(page);
    assertDirectCanvas(loadedMetrics, viewport, 'loaded starter direct controls');

    await clickCanvasTool(page, 'ide-design-zoom-reset');
    await page.waitForTimeout(200);
    const resetZoom = await readZoomIndicator(page);

    await clickCanvasTool(page, 'ide-design-zoom-out');
    const zoomedOut = await waitForZoomChange(page, resetZoom);
    assertDirectCanvas(await readDirectCanvasMetrics(page), viewport, 'direct zoom out');

    await clickCanvasTool(page, 'ide-design-zoom-in');
    await waitForZoomChange(page, zoomedOut);
    await capture(page, viewport, '02-direct-controls-zoomed');
    assertDirectCanvas(await readDirectCanvasMetrics(page), viewport, 'direct zoom in');

    await clickCanvasTool(page, 'ide-design-fit-circuit-canvas');
    await page.waitForTimeout(250);
    await capture(page, viewport, '03-direct-controls-fitted');
    assertDirectCanvas(await readDirectCanvasMetrics(page), viewport, 'direct fit');
  }

  assert(
    consoleFindings.length === 0,
    `Design canvas direct workbench emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function loadStarterDesign(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-canvas-direct-workbench-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, 0));
}

function assertDirectCanvas(metrics, viewport, label) {
  const usesResponsiveTools = viewport.width <= 1400;
  assert(metrics.mode === 'design', `${label}: expected Design mode, got ${metrics.mode}`);
  assert(metrics.rootOverflowX <= 2, `${label}: root has horizontal overflow (${metrics.rootOverflowX.toFixed(1)}px)`);
  assert(metrics.liveCanvas.visible, `${label}: live canvas must be visible`);
  assert(
    metrics.liveCanvas.width >= Math.min(760, viewport.width * 0.54),
    `${label}: live canvas is too narrow (${metrics.liveCanvas.width.toFixed(1)}px)`
  );
  assert(
    metrics.liveVisibleHeight >= viewport.height * 0.4,
    `${label}: live canvas visible height is too small (${metrics.liveVisibleHeight.toFixed(1)}px)`
  );
  assert(metrics.visibleNodeCount >= 3, `${label}: loaded graph nodes disappeared (${metrics.visibleNodeCount})`);
  assert(metrics.visibleWireCount >= 1, `${label}: loaded graph wires disappeared (${metrics.visibleWireCount})`);
  assert(!metrics.toggle.visible, `${label}: canvas controls must not be hidden behind a view-tools toggle`);
  assert(metrics.viewTools.insideToolbar, `${label}: direct view tools must remain inside the Design toolbar`);
  assert(!metrics.presets.visible, `${label}: obsolete zoom preset strip must remain absent`);
  if (usesResponsiveTools) {
    assert(!metrics.viewTools.visible, `${label}: desktop camera host must yield at classroom width`);
    assert(!metrics.controls.visible, `${label}: hidden desktop controls must not occupy classroom toolbar space`);
    assert(metrics.overflow.visible, `${label}: More tools must expose responsive camera controls`);
    assert(!metrics.overflow.open, `${label}: responsive camera menu must close after each action`);
    assert(metrics.overflow.insideToolbar, `${label}: More tools must remain inside the Design toolbar`);
    for (const [testId, visible] of Object.entries(metrics.directControls)) {
      assert(!visible, `${label}: desktop canvas control ${testId} must not compete with More tools`);
    }
    for (const [testId, present] of Object.entries(metrics.responsiveControls)) {
      assert(present, `${label}: responsive canvas control ${testId} must remain available`);
    }
  } else {
    assert(metrics.viewTools.visible, `${label}: desktop view tools host must remain visible`);
    assert(metrics.viewTools.open === true, `${label}: desktop view tools host must remain open`);
    assert(metrics.controls.visible, `${label}: direct desktop canvas controls must remain visible`);
    assert(!metrics.overflow.visible, `${label}: desktop toolbar must not duplicate camera controls in More tools`);
    for (const [testId, visible] of Object.entries(metrics.directControls)) {
      assert(visible, `${label}: direct canvas control ${testId} must remain visible`);
    }
  }
  assert(!metrics.minimap.visible, `${label}: minimap must not cover starter graph by default`);
  assert(
    metrics.overlap.visibleGraphNodeCount === 0,
    `${label}: visible camera controls overlap graph nodes (${metrics.overlap.visibleGraphNodeCount})`
  );
  assert(
    metrics.overlap.visibleWireCount === 0,
    `${label}: visible camera controls overlap wires (${metrics.overlap.visibleWireCount})`
  );
  assert(metrics.toolbar.visible, `${label}: Design toolbar must remain visible`);
}

async function readDirectCanvasMetrics(page) {
  return page.evaluate(() => {
    const rectJson = (rect, visibleOverride = null) => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      visible: visibleOverride ?? (rect.width > 1 && rect.height > 1),
    });
    const getElement = (selector) => document.querySelector(selector);
    const getRect = (selector) => getElement(selector)?.getBoundingClientRect?.() ?? new DOMRect(0, 0, 0, 0);
    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1;
    };
    const intersects = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const root = document.querySelector('[data-testid="ide-root"]') ?? document.documentElement;
    const liveCanvas = getRect('[data-testid="ide-design-live-canvas"]');
    const viewToolsEl = getElement('[data-testid="ide-design-canvas-view-tools"]');
    const toolbarEl = getElement('[data-testid="ide-design-toolbar"]');
    const controlsEl = getElement('[data-testid="ide-design-canvas-controls"]');
    const overflowEl = getElement('[data-testid="ide-design-toolbar-overflow"]');
    const overflowSummaryEl = overflowEl?.querySelector('summary') ?? null;
    const presetsEl = getElement('[data-testid="ide-design-zoom-presets"]');
    const toggleEl = getElement('[data-testid="ide-design-view-tools-toggle"]');
    const minimapEl = getElement('.rb-minimap');
    const viewTools = getRect('[data-testid="ide-design-canvas-view-tools"]');
    const overflowSummary = overflowSummaryEl?.getBoundingClientRect?.() ?? new DOMRect(0, 0, 0, 0);
    const visibleCameraHost = isVisible(viewToolsEl) ? viewTools : overflowSummary;
    const visibleNodes = Array.from(document.querySelectorAll('[data-node-id]')).filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 4 && rect.height > 4 && intersects(rect, liveCanvas) && intersects(rect, viewport);
    });
    const visibleWires = Array.from(document.querySelectorAll('[data-wire-id]')).filter((wire) => {
      const rect = wire.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && intersects(rect, liveCanvas) && intersects(rect, viewport);
    });

    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      rootOverflowX: Math.max(
        0,
        root instanceof HTMLElement ? root.scrollWidth - root.clientWidth : document.documentElement.scrollWidth - window.innerWidth
      ),
      liveCanvas: rectJson(liveCanvas),
      liveVisibleHeight: Math.max(0, Math.min(liveCanvas.bottom, window.innerHeight) - Math.max(liveCanvas.top, 0)),
      toolbar: rectJson(getRect('[data-testid="ide-design-toolbar"]')),
      toggle: {
        ...rectJson(getRect('[data-testid="ide-design-view-tools-toggle"]'), isVisible(toggleEl)),
        text: toggleEl?.textContent ?? '',
        ariaExpanded: toggleEl?.getAttribute('aria-expanded') ?? null,
      },
      viewTools: {
        ...rectJson(viewTools, isVisible(viewToolsEl)),
        open: viewToolsEl?.getAttribute('data-open') === 'true',
        insideToolbar: Boolean(toolbarEl && viewToolsEl && toolbarEl.contains(viewToolsEl)),
      },
      controls: rectJson(getRect('[data-testid="ide-design-canvas-controls"]'), isVisible(controlsEl)),
      overflow: {
        ...rectJson(overflowSummary, isVisible(overflowEl) && isVisible(overflowSummaryEl)),
        open: overflowEl?.hasAttribute('open') ?? false,
        insideToolbar: Boolean(toolbarEl && overflowEl && toolbarEl.contains(overflowEl)),
      },
      presets: rectJson(getRect('[data-testid="ide-design-zoom-presets"]'), isVisible(presetsEl)),
      minimap: rectJson(getRect('.rb-minimap'), isVisible(minimapEl)),
      directControls: Object.fromEntries(
        [
          'ide-design-zoom-out',
          'ide-design-zoom-in',
          'ide-design-fit-circuit-canvas',
          'ide-design-zoom-reset',
          'ide-design-center-selection-canvas',
        ].map((testId) => [testId, isVisible(getElement(`[data-testid="${testId}"]`))])
      ),
      responsiveControls: Object.fromEntries(
        [
          'ide-design-overflow-zoom-out',
          'ide-design-overflow-zoom-in',
          'ide-design-overflow-fit',
          'ide-design-overflow-reset',
          'ide-design-overflow-center-selection',
        ].map((testId) => [testId, Boolean(getElement(`[data-testid="${testId}"]`))])
      ),
      visibleNodeCount: visibleNodes.length,
      visibleWireCount: visibleWires.length,
      overlap: {
        visibleGraphNodeCount: visibleNodes.filter((node) => intersects(node.getBoundingClientRect(), visibleCameraHost)).length,
        visibleWireCount: visibleWires.filter((wire) => intersects(wire.getBoundingClientRect(), visibleCameraHost)).length,
      },
    };
  });
}

async function clickCanvasTool(page, primaryTestId) {
  const primary = page.locator(`[data-testid="${primaryTestId}"]`).first();
  if (await primary.isVisible().catch(() => false)) {
    await primary.click();
    return;
  }

  const responsiveTestId = RESPONSIVE_CANVAS_TOOL_IDS.get(primaryTestId);
  assert(Boolean(responsiveTestId), `missing responsive camera mapping for ${primaryTestId}`);
  const overflow = page.locator('[data-testid="ide-design-toolbar-overflow"]').first();
  assert(await overflow.isVisible().catch(() => false), `${primaryTestId}: More tools must be visible`);
  const wasOpen = (await overflow.getAttribute('open')) !== null;
  if (!wasOpen) await overflow.locator('summary').click();

  const responsive = page.locator(`[data-testid="${responsiveTestId}"]`).first();
  await responsive.waitFor({ state: 'visible', timeout: 5000 });
  await responsive.click();

  if (!wasOpen && (await overflow.getAttribute('open')) !== null) {
    await overflow.locator('summary').click();
  }
}

async function readZoomIndicator(page) {
  return (await page.locator('[data-testid="ide-design-canvas-stat-zoom"]').first().textContent())?.trim() ?? '';
}

async function waitForZoomChange(page, previous) {
  await page.waitForFunction(
    (prior) => (document.querySelector('[data-testid="ide-design-canvas-stat-zoom"]')?.textContent?.trim() ?? '') !== prior,
    previous,
    { timeout: 5000 }
  );
  return readZoomIndicator(page);
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
