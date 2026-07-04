#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';
import {
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
  'manual-browser-product-steward',
  'gate',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const VIEWPORT = { label: '1366x768', width: 1366, height: 768 };

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE manual browser product steward proof satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);
  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height });

  const record = {
    gate: 'ide-manual-browser-product-steward',
    generatedAtIso: new Date().toISOString(),
    viewport: VIEWPORT.label,
    phases: [],
    browserProblems,
  };

  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=manual-browser-product-steward`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, 'manual browser steward project startup');

  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  record.phases.push({ phase: 'half-adder-loaded' });

  await openMode(page, baseUrl, 'verify', 'manual-browser-product-steward');
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 15000 });
  await assertBuildHash(page, 'manual browser steward verify');

  const concreteCells = await readConcreteExpectedCells(page);
  assert(concreteCells.length >= 4, `Half Adder Verify should expose saved expected-output cells, got ${JSON.stringify(concreteCells)}`);
  for (const cell of concreteCells) {
    assert(
      cell.visibleText === String(cell.titleValue),
      `expected cell ${cell.testId} must visibly render ${cell.titleValue}, got "${cell.visibleText}"`,
    );
  }
  await capture(page, '01-expected-cells-visible.png');
  record.phases.push({ phase: 'expected-cells-visible', checkedCells: concreteCells.length });

  assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must be selectable before manual steward PASS');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const passStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]').first());
  assert(isVerifyPass(passStatus), `Half Adder should reach Compare PASS before induced fail, got "${passStatus}"`);

  const target = concreteCells[0];
  await flipExpectedCell(page, target.fieldId, target.tick);
  const staleStatus = await waitForPrimaryStatusText(page);
  assert(
    /Circuit or checks changed|Checks changed|expected-output checks|Rerun Compare/i.test(staleStatus),
    `stale copy must name checks or circuit/check ambiguity, got "${staleStatus}"`,
  );
  assert(!/Design changed/i.test(staleStatus), `stale expected-output edit must not be framed only as Design changed: "${staleStatus}"`);
  await capture(page, '02-expected-edit-stale-copy.png');

  await runStaleCompare(page);
  const failStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]').first());
  assert(isVerifyFail(failStatus), `flipped expected output should reach Compare FAIL, got "${failStatus}"`);
  await assertRepairButtonLabels(page);
  await capture(page, '03-fail-repair-labels.png');
  record.phases.push({ phase: 'fail-repair-labels' });

  await page.getByTestId('ide-verify-repair-open-design').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-debug-context-resume-editing"]', { timeout: 10000 });
  const designDebugBefore = await readDesignDebugState(page);
  assert(designDebugBefore.resumeCount === 1, `Design must expose Resume editing, got ${JSON.stringify(designDebugBefore)}`);
  assert(designDebugBefore.hasCompareFailed, `Design should show the failure context before resume, got ${JSON.stringify(designDebugBefore)}`);
  await capture(page, '04-design-failure-resume-action.png');

  await page.getByTestId('ide-design-debug-context-resume-editing').click();
  await page.waitForFunction(
    () => {
      const bodyText = document.body.textContent ?? '';
      const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
      return (
        !bodyText.includes('Compare failed') &&
        !bodyText.includes('Verify focus') &&
        !bodyText.includes('Verify-linked') &&
        !bodyText.includes('Replay') &&
        !document.querySelector('[data-testid="ide-design-debug-context-resume-editing"]') &&
        canvas?.getAttribute('data-tool-mode') === 'select'
      );
    },
    { timeout: 10000 },
  );
  const designDebugAfter = await readDesignDebugState(page);
  assert(!designDebugAfter.hasCompareFailed, `Resume editing must clear Compare failed copy: ${JSON.stringify(designDebugAfter)}`);
  assert(!designDebugAfter.hasVerifyFocus, `Resume editing must clear Verify focus: ${JSON.stringify(designDebugAfter)}`);
  assert(!designDebugAfter.hasVerifyLinked, `Resume editing must clear Verify-linked command state: ${JSON.stringify(designDebugAfter)}`);
  assert(!designDebugAfter.hasReplay, `Resume editing must clear Replay state: ${JSON.stringify(designDebugAfter)}`);
  assert(designDebugAfter.canvasToolMode === 'select', `Resume editing must leave canvas in select mode: ${JSON.stringify(designDebugAfter)}`);
  await capture(page, '05-design-resumed-editing.png');
  record.phases.push({ phase: 'design-resume-editing', designDebugAfter });

  await assertNoRootOverflow(page, 'manual browser steward final design');
  await writeFile(path.join(ARTIFACT_ROOT, 'manual-browser-product-steward.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function runStaleCompare(page) {
  const staleCompare = page.getByTestId('ide-verify-stale-keep-reference').first();
  if (await staleCompare.isVisible().catch(() => false)) {
    await staleCompare.click();
  } else {
    assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must be selectable after expected-output edit');
    await clickVerifyRun(page);
  }
  await waitForVerifyResult(page, { timeout: 20000 });
}

async function assertRepairButtonLabels(page) {
  const expected = [
    ['ide-verify-repair-use-observed', 'Use observed cell'],
    ['ide-verify-repair-use-observed-row', 'Use observed row'],
    ['ide-verify-repair-use-observed-all', 'Use all observed'],
    ['ide-verify-repair-open-design', 'Inspect Design'],
  ];

  for (const [testId, expectedText] of expected) {
    const locator = page.getByTestId(testId).first();
    assert(await locator.isVisible().catch(() => false), `${testId} must be visible`);
    const actualText = await text(locator);
    assert(actualText === expectedText, `${testId} must read "${expectedText}", got "${actualText}"`);
  }
}

async function waitForPrimaryStatusText(page) {
  await page.waitForFunction(
    () => {
      const status = document.querySelector('[data-testid="ide-verify-primary-status"]');
      return Boolean(status && /changed|rerun|Compare/i.test(status.textContent ?? ''));
    },
    { timeout: 10000 },
  );
  return text(page.locator('[data-testid="ide-verify-primary-status"]').first());
}

async function readConcreteExpectedCells(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]'))
      .map((cell) => {
        const testId = cell.getAttribute('data-testid') ?? '';
        const title = cell.getAttribute('title') ?? '';
        const match = /^ide-stimulus-expected-(.+)-t(\d+)$/.exec(testId);
        const titleValue = /:\s*1\s*-\s*drag/i.test(title) ? 1 : /:\s*0\s*-\s*drag/i.test(title) ? 0 : null;
        const valueNode = cell.querySelector('.ide-stimulus-cell__value');
        return {
          testId,
          fieldId: match?.[1] ?? '',
          tick: Number(match?.[2] ?? Number.NaN),
          titleValue,
          visibleText: (valueNode?.textContent ?? '').trim(),
        };
      })
      .filter((cell) => cell.fieldId && Number.isFinite(cell.tick) && (cell.titleValue === 0 || cell.titleValue === 1)),
  );
}

async function flipExpectedCell(page, fieldId, tick) {
  const testId = `ide-stimulus-expected-${fieldId}-t${tick}`;
  const before = await readCellValue(page, testId);
  assert(before === 0 || before === 1, `expected ${testId} to have a saved value before flip, got ${before}`);
  const cell = page.getByTestId(testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readCellValue(page, testId);
    if (current !== before && (current === 0 || current === 1)) return;
    await cell.click();
    await page.waitForTimeout(100);
  }
  const after = await readCellValue(page, testId);
  assert(after !== before && (after === 0 || after === 1), `expected ${testId} to flip from ${before}, got ${after}`);
}

async function readCellValue(page, testId) {
  const title = await page.getByTestId(testId).first().getAttribute('title').catch(() => '');
  if (/:\s*1\s*-\s*drag/i.test(title ?? '')) return 1;
  if (/:\s*0\s*-\s*drag/i.test(title ?? '')) return 0;
  return null;
}

async function readDesignDebugState(page) {
  return page.evaluate(() => {
    const bodyText = document.body.textContent ?? '';
    return {
      resumeCount: document.querySelectorAll('[data-testid="ide-design-debug-context-resume-editing"]').length,
      hasCompareFailed: bodyText.includes('Compare failed'),
      hasVerifyFocus: bodyText.includes('Verify focus'),
      hasVerifyLinked: bodyText.includes('Verify-linked'),
      hasReplay: bodyText.includes('Replay'),
      canvasToolMode: document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-tool-mode') ?? null,
    };
  });
}

async function capture(page, filename) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
