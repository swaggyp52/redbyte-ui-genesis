#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const SCREENSHOT_ROOT = process.env.RB_VERIFY_SAVED_CHECKS_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_SAVED_CHECKS_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Verify saved checks remain active in unified simulation satisfied', async ({ page, baseUrl }) => {
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

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openLogicGatesVerify(page, baseUrl, viewport.label);
    await ensureVerifyVectorsReady(page);
    await capture(page, viewport, '01-before-run');

    const before = await readRunModeState(page);
    assert(
      before.checkCount > 0,
      `${viewport.label}: starter saved checks must remain visible in the Checks workspace (${JSON.stringify(before)})`
    );
    assert(
      before.scenarioSelected,
      `${viewport.label}: first-run authoring must remain in Scenario, got ${JSON.stringify(before)}`
    );
    assert(
      /run simulation/i.test(before.runLabel),
      `${viewport.label}: the single Run action must remain simulation-oriented, got "${before.runLabel}"`
    );
    assert(
      /evaluates\s+[1-9]\d*\s+optional check/i.test(before.modeExplainer),
      `${viewport.label}: run explainer must disclose automatic saved-check evaluation, got "${before.modeExplainer}"`
    );

    await clickVerifyRun(page);
    await waitForVerifyResult(page, { timeout: 15000 });
    const status = await normalizedText(page.locator('[data-testid="ide-verify-summary-status"]').first());
    assert(isVerifyPass(status), `${viewport.label}: first saved-check run should Compare PASS, got "${status}"`);
    await capture(page, viewport, '02-after-compare-pass');

    const after = await readRunModeState(page);
    assert(
      after.checkCount === before.checkCount,
      `${viewport.label}: saved checks must remain intact after PASS, got ${JSON.stringify(after)}`
    );
    assert(
      /run simulation/i.test(after.runLabel),
      `${viewport.label}: Run must remain a single simulation action after PASS, got "${after.runLabel}"`
    );

    await page.locator('[data-testid="ide-vcb-workspace-checks"]').first().click();
    const checks = await readRunModeState(page);
    assert(
      checks.checksSelected,
      `${viewport.label}: students must be able to open saved checks, got ${JSON.stringify(checks)}`
    );
    assert(
      await page.locator('[data-testid^="ide-stimulus-expected-"]').first().isVisible().catch(() => false),
      `${viewport.label}: Checks workspace must expose expected-output cells`
    );

    await page.locator('[data-testid="ide-vcb-workspace-scenario"]').first().click();
    const restored = await readRunModeState(page);
    assert(
      restored.scenarioSelected && restored.checkCount === before.checkCount,
      `${viewport.label}: returning to Scenario must preserve saved checks, got ${JSON.stringify(restored)}`
    );
  }

  assert(
    consoleFindings.length === 0,
    `Verify saved-checks default gate emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function openLogicGatesVerify(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-saved-checks-default-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
}

async function readRunModeState(page) {
  return page.evaluate(() => {
    const scenario = document.querySelector('[data-testid="ide-vcb-workspace-scenario"]');
    const checks = document.querySelector('[data-testid="ide-vcb-workspace-checks"]');
    const run = document.querySelector('[data-testid="ide-vcb-run"]');
    const explainer = document.querySelector('[data-testid="ide-vcb-mode-explainer"]');
    const checksText = (checks?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const checkCount = Number.parseInt(checksText.match(/\b(\d+)\b/)?.[1] ?? '0', 10);
    return {
      scenarioSelected: scenario?.getAttribute('aria-selected') === 'true',
      checksSelected: checks?.getAttribute('aria-selected') === 'true',
      checksAvailable: Boolean(checks) && !(checks instanceof HTMLButtonElement && checks.disabled),
      checkCount: Number.isFinite(checkCount) ? checkCount : 0,
      runLabel: (run?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      modeExplainer: (explainer?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  });
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `verify-saved-checks-default-${name}-${viewport.label}.png`),
    fullPage: false,
  });
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
