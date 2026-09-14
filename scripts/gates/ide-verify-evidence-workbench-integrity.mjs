#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const screenshotDir = process.env.RB_VERIFY_EVIDENCE_WORKBENCH_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_EVIDENCE_WORKBENCH_SCREENSHOTS_DIR)
  : '';

async function capture(page, fileName) {
  if (!screenshotDir) return;
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, fileName), fullPage: true });
}

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

async function isVisible(page, selector) {
  return page.locator(selector).first().isVisible().catch(() => false);
}

async function requireVisible(page, selector, label) {
  assert(await isVisible(page, selector), `${label} must be visible (${selector})`);
}

async function box(page, selector, label) {
  const bounds = await page.locator(selector).first().boundingBox();
  assert(Boolean(bounds), `${label} must be measurable (${selector})`);
  return bounds;
}

async function visibleBoxes(page, specs) {
  return page.evaluate((items) => {
    return items.flatMap(({ selector, label }) => {
      const element = document.querySelector(selector);
      if (!element) return [];
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const opacity = Number(style.opacity || '1');
      if (
        rect.width <= 1 ||
        rect.height <= 1 ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        opacity === 0
      ) {
        return [];
      }
      return [
        {
          label,
          selector,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      ];
    });
  }, specs);
}

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

async function assertNoMeaningfulOverlap(page, specs, phase) {
  const rects = await visibleBoxes(page, specs);
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const first = rects[i];
      const second = rects[j];
      const area = overlapArea(first, second);
      const allowed = Math.max(24, Math.min(first.width * first.height, second.width * second.height) * 0.03);
      assert(
        area <= allowed,
        `${phase}: ${first.label} overlaps ${second.label} by ${Math.round(area)}px^2 (${JSON.stringify({
          first,
          second,
        })})`
      );
    }
  }
}

async function pickRenderedExpectedTarget(page) {
  const cells = await page.locator('[data-testid^="ide-case-lab-exp-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const testId = element.getAttribute('data-testid') || '';
      const title = element.getAttribute('title') || '';
      const match = /^ide-case-lab-exp-(\d+)-(.+)$/.exec(testId);
      const value = element.querySelector('code')?.textContent?.trim();
      return {
        testId,
        signal: match?.[2] ?? '',
        tick: match?.[1] ? Number(match[1]) : -1,
        value: value === '1' ? 1 : value === '0' ? 0 : null,
        title,
      };
    })
  );

  const target = cells.find((cell) => cell.value === 0) ?? cells.find((cell) => cell.value === 1) ?? null;
  assert(
    target,
    `expected at least one visible saved expected-output cell, saw ${JSON.stringify(cells.slice(0, 8))}`
  );
  return target;
}

async function readRenderedCellValue(page, target) {
  const value = await page.getByTestId(target.testId).first().locator('code').textContent();
  return value === '1' ? 1 : value === '0' ? 0 : null;
}

async function clickExpectedCellToValue(page, target, expectedValue) {
  const cell = page.getByTestId(target.testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readRenderedCellValue(page, target);
    if (current === expectedValue) return;
    await cell.click();
    await page.waitForTimeout(150);
  }
  const current = await readRenderedCellValue(page, target);
  assert(current === expectedValue, `expected ${target.testId} to become ${expectedValue}, got ${current}`);
}

async function clickRunAndWaitForNewResult(page) {
  const previousReportHash = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null
  );
  await clickVerifyRun(page);
  await page.waitForFunction(
    (previous) => {
      const nextHash = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null;
      return Boolean(nextHash && nextHash !== previous);
    },
    previousReportHash,
    { timeout: 20000 }
  );
  await waitForVerifyResult(page, { timeout: 10000 });
  return text(page.locator('[data-testid="ide-verify-summary-status"]'));
}

