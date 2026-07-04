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

// Product spine task bars now occupy normal flow so they cannot cover work objects.
const NORMAL_FLOW_TASK_BAR_ALLOWANCE = 38;

await runIdeGate('IDE workbench reconstruction v1 shell and task planes satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesStarter(page, baseUrl, `workbench-reconstruction-v1-${viewport.label}`);
      await assertBuildHash(page, viewport.label);

      await assertShellChrome(page, viewport, 'design-loaded');
      await assertVisibleRect(page, ['[data-testid="ide-design-live-canvas"]'], `${viewport.label}/design canvas`, {
        maxTop: 226 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.78),
        minHeight: Math.round(viewport.height * 0.50),
      });

      await openMode(page, baseUrl, 'verify', `workbench-reconstruction-v1-${viewport.label}`);
      await assertShellChrome(page, viewport, 'verify-pre');
      await assertVisibleRect(page, ['[data-testid="ide-verify-region-stimulus"]'], `${viewport.label}/verify stimulus`, {
        maxTop: 214 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.62),
        minHeight: Math.round(viewport.height * 0.34),
      });
      await runComparePass(page);
      await assertVisibleRect(page, ['[data-testid="ide-verify-region-waveform"]'], `${viewport.label}/verify evidence`, {
        maxTop: 238 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.45),
        minHeight: Math.round(viewport.height * 0.40),
      });

      await openMode(page, baseUrl, 'hardware', `workbench-reconstruction-v1-${viewport.label}`);
      await assertShellChrome(page, viewport, 'hardware');
      await assertVisibleRect(page, ['[data-testid="ide-hw-board-workspace"]'], `${viewport.label}/hardware board workspace`, {
        maxTop: 178 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.80),
        minHeight: Math.round(viewport.height * 0.48),
      });

      await openMode(page, baseUrl, 'export', `workbench-reconstruction-v1-${viewport.label}`);
      await assertShellChrome(page, viewport, 'export');
      await assertVisibleRect(page, ['[data-testid="ide-export-package-inspector-v1"]'], `${viewport.label}/export package inspector`, {
        maxTop: 176 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.70),
        minHeight: 220,
      });

      await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=workbench-reconstruction-v1-${viewport.label}-import`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
      await assertShellChrome(page, viewport, 'import');
      await assertVisibleRect(page, ['[data-testid="ide-import-start-shell"]', '[data-testid="ide-import-workspace"]'], `${viewport.label}/import recovery`, {
        maxTop: 178 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.65),
        minHeight: 220,
      });
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `workbench reconstruction failures:\n${failures.join('\n')}`);
});

async function assertShellChrome(page, viewport, label) {
  const state = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { visible: false, top: 0, height: 0 };
      const bounds = element.getBoundingClientRect();
      return {
        visible: bounds.width > 1 && bounds.height > 1,
        top: Math.round(bounds.top),
        bottom: Math.round(bounds.bottom),
        height: Math.round(bounds.height),
      };
    };
    return {
      topbar: rect('[data-testid="ide-top-bar"]'),
      ribbon: rect('[data-testid="ide-proof-ribbon"]'),
      shell: rect('[data-ide-mode-marker]'),
      surfaceColumn: rect('.ide-surface-column'),
    };
  });
  await assertNoRootOverflow(page, `${viewport.label}/${label}`);
  assert(state.topbar.visible && state.topbar.height <= 46, `${viewport.label}/${label}: topbar too tall ${JSON.stringify(state)}`);
  assert(state.ribbon.visible && state.ribbon.height <= 38, `${viewport.label}/${label}: proof ribbon too tall ${JSON.stringify(state)}`);
  assert(state.surfaceColumn.top <= 90, `${viewport.label}/${label}: surface column starts too low ${JSON.stringify(state)}`);
  assert(state.shell.top <= 96, `${viewport.label}/${label}: workbench shell starts too low ${JSON.stringify(state)}`);
}
