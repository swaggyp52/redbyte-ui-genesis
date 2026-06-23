#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  assertVisibleRect,
  captureBrowserProblems,
  installCleanStudentContext,
  openLogicGatesStarter,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

await runIdeGate('IDE Map Pins workspace V2 table and board linkage satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `map-pins-workspace-v2-${viewport.label}`);
      await assertBuildHash(page, viewport.label);
      await openMode(page, baseUrl, 'hardware', `map-pins-workspace-v2-${viewport.label}`);
      await page.waitForSelector('[data-testid="ide-hw-board-workspace"]', { timeout: 15000 });

      const workspace = await assertVisibleRect(
        page,
        ['[data-testid="ide-hw-board-workspace"]'],
        `${viewport.label}/Map Pins workspace`,
        {
          maxTop: 176,
          minWidth: Math.round(viewport.width * 0.80),
          minHeight: Math.round(viewport.height * 0.52),
        }
      );
      const table = await assertVisibleRect(
        page,
        ['[data-testid="ide-hw-map-table"]'],
        `${viewport.label}/mapping table`,
        {
          maxTop: 224,
          minWidth: Math.round(workspace.visibleWidth * 0.38),
          minHeight: Math.round(viewport.height * 0.42),
        }
      );
      const board = await assertVisibleRect(
        page,
        ['[data-testid="ide-hw-map-board"]'],
        `${viewport.label}/Basys3 board`,
        {
          maxTop: 224,
          minWidth: Math.round(workspace.visibleWidth * 0.42),
          minHeight: Math.round(viewport.height * 0.32),
        }
      );

      const splitRatio = table.visibleWidth / Math.max(1, table.visibleWidth + board.visibleWidth);
      assert(
        splitRatio >= 0.40 && splitRatio <= 0.50,
        `${viewport.label}: Map Pins table/board split should be 42-48-ish, got ${JSON.stringify({ splitRatio, table, board })}`
      );
      assert(board.left > table.left + table.visibleWidth, `${viewport.label}: Board should remain beside mapping table`);

      const row = page
        .locator('[data-testid^="ide-hw-map-row-"]')
        .filter({ hasText: /SW0/i })
        .first();
      assert(await visible(row), `${viewport.label}: SW0 mapping row must be visible`);
      await row.click();
      await page.waitForTimeout(180);

      assert(
        (await row.getAttribute('aria-pressed')) === 'true',
        `${viewport.label}: selecting the SW0 row should mark it selected`
      );
      const sw0Class = (await page.locator('[data-testid="ide-hw-map-sw-0"]').first().getAttribute('class').catch(() => '')) ?? '';
      assert(sw0Class.includes('map-hl'), `${viewport.label}: selecting SW0 row should highlight SW0 on board`);
      assert(
        await visible(page.locator('[data-testid^="ide-hw-map-row-detail-"]').first()),
        `${viewport.label}: selected row should expose inline XDC/detail context`
      );

      await page.locator('[data-testid="ide-hw-map-sw-2-hit"]').first().click({ force: true });
      await page.waitForTimeout(220);
      const updatedBinding = ((await row.locator('[data-testid^="ide-hw-map-row-binding-"]').first().textContent().catch(() => '')) ?? '')
        .trim()
        .replace(/\s+/g, ' ');
      assert(/SW2/i.test(updatedBinding), `${viewport.label}: board click should assign selected row to SW2, got "${updatedBinding}"`);

      await assertNoRootOverflow(page, `${viewport.label}/map pins workspace v2`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Map Pins workspace V2 browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Map Pins workspace V2 failures:\n${failures.join('\n')}`);
});
