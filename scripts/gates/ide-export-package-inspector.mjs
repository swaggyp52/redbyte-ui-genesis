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
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';

await runIdeGate('IDE Export package inspector satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `export-package-inspector-${viewport.label}`);
      await openMode(page, baseUrl, 'verify', `export-package-inspector-${viewport.label}`);
      await runComparePass(page);
      await openMode(page, baseUrl, 'export', `export-package-inspector-${viewport.label}`);
      await assertBuildHash(page, viewport.label);
      await openGeneratedFiles(page, viewport.label);

      await assertVisibleRect(page, ['[data-testid="ide-export-package-inspector-v1"]'], `${viewport.label}/Export inspector`, {
        maxTop: viewport.height === 768 ? 190 : 210,
        minWidth: Math.round(viewport.width * 0.68),
        minHeight: viewport.height === 768 ? 410 : 500,
      });
      await page.locator('[data-testid="ide-export-file-browser-v1"]').first().scrollIntoViewIfNeeded();
      await assertVisibleRect(page, ['[data-testid="ide-export-file-browser-v1"]'], `${viewport.label}/Export file browser`, {
        maxTop: viewport.height === 768 ? 325 : 350,
        minWidth: 220,
        minHeight: 180,
      });
      await page.locator('[data-testid="ide-export-selected-preview-v1"]').first().scrollIntoViewIfNeeded();
      await assertVisibleRect(page, ['[data-testid="ide-export-selected-preview-v1"]'], `${viewport.label}/Export selected preview`, {
        maxTop: viewport.height === 768 ? 325 : 350,
        minWidth: Math.round(viewport.width * 0.36),
        minHeight: viewport.height === 768 ? 240 : 330,
      });

      const previewPath = await normalizedText(page.locator('[data-testid="ide-export-preview-path"]').first());
      assert(previewPath.length > 0, `${viewport.label}: Export must select a default artifact before extra clicks`);
      assert(/README|top\.vhd|top\.xdc|testbench|vivado_import/i.test(previewPath), `${viewport.label}: default preview path must be a generated file, got "${previewPath}"`);

      const primaryActions = page.locator(
        '[data-testid="ide-export-package-build-v1"], [data-testid="ide-export-package-download-v1"]'
      );
      assert((await primaryActions.count()) === 1, `${viewport.label}: Export must expose exactly one build/download action`);
      assert(await visible(primaryActions.first()), `${viewport.label}: current build/download action must be visible`);
      assert(
        /Build|Download/i.test(await normalizedText(primaryActions.first())),
        `${viewport.label}: current Export action must remain build/download oriented`
      );
      const copyAction = page.locator('[data-testid="ide-export-selected-preview-v1"]').getByRole('button', { name: /copy/i }).first();
      assert(await visible(copyAction), `${viewport.label}: selected generated file must expose Copy`);

      const topXdc = page.locator('[data-testid="ide-export-file-top-xdc"]').first();
      assert(await visible(topXdc), `${viewport.label}: top.xdc file row must be visible`);
      await topXdc.click();
      await page.waitForFunction(
        () => (document.querySelector('[data-testid="ide-export-preview-path"]')?.textContent ?? '').trim() === 'top.xdc',
        null,
        { timeout: 10000 }
      );
      const codeText = await normalizedText(page.locator('[data-testid="ide-export-preview-code"]').first());
      assert(/PACKAGE_PIN|get_ports/i.test(codeText), `${viewport.label}: top.xdc preview must show constraints`);

      await assertNoRootOverflow(page, `${viewport.label}/Export inspector`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Export inspector browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Export inspector failures:\n${failures.join('\n')}`);
});

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

async function openGeneratedFiles(page, label) {
  const details = page.locator('[data-testid="ide-export-package-files"]').first();
  await details.waitFor({ state: 'visible', timeout: 10000 });
  assert((await details.getAttribute('open')) === null, `${label}: generated files must begin collapsed`);
  await details.locator('summary').click();
  assert((await details.getAttribute('open')) !== null, `${label}: Inspect generated files must expand`);
  await page.locator('[data-testid="ide-export-file-browser-v1"]').first().waitFor({ state: 'visible', timeout: 10000 });
}
