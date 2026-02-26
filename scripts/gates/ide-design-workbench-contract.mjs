#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE design workbench contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/?mode=design`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  const modeRoot = page.locator('[data-testid="ide-mode-design"]').first();
  const leftDockPalette = modeRoot.locator('[data-testid="ide-design-dock-palette"]').first();
  const inspector = modeRoot.locator('[data-testid="ide-inspector"]').first();
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

  const paletteCount = await modeRoot.locator('[data-testid^="ide-design-palette-"]').count();
  assert(paletteCount >= 8, `expected >=8 palette primitives, found ${paletteCount}`);

  const [rootBox, leftDockBox, inspectorBox, canvasBox] = await Promise.all([
    modeRoot.boundingBox(),
    leftDockPalette.boundingBox(),
    inspector.boundingBox(),
    canvas.boundingBox(),
  ]);

  assert(Boolean(rootBox && leftDockBox && inspectorBox && canvasBox), 'workbench geometry unavailable');
  assert(canvasBox.width > leftDockBox.width, 'canvas should be wider than left dock');
  assert(canvasBox.width > inspectorBox.width, 'canvas should be wider than right inspector');

  const widthRatio = canvasBox.width / rootBox.width;
  const heightRatio = canvasBox.height / rootBox.height;
  assert(widthRatio >= 0.42, `canvas width ratio too small (${widthRatio.toFixed(3)})`);
  assert(heightRatio >= 0.26, `canvas height ratio too small (${heightRatio.toFixed(3)})`);
});
