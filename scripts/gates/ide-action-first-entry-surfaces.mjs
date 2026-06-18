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

await runIdeGate('IDE action-first entry surfaces satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `action-first-entry-surfaces-${viewport.label}`);
      await assertBuildHash(page, viewport.label);

      await openMode(page, baseUrl, 'project', `action-first-entry-surfaces-${viewport.label}`);
      await assertVisibleRect(page, ['[data-testid="ide-project-command-action-verify"]', '[data-testid="ide-project-path-continue"]'], `${viewport.label}/Project current action`, {
        maxTop: viewport.height === 768 ? 520 : 570,
        minWidth: 180,
        minHeight: 48,
      });
      await assertVisibleRect(page, ['[data-testid="ide-project-path-build-fresh"]', '[data-testid="ide-project-build-fresh-primary"]'], `${viewport.label}/Project Build Fresh`, {
        maxTop: viewport.height === 768 ? 640 : 690,
        minWidth: 180,
        minHeight: 48,
      });
      await assertVisibleRect(page, ['[data-testid="ide-project-path-import-recover"]'], `${viewport.label}/Project Import Recover`, {
        maxTop: viewport.height === 768 ? 640 : 690,
        minWidth: 180,
        minHeight: 48,
      });

      await openMode(page, baseUrl, 'verify', `action-first-entry-surfaces-${viewport.label}`);
      await runComparePass(page);
      await openMode(page, baseUrl, 'export', `action-first-entry-surfaces-${viewport.label}`);
      await assertVisibleRect(page, ['[data-testid="ide-export-package-build-v1"]', '[data-testid="ide-export-rebuild-btn"]', '[data-testid="ide-export-primary-handoff-cta"] button'], `${viewport.label}/Export Build Bundle`, {
        maxTop: viewport.height === 768 ? 330 : 370,
        minWidth: 140,
        minHeight: 36,
      });
      await assertVisibleRect(page, ['[data-testid="ide-export-file-top-vhd"]', '[data-testid="ide-export-handoff-artifact-top-vhd"]'], `${viewport.label}/Export artifact preview`, {
        maxTop: viewport.height === 768 ? 430 : 470,
        minWidth: 120,
        minHeight: 42,
      });

      await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=action-first-entry-surfaces-${viewport.label}-import`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
      await assertVisibleRect(page, ['[data-testid="ide-import-start-primary"]'], `${viewport.label}/Import primary chooser`, {
        maxTop: viewport.height === 768 ? 260 : 310,
        minWidth: 240,
        minHeight: 40,
      });
      await assertVisibleRect(page, ['[data-testid="ide-import-start-secondary"]', '[data-testid="ide-import-load-sample-and-gate"]'], `${viewport.label}/Import alternate actions`, {
        maxTop: viewport.height === 768 ? 350 : 400,
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
