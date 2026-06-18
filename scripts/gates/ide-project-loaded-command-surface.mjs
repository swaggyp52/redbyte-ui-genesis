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

await runIdeGate('IDE Project loaded command surface satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `project-loaded-command-surface-${viewport.label}`);
      await openMode(page, baseUrl, 'project', `project-loaded-command-surface-${viewport.label}`);
      await assertBuildHash(page, viewport.label);

      await assertVisibleRect(page, ['[data-testid="ide-project-command-board-v1"]'], `${viewport.label}/Project command board`, {
        maxTop: viewport.height === 768 ? 210 : 230,
        minWidth: Math.round(viewport.width * 0.72),
        minHeight: 230,
      });
      await assertVisibleRect(page, ['[data-testid="ide-project-command-mode-actions"]'], `${viewport.label}/Project mode actions`, {
        maxTop: viewport.height === 768 ? 410 : 450,
        minWidth: Math.round(viewport.width * 0.50),
        minHeight: 48,
      });
      await assertVisibleRect(page, ['[data-testid="ide-project-evidence-strip-v1"]'], `${viewport.label}/Project evidence strip`, {
        maxTop: viewport.height === 768 ? 520 : 570,
        minWidth: Math.round(viewport.width * 0.60),
        minHeight: 30,
      });

      const commandText = await normalizedText(page.locator('[data-testid="ide-project-command-board-v1"]').first());
      assert(/current action|next action|continue/i.test(commandText), `${viewport.label}: command board must name the current action`);
      assert(/Design/i.test(commandText), `${viewport.label}: command board must include Design action`);
      assert(/Verify/i.test(commandText), `${viewport.label}: command board must include Verify action`);
      assert(/Map Pins|Mapping/i.test(commandText), `${viewport.label}: command board must include Map Pins action`);
      assert(/Export/i.test(commandText), `${viewport.label}: command board must include Export action`);

      const requiredActions = [
        ['[data-testid="ide-project-command-action-design"]', 'design'],
        ['[data-testid="ide-project-command-action-verify"]', 'verify'],
        ['[data-testid="ide-project-command-action-map-pins"]', 'hardware'],
        ['[data-testid="ide-project-command-action-export"]', 'export'],
        ['[data-testid="ide-project-path-import-recover"]', 'import'],
      ];
      for (const [selector, targetMode] of requiredActions) {
        const action = page.locator(selector).first();
        assert(await visible(action), `${viewport.label}: ${selector} must be visible`);
        assert(!(await action.isDisabled().catch(() => false)), `${viewport.label}: ${selector} must be enabled`);
        await action.click();
        await page.waitForSelector(`[data-testid="ide-mode-${targetMode}"]`, { timeout: 10000 });
        await openMode(page, baseUrl, 'project', `project-loaded-command-surface-${viewport.label}-return`);
      }

      assert(
        await visible(page.locator('[data-testid="ide-project-command-board-v1"]').first()),
        `${viewport.label}: Project command board must survive command navigation`
      );

      await assertNoRootOverflow(page, `${viewport.label}/Project command surface`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Project command surface browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Project command surface failures:\n${failures.join('\n')}`);
});

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
