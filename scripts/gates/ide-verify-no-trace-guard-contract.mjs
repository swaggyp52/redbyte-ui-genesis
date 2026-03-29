#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

async function ensureVerifyVectorsReady(page) {
  const candidates = [
    '[data-testid="ide-verify-generate-basic-vectors"]',
    '[data-testid="ide-verify-generate-basic-vectors-footer"]',
    '[data-testid="ide-verify-generate-all-combos"]',
    '[data-testid="ide-verify-guided-clock-pattern"]',
    '[data-testid="ide-verify-trace-generate-basics"]',
  ];
  for (const selector of candidates) {
    const button = page.locator(selector).first();
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      await button.click();
      return;
    }
  }
}

await runIdeGate('IDE verify no-trace guard contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const noTraceGuard = page.locator('[data-testid="ide-verify-no-trace-guard"]').first();
  assert(!(await noTraceGuard.isVisible().catch(() => false)), 'no-trace guard must be hidden before a run');

  const preRunStatus = (
    await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    preRunStatus === 'BLOCKED' || preRunStatus === 'READY',
    `status must be BLOCKED or READY before run, got "${preRunStatus}"`
  );

  await ensureVerifyVectorsReady(page);
  await page.locator('[data-testid="ide-verify-run"]').click();
  await waitForVerifyResult(page, { timeout: 15000 });

  assert(
    !(await noTraceGuard.isVisible().catch(() => false)),
    'no-trace guard must remain hidden when waveform trace exists'
  );

  const workbench = page.locator('[data-testid="ide-verify-workbench"]').first();
  assert(await visible(workbench), 'verify workbench must be visible');

  const traceTicks = Number(await workbench.getAttribute('data-trace-ticks').catch(() => '0'));
  const traceSignals = Number(await workbench.getAttribute('data-trace-signals').catch(() => '0'));
  assert(traceTicks >= 3, `trace tick count must be >=3 after basic vectors, got ${traceTicks}`);
  assert(traceSignals >= 1, `trace signal count must be >=1 after run, got ${traceSignals}`);

  await page.locator('[data-testid="ide-verify-clear"]').click();
  await page.waitForTimeout(300);

  const postClearStatus = (
    await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    postClearStatus === 'READY' || postClearStatus === 'BLOCKED',
    `after Clear, status must be READY or BLOCKED, got "${postClearStatus}"`
  );
  assert(
    !(await noTraceGuard.isVisible().catch(() => false)),
    'no-trace guard must stay hidden after clearing results'
  );
});
