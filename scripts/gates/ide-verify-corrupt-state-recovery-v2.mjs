#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE Verify corrupt state recovery V2 satisfied', async ({ page, baseUrl }) => {
  const findings = captureBrowserProblems(page);

  await page.addInitScript(() => {
    if (window.name === 'rb-phase-3f-corrupt-recovery-clean') return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
    window.name = 'rb-phase-3f-corrupt-recovery-clean';
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-corrupt-state-recovery-v2`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });

  const duplicate = page.locator('[data-testid="ide-verify-duplicate-course-checks"]').first();
  if (await duplicate.isVisible().catch(() => false)) {
    await duplicate.click();
    await page.waitForFunction(() => {
      const authority = document.querySelector('[data-testid="ide-verify-check-authority"]');
      return authority?.getAttribute('data-provenance') === 'student';
    }, null, { timeout: 10000 });
  }
  assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must be selectable before corruption proof');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });
  const status = await readV2AuthorityStatus(page);
  assert(isVerifyPass(status), `starting path should reach PASS before corrupting persisted state, got "${status}"`);

  await page.evaluate(() => {
    localStorage.setItem('rb.ide.project-runtime.v1', '{"state": {"projectName": ');
    localStorage.setItem('rb.ide.sessionMeta.v1', '{"version":1,"projectId":');
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  assert(await visible(page.locator('[data-testid="ide-root"]').first()), 'IDE root must render after corrupt storage reload');
  assert(
    !(await page.locator('[data-testid="ide-error-boundary"]').first().isVisible().catch(() => false)),
    'corrupt storage must not show the app error boundary'
  );

  const state = await page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const authority = document.querySelector('[data-testid="ide-verify-v2-authority"]');
    return {
      projectName: runtime?.projectName ?? null,
      nodeCount: runtime?.circuit?.nodes?.length ?? 0,
      lastRunStatus: runtime?.verifyLastRun?.status ?? null,
      dirtySinceVerify: runtime?.projectHealthCore?.dirtySinceVerify ?? null,
      authorityStatus: authority?.getAttribute('data-result-status') ?? null,
      bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500),
    };
  });
  assert(state.projectName, `runtime must recover to a valid project state, got ${JSON.stringify(state)}`);
  assert(
    state.lastRunStatus !== 'pass' && state.authorityStatus !== 'pass',
    `corrupt persisted state must not resurrect a trusted PASS, got ${JSON.stringify(state)}`
  );
  assert(!/ErrorBoundary|Something went wrong/i.test(state.bodyText), `recovered UI must not show fatal error copy: ${state.bodyText}`);

  assert(
    findings.length === 0,
    `corrupt-state recovery gate emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`
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

async function readV2AuthorityStatus(page) {
  const authority = page.locator('[data-testid="ide-verify-v2-authority"]').first();
  if (await authority.isVisible().catch(() => false)) {
    return (await authority.getAttribute('data-result-status')) ?? '';
  }
  return (await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')) ?? '';
}
