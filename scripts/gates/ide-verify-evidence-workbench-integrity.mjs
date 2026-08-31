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

function parseCellValueFromTitle(title) {
  const value = String(title ?? '');
  if (/:\s*1\s*-\s*drag/i.test(value)) return 1;
  if (/:\s*0\s*-\s*drag/i.test(value)) return 0;
  return null;
}

async function pickRenderedExpectedTarget(page) {
  const cells = await page.locator('[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const testId = element.getAttribute('data-testid') || '';
      const title = element.getAttribute('title') || '';
      const match = /^ide-stimulus-expected-(.+)-t(\d+)$/.exec(testId);
      const parsedTitle = /:\s*(0|1|not set)\s*-\s*drag/i.exec(title);
      return {
        testId,
        signal: match?.[1] ?? '',
        tick: match?.[2] ? Number(match[2]) : -1,
        value: parsedTitle?.[1] === '1' ? 1 : parsedTitle?.[1] === '0' ? 0 : null,
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
  const title = await page.getByTestId(target.testId).first().getAttribute('title');
  return parseCellValueFromTitle(title);
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
  const workspace = await box(page, '[data-testid="ide-verify-workspace"]', `${phase} workspace`);
  const studioMode = await page.locator('[data-testid="ide-verify-lab-grid"]').first().getAttribute('data-studio-mode');
  if (studioMode === 'scenario' || studioMode === 'checks') {
    const stimulus = await box(page, '[data-testid="ide-verify-region-stimulus"]', `${phase} stimulus region`);
    const editor = await box(page, '[data-testid="ide-verify-add-vector-form"]', `${phase} stimulus editor`);
    assert(editor.width >= 320, `${phase} stimulus editor must remain readable (width=${editor.width})`);
    assert(stimulus.width >= Math.min(900, workspace.width * 0.9), `${phase} ${studioMode} must own the authoring workspace (width=${stimulus.width})`);
    assert(!(await isVisible(page, '[data-testid="ide-verify-region-waveform"]')), `${phase} hidden Replay must not compete with ${studioMode}`);
    await assertNoMeaningfulOverlap(
      page,
      [
        { selector: '[data-testid="ide-verify-stimulus-header"]', label: 'stimulus header' },
        { selector: '.ide-verify-run-summary-slot--inline', label: 'testbench summary' },
        { selector: '[data-testid="ide-stimulus-toolbar"]', label: 'stimulus toolbar' },
        { selector: '.ide-stimulus-grid-scroll', label: 'stimulus table' },
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
  const tab = page.locator(`[data-testid="ide-vcb-workspace-${mode}"]`).first();
  assert(await tab.isVisible().catch(() => false), `${mode} workspace tab must be visible`);
  await tab.click();
  await page.waitForFunction(
    (expectedMode) => document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-studio-mode') === expectedMode,
    mode,
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
  await requireVisible(page, '[data-testid="ide-verify-add-vector-form"]', 'first-run stimulus editor');
  await requireVisible(page, '[data-testid="ide-vcb-run-mode"]', 'Simulation Studio workspace selector');
  await requireVisible(page, '[data-testid="ide-vcb-run"]', 'unified Run simulation authority');
  await requireVisible(page, '[data-testid="ide-vcb-workspace-scenario"]', 'Scenario workspace tab');
  await requireVisible(page, '[data-testid="ide-vcb-workspace-checks"]', 'Checks workspace tab');

  const modeCopy = await text(page.locator('[data-testid="ide-vcb-mode-explainer"]'));
  assert(
    /evaluates\s+\d+\s+optional check/i.test(modeCopy),
    `mode explainer must describe automatic optional-check evaluation, got "${modeCopy}"`
  );
  await assertWorkbenchGeometry(page, 'pre-run-scenario');
  await selectStudioMode(page, 'checks');
  await requireVisible(page, '[data-testid^="ide-stimulus-expected-"]', 'first-run expected-output cells');
  const expectedChecksLabel = page.locator('.ide-stimulus-group-header--asserted .ide-stimulus-group-label').first();
  const expectedChecksText = await text(expectedChecksLabel);
  const expectedChecksTitle = (await expectedChecksLabel.getAttribute('title')) ?? '';
  assert(
    await expectedChecksLabel.isVisible().catch(() => false) &&
    expectedChecksText === 'Expected · Unset = no check' &&
      /Expected outputs; (Unset means no check|empty cells are not compared)/i.test(expectedChecksTitle),
    `visible workbench must label saved checks and explain unset cells, got text="${expectedChecksText}" title="${expectedChecksTitle}"`
  );
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
  await requireVisible(page, '[data-testid="ide-verify-results-summary"]', 'simulation result summary');
  const initialResultKind = await page.locator('[data-testid="ide-verify-results-summary"]').first().getAttribute('data-kind');
  assert(
    initialResultKind === 'observe-done' || initialResultKind === 'pass',
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
  await assertWorkbenchGeometry(page, 'simulation-fail-replay');
  await capture(page, '03-simulation-fail-first-mismatch.png');

  await selectStudioMode(page, 'checks');
  await clickExpectedCellToValue(page, target, target.value);
  assert(await setVerifyRunMode(page, 'compare'), 'authored checks must remain active after expected-output repair');
  status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyPass(status), `repaired expected output should PASS unified simulation, got "${status}"`);
  await selectStudioMode(page, 'replay');
  await requireVisible(page, '[data-testid="ide-verify-results-summary"]', 'repaired simulation result summary');
  const repairedResultKind = await page.locator('[data-testid="ide-verify-results-summary"]').first().getAttribute('data-kind');
  assert(
    repairedResultKind === 'observe-done' || repairedResultKind === 'pass',
    `repaired simulation result summary must report completed browser evidence, got "${repairedResultKind}"`,
  );
  await assertWorkbenchGeometry(page, 'repair-pass-replay');
  await capture(page, '04-repaired-simulation-pass-evidence-workbench.png');
});

async function assertDirectFailureEvidence(page, label) {
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
