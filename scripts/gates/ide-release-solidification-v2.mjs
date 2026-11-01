#!/usr/bin/env node

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
  openLogicGatesStarter,
  openMode,
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

// The persistent status band may consume up to 52px below the post-run evidence grid.
const MAX_FAIL_EVIDENCE_BOTTOM_GAP = 52;

await runIdeGate('IDE release solidification v2 satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    // A first-launch proof needs a fresh storage partition, including IndexedDB.
    const context = await page.context().browser().newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const freshPage = await context.newPage();
    const viewportProblems = captureBrowserProblems(freshPage);
    try {
      await assertProjectFirstLaunchOrientation(freshPage, baseUrl, viewport);
      await assertVerifyResultActions(freshPage, baseUrl, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      browserProblems.push(...viewportProblems);
      await context.close();
    }
  }

  assert(browserProblems.length === 0, `Release solidification v2 browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Release solidification v2 failures:\n${failures.join('\n')}`);
});

async function assertProjectFirstLaunchOrientation(page, baseUrl, viewport) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage can be unavailable on intermediate browser documents.
    }
  });

  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=release-solidification-v2-project-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project first launch`);

  const orientation = page.locator('[data-testid="ide-onboarding-overlay"]').first();
  assert(!(await visible(orientation)), `${viewport.label}: first Project launch must not inject workflow-orientation chrome`);

  const metrics = await page.evaluate(() => {
    function box(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left));
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
      return {
        selector,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visibleWidth: Math.round(visibleWidth),
        visibleHeight: Math.round(visibleHeight),
      };
    }

    const primaryActions = Array.from(
      document.querySelectorAll('[data-testid="ide-project-landing"] [data-product-priority="primary"]')
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });

    return {
      startHub: box('[data-testid="ide-project-landing"]'),
      startPrimary: box('[data-testid="ide-project-start-a-lab-primary"]'),
      starterCatalogCount: document.querySelectorAll('[data-testid="ide-project-open-starter-primary"]').length,
      orientationCount: document.querySelectorAll('[data-testid="ide-onboarding-overlay"]').length,
      primaryActionLabels: primaryActions.map((element) => element.querySelector('span')?.textContent?.trim() ?? ''),
      productSpineCount: Array.from(document.querySelectorAll('[data-testid^="ide-product-spine-"]')).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      }).length,
      rootOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  });

  assert(metrics.startHub?.visibleHeight >= 140, `${viewport.label}: current Project start surface must remain visible ${JSON.stringify(metrics.startHub)}`);
  // Course labs is the 28px section-navigation command; the selected lab has
  // its own launch action in the adjacent preview.
  assert(metrics.startPrimary?.visibleHeight >= 28, `${viewport.label}: Course labs must remain a usable section command ${JSON.stringify(metrics.startPrimary)}`);
  const launch = page.locator('.rb-start-preview .rb-start-primary');
  assert(await visible(launch), `${viewport.label}: selected lab must expose its launch action`);
  const launchBounds = await launch.boundingBox();
  assert(launchBounds?.height >= 24 && launchBounds.y + launchBounds.height < viewport.height - 8, `${viewport.label}: selected lab launch must meet the desktop command floor and fit the first viewport ${JSON.stringify(launchBounds)}`);
  assert(metrics.startPrimary.bottom <= viewport.height - 8, `${viewport.label}: Start a Lab falls below the first viewport ${JSON.stringify(metrics.startPrimary)}`);
  assert(metrics.starterCatalogCount === 1, `${viewport.label}: starter catalog section must remain available`);
  assert(metrics.orientationCount === 0, `${viewport.label}: obsolete workflow-orientation card returned`);
  assert(
    metrics.primaryActionLabels.length === 1 && /^Course labs\b/i.test(metrics.primaryActionLabels[0]),
    `${viewport.label}: Project must expose one primary Course labs section, got ${JSON.stringify(metrics.primaryActionLabels)}`
  );
  assert(metrics.productSpineCount === 0, `${viewport.label}: Project must not restore a duplicate product-spine header`);
  assert(metrics.rootOverflowX <= 1, `${viewport.label}: Project first launch created root overflow ${metrics.rootOverflowX}px`);

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertNoRootOverflow(page, `${viewport.label}/Project first launch starter path`);
}

async function assertVerifyResultActions(page, baseUrl, viewport) {
  await openLogicGatesStarter(page, baseUrl, `release-solidification-v2-verify-${viewport.label}`);
  await openMode(page, baseUrl, 'verify', `release-solidification-v2-verify-${viewport.label}`);
  await runComparePass(page);
  await assertBuildHash(page, `${viewport.label}/Verify compare pass`);
  await assertVerifyActionBand(page, viewport, 'PASS');

  await selectVerifyWorkspace(page, 'checks');
  const target = await pickRenderedExpectedTarget(page);
  const wrongValue = target.value === 0 ? 1 : 0;
  await clickExpectedCellToValue(page, target, wrongValue);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must remain selectable after expected-output edit`);
  let status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyFail(status), `${viewport.label}: edited expected output should fail, got "${status}"`);
  await assertVerifyActionBand(page, viewport, 'FAIL');

  await selectVerifyWorkspace(page, 'checks');
  await clickExpectedCellToValue(page, target, target.value);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must remain selectable after expected-output repair`);
  status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyPass(status), `${viewport.label}: repaired expected output should pass, got "${status}"`);
  await assertVerifyActionBand(page, viewport, 'REPAIR PASS');
}

async function assertVerifyActionBand(page, viewport, label) {
  await selectVerifyWorkspace(page, 'replay');
  if (label === 'FAIL') {
    await page.getByTestId('ide-verify-details').click();
    await page.getByTestId('ide-verify-analysis-tab-nav').getByRole('button', { name: 'Checks', exact: true }).click();
    await page.getByTestId('ide-verify-repair-decision').scrollIntoViewIfNeeded();
  }
  await assertBuildHash(page, `${viewport.label}/Verify ${label}`);
  const metrics = await page.evaluate(() => {
    function box(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left));
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
      return {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visibleWidth: Math.round(visibleWidth),
        visibleHeight: Math.round(visibleHeight),
        extraX: Math.max(0, element.scrollWidth - element.clientWidth),
        extraY: Math.max(0, element.scrollHeight - element.clientHeight),
      };
    }

    const labGrid = document.querySelector('[data-testid="ide-verify-lab-grid"]');
    return {
      phase: labGrid?.getAttribute('data-verify-workflow-phase') ?? '',
      workspaceMode: labGrid?.getAttribute('data-workspace-mode') ?? '',
      studioMode: labGrid?.getAttribute('data-studio-mode') ?? '',
      labGrid: box('[data-testid="ide-verify-lab-grid"]'),
      result: box('[data-testid="ide-verify-region-header"]'),
      record: box('[data-testid="ide-run-identity"]'),
      workArea: box('[data-testid="ide-mode-body"]'),
      stimulus: box('[data-testid="ide-verify-region-stimulus"]'),
      waveform: box('[data-testid="ide-verify-region-waveform"]'),
      failureDetails: box('[data-testid="ide-verify-repair-decision"]'),
      firstFail: box('[data-testid="ide-verify-results-summary-open-fail"]'),
      repairPathCount: document.querySelectorAll('[data-testid="ide-verify-repair-testbench-path"], [data-testid="ide-verify-repair-design-path"]').length,
      retiredFailureSummaryCount: document.querySelectorAll('[data-testid="ide-verify-advanced-failure"] > summary').length,
      documentOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  });

  assert(metrics.phase === 'post-run', `${viewport.label}/${label}: Verify should be post-run, got "${metrics.phase}"`);
  assert(metrics.workspaceMode === 'split', `${viewport.label}/${label}: Verify should remain split, got "${metrics.workspaceMode}"`);
  assert(metrics.studioMode === 'replay', `${viewport.label}/${label}: Verify evidence should be shown in Replay, got "${metrics.studioMode}"`);
  assert(metrics.result?.visibleHeight >= 44, `${viewport.label}/${label}: Verify result summary is clipped ${JSON.stringify(metrics.result)}`);
  assert(metrics.record?.visibleHeight >= 24, `${viewport.label}/${label}: recorded run identity must remain directly readable ${JSON.stringify(metrics.record)}`);
  assert(metrics.result.bottom <= viewport.height - 8, `${viewport.label}/${label}: Verify result summary falls below viewport ${JSON.stringify(metrics.result)}`);
  assert(!metrics.stimulus || metrics.stimulus.visibleWidth === 0, `${viewport.label}/${label}: inactive case table should not compete with recorded trace ${JSON.stringify(metrics.stimulus)}`);
  assert(metrics.waveform?.visibleWidth >= 500, `${viewport.label}/${label}: Replay evidence lane became too narrow ${JSON.stringify(metrics.waveform)}`);
  assert(metrics.labGrid?.extraX <= 8, `${viewport.label}/${label}: Verify lab grid created a horizontal mini-scroll trap ${JSON.stringify(metrics.labGrid)}`);
  assert(metrics.documentOverflowX <= 1, `${viewport.label}/${label}: Verify created root overflow ${metrics.documentOverflowX}px`);
  if (label === 'FAIL') {
    assert(
      metrics.failureDetails?.visibleHeight >= Math.round(metrics.failureDetails.height * 0.8),
      `${viewport.label}/${label}: direct expected-output versus circuit repair decision must be readable ${JSON.stringify(metrics.failureDetails)}`
    );
    assert(metrics.repairPathCount === 2, `${viewport.label}/${label}: direct failure guidance must expose both repair paths`);
    assert(metrics.retiredFailureSummaryCount === 0, `${viewport.label}/${label}: retired Failure details disclosure must stay removed`);
    assert(
      metrics.labGrid?.bottom >= metrics.workArea.bottom - MAX_FAIL_EVIDENCE_BOTTOM_GAP,
      `${viewport.label}/${label}: fail evidence workspace left too much unused lower viewport ${JSON.stringify(metrics.labGrid)}`
    );
    const firstFail = page.locator('[data-testid="ide-verify-results-summary-open-fail"]').first();
    await firstFail.scrollIntoViewIfNeeded();
    assert(await visible(firstFail), `${viewport.label}/${label}: direct repair panel must expose the first failing check`);
    await firstFail.click();
    assert(await visible(page.getByTestId('ide-verify-fail-nav-summary')), `${viewport.label}/${label}: selected failure must remain visible`);
    await page.getByTestId('ide-verify-details').click();
  }
}

async function selectVerifyWorkspace(page, mode) {
  const control = page.getByTestId(mode === 'replay' ? 'ide-verify-view-waveform' : 'ide-verify-view-table');
  assert(await visible(control), `Verify ${mode} workspace control must be visible`);
  await control.click();
  await page.waitForFunction(
    (expectedMode) =>
      (document.querySelector('[data-testid="ide-verify-lab-grid"]')?.getAttribute('data-studio-mode') === 'replay') === (expectedMode === 'replay'),
    mode,
    { timeout: 5000 }
  );
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
  const cells = await page.locator('[data-testid^="ide-case-lab-exp-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const testId = element.getAttribute('data-testid') || '';
      const match = /^ide-case-lab-exp-(\d+)-(.+)$/.exec(testId);
      const value = element.textContent?.trim();
      return {
        testId,
        signal: match?.[2] ?? '',
        tick: match?.[1] ? Number(match[1]) : -1,
        value: value === '1' ? 1 : value === '0' ? 0 : null,
      };
    })
  );
  const target = cells.find((cell) => cell.value === 0) ?? cells.find((cell) => cell.value === 1) ?? null;
  assert(target, `expected at least one rendered expected-output cell with a saved 0/1 value, saw ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

async function clickExpectedCellToValue(page, target, expectedValue) {
  const cell = page.getByTestId(target.testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const text = (await cell.textContent())?.trim();
    const current = text === '1' ? 1 : text === '0' ? 0 : null;
    if (current === expectedValue) return;
    await cell.click();
    await page.waitForTimeout(150);
  }
  const text = (await cell.textContent())?.trim();
  const current = text === '1' ? 1 : text === '0' ? 0 : null;
  assert(current === expectedValue, `expected ${target.testId} to become ${expectedValue}, got ${current}`);
}
