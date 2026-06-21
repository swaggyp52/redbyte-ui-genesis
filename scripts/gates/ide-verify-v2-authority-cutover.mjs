#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

const SCREENSHOT_ROOT = process.env.RB_VERIFY_V2_CUTOVER_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_V2_CUTOVER_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Verify V2 authority cutover satisfied', async ({ page, baseUrl }) => {
  const consoleFindings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      consoleFindings.push({ type: message.type(), text, location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    consoleFindings.push({ type: 'pageerror', text: error.message });
  });

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  await page.setViewportSize({ width: 1366, height: 768 });
  await openLogicGatesVerify(page, baseUrl);
  await capture(page, '01-course-locked');

  const courseAuthority = await readCheckAuthority(page);
  assert(
    courseAuthority.provenance === 'course',
    `starter Verify should render Course checks from V2 truth, got ${JSON.stringify(courseAuthority)}`
  );
  assert(
    courseAuthority.editable === 'false',
    `Course checks must render expected values as locked, got ${JSON.stringify(courseAuthority)}`
  );
  assert(
    /Course checks/i.test(courseAuthority.label) && /locked/i.test(courseAuthority.editabilityText),
    `Course authority copy should be visible and specific, got ${JSON.stringify(courseAuthority)}`
  );

  const lockedCell = page.locator('button[data-testid^="ide-stimulus-expected-"]').first();
  await lockedCell.waitFor({ state: 'visible', timeout: 10000 });
  assert(await lockedCell.isDisabled(), 'Course expected-output cells must be disabled in the rendered grid');
  assert(
    (await lockedCell.getAttribute('data-locked')) === 'true',
    'Course expected-output cells must expose locked authority state for regression proof'
  );
  const lockedTitle = (await lockedCell.getAttribute('title')) ?? '';
  assert(/duplicate/i.test(lockedTitle), `locked expected cell must explain duplicate path, got "${lockedTitle}"`);

  const duplicate = page.locator('[data-testid="ide-verify-duplicate-course-checks"]').first();
  assert(await duplicate.isVisible().catch(() => false), 'Course checks must expose Duplicate to My checks');
  await duplicate.click();
  await page.waitForFunction(() => {
    const authority = document.querySelector('[data-testid="ide-verify-check-authority"]');
    return authority?.getAttribute('data-provenance') === 'student' &&
      authority?.getAttribute('data-editable') === 'true';
  }, null, { timeout: 10000 });
  await capture(page, '02-my-checks-editable');

  const myAuthority = await readCheckAuthority(page);
  assert(
    myAuthority.provenance === 'student' && myAuthority.editable === 'true',
    `duplicated checks must render as editable My checks, got ${JSON.stringify(myAuthority)}`
  );
  assert(
    /My checks/i.test(myAuthority.label) && /editable/i.test(myAuthority.editabilityText),
    `My checks authority copy should be visible and specific, got ${JSON.stringify(myAuthority)}`
  );

  const editableCell = page.locator('button[data-testid^="ide-stimulus-expected-"]').first();
  await editableCell.waitFor({ state: 'visible', timeout: 10000 });
  assert(!(await editableCell.isDisabled()), 'My expected-output cells must become editable after duplication');
  assert(
    (await editableCell.getAttribute('data-locked')) === 'false',
    'My expected-output cells must expose unlocked authority state'
  );
  const beforeTitle = (await editableCell.getAttribute('title')) ?? '';
  await editableCell.click();
  await page.waitForTimeout(150);
  const afterTitle = (await editableCell.getAttribute('title')) ?? '';
  assert(
    beforeTitle !== afterTitle,
    `clicking an editable My expected cell must update it (before="${beforeTitle}", after="${afterTitle}")`
  );

  assert(
    await setVerifyRunMode(page, 'compare'),
    'Verify V2 cutover gate requires Compare checks to remain available after duplication'
  );
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-verify-v2-authority"]', { timeout: 10000 });
  await capture(page, '03-v2-result-authority');

  const resultAuthority = await page.locator('[data-testid="ide-verify-v2-authority"]').first().evaluate((node) => ({
    resultStatus: node.getAttribute('data-result-status'),
    resultCurrent: node.getAttribute('data-result-current'),
    projectStatus: node.getAttribute('data-project-status'),
    exportReadiness: node.getAttribute('data-export-readiness'),
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
  assert(
    ['pass', 'fail', 'observe', 'stale'].includes(resultAuthority.resultStatus ?? ''),
    `V2 result authority must expose a concrete result status, got ${JSON.stringify(resultAuthority)}`
  );
  assert(
    resultAuthority.resultCurrent === 'true',
    `fresh Compare run must mark the V2 result current, got ${JSON.stringify(resultAuthority)}`
  );
  assert(
    resultAuthority.projectStatus !== '',
    `V2 result authority must publish Project Verify status, got ${JSON.stringify(resultAuthority)}`
  );
  assert(
    resultAuthority.exportReadiness !== '',
    `V2 result authority must publish Export readiness, got ${JSON.stringify(resultAuthority)}`
  );

  const verifyText = ((await page.locator('[data-testid="ide-verify-panel"]').textContent()) ?? '').toLowerCase();
  for (const forbidden of ['e0 only', 'e1-e3 external']) {
    assert(!verifyText.includes(forbidden), `Verify student surface must not expose "${forbidden}"`);
  }

  assert(
    consoleFindings.length === 0,
    `Verify V2 cutover gate emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function openLogicGatesVerify(page, baseUrl) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-v2-authority-cutover`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-verify-check-authority"]', { timeout: 15000 });
}

async function readCheckAuthority(page) {
  return page.locator('[data-testid="ide-verify-check-authority"]').first().evaluate((node) => ({
    provenance: node.getAttribute('data-provenance'),
    editable: node.getAttribute('data-editable'),
    label: (node.querySelector('[data-testid="ide-verify-check-set-label"]')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim(),
    editabilityText: (node.querySelector('[data-testid="ide-verify-check-editability"]')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim(),
  }));
}

async function capture(page, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `verify-v2-authority-cutover-${name}.png`),
    fullPage: false,
  });
}
