#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();

const VIEWPORTS = [
  {
    label: '1366x768',
    width: 1366,
    height: 768,
    minStimulusWidth: 540,
    minWaveformPreviewVisibleHeight: 320,
    maxWaveformPreviewTopOffset: 270,
  },
  {
    label: '1440x900',
    width: 1440,
    height: 900,
    minStimulusWidth: 560,
    minWaveformPreviewVisibleHeight: 440,
    maxWaveformPreviewTopOffset: 270,
  },
];

const SCREENSHOT_ROOT = process.env.RB_VERIFY_POSTRUN_WORKBENCH_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_POSTRUN_WORKBENCH_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Verify post-run workbench remains usable', async ({ page, baseUrl }) => {
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
      await openLogicGatesVerify(page, baseUrl, viewport.label);
      await ensureVerifyVectorsReady(page);
      assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare checks must be selectable`);

      let status = await clickRunAndWaitForNewResult(page);
      assert(isVerifyPass(status), `${viewport.label}: initial Compare should PASS, got "${status}"`);
      await capture(page, viewport, '01-compare-pass');
      await assertPostRunWorkbench(page, viewport, 'PASS');

      await assertPostRunToggleKeepsWorkbenchAccessible(page, viewport);

      const target = await pickRenderedExpectedTarget(page);
      const wrongValue = target.value === 0 ? 1 : 0;
      await clickExpectedCellToValue(page, target, wrongValue);
      await assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare checks must remain selectable after edit`);

      status = await clickRunAndWaitForNewResult(page);
      assert(isVerifyFail(status), `${viewport.label}: wrong expected output should FAIL, got "${status}"`);
      await capture(page, viewport, '02-compare-fail');
      await assertPostRunWorkbench(page, viewport, 'FAIL');

      await clickExpectedCellToValue(page, target, target.value);
      await assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare checks must remain selectable after repair`);
      status = await clickRunAndWaitForNewResult(page);
      assert(isVerifyPass(status), `${viewport.label}: repaired expected output should PASS, got "${status}"`);
      await capture(page, viewport, '03-repair-pass');
      await assertPostRunWorkbench(page, viewport, 'REPAIR PASS');
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(findings.length === 0, `Verify post-run workbench emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
  assert(failures.length === 0, `Verify post-run workbench failures:\n${failures.join('\n')}`);
});

async function openLogicGatesVerify(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-postrun-workbench-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
}

