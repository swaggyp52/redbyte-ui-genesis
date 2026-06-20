#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
];

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

    const compactMetrics = await readDirectCanvasMetrics(page);
    assertDirectCanvas(compactMetrics, viewport, 'loaded starter compact tools');

    const toggle = page.locator('[data-testid="ide-design-view-tools-toggle"]').first();
    await toggle.click();
    await page.waitForFunction(() => {
      const tools = document.querySelector('[data-testid="ide-design-canvas-view-tools"]');
      return tools?.getAttribute('data-open') === 'true';
    }, undefined, { timeout: 5000 });
    await capture(page, viewport, '02-view-tools-open');

    const openMetrics = await readDirectCanvasMetrics(page);
    assertOpenViewTools(openMetrics, viewport, 'expanded view tools');

    await page.locator('[data-testid="ide-design-zoom-preset-125"]').first().click();
    await page.waitForFunction(() => {
      const text = document.querySelector('[data-testid="ide-design-canvas-stat-zoom"]')?.textContent ?? '';
      return /125/.test(text);
    }, undefined, { timeout: 5000 });
    await page.locator('[data-testid="ide-design-zoom-preset-fit"]').first().click();
    await page.waitForTimeout(250);

    await toggle.click();
    await page.waitForFunction(() => {
      const tools = document.querySelector('[data-testid="ide-design-canvas-view-tools"]');
      return tools?.getAttribute('data-open') === 'false';
    }, undefined, { timeout: 5000 });
    await capture(page, viewport, '03-view-tools-reclosed');

    const reclosedMetrics = await readDirectCanvasMetrics(page);
    assertDirectCanvas(reclosedMetrics, viewport, 'reclosed view tools');
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
  assert(metrics.mode === 'design', `${label}: expected Design mode, got ${metrics.mode}`);
  assert(metrics.rootOverflowX <= 2, `${label}: root has horizontal overflow (${metrics.rootOverflowX.toFixed(1)}px)`);
  assert(metrics.liveCanvas.visible, `${label}: live canvas must be visible`);
  const minLiveCanvasWidth = Math.floor(Math.min(760, viewport.width * 0.54));
  assert(
    metrics.liveCanvas.width >= minLiveCanvasWidth,
    `${label}: live canvas is too narrow (${metrics.liveCanvas.width.toFixed(1)}px < ${minLiveCanvasWidth}px)`
  );
  assert(
    metrics.liveVisibleHeight >= viewport.height * 0.4,
    `${label}: live canvas visible height is too small (${metrics.liveVisibleHeight.toFixed(1)}px)`
  );
  assert(metrics.visibleNodeCount >= 3, `${label}: loaded graph nodes disappeared (${metrics.visibleNodeCount})`);
  assert(metrics.visibleWireCount >= 1, `${label}: loaded graph wires disappeared (${metrics.visibleWireCount})`);
  assert(metrics.toggle.visible, `${label}: compact view-tools toggle must be visible`);
  assert(metrics.toggle.text.trim().length > 0, `${label}: compact view-tools toggle must expose a readable label`);
  assert(metrics.viewTools.visible, `${label}: view tools host must remain visible`);
  assert(metrics.viewTools.open === false, `${label}: view tools must be collapsed by default`);
  assert(metrics.viewTools.width <= 180, `${label}: collapsed view tools are too wide (${metrics.viewTools.width.toFixed(1)}px)`);
  assert(metrics.viewTools.height <= 48, `${label}: collapsed view tools are too tall (${metrics.viewTools.height.toFixed(1)}px)`);
  assert(!metrics.controls.visible, `${label}: Fit/Center controls must not be expanded before user request`);
  assert(!metrics.presets.visible, `${label}: zoom presets must not be expanded before user request`);
  assert(!metrics.minimap.visible, `${label}: minimap must not cover starter graph by default`);
  assert(
    metrics.overlap.visibleGraphNodeCount === 0,
    `${label}: compact view tools overlap visible graph nodes (${metrics.overlap.visibleGraphNodeCount})`
  );
  assert(
    metrics.overlap.visibleWireCount === 0,
    `${label}: compact view tools overlap visible wires (${metrics.overlap.visibleWireCount})`
  );
  assert(metrics.toolbar.visible, `${label}: Design toolbar must remain visible`);
}

function assertOpenViewTools(metrics, viewport, label) {
  assert(metrics.viewTools.open === true, `${label}: tools did not expand after toggle`);
  assert(metrics.controls.visible, `${label}: expanded view tools must show Fit/Center controls`);
  assert(metrics.presets.visible, `${label}: expanded view tools must show zoom presets`);
  assert(metrics.viewTools.width <= 380, `${label}: expanded view tools are too wide (${metrics.viewTools.width.toFixed(1)}px)`);
  assert(
    metrics.viewTools.height <= Math.min(190, viewport.height * 0.24),
    `${label}: expanded view tools are too tall (${metrics.viewTools.height.toFixed(1)}px)`
  );
  assert(metrics.toggle.ariaExpanded === 'true', `${label}: toggle aria-expanded must reflect open state`);
  assert(metrics.rootOverflowX <= 2, `${label}: root has horizontal overflow (${metrics.rootOverflowX.toFixed(1)}px)`);
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
    const controlsEl = getElement('[data-testid="ide-design-canvas-controls"]');
    const presetsEl = getElement('[data-testid="ide-design-zoom-presets"]');
    const toggleEl = getElement('[data-testid="ide-design-view-tools-toggle"]');
    const minimapEl = getElement('.rb-minimap');
    const viewTools = getRect('[data-testid="ide-design-canvas-view-tools"]');
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
      },
      controls: rectJson(getRect('[data-testid="ide-design-canvas-controls"]'), isVisible(controlsEl)),
      presets: rectJson(getRect('[data-testid="ide-design-zoom-presets"]'), isVisible(presetsEl)),
      minimap: rectJson(getRect('.rb-minimap'), isVisible(minimapEl)),
      visibleNodeCount: visibleNodes.length,
      visibleWireCount: visibleWires.length,
      overlap: {
        visibleGraphNodeCount: visibleNodes.filter((node) => intersects(node.getBoundingClientRect(), viewTools)).length,
        visibleWireCount: visibleWires.filter((wire) => intersects(wire.getBoundingClientRect(), viewTools)).length,
      },
    };
  });
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
