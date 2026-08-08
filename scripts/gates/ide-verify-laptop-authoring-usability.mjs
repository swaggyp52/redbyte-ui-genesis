#!/usr/bin/env node

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openMode,
} from './_workbenchReconstructionHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

const SCREENSHOT_DIR = process.env.RB_VERIFY_LAPTOP_AUTHORING_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_LAPTOP_AUTHORING_SCREENSHOTS_DIR)
  : path.join(process.cwd(), '.redbyte', 'product-immersion', 'verify-laptop-authoring', 'after');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE Verify laptop authoring remains visible and operable', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  for (const viewport of CLASSROOM_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await openStarterInVerify(page, baseUrl, 'half-adder', `${viewport.label}-half-adder`);
    await ensureVerifyVectorsReady(page);
    assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}/half-adder: Compare must be selectable`);
    await clickVerifyRun(page);
    await waitForVerifyResult(page, { timeout: 15000 });
    await assertBuildHash(page, `${viewport.label}/half-adder`);
    await assertNoRootOverflow(page, `${viewport.label}/half-adder`);
    const halfAdderRows = await assertAuthoringRows(page, {
      label: `${viewport.label}/half-adder`,
      inputCount: 2,
      expectedCount: 2,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `verify-laptop-half-adder-${viewport.label}.png`),
    });

    await openStarterInVerify(page, baseUrl, 'two-bit-counter', `${viewport.label}-counter`);
    const clockPolicyPanel = page.getByTestId('ide-verify-clock-policy-panel').first();
    await clockPolicyPanel.locator('summary').click();
    await page.getByTestId('ide-verify-clock-mode-manual').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByTestId('ide-verify-clock-mode-manual').first().click();
    await page.waitForFunction(
      () => {
        const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
        const active = state?.scenarios?.find((scenario) => scenario.id === state.activeScenarioId);
        return active?.sequentialPolicy?.overrideMode === 'manual-pulses';
      },
      { timeout: 8000 },
    );
    await page.waitForSelector('[data-testid="ide-stimulus-clock-tools"]', { timeout: 10000 });

    const counterRows = await assertAuthoringRows(page, {
      label: `${viewport.label}/counter`,
      inputCount: 3,
      expectedCount: 2,
    });
    const clockProof = await assertExplicitClockControls(page, `${viewport.label}/counter`);

    await page.getByTestId('ide-verify-clock-mode-custom').first().click();
    await page.waitForFunction(
      () => {
        const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
        const active = state?.scenarios?.find((scenario) => scenario.id === state.activeScenarioId);
        return active?.sequentialPolicy?.overrideMode === 'custom-pattern';
      },
      { timeout: 8000 },
    );
    for (const behavior of ['rising', 'falling', 'high', 'low']) {
      assert(
        await page.getByTestId(`ide-stimulus-clock-behavior-${behavior}`).first().isVisible(),
        `${viewport.label}/counter: ${behavior} control disappeared in Custom pattern mode`,
      );
    }
    await assertBuildHash(page, `${viewport.label}/counter`);
    await assertNoRootOverflow(page, `${viewport.label}/counter`);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `verify-laptop-counter-${viewport.label}.png`),
    });

    console.log(
      `  ${viewport.label}: half-adder ${halfAdderRows.visibleRows}/4 rows; ` +
        `counter ${counterRows.visibleRows}/5 rows; explicit steps ${clockProof.behaviors.join(', ')}`,
    );
  }

  assert(
    browserProblems.length === 0,
    `Verify laptop authoring emitted browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`,
  );
});

async function openStarterInVerify(page, baseUrl, exampleId, gateLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-laptop-authoring-${gateLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: exampleId });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await openMode(page, baseUrl, 'verify', `verify-laptop-authoring-${gateLabel}`);
  await page.waitForSelector('[data-testid="ide-stimulus-canvas"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-vcb-workspace-scenario"]', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => {
    const button = document.querySelector('[data-testid="ide-vcb-workspace-scenario"]');
    if (button instanceof HTMLButtonElement) button.click();
  });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-studio-mode') === 'scenario',
    { timeout: 5000 },
  );
}

async function assertAuthoringRows(page, { label, inputCount, expectedCount }) {
  const checksTab = page.locator('[data-testid="ide-vcb-workspace-checks"]').first();
  assert(await checksTab.isVisible().catch(() => false), `${label}: Checks workspace tab must remain visible`);
  await checksTab.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-studio-mode') === 'checks',
    { timeout: 5000 },
  );
  await page.evaluate(() => {
    const body = document.querySelector('.ide-verify-panel > .ide-panel-body');
    const firstInput = document.querySelector(
      '.ide-stimulus-grid-scroll .ide-stimulus-row:not(.ide-stimulus-row--header):not(.ide-stimulus-row--output):not(.ide-stimulus-row--observed):not(.ide-stimulus-row--case-status) .ide-stimulus-label-cell',
    );
    if (!(body instanceof HTMLElement) || !(firstInput instanceof HTMLElement)) return;
    const bodyRect = body.getBoundingClientRect();
    const rowRect = firstInput.getBoundingClientRect();
    body.scrollTop += rowRect.top - bodyRect.top - 20;
  });
  await page.waitForTimeout(80);

  const metrics = await page.evaluate(({ expectedInputCount, expectedOutputCount }) => {
    const isInputRow = (element) =>
      element.classList.contains('ide-stimulus-row') &&
      !element.classList.contains('ide-stimulus-row--header') &&
      !element.classList.contains('ide-stimulus-row--output') &&
      !element.classList.contains('ide-stimulus-row--observed') &&
      !element.classList.contains('ide-stimulus-row--case-status');
    const grid = document.querySelector('.ide-stimulus-grid-scroll');
    const inputLabels = Array.from(grid?.querySelectorAll('.ide-stimulus-label-cell') ?? [])
      .filter((element) => element.parentElement && isInputRow(element.parentElement.parentElement ?? element.parentElement))
      .slice(0, expectedInputCount);
    const expectedLabels = Array.from(
      grid?.querySelectorAll('.ide-stimulus-row--output > .ide-stimulus-label-cell') ?? [],
    ).slice(0, expectedOutputCount);
    const clippedControl = (element) => {
      const rect = element.getBoundingClientRect();
      let left = Math.max(0, rect.left);
      let right = Math.min(window.innerWidth, rect.right);
      let top = Math.max(0, rect.top);
      let bottom = Math.min(window.innerHeight, rect.bottom);
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const ancestorRect = ancestor.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          left = Math.max(left, ancestorRect.left);
          right = Math.min(right, ancestorRect.right);
        }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
          top = Math.max(top, ancestorRect.top);
          bottom = Math.min(bottom, ancestorRect.bottom);
        }
      }
      const center = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        label: element.textContent?.trim() ?? '',
        visibleWidth: Math.round(Math.max(0, right - left)),
        visibleHeight: Math.round(Math.max(0, bottom - top)),
        centerHit: center === element || element.contains(center),
      };
    };
    const rows = [...inputLabels, ...expectedLabels].map(clippedControl);
    const gridStyle = grid ? getComputedStyle(grid) : null;
    return {
      inputRows: inputLabels.length,
      expectedRows: expectedLabels.length,
      rows,
      gridOverflowY: gridStyle?.overflowY ?? '',
      gridExtraY: grid ? Math.max(0, grid.scrollHeight - grid.clientHeight) : -1,
    };
  }, { expectedInputCount: inputCount, expectedOutputCount: expectedCount });

  assert(metrics.inputRows === inputCount, `${label}: expected ${inputCount} input rows: ${JSON.stringify(metrics)}`);
  assert(metrics.expectedRows === expectedCount, `${label}: expected ${expectedCount} expected rows: ${JSON.stringify(metrics)}`);
  for (const row of metrics.rows) {
    assert(row.visibleWidth >= 120, `${label}: row ${row.label} width is clipped: ${JSON.stringify(metrics)}`);
    assert(row.visibleHeight >= 34, `${label}: row ${row.label} height is clipped: ${JSON.stringify(metrics)}`);
    assert(row.centerHit, `${label}: row ${row.label} center is not hit-testable: ${JSON.stringify(metrics)}`);
  }
  assert(metrics.gridExtraY <= 1, `${label}: nested timeline still has ${metrics.gridExtraY}px vertical scroll`);
  return { visibleRows: metrics.rows.length, rows: metrics.rows.map((row) => row.label) };
}

async function assertExplicitClockControls(page, label) {
  await page.getByTestId('ide-stimulus-clock-tools').first().scrollIntoViewIfNeeded();
  const geometry = await page.evaluate(() => {
    const tools = document.querySelector('[data-testid="ide-stimulus-clock-tools"]');
    const row = document.querySelector('[data-testid="ide-stimulus-clock-row"]');
    const toolsRect = tools?.getBoundingClientRect();
    const rowRect = row?.getBoundingClientRect();
    const overlap =
      toolsRect && rowRect
        ? Math.max(0, Math.min(toolsRect.right, rowRect.right) - Math.max(toolsRect.left, rowRect.left)) *
          Math.max(0, Math.min(toolsRect.bottom, rowRect.bottom) - Math.max(toolsRect.top, rowRect.top))
        : -1;
    return {
      toolsOutsideRow: Boolean(tools && row && !row.contains(tools)),
      overlap: Math.round(overlap),
    };
  });
  assert(geometry.toolsOutsideRow, `${label}: clock controls are still nested in the signal row`);
  assert(geometry.overlap === 0, `${label}: clock controls overlap the clock row by ${geometry.overlap}px`);

  const behaviors = [];
  for (const behavior of ['rising', 'falling', 'high', 'low']) {
    const control = page.getByTestId(`ide-stimulus-clock-behavior-${behavior}`).first();
    assert(await control.isVisible(), `${label}: explicit ${behavior} control is not visible`);
    const before = await activeScenarioVectorState(page);
    await control.click();
    const materialized = await page.waitForFunction(
      ({ expectedBehavior, previousCount, clockId }) => {
        const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
        const active = state?.scenarios?.find((scenario) => scenario.id === state.activeScenarioId);
        if (!active || active.vectors.length <= previousCount) return false;
        const values = active.vectors.map((vector) => vector.inputs?.[clockId] ?? 0);
        if (expectedBehavior === 'rising') return values.at(-2) === 0 && values.at(-1) === 1;
        if (expectedBehavior === 'falling') return values.at(-2) === 1 && values.at(-1) === 0;
        if (expectedBehavior === 'high') return values.at(-1) === 1;
        return values.at(-1) === 0;
      },
      { expectedBehavior: behavior, previousCount: before.count, clockId: before.clockId },
      { timeout: 8000 },
    ).catch(() => null);
    if (!materialized) {
      const diagnostic = await page.evaluate((clockId) => {
        const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
        const active = state?.scenarios?.find((scenario) => scenario.id === state.activeScenarioId);
        return {
          clockId,
          policy: active?.sequentialPolicy,
          vectorCount: active?.vectors?.length ?? 0,
          tailValues: active?.vectors?.slice(-8).map((vector) => vector.inputs?.[clockId]),
          tailSteps: active?.steps?.slice(-4).map((step) => ({
            kind: step.kind,
            targetRef: step.targetRef,
            pulseBehavior: step.pulseBehavior,
          })),
        };
      }, before.clockId);
      throw new Error(`${label}: ${behavior} control did not materialize: ${JSON.stringify(diagnostic)}`);
    }
    behaviors.push(behavior);
  }

  return { ...geometry, behaviors };
}

async function activeScenarioVectorState(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const active = state?.scenarios?.find((scenario) => scenario.id === state.activeScenarioId);
    const clockCellTestId = document
      .querySelector('[data-testid="ide-stimulus-clock-row"] [data-testid^="ide-stimulus-cell-"]')
      ?.getAttribute('data-testid');
    const clockId = clockCellTestId?.match(/^ide-stimulus-cell-(.+)-t\d+$/)?.[1];
    return {
      count: active?.vectors?.length ?? 0,
      clockId: clockId ?? active?.sequentialPolicy?.signalId ?? 'clk',
    };
  });
}
