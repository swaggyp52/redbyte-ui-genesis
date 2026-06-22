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
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const SCREENSHOT_ROOT = process.env.RB_VERIFY_SEQUENTIAL_AUTHORITY_V2_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_SEQUENTIAL_AUTHORITY_V2_SCREENSHOTS_DIR)
  : path.resolve('.redbyte/product-immersion/product-trust-reset-v2/phase-3e/after');

await runIdeGate('IDE Verify sequential authority V2 satisfied', async ({ page, baseUrl }) => {
  const findings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      findings.push({ type: message.type(), text, location: message.location() });
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
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-sequential-authority-v2`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page, { exactExampleId: 'two-bit-counter' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-verify-clock-policy-panel"]', { timeout: 15000 });

  const autoTiming = await readTiming(page);
  assert(autoTiming.modeSummary.match(/Auto board clock/i), `Counter should start in Auto board clock, got ${JSON.stringify(autoTiming)}`);
  assert(autoTiming.v2Summary.match(/Rising edge/i), `V2 timing summary must name rising edge, got ${JSON.stringify(autoTiming)}`);
  assert(autoTiming.v2Summary.match(/read-only|generated/i), `V2 summary must say auto clock is not editable, got ${JSON.stringify(autoTiming)}`);
  assert(autoTiming.clockLaneEditable === 'false', `Auto board clock lane must be read-only, got ${JSON.stringify(autoTiming)}`);
  assert(autoTiming.runEligible === 'true', `Auto board clock should be run eligible, got ${JSON.stringify(autoTiming)}`);
  assert(await page.locator('[data-testid="ide-stimulus-clock-row"]').count() === 0, 'Auto board clock must not expose editable clock row');
  assert(await page.getByTestId('ide-verify-clock-mode-custom').isDisabled(), 'Custom pattern must be disabled in trusted novice Verify');
  await capture(page, '01-counter-auto-testbench');

  assert(await setVerifyRunMode(page, 'compare'), 'Counter Compare mode must be selectable');
  const status = await runAndReadStatus(page);
  assert(isVerifyPass(status), `Counter auto board-clock Compare should PASS, got "${status}"`);
  let v2 = await readV2Authority(page);
  assert(v2.resultStatus === 'pass', `Counter PASS must be V2 PASS, got ${JSON.stringify(v2)}`);
  assert(v2.resultCurrent === 'true', `Counter PASS must be current before timing edit, got ${JSON.stringify(v2)}`);
  assert(v2.timingMode === 'auto-board-clock', `PASS timing mode should be auto-board-clock, got ${JSON.stringify(v2)}`);
  assert(v2.clockLaneEditable === 'false', `PASS auto mode should keep clock lane read-only, got ${JSON.stringify(v2)}`);
  await capture(page, '02-counter-auto-pass');

  await page.getByTestId('ide-verify-clock-mode-manual').click();
  await page.waitForFunction(() => {
    const authority = document.querySelector('[data-testid="ide-verify-v2-authority"]');
    return authority?.getAttribute('data-result-status') === 'stale' &&
      authority?.getAttribute('data-stale-reason-code') === 'timing-changed' &&
      authority?.getAttribute('data-timing-mode') === 'manual-clock';
  }, null, { timeout: 10000 });
  v2 = await readV2Authority(page);
  assert(v2.resultCurrent === 'false', `timing edit must make result not current, got ${JSON.stringify(v2)}`);
  assert(v2.projectStatus === 'stale', `timing edit must publish stale Project status, got ${JSON.stringify(v2)}`);
  assert(v2.exportReadiness === 'draft-stale', `timing edit must remove trusted export readiness, got ${JSON.stringify(v2)}`);
  assert(v2.clockLaneEditable === 'true', `Manual pulses must expose an editable clock lane, got ${JSON.stringify(v2)}`);
  assert(await page.locator('[data-testid="ide-stimulus-clock-row"]').first().isVisible(), 'Manual pulses must expose the clock lane');
  assert(await page.locator('[data-testid="ide-stimulus-clock-pattern-pulse"]').first().isVisible(), 'Manual pulses must expose pulse controls');
  await capture(page, '03-counter-manual-stale-timing');

  await page.locator('[data-testid="mode-button-project"]').click();
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 10000 });
  const projectText = await normalizedText(page.locator('[data-testid="ide-project-command-board-v1"], [data-testid="ide-project-session"]').first());
  assert(/stale|rerun|Open Verify|Compare/i.test(projectText), `Project must agree timing-edited Verify is stale, got "${projectText}"`);
  await capture(page, '04-project-after-timing-stale');

  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  const exportText = await normalizedText(page.locator('[data-testid="ide-export-readiness-details"], [data-testid="ide-export-package-inspector-v1"], [data-testid="ide-export-empty-state"]').first());
  assert(/Verify evidence is stale|Open Verify|stale/i.test(exportText), `Export must agree timing-edited Verify is stale, got "${exportText}"`);
  await capture(page, '05-export-after-timing-stale');

  assert(findings.length === 0, `Sequential authority gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
});

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
    { timeout: 30000 }
  );
  await waitForVerifyResult(page, { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-verify-v2-authority"]', { timeout: 10000 });
  return (await page.locator('[data-testid="ide-verify-v2-authority"]').first().getAttribute('data-result-status')) ?? '';
}

async function readTiming(page) {
  return page.locator('[data-testid="ide-verify-clock-policy-panel"]').first().evaluate((node) => ({
    modeSummary: (node.querySelector('[data-testid="ide-verify-clock-mode-summary"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    v2Summary: (node.querySelector('[data-testid="ide-verify-v2-timing-summary"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    clockLaneEditable: node.querySelector('[data-testid="ide-verify-v2-timing-summary"]')?.getAttribute('data-clock-lane-editable') ?? '',
    runEligible: node.querySelector('[data-testid="ide-verify-v2-timing-summary"]')?.getAttribute('data-sequential-run-eligible') ?? '',
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
    clockLaneEditable: node.getAttribute('data-clock-lane-editable'),
    runEligible: node.getAttribute('data-sequential-run-eligible'),
    timingLabel: (node.querySelector('[data-testid="ide-verify-v2-timing-label"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

async function capture(page, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `verify-sequential-authority-v2-${name}.png`),
    fullPage: false,
  });
}
