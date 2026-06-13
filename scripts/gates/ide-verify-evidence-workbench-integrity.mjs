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
  const stimulus = await box(page, '[data-testid="ide-verify-region-stimulus"]', `${phase} stimulus region`);
  const waveform = await box(page, '[data-testid="ide-verify-region-waveform"]', `${phase} waveform region`);
  const waveformPreview = await box(page, '[data-testid="ide-verify-waveform-preview"], [data-testid="ide-verify-waveform-placeholder"]', `${phase} waveform preview`);
  const editor = await box(page, '[data-testid="ide-verify-add-vector-form"]', `${phase} stimulus editor`);

  assert(editor.width >= 320, `${phase} stimulus editor must remain readable (width=${editor.width})`);
  assert(stimulus.width >= 340, `${phase} stimulus evidence pane must keep real width (width=${stimulus.width})`);
  assert(waveform.width >= 420, `${phase} waveform evidence pane must keep real width (width=${waveform.width})`);
  assert(waveformPreview.height >= 190, `${phase} waveform preview must keep usable height (height=${waveformPreview.height})`);
  assert(
    stimulus.x < waveform.x || stimulus.y < waveform.y,
    `${phase} stimulus and waveform panes must not occupy the same visual slot`
  );
  assert(
    workspace.width >= stimulus.width && workspace.width >= waveform.width,
    `${phase} workspace must contain measurable evidence regions`
  );
  await assertNoMeaningfulOverlap(
    page,
    [
      { selector: '[data-testid="ide-verify-stimulus-header"]', label: 'stimulus header' },
      { selector: '.ide-verify-run-summary-slot--inline', label: 'testbench summary' },
      { selector: '[data-testid="ide-stimulus-toolbar"]', label: 'stimulus toolbar' },
      { selector: '.ide-stimulus-grid-scroll', label: 'stimulus table' },
    ],
    `${phase} stimulus evidence stack`
  );
  await assertNoMeaningfulOverlap(
    page,
    [
      { selector: '[data-testid="ide-verify-scope-header"]', label: 'scope header' },
      { selector: '[data-testid="ide-verify-waveform-bar"]', label: 'waveform transport bar' },
      { selector: '[data-testid="ide-verify-waveform-preview"], [data-testid="ide-verify-waveform-placeholder"]', label: 'waveform preview' },
    ],
    `${phase} waveform stack`
  );
  await assertNoMeaningfulOverlap(
    page,
    [
      { selector: '[data-testid="ide-verify-fail-nav"]', label: 'first mismatch navigation' },
      { selector: '[data-testid="ide-verify-waveform-transport"]', label: 'tick controls' },
    ],
    `${phase} waveform controls`
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
  await requireVisible(page, '[data-testid^="ide-stimulus-expected-"]', 'first-run expected-output cells');
  await requireVisible(page, '[data-testid="ide-vcb-run-mode"]', 'Observe/Compare selector');
  await requireVisible(page, '[data-testid="ide-verify-waveform-placeholder"]', 'pre-run waveform evidence placeholder');

  const modeCopy = await text(page.locator('[data-testid="ide-vcb-mode-explainer"]'));
  assert(
    /observed outputs|expected outputs|comparison/i.test(modeCopy),
    `mode explainer must describe Observe versus Compare, got "${modeCopy}"`
  );
  assert(
    await page.getByText('Expected outputs').first().isVisible().catch(() => false),
    'visible workbench must label saved checks as Expected outputs'
  );
  assert(
    !(await isVisible(page, '[data-testid="ide-verify-first-run-collapsed-strip"]')),
    'ready starter vectors must not hide the first-run editor behind a collapsed strip'
  );
  await assertWorkbenchGeometry(page, 'pre-run');
  await capture(page, '01-first-run-editor-visible.png');

  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must be selectable for the starter checks');
  let status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyPass(status), `initial Compare should PASS, got "${status}"`);
  await requireVisible(page, '[data-testid="ide-verify-pass-hero"]', 'Compare PASS hero');
  await requireVisible(page, '[data-testid="ide-verify-waveform-svg"]', 'post-run waveform lanes');
  await assertWorkbenchGeometry(page, 'compare-pass');
  await capture(page, '02-compare-pass-evidence-workbench.png');

  const target = await pickRenderedExpectedTarget(page);
  const wrongValue = target.value === 0 ? 1 : 0;
  await clickExpectedCellToValue(page, target, wrongValue);
  await page.waitForFunction(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectHealthCore?.dirtySinceVerify === true,
    { timeout: 5000 }
  );

  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must remain selectable after expected-output edit');
  status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyFail(status), `edited expected output should FAIL Compare, got "${status}"`);
  await requireVisible(page, '[data-testid="ide-verify-results-summary-open-fail"]', 'failure primary action');
  await requireVisible(page, '[data-testid="ide-verify-fail-nav-summary"]', 'first mismatch summary');
  const failNav = await text(page.locator('[data-testid="ide-verify-fail-nav-summary"]'));
  assert(/expected/i.test(failNav) && /got/i.test(failNav), `first mismatch summary must show expected and observed values, got "${failNav}"`);
  await assertWorkbenchGeometry(page, 'compare-fail');
  await capture(page, '03-compare-fail-first-mismatch.png');

  await clickExpectedCellToValue(page, target, target.value);
  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must remain selectable after expected-output repair');
  status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyPass(status), `repaired expected output should PASS Compare, got "${status}"`);
  await requireVisible(page, '[data-testid="ide-verify-pass-hero"]', 'repaired Compare PASS hero');
  await assertWorkbenchGeometry(page, 'repair-pass');
  await capture(page, '04-repaired-compare-pass-evidence-workbench.png');
});
