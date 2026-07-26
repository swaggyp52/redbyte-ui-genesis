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

await runIdeGate('IDE Verify saved checks default to Compare satisfied', async ({ page, baseUrl }) => {
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
      before.compareAvailable,
      `${viewport.label}: starter saved checks must make Compare checks available (${JSON.stringify(before)})`
    );
    assert(
      before.comparePressed,
      `${viewport.label}: saved starter checks must arm Compare checks by default, got ${JSON.stringify(before)}`
    );
    assert(
      /compare/i.test(before.runLabel),
      `${viewport.label}: primary Run label must name Compare checks when saved checks are armed, got "${before.runLabel}"`
    );
    assert(
      /compare.*run|check.*expected.*run/i.test(before.modeExplainer),
      `${viewport.label}: mode explainer must describe comparison before the first run, got "${before.modeExplainer}"`
    );

    await clickVerifyRun(page);
    await waitForVerifyResult(page, { timeout: 15000 });
    const status = await normalizedText(page.locator('[data-testid="ide-verify-summary-status"]').first());
    assert(isVerifyPass(status), `${viewport.label}: first saved-check run should Compare PASS, got "${status}"`);
    await capture(page, viewport, '02-after-compare-pass');

    const after = await readRunModeState(page);
    assert(
      after.comparePressed,
      `${viewport.label}: Compare checks must remain armed after a Compare PASS, got ${JSON.stringify(after)}`
    );
    assert(
      /compare/i.test(after.runLabel),
      `${viewport.label}: update Run label must remain Compare-oriented after PASS, got "${after.runLabel}"`
    );

    await page.locator('[data-testid="ide-vcb-observe-only"]').first().click();
    const observe = await readRunModeState(page);
    assert(
      observe.observePressed && !observe.comparePressed,
      `${viewport.label}: students must still be able to intentionally switch back to Observe only, got ${JSON.stringify(observe)}`
    );

    await page.locator('[data-testid="ide-vcb-use-saved-checks"]').first().click();
    const restored = await readRunModeState(page);
    assert(
      restored.comparePressed,
      `${viewport.label}: students must be able to re-arm Compare checks after observing, got ${JSON.stringify(restored)}`
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
    const observe = document.querySelector('[data-testid="ide-vcb-observe-only"]');
    const compare = document.querySelector('[data-testid="ide-vcb-use-saved-checks"]');
    const run = document.querySelector('[data-testid="ide-vcb-run"]');
    const explainer = document.querySelector('[data-testid="ide-vcb-mode-explainer"]');
    return {
      observePressed: observe?.getAttribute('aria-pressed') === 'true',
      comparePressed: compare?.getAttribute('aria-pressed') === 'true',
      compareAvailable: Boolean(compare) && !(compare instanceof HTMLButtonElement && compare.disabled),
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
