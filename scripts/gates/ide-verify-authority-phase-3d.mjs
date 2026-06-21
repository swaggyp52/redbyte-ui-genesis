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

const SCREENSHOT_ROOT = process.env.RB_VERIFY_AUTHORITY_PHASE_3D_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_AUTHORITY_PHASE_3D_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Verify authority Phase 3D satisfied', async ({ page, baseUrl }) => {
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
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-authority-phase-3d`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await ensureVerifyVectorsReady(page);

  const courseAuthority = await readCheckAuthority(page);
  assert(courseAuthority.provenance === 'course', `starter checks must be Course-owned, got ${JSON.stringify(courseAuthority)}`);
  assert(courseAuthority.editable === 'false', `Course checks must be locked, got ${JSON.stringify(courseAuthority)}`);
  const lockedCell = page.locator('button[data-testid^="ide-stimulus-expected-"]').first();
  await lockedCell.waitFor({ state: 'visible', timeout: 10000 });
  assert(await lockedCell.isDisabled(), 'Course expected cells must be disabled before duplication');
  assert(
    !(await page.locator('[data-testid="ide-verify-v2-repair-authority"]').first().isVisible().catch(() => false)),
    'repair authority must not appear before a failing Compare result'
  );
  await capture(page, '01-course-locked');

  await duplicateCourseChecks(page);
  const myAuthority = await readCheckAuthority(page);
  assert(
    myAuthority.provenance === 'student' && myAuthority.editable === 'true',
    `duplicated checks must become editable My checks, got ${JSON.stringify(myAuthority)}`
  );

  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must be selectable after duplication');
  let status = await runAndReadStatus(page);
  assert(isVerifyPass(status), `initial My-check Compare should PASS, got "${status}"`);
  let v2 = await readV2Authority(page);
  assert(v2.resultStatus === 'pass', `V2 authority must render PASS after Compare, got ${JSON.stringify(v2)}`);
  assert(v2.resultCurrent === 'true', `V2 pass must be current, got ${JSON.stringify(v2)}`);
  assert(v2.timingMode === 'combinational', `logic-gates timing must be combinational, got ${JSON.stringify(v2)}`);
  assert(/Combinational no clock/i.test(v2.timingLabel), `V2 timing label must render, got ${JSON.stringify(v2)}`);
  await capture(page, '02-my-checks-pass-v2');

  const target = await pickExpectedCell(page);
  await clickExpectedCellToValue(page, target, target.value === 0 ? 1 : 0);
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="ide-verify-v2-authority"]');
    return node?.getAttribute('data-result-status') === 'stale';
  }, null, { timeout: 10000 });
  v2 = await readV2Authority(page);
  assert(v2.resultStatus === 'stale', `expected-output edit must stale V2 result, got ${JSON.stringify(v2)}`);
  assert(v2.resultCurrent === 'false', `stale V2 result must not be current, got ${JSON.stringify(v2)}`);
  assert(v2.staleReasonCode === 'check-set-changed', `expected V2 stale reason check-set-changed, got ${JSON.stringify(v2)}`);
  const staleText = await normalizedText(page.locator('[data-testid="ide-verify-summary-headline"], [data-testid="ide-verify-results-summary"]').first());
  assert(/Saved checks changed|rerun Compare|current testbench/i.test(staleText), `stale summary must name saved checks/testbench, got "${staleText}"`);
  const primaryStaleText = await normalizedText(page.locator('[data-testid="ide-verify-primary-status"]').first());
  assert(/Saved checks changed|current testbench/i.test(primaryStaleText), `primary stale banner must use V2 saved-check reason, got "${primaryStaleText}"`);
  await capture(page, '03-expected-edit-stales-v2');

  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must remain selectable after stale expected edit');
  status = await runAndReadStatus(page);
  assert(isVerifyFail(status), `wrong My expected output should FAIL Compare, got "${status}"`);
  await page.locator('[data-testid="ide-verify-results-summary-open-fail"]').first().click();
  await page.waitForSelector('[data-testid="ide-verify-v2-repair-authority"]', { timeout: 10000 });
  const repair = await readRepairAuthority(page);
  assert(repair.canFixCircuit === 'true', `My-check failure should allow circuit repair, got ${JSON.stringify(repair)}`);
  assert(repair.canEditExpected === 'true', `My-check failure should allow expected-output repair, got ${JSON.stringify(repair)}`);
  assert(repair.checkProvenance === 'student', `repair provenance must be student, got ${JSON.stringify(repair)}`);
  assert(/My checks|expected output/i.test(repair.text), `repair copy must explain My-check editability, got ${JSON.stringify(repair)}`);
  await capture(page, '04-my-fail-repair-authority');
  assert(
    await page.locator('[data-testid="ide-verify-v2-open-expected-repair"], [data-testid="ide-verify-fix-expectation-strip"], [data-testid="ide-verify-right-accept-observed"]').first().isVisible().catch(() => false),
    'expected-output repair affordance must be visible for My-check failures'
  );

  await clickExpectedCellToValue(page, target, target.value);
  assert(await setVerifyRunMode(page, 'compare'), 'Compare checks must remain selectable after My-check repair');
  status = await runAndReadStatus(page);
  assert(isVerifyPass(status), `repaired My expected output should PASS Compare, got "${status}"`);
  v2 = await readV2Authority(page);
  assert(v2.resultStatus === 'pass' && v2.resultCurrent === 'true', `repaired pass must be current V2 PASS, got ${JSON.stringify(v2)}`);
  await capture(page, '05-repair-pass-v2');

  assert(findings.length === 0, `Verify authority gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
});

