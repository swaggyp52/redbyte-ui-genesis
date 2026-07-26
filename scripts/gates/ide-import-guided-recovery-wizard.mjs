#!/usr/bin/env node

import { assert, runIdeGate, visible } from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  assertVisibleRect,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';

await runIdeGate('IDE Import guided recovery wizard satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openFreshImport(page, baseUrl, `import-guided-recovery-wizard-${viewport.label}`);
      await assertBuildHash(page, viewport.label);

      await assertVisibleRect(page, ['[data-testid="ide-import-workbench"]'], `${viewport.label}/Import workbench`, {
        maxTop: viewport.height === 768 ? 170 : 190,
        minWidth: 840,
        minHeight: 360,
      });
      await assertVisibleRect(page, ['[data-testid="ide-import-zip-dropzone"]'], `${viewport.label}/Import ZIP intake`, {
        maxTop: viewport.height === 768 ? 430 : 460,
        minWidth: Math.round(viewport.width * 0.45),
        minHeight: 120,
      });

      const wizardText = await normalizedText(page.locator('[data-testid="ide-import-workbench"]').first());
      assert(/upload/i.test(wizardText), `${viewport.label}: wizard must name Upload as the first recovery step`);
      assert(/review/i.test(wizardText), `${viewport.label}: wizard must name Review`);
      assert(/apply/i.test(wizardText), `${viewport.label}: wizard must name Apply as the explicit replacement step`);
      assert(/without replacing|review.*apply|explicitly apply/i.test(wizardText), `${viewport.label}: Import must expose the review-before-replacement boundary`);

      const sourceActions = [
        '[data-testid="ide-import-zip-browse"]',
        '[data-testid="ide-import-start-secondary"]',
        '[data-testid="ide-import-load-sample-and-gate"]',
        '[data-testid="ide-import-load-sample-edge-detect"]',
      ];
      for (const selector of sourceActions) {
        assert(await visible(page.locator(selector).first()), `${viewport.label}: ${selector} must be visible`);
      }

      await page.locator('[data-testid="ide-import-start-secondary"]').first().click();
      await page.waitForSelector('[data-testid="ide-import-hdl-textarea"]', { timeout: 10000 });
      assert(await visible(page.locator('[data-testid="ide-import-horizontal-stepper"]').first()), `${viewport.label}: Upload/Review/Apply stepper must remain visible while editing HDL`);
      await assertVisibleRect(page, ['[data-testid="ide-import-hdl-textarea"]'], `${viewport.label}/Import HDL editor`, {
        maxTop: viewport.height === 768 ? 490 : 540,
        minWidth: Math.round(viewport.width * 0.40),
        minHeight: viewport.height === 768 ? 140 : 200,
      });

      await openFreshImport(page, baseUrl, `import-guided-recovery-wizard-${viewport.label}-keyboard`);
      const sample = page.locator('[data-testid="ide-import-load-sample-and-gate"]').first();
      await sample.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-testid="ide-import-hdl-textarea"]', { timeout: 10000 });
      const sampleHdl = await page.locator('[data-testid="ide-import-hdl-textarea"]').first().inputValue();
      assert(/and_gate|entity|architecture/i.test(sampleHdl), `${viewport.label}: keyboard source activation must load structural sample HDL`);

      await assertNoRootOverflow(page, `${viewport.label}/Import wizard`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Import wizard browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Import wizard failures:\n${failures.join('\n')}`);
});

async function openFreshImport(page, baseUrl, gateLabel) {
  await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=${gateLabel}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
