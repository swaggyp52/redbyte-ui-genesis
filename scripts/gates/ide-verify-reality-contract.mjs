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

await runIdeGate('IDE verify reality contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page);

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const preRunStatus = (
    await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    preRunStatus === 'BLOCKED' || preRunStatus === 'READY',
    `pre-run status must be BLOCKED or READY, got "${preRunStatus}"`
  );

  await ensureVerifyVectorsReady(page);

  const runBtn = page.locator('[data-testid="ide-vcb-run"]').first();
  assert(!(await runBtn.isDisabled().catch(() => false)), 'run button must be enabled once vectors exist');

  await runBtn.click();
  await waitForVerifyResult(page, { timeout: 15000 });

  const statusLabel = (
    await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    /ASSERTIONS|STIMULUS|PASS|FAIL|TRACE/i.test(statusLabel),
    `status must reflect a completed verify state, got "${statusLabel}"`
  );

  const noTraceGuard = page.locator('[data-testid="ide-verify-no-trace-guard"]').first();
  assert(
    !(await noTraceGuard.isVisible().catch(() => false)),
    'no-trace guard must not appear when deterministic trace was captured'
  );

  const workbench = page.locator('[data-testid="ide-verify-workbench"]').first();
  assert(await visible(workbench), 'verify workbench must render after run');

  const traceTicks = Number(await workbench.getAttribute('data-trace-ticks').catch(() => '0'));
  const traceSignals = Number(await workbench.getAttribute('data-trace-signals').catch(() => '0'));
  assert(traceTicks >= 8, `trace must have >=8 ticks after deterministic vector set, got ${traceTicks}`);
  assert(traceSignals >= 1, `trace must have >=1 signal, got ${traceSignals}`);

  const waveformGrid = page.locator('[data-testid="ide-verify-workspace-waveform"]').first();
  assert(await visible(waveformGrid), 'waveform grid must be visible after run');

  const signalList = page.locator('[data-testid="ide-verify-signal-list"]').first();
  if (!(await visible(signalList))) {
    const leftDockToggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
    assert(await visible(leftDockToggle), 'left dock toggle must be visible when signal list is collapsed');
    await leftDockToggle.click();
  }
  assert(await visible(signalList), 'signal list must be visible after run');

  const signalRows = await page.locator('[data-testid^="ide-verify-signal-"]').count().catch(() => 0);
  assert(signalRows >= 1, `signal list must show at least one signal, got ${signalRows}`);
});
