#!/usr/bin/env node

import { execSync } from 'node:child_process';
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

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
// Keep a small rounding allowance for the compact post-run evidence grid.
const COMPACT_FAIL_EVIDENCE_ALLOWANCE = 8;

await runIdeGate('IDE release solidification v2 satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await assertProjectFirstLaunchOrientation(page, baseUrl, viewport);
      await assertVerifyResultActions(page, baseUrl, viewport);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
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
  assert(await visible(orientation), `${viewport.label}: first Project launch must show workflow orientation`);
  assert(
    (await orientation.getAttribute('data-onboarding-placement')) === 'integrated',
    `${viewport.label}: workflow orientation must be integrated instead of a launch overlay`
  );

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

    function overlaps(first, second) {
      if (!first || !second) return false;
      return first.x < second.right && first.right > second.x && first.y < second.bottom && first.bottom > second.y;
    }

    const overlay = box('[data-testid="ide-onboarding-overlay"]');
    const targets = [
      box('[data-testid="ide-project-start-a-lab-primary"]'),
      box('[data-testid="ide-project-build-fresh-primary"]'),
      box('[data-testid="ide-project-open-starter-primary"]'),
      box('[data-testid="ide-project-import-primary"]'),
      box('[data-testid="ide-project-open-existing-primary"]'),
      box('[data-testid="ide-project-starter-catalog"] > summary'),
    ].filter((target) => target && target.visibleWidth > 1 && target.visibleHeight > 1);
    const primaryActions = Array.from(
      document.querySelectorAll('[data-testid="ide-project-primary-actions"] [data-product-priority="primary"]')
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });

    return {
      overlay,
      targets,
      overlapTargets: targets.filter((target) => overlaps(overlay, target)).map((target) => target.selector),
      startHub: box('[data-testid="ide-project-start-hub"]'),
      startPrimary: box('[data-testid="ide-project-start-a-lab-primary"]'),
      starterDisclosure: box('[data-testid="ide-project-starter-catalog"]'),
      primaryActionLabels: primaryActions.map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
      productSpineCount: Array.from(document.querySelectorAll('[data-testid^="ide-product-spine-"]')).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      }).length,
      rootOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  });

  assert(metrics.overlay?.visibleWidth >= 280, `${viewport.label}: orientation must remain readable ${JSON.stringify(metrics.overlay)}`);
  assert(metrics.startHub?.visibleHeight >= 140, `${viewport.label}: current Project start surface must remain visible ${JSON.stringify(metrics.startHub)}`);
  assert(metrics.startPrimary?.visibleHeight >= 36, `${viewport.label}: Start a Lab must remain a usable primary action ${JSON.stringify(metrics.startPrimary)}`);
  assert(metrics.startPrimary.bottom <= viewport.height - 8, `${viewport.label}: Start a Lab falls below the first viewport ${JSON.stringify(metrics.startPrimary)}`);
  assert(metrics.starterDisclosure?.visibleHeight >= 20, `${viewport.label}: starter/recent disclosure must remain reachable ${JSON.stringify(metrics.starterDisclosure)}`);
  assert(
    JSON.stringify(metrics.primaryActionLabels) === JSON.stringify(['Start a Lab']),
    `${viewport.label}: Project must expose exactly one current primary launch action, got ${JSON.stringify(metrics.primaryActionLabels)}`
  );
  assert(metrics.productSpineCount === 0, `${viewport.label}: Project must not restore a duplicate product-spine header`);
  assert(
    metrics.overlapTargets.length === 0,
    `${viewport.label}: workflow orientation blocks Project launch actions ${metrics.overlapTargets.join(', ')} ${JSON.stringify({ overlay: metrics.overlay, targets: metrics.targets })}`
  );
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

  const target = await pickRenderedExpectedTarget(page);
  const wrongValue = target.value === 0 ? 1 : 0;
  await clickExpectedCellToValue(page, target, wrongValue);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must remain selectable after expected-output edit`);
  let status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyFail(status), `${viewport.label}: edited expected output should fail, got "${status}"`);
  await assertVerifyActionBand(page, viewport, 'FAIL');

  await clickExpectedCellToValue(page, target, target.value);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must remain selectable after expected-output repair`);
  status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyPass(status), `${viewport.label}: repaired expected output should pass, got "${status}"`);
  await assertVerifyActionBand(page, viewport, 'REPAIR PASS');
}

