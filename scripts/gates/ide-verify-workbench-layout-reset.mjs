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

const SCREENSHOT_ROOT = process.env.RB_VERIFY_LAYOUT_RESET_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_LAYOUT_RESET_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Verify layout resets across pre-run, pass, fail, and repair', async ({ page, baseUrl }) => {
  const findings = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      findings.push({ type: message.type(), text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    findings.push({ type: 'pageerror', text: error.message });
  });

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-workbench-layout-reset`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await ensureVerifyVectorsReady(page);

  let layout = await readLayoutState(page);
  assert(layout.phase === 'pre-run', `before Run phase must be pre-run, got ${JSON.stringify(layout)}`);
  assert(layout.workspaceMode === 'stimulus-focus', `before Run layout must focus stimulus, got ${JSON.stringify(layout)}`);
  assert(layout.gridExtraX <= 8, `before Run testbench must avoid horizontal mini-scroll, got ${JSON.stringify(layout)}`);
  await capture(page, '01-prerun');

  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must be selectable for starter checks');
  let status = await runAndReadStatus(page);
  assert(isVerifyPass(status), `first Compare run should PASS, got "${status}"`);
  await page.waitForSelector('[data-testid="ide-verify-waveform-svg"]', { timeout: 10000 });
  await capture(page, '02-compare-pass');

  layout = await readLayoutState(page);
  assert(layout.phase === 'post-run', `after PASS phase must be post-run, got ${JSON.stringify(layout)}`);
  assert(layout.waveform.width >= 520, `after PASS waveform evidence must remain usable, got ${JSON.stringify(layout)}`);
  assert(layout.stimulus.width >= 360, `after PASS repair/editor lane must remain usable, got ${JSON.stringify(layout)}`);
  assert(layout.expectedCells >= 12, `after PASS expected-output cells must remain editable, got ${layout.expectedCells}`);

  const target = await pickExpectedCell(page);
  await clickExpectedCellToValue(page, target, target.value === 0 ? 1 : 0);
  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must remain selectable after expected edit');
  status = await runAndReadStatus(page);
  assert(isVerifyFail(status), `edited expected output should FAIL Compare, got "${status}"`);
  await page.waitForSelector('[data-testid="ide-verify-results-summary-open-fail"]', { timeout: 10000 });
  await capture(page, '03-compare-fail');

  layout = await readLayoutState(page);
  assert(layout.phase === 'post-run', `after FAIL phase must remain post-run, got ${JSON.stringify(layout)}`);
  assert(layout.waveform.width >= 520, `after FAIL waveform evidence must remain first-order, got ${JSON.stringify(layout)}`);
  assert(layout.expectedCells >= 12, `after FAIL expected-output repair cells must remain visible, got ${layout.expectedCells}`);
  assert(layout.gridExtraX <= 8, `after FAIL repair table must avoid horizontal mini-scroll, got ${JSON.stringify(layout)}`);

  await clickExpectedCellToValue(page, target, target.value);
  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must remain selectable after repair');
  status = await runAndReadStatus(page);
  assert(isVerifyPass(status), `repaired expected output should PASS Compare, got "${status}"`);
  await capture(page, '04-repair-pass');

  assert(findings.length === 0, `Verify layout reset emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
});

async function readLayoutState(page) {
  return page.evaluate(() => {
    function box(selector) {
      const element = document.querySelector(selector);
      if (!element) return { width: 0, height: 0, clientWidth: 0, scrollWidth: 0 };
      const rect = element.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      };
    }

    const labGrid = document.querySelector('[data-testid="ide-verify-lab-grid"]');
    const grid = box('.ide-stimulus-grid-scroll');
    const root = document.querySelector('[data-testid="ide-root"]');
    return {
      phase: labGrid?.getAttribute('data-verify-workflow-phase') ?? '',
      workspaceMode: labGrid?.getAttribute('data-workspace-mode') ?? '',
      stimulus: box('[data-testid="ide-verify-region-stimulus"]'),
      waveform: box('[data-testid="ide-verify-region-waveform"]'),
      gridExtraX: Math.max(0, grid.scrollWidth - grid.clientWidth),
      expectedCells: document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]').length,
      rootOverflowX: root ? Math.max(0, root.scrollWidth - root.clientWidth) : 0,
    };
  });
}

async function runAndReadStatus(page) {
  const previousHash = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null
  );
  await clickVerifyRun(page);
  await page.waitForFunction(
    (previous) => {
      const nextHash = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null;
      return Boolean(nextHash && nextHash !== previous);
    },
    previousHash,
    { timeout: 20000 }
  );
  await waitForVerifyResult(page, { timeout: 10000 });
  return normalizedText(page.locator('[data-testid="ide-verify-summary-status"]').first());
}

async function pickExpectedCell(page) {
  const cells = await page.locator('[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const testId = element.getAttribute('data-testid') ?? '';
      const title = element.getAttribute('title') ?? '';
      const parsedTitle = /:\s*(0|1|not set)\s*-\s*drag/i.exec(title);
      return {
        testId,
        value: parsedTitle?.[1] === '1' ? 1 : parsedTitle?.[1] === '0' ? 0 : null,
      };
    })
  );
  const target = cells.find((cell) => cell.value === 0) ?? cells.find((cell) => cell.value === 1) ?? null;
  assert(target, `expected at least one saved expected-output cell, got ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

async function clickExpectedCellToValue(page, target, expectedValue) {
  const cell = page.getByTestId(target.testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readExpectedCellValue(page, target.testId);
    if (current === expectedValue) return;
    await cell.click();
    await page.waitForTimeout(120);
  }
  const current = await readExpectedCellValue(page, target.testId);
  assert(current === expectedValue, `expected ${target.testId} to become ${expectedValue}, got ${current}`);
}

async function readExpectedCellValue(page, testId) {
  const title = await page.getByTestId(testId).first().getAttribute('title');
  if (/:\s*1\s*-\s*drag/i.test(title ?? '')) return 1;
  if (/:\s*0\s*-\s*drag/i.test(title ?? '')) return 0;
  return null;
}

async function capture(page, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `verify-workbench-layout-reset-${name}.png`),
    fullPage: false,
  });
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
