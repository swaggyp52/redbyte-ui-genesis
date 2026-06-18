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

      await assertVisibleRect(page, ['[data-testid="ide-import-guided-wizard-v1"]'], `${viewport.label}/Import wizard`, {
        maxTop: viewport.height === 768 ? 170 : 190,
        minWidth: Math.round(viewport.width * 0.70),
        minHeight: 360,
      });
      await assertVisibleRect(page, ['[data-testid="ide-import-source-step"]'], `${viewport.label}/Import source step`, {
        maxTop: viewport.height === 768 ? 430 : 460,
        minWidth: Math.round(viewport.width * 0.45),
        minHeight: 140,
      });
      await assertVisibleRect(page, ['[data-testid="ide-import-safety-boundary-v1"]'], `${viewport.label}/Import safety boundary`, {
        maxTop: viewport.height === 768 ? 730 : 760,
        minWidth: Math.round(viewport.width * 0.30),
        minHeight: 24,
      });

      const wizardText = await normalizedText(page.locator('[data-testid="ide-import-guided-wizard-v1"]').first());
      assert(/choose source/i.test(wizardText), `${viewport.label}: wizard must name Step 1 source selection`);
      assert(/inspect/i.test(wizardText), `${viewport.label}: wizard must name inspection`);
      assert(/review/i.test(wizardText), `${viewport.label}: wizard must name review`);
      assert(/nothing.*overwrite|no overwrite|confirm/i.test(wizardText), `${viewport.label}: wizard must expose no-overwrite boundary`);

      const sourceActions = [
        '[data-testid="ide-import-start-primary"]',
        '[data-testid="ide-import-start-secondary"]',
        '[data-testid="ide-import-load-sample-and-gate"]',
        '[data-testid="ide-import-toggle-behavioral-samples"]',
      ];
      for (const selector of sourceActions) {
        assert(await visible(page.locator(selector).first()), `${viewport.label}: ${selector} must be visible`);
      }

      await page.locator('[data-testid="ide-import-start-secondary"]').first().click();
      await page.waitForSelector('[data-testid="ide-import-workbench"]', { timeout: 10000 });
      await assertVisibleRect(page, ['[data-testid="ide-import-active-taskbar"]'], `${viewport.label}/Import active taskbar`, {
        maxTop: viewport.height === 768 ? 250 : 280,
        minWidth: Math.round(viewport.width * 0.50),
        minHeight: 56,
      });
      await assertVisibleRect(page, ['[data-testid="ide-import-hdl-textarea"]'], `${viewport.label}/Import HDL editor`, {
        maxTop: viewport.height === 768 ? 455 : 500,
        minWidth: Math.round(viewport.width * 0.40),
        minHeight: viewport.height === 768 ? 140 : 200,
      });

      await openFreshImport(page, baseUrl, `import-guided-recovery-wizard-${viewport.label}-keyboard`);
      const sample = page.locator('[data-testid="ide-import-load-sample-and-gate"]').first();
      await sample.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-testid="ide-import-workbench"]', { timeout: 10000 });
      const sampleText = await normalizedText(page.locator('[data-testid="ide-import-panel"]').first());
      assert(/and_gate|AND gate|Ready to review|Needs mapping/i.test(sampleText), `${viewport.label}: keyboard source activation must load a sample workflow`);

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
