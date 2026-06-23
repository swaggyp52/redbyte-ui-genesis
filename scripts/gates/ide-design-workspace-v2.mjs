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

await runIdeGate('IDE Design workspace V2 geometry satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `design-workspace-v2-${viewport.label}`);
      await assertBuildHash(page, viewport.label);
      await openMode(page, baseUrl, 'design', `design-workspace-v2-${viewport.label}`);
      await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });

      const palette = await assertVisibleRect(
        page,
        ['[data-testid="ide-design-dock-palette"]'],
        `${viewport.label}/fixed parts palette`,
        {
          maxTop: 116,
          minWidth: 240,
          minHeight: Math.round(viewport.height * 0.55),
        }
      );
      assert(
        palette.visibleWidth <= 315,
        `${viewport.label}: Design palette should stay tool-sized, got ${JSON.stringify(palette)}`
      );

      const contextBar = await assertVisibleRect(
        page,
        ['[data-testid="ide-design-v2-context-bar"]'],
        `${viewport.label}/context property bar`,
        {
          maxTop: 220,
          minWidth: Math.round(viewport.width * 0.50),
          minHeight: 34,
        }
      );
      assert(
        contextBar.visibleHeight <= 76,
        `${viewport.label}: ContextPropertyBar should be compact, got ${JSON.stringify(contextBar)}`
      );

      const canvas = await assertVisibleRect(
        page,
        ['[data-testid="ide-design-live-canvas"]'],
        `${viewport.label}/primary circuit canvas`,
        {
          maxTop: 270,
          minWidth: Math.round(viewport.width * 0.62),
          minHeight: Math.round(viewport.height * 0.48),
        }
      );

      const inspectorVisible = await visible(page.locator('[data-testid="ide-inspector"]').first());
      assert(!inspectorVisible, `${viewport.label}: Design inspector must not be default-open without selection`);
      assert(
        canvas.left > palette.left + palette.visibleWidth,
        `${viewport.label}: Canvas should sit beside fixed palette, got ${JSON.stringify({ palette, canvas })}`
      );

      const contextState = await page.locator('[data-testid="ide-design-v2-context-bar"]').first().getAttribute('data-context-state');
      assert(contextState === 'canvas', `${viewport.label}: initial context should be canvas, got ${contextState}`);

      await page.locator('[data-testid="ide-design-live-canvas"]').first().click({ position: { x: 24, y: 24 } });
      await page.keyboard.press('Control+A');
      await page.waitForTimeout(180);
      const selectedState = await page.locator('[data-testid="ide-design-v2-context-bar"]').first().getAttribute('data-context-state');
      assert(
        selectedState === 'node' || selectedState === 'multi-node',
        `${viewport.label}: context bar should reflect selected design objects, got ${selectedState}`
      );
      assert(
        await visible(page.locator('[data-testid="ide-design-context-delete"]').first()),
        `${viewport.label}: selected context should expose delete action`
      );

      await assertNoRootOverflow(page, `${viewport.label}/design workspace v2`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Design workspace V2 browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Design workspace V2 failures:\n${failures.join('\n')}`);
});
