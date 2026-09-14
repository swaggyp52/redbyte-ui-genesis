#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'testbench-editor-and-export-confidence-flow',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const VIEWPORT = { label: '1366x768', width: 1366, height: 768 };

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE testbench editor and export confidence flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-testbench-editor-and-export-confidence-flow',
    generatedAtIso: new Date().toISOString(),
    viewport: VIEWPORT.label,
    phases: [],
    browserProblems,
  };

  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=testbench-editor-and-export-confidence-flow`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, 'Project startup');
  await assertNoRootOverflow(page, 'Project startup');

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  const designStats = await readProjectStats(page);
  assert(designStats.nodes >= 6, `starter circuit must be nontrivial, got ${designStats.nodes} nodes`);
  assert(designStats.connections >= 4, `starter circuit must be wired, got ${designStats.connections} connections`);
  record.phases.push({ phase: 'starter-loaded', designStats });

  await openMode(page, baseUrl, 'verify', 'testbench-editor-and-export-confidence-flow');
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 15000 });
  await assertTestbenchWorkspace(page, 'initial Verify');

  const ioRows = await readIoRows(page);
  const inputIds = ioRows.filter((row) => row.direction === 'in').map((row) => row.id);
  const outputIds = ioRows.filter((row) => row.direction === 'out').map((row) => row.id);
  assert(inputIds.length >= 2, `logic-gates starter needs at least two inputs, got ${inputIds.length}`);
  assert(outputIds.length >= 2, `logic-gates starter needs at least two outputs, got ${outputIds.length}`);

  const cases = buildGenericCases(inputIds.slice(0, 2), 4);
  await ensureCaseCount(page, cases.length);
  await authorInputCases(page, cases);
  await capture(page, '01-verify-authored-multiple-cases.png');
  const authoredCheckOutputIds = outputIds.slice(0, 2);
  await clearExpectedChecks(page, authoredCheckOutputIds, cases.length);
  await capture(page, '02-checks-unset-for-authoring.png');

  await runSimulation(page);
  await assertReplayEvidenceVisible(page);
  await capture(page, '03-run-replay-evidence.png');
  const observedOutputs = await readScenarioObservedOutputs(page, authoredCheckOutputIds, cases.length);
  await capture(page, '04-observed-values-in-scenario.png');
  await authorExpectedChecks(page, observedOutputs);
  await capture(page, '05-authored-checks.png');

  const targetTick = 1;
  const targetA = { fieldId: outputIds[0], tick: targetTick };
  const targetB = { fieldId: outputIds[1], tick: targetTick };
  const originalA = await readCellValue(page, expectedCellTestId(targetA.fieldId, targetA.tick));
  const originalB = await readCellValue(page, expectedCellTestId(targetB.fieldId, targetB.tick));
  assert(originalA === 0 || originalA === 1, `target A expected output must be saved, got ${originalA}`);
  assert(originalB === 0 || originalB === 1, `target B expected output must be saved, got ${originalB}`);

  await flipExpectedCell(page, targetA.fieldId, targetA.tick);
  await flipExpectedCell(page, targetB.fieldId, targetB.tick);
  await runCompareAndExpect(page, 'two wrong expected outputs', 'fail');
  await assertFailureRepairPanel(page, { expectRowRepair: true, expectAllRepair: true });
  await capture(page, '06-two-failed-outputs-repair-actions.png');

  await applyScopedRepair(page, 'ide-verify-repair-use-observed');
  await waitForExpectedValue(page, targetA.fieldId, targetA.tick, originalA);
  await assertExpectedCellVisibleValue(page, targetA.fieldId, targetA.tick, originalA);
  const afterCellRepairB = await readCellValue(page, expectedCellTestId(targetB.fieldId, targetB.tick));
  assert(
    afterCellRepairB !== originalB,
    `cell repair must not silently repair peer output ${targetB.fieldId}; got ${afterCellRepairB}`,
  );
  record.phases.push({ phase: 'cell-repair', target: targetA });

  await runCompareAndExpect(page, 'peer failure after surgical cell repair', 'fail');
  await assertDirectFailureEvidence(page, 'peer failure after surgical cell repair');
  await page.getByTestId('ide-verify-repair-use-observed').click();
  await waitForExpectedValue(page, targetB.fieldId, targetB.tick, originalB);
  await assertExpectedCellVisibleValue(page, targetB.fieldId, targetB.tick, originalB);
  await runCompareAndExpect(page, 'two surgical cell repairs', 'pass');
  await capture(page, '07-cell-repair-pass.png');

  await flipExpectedCell(page, targetA.fieldId, targetA.tick);
  await flipExpectedCell(page, targetB.fieldId, targetB.tick);
  await runCompareAndExpect(page, 'row repair setup', 'fail');
  await assertFailureRepairPanel(page, { expectRowRepair: true, expectAllRepair: true });
  assert(
    await page.getByTestId('ide-verify-repair-use-observed-row').isEnabled().catch(() => false),
    'row-scope repair must be enabled while the selected row has multiple failed outputs',
  );
  await applyScopedRepair(page, 'ide-verify-repair-use-observed-row');
  await waitForExpectedValue(page, targetA.fieldId, targetA.tick, originalA);
  await waitForExpectedValue(page, targetB.fieldId, targetB.tick, originalB);
  await assertExpectedCellVisibleValue(page, targetA.fieldId, targetA.tick, originalA);
  await assertExpectedCellVisibleValue(page, targetB.fieldId, targetB.tick, originalB);
  await runCompareAndExpect(page, 'row repair', 'pass');
  record.phases.push({ phase: 'row-repair', tick: targetTick });
  await capture(page, '08-row-repair-pass.png');

  await flipExpectedCell(page, targetA.fieldId, targetA.tick);
  await flipExpectedCell(page, targetB.fieldId, targetB.tick);
  await runCompareAndExpect(page, 'all failed outputs repair setup', 'fail');
  await assertDirectFailureEvidence(page, 'all failed outputs repair setup');
  await applyScopedRepair(page, 'ide-verify-repair-use-observed-all');
  await waitForExpectedValue(page, targetA.fieldId, targetA.tick, originalA);
  await waitForExpectedValue(page, targetB.fieldId, targetB.tick, originalB);
  await assertExpectedCellVisibleValue(page, targetA.fieldId, targetA.tick, originalA);
  await assertExpectedCellVisibleValue(page, targetB.fieldId, targetB.tick, originalB);
  await runCompareAndExpect(page, 'all failed repair', 'pass');
  record.phases.push({ phase: 'all-failed-repair' });
  await capture(page, '09-all-failed-repair-pass.png');

  await flipExpectedCell(page, targetA.fieldId, targetA.tick);
  await openReplayWorkspace(page);
  const staleSummary = page.getByTestId('ide-verify-evidence-state');
  await staleSummary.waitFor({ state: 'visible', timeout: 10000 });
  assert((await staleSummary.getAttribute('data-state')) === 'stale', 'Verify latest-run authority must be marked stale after an expected-output edit');
  const staleText = await text(page.getByTestId('ide-verify-evidence-state-reason'));
  assert(
    /Checks changed|scenario changed|Rerun/i.test(staleText),
    `Verify must name stale testbench evidence after edit, got "${staleText}"`,
  );
  await capture(page, '10-testbench-edit-stale.png');

  await openMode(page, baseUrl, 'export', 'testbench-editor-and-export-confidence-flow-stale-export');
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  await assertExportConfidence(page, { expectedPackage: 'draft', expectedVerify: 'stale' });
  await capture(page, '11-export-confidence-stale-draft.png');

  await openMode(page, baseUrl, 'verify', 'testbench-editor-and-export-confidence-flow-final-compare');
  await setExpectedCell(page, targetA.fieldId, targetA.tick, originalA);
  await runCompareAndExpect(page, 'final current expected outputs', 'pass');

  await openMode(page, baseUrl, 'export', 'testbench-editor-and-export-confidence-flow-current-export');
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  await assertExportConfidence(page, { expectedPackage: 'buildable-e0', expectedVerify: 'pass' });
  await capture(page, '12-export-confidence-ready-e0.png');

  record.phases.push({ phase: 'complete', outputsChecked: outputIds.slice(0, 2) });
  await writeFile(
    path.join(ARTIFACT_ROOT, 'testbench-editor-and-export-confidence-flow.json'),
    JSON.stringify(record, null, 2),
  );
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function assertTestbenchWorkspace(page, label) {
  for (const id of ['ide-case-lab','ide-case-lab-bar','ide-case-lab-add','ide-vcb-run','ide-vcb-check-count','ide-verify-context-state']) {
    assert(await page.getByTestId(id).isVisible(), label + ': ' + id + ' must be visible');
  }
  assert(await page.getByTestId('ide-verify-view-table').getAttribute('aria-pressed') === 'true', 'Table owns case authoring');
  assert(await page.getByTestId('ide-verify-view-waveform').isDisabled(), 'Recorded trace requires a completed run');
  assert(await page.locator('[data-testid^="ide-case-lab-input-"]').count() >= 8, 'four cases expose all inputs');
  assert(await page.locator('[data-testid^="ide-case-lab-exp-"]').count() >= 12, 'optional checks remain directly editable beside observations');
  const hint = await page.locator('[data-testid^="ide-case-lab-exp-"]').first().getAttribute('title');
  assert(/Expected.*0.*1.*none/i.test(hint), 'optional check editing describes none semantics');
  const geometry = await page.getByTestId('ide-case-lab').boundingBox();
  const lab = await page.getByTestId('ide-verify-lab-grid').boundingBox();
  assert(geometry.width >= lab.width * .96, label + ': case table owns available width');
  assert(/Ready|Draft|Not started/i.test(await text(page.getByTestId('ide-verify-context-state'))), 'pre-run status names unrun cases');
  assert(await page.locator('[data-testid^="ide-testbench-section-"]').count() === 0, 'retired section scaffold remains absent');
  await assertNoRootOverflow(page, label);
}

async function assertReplayEvidenceVisible(page) {
  assert(await page.getByTestId('ide-verify-view-waveform').getAttribute('aria-pressed') === 'true', 'Recorded trace owns the evidence workspace');
  const waveformVisible = await page.locator('[data-testid="ide-verify-waveform-preview"]').first().isVisible().catch(() => false);
  assert(waveformVisible, 'Observed waveform preview must be visible after Run simulation');
  assert(
    await page.getByTestId('ide-verify-waveform-svg').first().isVisible().catch(() => false),
    'Observed waveform lanes must be visible after Run simulation',
  );
  const status = await text(page.getByTestId('ide-verify-summary-status').first());
  assert(isVerifyPass(status), `Configured starter checks must pass after Run simulation, got "${status}"`);
  assert(!isVerifyFail(status), `Run simulation must not report failed starter checks, got "${status}"`);
  const runAuthority = await page.evaluate(() => {
    const run = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun;
    return {
      simulationStatus: run?.simulationStatus ?? null,
      assertionStatus: run?.assertionStatus ?? null,
      checkedRows: run?.report?.rows?.length ?? 0,
    };
  });
  assert(runAuthority.simulationStatus === 'complete', `simulation authority must be complete: ${JSON.stringify(runAuthority)}`);
  assert(runAuthority.assertionStatus === 'passing', `starter check authority must be passing: ${JSON.stringify(runAuthority)}`);
  assert(runAuthority.checkedRows > 0, `starter run must evaluate configured checks: ${JSON.stringify(runAuthority)}`);
  assert(
    /Checks passing|Checks aligned|Simulation complete/i.test(await text(page.getByTestId('ide-verify-context-state').first())),
    'Run simulation must expose the current passing check state',
  );
  const summary = page.getByTestId('ide-run-check-result').first();
  assert(
    await summary.getAttribute('data-check-status') === 'pass',
    'Run summary must distinguish completed simulation from passing optional checks',
  );
}

async function assertFailureRepairPanel(page, options) {
  const run = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun);
  assert(run?.simulationStatus === 'complete' && run?.assertionStatus === 'failing', 'failed checks must preserve completed simulation evidence');
  assert(run.waveform.length > 0, 'failed checks retain the recorded trace');
  await assertDirectFailureEvidence(page, 'failed output repair');
  const panelText = await text(page.locator('[data-testid="ide-verify-repair-panel"]').first());
  assert(/Expected|Observed/i.test(panelText), `repair panel must name Compare failed, got "${panelText}"`);
  assert(/Expected|Observed/i.test(panelText), `repair panel must show expected and observed values, got "${panelText}"`);
  assert(await page.getByTestId('ide-verify-repair-use-observed').first().isVisible().catch(() => false), 'single-cell Use observed action must be visible');
  if (options.expectRowRepair) {
    assert(await page.getByTestId('ide-verify-repair-use-observed-row').first().isVisible().catch(() => false), 'row-scope Use observed action must be visible');
  }
  if (options.expectAllRepair) {
    assert(await page.getByTestId('ide-verify-repair-use-observed-all').first().isVisible().catch(() => false), 'all-failed Use observed action must be visible');
  }
  const scopeText = await text(page.getByTestId('ide-verify-repair-scope-summary').first());
  assert(/failed output|failed row|all failed/i.test(scopeText), `repair scope summary must be explicit, got "${scopeText}"`);
}

async function assertDirectFailureEvidence(page, label) {
  await openReplayWorkspace(page);
  const details = page.getByTestId('ide-verify-details');
  if (await details.getAttribute('aria-pressed') !== 'true') await details.click();
  await page.getByTestId('ide-verify-analysis-tab-nav').getByRole('button', { name: 'Checks', exact: true }).click();
  assert(await page.getByTestId('ide-verify-repair-panel').count() === 1, 'Checks owns exactly one repair panel');
  const repairPanel = page.locator('[data-testid="ide-verify-repair-panel"]:visible').first();
  const repairDecision = page.locator('[data-testid="ide-verify-repair-decision"]:visible').first();
  const failedCase = page.locator('[data-testid="ide-verify-results-summary-open-fail"]:visible').first();

  await repairPanel.waitFor({ state: 'visible', timeout: 10000 });
  assert(await repairDecision.isVisible().catch(() => false), `${label}: direct repair decision must be visible`);
  assert(
    /expected output wrong.*circuit wrong/i.test(await text(repairDecision)),
    `${label}: repair decision must distinguish expected-output repair from circuit repair`,
  );
  assert(
    (await page.locator('details[data-testid="ide-verify-advanced-failure"], [data-testid="ide-verify-advanced-failure"] > summary').count()) === 0,
    `${label}: retired Failure details disclosure must remain absent`,
  );
  assert(await failedCase.isVisible().catch(() => false), `${label}: first failed-case evidence control must be visible`);
  await failedCase.click();
  assert(
    await page.getByTestId('ide-verify-fail-nav-summary').first().isVisible().catch(() => false),
    `${label}: selected mismatch summary must remain visible`,
  );
}

async function assertExportConfidence(page, { expectedPackage, expectedVerify }) {
  const readiness = page.getByTestId('ide-export-readiness-disclosure');
  if (!await readiness.evaluate(element => element.open)) await readiness.locator('summary').click();
  const packageDecision = page.getByTestId('ide-export-package-inspector-v1').first();
  const upstream = page.getByTestId('ide-export-upstream-readiness').first();
  const verify = await text(page.getByTestId('ide-export-upstream-verify').first());
  const mapping = await text(page.getByTestId('ide-export-upstream-mapping').first());
  const pkg = await text(packageDecision);
  const boundary = await text(page.getByTestId('ide-export-e0-boundary-summary').first());

  assert(await packageDecision.isVisible().catch(() => false), 'Export package decision must be visible');
  assert(await upstream.isVisible().catch(() => false), 'Export upstream readiness must be visible');

  if (expectedVerify === 'pass') {
    assert(/Compare PASS|current/i.test(verify), `Export Verify confidence should be current PASS, got "${verify}"`);
  } else {
    assert(/stale|rerun compare|not trusted/i.test(verify), `Export Verify confidence should be stale, got "${verify}"`);
  }
  assert(/mapped|pin/i.test(mapping), `Export Mapping confidence should name mapping, got "${mapping}"`);
  const packageState = await packageDecision.getAttribute('data-export-package-state');
  const primaryAction = page.locator('[data-testid="ide-export-package-build-v1"], [data-testid="ide-export-draft-download-v1"]').first();
  const primaryActionText = await text(primaryAction);
  if (expectedPackage === 'buildable-e0') {
    assert(packageState === 'draft', `current Compare PASS should produce a buildable draft before download, got "${packageState}"`);
    assert(
      /Generate.*ZIP/i.test(primaryActionText),
      `current Compare PASS should expose the package build authority, got "${primaryActionText}"`,
    );
    assert(await primaryAction.isEnabled().catch(() => false), 'current package build authority must be enabled');
  } else {
    assert(packageState === 'draft', `Export package should be draft while Verify evidence is stale, got "${packageState}"`);
    assert(/Draft/i.test(pkg), `Export package confidence should be draft, got "${pkg}"`);
    assert(
      /Generate.*draft ZIP/i.test(primaryActionText),
      `stale export must label its generated ZIP as draft, got "${primaryActionText}"`,
    );
  }
  assert(
    /Browser E0.*Vivado.*bitstream.*programming.*board behavior.*external/i.test(boundary),
    `Export confidence must preserve the E0 versus external Vivado/board boundary, got "${boundary}"`,
  );
  const allConfidence = `${verify} ${mapping} ${pkg} ${boundary}`;
  assert(
    !/\bE[123]\b\s*(?:pass|ready|complete)|Vivado build passed|Board behavior observed/i.test(allConfidence),
    `Export confidence must not overclaim E1/E2/E3: "${allConfidence}"`,
  );
}

async function runSimulation(page) {
  await clickVerifyRunAndWaitForNewResult(page, 'Run simulation', 'pass');
  await openReplayWorkspace(page);
}

async function readScenarioObservedOutputs(page, outputIds, caseCount) {
  await openScenarioWorkspace(page);
  const allOutputs = (await readIoRows(page)).filter(row => row.direction === 'out').map(row => row.id);
  const observedOutputs = [];
  for (let tick = 0; tick < caseCount; tick += 1) {
    for (const outputId of outputIds) {
      const column = allOutputs.indexOf(outputId);
      assert(column >= 0, 'observed column identity exists for ' + outputId);
      const cell = page.getByTestId('ide-case-lab-row-' + tick).locator('td.ide-case-lab-obs code').nth(column);
      const rawValue = await cell.textContent();
      const value = rawValue === '1' ? 1 : rawValue === '0' ? 0 : null;
      assert(value === 0 || value === 1, 'recording must report ' + outputId + ' at t' + tick + ', got ' + rawValue);
      const recorded = await page.evaluate(({tick,id}) => {
        const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
        const field = state?.projectIoRows.find(row => row.id === id);
        const samples = state?.verifyLastRun?.waveform.find(row => row.tick === tick)?.signals;
        return samples?.[id] ?? samples?.[field?.label] ?? samples?.[`${field?.nodeId}.${field?.port}`];
      }, {tick, id:outputId});
      assert(String(recorded) === rawValue, 'visible observed cell must agree with immutable recording for ' + outputId + ' at t' + tick + ': ' + rawValue + ' versus ' + recorded);
      observedOutputs.push({ fieldId: outputId, tick, value });
    }
  }
  return observedOutputs;
}

async function authorExpectedChecks(page, observedOutputs) {
  await openChecksWorkspace(page);
  for (const entry of observedOutputs) {
    assert(
      (await readCellValue(page, expectedCellTestId(entry.fieldId, entry.tick))) === null,
      `Checks authoring setup must begin Unset for ${entry.fieldId} at t${entry.tick}`,
    );
  }
  for (const entry of observedOutputs) {
    await setExpectedCell(page, entry.fieldId, entry.tick, entry.value);
  }
  const vectors = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? []);
  const configuredChecks = vectors.reduce((total, vector) => total + Object.keys(vector.expected ?? {}).length, 0);
  assert(
    configuredChecks >= observedOutputs.length,
    `Checks authoring must persist ${observedOutputs.length} expected values, got ${configuredChecks}`,
  );
}

async function clearExpectedChecks(page, outputIds, caseCount) {
  await openChecksWorkspace(page);
  for (let tick = 0; tick < caseCount; tick += 1) {
    for (const outputId of outputIds) {
      const testId = expectedCellTestId(outputId, tick);
      const cell = page.locator(`[data-testid="${testId}"]:visible`).first();
      await cell.scrollIntoViewIfNeeded();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if ((await readCellValue(page, testId)) === null) break;
        await cell.click();
        await page.waitForTimeout(100);
      }
      assert((await readCellValue(page, testId)) === null, `expected ${testId} to become Unset`);
    }
  }
  const state = await page.evaluate(({ clearedOutputIds, expectedCaseCount }) => {
    const vectors = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? [];
    const selected = vectors.filter((vector) => vector.tick >= 0 && vector.tick < expectedCaseCount);
    return {
      clearedKeysRemain: selected.some((vector) => clearedOutputIds.some((fieldId) => fieldId in (vector.expected ?? {}))),
      remainingChecks: selected.reduce((total, vector) => total + Object.keys(vector.expected ?? {}).length, 0),
    };
  }, { clearedOutputIds: outputIds, expectedCaseCount: caseCount });
  assert(!state.clearedKeysRemain, `cleared output checks must be absent from runtime vectors: ${JSON.stringify(state)}`);
  assert(state.remainingChecks > 0, 'starter must retain at least one independent check for the initial simulation run');
}

async function runCompareAndExpect(page, label, expectation) {
  assert(await setVerifyRunMode(page, 'compare'), `${label}: Compare mode must be selectable`);
  await clickVerifyRunAndWaitForNewResult(page, label, expectation);
  const status = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  if (expectation === 'pass') {
    assert(isVerifyPass(status), `${label}: Compare should PASS, got "${status}"`);
  } else {
    assert(isVerifyFail(status), `${label}: Compare should FAIL, got "${status}"`);
  }
}

async function clickVerifyRunAndWaitForNewResult(page, label) {
  const previousRunId = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.runId ?? null);
  await clickVerifyRun(page);
  await page.waitForFunction(previous => {
    const runId = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.runId;
    return Boolean(runId && runId !== previous);
  }, previousRunId, {timeout:20000});
  await waitForVerifyResult(page, { timeout: 10000 });
}

function buildGenericCases(inputIds, count) {
  return Array.from({ length: count }, (_, index) => ({
    tick: index,
    inputs: Object.fromEntries(
      inputIds.map((fieldId, bitIndex) => [fieldId, ((index >> bitIndex) & 1) === 1 ? 1 : 0]),
    ),
  }));
}

async function authorInputCases(page, cases) {
  for (const entry of cases) {
    for (const [fieldId, value] of Object.entries(entry.inputs)) {
      await setInputCell(page, fieldId, entry.tick, value);
    }
  }
}

async function ensureCaseCount(page, desired) {
  await page.waitForSelector('[data-testid="ide-case-lab-add"]', { timeout: 15000 });
  for (let guard = 0; guard < desired + 4; guard += 1) {
    const count = await readTickCount(page);
    if (count >= desired) return;
    await page.getByTestId('ide-case-lab-add').click();
    await page.waitForTimeout(120);
  }
  assert(false, `could not create ${desired} Verify cases`);
}

async function setInputCell(page, fieldId, tick, value) {
  const testId = `ide-case-lab-input-${tick}-${fieldId}`;
  const cell = page.locator(`[data-testid="${testId}"]:visible`).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readCellValue(page, testId);
    if (current === value) return;
    await cell.click();
    await page.waitForTimeout(100);
  }
  const current = await readCellValue(page, testId);
  assert(current === value, `expected ${testId} to become ${value}, got ${current}`);
}

async function setExpectedCell(page, fieldId, tick, value) {
  await openChecksWorkspace(page);
  const testId = expectedCellTestId(fieldId, tick);
  const cell = page.locator(`[data-testid="${testId}"]:visible`).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readCellValue(page, testId);
    if (current === value) return;
    await cell.click();
    await page.waitForTimeout(100);
  }
  const current = await readCellValue(page, testId);
  assert(current === value, `expected ${testId} to become ${value}, got ${current}`);
}

async function flipExpectedCell(page, fieldId, tick) {
  const current = await readCellValue(page, expectedCellTestId(fieldId, tick));
  assert(current === 0 || current === 1, `expected ${fieldId} t${tick} to have a saved 0/1 value before flip`);
  await setExpectedCell(page, fieldId, tick, current === 0 ? 1 : 0);
}

async function waitForExpectedValue(page, fieldId, tick, value) {
  await page.waitForFunction(
    ({ fieldId: targetFieldId, tick: targetTick, value: targetValue }) => {
      const vectors = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? [];
      return vectors.some((vector) => vector.tick === targetTick && vector.expected?.[targetFieldId] === targetValue);
    },
    { fieldId, tick, value },
    { timeout: 8000 },
  );
}

async function assertExpectedCellVisibleValue(page, fieldId, tick, value) {
  await openChecksWorkspace(page);
  const testId = expectedCellTestId(fieldId, tick);
  const cell = page.locator(`[data-testid="${testId}"]:visible`).first();
  await cell.waitFor({ state: 'visible', timeout: 5000 });
  assert(
    (await readCellValue(page, testId)) === value,
    `repaired Checks cell ${testId} must visibly show ${value}`,
  );
}

async function readCellValue(page, testId) {
  const cell = page.getByTestId(testId).first();
  if (await cell.isVisible()) {
    const value = await cell.locator('code').textContent();
    return value === '1' ? 1 : value === '0' ? 0 : null;
  }
  const match = /^ide-case-lab-exp-(\d+)-(.+)$/.exec(testId);
  assert(match, 'expected identity required for a retained value: ' + testId);
  return page.evaluate(({tick,id}) => {
    const value = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors.find(row => row.tick === tick)?.expected?.[id];
    return value === 1 || value === true ? 1 : value === 0 || value === false ? 0 : null;
  }, {tick:Number(match[1]), id:match[2]});
}

async function openChecksWorkspace(page) {
  const details = page.getByTestId('ide-verify-details');
  if (await details.getAttribute('aria-pressed') === 'true') await details.click();
  await page.getByTestId('ide-verify-view-table').click();
  await page.locator('[data-testid^="ide-case-lab-exp-"]').first().waitFor({state:'visible'});
}

async function openReplayWorkspace(page) {
  const replayTab = page.getByTestId('ide-verify-view-waveform').first();
  assert(!(await replayTab.isDisabled()), 'Replay must become available after Run simulation creates evidence');
  if ((await replayTab.getAttribute('aria-pressed')) !== 'true') {
    await replayTab.click();
  }
  await page.getByTestId('ide-verify-waveform-preview').first().waitFor({ state: 'visible', timeout: 5000 });
}

async function openScenarioWorkspace(page) { await openChecksWorkspace(page); }

async function readTickCount(page) {
  return page.locator('[data-testid^="ide-case-lab-row-"]').count();
}

function expectedCellTestId(fieldId, tick) {
  return `ide-case-lab-exp-${tick}-${fieldId}`;
}

async function readIoRows(page) {
  return page.evaluate(() =>
    (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? []).map((row) => ({
      id: row.id,
      label: row.label ?? row.id,
      direction: row.direction,
    })),
  );
}

async function readProjectStats(page) {
  return page.evaluate(() => {
    const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ?? { nodes: [], connections: [] };
    return {
      nodes: circuit.nodes?.length ?? 0,
      connections: circuit.connections?.length ?? 0,
    };
  });
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').trim().replace(/\s+/g, ' ');
}

async function capture(page, filename) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
}

async function applyScopedRepair(page, testId) {
  const before = await page.evaluate(() => JSON.stringify(window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun));
  await page.getByTestId(testId).click();
  const after = await page.evaluate(() => JSON.stringify(window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun));
  assert(after === before, testId + ' must never mutate the recorded evidence');
}
