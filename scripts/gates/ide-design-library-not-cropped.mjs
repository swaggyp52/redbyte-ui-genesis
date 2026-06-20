#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  RELEASE_READINESS_VIEWPORTS,
  assertReleaseReadinessClean,
  getDockClipping,
  getRequiredRect,
  openDesignLibrary,
  setupReleaseReadinessPage,
} from './_releaseReadinessVisualHarness.mjs';

await runIdeGate('IDE Design library is not cropped', async ({ page, baseUrl }) => {
  const browserProblems = await setupReleaseReadinessPage(page);
  const failures = [];

  for (const viewport of RELEASE_READINESS_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openDesignLibrary(page, baseUrl, `design-library-not-cropped-${viewport.label}`);

      const leftDock = await getRequiredRect(page, '[data-testid="ide-left-dock"]', `${viewport.label}/Design library`);
      const canvas = await getRequiredRect(page, '[data-testid="ide-design-live-canvas"]', `${viewport.label}/Design canvas`);
      const primitive = await page
        .locator('.ide-workbench-shell[data-ide-mode-marker="design"]')
        .first()
        .getAttribute('data-workspace-primitive')
        .catch(() => '');
      assert(primitive === 'fixed-tool-palette', `${viewport.label}: Design must use the V2 fixed-tool-palette primitive`);
      assert(leftDock.visibleWidth >= 260, `${viewport.label}: Design library is too narrow (${leftDock.visibleWidth}px < 260px)`);
      const minCanvasWidth = Math.floor(viewport.width * 0.53);
      assert(
        canvas.visibleWidth >= minCanvasWidth,
        `${viewport.label}: Design canvas lost too much width (${canvas.visibleWidth}px < ${minCanvasWidth}px)`
      );

      const clipping = await getDockClipping(page, '[data-testid="ide-left-dock"]', [
        '[data-testid="ide-design-search"]',
        '[data-testid="ide-design-palette-section-board"]',
        '[data-testid="ide-design-board-io-palette"]',
        '[data-testid^="ide-design-board-input-"]',
        '[data-testid^="ide-design-board-output-"]',
        '[data-testid="ide-design-palette-toggle-board"]',
      ]);
      const seriousClipping = clipping.clipped.filter((item) => item.outsideDock || item.offViewport);
      assert(
        seriousClipping.length === 0,
        `${viewport.label}: Design library has controls outside its tool window ${JSON.stringify(seriousClipping.slice(0, 8))}`
      );

      await assertReleaseReadinessClean(page, `${viewport.label}/Design library`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Design library browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Design library failures:\n${failures.join('\n')}`);
});
