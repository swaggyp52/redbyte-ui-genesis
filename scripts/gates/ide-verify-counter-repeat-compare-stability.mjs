#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'verify-counter-repeat-compare-stability',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE Verify counter repeat Compare stability satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const records = [];
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      records.push(await runViewportScenario(page, baseUrl, viewport));
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
      await capture(page, viewport, 'failure').catch(() => null);
    }
  }

  await writeFile(
    path.join(ARTIFACT_ROOT, 'verify-counter-repeat-compare-stability.json'),
    JSON.stringify(
      {
        gate: 'ide-verify-counter-repeat-compare-stability',
        generatedAtIso: new Date().toISOString(),
        records,
        browserProblems,
        failures,
      },
      null,
      2,
    ),
  );

  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Counter repeat Compare stability failures:\n${failures.join('\n')}`);
});

async function runViewportScenario(page, baseUrl, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-counter-repeat-compare-stability-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}: startup`);
  await assertNoRootOverflow(page, `${viewport.label}: startup`);

  await loadStarterProject(page, { exactExampleId: 'two-bit-counter' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  const designText = await readText(page.getByTestId('ide-mode-design').first());
  assert(/2-Bit Up Counter \(Basys3\)/i.test(designText), `${viewport.label}: counter starter did not load`);
  assert(/CLK100MHZ/i.test(designText) && /W5/i.test(designText), `${viewport.label}: counter starter must disclose CLK100MHZ / W5`);
  await capture(page, viewport, 'counter-design-loaded');

  await openMode(page, baseUrl, 'verify', `verify-counter-repeat-compare-stability-${viewport.label}`);
  await page.waitForSelector('[data-testid="ide-verify-clock-policy-panel"]', { timeout: 15000 });
  const clockPanelText = await readText(page.getByTestId('ide-verify-clock-policy-panel').first());
  assert(/CLK100MHZ/i.test(clockPanelText), `${viewport.label}: Verify must identify CLK100MHZ`);
  assert(/W5/i.test(clockPanelText), `${viewport.label}: Verify must identify W5`);
  assert(/Auto board clock/i.test(clockPanelText), `${viewport.label}: Verify must use auto board clock`);
  assert(await page.getByTestId('ide-stimulus-clock-row').count() === 0, `${viewport.label}: board clock must not expose an editable stimulus clock row`);

  await ensureVerifyVectorsReady(page);

  const runs = [];
  assert(await setVerifyRunMode(page, 'observe'), `${viewport.label}: Observe mode must be selectable`);
  runs.push(await runAndRequireFreshUi(page, viewport, 'observe-1', { runKind: 'trace' }));

  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must be selectable`);
  runs.push(await runAndRequireFreshUi(page, viewport, 'compare-pass-1', { runKind: 'verify', status: 'pass' }));
  runs.push(await runAndRequireFreshUi(page, viewport, 'compare-pass-2', { runKind: 'verify', status: 'pass' }));
  runs.push(await runAndRequireFreshUi(page, viewport, 'compare-pass-3', { runKind: 'verify', status: 'pass' }));

  const expectedCell = await pickExpectedCell(page, viewport);
  await clickExpectedCellToValue(page, expectedCell, expectedCell.value === 0 ? 1 : 0);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must remain selectable after expected edit`);
  runs.push(await runAndRequireFreshUi(page, viewport, 'compare-intentional-fail', { runKind: 'verify', status: 'fail' }));

  await clickExpectedCellToValue(page, expectedCell, expectedCell.value);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must remain selectable after repair`);
  runs.push(await runAndRequireFreshUi(page, viewport, 'compare-repair-pass', { runKind: 'verify', status: 'pass' }));
  runs.push(await runAndRequireFreshUi(page, viewport, 'compare-post-repair-repeat-pass', { runKind: 'verify', status: 'pass' }));

  await assertNoRootOverflow(page, `${viewport.label}: complete`);
  await capture(page, viewport, 'complete');
  return {
    viewport: viewport.label,
    clockPanel: clockPanelText,
    runs,
    expectedCell,
  };
}

async function runAndRequireFreshUi(page, viewport, label, expectation) {
  const before = await readRunSignature(page);
  await clickVerifyRun(page);
  await page.waitForFunction(
    ({ historyLength, generatedAtIso }) => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      const run = state?.verifyLastRun;
      const nextHistoryLength = state?.verifyRunHistory?.length ?? 0;
      return Boolean(
        run &&
          (nextHistoryLength > historyLength ||
            (typeof run.generatedAtIso === 'string' && run.generatedAtIso !== generatedAtIso))
      );
    },
    {
      historyLength: before.historyLength,
      generatedAtIso: before.generatedAtIso,
    },
    { timeout: 30000 },
  );
  const afterRuntime = await readRunSignature(page);
  assert(afterRuntime.historyLength > before.historyLength, `${viewport.label} ${label}: verify run history did not advance`);
  if (expectation.runKind) {
    assert(afterRuntime.runKind === expectation.runKind, `${viewport.label} ${label}: expected runKind ${expectation.runKind}, got ${afterRuntime.runKind}`);
  }
  if (expectation.status) {
    assert(afterRuntime.status === expectation.status, `${viewport.label} ${label}: expected status ${expectation.status}, got ${afterRuntime.status}`);
  }

  await waitForVerifyUiSettled(page, viewport, label, expectation);
  const afterUi = await readRunSignature(page);
  assert(afterUi.runButtonDisabled === false, `${viewport.label} ${label}: Run button remained disabled after runtime completed`);
  assert(!/running/i.test(afterUi.summaryText), `${viewport.label} ${label}: summary still reads running: ${afterUi.summaryText}`);
  assert(!/running/i.test(afterUi.runStateText), `${viewport.label} ${label}: run-state text still reads running: ${afterUi.runStateText}`);
  if (expectation.status === 'pass') {
    assert(/checks aligned|pass/i.test(afterUi.summaryText), `${viewport.label} ${label}: UI did not show PASS/Checks aligned, got ${afterUi.summaryText}`);
  }
  if (expectation.status === 'fail') {
    assert(/checks need review|fail/i.test(afterUi.summaryText), `${viewport.label} ${label}: UI did not show FAIL/Checks need review, got ${afterUi.summaryText}`);
  }
  await capture(page, viewport, label);
  return afterUi;
}

async function waitForVerifyUiSettled(page, viewport, label) {
  await page.waitForFunction(
    () => {
      const rootText = document.querySelector('[data-testid="ide-mode-verify"]')?.textContent ?? '';
      const summaryText = document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? '';
      const runStateText = document.querySelector('[data-testid="ide-verify-run-state"]')?.textContent ?? '';
      const runButton = document.querySelector('[data-testid="ide-vcb-run"]');
      const runDisabled = runButton instanceof HTMLButtonElement ? runButton.disabled : true;
      const looksRunning =
        /RUNNING/i.test(runStateText) ||
        /Running\s*Compare checks/i.test(rootText) ||
        /Verifying the current circuit/i.test(rootText) ||
        /Running/i.test(summaryText);
      return !looksRunning && !runDisabled;
    },
    { timeout: 8000 },
  ).catch(async () => {
    const signature = await readRunSignature(page);
    throw new Error(`${viewport.label} ${label}: Verify UI did not leave Running after fresh runtime completion: ${JSON.stringify(signature)}`);
  });
}

async function readRunSignature(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const run = state?.verifyLastRun;
    const summaryText = document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? '';
    const evidenceText = document.querySelector('[data-testid="ide-vcb-evidence"]')?.textContent ?? '';
    const coverageText = document.querySelector('[data-testid="ide-vcb-coverage"]')?.textContent ?? '';
    const runStateText = document.querySelector('[data-testid="ide-verify-run-state"]')?.textContent ?? '';
    const runButton = document.querySelector('[data-testid="ide-vcb-run"]');
    return {
      projectName: state?.projectName ?? null,
      historyLength: state?.verifyRunHistory?.length ?? 0,
      runKind: run?.runKind ?? null,
      status: run?.status ?? null,
      qualification: run?.qualification ?? null,
      reportHash: run?.reportHash ?? null,
      generatedAtIso: run?.generatedAtIso ?? null,
      schedule: run?.schedule ?? null,
      clockPolicy: run?.clockPolicy ?? null,
      reportRows: run?.report?.rows?.length ?? 0,
      reportVectors: run?.report?.vectors?.length ?? 0,
      waveformSamples: run?.waveform?.length ?? 0,
      summaryText: summaryText.replace(/\s+/g, ' ').trim(),
      evidenceText: evidenceText.replace(/\s+/g, ' ').trim(),
      coverageText: coverageText.replace(/\s+/g, ' ').trim(),
      runStateText: runStateText.replace(/\s+/g, ' ').trim(),
      runButtonDisabled: runButton instanceof HTMLButtonElement ? runButton.disabled : null,
      runButtonText: (runButton?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  });
}

async function pickExpectedCell(page, viewport) {
  const cells = await page.locator('[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const testId = element.getAttribute('data-testid') ?? '';
      const title = element.getAttribute('title') ?? '';
      const parsedTitle = /:\s*(0|1|not set)\s*-\s*drag/i.exec(title);
      return {
        testId,
        value: parsedTitle?.[1] === '1' ? 1 : parsedTitle?.[1] === '0' ? 0 : null,
      };
    }),
  );
  const target = cells.find((cell) => cell.value === 0) ?? cells.find((cell) => cell.value === 1) ?? null;
  assert(target, `${viewport.label}: expected at least one saved counter expected-output cell, got ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

async function clickExpectedCellToValue(page, target, expectedValue) {
  const cell = page.getByTestId(target.testId).first();
  assert(await visible(cell), `expected-output cell ${target.testId} must be visible`);
  await cell.scrollIntoViewIfNeeded().catch(() => null);
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

async function readText(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

async function capture(page, viewport, slug) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${safeName(viewport.label)}-${slug}.png`),
    fullPage: true,
  }).catch(() => null);
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, '-');
}
