#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  assertVisibleRect,
  captureBrowserProblems,
  installCleanStudentContext,
  openLogicGatesStarter,
  openMode,
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';

// Import now keeps its page task bar in normal flow so recovery actions cannot sit under it.
const IMPORT_NORMAL_FLOW_TASK_BAR_ALLOWANCE = 38;

await runIdeGate('IDE action-first entry surfaces satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=action-first-entry-surfaces-${viewport.label}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
      await assertBuildHash(page, viewport.label);
      await assertVisibleRect(page, ['[data-testid="ide-project-start-hub"]'], `${viewport.label}/Project start surface`, {
        maxTop: viewport.height === 768 ? 180 : 200,
        minWidth: 480,
        minHeight: 140,
      });
      await assertVisibleRect(page, ['[data-testid="ide-project-start-a-lab-primary"]'], `${viewport.label}/Project Start a Lab`, {
        maxTop: viewport.height === 768 ? 340 : 380,
        minWidth: 120,
        minHeight: 36,
      });
      await assertVisibleRect(page, ['[data-testid="ide-project-import-primary"]'], `${viewport.label}/Project Import Project`, {
        maxTop: viewport.height === 768 ? 380 : 420,
        minWidth: 120,
        minHeight: 36,
      });
      const projectPrimaryCount = await page.locator('[data-testid="ide-project-primary-actions"] [data-product-priority="primary"]:visible').count();
      assert(projectPrimaryCount === 1, `${viewport.label}: Project must expose exactly one primary start action, saw ${projectPrimaryCount}`);

      await openLogicGatesStarter(page, baseUrl, `action-first-entry-surfaces-${viewport.label}-loaded`);

      await openMode(page, baseUrl, 'verify', `action-first-entry-surfaces-${viewport.label}`);
      await runComparePass(page);
      await openMode(page, baseUrl, 'export', `action-first-entry-surfaces-${viewport.label}`);
      await assertVisibleRect(page, ['[data-testid="ide-export-package-build-v1"]', '[data-testid="ide-export-rebuild-btn"]', '[data-testid="ide-export-primary-handoff-cta"] button'], `${viewport.label}/Export Build Bundle`, {
        maxTop: viewport.height === 768 ? 330 : 370,
        minWidth: 140,
        minHeight: 36,
      });
      const packageFiles = page.locator('[data-testid="ide-export-package-files"]').first();
      await packageFiles.waitFor({ state: 'visible', timeout: 10000 });
      if ((await packageFiles.getAttribute('open')) === null) {
        await packageFiles.locator('summary').click();
      }
      await page.locator('[data-testid="ide-export-file-browser-v1"]').first().waitFor({ state: 'visible', timeout: 10000 });
      await assertVisibleRect(page, ['[data-testid="ide-export-file-top-vhd"]', '[data-testid="ide-export-handoff-artifact-top-vhd"]'], `${viewport.label}/Export disclosed artifact preview`, {
        maxTop: viewport.height === 768 ? 720 : 850,
        minWidth: 120,
        minHeight: 42,
      });

      await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=action-first-entry-surfaces-${viewport.label}-import`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
      await assertVisibleRect(page, ['[data-testid="ide-import-start-primary"]'], `${viewport.label}/Import primary chooser`, {
        maxTop: (viewport.height === 768 ? 260 : 310) + IMPORT_NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: 240,
        minHeight: 40,
      });
      await assertVisibleRect(page, ['[data-testid="ide-import-start-secondary"]', '[data-testid="ide-import-load-sample-and-gate"]'], `${viewport.label}/Import alternate actions`, {
        maxTop: (viewport.height === 768 ? 350 : 400) + IMPORT_NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: 220,
        minHeight: 36,
      });

      await assertNoRootOverflow(page, `${viewport.label}/action-first`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Action-first entry browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Action-first entry failures:\n${failures.join('\n')}`);
});
