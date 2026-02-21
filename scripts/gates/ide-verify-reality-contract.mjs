#!/usr/bin/env node
/**
 * ide-verify-reality-contract
 *
 * Deterministic trace contract. The gate always creates its own vector set
 * (Generate Basics + 5 manually added ticks) so the trace length is stable
 * regardless of which example was loaded or what vectors were pre-seeded.
 *
 * Requires Design-mode simulation to run first so sim.trace is populated.
 * buildVerifyRowsFromRuntimeTrace early-exits if sim.trace.length === 0.
 *
 * Trace data hooks come from:
 *   [data-testid="ide-verify-workbench"][data-trace-ticks]
 *   [data-testid="ide-verify-workbench"][data-trace-signals]
 */

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE verify reality contract satisfied', async ({ page, baseUrl }) => {
  // ── 1. Load AND gate example ──────────────────────────────────────────────
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });

  await page.locator('[data-testid="ide-project-open-example-and-gate-basics"]').click();
  const confirmBtn = page.locator('[data-testid="ide-example-confirm"]');
  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmBtn.click();
  }
  await page.waitForSelector('[data-testid="ide-guided-strip"]', { timeout: 10000 });

  // ── 2. Navigate to Design and run simulation to populate sim.trace ─────────
  //   buildVerifyRowsFromRuntimeTrace early-exits when sim.trace.length === 0,
  //   so we must advance simulation before verifying.
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  await page.locator('[data-testid="ide-design-sim-run"]').click();
  await page.waitForFunction(
    () => {
      const tick = Number(document.querySelector('[data-testid="ide-design-sim-tick"]')?.textContent ?? '0');
      return tick >= 30;
    },
    { timeout: 15000 }
  );
  await page.locator('[data-testid="ide-design-sim-pause"]').click().catch(() => null);

  // ── 3. Navigate to Verify ─────────────────────────────────────────────────
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  // ── 4. Pre-run status must be BLOCKED or READY (never raw IDLE) ───────────
  const preRunStatus = (
    await page
      .locator('[data-testid="ide-verify-panel-status"]')
      .first()
      .textContent()
      .catch(() => '')
  )?.trim() ?? '';
  assert(
    preRunStatus === 'BLOCKED' || preRunStatus === 'READY',
    `pre-run status must be BLOCKED or READY, got "${preRunStatus}"`
  );
  assert(
    !/^IDLE/i.test(
      (await page.locator('[data-testid="ide-verify-status-label"]').first().textContent().catch(() => '')) ?? ''
    ),
    'status label must not show raw IDLE before run'
  );

  // ── 5. Always reset to a known vector set (Generate Basics replaces any
  //       pre-seeded vectors with exactly ticks 0, 1, 2) ────────────────────
  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-verify-panel-status"]')?.textContent?.trim() === 'READY',
    { timeout: 5000 }
  );

  // ── 6. Add 5 more ticks so vector count = 8 ──────────────────────────────
  //   Basics gives ticks 0, 1, 2 → add 5, 10, 15, 20, 25 → 8 total ticks
  const tickInput = page.locator('[data-testid="ide-verify-add-vector-tick"]').first();
  const addBtn = page.locator('[data-testid="ide-verify-add-vector-submit"]').first();

  for (const tick of [5, 10, 15, 20, 25]) {
    await tickInput.fill(String(tick));
    await addBtn.click();
    await page.waitForTimeout(80);
  }

  // ── 7. Run must be enabled ────────────────────────────────────────────────
  const runBtn = page.locator('[data-testid="ide-verify-run"]').first();
  const runDisabled = await runBtn.getAttribute('disabled').catch(() => null);
  assert(runDisabled === null, 'Run button must be enabled after adding vectors');

  // ── 8. Run verification ───────────────────────────────────────────────────
  await runBtn.click();
  await page.waitForFunction(
    () => /PASS|FAIL/i.test(document.querySelector('[data-testid="ide-verify-status-label"]')?.textContent ?? ''),
    { timeout: 15000 }
  );

  // ── 9. Assert PASS or FAIL ────────────────────────────────────────────────
  const statusLabel = (
    await page.locator('[data-testid="ide-verify-status-label"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(/PASS|FAIL/i.test(statusLabel), `status must be PASS or FAIL after run, got "${statusLabel}"`);

  // ── 10. Assert no-trace guard is absent (trace was produced) ──────────────
  const noTraceGuard = page.locator('[data-testid="ide-verify-no-trace-guard"]').first();
  assert(!(await noTraceGuard.isVisible().catch(() => false)), 'no-trace guard must not appear when trace was produced');

  // ── 11. Assert trace shape via data hooks ─────────────────────────────────
  //   AND gate example has 1 output signal (ld0), so data-trace-signals >= 1.
  //   8 vectors cover 8 distinct ticks → data-trace-ticks >= 8.
  const workbench = page.locator('[data-testid="ide-verify-workbench"]').first();
  assert(await visible(workbench), 'workbench must be visible after run');

  const traceTicks = Number(await workbench.getAttribute('data-trace-ticks').catch(() => '0'));
  const traceSignals = Number(await workbench.getAttribute('data-trace-signals').catch(() => '0'));

  assert(traceTicks >= 8, `trace must have ≥8 ticks, got ${traceTicks}`);
  assert(traceSignals >= 1, `trace must have ≥1 signal, got ${traceSignals}`);

  // ── 12. Waveform DOM structure present ────────────────────────────────────
  const waveformGrid = page.locator('[data-testid="ide-verify-waveform-grid"]').first();
  assert(await visible(waveformGrid), 'waveform grid must be visible after run');

  const signalList = page.locator('[data-testid="ide-verify-signal-list"]').first();
  assert(await visible(signalList), 'signal list must be visible after run');

  const signalRows = await page.locator('[data-testid^="ide-verify-signal-"]').count().catch(() => 0);
  assert(signalRows >= 1, `signal list must have ≥1 row, got ${signalRows}`);

  const waveformRows = await page.locator('[data-testid^="ide-verify-waveform-row-"]').count().catch(() => 0);
  assert(waveformRows >= 1, `waveform must have ≥1 signal row, got ${waveformRows}`);
});
