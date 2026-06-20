#!/usr/bin/env node

import { execSync } from 'node:child_process';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();

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
      await assertBuildHash(page, viewport);

      await openMode(page, baseUrl, viewport, 'design');
      await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
      await assertWorkspacePrimitive(page, viewport, 'design', 'fixed-tool-palette');
      await assertPrimaryRect(page, viewport, 'Design V2 canvas with fixed palette', ['[data-testid="ide-design-live-canvas"]'], {
        minWidthRatio: 0.53,
        minHeightRatio: 0.54,
      });
      await openSupportSequence(page, viewport, 'design');
      await assertPrimaryRect(page, viewport, 'Design V2 canvas after support check', ['[data-testid="ide-design-live-canvas"]'], {
        minWidthRatio: 0.53,
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
      await assertWorkspacePrimitive(page, viewport, 'hardware', 'board-mapping-workspace');
      await assertPrimaryRect(page, viewport, 'Hardware closed-rail board workspace', ['[data-testid="ide-hw-board-workspace"]'], {
        minWidthRatio: 0.78,
        minHeightRatio: 0.52,
      });
      await openSupportSequence(page, viewport, 'hardware');
      await assertPrimaryRect(page, viewport, 'Hardware focused board workspace with support opened', ['[data-testid="ide-hw-board-workspace"]'], {
        minWidthRatio: 0.68,
        minHeightRatio: 0.52,
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

async function assertBuildHash(page, viewport) {
  const visibleSha = ((await page.locator('[data-testid="ide-root"]').first().getAttribute('data-build-sha').catch(() => '')) ?? '').trim();
  assert(
    visibleSha === CURRENT_SHA,
    `${viewport.label}: root build sha must match current HEAD ${CURRENT_SHA}, got ${visibleSha || 'missing'}`
  );
}

async function openSupportSequence(page, viewport, mode) {
  const leftToggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
  const rightToggle = page.locator('[data-testid="ide-workbench-dock-toggle-right"]').first();

  if (await leftToggle.isVisible().catch(() => false)) {
    await leftToggle.click();
    await page.waitForTimeout(140);
    await assertNoRootOverflow(page, viewport, `${mode}/left support open`);
  }

  if (await rightToggle.isVisible().catch(() => false)) {
    await rightToggle.click();
    await page.waitForTimeout(160);
    await assertNoRootOverflow(page, viewport, `${mode}/right support open`);
  }

  const support = await readSupportState(page);
  if (mode === 'design') {
    const primitive = await page
      .locator('.ide-workbench-shell[data-ide-mode-marker="design"]')
      .first()
      .getAttribute('data-workspace-primitive')
      .catch(() => '');
    assert(
      primitive === 'fixed-tool-palette',
      `${viewport.label}/${mode}: Design support check must be running against the V2 fixed-tool-palette primitive`
    );
    assert(
      support.visibleDockCount <= 2,
      `${viewport.label}/${mode}: fixed palette/context regions must remain bounded, got ${JSON.stringify(support)}`
    );
    return;
  }
  assert(
    support.visibleDockCount <= 1,
    `${viewport.label}/${mode}: support docks must be mutually exclusive in focused workbench mode, got ${JSON.stringify(support)}`
  );
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
    state.waveform.visibleWidth >= viewport.width * 0.47,
    `${viewport.label}: Verify evidence lane is too narrow (${state.waveform.visibleWidth}px); expected at least ${Math.round(viewport.width * 0.47)}px`
  );
  assert(
    state.waveform.visibleWidth >= state.stimulus.visibleWidth * 1.15,
    `${viewport.label}: Verify waveform evidence should remain the larger post-run lane (${JSON.stringify(state)})`
  );
  assert(
    state.stimulus.visibleWidth >= viewport.width * 0.4,
    `${viewport.label}: Verify post-run repair lane is too narrow for expected-output editing (${state.stimulus.visibleWidth}px)`
  );
  assert(
    state.stimulus.visibleWidth / state.labGrid.visibleWidth >= 0.46,
    `${viewport.label}: Verify repair lane must keep a usable share of the workbench (${JSON.stringify(state)})`
  );
  assert(
    state.stimulus.visibleWidth <= viewport.width * 0.44,
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
}

async function assertNoRootOverflow(page, viewport, label) {
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  assert(overflow <= 1, `${viewport.label}/${label}: root horizontal overflow ${overflow}px`);
}

async function assertWorkspacePrimitive(page, viewport, mode, expectedPrimitive) {
  const state = await page.evaluate((targetMode) => {
    const shell = document.querySelector(`.ide-workbench-shell[data-ide-mode-marker="${targetMode}"]`);
    return {
      primitive: shell?.getAttribute('data-workspace-primitive') ?? '',
      leftDockState: shell?.getAttribute('data-left-dock-state') ?? '',
      rightDockState: shell?.getAttribute('data-right-dock-state') ?? '',
    };
  }, mode);
  assert(
    state.primitive === expectedPrimitive,
    `${viewport.label}/${mode}: expected workspace primitive ${expectedPrimitive}, got ${JSON.stringify(state)}`
  );
}

async function readSupportState(page) {
  return page.evaluate(() => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const leftDockVisible = visible('[data-testid="ide-left-dock"]');
    const rightDockVisible = visible('[data-testid="ide-inspector"]');
    return {
      leftDockVisible,
      rightDockVisible,
      visibleDockCount: Number(leftDockVisible) + Number(rightDockVisible),
    };
  });
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
