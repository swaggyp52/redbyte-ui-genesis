#!/usr/bin/env node

/**
 * IDE blank-canvas product proof gate.
 *
 * Proves a student can complete the full design workflow from a truly blank
 * canvas — no starter project loaded, no fixture injected — in the real browser:
 *
 *   Design (empty state → add AND starter) →
 *   Verify (Observe → save outputs → Compare → PASS) →
 *   Hardware (map table shows rows, pin assignment attempted) →
 *   Export (panel renders, download button present)
 *
 * Proof level: L0 (UX valid) + E0 (export bundle reachable).
 * E1/E2/E3 require physical Vivado / Basys3 hardware and are out of scope here.
 */

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  runIdeGate,
  saveObservedOutputs,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

await runIdeGate('IDE blank-canvas product proof satisfied', async ({ page, baseUrl }) => {
  // ── Bootstrap ───────────────────────────────────────────────────────
  // Suppress onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  // ── PHASE 1: Reset to blank canvas ───────────────────────────────────
  console.log('  Phase 1: resetting to blank canvas...');
  await page.evaluate(() => {
    window.__RB_CIRCUIT_STORE__?.getState()?.reset();
  });

  // Navigate to Design surface.
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  // Confirm empty state is shown (0 nodes).
  const emptyState = page.locator('[data-testid="ide-design-empty-state"]').first();
  assert(await visible(emptyState), 'blank canvas must show empty state on Design surface after reset');

  const baseline = await page.evaluate(
    () => window.__RB_CIRCUIT_STORE__?.getState()?.circuit?.nodes?.length ?? 0
  );
  assert(baseline === 0, `expected 0 nodes on blank canvas, got ${baseline}`);
  console.log('  ✓ blank canvas confirmed (0 nodes)');

  // ── PHASE 2: Add AND starter via real UI click ───────────────────────
  console.log('  Phase 2: clicking Add IO + AND gate quick action...');
  const addAndAction = page
    .locator('[data-testid="ide-design-empty-add-and"], [data-testid="ide-design-add-and-starter"]')
    .first();
  assert(await visible(addAndAction), 'empty state must offer Add IO + AND gate quick action');

  // Use dispatchEvent to avoid any overlay interception.
  await addAndAction.evaluate((el) =>
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
  );

  // Wait for 4+ nodes (2× INPUT, AND, OUTPUT) and 3+ connections (pre-wired by addAndGateStarter).
  await page.waitForFunction(
    (b) => (window.__RB_CIRCUIT_STORE__?.getState()?.circuit?.nodes?.length ?? 0) >= b + 4,
    baseline,
    { timeout: 10000 }
  );
  await page.waitForFunction(
    () => (window.__RB_CIRCUIT_STORE__?.getState()?.circuit?.connections?.length ?? 0) >= 3,
    { timeout: 5000 }
  );

  const inputCount = await page.locator('[data-testid^="node-INPUT-"]').count();
  const andCount = await page.locator('[data-testid^="node-AND-"]').count();
  const outputCount = await page.locator('[data-testid^="node-OUTPUT-"]').count();

  assert(inputCount >= 2, `expected 2+ INPUT nodes, found ${inputCount}`);
  assert(andCount >= 1, `expected AND node, found ${andCount}`);
  assert(outputCount >= 1, `expected OUTPUT node, found ${outputCount}`);

  const connectionCount = await page.evaluate(
    () => window.__RB_CIRCUIT_STORE__?.getState()?.circuit?.connections?.length ?? 0
  );
  console.log(`  ✓ circuit placed: ${inputCount} inputs, ${andCount} AND, ${outputCount} outputs, ${connectionCount} connections`);

  // Wait for projectIoRows to be populated by addAndGateStarter (at least 3 rows:
  // 2 inputs + 1 output, now that addAndGateStarter uses addDesignIo for IO nodes).
  await page.waitForFunction(
    () => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows?.length ?? 0) >= 3,
    { timeout: 5000 }
  ).catch(() => null);

  const ioRowCount = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows?.length ?? 0
  );
  console.log(`  → IO rows confirmed: ${ioRowCount}`);

  // ── PHASE 3: Verify — Observe → save outputs → Compare → PASS ────────
  console.log('  Phase 3: running Verify...');
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  // Generate test vectors if none exist yet.  If they were just generated,
  // wait for the table to appear before running — the generate click is async.
  const vectorsStatus = await ensureVerifyVectorsReady(page);
  if (vectorsStatus === 'generated') {
    // ensureVerifyVectorsReady already polls for run bar "N vectors" confirmation.
    // Small settle so the run button becomes enabled.
    await page.waitForTimeout(300);
  }

  // Explicitly confirm Observe mode (no expected outputs exist yet).
  await setVerifyRunMode(page, 'observe');

  // First run in Observe mode to capture outputs.
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });

  // Wait for the waveform workspace to render — the save button lives inside it.
  await page
    .waitForSelector('[data-testid="ide-verify-workspace-waveform"]', { timeout: 10000 })
    .catch(() => null);
  // Allow React to finish flushing the post-run state update.
  await page.waitForTimeout(300);

  // Save observed outputs so Compare mode becomes available.
  const savedSelector = await saveObservedOutputs(page);
  assert(
    savedSelector != null,
    'must be able to save observed outputs from blank-canvas Observe run'
  );
  console.log(`  ✓ observed outputs saved (via ${savedSelector})`);

  // Wait for expected values to persist through normalizeVectorsForLiveIo and
  // React re-render so the compare button reflects the saved checks.
  await page.waitForFunction(
    () => {
      const rows = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? [];
      return rows.some((v) => Object.keys(v.expected ?? {}).length > 0);
    },
    { timeout: 8000 }
  ).catch(() => null);

  // Ensure compare button is visible and active before the second run.
  const compareBtnVisible = await page
    .waitForSelector('[data-testid="ide-vcb-use-saved-checks"]', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  assert(compareBtnVisible, 'Compare mode button must appear after saving observed outputs');

  // Activate compare mode explicitly.
  await page.locator('[data-testid="ide-vcb-use-saved-checks"]').first().click().catch(() => null);
  await page.waitForTimeout(150);

  await clickVerifyRun(page);
  console.log('  → compare run clicked, waiting for terminal status...');

  // Use waitForVerifyResult which waits for stable terminal states (CHECKS ALIGNED, etc.)
  await waitForVerifyResult(page, { timeout: 20000 });

  const verifyStatusText =
    (await page
      .locator('[data-testid="ide-verify-summary-status"]')
      .first()
      .textContent()
      .catch(() => '')) ?? '';
  const verifyStatus = verifyStatusText.trim();

  assert(isVerifyPass(verifyStatus), `Compare run must PASS, got "${verifyStatus}"`);
  console.log(`  ✓ Verify Compare PASS (status: "${verifyStatus}")`);

  // ── PHASE 4: Hardware — Map Pins ────────────────────────────────────
  console.log('  Phase 4: checking Hardware / Map Pins...');
  await page.locator('[data-testid="mode-button-hardware"]').click();
  await page.waitForSelector('[data-testid="ide-mode-hardware"]', { timeout: 10000 });

  // Ensure we are in map mode (the tab may already be active by default).
  const mapModeBtn = page.locator('[data-testid="ide-hw-mode-btn-map"]').first();
  if (await mapModeBtn.isVisible().catch(() => false)) {
    await mapModeBtn.click();
  }

  // Map table must be visible and have IO rows.
  const mapTable = page.locator('[data-testid="ide-hw-map-table"]').first();
  assert(await visible(mapTable), 'Hardware map table must be visible in Map Pins mode');

  const mapRowCount = await page.locator('[data-testid^="ide-hw-map-row-"]').count();
  assert(
    mapRowCount > 0,
    `Hardware map table must show IO rows for a blank-canvas circuit, found ${mapRowCount}`
  );
  console.log(`  ✓ map table visible (${mapRowCount} IO rows)`);

  // Attempt to assign the first row a switch pin and an LED pin.
  // Rows for a blank-canvas IO + AND circuit are derived at runtime from
  // node labels, so we use generic selectors rather than hardcoded row ids.
  const allMapRows = page.locator('[data-testid^="ide-hw-map-row-"]');

  // Try to assign the first available row to SW0.
  const firstRow = allMapRows.nth(0);
  if (await firstRow.isVisible().catch(() => false)) {
    await firstRow.click().catch(() => null);
    // Give the selection state a moment to apply.
    await page.waitForTimeout(300);
    const sw0 = page.locator('[data-testid="ide-hw-map-sw-0"]').first();
    if (await sw0.isVisible().catch(() => false)) {
      await sw0.click({ force: true }).catch(() => null);
      await page.waitForTimeout(300);
      console.log('  ✓ first map row assigned to SW0 (attempted)');
    } else {
      console.log('  ! ide-hw-map-sw-0 not visible; skipping switch assignment');
    }
  }

  // If there is a second row, assign it to SW1.
  if (mapRowCount >= 2) {
    const secondRow = allMapRows.nth(1);
    if (await secondRow.isVisible().catch(() => false)) {
      await secondRow.click().catch(() => null);
      await page.waitForTimeout(300);
      const sw1 = page.locator('[data-testid="ide-hw-map-sw-1"]').first();
      if (await sw1.isVisible().catch(() => false)) {
        await sw1.click({ force: true }).catch(() => null);
        await page.waitForTimeout(300);
        console.log('  ✓ second map row assigned to SW1 (attempted)');
      }
    }
  }

  // If there is a third row, assign it to LD0.
  if (mapRowCount >= 3) {
    const thirdRow = allMapRows.nth(2);
    if (await thirdRow.isVisible().catch(() => false)) {
      await thirdRow.click().catch(() => null);
      await page.waitForTimeout(300);
      const ld0 = page.locator('[data-testid="ide-hw-map-ld-0"]').first();
      if (await ld0.isVisible().catch(() => false)) {
        await ld0.click({ force: true }).catch(() => null);
        await page.waitForTimeout(300);
        console.log('  ✓ third map row assigned to LD0 (attempted)');
      }
    }
  }

  // ── PHASE 5: Export — panel visible + download button present ────────
  console.log('  Phase 5: checking Export surface...');
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const exportPanel = page.locator('[data-testid="ide-export-panel"]').first();
  assert(await visible(exportPanel), 'Export panel must be visible after completing blank-canvas flow');

  // Open gate details if available.
  await page
    .evaluate(() => {
      const el = document.querySelector('[data-testid="ide-export-gate-details"]');
      if (el && 'open' in el) el.open = true;
    })
    .catch(() => null);

  // Gate stack should be accessible.
  const gateStack = page.locator('[data-testid="ide-export-gate-stack"]').first();
  const gateStackVisible = await visible(gateStack).catch(() => false);
  if (!gateStackVisible) {
    console.log('  ! gate stack not visible (may be behind a details toggle)');
  } else {
    console.log('  ✓ export gate stack visible');
  }

  // A download/build button must be present (primary CTA).
  const downloadBtn = page
    .locator(
      [
        '[data-testid="ide-export-rebuild-btn"]',
        '[data-testid="ide-export-dock-download"]',
        '[data-testid="ide-export-download-kit-btn"]',
        '[data-testid="ide-export-download-btn"]',
        '[data-testid="ide-export-download-draft"]',
        '[data-testid="ide-export-vivado-download"]',
        '[data-testid="ide-export-download"]',
      ].join(', ')
    )
    .first();
  const downloadVisible = await downloadBtn.isVisible().catch(() => false);
  assert(
    downloadVisible,
    'Export primary action button must be present for a complete blank-canvas circuit after Verify PASS'
  );

  // Capture trust tier label for the proof report.
  const trustLabel =
    (await page
      .locator('[data-testid="ide-export-trust-label"], [data-testid="ide-export-status-label"]')
      .first()
      .textContent()
      .catch(() => '')) ?? '';

  console.log(`  ✓ export download button present`);
  console.log('');
  console.log('  ─── Blank-canvas proof summary ───');
  console.log(`  Verify status  : ${verifyStatus}`);
  console.log(`  IO map rows    : ${mapRowCount}`);
  console.log(`  Trust label    : ${trustLabel.trim() || '(not captured)'}`);
  console.log('  Proof level    : L0 (UX valid) + E0 (export bundle reachable)');
  console.log('  ──────────────────────────────────');
});