async function assertVerifyActionBand(page, viewport, label) {
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
    const visibleActions = [
      '[data-testid="ide-verify-results-summary-open-design"]',
      '[data-testid="ide-verify-results-summary-review-expected"]',
    ].map((selector) => ({ selector, box: box(selector) })).filter((entry) => entry.box?.visibleHeight > 12);

    return {
      buildHash: document.querySelector('.ide-build-badge-sha')?.textContent?.trim() ?? '',
      phase: labGrid?.getAttribute('data-verify-workflow-phase') ?? '',
      workspaceMode: labGrid?.getAttribute('data-workspace-mode') ?? '',
      labGrid: box('[data-testid="ide-verify-lab-grid"]'),
      result: box('[data-testid="ide-verify-results-summary"]'),
      stimulus: box('[data-testid="ide-verify-region-stimulus"]'),
      waveform: box('[data-testid="ide-verify-region-waveform"]'),
      failureDetails: box('[data-testid="ide-verify-advanced-failure"] > summary'),
      firstFail: box('[data-testid="ide-verify-results-summary-open-fail"]'),
      actions: visibleActions,
      documentOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
    };
  });

  assert(metrics.buildHash === CURRENT_SHA, `${viewport.label}/${label}: visible build hash ${metrics.buildHash || 'missing'} != ${CURRENT_SHA}`);
  assert(metrics.phase === 'post-run', `${viewport.label}/${label}: Verify should be post-run, got "${metrics.phase}"`);
  assert(metrics.workspaceMode === 'split', `${viewport.label}/${label}: Verify should remain split, got "${metrics.workspaceMode}"`);
  assert(metrics.result?.visibleHeight >= 44, `${viewport.label}/${label}: Verify result summary is clipped ${JSON.stringify(metrics.result)}`);
  assert(metrics.result.bottom <= viewport.height - 8, `${viewport.label}/${label}: Verify result summary falls below viewport ${JSON.stringify(metrics.result)}`);
  assert(metrics.stimulus?.visibleWidth >= 500, `${viewport.label}/${label}: testbench lane became too narrow ${JSON.stringify(metrics.stimulus)}`);
  assert(metrics.waveform?.visibleWidth >= 500, `${viewport.label}/${label}: waveform lane became too narrow ${JSON.stringify(metrics.waveform)}`);
  assert(metrics.labGrid?.extraX <= 8, `${viewport.label}/${label}: Verify lab grid created a horizontal mini-scroll trap ${JSON.stringify(metrics.labGrid)}`);
  assert(metrics.documentOverflowX <= 1, `${viewport.label}/${label}: Verify created root overflow ${metrics.documentOverflowX}px`);
  if (label === 'FAIL') {
    assert(metrics.actions.length >= 1, `${viewport.label}/${label}: visible failure summary must expose a repair action ${JSON.stringify(metrics.actions)}`);
    assert(metrics.failureDetails?.visibleHeight >= 20, `${viewport.label}/${label}: Failure details disclosure must stay discoverable ${JSON.stringify(metrics.failureDetails)}`);
    assert(
      metrics.labGrid?.visibleHeight >= viewport.height - 340 - COMPACT_FAIL_EVIDENCE_ALLOWANCE,
      `${viewport.label}/${label}: fail evidence workspace left too much unused lower viewport ${JSON.stringify(metrics.labGrid)}`
    );
    const failureDetails = page.locator('[data-testid="ide-verify-advanced-failure"]').first();
    if ((await failureDetails.getAttribute('open')) === null) {
      await failureDetails.locator('summary').click();
    }
    const firstFail = page.locator('[data-testid="ide-verify-results-summary-open-fail"]').first();
    assert(await visible(firstFail), `${viewport.label}/${label}: expanded Failure details must expose the first failing check`);
  }
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
      const match = /^ide-stimulus-expected-(.+)-t(\d+)$/.exec(testId);
      const parsedTitle = /:\s*(0|1|not set)\s*-\s*drag/i.exec(element.getAttribute('title') || '');
      return {
        testId,
        signal: match?.[1] ?? '',
        tick: match?.[2] ? Number(match[2]) : -1,
        value: parsedTitle?.[1] === '1' ? 1 : parsedTitle?.[1] === '0' ? 0 : null,
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
    const title = await cell.getAttribute('title');
    const current = /:\s*1\s*-\s*drag/i.test(title || '') ? 1 : /:\s*0\s*-\s*drag/i.test(title || '') ? 0 : null;
    if (current === expectedValue) return;
    await cell.click();
    await page.waitForTimeout(150);
  }
  const title = await cell.getAttribute('title');
  const current = /:\s*1\s*-\s*drag/i.test(title || '') ? 1 : /:\s*0\s*-\s*drag/i.test(title || '') ? 0 : null;
  assert(current === expectedValue, `expected ${target.testId} to become ${expectedValue}, got ${current}`);
}
