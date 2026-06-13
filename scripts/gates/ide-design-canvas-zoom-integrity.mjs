#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: 'classroom', width: 1366, height: 768 },
  { label: 'desktop', width: 1440, height: 900 },
];

const ZOOM_SEQUENCE = [
  'ide-design-zoom-preset-50',
  'ide-design-zoom-preset-75',
  'ide-design-zoom-preset-100',
  'ide-design-zoom-preset-125',
  'ide-design-zoom-preset-fit',
];

const screenshotDir = process.env.RB_DESIGN_CANVAS_ZOOM_INTEGRITY_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_DESIGN_CANVAS_ZOOM_INTEGRITY_SCREENSHOTS_DIR)
  : null;

await runIdeGate('IDE design canvas zoom integrity satisfied', async ({ page, baseUrl }) => {
  const consoleFindings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' ||
      /\b(?:NaN|Infinity|-Infinity)\b/.test(text) ||
      /Expected length/.test(text)
    ) {
      consoleFindings.push({
        type: message.type(),
        text,
        location: message.location(),
      });
    }
  });
  page.on('pageerror', (error) => {
    consoleFindings.push({ type: 'pageerror', text: error.message });
  });

  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  if (screenshotDir) {
    await fs.mkdir(screenshotDir, { recursive: true });
  }

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loadLogicGatesDesign(page, baseUrl);
    await assertCanvasIntegrity(page, `${viewport.label}: loaded`);
    await maybeScreenshot(page, `${viewport.label}-loaded.png`);

    for (let cycle = 1; cycle <= 2; cycle += 1) {
      for (const testId of ZOOM_SEQUENCE) {
        await clickUniqueTestId(page, testId);
        await assertCanvasIntegrity(page, `${viewport.label}: cycle ${cycle} after ${testId}`);
      }
    }

    await clickUniqueTestId(page, 'ide-design-presentation-zoom-toggle-canvas');
    await assertCanvasIntegrity(page, `${viewport.label}: after dense/classroom toggle`);

    await clickUniqueTestId(page, 'ide-design-zoom-preset-fit');
    await assertCanvasIntegrity(page, `${viewport.label}: after post-toggle fit`);

    await selectFirstVisibleNode(page);
    await clickUniqueTestId(page, 'ide-design-center-selection-canvas');
    await assertCanvasIntegrity(page, `${viewport.label}: after center selection`);

    await page.setViewportSize({ width: viewport.width + 96, height: viewport.height + 64 });
    await page.waitForTimeout(250);
    await assertCanvasIntegrity(page, `${viewport.label}: after resize`);

    await clickUniqueTestId(page, 'mode-button-verify');
    await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
    await clickUniqueTestId(page, 'mode-button-design');
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-node-id]', { timeout: 15000 });
    await assertCanvasIntegrity(page, `${viewport.label}: after Design -> Verify -> Design`);

    await page.goto(`${baseUrl}/?mode=design&e2e=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-node-id]', { timeout: 15000 });
    await assertCanvasIntegrity(page, `${viewport.label}: after direct Design reload`);
    await maybeScreenshot(page, `${viewport.label}-final.png`);
  }

  assert(
    consoleFindings.length === 0,
    `Design canvas emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function loadLogicGatesDesign(page, baseUrl) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  if (!(await page.locator('[data-testid="ide-mode-design"]').isVisible().catch(() => false))) {
    await clickUniqueTestId(page, 'mode-button-design');
  }
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-node-id]', { timeout: 15000 });
  await page.waitForTimeout(250);
}

async function clickUniqueTestId(page, testId) {
  const locator = page.locator(`[data-testid="${testId}"]`);
  const count = await locator.count();
  assert(count === 1, `expected one [data-testid="${testId}"], found ${count}`);
  await locator.click({ force: true });
  await page.waitForTimeout(180);
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
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selectMultipleNodes?.([nodeId]);
    }
    return nodeId;
  });
  assert(Boolean(selected), 'expected at least one visible node to select before Center');
  await page.waitForTimeout(120);
}

