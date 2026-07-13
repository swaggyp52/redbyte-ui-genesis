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

await runIdeGate('IDE outer workflow action density satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `outer-workflow-action-density-${viewport.label}`);
      await openMode(page, baseUrl, 'project', `outer-workflow-action-density-${viewport.label}`);
      await assertBuildHash(page, viewport.label);
      await assertNoProductSpine(page, `${viewport.label}/Project`);
      const projectDirect = await assertActionCluster(page, viewport, 'project command board', '[data-testid="ide-project-command-board-v1"]', 3, {
        maxTop: 300,
      });
      assert(/Continue Design/i.test(projectDirect.labels.join(' | ')), `${viewport.label}/Project must keep Continue Design direct`);
      assert(/Open Verify/i.test(projectDirect.labels.join(' | ')), `${viewport.label}/Project must keep Open Verify direct`);
      assert(/Change Project/i.test(projectDirect.labels.join(' | ')), `${viewport.label}/Project must expose Change Project`);
      await page.locator('[data-testid="ide-project-change-project"]').first().click();
      const projectDisclosed = await assertActionCluster(page, viewport, 'project disclosed alternatives', '[data-testid="ide-project-command-board-v1"]', 7, {
        maxTop: 300,
      });
      assert(/Build Fresh/i.test(projectDisclosed.labels.join(' | ')), `${viewport.label}/Project disclosed alternatives must keep Build Fresh`);
      assert(/Import Project/i.test(projectDisclosed.labels.join(' | ')), `${viewport.label}/Project disclosed alternatives must keep Import Project`);

      await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=outer-workflow-action-density-${viewport.label}-import`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
      await assertBuildHash(page, `${viewport.label}/import`);
      await assertNoProductSpine(page, `${viewport.label}/Import`);
      await assertActionCluster(page, viewport, 'import', '[data-testid="ide-import-guided-wizard-v1"]', 4);

      await openLogicGatesStarter(page, baseUrl, `outer-workflow-action-density-${viewport.label}-export`);
      await openMode(page, baseUrl, 'verify', `outer-workflow-action-density-${viewport.label}-export`);
      await runComparePass(page);
      await openMode(page, baseUrl, 'export', `outer-workflow-action-density-${viewport.label}-export`);
      await assertBuildHash(page, `${viewport.label}/export`);
      await assertNoProductSpine(page, `${viewport.label}/Export`);
      const exportActions = await assertActionCluster(page, viewport, 'export readiness', '[data-testid="ide-export-package-inspector-v1"]', 3);
      assert(/Inspect generated files/i.test(exportActions.labels.join(' | ')), `${viewport.label}/Export must expose generated-file inspection without restoring a product spine`);

      await assertNoRootOverflow(page, `${viewport.label}/outer workflow density`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Outer workflow density browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Outer workflow density failures:\n${failures.join('\n')}`);
});

async function assertActionCluster(page, viewport, surface, selector, minActions, options = {}) {
  await assertVisibleRect(page, [selector], `${viewport.label}/${surface} action surface`, {
    maxTop: options.maxTop ?? (viewport.height === 768 ? 220 : 250),
    minWidth: Math.round(viewport.width * 0.52),
    minHeight: 110,
  });
  const metrics = await page.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector);
    if (!root) return { actionCount: 0, labels: [] };
    const labels = Array.from(root.querySelectorAll('button, [role="button"], a[href], input, select, textarea, summary'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 1 && rect.height > 1 && rect.top < window.innerHeight && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => (element.textContent ?? element.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return { actionCount: labels.length, labels };
  }, selector);
  assert(metrics.actionCount >= minActions, `${viewport.label}/${surface}: expected at least ${minActions} visible controls, saw ${metrics.actionCount}: ${metrics.labels.join(' | ')}`);
  return metrics;
}

async function assertNoProductSpine(page, label) {
  const visibleProductSpines = await page.locator('[data-testid^="ide-product-spine-"]:visible').count();
  assert(visibleProductSpines === 0, `${label}: duplicate product-spine action authority must stay removed`);
}