async function assertPostRunWorkbench(page, viewport, label) {
  const metrics = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    };
    const visibleHeight = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return 0;
      const rect = element.getBoundingClientRect();
      return Math.round(Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)));
    };
    const root = document.querySelector('[data-testid="ide-root"]');
    const labGrid = document.querySelector('[data-testid="ide-verify-lab-grid"]');
    const gridScroll = document.querySelector('.ide-stimulus-grid-scroll');
    const waveform = box('[data-testid="ide-verify-region-waveform"]');
    const waveformPreview = box('[data-testid="ide-verify-waveform-preview"]');
    const statusText = document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent?.trim() ?? '';
    return {
      buildHash: document.querySelector('[data-testid="ide-root"]')?.getAttribute('data-build-sha')?.trim() ?? '',
      viewportHeight: window.innerHeight,
      rootOverflowX: root ? Math.max(0, root.scrollWidth - root.clientWidth) : 0,
      documentOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      workspaceMode: labGrid?.getAttribute('data-workspace-mode') ?? '',
      phase: labGrid?.getAttribute('data-verify-workflow-phase') ?? '',
      stimulusLayout: labGrid?.getAttribute('data-stimulus-layout') ?? '',
      labGrid: box('[data-testid="ide-verify-lab-grid"]'),
      stimulus: box('[data-testid="ide-verify-region-stimulus"]'),
      waveform,
      waveformPreview,
      waveformPreviewVisibleHeight: visibleHeight('[data-testid="ide-verify-waveform-preview"]'),
      waveformPreviewTopOffset:
        waveform && waveformPreview ? Math.max(0, Math.round(waveformPreview.y - waveform.y)) : null,
      workbenchBody: box('[data-testid="ide-verify-workbench-body"]'),
      gridScroll: gridScroll
        ? {
            ...box('.ide-stimulus-grid-scroll'),
            extraX: Math.max(0, gridScroll.scrollWidth - gridScroll.clientWidth),
            extraY: Math.max(0, gridScroll.scrollHeight - gridScroll.clientHeight),
          }
        : null,
      expectedCells: document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]').length,
      runVisible: Boolean(document.querySelector('[data-testid="ide-vcb-run"]')),
      firstFailingVisible: Boolean(document.querySelector('[data-testid="ide-verify-results-summary-open-fail"]')),
      statusText,
    };
  });

  assert(metrics.buildHash === CURRENT_SHA, `${viewport.label}/${label}: root build hash ${metrics.buildHash || 'missing'} != ${CURRENT_SHA}`);
  assert(metrics.rootOverflowX <= 1 && metrics.documentOverflowX <= 1, `${viewport.label}/${label}: root/document overflow ${JSON.stringify(metrics)}`);
  assert(metrics.phase === 'post-run', `${viewport.label}/${label}: expected post-run phase, got "${metrics.phase}"`);
  assert(metrics.workspaceMode === 'split', `${viewport.label}/${label}: expected split workspace, got "${metrics.workspaceMode}"`);
  assert(metrics.stimulusLayout === 'expanded', `${viewport.label}/${label}: expected expanded stimulus layout, got "${metrics.stimulusLayout}"`);
  assert(metrics.stimulus && metrics.waveform && metrics.labGrid, `${viewport.label}/${label}: missing Verify workbench regions ${JSON.stringify(metrics)}`);
  assert(
    metrics.stimulus.width >= viewport.minStimulusWidth,
    `${viewport.label}/${label}: post-run testbench lane too narrow (${metrics.stimulus.width}px < ${viewport.minStimulusWidth}px)`
  );
  assert(
    metrics.stimulus.width / metrics.labGrid.width >= 0.46,
    `${viewport.label}/${label}: post-run testbench must own a usable share (${metrics.stimulus.width}/${metrics.labGrid.width})`
  );
  assert(metrics.waveform.width >= 500, `${viewport.label}/${label}: waveform lane must remain usable (${metrics.waveform.width}px)`);
  assert(metrics.workbenchBody?.width >= viewport.minStimulusWidth - 24, `${viewport.label}/${label}: workbench body too narrow ${JSON.stringify(metrics.workbenchBody)}`);
  assert(metrics.gridScroll?.width >= viewport.minStimulusWidth - 52, `${viewport.label}/${label}: stimulus grid too narrow ${JSON.stringify(metrics.gridScroll)}`);
  assert(metrics.gridScroll?.extraX <= 8, `${viewport.label}/${label}: post-run testbench should not create a horizontal mini-scroll trap ${JSON.stringify(metrics.gridScroll)}`);
  assert(metrics.expectedCells >= 12, `${viewport.label}/${label}: expected starter checks to remain visible/editable (${metrics.expectedCells})`);
  assert(metrics.runVisible, `${viewport.label}/${label}: Run/Update Compare action must remain visible`);
  assert(metrics.waveformPreview, `${viewport.label}/${label}: missing waveform evidence preview ${JSON.stringify(metrics)}`);
  assert(
    metrics.waveformPreviewTopOffset <= viewport.maxWaveformPreviewTopOffset,
    `${viewport.label}/${label}: waveform evidence starts too low (${metrics.waveformPreviewTopOffset}px > ${viewport.maxWaveformPreviewTopOffset}px) ${JSON.stringify(metrics.waveformPreview)}`
  );
  assert(
    metrics.waveformPreviewVisibleHeight >= viewport.minWaveformPreviewVisibleHeight,
    `${viewport.label}/${label}: too little waveform evidence is visible (${metrics.waveformPreviewVisibleHeight}px < ${viewport.minWaveformPreviewVisibleHeight}px) ${JSON.stringify(metrics.waveformPreview)}`
  );
  if (/need/i.test(metrics.statusText)) {
    assert(metrics.firstFailingVisible, `${viewport.label}/${label}: FAIL state should expose Open first failing check`);
  }
}

async function assertPostRunToggleKeepsWorkbenchAccessible(page, viewport) {
  const toggle = page.locator('[data-testid="ide-verify-workbench-toggle"]').first();
  assert(await toggle.isVisible().catch(() => false), `${viewport.label}: workbench toggle must be visible`);
  await toggle.click();
  await page.waitForSelector('[data-testid="ide-verify-workbench-body"]', { timeout: 5000 });
  assert(
    !(await page.locator('[data-testid="ide-verify-workbench-collapsed-strip"]').isVisible().catch(() => false)),
    `${viewport.label}: post-run workbench must stay expanded instead of hiding the editable checks`
  );
  await assertPostRunWorkbench(page, viewport, 'TOGGLE');
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
  return ((await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')) ?? '').trim();
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
  assert(target, `expected at least one rendered expected-output cell with a saved 0/1 value, saw ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

function parseCellValueFromTitle(title) {
  const value = String(title ?? '');
  if (/:\s*1\s*-\s*drag/i.test(value)) return 1;
  if (/:\s*0\s*-\s*drag/i.test(value)) return 0;
  return null;
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

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `verify-postrun-workbench-${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