async function assertCanvasIntegrity(page, label) {
  let state = null;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    state = await readDesignCanvasIntegrity(page, label);
    if (isCanvasIntegritySatisfied(state)) break;
    await page.waitForTimeout(200);
  }

  state = state ?? (await readDesignCanvasIntegrity(page, label));

  assert(state.mode === 'design', `${label}: expected Design mode, got ${state.mode}`);
  assert(state.cameraFinite, `${label}: camera must stay finite, got ${JSON.stringify(state.camera)}`);
  assert(Boolean(state.canvasRect), `${label}: design canvas rect missing`);
  assert(Boolean(state.svgRect), `${label}: logic canvas SVG rect missing`);
  assert(state.canvasRect.width >= 240, `${label}: design canvas width too small (${state.canvasRect.width})`);
  assert(state.canvasRect.height >= 160, `${label}: design canvas height too small (${state.canvasRect.height})`);
  assert(state.svgRect.width >= 240, `${label}: SVG width too small (${state.svgRect.width})`);
  assert(state.svgRect.height >= 160, `${label}: SVG height too small (${state.svgRect.height})`);
  assert(state.nodeCount >= 3, `${label}: expected rendered starter nodes, got ${state.nodeCount}`);
  assert(state.wireCount >= 1, `${label}: expected rendered starter wires, got ${state.wireCount}`);
  assert(state.visibleNodeCount >= 3, `${label}: expected visible starter nodes, got ${state.visibleNodeCount}`);
  assert(state.visibleWireCount >= 1, `${label}: expected visible starter wires, got ${state.visibleWireCount}`);
  assert(
    state.badAttributes.length === 0,
    `${label}: SVG attributes must not contain NaN/Infinity: ${JSON.stringify(state.badAttributes)}`
  );
}

function isCanvasIntegritySatisfied(state) {
  return (
    state.cameraFinite &&
    state.canvasRect?.width >= 240 &&
    state.canvasRect?.height >= 160 &&
    state.svgRect?.width >= 240 &&
    state.svgRect?.height >= 160 &&
    state.nodeCount >= 3 &&
    state.wireCount >= 1 &&
    state.visibleNodeCount >= 3 &&
    state.visibleWireCount >= 1 &&
    state.badAttributes.length === 0
  );
}

async function readDesignCanvasIntegrity(page, label) {
  return page.evaluate((checkpointLabel) => {
    const finite = (value) => typeof value === 'number' && Number.isFinite(value);
    const rectJson = (rect) => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    const intersects = (a, b) =>
      a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const svg = document.querySelector('[data-testid="logic-canvas-svg"]');
    const canvasRect = canvas?.getBoundingClientRect?.() ?? null;
    const svgRect = svg?.getBoundingClientRect?.() ?? null;
    const nodes = Array.from(document.querySelectorAll('[data-node-id]'));
    const wires = Array.from(document.querySelectorAll('[data-wire-id], [data-connection-id]'));
    const wirePaths = Array.from(document.querySelectorAll('[data-wire-id] path, [data-connection-id] path'));
    const camera = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.camera ?? null;
    const cameraSnapshot = camera
      ? {
          x: finite(camera.x) ? camera.x : String(camera.x),
          y: finite(camera.y) ? camera.y : String(camera.y),
          zoom: finite(camera.zoom) ? camera.zoom : String(camera.zoom),
        }
      : null;
    const visibleNodeCount = canvasRect
      ? nodes.filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.width > 4 && rect.height > 4 && intersects(rect, canvasRect);
        }).length
      : 0;
    const visibleWireCount = canvasRect
      ? wirePaths.filter((wire) => {
          const rect = wire.getBoundingClientRect();
          return rect.width > 1 && rect.height > 1 && intersects(rect, canvasRect);
        }).length
      : 0;
    const badAttributes = Array.from(document.querySelectorAll('[x], [y], [width], [height], [transform], [d]'))
      .flatMap((el) => ['x', 'y', 'width', 'height', 'transform', 'd'].map((name) => [el, name, el.getAttribute(name)]))
      .filter(([, , value]) => typeof value === 'string' && /\b(?:NaN|Infinity|-Infinity)\b/.test(value))
      .slice(0, 12)
      .map(([el, name, value]) => ({
        tag: el.tagName,
        testId: el.getAttribute('data-testid'),
        name,
        value,
      }));

    return {
      label: checkpointLabel,
      href: location.href,
      build: document.querySelector('[data-testid="ide-build-badge"]')?.textContent?.trim() ?? null,
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      zoomText: document.querySelector('[data-testid="ide-design-canvas-stat-zoom"]')?.textContent?.trim() ?? null,
      camera: cameraSnapshot,
      cameraFinite: Boolean(camera && finite(camera.x) && finite(camera.y) && finite(camera.zoom)),
      canvasRect: canvasRect ? rectJson(canvasRect) : null,
      svgRect: svgRect ? rectJson(svgRect) : null,
      nodeCount: nodes.length,
      wireCount: wires.length,
      visibleNodeCount,
      visibleWireCount,
      badAttributes,
    };
  }, label);
}

async function maybeScreenshot(page, fileName) {
  if (!screenshotDir) return;
  await page.screenshot({ path: path.join(screenshotDir, fileName), fullPage: true });
}