async function duplicateCourseChecks(page) {
  const duplicate = page.locator('[data-testid="ide-verify-duplicate-course-checks"]').first();
  assert(await duplicate.isVisible().catch(() => false), 'Duplicate to My checks must be visible for Course checks');
  await duplicate.click();
  await page.waitForFunction(() => {
    const authority = document.querySelector('[data-testid="ide-verify-check-authority"]');
    return authority?.getAttribute('data-provenance') === 'student' &&
      authority?.getAttribute('data-editable') === 'true';
  }, null, { timeout: 10000 });
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
  await page.waitForFunction(() => {
    const lastRun = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun ?? null;
    const authority = document.querySelector('[data-testid="ide-verify-v2-authority"]');
    const renderedStatus = authority?.getAttribute('data-result-status') ?? null;
    if (!lastRun || !renderedStatus) return false;
    if (lastRun.status === 'pass') return renderedStatus === 'pass';
    if (lastRun.status === 'fail') return renderedStatus === 'fail';
    return renderedStatus === 'observe' || renderedStatus === 'error';
  }, null, { timeout: 10000 });
  return (await page.locator('[data-testid="ide-verify-v2-authority"]').first().getAttribute('data-result-status')) ?? '';
}

async function readCheckAuthority(page) {
  return page.locator('[data-testid="ide-verify-check-authority"]').first().evaluate((node) => ({
    provenance: node.getAttribute('data-provenance'),
    editable: node.getAttribute('data-editable'),
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

async function readV2Authority(page) {
  await page.waitForSelector('[data-testid="ide-verify-v2-authority"]', { timeout: 10000 });
  return page.locator('[data-testid="ide-verify-v2-authority"]').first().evaluate((node) => ({
    resultStatus: node.getAttribute('data-result-status'),
    resultCurrent: node.getAttribute('data-result-current'),
    projectStatus: node.getAttribute('data-project-status'),
    exportReadiness: node.getAttribute('data-export-readiness'),
    staleReasonCode: node.getAttribute('data-stale-reason-code'),
    timingMode: node.getAttribute('data-timing-mode'),
    timingLabel: (node.querySelector('[data-testid="ide-verify-v2-timing-label"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

async function readRepairAuthority(page) {
  return page.locator('[data-testid="ide-verify-v2-repair-authority"]').first().evaluate((node) => ({
    canFixCircuit: node.getAttribute('data-can-fix-circuit'),
    canEditExpected: node.getAttribute('data-can-edit-expected'),
    checkProvenance: node.getAttribute('data-check-provenance'),
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

async function pickExpectedCell(page) {
  const cells = await page.locator('button[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const testId = element.getAttribute('data-testid') || '';
      const title = element.getAttribute('title') || '';
      const parsedTitle = /:\s*(0|1|not set)\s*-\s*drag/i.exec(title);
      return {
        testId,
        value: parsedTitle?.[1] === '1' ? 1 : parsedTitle?.[1] === '0' ? 0 : null,
      };
    })
  );
  const target = cells.find((cell) => cell.value === 0) ?? cells.find((cell) => cell.value === 1) ?? null;
  assert(target, `expected at least one editable expected-output cell, got ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

async function clickExpectedCellToValue(page, target, expectedValue) {
  const cell = page.getByTestId(target.testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readExpectedCellValue(page, target.testId);
    if (current === expectedValue) return;
    await cell.click();
    await page.waitForTimeout(150);
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

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

async function capture(page, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `verify-authority-phase-3d-${name}.png`),
    fullPage: false,
  });
}
