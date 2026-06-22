#!/usr/bin/env node

import {
  assert,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE Verify keyboard grid V2 satisfied', async ({ page, baseUrl }) => {
  const findings = captureBrowserProblems(page);

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-keyboard-grid-v2`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-verify-check-authority"]', { timeout: 15000 });

  const duplicate = page.locator('[data-testid="ide-verify-duplicate-course-checks"]').first();
  assert(await visible(duplicate), 'Duplicate to My checks must be keyboard reachable');
  await duplicate.focus();
  assert(
    await duplicate.evaluate((node) => document.activeElement === node),
    'Duplicate to My checks must receive focus'
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const authority = document.querySelector('[data-testid="ide-verify-check-authority"]');
    return authority?.getAttribute('data-provenance') === 'student' &&
      authority?.getAttribute('data-editable') === 'true';
  }, null, { timeout: 10000 });
  assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must be selectable after duplication');
  await page.locator('[data-testid="ide-vcb-run"]').first().focus();
  await page.keyboard.press('Enter');
  await waitForVerifyResult(page, { timeout: 15000 });
  const beforeEditAuthority = await readV2Authority(page);
  assert(
    beforeEditAuthority.resultStatus === 'pass' && beforeEditAuthority.resultCurrent === 'true',
    `pre-edit keyboard proof needs a current PASS, got ${JSON.stringify(beforeEditAuthority)}`
  );

  const target = await pickEditableExpectedCell(page);
  const cell = page.getByTestId(target.testId).first();
  await cell.scrollIntoViewIfNeeded();
  await cell.focus();
  assert(await cell.evaluate((node) => document.activeElement === node), 'editable expected-output cell must receive focus');
  const beforeTitle = await cell.getAttribute('title');
  await page.keyboard.press('Space');
  await page.waitForFunction(
    ({ testId, before }) => {
      const cell = document.querySelector(`[data-testid="${testId}"]`);
      return cell?.getAttribute('title') !== before;
    },
    { testId: target.testId, before: beforeTitle },
    { timeout: 10000 }
  );
  const afterTitle = await cell.getAttribute('title');
  assert(beforeTitle !== afterTitle, `Space key must edit expected output (before="${beforeTitle}", after="${afterTitle}")`);

  const authority = await readV2Authority(page);
  assert(
    authority.resultStatus === 'stale' || authority.resultCurrent === 'false',
    `keyboard expected-output edit must stale the previous authority, got ${JSON.stringify(authority)}`
  );

  const runButton = page.locator('[data-testid="ide-vcb-run"]').first();
  assert(await visible(runButton), 'Run button must be visible after keyboard edit');
  assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must be selectable after keyboard edit');
  await runButton.focus();
  assert(await runButton.evaluate((node) => document.activeElement === node), 'Run button must receive focus');
  await page.keyboard.press('Enter');
  await waitForVerifyResult(page, { timeout: 15000 });
  const afterRun = await readV2Authority(page);
  assert(
    ['pass', 'fail'].includes(afterRun.resultStatus ?? ''),
    `keyboard-run Compare must produce PASS or FAIL authority, got ${JSON.stringify(afterRun)}`
  );

  assert(
    findings.length === 0,
    `verify keyboard grid gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`
  );
});

async function pickEditableExpectedCell(page) {
  const cells = await page.locator('button[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
    elements.map((element) => ({
      testId: element.getAttribute('data-testid') || '',
      disabled: element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true',
      title: element.getAttribute('title') || '',
    }))
  );
  const target = cells.find((cell) => cell.testId && !cell.disabled);
  assert(target, `expected at least one editable expected-output cell after duplication, got ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

async function readV2Authority(page) {
  const authority = page.locator('[data-testid="ide-verify-v2-authority"]').first();
  if (!(await authority.isVisible().catch(() => false))) {
    return { resultStatus: null, resultCurrent: null };
  }
  return authority.evaluate((node) => ({
    resultStatus: node.getAttribute('data-result-status'),
    resultCurrent: node.getAttribute('data-result-current'),
    staleReasonCode: node.getAttribute('data-stale-reason-code'),
  }));
}

function captureBrowserProblems(page) {
  const findings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      findings.push({ type: message.type(), text });
    }
  });
  page.on('pageerror', (error) => findings.push({ type: 'pageerror', text: error.message }));
  return findings;
}
