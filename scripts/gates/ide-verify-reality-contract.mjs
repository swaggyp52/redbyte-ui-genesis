#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE verify reality contract satisfied', async ({ page, baseUrl }) => {
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await loadStarterProject(page, { exactExampleId: 'signal-tour' });

  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  const preRunStatus = (
    await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    /Scenario ready/i.test(preRunStatus),
    `loaded starter must report Scenario ready before its first run, got "${preRunStatus}"`
  );

  await ensureVerifyVectorsReady(page);

  const runBtn = page.locator('[data-testid="ide-vcb-run"]').first();
  assert(!(await runBtn.isDisabled().catch(() => false)), 'run button must be enabled once vectors exist');
  assert(
    await page.locator('[data-testid="ide-vcb-workspace-scenario"]').first().isVisible().catch(() => false),
    'Verify must expose the Scenario workspace before a run'
  );
  assert(
    await page.locator('[data-testid="ide-vcb-workspace-checks"]').first().isVisible().catch(() => false),
    'Verify must expose optional Checks beside the Scenario workspace'
  );
  assert(
    /Run simulation/i.test((await runBtn.textContent().catch(() => '')) ?? ''),
    'Verify must expose one simulation run authority'
  );
  assert(
    await setVerifyRunMode(page, 'compare'),
    'saved starter checks must be recognized for automatic evaluation'
  );

  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });

  const compareStatus = (
    await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    isVerifyPass(compareStatus),
    `starter simulation with saved checks must produce a PASS state, got "${compareStatus}"`
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

  const signalShelf = page.locator('[data-testid="ide-verify-signal-shelf"]').first();
  const signalShelfList = page.locator('[data-testid="ide-verify-signal-shelf-list"]').first();
  assert(await visible(signalShelf), 'integrated signal shelf must remain visible after run');
  assert(await visible(signalShelfList), 'integrated signal shelf list must remain visible after run');

  const signalRows = await page.locator('[data-testid^="ide-verify-shelf-signal-"]').count().catch(() => 0);
  assert(signalRows >= 1, `integrated signal shelf must show at least one signal, got ${signalRows}`);
});
