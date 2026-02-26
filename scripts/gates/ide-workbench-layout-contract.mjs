#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export', 'import'];

await runIdeGate('IDE workbench layout contract satisfied', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  for (const mode of MODES) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
    await modeRoot.waitFor({ state: 'visible', timeout: 10000 });

    assert(await visible(modeRoot.locator('[data-testid="ide-left-dock"]')), `mode=${mode} missing left dock`);
    assert(await visible(modeRoot.locator('[data-testid="ide-mode-body"]')), `mode=${mode} missing workspace`);
    const inspectorVisible = await modeRoot.locator('[data-testid="ide-inspector"]').first().isVisible().catch(() => false);
    if (mode !== 'project') {
      assert(inspectorVisible, `mode=${mode} missing right dock`);
    }
    const consoleCount = await modeRoot.locator('[data-testid="ide-workbench-console"]').count();
    assert(consoleCount >= 1, `mode=${mode} missing workbench console`);
  }

  await page.locator('[data-testid="mode-button-verify"]').click();
  const verifyRoot = page.locator('[data-testid="ide-mode-verify"]').first();
  await verifyRoot.waitFor({ state: 'visible', timeout: 10000 });
  const leftDock = verifyRoot.locator('[data-testid="ide-left-dock"]').first();
  const workspace = verifyRoot.locator('[data-testid="ide-mode-body"]').first();
  const rightDock = verifyRoot.locator('[data-testid="ide-inspector"]').first();

  const [leftBox, workspaceBox, rightBox] = await Promise.all([
    leftDock.boundingBox(),
    workspace.boundingBox(),
    rightDock.boundingBox(),
  ]);

  assert(Boolean(leftBox && workspaceBox && rightBox), 'failed to read workbench geometry');
  assert(workspaceBox.width > leftBox.width, 'workspace should be wider than left dock');
  assert(workspaceBox.width > rightBox.width, 'workspace should be wider than right dock');

  const resizeHandle = page.locator('[data-testid="ide-workbench-resize-left"]').first();
  await resizeHandle.waitFor({ state: 'visible', timeout: 5000 });
  const handleBox = await resizeHandle.boundingBox();
  assert(Boolean(handleBox), 'left resize handle bounding box unavailable');

  const initialLeftWidth = leftBox.width;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 36, handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(120);

  const resizedLeftBox = await leftDock.boundingBox();
  assert(Boolean(resizedLeftBox), 'left dock geometry unavailable after resize');
  const widthDelta = Math.abs(resizedLeftBox.width - initialLeftWidth);
  assert(widthDelta >= 12, `left dock resize did not change width enough (delta=${widthDelta.toFixed(2)}px)`);
});
