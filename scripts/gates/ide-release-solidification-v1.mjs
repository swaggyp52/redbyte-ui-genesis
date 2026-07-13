#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openLogicGatesStarter,
  openMode,
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE release solidification v1 satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await assertVerifySignalsDoNotStealWorkbench(page, baseUrl, viewport);
      await assertExportHandoffChecklist(page, baseUrl, viewport);
      await assertImportSourceReview(page, baseUrl, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Release solidification browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Release solidification failures:\n${failures.join('\n')}`);
});

async function assertVerifySignalsDoNotStealWorkbench(page, baseUrl, viewport) {
  await openLogicGatesStarter(page, baseUrl, `release-solidification-verify-${viewport.label}`);
  await openMode(page, baseUrl, 'verify', `release-solidification-verify-${viewport.label}`);
  await runComparePass(page);
  await openSignalsDock(page, viewport.label);
  await assertBuildHash(page, `${viewport.label}/Verify`);

  const metrics = await page.evaluate(() => {
    function box(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visibleWidth: Math.round(Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left))),
        visibleHeight: Math.round(Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top))),
        extraX: Math.max(0, element.scrollWidth - element.clientWidth),
        extraY: Math.max(0, element.scrollHeight - element.clientHeight),
      };
    }

    const labGrid = document.querySelector('[data-testid="ide-verify-lab-grid"]');
    return {
      workspaceMode: labGrid?.getAttribute('data-workspace-mode') ?? '',
      phase: labGrid?.getAttribute('data-verify-workflow-phase') ?? '',
      workspace: box('[data-testid="ide-verify-workspace"]'),
      labFrame: box('[data-testid="ide-verify-lab-frame"]'),
      labGrid: box('[data-testid="ide-verify-lab-grid"]'),
      stimulus: box('[data-testid="ide-verify-region-stimulus"]'),
      waveform: box('[data-testid="ide-verify-region-waveform"]'),
      signals: box('[data-testid="ide-left-dock"]'),
      rootOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      bottomClippedActions: Array.from(document.querySelectorAll('[data-testid="ide-verify-lab-grid"] button'))
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 1 && rect.height > 1 && rect.bottom > window.innerHeight + 1;
        })
        .map((button) => button.textContent?.replace(/\s+/g, ' ').trim() || button.getAttribute('aria-label') || 'button')
        .slice(0, 5),
    };
  });

  assert(metrics.phase === 'post-run', `${viewport.label}: Verify should be in post-run phase for this proof`);
  assert(metrics.signals?.visibleWidth >= 220, `${viewport.label}: Signals dock should be open and readable ${JSON.stringify(metrics.signals)}`);
  assert(metrics.workspace?.extraX <= 1, `${viewport.label}: Verify workspace has internal horizontal overflow ${JSON.stringify(metrics.workspace)}`);
  assert(metrics.labFrame?.extraX <= 1, `${viewport.label}: Verify lab frame has internal horizontal overflow ${JSON.stringify(metrics.labFrame)}`);
  assert(metrics.labGrid?.extraX <= 1, `${viewport.label}: Verify lab grid has internal horizontal overflow ${JSON.stringify(metrics.labGrid)}`);
  assert(
    metrics.stimulus?.visibleWidth >= Math.round(viewport.width * 0.335),
    `${viewport.label}: testbench lane too narrow with Signals open ${JSON.stringify(metrics.stimulus)}`
  );
  assert(
    metrics.waveform?.visibleWidth >= Math.round(viewport.width * 0.335),
    `${viewport.label}: waveform lane too narrow with Signals open ${JSON.stringify(metrics.waveform)}`
  );
  assert(metrics.bottomClippedActions.length === 0, `${viewport.label}: Verify actions clipped below viewport ${metrics.bottomClippedActions.join(', ')}`);
  assert(metrics.rootOverflowX <= 1, `${viewport.label}: Verify created root overflow ${metrics.rootOverflowX}px`);

  await assertNoRootOverflow(page, `${viewport.label}/Verify signals`);
}

async function assertExportHandoffChecklist(page, baseUrl, viewport) {
  await openLogicGatesStarter(page, baseUrl, `release-solidification-export-${viewport.label}`);
  await openMode(page, baseUrl, 'verify', `release-solidification-export-${viewport.label}`);
  await runComparePass(page);
  await openMode(page, baseUrl, 'export', `release-solidification-export-${viewport.label}`);
  await assertBuildHash(page, `${viewport.label}/Export`);

  const readinessDetails = page.locator('.ide-export-package-readiness-details').first();
  if (!(await readinessDetails.getAttribute('open'))) {
    await readinessDetails.locator('summary').first().click();
  }
  const checklist = page.locator('[data-testid="ide-export-handoff-checklist-v1"]').first();
  assert(await visible(checklist), `${viewport.label}: Export must expose a package handoff checklist`);
  const checklistText = normalized(await checklist.textContent());
  assert(/package/i.test(checklistText), `${viewport.label}: Export checklist must name package readiness`);
  assert(/verify|compare/i.test(checklistText), `${viewport.label}: Export checklist must include Verify state`);
  assert(/pins|mapping/i.test(checklistText), `${viewport.label}: Export checklist must include pin mapping state`);
  assert(/E0/i.test(checklistText), `${viewport.label}: Export checklist must state E0 package boundary`);
  assert(/external|Vivado|Basys3/i.test(checklistText), `${viewport.label}: Export checklist must separate external proof`);

  const contextualActions = page.locator(
    '[data-testid="ide-export-package-build-v1"], [data-testid="ide-export-package-download-v1"], [data-testid^="ide-export-blocked-open-"]'
  );
  const visibleContextualActions = await contextualActions.evaluateAll((elements) =>
    elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    }).length
  );
  assert(
    visibleContextualActions === 1,
    `${viewport.label}: Export must expose exactly one state-appropriate repair/build/download action, got ${visibleContextualActions}`
  );

  const surfaceText = normalized(await page.locator('[data-testid="ide-mode-export"]').first().textContent());
  assert(
    !/E1\s+(ready|passed|complete)|E2\s+(ready|passed|complete)|E3\s+(ready|passed|complete)|board observed/i.test(surfaceText),
    `${viewport.label}: Export must not claim external hardware proof`
  );
  await assertNoRootOverflow(page, `${viewport.label}/Export checklist`);
}

async function assertImportSourceReview(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=release-solidification-import-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Import`);

  const pasteHdl = page.locator('[data-testid="ide-import-start-secondary"]').first();
  assert(await visible(pasteHdl), `${viewport.label}: Paste HDL source action must be visible`);
  await pasteHdl.click();
  await page.waitForSelector('[data-testid="ide-import-workbench"]', { timeout: 10000 });

  const metrics = await page.evaluate(() => {
    function box(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visibleWidth: Math.round(Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left))),
        visibleHeight: Math.round(Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top))),
      };
    }
    return {
      workbench: box('[data-testid="ide-import-workbench"]'),
      review: box('[data-testid="ide-import-source-review-v1"]'),
      editor: box('[data-testid="ide-import-hdl-textarea"]'),
      text: document.querySelector('[data-testid="ide-import-source-review-v1"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      rootOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  });

  assert(
    metrics.workbench?.visibleWidth >= Math.round(viewport.width * 0.68),
    `${viewport.label}: Import active workbench should use available width ${JSON.stringify(metrics.workbench)}`
  );
  assert(metrics.review?.visibleWidth >= 240, `${viewport.label}: Import must expose a source review lane ${JSON.stringify(metrics.review)}`);
  assert(metrics.editor?.visibleWidth >= 520, `${viewport.label}: Import editor must remain usable ${JSON.stringify(metrics.editor)}`);
  assert(/source/i.test(metrics.text), `${viewport.label}: Import review lane must name the selected source`);
  assert(/inspect|parse/i.test(metrics.text), `${viewport.label}: Import review lane must expose inspect/parse next step`);
  assert(/review|replace|apply/i.test(metrics.text), `${viewport.label}: Import review lane must expose safe replacement boundary`);
  assert(metrics.rootOverflowX <= 1, `${viewport.label}: Import created root overflow ${metrics.rootOverflowX}px`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  const reviewAfterReload = page.locator('[data-testid="ide-import-source-review-v1"]').first();
  assert(await visible(reviewAfterReload), `${viewport.label}: Import source review should survive reload continuity`);
  await assertNoRootOverflow(page, `${viewport.label}/Import source review`);
}

async function openSignalsDock(page, label) {
  if (await page.locator('[data-testid="ide-left-dock"]').first().isVisible().catch(() => false)) return;
  const toggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
  assert(await visible(toggle), `${label}: collapsed Signals toggle must be visible`);
  await toggle.click();
  await page.waitForSelector('[data-testid="ide-left-dock"]', { timeout: 5000 });
}

function normalized(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}
