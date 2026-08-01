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

// The retired duplicate task bar no longer consumes a second shell row.
const NORMAL_FLOW_TASK_BAR_ALLOWANCE = 0;

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
        maxTop: 330 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.62),
        minHeight: Math.round(viewport.height * 0.50),
      });

      await openMode(page, baseUrl, 'verify', `workbench-reconstruction-v1-${viewport.label}`);
      await assertShellChrome(page, viewport, 'verify-pre');
      await assertVisibleRect(page, ['[data-testid="ide-verify-region-stimulus"]'], `${viewport.label}/verify stimulus`, {
        maxTop: 340 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.62),
        minHeight: Math.round(viewport.height * 0.34),
      });
      await runComparePass(page);
      await assertVisibleRect(page, ['[data-testid="ide-verify-region-waveform"]'], `${viewport.label}/verify evidence`, {
        maxTop: 340 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.40),
        minHeight: Math.round(viewport.height * 0.40),
      });

      await openMode(page, baseUrl, 'hardware', `workbench-reconstruction-v1-${viewport.label}`);
      await assertShellChrome(page, viewport, 'hardware');
      await assertVisibleRect(page, ['[data-testid="ide-hw-board-workspace"]'], `${viewport.label}/hardware board workspace`, {
        maxTop: 178 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.78),
        minHeight: Math.round(viewport.height * 0.48),
      });

      await openMode(page, baseUrl, 'export', `workbench-reconstruction-v1-${viewport.label}`);
      await assertShellChrome(page, viewport, 'export');
      await assertVisibleRect(page, ['[data-testid="ide-export-readiness-hero"]'], `${viewport.label}/export workspace`, {
        maxTop: 176 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.70),
        minHeight: 220,
      });
      await assertVisibleRect(page, ['[data-testid="ide-export-package-inspector-v1"]'], `${viewport.label}/export package decision`, {
        maxTop: 176 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.round(viewport.width * 0.70),
        minHeight: 96,
      });

      await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=workbench-reconstruction-v1-${viewport.label}-import`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
      await assertShellChrome(page, viewport, 'import');
      await assertVisibleRect(page, ['[data-testid="ide-import-workbench"]'], `${viewport.label}/import recovery`, {
        maxTop: 178 + NORMAL_FLOW_TASK_BAR_ALLOWANCE,
        minWidth: Math.min(880, Math.round(viewport.width * 0.62)),
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
      stageNav: rect('[data-testid="ide-stage-nav"]'),
      ribbon: rect('[data-testid="ide-proof-ribbon"]'),
      footer: rect('[data-testid="ide-status-bar"]'),
      shell: rect('[data-ide-mode-marker]'),
      surfaceColumn: rect('.ide-surface-column'),
      stageLabels: Array.from(document.querySelectorAll('[data-testid="ide-stage-nav"] .ide-stage-nav-label'))
        .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
      importIsUtility: (() => {
        const topbar = document.querySelector('[data-testid="ide-top-bar"]');
        const stageNav = document.querySelector('[data-testid="ide-stage-nav"]');
        const importButton = document.querySelector('[data-testid="mode-button-import"]');
        return Boolean(importButton && topbar?.contains(importButton) && !stageNav?.contains(importButton));
      })(),
      retiredRailCount: document.querySelectorAll(
        '[data-testid="ide-left-rail"], [data-testid="ide-right-rail"], .ide-left-rail, .ide-right-rail'
      ).length,
      retiredToggleCount: document.querySelectorAll(
        '[data-testid^="ide-workbench-dock-toggle-"], [data-testid*="dock-collapse"], .ide-workbench-dock-toggle-rail'
      ).length,
    };
  });
  await assertNoRootOverflow(page, `${viewport.label}/${label}`);
  assert(state.topbar.visible && state.topbar.height <= 60, `${viewport.label}/${label}: compact topbar is too tall ${JSON.stringify(state)}`);
  assert(state.stageNav.visible && Math.abs(state.stageNav.height - 52) <= 1, `${viewport.label}/${label}: expected 52px horizontal stage navigation ${JSON.stringify(state)}`);
  assert(!state.ribbon.visible, `${viewport.label}/${label}: retired proof ribbon must stay absent ${JSON.stringify(state)}`);
  assert(
    state.footer.visible && state.footer.height <= 28,
    `${viewport.label}/${label}: shared status bar must remain visible and compact ${JSON.stringify(state.footer)}`
  );
  assert(state.retiredRailCount === 0 && state.retiredToggleCount === 0, `${viewport.label}/${label}: retired rail or dock restore chrome returned ${JSON.stringify(state)}`);
  assert(Math.abs(state.stageNav.top - state.topbar.bottom) <= 2, `${viewport.label}/${label}: stage navigation must begin directly below topbar ${JSON.stringify(state)}`);
  assert(
    state.shell.top >= state.stageNav.bottom - 10 && state.shell.top <= state.stageNav.bottom + 2,
    `${viewport.label}/${label}: workbench must meet the stage-navigation edge without a dead chrome band ${JSON.stringify(state)}`
  );
  assert(Math.abs(state.surfaceColumn.top - state.shell.top) <= 2, `${viewport.label}/${label}: surface column must begin with workbench ${JSON.stringify(state)}`);
  assert(
    JSON.stringify(state.stageLabels) === JSON.stringify(['Project', 'Design', 'Simulate', 'Board & Constraints', 'Build & Export']) && state.importIsUtility,
    `${viewport.label}/${label}: shell must expose ordered five stages plus top-bar Import utility ${JSON.stringify(state)}`
  );
}
