#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openLogicGatesStarter,
} from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { label: 'classroom-fixed-palette', width: 1366, height: 768, minCanvasWidth: 724, minCanvasHeight: 380 },
  { label: 'wide-fixed-palette', width: 1920, height: 1080, minCanvasWidth: 1150, minCanvasHeight: 620 },
];

await runIdeGate('IDE Design dual tool windows satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `design-dual-tool-windows-${viewport.label}`);
      await assertBuildHash(page, viewport.label);
      await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });

      const leftToggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
      const rightToggle = page.locator('[data-testid="ide-workbench-dock-toggle-right"]').first();
      assert(!(await visible(leftToggle)), `${viewport.label}: Design must not expose a generic Library restore rail`);
      assert(!(await visible(rightToggle)), `${viewport.label}: Design must not expose a generic Inspector restore rail`);

      const state = await page.evaluate(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return { visible: false, width: 0, height: 0 };
          const bounds = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return {
            visible: bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden',
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
          };
        };
        const shell = document.querySelector('.ide-workbench-shell[data-ide-mode-marker="design"]');
        return {
          primitive: shell?.getAttribute('data-workspace-primitive') ?? '',
          layoutMode: document.querySelector('[data-testid="ide-mode-design"]')?.getAttribute('data-layout-mode') ?? '',
          left: rect('[data-testid="ide-left-dock"]'),
          right: rect('[data-testid="ide-inspector"]'),
          canvas: rect('[data-testid="ide-design-live-canvas"]'),
        };
      });

      assert(state.primitive === 'fixed-tool-palette', `${viewport.label}: expected V2 fixed-tool-palette primitive ${JSON.stringify(state)}`);
      assert(state.left.visible, `${viewport.label}: fixed Parts palette must be visible ${JSON.stringify(state)}`);
      assert(state.left.width <= 330, `${viewport.label}: fixed Parts palette is too wide ${JSON.stringify(state)}`);
      if (state.right.visible) {
        assert(state.right.width <= 330, `${viewport.label}: context surface is too wide ${JSON.stringify(state)}`);
      }
      assert(
        state.canvas.width >= viewport.minCanvasWidth && state.canvas.height >= viewport.minCanvasHeight,
        `${viewport.label}: fixed-palette Design must preserve canvas ${JSON.stringify(state)}`
      );

      await assertNoRootOverflow(page, viewport.label);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Design dual tool-window browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Design dual tool-window failures:\n${failures.join('\n')}`);
});
