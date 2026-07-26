#!/usr/bin/env node

/**
 * IDE blank-canvas product proof gate.
 *
 * Proves a student can complete the full design workflow from a truly blank
 * canvas - no starter project loaded, no fixture injected - in the real browser:
 *
 *   Design (empty state -> add AND starter) ->
 *   Verify (Observe -> save outputs -> Compare -> PASS) ->
 *   Hardware (map table shows rows, pin assignment attempted) ->
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

const REQUIRED_EXPORT_ARTIFACTS = [
  'top.vhd',
  'top.xdc',
  'testbench.vhd',
  'readme.txt',
  'vivado_import.tcl',
  'project.rbproj.json',
];

async function assignFirstCompatibleResource(page, row, label) {
  await row.click();
  await page.waitForTimeout(120);
  const select = page.locator('[data-testid="ide-hw-direct-resource-select"]').first();
  await select.waitFor({ state: 'visible', timeout: 10000 });
  const optionValue = await select.locator('option').evaluateAll((options) => {
    const candidate = options.find((option) => option instanceof HTMLOptionElement && !option.disabled && option.value.length > 0);
    return candidate instanceof HTMLOptionElement ? candidate.value : '';
  });
  assert(optionValue.length > 0, `${label}: no compatible Basys3 resource is available`);
  await select.selectOption(optionValue);
  await page.locator('[data-testid="ide-hw-assign-selected-resource"]').first().click();
  await page.waitForTimeout(120);
  return optionValue;
}

await runIdeGate('IDE blank-canvas product proof satisfied', async ({ page, baseUrl }) => {
  // Bootstrap
  // Suppress onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/?mode=project`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });

  // PHASE 1: Reset to blank canvas
  console.log('  Phase 1: resetting to blank canvas...');
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const blankProject = {
      kind: 'rb-project',
      version: 1,
      createdAt: now,
      updatedAt: now,
      name: 'From Scratch Gate',
      description: 'Browser gate project seeded from an empty circuit.',
      circuit: { nodes: [], connections: [] },
      ioMapping: { inputs: [], outputs: [] },
      vectors: [],
      macros: [],
      customComponents: [],
      meta: {
        projectId: 'rb-from-scratch-gate',
        projectKind: 'blank',
        sourceExampleId: null,
        activeExampleId: null,
      },
    };
    window.__RB_PROJECT_RUNTIME__?.getState()?.loadFromProject?.(blankProject);
    window.__RB_PROJECT_RUNTIME__?.getState()?.startBlankProject?.();
    window.__RB_CIRCUIT_STORE__?.getState()?.reset();
  });

  // Navigate to Design surface.
  const buildFresh = page.locator('[data-testid="ide-project-build-fresh-primary"]').first();
  if (await buildFresh.isVisible().catch(() => false)) {
    await buildFresh.click();
  } else {
    await page.locator('[data-testid="mode-button-design"]').click();
  }
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  // Confirm empty state is shown (0 nodes).
  const emptyState = page.locator('[data-testid="ide-design-empty-state"]').first();
  assert(await visible(emptyState), 'blank canvas must show empty state on Design surface after reset');

  const baseline = await page.evaluate(
    () => window.__RB_CIRCUIT_STORE__?.getState()?.circuit?.nodes?.length ?? 0
  );
  assert(baseline === 0, `expected 0 nodes on blank canvas, got ${baseline}`);
  console.log('  PASS blank canvas confirmed (0 nodes)');

  // PHASE 2: Add AND starter via real UI click
  console.log('  Phase 2: clicking Add IO + AND gate quick action...');
  const addAndAction = page
    .locator('[data-testid="ide-design-empty-add-and"], [data-testid="ide-design-add-and-starter"]')
    .first();
  assert(await visible(addAndAction), 'empty state must offer Add IO + AND gate quick action');

  // Use dispatchEvent to avoid any overlay interception.
  await addAndAction.evaluate((el) =>
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
  );

  // Wait for 4+ nodes (2 INPUT, AND, OUTPUT) and 3+ connections (pre-wired by addAndGateStarter).
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
  console.log(`  PASS circuit placed: ${inputCount} inputs, ${andCount} AND, ${outputCount} outputs, ${connectionCount} connections`);

  // Wait for projectIoRows to be populated by addAndGateStarter (at least 3 rows:
  // 2 inputs + 1 output, now that addAndGateStarter uses addDesignIo for IO nodes).
  await page.waitForFunction(
    () => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows?.length ?? 0) >= 3,
    { timeout: 5000 }
  ).catch(() => null);

  const ioRowCount = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows?.length ?? 0
  );
  console.log(`  INFO IO rows confirmed: ${ioRowCount}`);

  // PHASE 3: Verify - Observe -> save outputs -> Compare -> PASS
  console.log('  Phase 3: running Verify...');
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });

  // Generate test vectors if none exist yet.  If they were just generated,
  // wait for the table to appear before running - the generate click is async.
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

  // Wait for the waveform workspace to render - the save button lives inside it.
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
  console.log(`  PASS observed outputs saved (via ${savedSelector})`);

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
  console.log('  INFO compare run clicked, waiting for terminal status...');

  // Use waitForVerifyResult which waits for stable terminal states (CHECKS ALIGNED, etc.)
  await waitForVerifyResult(page, { timeout: 20000 });

  const verifyStatusText =
    (await page
      .locator('[data-testid="ide-verify-summary-status"]')
      .first()
      .textContent()
      .catch(() => '')) ?? '';
  let verifyStatus = verifyStatusText.trim();

  assert(isVerifyPass(verifyStatus), `Compare run must PASS, got "${verifyStatus}"`);
  console.log(`  PASS Verify Compare PASS (status: "${verifyStatus}")`);

  // PHASE 4: Hardware - Map Pins
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

  const allMapRows = page.locator('button[data-testid^="ide-hw-map-row-"]');
  const mapRowCount = await allMapRows.count();
  assert(
    mapRowCount > 0,
    `Hardware map table must show IO rows for a blank-canvas circuit, found ${mapRowCount}`
  );
  console.log(`  PASS map table visible (${mapRowCount} IO rows)`);

  // Assign each derived boundary row through the selected-signal resource control.
  // The compact board is intentionally reference-only because its SVG regions cannot
  // provide non-overlapping 36px targets at laptop widths.
  const firstRow = allMapRows.nth(0);
  if (await firstRow.isVisible().catch(() => false)) {
    const resource = await assignFirstCompatibleResource(page, firstRow, 'first mapping row');
    console.log(`  PASS first map row assigned through resource control (${resource})`);
  }

  if (mapRowCount >= 2) {
    const secondRow = allMapRows.nth(1);
    if (await secondRow.isVisible().catch(() => false)) {
      const resource = await assignFirstCompatibleResource(page, secondRow, 'second mapping row');
      console.log(`  PASS second map row assigned through resource control (${resource})`);
    }
  }

  if (mapRowCount >= 3) {
    const thirdRow = allMapRows.nth(2);
    if (await thirdRow.isVisible().catch(() => false)) {
      const resource = await assignFirstCompatibleResource(page, thirdRow, 'third mapping row');
      console.log(`  PASS third map row assigned through resource control (${resource})`);
    }
  }

  // PHASE 5: Export - panel visible + download button present
  await page.waitForFunction(
    () => {
      const rows = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? [];
      const required = rows.filter((row) => row?.required);
      return required.length >= 3 && required.every((row) => String(row.pin ?? '').trim().length > 0);
    },
    { timeout: 8000 }
  );

  console.log('  Phase 4b: rerunning Verify after Map Pins...');
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  assert(
    await setVerifyRunMode(page, 'compare'),
    'mapped from-scratch proof requires Compare mode after Map Pins'
  );
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  verifyStatus =
    ((await page
      .locator('[data-testid="ide-verify-summary-status"]')
      .first()
      .textContent()
      .catch(() => '')) ?? '').trim();
  assert(isVerifyPass(verifyStatus), `Post-map Compare run must PASS, got "${verifyStatus}"`);
  console.log(`  PASS post-map Verify Compare PASS (status: "${verifyStatus}")`);

  console.log('  Phase 5: checking Export surface...');
  await page.locator('[data-testid="mode-button-export"]').click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });

  const exportPanel = page.locator('[data-testid="ide-export-panel"]').first();
  assert(await visible(exportPanel), 'Export panel must be visible after completing blank-canvas flow');

  await page.locator('[data-testid="ide-export-open-technical-evidence"]').first().click();
  await page.waitForSelector('[data-testid="ide-export-technical-dialog"]', { state: 'visible', timeout: 10000 });
  const gateStack = page.locator('[data-testid="ide-export-gate-stack"]').first();
  assert(await visible(gateStack), 'Export technical evidence must expose the readiness gate stack');
  console.log('  PASS export gate stack visible');
  const exportDiagnosticsText =
    (await page.locator('[data-testid="ide-export-blockers-list"]').first().textContent().catch(() => '')) ?? '';
  await page.locator('[data-testid="ide-export-close-technical-evidence"]').first().click();
  await page.locator('[data-testid="ide-export-technical-dialog"]').waitFor({ state: 'detached', timeout: 10000 });

  async function readPreviewByPath(artifactPath) {
    const tab = page
      .locator('[data-testid="ide-export-artifact-tabs"] button')
      .filter({ hasText: artifactPath })
      .first();
    assert(await tab.isVisible().catch(() => false), `package file for "${artifactPath}" must be visible`);
    await tab.click();

    await page.waitForFunction(
      (expected) => {
        const marker = document.querySelector('[data-testid="ide-export-preview-path"]');
        return (marker?.textContent ?? '').trim().toLowerCase() === expected.toLowerCase();
      },
      artifactPath,
      { timeout: 10000 }
    );

    return (
      (await page.locator('[data-testid="ide-export-preview-code"]').first().textContent().catch(() => '')) ?? ''
    ).trim();
  }

  const artifactPreview = page.locator('[data-testid="ide-export-artifact-preview"]').first();
  assert(await visible(artifactPreview), 'Export artifact workspace must be visible');

  const artifactPaths = (await page
    .locator('[data-testid="ide-export-artifact-tabs"] button')
    .evaluateAll((elements) =>
      elements.map((element) =>
        (element.querySelector('span')?.textContent ?? element.textContent ?? '').trim().toLowerCase()
      )
    ))
    .filter((entry) => entry.length > 0);
  assert(artifactPaths.length > 0, 'Export artifact tabs must be present for from-scratch circuit');

  for (const artifact of REQUIRED_EXPORT_ARTIFACTS) {
    assert(
      artifactPaths.includes(artifact),
      `from-scratch export artifact list missing ${artifact}`
    );
  }

  const readmeText = await readPreviewByPath('README.txt');
  console.log(`  export artifact tabs: ${artifactPaths.join(', ')}`);
  console.log(`  README preview length: ${readmeText.length}`);
  console.log(`  export diagnostics: ${exportDiagnosticsText.replace(/\s+/g, ' ').trim() || '(none visible)'}`);
  assert(
    !/\bERROR\b/.test(exportDiagnosticsText),
    `Export diagnostics must not include blocking errors: ${exportDiagnosticsText.replace(/\s+/g, ' ').trim()}`
  );
  assert(readmeText.length > 0, 'README.txt preview must not be empty');
  assert(/Vivado/i.test(readmeText), 'README.txt preview must include Vivado handoff guidance');
  assert(
    /E0|export/i.test(readmeText),
    'README.txt preview must keep the export evidence boundary visible'
  );
  console.log('  ok export artifact list and README preview visible');

  // A download/build button must be present (primary CTA).
  const downloadBtn = page
    .locator(
      [
        '[data-testid="ide-export-package-download-v1"]',
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
  const downloadEnabled = await downloadBtn.isEnabled().catch(() => false);
  assert(downloadEnabled, 'Export primary action button must be enabled for the from-scratch circuit');

  // Capture trust tier label for the proof report.
  const trustLabel =
    (await page
      .locator('[data-testid="ide-export-trust-label"], [data-testid="ide-export-status-label"]')
      .first()
      .textContent()
      .catch(() => '')) ?? '';

  console.log(`  PASS export download button present`);
  console.log('');
  console.log('  --- Blank-canvas proof summary ---');
  console.log(`  Verify status  : ${verifyStatus}`);
  console.log(`  IO map rows    : ${mapRowCount}`);
  console.log(`  Trust label    : ${trustLabel.trim() || '(not captured)'}`);
  console.log('  Proof level    : L0 (UX valid) + E0 (export bundle reachable)');
  console.log('  ----------------------------------');
});
