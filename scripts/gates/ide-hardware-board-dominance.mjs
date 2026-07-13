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

await runIdeGate('IDE Hardware table-first hierarchy satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `hardware-board-dominance-${viewport.label}`);
      await assertBuildHash(page, viewport.label);
      await openMode(page, baseUrl, 'hardware', `hardware-board-dominance-${viewport.label}`);
      await page.waitForSelector('[data-testid="ide-hw-board-workspace"]', { timeout: 15000 });

      const commandStrip = page.locator('[data-testid="ide-hardware-command-strip"]').first();
      if (await visible(commandStrip)) {
        const visibleCommandActions = await commandStrip.locator('button:visible, a[href]:visible, [role="button"]:visible').count();
        assert(
          visibleCommandActions === 0,
          `${viewport.label}: default Map Pins summary must not compete with the mapping table through ${visibleCommandActions} command action(s)`
        );
      }

      const workspace = await assertVisibleRect(page, ['[data-testid="ide-hw-board-workspace"]'], `${viewport.label}/Map Pins workspace`, {
        maxTop: viewport.height === 768 ? 205 : 215,
        minWidth: Math.round(viewport.width * 0.75),
        minHeight: Math.round(viewport.height * 0.45),
      });
      const table = await assertVisibleRect(page, ['[data-testid="ide-hw-map-table"]'], `${viewport.label}/mapping table`, {
        maxTop: viewport.height === 768 ? 320 : 330,
        minWidth: Math.round(viewport.width * 0.38),
        minHeight: Math.round(viewport.height * 0.30),
      });
      const board = await assertVisibleRect(page, ['[data-testid="ide-hw-map-board"]'], `${viewport.label}/Basys3 board reference`, {
        maxTop: viewport.height === 768 ? 320 : 330,
        minWidth: Math.round(viewport.width * 0.24),
        minHeight: Math.round(viewport.height * 0.24),
      });

      assert(table.left < board.left, `${viewport.label}: mapping table must precede the board reference ${JSON.stringify({ board, table })}`);
      assert(table.left + table.width <= board.left + 2, `${viewport.label}: mapping table and board reference must not overlap ${JSON.stringify({ board, table })}`);
      assert(
        table.visibleWidth >= board.visibleWidth,
        `${viewport.label}: mapping table must dominate the secondary board reference ${JSON.stringify({ board, table })}`
      );
      assert(workspace.visibleHeight >= board.visibleHeight, `${viewport.label}: board must fit inside visible workspace`);
      await assertNoRootOverflow(page, `${viewport.label}/hardware`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Hardware table-first hierarchy browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Hardware table-first hierarchy failures:\n${failures.join('\n')}`);
});
