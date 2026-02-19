#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

const MODES = ['project', 'design', 'verify', 'export', 'import'];
const EXPECTED_GRID_COLUMNS = 12;
const EXPECTED_PANEL_PADDING_PX = 16;
const INSPECTOR_MIN_WIDTH_PX = 320;
const INSPECTOR_MAX_WIDTH_PX = 420;

await runIdeGate('IDE visual contract satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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
    const hasHeader = await visible(modeRoot.locator('[data-testid="ide-surface-header"]'));
    const hasTitle = await visible(modeRoot.locator('[data-testid="ide-surface-title"]'));
    const hasActions = await visible(modeRoot.locator('[data-testid="ide-surface-actions"]'));
    assert(hasGrid, `mode=${mode} missing ide-surface-grid`);
    assert(hasHeader, `mode=${mode} missing ide-surface-header`);
    assert(hasTitle, `mode=${mode} missing ide-surface-title`);
    assert(hasActions, `mode=${mode} missing ide-surface-actions`);

    const gridMetrics = await modeRoot.locator('[data-testid="ide-surface-grid"]').first().evaluate((element) => {
      const styles = getComputedStyle(element);
      const columns = styles.gridTemplateColumns.split(' ').filter(Boolean).length;
      const columnGap = Number.parseFloat(styles.columnGap || styles.gap || '0');
      return { columns, columnGap };
    });
    assert(
      gridMetrics.columns === EXPECTED_GRID_COLUMNS,
      `mode=${mode} expected ${EXPECTED_GRID_COLUMNS} grid columns, found ${gridMetrics.columns}`
    );
    assert(gridMetrics.columnGap >= 16, `mode=${mode} expected grid gap >= 16, found ${gridMetrics.columnGap}`);

    const panelPadding = await modeRoot.locator('.ide-panel').first().evaluate((element) => {
      const styles = getComputedStyle(element);
      return Number.parseFloat(styles.paddingLeft);
    });
    assert(
      Math.abs(panelPadding - EXPECTED_PANEL_PADDING_PX) <= 1,
      `mode=${mode} expected panel padding ${EXPECTED_PANEL_PADDING_PX}px, found ${panelPadding}px`
    );

    const inspectorWidth = await modeRoot.locator('[data-testid="ide-inspector"]').first().evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.width;
    });
    assert(
      inspectorWidth >= INSPECTOR_MIN_WIDTH_PX - 2 && inspectorWidth <= INSPECTOR_MAX_WIDTH_PX + 2,
      `mode=${mode} expected inspector width ${INSPECTOR_MIN_WIDTH_PX}-${INSPECTOR_MAX_WIDTH_PX}px, found ${inspectorWidth}px`
    );

    if (mode === 'design') {
      const compilerStrip = modeRoot.locator('[data-testid="ide-design-compiler-strip"]').first();
      const irHash = modeRoot.locator('[data-testid="ide-design-ir-hash"]').first();
      const dirtySinceVerify = modeRoot.locator('[data-testid="ide-design-dirty-since-verify"]').first();
      const dirtySinceExport = modeRoot.locator('[data-testid="ide-design-dirty-since-export"]').first();
      const errorCount = modeRoot.locator('[data-testid="ide-design-diagnostics-errors"]').first();
      const warningCount = modeRoot.locator('[data-testid="ide-design-diagnostics-warnings"]').first();

      assert(await visible(compilerStrip), 'mode=design missing compiler strip marker');
      assert(await visible(irHash), 'mode=design missing IR hash marker');
      assert(await visible(dirtySinceVerify), 'mode=design missing dirtySinceVerify marker');
      assert(await visible(dirtySinceExport), 'mode=design missing dirtySinceExport marker');
      assert(await visible(errorCount), 'mode=design missing diagnostics error marker');
      assert(await visible(warningCount), 'mode=design missing diagnostics warning marker');

      const hashText = ((await irHash.textContent()) ?? '').trim().toLowerCase();
      assert(/^[0-9a-f]{8}$/.test(hashText), `mode=design invalid IR hash text "${hashText}"`);

      const dirtyVerifyText = ((await dirtySinceVerify.textContent()) ?? '').trim().toLowerCase();
      const dirtyExportText = ((await dirtySinceExport.textContent()) ?? '').trim().toLowerCase();
      assert(
        dirtyVerifyText === 'yes' || dirtyVerifyText === 'no',
        `mode=design invalid dirtySinceVerify text "${dirtyVerifyText}"`
      );
      assert(
        dirtyExportText === 'yes' || dirtyExportText === 'no',
        `mode=design invalid dirtySinceExport text "${dirtyExportText}"`
      );
    }
  }

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
  assert(mobileColumns === 1, `mobile expected 1-column grid, found ${mobileColumns}`);
});
