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

await runIdeGate('IDE Hardware board dominance satisfied', async ({ page, baseUrl }) => {
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

      assert(
        !(await visible(page.locator('[data-testid="ide-hardware-command-strip"]').first())),
        `${viewport.label}: default Map Pins should not show a non-action summary card before the board`
      );

      const workspace = await assertVisibleRect(page, ['[data-testid="ide-hw-board-workspace"]'], `${viewport.label}/board workspace`, {
        maxTop: viewport.height === 768 ? 176 : 184,
        minWidth: Math.round(viewport.width * 0.80),
        minHeight: Math.round(viewport.height * 0.50),
      });
      const board = await assertVisibleRect(page, ['[data-testid="ide-hw-map-board"]'], `${viewport.label}/Basys3 board`, {
        maxTop: viewport.height === 768 ? 224 : 232,
        minWidth: Math.round(viewport.width * 0.52),
        minHeight: Math.round(viewport.height * 0.30),
      });
      const table = await assertVisibleRect(page, ['[data-testid="ide-hw-map-table"]'], `${viewport.label}/mapping table`, {
        maxTop: viewport.height === 768 ? 224 : 232,
        minWidth: 320,
        minHeight: Math.round(viewport.height * 0.36),
      });

      assert(board.left > table.left + 280, `${viewport.label}: board should sit beside the signal table, got ${JSON.stringify({ board, table })}`);
      assert(workspace.visibleHeight >= board.visibleHeight, `${viewport.label}: board must fit inside visible workspace`);
      await assertNoRootOverflow(page, `${viewport.label}/hardware`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Hardware board dominance browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Hardware board dominance failures:\n${failures.join('\n')}`);
});
