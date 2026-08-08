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
  ['ide-design-zoom-out', 'ide-design-overflow-zoom-out'],
  ['ide-design-zoom-in', 'ide-design-overflow-zoom-in'],
  ['ide-design-fit-circuit-canvas', 'ide-design-overflow-fit'],
  ['ide-design-zoom-reset', 'ide-design-overflow-reset'],
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
  const usesResponsiveTools = viewport.width <= 1400;
  const state = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 1 && rect.height > 1;
    };
    const byTestId = (testId) => document.querySelector(`[data-testid="${testId}"]`);
    const host = byTestId('ide-design-canvas-view-tools');
    const overflow = byTestId('ide-design-toolbar-overflow');
    const toolbar = byTestId('ide-design-toolbar');
    return {
      toggleVisible: isVisible(byTestId('ide-design-view-tools-toggle')),
      presetsVisible: isVisible(byTestId('ide-design-zoom-presets')),
      hostVisible: isVisible(host),
      hostOpen: host?.getAttribute('data-open') === 'true',
      hostInsideToolbar: Boolean(host && toolbar?.contains(host)),
      controlsVisible: isVisible(byTestId('ide-design-canvas-controls')),
      overflowVisible: isVisible(overflow),
      overflowOpen: overflow?.hasAttribute('open') ?? false,
      overflowInsideToolbar: Boolean(overflow && toolbar?.contains(overflow)),
      directControls: Object.fromEntries(
        [
          'ide-design-zoom-out',
          'ide-design-zoom-in',
          'ide-design-fit-circuit-canvas',
          'ide-design-zoom-reset',
          'ide-design-center-selection-canvas',
        ].map((testId) => [testId, isVisible(byTestId(testId))])
      ),
      responsiveControls: Object.fromEntries(
        [
          'ide-design-overflow-zoom-out',
          'ide-design-overflow-zoom-in',
          'ide-design-overflow-fit',
          'ide-design-overflow-reset',
        ].map((testId) => [testId, Boolean(byTestId(testId))])
      ),
    };
  });

  assert(!state.toggleVisible, `${viewport.label}: canvas controls must not be hidden behind a view-tools toggle`);
  assert(!state.presetsVisible, `${viewport.label}: obsolete zoom preset strip must remain absent`);
  assert(state.hostInsideToolbar, `${viewport.label}: direct canvas view tools must remain inside the Design toolbar`);
  if (usesResponsiveTools) {
    assert(!state.hostVisible, `${viewport.label}: desktop camera host must yield at classroom width`);
    assert(!state.controlsVisible, `${viewport.label}: hidden desktop controls must not occupy classroom toolbar space`);
    assert(state.overflowVisible, `${viewport.label}: More tools must expose responsive camera controls`);
    assert(!state.overflowOpen, `${viewport.label}: responsive camera menu must close after each action`);
    assert(state.overflowInsideToolbar, `${viewport.label}: More tools must remain inside the Design toolbar`);
    for (const [testId, visible] of Object.entries(state.directControls)) {
      assert(!visible, `${viewport.label}: desktop canvas control ${testId} must not compete with More tools`);
    }
    for (const [testId, present] of Object.entries(state.responsiveControls)) {
      assert(present, `${viewport.label}: responsive canvas control ${testId} must remain available`);
    }
  } else {
    assert(state.hostVisible, `${viewport.label}: direct canvas view-tools host must remain visible`);
    assert(state.hostOpen, `${viewport.label}: direct canvas view-tools host must remain open`);
    assert(state.controlsVisible, `${viewport.label}: direct canvas controls must remain visible`);
    assert(!state.overflowVisible, `${viewport.label}: desktop toolbar must not duplicate camera controls in More tools`);
    for (const [testId, visible] of Object.entries(state.directControls)) {
      assert(visible, `${viewport.label}: direct canvas control ${testId} must remain visible`);
    }
  }
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
