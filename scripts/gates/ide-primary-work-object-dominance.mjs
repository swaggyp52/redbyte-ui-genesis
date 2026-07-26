#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { assertBuildHash } from './_workbenchReconstructionHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

await runIdeGate('IDE primary work object dominance satisfied', async ({ page, baseUrl }) => {
  const findings = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      findings.push({ type: 'console.error', text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => findings.push({ type: 'pageerror', text: error.message }));

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const failures = [];
  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGates(page, baseUrl, viewport);
      await assertBuildHash(page, viewport.label);

      await openMode(page, baseUrl, viewport, 'design');
      await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
      const designCanvas = await assertPrimaryRect(page, viewport, 'Design stable-workspace canvas', ['[data-testid="ide-design-live-canvas"]'], {
        minWidthRatio: 0.62,
        minHeightRatio: 0.54,
      });
      console.log(
        `OBSERVE ${viewport.label}: Design canvas is ${(designCanvas.visibleWidth / viewport.width * 100).toFixed(1)}% of viewport; ` +
        `gate floor 62%; strategic 70% target ${designCanvas.visibleWidth >= viewport.width * 0.7 ? 'met' : 'not met'}.`
      );
      await assertStableSupportRegions(page, viewport, 'design');
      await assertPrimaryRect(page, viewport, 'Design canvas with stable support regions', ['[data-testid="ide-design-live-canvas"]'], {
        minWidthRatio: 0.62,
        minHeightRatio: 0.54,
      });

      await openMode(page, baseUrl, viewport, 'verify');
      await ensureVerifyVectorsReady(page);
      assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must be selectable`);
      await clickVerifyRun(page);
      await waitForVerifyResult(page, { timeout: 15000 });
      await page.waitForSelector('[data-testid="ide-verify-waveform-svg"]', { timeout: 10000 });
      await assertVerifyPostRunEvidenceRepairBalance(page, viewport);

      await openMode(page, baseUrl, viewport, 'hardware');
      await page.waitForSelector('[data-testid="ide-hw-board-workspace"]', { timeout: 15000 });
      await assertPrimaryRect(page, viewport, 'Map Pins table-first workspace', ['[data-testid="ide-hw-map-table"]'], {
        minWidthRatio: 0.45,
        minHeightRatio: 0.37,
      });
      await assertStableSupportRegions(page, viewport, 'hardware');
      await assertPrimaryRect(page, viewport, 'Map Pins table with direct stable supports', ['[data-testid="ide-hw-map-table"]'], {
        minWidthRatio: 0.45,
        minHeightRatio: 0.37,
      });
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(findings.length === 0, `browser console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
  assert(failures.length === 0, `primary work object dominance failures:\n${failures.join('\n')}`);
});

async function openLogicGates(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=primary-work-object-dominance-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
}

async function openMode(page, baseUrl, viewport, mode) {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&gate=primary-work-object-dominance-${viewport.label}-${mode}`, {
      waitUntil: 'domcontentloaded',
    });
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(140);
}

async function assertStableSupportRegions(page, viewport, mode) {
  const support = await readSupportState(page, mode);
  assert(support.retiredToggleCount === 0, `${viewport.label}/${mode}: retired dock toggle returned`);
  assert(
    support.supports.every((region) => region.visible),
    `${viewport.label}/${mode}: direct stable support region missing ${JSON.stringify(support)}`
  );
  assert(
    support.supports.every((region) => !rectanglesOverlap(support.primary, region)),
    `${viewport.label}/${mode}: support region overlaps the primary work object ${JSON.stringify(support)}`
  );
  if (mode === 'design') {
    assert(
      support.leftDockVisible && support.rightDockVisible,
      `${viewport.label}/design: component library and inspector docks must remain stable ${JSON.stringify(support)}`
    );
  } else {
    assert(
      !support.leftDockVisible && !support.rightDockVisible,
      `${viewport.label}/${mode}: surface-owned support must not recreate shell docks ${JSON.stringify(support)}`
    );
  }
  await assertNoRootOverflow(page, viewport, `${mode}/stable support`);
}

async function assertVerifyPostRunEvidenceRepairBalance(page, viewport) {
  const state = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { visible: false, width: 0, height: 0, visibleWidth: 0, visibleHeight: 0 };
      const bounds = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(window.innerWidth, bounds.right) - Math.max(0, bounds.left));
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, bounds.bottom) - Math.max(0, bounds.top));
      return {
        visible: bounds.width > 1 && bounds.height > 1 && visibleWidth > 1 && visibleHeight > 1,
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        visibleWidth: Math.round(visibleWidth),
        visibleHeight: Math.round(visibleHeight),
      };
    };
    const labGrid = document.querySelector('[data-testid="ide-verify-lab-grid"]');
    return {
      phase: labGrid?.getAttribute('data-verify-workflow-phase') ?? '',
      workspaceMode: labGrid?.getAttribute('data-workspace-mode') ?? '',
      labGrid: rect('[data-testid="ide-verify-lab-grid"]'),
      stimulus: rect('[data-testid="ide-verify-region-stimulus"]'),
      waveform: rect('[data-testid="ide-verify-region-waveform"]'),
      waveformScrollExtraX: (() => {
        const element = document.querySelector('[data-testid="ide-verify-waveform-scroll"]');
        return element ? Math.max(0, element.scrollWidth - element.clientWidth) : 0;
      })(),
    };
  });

  assert(state.phase === 'post-run', `${viewport.label}: Verify must be post-run after Compare, got ${JSON.stringify(state)}`);
  assert(
    state.waveform.visibleWidth >= viewport.width * 0.4,
    `${viewport.label}: Verify evidence lane is too narrow (${state.waveform.visibleWidth}px); expected at least ${Math.round(viewport.width * 0.4)}px`
  );
  assert(
    state.waveform.visibleWidth >= state.stimulus.visibleWidth,
    `${viewport.label}: Verify waveform evidence should remain the larger post-run lane (${JSON.stringify(state)})`
  );
  assert(
    state.stimulus.visibleWidth >= viewport.width * 0.36,
    `${viewport.label}: Verify post-run repair lane is too narrow for expected-output editing (${state.stimulus.visibleWidth}px)`
  );
  assert(
    state.stimulus.visibleWidth / state.labGrid.visibleWidth >= 0.46,
    `${viewport.label}: Verify repair lane must keep a usable share of the workbench (${JSON.stringify(state)})`
  );
  assert(
    state.stimulus.visibleWidth <= viewport.width * 0.42,
    `${viewport.label}: Verify post-run repair lane should not overtake evidence (${state.stimulus.visibleWidth}px)`
  );
  assert(
    state.waveformScrollExtraX <= 8,
    `${viewport.label}: Verify waveform evidence should not need mini horizontal scroll (${state.waveformScrollExtraX}px)`
  );
}

async function assertPrimaryRect(page, viewport, label, selectors, thresholds) {
  const rect = await firstVisibleRect(page, selectors);
  assert(rect.visible, `${viewport.label}: ${label} must be visible`);
  assert(
    rect.visibleWidth >= viewport.width * thresholds.minWidthRatio,
    `${viewport.label}: ${label} is too narrow (${rect.visibleWidth}px); expected at least ${Math.round(viewport.width * thresholds.minWidthRatio)}px`
  );
  assert(
    rect.visibleHeight >= viewport.height * thresholds.minHeightRatio,
    `${viewport.label}: ${label} is too short (${rect.visibleHeight}px); expected at least ${Math.round(viewport.height * thresholds.minHeightRatio)}px`
  );
  return rect;
}

async function assertNoRootOverflow(page, viewport, label) {
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  assert(overflow <= 1, `${viewport.label}/${label}: root horizontal overflow ${overflow}px`);
}

async function readSupportState(page, mode) {
  return page.evaluate((expectedMode) => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, visible: false, left: 0, top: 0, right: 0, bottom: 0 };
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        selector,
        visible: bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden',
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
      };
    };
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const leftDockVisible = visible('[data-testid="ide-left-dock"]');
    const rightDockVisible = visible('[data-testid="ide-right-dock"]');
    const primarySelector = expectedMode === 'design'
      ? '[data-testid="ide-design-live-canvas"]'
      : '[data-testid="ide-hw-map-table"]';
    const supportSelectors = expectedMode === 'design'
      ? ['[data-testid="ide-left-dock"]', '[data-testid="ide-right-dock"]']
      : ['[data-testid="ide-hw-selected-mapping-editor"]', '[data-testid="ide-hw-map-board"]'];
    return {
      leftDockVisible,
      rightDockVisible,
      retiredToggleCount: document.querySelectorAll(
        '[data-testid^="ide-workbench-dock-toggle-"], [data-testid*="dock-collapse"], .ide-workbench-dock-toggle-rail'
      ).length,
      primary: rect(primarySelector),
      supports: supportSelectors.map((selector) => rect(selector)),
    };
  }, mode);
}

function rectanglesOverlap(left, right) {
  if (!left.visible || !right.visible) return false;
  const overlapWidth = Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left));
  const overlapHeight = Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
  return overlapWidth > 2 && overlapHeight > 2;
}

async function firstVisibleRect(page, selectors) {
  return page.evaluate((candidateSelectors) => {
    const empty = {
      selector: null,
      visible: false,
      visibleWidth: 0,
      visibleHeight: 0,
    };
    for (const selector of candidateSelectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visibleWidth = Math.max(0, Math.min(window.innerWidth, bounds.right) - Math.max(0, bounds.left));
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, bounds.bottom) - Math.max(0, bounds.top));
      const visible =
        bounds.width > 1 &&
        bounds.height > 1 &&
        visibleWidth > 1 &&
        visibleHeight > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
      if (visible) {
        return {
          selector,
          visible,
          visibleWidth: Math.round(visibleWidth),
          visibleHeight: Math.round(visibleHeight),
        };
      }
    }
    return empty;
  }, selectors);
}
