#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  RELEASE_READINESS_VIEWPORTS,
  assertReleaseReadinessClean,
  getDockClipping,
  getRequiredRect,
  openDesignLibrary,
  openHardwareMapPins,
  rectsOverlap,
  setupReleaseReadinessPage,
} from './_releaseReadinessVisualHarness.mjs';

await runIdeGate('IDE release-readiness visual contract satisfied', async ({ page, baseUrl }) => {
  const browserProblems = await setupReleaseReadinessPage(page);
  const failures = [];

  for (const viewport of RELEASE_READINESS_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await openDesignLibrary(page, baseUrl, `release-readiness-design-${viewport.label}`);
      const designLibrary = await getRequiredRect(page, '[data-testid="ide-left-dock"]', `${viewport.label}/Design Library`);
      const designCanvas = await getRequiredRect(page, '[data-testid="ide-design-live-canvas"]', `${viewport.label}/Design canvas`);
      const designClip = await getDockClipping(page, '[data-testid="ide-left-dock"]', [
        '[data-testid="ide-design-search"]',
        '[data-testid^="ide-design-board-input-"]',
        '[data-testid^="ide-design-board-output-"]',
      ]);
      assert(designLibrary.visibleWidth >= 260, `${viewport.label}: Design Library width below release target ${JSON.stringify(designLibrary)}`);
      assert(
        designCanvas.visibleWidth >= Math.round(viewport.width * 0.64),
        `${viewport.label}: Design canvas below release target ${JSON.stringify(designCanvas)}`
      );
      assert(designClip.clipped.filter((item) => item.outsideDock || item.offViewport).length === 0, `${viewport.label}: Design Library clipped controls ${JSON.stringify(designClip.clipped.slice(0, 8))}`);

      await openHardwareMapPins(page, baseUrl, `release-readiness-hardware-${viewport.label}`);
      const boardSvg = await getRequiredRect(page, '[data-testid="ide-hw-board-map"]', `${viewport.label}/Basys3 board visual`);
      const table = await getRequiredRect(page, '[data-testid="ide-hw-map-table"]', `${viewport.label}/Hardware mapping table`);
      const resourceSummary = await getRequiredRect(page, '[data-testid="ide-hw-board-resource-summary"]', `${viewport.label}/Hardware resource summary`);
      assert(table.visibleHeight >= Math.round(viewport.height * 0.44), `${viewport.label}: Hardware table below release height target ${JSON.stringify(table)}`);
      assert(boardSvg.visibleWidth >= Math.round(viewport.width * 0.30), `${viewport.label}: Basys3 board below release width target ${JSON.stringify(boardSvg)}`);
      assert(boardSvg.visibleHeight >= Math.round(viewport.height * 0.20), `${viewport.label}: Basys3 board below release height target ${JSON.stringify(boardSvg)}`);
      assert(!rectsOverlap(resourceSummary, boardSvg), `${viewport.label}: Hardware resource summary covers board ${JSON.stringify({ resourceSummary, boardSvg })}`);

      await assertReleaseReadinessClean(page, `${viewport.label}/release-readiness visual`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Release-readiness visual browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Release-readiness visual failures:\n${failures.join('\n')}`);
});
