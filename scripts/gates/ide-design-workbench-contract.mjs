#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE design workbench contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  const modeRoot = page.locator('[data-testid="ide-mode-design"]').first();
  const leftDockPalette = modeRoot.locator('[data-testid="ide-design-dock-palette"]').first();
  const inspector = modeRoot.locator('[data-testid="ide-inspector"]').first();
  const workspace = modeRoot.locator('[data-testid="ide-mode-body"]').first();
  const paneRow = modeRoot.locator('[data-testid="ide-design-pane-row"]').first();
  const consolePanel = modeRoot.locator('[data-testid="ide-design-console-diagnostics"]').first();
  const diagnosticsList = modeRoot.locator('[data-testid="ide-design-console-list"]').first();
  const canvas = modeRoot.locator('[data-testid="ide-design-live-canvas"]').first();

  assert(await visible(leftDockPalette), 'design left dock palette marker missing');
  assert(await visible(inspector), 'design right inspector marker missing');
  const consoleCount = await modeRoot.locator('[data-testid="ide-workbench-console"]').count();
  assert(consoleCount >= 1, 'design console container missing');
  const consoleState = await modeRoot.locator('[data-testid="ide-workbench-console"]').first().getAttribute('data-console-state');
  assert(
    consoleState === 'collapsed' || consoleState === 'expanded' || consoleState === 'blocking',
    `unexpected console state "${consoleState ?? ''}"`
  );
  const diagnosticsCount = await modeRoot.locator('[data-testid="ide-design-console-list"]').count();
  assert(diagnosticsCount >= 1, 'design diagnostics list container missing');
  assert(await visible(canvas), 'design canvas marker missing');

  const canvasReady = await page
    .waitForFunction(() => {
      const root = document.querySelector('[data-testid="ide-mode-design"]');
      const pane = root?.querySelector('[data-testid="ide-design-pane-row"]');
      const liveCanvas = root?.querySelector('[data-testid="ide-design-live-canvas"]');
      if (!pane || !liveCanvas) return false;
      const paneRect = pane.getBoundingClientRect();
      const canvasRect = liveCanvas.getBoundingClientRect();
      return paneRect.height > 0 && paneRect.width > 0 && canvasRect.height > 0 && canvasRect.width > 0;
    }, { timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  assert(canvasReady, 'design canvas did not reach minimum initialized size');

  const paletteCount = await modeRoot.locator('[data-testid^="ide-design-palette-"]').count();
  assert(paletteCount >= 8, `expected >=8 palette primitives, found ${paletteCount}`);

  const [workspaceBox, paneRowBox, leftDockBox, inspectorBox, canvasBox] = await Promise.all([
    workspace.boundingBox(),
    paneRow.boundingBox(),
    leftDockPalette.boundingBox(),
    inspector.boundingBox(),
    canvas.boundingBox(),
  ]);
  const layoutMode = await modeRoot.getAttribute('data-layout-mode');

  assert(Boolean(workspaceBox && paneRowBox && leftDockBox && inspectorBox && canvasBox), 'workbench geometry unavailable');
  assert(Boolean(layoutMode), 'design root missing data-layout-mode');
  assert(
    layoutMode === 'wide' || layoutMode === 'standard' || layoutMode === 'compact',
    `unexpected design layout mode: ${layoutMode}`
  );
  assert(canvasBox.width > leftDockBox.width, 'canvas should be wider than left dock');
  if (layoutMode === 'compact') {
    const canvasBottom = canvasBox.y + canvasBox.height;
    assert(
      // 2px tolerance accounts for browser sub-pixel layout rounding.
      inspectorBox.y >= canvasBottom - 2,
      `compact layout should stack right inspector below canvas (inspectorY=${inspectorBox.y}, canvasBottom=${canvasBottom})`
    );
  } else {
    assert(canvasBox.width > inspectorBox.width, 'canvas should be wider than right inspector');
  }

  const widthRatio = canvasBox.width / paneRowBox.width;
  const heightRatio = canvasBox.height / paneRowBox.height;
  const minHeightRatio = layoutMode === 'compact' ? 0.12 : 0.26;
  assert(widthRatio >= 0.42, `canvas width ratio too small (${widthRatio.toFixed(3)})`);
  assert(
    heightRatio >= minHeightRatio,
    `canvas height ratio too small (${heightRatio.toFixed(3)}; layout=${layoutMode}; min=${minHeightRatio.toFixed(2)})`
  );
});
