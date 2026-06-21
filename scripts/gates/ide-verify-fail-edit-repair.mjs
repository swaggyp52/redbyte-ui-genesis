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

const screenshotDir = process.env.RB_VERIFY_FAIL_EDIT_REPAIR_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_FAIL_EDIT_REPAIR_SCREENSHOTS_DIR)
  : '';

async function capture(page, fileName) {
  if (!screenshotDir) return;
  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, fileName), fullPage: true });
}

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.trim() ?? '';
}

function parseCellValueFromTitle(title) {
  const value = String(title ?? '');
  if (/:\s*1\s*-\s*drag/i.test(value)) return 1;
  if (/:\s*0\s*-\s*drag/i.test(value)) return 0;
  return null;
}

async function pickRenderedExpectedTarget(page) {
  const cells = await page.locator('button[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
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
    `expected at least one rendered expected-output cell with a saved 0/1 value, saw ${JSON.stringify(
      cells.slice(0, 8)
    )}`
  );
  return target;
}

async function ensureExpectedChecksEditable(page) {
  const firstExpectedCell = page.locator('button[data-testid^="ide-stimulus-expected-"]').first();
  await firstExpectedCell.waitFor({ state: 'visible', timeout: 10000 });
  if (!(await firstExpectedCell.isDisabled().catch(() => false))) return;

  const duplicateCourseChecks = page.locator('[data-testid="ide-verify-duplicate-course-checks"]').first();
  assert(
    await duplicateCourseChecks.isVisible().catch(() => false),
    'locked Course checks must expose Duplicate to My checks before fail/repair editing'
  );
  await duplicateCourseChecks.click();
  await page.waitForFunction(() => {
    const authority = document.querySelector('[data-testid="ide-verify-check-authority"]');
    return authority?.getAttribute('data-provenance') === 'student' &&
      authority?.getAttribute('data-editable') === 'true';
  }, null, { timeout: 10000 });
  assert(
    !(await firstExpectedCell.isDisabled().catch(() => true)),
    'duplicated My checks must make expected-output cells editable'
  );
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

await runIdeGate('IDE verify fail-edit-repair contract satisfied', async ({ page, baseUrl }) => {
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
  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must be selectable before the initial run');

  let status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyPass(status), `initial Compare should PASS, got "${status}"`);
  await capture(page, '01-initial-compare-pass.png');

  await ensureExpectedChecksEditable(page);
  const target = await pickRenderedExpectedTarget(page);
  const wrongValue = target.value === 0 ? 1 : 0;
  await clickExpectedCellToValue(page, target, wrongValue);
  await page.waitForFunction(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectHealthCore?.dirtySinceVerify === true,
    { timeout: 5000 }
  );
  await capture(page, '02-expected-output-edited-stale.png');

  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must remain selectable after expected-output edit');
  status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyFail(status), `wrong expected output should FAIL Compare, got "${status}"`);
  await capture(page, '03-rerun-fails-on-wrong-expected-output.png');

  await clickExpectedCellToValue(page, target, target.value);
  await page.waitForFunction(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectHealthCore?.dirtySinceVerify === true,
    { timeout: 5000 }
  );
  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must remain selectable after expected-output repair');
  status = await clickRunAndWaitForNewResult(page);
  assert(isVerifyPass(status), `repaired expected output should PASS Compare, got "${status}"`);
  await capture(page, '04-repaired-compare-pass.png');

  const runtimeHealth = await page.evaluate(() => {
    const health = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectHealthCore;
    return {
      dirtySinceVerify: health?.dirtySinceVerify ?? null,
      dirtySinceExport: health?.dirtySinceExport ?? null,
    };
  });
  assert(runtimeHealth.dirtySinceVerify === false, 'runtime must mark Verify clean after repaired PASS');
  assert(
    runtimeHealth.dirtySinceExport === true,
    'expected-output edits must keep export dirty until the E0 bundle is rebuilt'
  );

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  const projectVerify = await text(page.locator('[data-testid="ide-project-last-verify-status"]'));
  const projectDirty = await text(page.locator('[data-testid="ide-project-dirty-since-verify"]'));
  assert(/PASS/i.test(projectVerify), `Project diagnostics must show PASS after repair, got "${projectVerify}"`);
  assert(/CLEAN/i.test(projectDirty), `Project diagnostics must show Verify CLEAN after repair, got "${projectDirty}"`);
  await capture(page, '05-project-verify-clean-after-repair.png');

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-provenance-verify"]', { timeout: 10000 });
  const exportVerify = await text(page.locator('[data-testid="ide-export-provenance-verify"]'));
  const exportState = await text(page.locator('[data-testid="ide-export-handoff-summary-state"]'));
  const exportCta = await text(page.locator('[data-testid="ide-export-rebuild-btn"]'));
  assert(/Checks match/i.test(exportVerify), `Export provenance must show Checks match after repair, got "${exportVerify}"`);
  assert(
    /READY TO BUILD|READY/i.test(exportState),
    `Export handoff should be ready to build/ready after repair, got "${exportState}"`
  );
  assert(
    /Build Current Bundle|Download Project|Download E0|Vivado/i.test(exportCta),
    `Export CTA should be build/download oriented after repair, got "${exportCta}"`
  );
  await capture(page, '06-export-verify-current-after-repair.png');
});
