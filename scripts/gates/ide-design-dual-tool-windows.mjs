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
  { label: 'classroom-exclusive', width: 1366, height: 768, expected: 'exclusive' },
  { label: 'wide-dual', width: 1920, height: 1080, expected: 'dual' },
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

      const library = page.locator('[data-testid="ide-design-dock-palette"]').first();
      assert(await visible(library), `${viewport.label}: Library must be open by default`);
      const hideLibrary = page.locator('[data-testid="ide-design-library-collapse"]').first();
      assert(await visible(hideLibrary), `${viewport.label}: open Library must expose Hide`);
      await hideLibrary.click();
      const leftToggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
      const rightToggle = page.locator('[data-testid="ide-workbench-dock-toggle-right"]').first();
      await leftToggle.waitFor({ state: 'visible', timeout: 5000 });
      assert(await visible(leftToggle), `${viewport.label}: Library restore rail missing`);
      assert(await visible(rightToggle), `${viewport.label}: Inspector restore rail missing`);

      await leftToggle.click();
      await page.waitForSelector('[data-testid="ide-left-dock"]', { timeout: 5000 });
      await rightToggle.click();
      await page.waitForTimeout(180);

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
        return {
          layoutMode: document.querySelector('[data-testid="ide-mode-design"]')?.getAttribute('data-layout-mode') ?? '',
          left: rect('[data-testid="ide-left-dock"]'),
          right: rect('[data-testid="ide-inspector"]'),
          canvas: rect('[data-testid="ide-design-live-canvas"]'),
        };
      });

      if (viewport.expected === 'dual') {
        assert(state.layoutMode === 'wide', `${viewport.label}: expected wide layout, got ${state.layoutMode}`);
        assert(state.left.visible && state.right.visible, `${viewport.label}: wide Design should allow Library and Inspector together ${JSON.stringify(state)}`);
        assert(state.canvas.width >= 1080 && state.canvas.height >= 620, `${viewport.label}: dual tools must still leave a large canvas ${JSON.stringify(state)}`);
      } else {
        const visibleDockCount = Number(state.left.visible) + Number(state.right.visible);
        assert(visibleDockCount <= 1, `${viewport.label}: classroom Design should keep support docks exclusive ${JSON.stringify(state)}`);
        assert(state.canvas.width >= 850 && state.canvas.height >= 380, `${viewport.label}: exclusive tools must preserve canvas ${JSON.stringify(state)}`);
      }

      await assertNoRootOverflow(page, viewport.label);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Design dual tool-window browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Design dual tool-window failures:\n${failures.join('\n')}`);
});
