#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
const CURRENT_FULL_SHA = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

await runIdeGate('IDE diagnostics bundle V2 satisfied', async ({ page, baseUrl }) => {
  const findings = captureBrowserProblems(page);

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=diagnostics-bundle-v2`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });

  const root = page.locator('[data-testid="ide-root"]').first();
  assert((await root.getAttribute('data-build-sha')) === CURRENT_SHA, 'root build sha must match local HEAD');
  assert(
    (await root.getAttribute('data-build-full-sha')) === CURRENT_FULL_SHA,
    'root full build sha must match local HEAD'
  );
  const normalText = await page.locator('body').innerText({ timeout: 5000 });
  assert(!normalText.includes(CURRENT_SHA), 'normal student UI must not expose the short build hash');
  assert(!normalText.includes(CURRENT_FULL_SHA), 'normal student UI must not expose the full build hash');

  await page.locator('[data-testid="ide-topbar-help-btn"]').first().click();
  await page.locator('[data-testid="ide-help-diagnostics"]').first().click();
  const dialog = page.locator('[data-testid="ide-diagnostics-dialog"]').first();
  assert(await visible(dialog), 'Diagnostics dialog must open from Help');

  const dialogText = await dialog.innerText();
  assert(dialogText.includes(CURRENT_FULL_SHA), 'Diagnostics must expose full SHA inside the support boundary');
  assert(/Project/i.test(dialogText), 'Diagnostics must include current project identity summary');
  assert(/Mode/i.test(dialogText), 'Diagnostics must include selected mode summary');
  assert(/Checks/i.test(dialogText), 'Diagnostics must include scenario/check summary');
  assert(/Storage/i.test(dialogText), 'Diagnostics must include storage/session summary');
  assert(!/\bE0\b|\bE1\b|\bE2\b|\bE3\b/.test(dialogText), 'Diagnostics must keep plain proof-boundary language');

  const bundleText = await page.locator('[data-testid="ide-diagnostics-support-bundle"]').first().innerText();
  const bundle = JSON.parse(bundleText);
  assert(bundle.redbyteDiagnostics === 1, 'support bundle must expose a version marker');
  assert(bundle.build.fullSha === CURRENT_FULL_SHA, 'support bundle full SHA must match local HEAD');
  assert(bundle.build.shortSha === CURRENT_SHA, 'support bundle short SHA must match local HEAD');
  assert(bundle.app.mode === 'verify', `support bundle must capture current mode, got ${bundle.app.mode}`);
  assert(bundle.project.name && /Logic Gates/i.test(bundle.project.name), 'support bundle must capture project name');
  assert(bundle.project.nodeCount > 0, 'support bundle must capture non-empty project graph metadata');
  assert(bundle.verify.activeScenarioId, 'support bundle must capture selected scenario id');
  assert('lastRunStatus' in bundle.verify, 'support bundle must include last run status field');
  assert(bundle.storage.runtimeStatePresent, 'support bundle must capture runtime storage state');
  assert(bundle.storage.redbyteKeyCount > 0, 'support bundle must include RedByte storage key count');

  const copy = page.locator('[data-testid="ide-diagnostics-copy-bundle"]').first();
  assert(await visible(copy), 'Diagnostics must expose a support-bundle copy action');
  await copy.click();
  await page.waitForFunction(() => {
    const state = document.querySelector('[data-testid="ide-diagnostics-copy-state"]')?.textContent ?? '';
    return /copied|clipboard unavailable|select the bundle text/i.test(state);
  }, undefined, { timeout: 5000 });
  const copyState = await page.locator('[data-testid="ide-diagnostics-copy-state"]').first().innerText();
  assert(
    /copied|clipboard unavailable|select the bundle text/i.test(copyState),
    `copy action must produce actionable status, got "${copyState}"`
  );

  assert(
    findings.length === 0,
    `diagnostics bundle gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`
  );
});

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