async function assertWorkbenchGeometry(page, phase) {
  const workspace = await box(page, '[data-testid="ide-verify-lab-grid"]', `${phase} workspace`);
  const studioMode = await page.locator('[data-testid="ide-verify-lab-grid"]').first().getAttribute('data-studio-mode');
  if (studioMode === 'scenario' || studioMode === 'checks') {
    const stimulus = await box(page, '[data-testid="ide-verify-region-stimulus"]', `${phase} stimulus region`);
    const editor = await box(page, '[data-testid="ide-case-lab"]', `${phase} stimulus editor`);
    assert(editor.width >= 320, `${phase} stimulus editor must remain readable (width=${editor.width})`);
    assert(stimulus.width >= Math.min(900, workspace.width * 0.9), `${phase} ${studioMode} must own the authoring workspace (width=${stimulus.width})`);
    assert(!(await isVisible(page, '[data-testid="ide-verify-waveform-svg"]')), `${phase} recorded lanes must not compete with the case table`);
    await assertNoMeaningfulOverlap(
      page,
      [
        { selector: '[data-testid="ide-verify-stimulus-header"]', label: 'stimulus header' },
        { selector: '.ide-verify-run-summary-slot--inline', label: 'testbench summary' },
        { selector: '[data-testid="ide-stimulus-toolbar"]', label: 'stimulus toolbar' },
        { selector: '.ide-case-lab-scroll', label: 'stimulus table' },
      ],
      `${phase} stimulus evidence stack`,
    );
    return;
  }

  assert(studioMode === 'replay', `${phase}: expected a Simulation Studio workspace mode, got "${studioMode}"`);
  const waveform = await box(page, '[data-testid="ide-verify-region-waveform"]', `${phase} waveform region`);
  const waveformPreview = await box(page, '[data-testid="ide-verify-waveform-preview"]', `${phase} waveform preview`);
  assert(waveform.width >= Math.min(900, workspace.width * 0.9), `${phase} Replay must own the evidence workspace (width=${waveform.width})`);
  assert(waveformPreview.height >= 190, `${phase} waveform preview must keep usable height (height=${waveformPreview.height})`);
  assert(!(await isVisible(page, '[data-testid="ide-verify-region-stimulus"]')), `${phase} hidden authoring canvas must not compete with Replay`);
  await assertNoMeaningfulOverlap(
    page,
    [
      { selector: '[data-testid="ide-verify-scope-header"]', label: 'scope header' },
      { selector: '[data-testid="ide-verify-waveform-bar"]', label: 'waveform transport bar' },
      { selector: '[data-testid="ide-verify-waveform-preview"]', label: 'waveform preview' },
    ],
    `${phase} waveform stack`,
  );
  await assertNoMeaningfulOverlap(
    page,
    [
      { selector: '[data-testid="ide-verify-fail-nav"]', label: 'first mismatch navigation' },
      { selector: '[data-testid="ide-verify-waveform-transport"]', label: 'tick controls' },
    ],
    `${phase} waveform controls`,
  );
}

async function selectStudioMode(page, mode) {
  const representation = mode === 'replay' ? 'waveform' : 'table';
  const tab = page.getByTestId('ide-verify-view-' + representation).first();
  assert(await tab.isVisible(), representation + ' representation must remain directly available');
  await tab.click();
  await page.waitForFunction(
    expected => document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-representation') === expected,
    representation,
    { timeout: 5000 },
  );
}


