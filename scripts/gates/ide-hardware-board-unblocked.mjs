#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  RELEASE_READINESS_VIEWPORTS,
  assertReleaseReadinessClean,
  getRequiredRect,
  openHardwareMapPins,
  rectsOverlap,
  setupReleaseReadinessPage,
} from './_releaseReadinessVisualHarness.mjs';

await runIdeGate('IDE Hardware board is unblocked', async ({ page, baseUrl }) => {
  const browserProblems = await setupReleaseReadinessPage(page);
  const failures = [];

  for (const viewport of RELEASE_READINESS_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHardwareMapPins(page, baseUrl, `hardware-board-unblocked-${viewport.label}`);

      const board = await getRequiredRect(page, '[data-testid="ide-hw-map-board"]', `${viewport.label}/Basys3 board`);
      const boardSvg = await getRequiredRect(page, '[data-testid="ide-hw-board-map"]', `${viewport.label}/Basys3 board visual`);
      const table = await getRequiredRect(page, '[data-testid="ide-hw-map-table"]', `${viewport.label}/mapping table`);
      const resourceSummary = await getRequiredRect(page, '[data-testid="ide-hw-board-resource-summary"]', `${viewport.label}/resource summary`);

      assert(board.visibleWidth >= Math.round(viewport.width * 0.46), `${viewport.label}: board column is too narrow ${JSON.stringify(board)}`);
      assert(boardSvg.visibleHeight >= Math.round(viewport.height * 0.28), `${viewport.label}: board visual is too short ${JSON.stringify(boardSvg)}`);
      assert(table.right <= board.left - 8, `${viewport.label}: signal table and board should be clearly separated ${JSON.stringify({ table, board })}`);
      assert(!rectsOverlap(resourceSummary, boardSvg), `${viewport.label}: resource summary overlaps the Basys3 board visual ${JSON.stringify({ resourceSummary, boardSvg })}`);

      await assertReleaseReadinessClean(page, `${viewport.label}/Hardware board`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Hardware board browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Hardware board failures:\n${failures.join('\n')}`);
});
