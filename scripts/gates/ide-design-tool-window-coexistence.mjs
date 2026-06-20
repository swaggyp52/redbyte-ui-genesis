#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  RELEASE_READINESS_VIEWPORTS,
  assertReleaseReadinessClean,
  getRequiredRect,
  openDesignInspector,
  openDesignLibrary,
  setupReleaseReadinessPage,
} from './_releaseReadinessVisualHarness.mjs';

await runIdeGate('IDE Design tool-window coexistence is proportional', async ({ page, baseUrl }) => {
  const browserProblems = await setupReleaseReadinessPage(page);
  const failures = [];

  for (const viewport of RELEASE_READINESS_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openDesignLibrary(page, baseUrl, `design-tool-window-library-${viewport.label}`);
      const library = await getRequiredRect(page, '[data-testid="ide-left-dock"]', `${viewport.label}/Design Library`);
      const libraryCanvas = await getRequiredRect(page, '[data-testid="ide-design-live-canvas"]', `${viewport.label}/Design canvas with Library`);
      const primitive = await page
        .locator('.ide-workbench-shell[data-ide-mode-marker="design"]')
        .first()
        .getAttribute('data-workspace-primitive')
        .catch(() => '');
      const minFixedPaletteCanvasWidth = Math.floor(viewport.width * 0.53);
      assert(primitive === 'fixed-tool-palette', `${viewport.label}: Design must use the V2 fixed-tool-palette primitive`);
      assert(library.visibleWidth >= 260 && library.visibleWidth <= 340, `${viewport.label}: Library width is not tool-like ${JSON.stringify(library)}`);
      assert(
        libraryCanvas.visibleWidth >= minFixedPaletteCanvasWidth,
        `${viewport.label}: Library should leave a usable V2 canvas ${JSON.stringify(libraryCanvas)}`
      );

      await openDesignInspector(page, baseUrl, `design-tool-window-inspector-${viewport.label}`);
      const inspector = await getRequiredRect(page, '[data-testid="ide-inspector"]', `${viewport.label}/Design Inspector`);
      const inspectorCanvas = await getRequiredRect(page, '[data-testid="ide-design-live-canvas"]', `${viewport.label}/Design canvas with Inspector`);
      assert(inspector.visibleWidth >= 260 && inspector.visibleWidth <= 330, `${viewport.label}: Inspector width is not proportional ${JSON.stringify(inspector)}`);
      assert(
        inspectorCanvas.visibleWidth >= minFixedPaletteCanvasWidth,
        `${viewport.label}: Inspector should leave a usable V2 canvas ${JSON.stringify(inspectorCanvas)}`
      );
      await assertReleaseReadinessClean(page, `${viewport.label}/Design tool windows`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Design tool-window browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Design tool-window failures:\n${failures.join('\n')}`);
});