await runIdeGate('IDE verify evidence workbench integrity satisfied', async ({ page, baseUrl }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/?mode=project&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  await ensureVerifyVectorsReady(page);
  await requireVisible(page, '[data-testid="ide-case-lab"]', 'first-run stimulus editor');
  await requireVisible(page, '[data-testid="ide-verify-representation"]', 'representation controls');
  await requireVisible(page, '[data-testid="ide-vcb-run"]', 'unified Run simulation authority');
  await requireVisible(page, '[data-testid="ide-verify-view-table"]', 'Scenario workspace tab');
  await requireVisible(page, '[data-testid="ide-verify-view-waveform"]', 'Checks workspace tab');

  const modeCopy = await page.getByTestId('ide-vcb-check-count').getAttribute('title');
  assert(
    /checks.*automatically/i.test(modeCopy),
    `mode explainer must describe automatic optional-check evaluation, got "${modeCopy}"`
  );
  await assertWorkbenchGeometry(page, 'pre-run-scenario');
  await selectStudioMode(page, 'checks');
  await requireVisible(page, '[data-testid^="ide-case-lab-exp-"]', 'first-run expected-output cells');
  const expectedHeaders = page.getByTestId('ide-case-lab-table').locator('th.ide-case-lab-exp');
  assert(await expectedHeaders.count() >= 2, 'each output must label expected values beside observations');
  const expectedCopy = await page.locator('[data-testid^="ide-case-lab-exp-"]').first().getAttribute('title');
  assert(/Expected.*0.*1.*none/i.test(expectedCopy), 'expected cell must explain its optional values: ' + expectedCopy);

  assert(
    !(await isVisible(page, '[data-testid="ide-verify-first-run-collapsed-strip"]')),
    'ready starter vectors must not hide the first-run editor behind a collapsed strip'
  );
  await assertWorkbenchGeometry(page, 'pre-run-checks');
  await capture(page, '01-first-run-editor-visible.png');

  assert(await setVerifyRunMode(page, 'compare'), 'saved optional checks must be recognized by unified simulation');
  let status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyPass(status), `initial unified simulation should PASS its authored checks, got "${status}"`);
  await selectStudioMode(page, 'replay');
  await requireVisible(page, '[data-testid="ide-run-check-result"]', 'simulation result summary');
  const initialResultKind = await page.locator('[data-testid="ide-run-check-result"]').first().getAttribute('data-check-status');
  assert(
    initialResultKind === 'pass',
    `simulation result summary must report completed browser evidence, got "${initialResultKind}"`,
  );
  await requireVisible(page, '[data-testid="ide-verify-waveform-svg"]', 'post-run waveform lanes');
  await assertWorkbenchGeometry(page, 'simulation-pass-replay');
  await capture(page, '02-simulation-pass-evidence-workbench.png');

  await selectStudioMode(page, 'checks');
  const target = await pickRenderedExpectedTarget(page);
  const wrongValue = target.value === 0 ? 1 : 0;
  await clickExpectedCellToValue(page, target, wrongValue);
  await page.waitForFunction(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectHealthCore?.dirtySinceVerify === true,
    { timeout: 5000 }
  );

  assert(await setVerifyRunMode(page, 'compare'), 'authored checks must remain active after expected-output edit');
  status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyFail(status), `edited expected output should FAIL unified simulation, got "${status}"`);
  await selectStudioMode(page, 'replay');
  await assertDirectFailureEvidence(page, 'simulation failure evidence');
  await requireVisible(page, '[data-testid="ide-verify-results-summary-open-fail"]', 'failure primary action');
  await requireVisible(page, '[data-testid="ide-verify-fail-nav-summary"]', 'first mismatch summary');
  const failNav = await text(page.locator('[data-testid="ide-verify-fail-nav-summary"]'));
  assert(/expected/i.test(failNav) && /got/i.test(failNav), `first mismatch summary must show expected and observed values, got "${failNav}"`);
  await page.getByTestId('ide-verify-details').click();
  await assertWorkbenchGeometry(page, 'simulation-fail-replay');
  await capture(page, '03-simulation-fail-first-mismatch.png');

  await selectStudioMode(page, 'checks');
  await clickExpectedCellToValue(page, target, target.value);
  assert(await setVerifyRunMode(page, 'compare'), 'authored checks must remain active after expected-output repair');
  status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyPass(status), `repaired expected output should PASS unified simulation, got "${status}"`);
  await selectStudioMode(page, 'replay');
  await requireVisible(page, '[data-testid="ide-run-check-result"]', 'repaired simulation result summary');
  const repairedResultKind = await page.locator('[data-testid="ide-run-check-result"]').first().getAttribute('data-check-status');
  assert(
    repairedResultKind === 'pass',
    `repaired simulation result summary must report completed browser evidence, got "${repairedResultKind}"`,
  );
  await assertWorkbenchGeometry(page, 'repair-pass-replay');
  await capture(page, '04-repaired-simulation-pass-evidence-workbench.png');
});

async function assertDirectFailureEvidence(page, label) {
  const details = page.getByTestId('ide-verify-details');
  if (await details.getAttribute('aria-pressed') !== 'true') await details.click();
  await page.getByTestId('ide-verify-analysis-tab-nav').getByRole('button', { name: 'Checks', exact: true }).click();
  const repairPanel = page.locator('[data-testid="ide-verify-repair-panel"]').first();
  const repairDecision = page.locator('[data-testid="ide-verify-repair-decision"]').first();
  const failedCase = page.locator('[data-testid="ide-verify-results-summary-open-fail"]').first();

  await repairPanel.waitFor({ state: 'visible', timeout: 10000 });
  assert(await repairDecision.isVisible().catch(() => false), `${label}: direct repair decision must be visible`);
  assert(
    /expected output wrong.*circuit wrong/i.test(await text(repairDecision)),
    `${label}: direct repair decision must distinguish expected-output repair from circuit repair`
  );
  assert(
    (await page.locator('details[data-testid="ide-verify-advanced-failure"], [data-testid="ide-verify-advanced-failure"] > summary').count()) === 0,
    `${label}: retired Failure details summary disclosure must be absent`
  );

  await failedCase.click();
  assert(
    await page.locator('[data-testid="ide-verify-fail-nav-summary"]').first().isVisible().catch(() => false),
    `${label}: direct failed-case evidence action must keep the selected mismatch visible`
  );
}
