#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { assertBuildHash } from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 1440, height: 900, label: '1440x900' },
];

const RESPONSIVE_CANVAS_TOOL_IDS = new Map([
  ['ide-design-zoom-out', 'ide-design-menu-zoom-out'],
  ['ide-design-zoom-in', 'ide-design-menu-zoom-in'],
  ['ide-design-fit-circuit-canvas', 'ide-design-menu-fit'],
  ['ide-design-zoom-reset', 'ide-design-zoom-reset'],
]);

const SCREENSHOT_ROOT = process.env.RB_WORKBENCH_STABILITY_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_WORKBENCH_STABILITY_SCREENSHOTS_DIR)
  : null;

await runIdeGate('IDE workbench stability overhaul satisfied', async ({ page, baseUrl }) => {
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
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=workbench-stability-overhaul-${viewport.label}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
    await capture(page, viewport, '01-project-first-launch');

    await loadStarterProject(page, { exactExampleId: 'logic-gates' });
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-design-workspace"]', { timeout: 15000 });
    await waitForCameraAccess(page);
    await capture(page, viewport, '02-design-loaded');
    await assertCleanWorkbench(page, viewport, 'Design after starter load');
    await assertDirectDesignControls(page, viewport);

    await clickCanvasTool(page, 'ide-design-zoom-reset');
    await page.waitForTimeout(200);
    const resetZoom = await readZoomIndicator(page);

    await clickCanvasTool(page, 'ide-design-zoom-out');
    const zoomedOut = await waitForZoomChange(page, resetZoom);
    await assertCleanWorkbench(page, viewport, 'Design after direct zoom out');

    await clickCanvasTool(page, 'ide-design-zoom-in');
    await waitForZoomChange(page, zoomedOut);
    await assertCleanWorkbench(page, viewport, 'Design after direct zoom in');

    await clickCanvasTool(page, 'ide-design-fit-circuit-canvas');
    await page.waitForTimeout(200);
    await assertCleanWorkbench(page, viewport, 'Design after direct fit');

    await page.locator('[data-testid="mode-button-verify"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
    await capture(page, viewport, '03-verify-loaded');
    await assertCleanWorkbench(page, viewport, 'Verify after Design navigation');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
    await assertCleanWorkbench(page, viewport, 'Verify after reload');

    await page.locator('[data-testid="mode-button-hardware"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 15000 });
    await capture(page, viewport, '04-hardware-loaded');
    await assertCleanWorkbench(page, viewport, 'Map Pins after Verify navigation');

    await page.locator('[data-testid="mode-button-design"]').first().click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-design-workspace"]', { timeout: 15000 });
    await capture(page, viewport, '05-design-returned');
    await assertCleanWorkbench(page, viewport, 'Design after Map Pins return');
  }

  assert(
    consoleFindings.length === 0,
    `Workbench stability overhaul emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function assertCleanWorkbench(page, viewport, label) {
  await assertBuildHash(page, `${viewport.label}/${label}`);
  const state = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="ide-root"]') ?? document.documentElement;
    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      urlMode: new URL(window.location.href).searchParams.get('mode'),
      hasBoundary: Boolean(document.querySelector('[data-testid="error-boundary-fallback"]')),
      loading: document.querySelector('[data-testid="ide-surface-loading"]')?.textContent?.trim() ?? '',
      rootOverflowX: Math.max(
        0,
        root instanceof HTMLElement ? root.scrollWidth - root.clientWidth : document.documentElement.scrollWidth - window.innerWidth
      ),
    };
  });

  assert(!state.hasBoundary, `${viewport.label} ${label}: error boundary was visible`);
  assert(state.mode === state.urlMode, `${viewport.label} ${label}: URL mode ${state.urlMode} did not match active mode ${state.mode}`);
  assert(state.loading.length === 0, `${viewport.label} ${label}: surface stayed in loading state (${state.loading})`);
  assert(state.rootOverflowX <= 2, `${viewport.label} ${label}: root has horizontal overflow (${state.rootOverflowX.toFixed(1)}px)`);
}

async function assertDirectDesignControls(page, viewport) {
  const toolbar = page.getByTestId('ide-design-toolbar');
  const box = await toolbar.boundingBox();
  assert(box, `${viewport.label}: Design toolbar must be measurable`);
  for (const id of ['ide-design-tool-select', 'ide-design-tool-wire', 'ide-design-fit-circuit-canvas', 'ide-design-center-selection-canvas', 'ide-design-zoom-out', 'ide-design-zoom-readout', 'ide-design-zoom-in']) {
    const control = page.getByTestId(id);
    const rect = await control.boundingBox();
    assert(rect && rect.x >= box.x && rect.y >= box.y && rect.x + rect.width <= box.x + box.width + 1 && rect.y + rect.height <= box.y + box.height + 1, `${viewport.label}: direct control ${id} must fit its toolbar`);
    if (await control.isEnabled()) await control.click({ trial: true });
  }
  const viewMenu = page.getByTestId('ide-design-toolbar-overflow');
  assert(await viewMenu.isVisible(), 'View menu must remain reachable');
  assert(await viewMenu.getAttribute('open') === null, 'View menu must close after camera operations');
  assert(!(await page.getByTestId('ide-design-zoom-presets').isVisible()), 'Retired zoom presets must remain absent');
}

async function waitForCameraAccess(page) {
  await page.waitForFunction(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
    };
    return visible(document.querySelector('[data-testid="ide-design-canvas-view-tools"]')) ||
      visible(document.querySelector('[data-testid="ide-design-toolbar-overflow"]'));
  }, undefined, { timeout: 15000 });
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
  assert(await overflow.isVisible().catch(() => false), `${primaryTestId}: View menu must be visible`);
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
