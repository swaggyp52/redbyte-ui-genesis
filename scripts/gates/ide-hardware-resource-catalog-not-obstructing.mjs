#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  RELEASE_READINESS_VIEWPORTS,
  assertReleaseReadinessClean,
  getRect,
  getRequiredRect,
  openHardwareMapPins,
  rectsOverlap,
  setupReleaseReadinessPage,
} from './_releaseReadinessVisualHarness.mjs';

await runIdeGate('IDE Hardware resource catalog does not obstruct work', async ({ page, baseUrl }) => {
  const browserProblems = await setupReleaseReadinessPage(page);
  const failures = [];

  for (const viewport of RELEASE_READINESS_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHardwareMapPins(page, baseUrl, `hardware-resource-catalog-${viewport.label}`);

      const boardSvg = await getRequiredRect(page, '[data-testid="ide-hw-board-map"]', `${viewport.label}/Basys3 board visual`);
      const resourceSummary = await getRequiredRect(page, '[data-testid="ide-hw-board-resource-summary"]', `${viewport.label}/resource summary`);
      const catalog = await getRect(page, '[data-testid="ide-hw-resource-catalog"]');

      assert(resourceSummary.bottom <= boardSvg.top - 4 || resourceSummary.top >= boardSvg.bottom + 4, `${viewport.label}: summary strip sits on top of board controls ${JSON.stringify({ resourceSummary, boardSvg })}`);
      if (catalog?.visible) {
        assert(!rectsOverlap(catalog, boardSvg), `${viewport.label}: resource catalog overlaps the board visual ${JSON.stringify({ catalog, boardSvg })}`);
      }

      await assertReleaseReadinessClean(page, `${viewport.label}/Hardware resource catalog`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Hardware resource catalog browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Hardware resource catalog failures:\n${failures.join('\n')}`);
});
