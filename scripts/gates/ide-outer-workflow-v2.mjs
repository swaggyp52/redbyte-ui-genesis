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

const surfaceArg = process.argv.find((arg) => arg.startsWith('--surface='))?.split('=')[1] ?? 'all';
const allowedSurfaces = new Set(['all', 'project', 'export', 'import', 'continuity']);
assert(allowedSurfaces.has(surfaceArg), `Unknown --surface=${surfaceArg}`);

await runIdeGate(`IDE outer workflow V2 ${surfaceArg} satisfied`, async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  if (surfaceArg === 'all' || surfaceArg === 'project') {
    await assertProjectCommandCenterV2(page, baseUrl);
  }
  if (surfaceArg === 'all' || surfaceArg === 'export') {
    await assertExportArtifactWorkspaceV2(page, baseUrl);
  }
  if (surfaceArg === 'all' || surfaceArg === 'import') {
    await assertImportStepWorkflowV2(page, baseUrl);
  }
  if (surfaceArg === 'all' || surfaceArg === 'continuity') {
    await assertOuterWorkflowContinuityV2(page, baseUrl);
  }

  assert(browserProblems.length === 0, `Outer workflow V2 browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function assertProjectCommandCenterV2(page, baseUrl) {
  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `project-command-center-v2-${viewport.label}`);
      await openMode(page, baseUrl, 'project', `project-command-center-v2-${viewport.label}`);
      await assertBuildHash(page, viewport.label);

      await assertVisibleRect(page, ['[data-testid="ide-project-command-board-v1"]'], `${viewport.label}/Project V2 command board`, {
        maxTop: viewport.height === 768 ? 210 : 230,
        minWidth: Math.round(viewport.width * 0.72),
        minHeight: 300,
      });
      await assertVisibleRect(page, ['[data-v2-testid="ide-project-workflow-progress-v2"]'], `${viewport.label}/Project V2 workflow progress`, {
        maxTop: viewport.height === 768 ? 530 : 575,
        minWidth: Math.round(viewport.width * 0.60),
        minHeight: 68,
      });

      const boardText = await normalizedText(page.locator('[data-testid="ide-project-command-board-v1"]').first());
      for (const phrase of ['Current action', 'Design', 'Verify', 'Map Pins', 'Export', 'Build fresh', 'Import / Recover', 'Open Recent']) {
        assert(boardText.includes(phrase), `${viewport.label}: Project V2 command board missing "${phrase}"`);
      }
      const progressText = await normalizedText(page.locator('[data-v2-testid="ide-project-workflow-progress-v2"]').first());
      assert(/Ready|Changed|Not started/i.test(progressText), `${viewport.label}: Project progress must use plain design state`);
      assert(/Not run|Needs rerun|Failed|Passed|Observe only/i.test(progressText), `${viewport.label}: Project progress must use plain Verify state`);
      assert(/Missing|Partial|Complete/i.test(progressText), `${viewport.label}: Project progress must use plain Map Pins state`);
      assert(/Blocked|Ready to build|Draft available|Ready/i.test(progressText), `${viewport.label}: Project progress must use plain Export state`);
      assert(!/\bE0\b|\bE1\b|\bE2\b|\bE3\b|BUILD\s+[a-f0-9]{6,}/i.test(boardText), `${viewport.label}: Project normal UI must not expose proof tiers or raw build hashes`);
      await assertNoRootOverflow(page, `${viewport.label}/Project V2`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  assert(failures.length === 0, `Project V2 failures:\n${failures.join('\n')}`);
}

async function assertExportArtifactWorkspaceV2(page, baseUrl) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openLogicGatesStarter(page, baseUrl, 'export-artifact-workspace-v2');
  await openMode(page, baseUrl, 'verify', 'export-artifact-workspace-v2');
  await runComparePass(page);
  await openMode(page, baseUrl, 'export', 'export-artifact-workspace-v2');
  await assertBuildHash(page, 'export-v2');

  const workspace = page.locator('[data-v2-testid="ide-export-artifact-workspace-v2"]').first();
  await assertVisibleRect(page, ['[data-v2-testid="ide-export-artifact-workspace-v2"]'], 'Export V2 artifact workspace', {
    maxTop: 250,
    minWidth: 900,
    minHeight: 410,
  });
  const workspaceText = await normalizedText(workspace);
  for (const fileName of ['top.vhd', 'top.xdc', 'testbench.vhd', 'README', 'vivado_import.tcl']) {
    assert(workspaceText.toLowerCase().includes(fileName.toLowerCase()), `Export V2 workspace must list ${fileName}`);
  }
  assert(await visible(page.locator('[data-v2-testid="ide-export-artifact-tree-v2"]').first()), 'Export V2 artifact tree must be visible');
  assert(await visible(page.locator('[data-v2-testid="ide-export-artifact-preview-v2"]').first()), 'Export V2 selected preview must be visible');
  assert(await visible(page.locator('[data-testid="ide-export-package-build-v1"]').first()), 'Export V2 package build/download action must be visible');
  assert(await visible(page.locator('[data-testid="ide-export-package-copy-v1"]').first()), 'Export V2 copy selected file action must be visible');
  assert(await visible(page.locator('[data-testid="ide-export-package-download-file-v2"]').first()), 'Export V2 download selected file action must be visible');

  await page.locator('[data-testid="ide-export-file-top-xdc"]').first().click();
  await page.waitForFunction(
    () => (document.querySelector('[data-testid="ide-export-preview-path"]')?.textContent ?? '').trim() === 'top.xdc',
    { timeout: 10000 }
  );
  const previewText = await normalizedText(page.locator('[data-v2-testid="ide-export-artifact-preview-v2"]').first());
  assert(/PACKAGE_PIN|get_ports/i.test(previewText), 'Export V2 selected XDC preview must update immediately');

  const boundaryText = await normalizedText(page.locator('[data-testid="ide-export-evidence-boundary"]').first());
  assert(/Vivado handoff boundary/i.test(boundaryText), 'Export V2 must describe downstream Vivado handoff plainly');
  assert(!/\bE0\b|\bE1\b|\bE2\b|\bE3\b/.test(boundaryText), 'Export V2 normal boundary must not expose E-tier labels');
  assert(!/rb:bench:evidence:classify|bench classification/i.test(boundaryText), 'Export V2 normal UI must not expose bench-classifier internals');
  await assertNoRootOverflow(page, 'Export V2');
}

async function assertImportStepWorkflowV2(page, baseUrl) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=import-step-workflow-v2`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
  await assertBuildHash(page, 'import-v2');

  const firstLook = page.locator('[data-v2-testid="ide-import-step-workflow-v2"]').first();
  assert(await visible(firstLook), 'Import V2 first-look step workflow must be visible');
  const firstLookText = await normalizedText(firstLook);
  for (const phrase of ['Choose source', 'Inspect', 'Resolve', 'Review replacement', 'Apply']) {
    assert(firstLookText.includes(phrase), `Import V2 first-look workflow missing "${phrase}"`);
  }
  assert(/No overwrite before review|Nothing is overwritten yet/i.test(await normalizedText(page.locator('[data-testid="ide-import-panel"]').first())), 'Import V2 must expose no-overwrite boundary');

  await page.locator('[data-testid="ide-import-start-secondary"]').first().click();
  await page.waitForSelector('[data-testid="ide-import-workbench"]', { timeout: 10000 });
  await assertVisibleRect(page, ['[data-testid="ide-import-step-workflow-v2"]'], 'Import V2 active step workflow', {
    maxTop: 340,
    minWidth: 760,
    minHeight: 50,
  });
  const activeStepText = await normalizedText(page.locator('[data-testid="ide-import-step-workflow-v2"]').first());
  for (const phrase of ['Choose source', 'Inspect', 'Resolve', 'Review replacement', 'Apply']) {
    assert(activeStepText.includes(phrase), `Import V2 active workflow missing "${phrase}"`);
  }
  assert(await visible(page.locator('[data-v2-testid="ide-import-inspection-summary-v2"]').first()), 'Import V2 inspection summary must be visible');
  await assertNoRootOverflow(page, 'Import V2');
}

async function assertOuterWorkflowContinuityV2(page, baseUrl) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLogicGatesStarter(page, baseUrl, 'outer-workflow-continuity-v2');
  await openMode(page, baseUrl, 'project', 'outer-workflow-continuity-v2');
  const initialProject = await normalizedText(page.locator('[data-v2-testid="ide-project-workflow-progress-v2"]').first());
  assert(/Verify.*Not run|Not run.*Verify/i.test(initialProject), 'Project must show Verify not run before Compare');

  await openMode(page, baseUrl, 'verify', 'outer-workflow-continuity-v2');
  await runComparePass(page);
  await openMode(page, baseUrl, 'project', 'outer-workflow-continuity-v2-pass');
  const afterVerify = await normalizedText(page.locator('[data-v2-testid="ide-project-workflow-progress-v2"]').first());
  assert(/Verify.*Passed|Passed.*Verify/i.test(afterVerify), 'Project must show Verify passed after Compare PASS');

  await openMode(page, baseUrl, 'export', 'outer-workflow-continuity-v2-export');
  const exportText = await normalizedText(page.locator('[data-v2-testid="ide-export-artifact-workspace-v2"]').first());
  assert(/top\.vhd|top\.xdc|testbench\.vhd/i.test(exportText), 'Export artifact workspace must reflect current project files after Verify PASS');
  await assertNoRootOverflow(page, 'Outer workflow V2 continuity');
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
