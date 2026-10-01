#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export', 'import'];
// Fresh Project/Board/Export/Import are document workspaces. Design's library
// and Simulate's testbench explorer own the two default support docks.
const MODE_LEFT_DOCK_EXPECTATIONS = {
  project: false, design: true, verify: true, hardware: false, export: false, import: false,
};
const PANEL_PADDING_MIN_PX = 12;
const PANEL_PADDING_MAX_PX = 32;
const INSPECTOR_MIN_WIDTH_PX = 200;
const INSPECTOR_MAX_WIDTH_PX = 460;
const MODE_CONSOLE_EXPECTATIONS = {
  project: 'hidden',
  design: 'visible',
  verify: 'visible',
  hardware: 'visible',
  export: 'visible',
  import: 'hidden',
};

await runIdeGate('IDE visual contract satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  for (const mode of MODES) {
    await page.locator(`[data-testid="mode-button-${mode}"]`).click();
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 10000 });
    const modeRoot = page.locator(`[data-testid="ide-mode-${mode}"]`).first();

    const marker = await modeRoot.getAttribute('data-ide-mode-marker');
    assert(marker === mode, `mode marker mismatch for ${mode}: ${marker}`);

    const hasGrid = await visible(modeRoot.locator('[data-testid="ide-surface-grid"]'));
    const hasLeftDock = await visible(modeRoot.locator('[data-testid="ide-left-dock"]'));
    const consoleCount = await modeRoot.locator('[data-testid="ide-workbench-console"]').count();
    assert(hasGrid, `mode=${mode} missing ide-surface-grid`);
    assert(hasLeftDock === MODE_LEFT_DOCK_EXPECTATIONS[mode], `mode=${mode} incorrect default left dock visibility`);
    assert(await modeRoot.getAttribute('data-left-dock-state') === (hasLeftDock ? 'visible' : 'hidden'),
      `mode=${mode} published left dock state must match its visibility`);
    if (MODE_CONSOLE_EXPECTATIONS[mode] === 'hidden') {
      assert(consoleCount === 0, `mode=${mode} console should be hidden by default`);
    } else {
      assert(consoleCount >= 1, `mode=${mode} missing ide-workbench-console`);
      const consolePanel = modeRoot.locator('[data-testid="ide-workbench-console"]').first();
      assert(await visible(consolePanel), `mode=${mode} console strip must be reachable`);
      const consoleState = await consolePanel.getAttribute('data-console-state');
      assert(consoleState === await modeRoot.getAttribute('data-console-state'), `mode=${mode} console state must agree with shell`);
      assert(consoleState === 'collapsed', `mode=${mode} clean fresh console must start collapsed, found ${consoleState}`);
      const consoleBounds = await consolePanel.boundingBox();
      assert(consoleBounds.height >= 24 && consoleBounds.height <= 40, `mode=${mode} collapsed console must remain a usable compact strip`);
    }

    const gridMetrics = await modeRoot.locator('[data-testid="ide-surface-grid"]').first().evaluate((element) => {
      const styles = getComputedStyle(element);
      const columns = styles.gridTemplateColumns.split(' ').filter(Boolean).length;
      const columnGap = Number.parseFloat(styles.columnGap || styles.gap || '0');
      const bounds = element.getBoundingClientRect();
      const workspace = element.querySelector('[data-testid="ide-mode-body"]').getBoundingClientRect();
      const visibleDocks = [...element.querySelectorAll('[data-testid="ide-left-dock"], [data-testid="ide-right-dock"]')]
        .filter(dock => dock.getBoundingClientRect().width > 0).length;
      return { columns, columnGap, visibleDocks, width: bounds.width, workspaceWidth: workspace.width,
        workspaceWithinGrid: workspace.left >= bounds.left - 1 && workspace.right <= bounds.right + 1 };
    });
    assert(
      gridMetrics.columns === 1 + gridMetrics.visibleDocks,
      `mode=${mode} expected one workspace column plus ${gridMetrics.visibleDocks} visible dock columns, found ${gridMetrics.columns}`
    );
    assert(gridMetrics.columnGap >= 0, `mode=${mode} expected non-negative grid gap, found ${gridMetrics.columnGap}`);
    assert(gridMetrics.workspaceWithinGrid, `mode=${mode} workspace must stay within its grid`);
    assert(gridMetrics.workspaceWidth >= gridMetrics.width * 0.5, `mode=${mode} primary workspace must retain at least half of the grid width`);

    const panelBody = modeRoot.locator('.ide-panel-body').first();
    const panelBodyVisible = await panelBody.isVisible().catch(() => false);
    if (panelBodyVisible) {
      const panelPadding = await panelBody.evaluate((element) => {
        const styles = getComputedStyle(element);
        return Number.parseFloat(styles.paddingLeft);
      });
      if (panelPadding > 0) {
        assert(
          panelPadding >= PANEL_PADDING_MIN_PX && panelPadding <= PANEL_PADDING_MAX_PX,
          `mode=${mode} expected panel padding ${PANEL_PADDING_MIN_PX}-${PANEL_PADDING_MAX_PX}px, found ${panelPadding}px`
        );
      }
    }

    const inspectorVisible = await modeRoot.locator('[data-testid="ide-right-dock"]').first().isVisible().catch(() => false);
    if (inspectorVisible) {
      const inspectorWidth = await modeRoot.locator('[data-testid="ide-right-dock"]').first().evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width;
      });
      assert(
        inspectorWidth >= INSPECTOR_MIN_WIDTH_PX - 2 && inspectorWidth <= INSPECTOR_MAX_WIDTH_PX + 2,
        `mode=${mode} expected inspector width ${INSPECTOR_MIN_WIDTH_PX}-${INSPECTOR_MAX_WIDTH_PX}px, found ${inspectorWidth}px`
      );
    }

    if (mode === 'design') {
      const compilerStrip = modeRoot.locator('[data-testid="ide-design-compiler-strip"]').first();
      const irHash = modeRoot.locator('[data-testid="ide-design-ir-hash"]').first();
      const dirtySinceVerify = modeRoot.locator('[data-testid="ide-design-dirty-since-verify"]').first();
      const dirtySinceExport = modeRoot.locator('[data-testid="ide-design-dirty-since-export"]').first();
      const errorCount = modeRoot.locator('[data-testid="ide-design-diagnostics-errors"]').first();
      const warningCount = modeRoot.locator('[data-testid="ide-design-diagnostics-warnings"]').first();

      const compilerVisible = await compilerStrip.isVisible().catch(() => false);
      if (compilerVisible) {
        assert(await visible(irHash), 'mode=design missing IR hash marker');
        assert(await visible(dirtySinceVerify), 'mode=design missing dirtySinceVerify marker');
        assert(await visible(dirtySinceExport), 'mode=design missing dirtySinceExport marker');
        assert(await visible(errorCount), 'mode=design missing diagnostics error marker');
        assert(await visible(warningCount), 'mode=design missing diagnostics warning marker');

        const hashText = ((await irHash.textContent()) ?? '').trim().toLowerCase();
        assert(/^[0-9a-f]{8}$/.test(hashText), `mode=design invalid IR hash text "${hashText}"`);
      }
    }
  }

  // The inspector belongs to a selection. Use a real starter and click its AND
  // gate so the geometry contract is exercised instead of skipped on emptiness.
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  const design = page.locator('[data-testid="ide-mode-design"]');
  await design.waitFor({ state: 'visible' });
  await design.locator('[data-testid^="node-AND-"]').first().click();
  const revealInspector = design.locator('[data-testid="ide-show-right-dock"]');
  if (await visible(revealInspector)) await revealInspector.click();
  const inspector = design.locator('[data-testid="ide-right-dock"]');
  await inspector.waitFor({ state: 'visible' });
  assert(await visible(design.locator('[data-testid="ide-design-selection-inspector"]')), 'selected gate inspector must be visible');
  const inspectorBounds = await inspector.boundingBox();
  assert(inspectorBounds.width >= INSPECTOR_MIN_WIDTH_PX - 2 && inspectorBounds.width <= INSPECTOR_MAX_WIDTH_PX + 2,
    `selected inspector width must remain ${INSPECTOR_MIN_WIDTH_PX}-${INSPECTOR_MAX_WIDTH_PX}px, found ${inspectorBounds.width}px`);
  const selectedWorkspace = await design.locator('[data-testid="ide-mode-body"]').boundingBox();
  const selectedGrid = await design.locator('[data-testid="ide-surface-grid"]').boundingBox();
  assert(selectedWorkspace.width >= selectedGrid.width * 0.5, 'selected inspector must leave at least half the grid to the primary workspace');
  await design.locator('[data-testid="ide-hide-right-dock"]').click();
  assert(await visible(revealInspector), 'selected inspector must recover after hiding');
  await revealInspector.click();
  await inspector.waitFor({ state: 'visible' });
  await design.locator('[data-testid="ide-hide-right-dock"]').click();

  await page.setViewportSize({ width: 760, height: 900 });
  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  const mobileColumns = await page
    .locator('[data-testid="ide-mode-project"] [data-testid="ide-surface-grid"]')
    .first()
    .evaluate((element) => {
      const styles = getComputedStyle(element);
      return styles.gridTemplateColumns.split(' ').filter(Boolean).length;
    });
  assert(mobileColumns >= 1, `mobile grid must remain renderable, found ${mobileColumns} columns`);
  const mobileWorkspace = await page.locator('[data-testid="ide-mode-project"] [data-testid="ide-mode-body"]').boundingBox();
  assert(mobileWorkspace.width >= 600 && mobileWorkspace.x + mobileWorkspace.width <= 761,
    'narrow Project must keep a visible workspace within the viewport');
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
  assert(overflow <= 1, `narrow Project must not overflow horizontally (${overflow}px)`);
});
