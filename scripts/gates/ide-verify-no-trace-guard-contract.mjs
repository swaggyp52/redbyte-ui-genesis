#!/usr/bin/env node

/**
 * ide-verify-no-trace-guard-contract
 *
 * Verifies that:
 * 1. The no-trace guard is absent before any run (no false positive on fresh load)
 * 2. After a successful traced run, the guard stays hidden
 * 3. The status machine shows BLOCKED/READY (never raw IDLE) before the run
 * 4. After Clear, the status returns to READY or BLOCKED
 * 5. Waveform data-trace-ticks/signals confirm a real trace was produced
 *
 * Requires Design-mode simulation to populate sim.trace before verifying.
 * Uses the same deterministic setup as ide-verify-reality-contract:
 *   Generate Basics (ticks 0–2) + 5 added ticks → 8 total ticks.
 */

import { assert, runIdeGate, visible } from './_gateHarness.mjs';

await runIdeGate('IDE verify no-trace guard contract satisfied', async ({ page, baseUrl }) => {
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

  // ── 4. Pre-run: guard must not be visible (no false positive) ─────────────
  const noTraceGuard = page.locator('[data-testid="ide-verify-no-trace-guard"]').first();
  assert(
    !(await noTraceGuard.isVisible().catch(() => false)),
    'no-trace guard must not be visible before any run'
  );

  // ── 5. Pre-run: status must be BLOCKED or READY (not raw IDLE) ───────────
  const preRunStatus = (
    await page.locator('[data-testid="ide-verify-panel-status"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    preRunStatus === 'BLOCKED' || preRunStatus === 'READY',
    `status must be BLOCKED or READY before run, got "${preRunStatus}"`
  );
  assert(
    !/^IDLE/i.test(
      (await page.locator('[data-testid="ide-verify-status-label"]').first().textContent().catch(() => '')) ?? ''
    ),
    'status label must not start with IDLE before run'
  );

  // ── 6. Always set a deterministic vector set ──────────────────────────────
  //   Generate Basics replaces any pre-seeded vectors with ticks 0, 1, 2.
  //   Then add ticks 5, 10, 15, 20, 25 → 8 total guaranteed ticks.
  await page.locator('[data-testid="ide-verify-generate-basic-vectors"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-verify-panel-status"]')?.textContent?.trim() === 'READY',
    { timeout: 5000 }
  );

  const tickInput = page.locator('[data-testid="ide-verify-add-vector-tick"]').first();
  const addBtn = page.locator('[data-testid="ide-verify-add-vector-submit"]').first();
  for (const tick of [5, 10, 15, 20, 25]) {
    await tickInput.fill(String(tick));
    await addBtn.click();
    await page.waitForTimeout(80);
  }

  // ── 7. Run verification ───────────────────────────────────────────────────
  const runBtn = page.locator('[data-testid="ide-verify-run"]').first();
  await runBtn.click();
  await page.waitForFunction(
    () => /PASS|FAIL/i.test(document.querySelector('[data-testid="ide-verify-status-label"]')?.textContent ?? ''),
    { timeout: 15000 }
  );

  // ── 8. Post-run: guard still absent (trace was produced) ─────────────────
  assert(
    !(await noTraceGuard.isVisible().catch(() => false)),
    'no-trace guard must not appear when trace was produced'
  );

  // ── 9. Waveform is present and data hooks confirm real trace ──────────────
  //   AND gate has 1 output signal (ld0) → data-trace-signals >= 1.
  //   8 vectors cover 8 distinct ticks → data-trace-ticks >= 8.
  const waveformGrid = page.locator('[data-testid="ide-verify-waveform-grid"]').first();
  assert(await visible(waveformGrid), 'waveform grid must be present after a traced run');

  const workbench = page.locator('[data-testid="ide-verify-workbench"]').first();
  const traceTicks = Number(await workbench.getAttribute('data-trace-ticks').catch(() => '0'));
  const traceSignals = Number(await workbench.getAttribute('data-trace-signals').catch(() => '0'));
  assert(traceTicks >= 8, `data-trace-ticks must be ≥8 confirming real trace, got ${traceTicks}`);
  assert(traceSignals >= 1, `data-trace-signals must be ≥1, got ${traceSignals}`);

  // ── 10. Clear → status returns to READY, guard stays absent ───────────────
  const clearBtn = page.locator('[data-testid="ide-verify-clear"]').first();
  await clearBtn.click();
  await page.waitForTimeout(300);

  const postClearStatus = (
    await page.locator('[data-testid="ide-verify-panel-status"]').first().textContent().catch(() => '')
  )?.trim() ?? '';
  assert(
    postClearStatus === 'READY' || postClearStatus === 'BLOCKED',
    `after Clear, status must be READY or BLOCKED, got "${postClearStatus}"`
  );
  assert(
    !(await noTraceGuard.isVisible().catch(() => false)),
    'no-trace guard must not appear after clearing results'
  );
});
