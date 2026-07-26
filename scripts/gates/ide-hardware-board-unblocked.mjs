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

      assert(table.visibleWidth >= Math.round(viewport.width * 0.38), `${viewport.label}: primary mapping table is too narrow ${JSON.stringify(table)}`);
      assert(board.visibleWidth >= 320, `${viewport.label}: board reference is too narrow ${JSON.stringify(board)}`);
      assert(board.visibleWidth <= table.visibleWidth, `${viewport.label}: board reference must remain secondary to the mapping table ${JSON.stringify({ table, board })}`);
      assert(boardSvg.visibleHeight >= 120, `${viewport.label}: secondary board reference is too short to remain legible ${JSON.stringify(boardSvg)}`);
      assert(table.right <= board.left + 2, `${viewport.label}: signal table and board should be clearly separated ${JSON.stringify({ table, board })}`);
      assert(!rectsOverlap(resourceSummary, boardSvg), `${viewport.label}: resource summary overlaps the Basys3 board visual ${JSON.stringify({ resourceSummary, boardSvg })}`);

      const sw0Row = page.locator('[data-testid="ide-hw-map-row-sw0"]').first();
      await sw0Row.click();
      const boardReference = page.locator('[data-testid="ide-hw-board-reference-graphic"]').first();
      await boardReference.waitFor({ state: 'visible', timeout: 10000 });
      const boardReferenceState = await boardReference.evaluate((element) => ({
        role: element.getAttribute('role'),
        label: element.getAttribute('aria-label'),
        pointerEvents: getComputedStyle(element).pointerEvents,
      }));
      assert(
        boardReferenceState.role === 'img' && /reference/i.test(boardReferenceState.label ?? '') && boardReferenceState.pointerEvents === 'none',
        `${viewport.label}: miniature board must be an accessible, non-interactive reference ${JSON.stringify(boardReferenceState)}`
      );
      const resourceSelect = page.locator('[data-testid="ide-hw-direct-resource-select"]').first();
      const resourceSelectState = await resourceSelect.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      }));
      assert(
        resourceSelectState.height >= 35.5 && resourceSelectState.fontSize >= 13.9,
        `${viewport.label}: selected-signal resource control must own assignment at the 36px/14px floor ${JSON.stringify(resourceSelectState)}`
      );
      const sw0Binding = await page.locator('[data-testid="ide-hw-map-row-binding-sw0"]').first().textContent();
      assert(/SW0|V17/i.test(sw0Binding ?? ''), `${viewport.label}: selected-signal editor must preserve the SW0/V17 mapping`);

      await assertReleaseReadinessClean(page, `${viewport.label}/Hardware board`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Hardware board browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Hardware board failures:\n${failures.join('\n')}`);
});
