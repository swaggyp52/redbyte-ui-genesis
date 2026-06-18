#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  RELEASE_READINESS_VIEWPORTS,
  assertReleaseReadinessClean,
  getDockClipping,
  getRequiredRect,
  openDesignLibrary,
  openHardwareMapPins,
  setupReleaseReadinessPage,
} from './_releaseReadinessVisualHarness.mjs';

await runIdeGate('IDE no cropped controls regression', async ({ page, baseUrl }) => {
  const browserProblems = await setupReleaseReadinessPage(page);
  const failures = [];

  for (const viewport of RELEASE_READINESS_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      await openDesignLibrary(page, baseUrl, `no-cropped-controls-design-${viewport.label}`);
      const designClip = await getDockClipping(page, '[data-testid="ide-left-dock"]', [
        'input',
        'button',
        '[role="button"]',
      ]);
      const designSerious = designClip.clipped.filter((item) => item.outsideDock || item.offViewport);
      assert(designSerious.length === 0, `${viewport.label}: Design dock cropped controls ${JSON.stringify(designSerious.slice(0, 8))}`);

      await openHardwareMapPins(page, baseUrl, `no-cropped-controls-hardware-${viewport.label}`);
      await getRequiredRect(page, '[data-testid="ide-hw-map-table"]', `${viewport.label}/Hardware mapping table`);
      const hardwareClip = await getDockClipping(page, '[data-testid="ide-hw-board-workspace"]', [
        '[data-testid="ide-hw-map-table"] button',
        '[data-testid="ide-hw-board-resource-summary"] button',
      ]);
      const hardwareSerious = hardwareClip.clipped.filter((item) => item.outsideDock || item.offViewport);
      assert(hardwareSerious.length === 0, `${viewport.label}: Hardware workspace cropped controls ${JSON.stringify(hardwareSerious.slice(0, 8))}`);

      await assertReleaseReadinessClean(page, `${viewport.label}/no cropped controls`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `No-cropped-controls browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `No-cropped-controls failures:\n${failures.join('\n')}`);
});
