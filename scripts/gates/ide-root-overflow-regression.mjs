#!/usr/bin/env node

import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openLogicGatesStarter,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const MODES = ['project', 'design', 'verify', 'hardware', 'export', 'import'];

await runIdeGate('IDE root overflow regression guard satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `root-overflow-regression-${viewport.label}`);
      await assertBuildHash(page, viewport.label);

      for (const mode of MODES) {
        if (mode === 'import') {
          await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=root-overflow-regression-${viewport.label}-import`, {
            waitUntil: 'domcontentloaded',
          });
          await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
        } else {
          await openMode(page, baseUrl, mode, `root-overflow-regression-${viewport.label}`);
        }
        await assertNoRootOverflow(page, `${viewport.label}/${mode}`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
        await assertNoRootOverflow(page, `${viewport.label}/${mode}/reload`);
      }
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Root overflow browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Root overflow regression failures:\n${failures.join('\n')}`);
});
