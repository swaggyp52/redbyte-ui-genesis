#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  saveObservedOutputs,
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
  await assertTestbenchSections(page, 'initial Verify');

  const ioRows = await readIoRows(page);
  const inputIds = ioRows.filter((row) => row.direction === 'in').map((row) => row.id);
  const outputIds = ioRows.filter((row) => row.direction === 'out').map((row) => row.id);
  assert(inputIds.length >= 2, `logic-gates starter needs at least two inputs, got ${inputIds.length}`);
  assert(outputIds.length >= 2, `logic-gates starter needs at least two outputs, got ${outputIds.length}`);

  const cases = buildGenericCases(inputIds.slice(0, 2), 4);
  await ensureCaseCount(page, cases.length);
  await authorInputCases(page, cases);
  await capture(page, '01-verify-authored-multiple-cases.png');

  await runObserveSaveAndAssertExpected(page, outputIds.slice(0, 2), cases.length);
  await assertObservedEvidenceVisible(page);
  await capture(page, '02-observe-expected-and-observed-evidence.png');

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
  await capture(page, '03-two-failed-outputs-repair-actions.png');

  await page.getByTestId('ide-verify-repair-use-observed').click();
  await waitForExpectedValue(page, targetA.fieldId, targetA.tick, originalA);
  const afterCellRepairB = await readCellValue(page, expectedCellTestId(targetB.fieldId, targetB.tick));
  assert(
    afterCellRepairB !== originalB,
    `cell repair must not silently repair peer output ${targetB.fieldId}; got ${afterCellRepairB}`,
  );
  record.phases.push({ phase: 'cell-repair', target: targetA });

  await page.getByTestId('ide-verify-repair-use-observed-row').click();
  await waitForExpectedValue(page, targetB.fieldId, targetB.tick, originalB);
  await clickRepairRerun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  let status = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyPass(status), `row repair should restore Compare PASS, got "${status}"`);
  await capture(page, '04-row-repair-pass.png');

  await flipExpectedCell(page, targetA.fieldId, targetA.tick);
  await flipExpectedCell(page, targetB.fieldId, targetB.tick);
  await runCompareAndExpect(page, 'all failed outputs repair setup', 'fail');
  await page.getByTestId('ide-verify-repair-use-observed-all').click();
  await waitForExpectedValue(page, targetA.fieldId, targetA.tick, originalA);
  await waitForExpectedValue(page, targetB.fieldId, targetB.tick, originalB);
  await clickRepairRerun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  status = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyPass(status), `all failed repair should restore Compare PASS, got "${status}"`);
  await capture(page, '05-all-failed-repair-pass.png');

  await flipExpectedCell(page, targetA.fieldId, targetA.tick);
  await page.waitForSelector('[data-testid="ide-verify-primary-status-rerun"]', { timeout: 10000 });
  const staleText = await text(page.locator('[data-testid="ide-verify-primary-status"]'));
  assert(
    /Testbench changed|Stimulus or saved checks changed|Rerun Compare/i.test(staleText),
    `Verify must name stale testbench evidence after edit, got "${staleText}"`,
  );
  await capture(page, '06-testbench-edit-stale.png');

  await openMode(page, baseUrl, 'export', 'testbench-editor-and-export-confidence-flow-stale-export');
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  await assertExportConfidence(page, { expectedPackage: 'draft', expectedVerify: 'stale' });
  await capture(page, '07-export-confidence-stale-draft.png');

  await openMode(page, baseUrl, 'verify', 'testbench-editor-and-export-confidence-flow-final-compare');
  await setExpectedCell(page, targetA.fieldId, targetA.tick, originalA);
  await runCompareAndExpect(page, 'final current expected outputs', 'pass');

  await openMode(page, baseUrl, 'export', 'testbench-editor-and-export-confidence-flow-current-export');
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  await assertExportConfidence(page, { expectedPackage: 'ready-e0', expectedVerify: 'pass' });
  await capture(page, '08-export-confidence-ready-e0.png');

  record.phases.push({ phase: 'complete', outputsChecked: outputIds.slice(0, 2) });
  await writeFile(
    path.join(ARTIFACT_ROOT, 'testbench-editor-and-export-confidence-flow.json'),
    JSON.stringify(record, null, 2),
  );
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function assertTestbenchSections(page, label) {
  const expectations = [
    ['ide-testbench-section-inputs', /Cases|One input combination to try|Inputs to try/i],
    ['ide-testbench-section-expected', /Expected outputs/i],
    ['ide-testbench-section-observed', /Observed outputs/i],
    ['ide-testbench-section-status', /Status/i],
  ];
  for (const [testId, pattern] of expectations) {
    const entry = page.getByTestId(testId).first();
    assert(await entry.isVisible().catch(() => false), `${label}: ${testId} must be visible`);
    const content = await text(entry);
    assert(pattern.test(content), `${label}: ${testId} copy must match ${pattern}, got "${content}"`);
  }
}

async function assertObservedEvidenceVisible(page) {
  const scope = await text(page.locator('[data-testid="ide-verify-scope-header"]').first());
  assert(/Waveform truth/i.test(scope), `Observe must expose waveform evidence, got "${scope}"`);
  const waveformVisible = await page.locator('[data-testid="ide-verify-waveform-preview"]').first().isVisible().catch(() => false);
  assert(waveformVisible, 'Observed waveform preview must be visible after Observe');
}

async function assertFailureRepairPanel(page, options) {
  await page.waitForSelector('[data-testid="ide-verify-repair-panel"]', { timeout: 10000 });
  const panelText = await text(page.locator('[data-testid="ide-verify-repair-panel"]').first());
  assert(/Compare failed/i.test(panelText), `repair panel must name Compare failed, got "${panelText}"`);
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

async function assertExportConfidence(page, { expectedPackage, expectedVerify }) {
  const station = page.getByTestId('ide-export-confidence-station').first();
  assert(await station.isVisible().catch(() => false), 'Export confidence station must be visible');
  const verify = await text(page.getByTestId('ide-export-confidence-verify').first());
  const mapping = await text(page.getByTestId('ide-export-confidence-mapping').first());
  const pkg = await text(page.getByTestId('ide-export-confidence-package').first());
  const vivado = await text(page.getByTestId('ide-export-confidence-vivado').first());
  const board = await text(page.getByTestId('ide-export-confidence-board').first());

  if (expectedVerify === 'pass') {
    assert(/Compare PASS|current/i.test(verify), `Export Verify confidence should be current PASS, got "${verify}"`);
  } else {
    assert(/stale|rerun compare|not trusted/i.test(verify), `Export Verify confidence should be stale, got "${verify}"`);
  }
  assert(/mapped|pin/i.test(mapping), `Export Mapping confidence should name mapping, got "${mapping}"`);
  if (expectedPackage === 'ready-e0') {
    assert(/Trusted E0|Ready to build E0|Ready E0|E0/i.test(pkg), `Export package confidence should be current E0, got "${pkg}"`);
  } else {
    assert(/Draft|not trusted|needs review/i.test(pkg), `Export package confidence should be draft, got "${pkg}"`);
  }
  assert(/not run|external/i.test(vivado), `Vivado confidence must say not run/external, got "${vivado}"`);
  assert(/not observed|manual/i.test(board), `Board confidence must say not observed/manual, got "${board}"`);
  const allConfidence = `${verify} ${mapping} ${pkg} ${vivado} ${board}`;
  assert(
    !/\bE[123]\b\s*(?:pass|ready|complete)|Vivado build passed|Board behavior observed/i.test(allConfidence),
    `Export confidence must not overclaim E1/E2/E3: "${allConfidence}"`,
  );
}

async function runObserveSaveAndAssertExpected(page, outputIds, caseCount) {
  await setVerifyRunMode(page, 'observe');
  await clickVerifyRunAndWaitForNewResult(page, 'Observe run', 'pass-or-trace');
  const savedSelector = await saveObservedOutputs(page);
  assert(savedSelector, 'Verify must allow saving observed outputs after Observe');
  await page.waitForFunction(
    () => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? []).some((vector) => Object.keys(vector.expected ?? {}).length > 0),
    { timeout: 8000 },
  );
  for (let tick = 0; tick < caseCount; tick += 1) {
    for (const outputId of outputIds) {
      const value = await readCellValue(page, expectedCellTestId(outputId, tick));
      assert(value === 0 || value === 1, `expected ${outputId} at t${tick} to be saved, got ${value}`);
    }
  }
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

async function clickVerifyRunAndWaitForNewResult(page, label, expectation) {
  const previousReportHash = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null,
  );
  await clickVerifyRun(page);
  try {
    await page.waitForFunction(
      (previous) => {
        const nextHash = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null;
        return Boolean(nextHash && nextHash !== previous);
      },
      previousReportHash,
      { timeout: 20000 },
    );
  } catch {
    const state = await page.evaluate(() => ({
      previousReportHash: window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null,
      status: document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? '',
      primaryStatus: document.querySelector('[data-testid="ide-verify-primary-status"]')?.textContent ?? '',
      runButton: document.querySelector('[data-testid="ide-vcb-run"]')?.textContent ?? '',
    }));
    if (
      expectation === 'pass' &&
      isVerifyPass(state.status) &&
      !/Testbench changed|Stimulus or saved checks changed|Run Compare/i.test(state.primaryStatus)
    ) {
      return;
    }
    if (expectation === 'pass-or-trace' && /observed|trace|recorded|waveform/i.test(state.status + state.primaryStatus)) {
      return;
    }
    throw new Error(`${label}: Verify report hash did not change from ${previousReportHash}: ${JSON.stringify(state)}`);
  }
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
  await page.waitForSelector('[data-testid="ide-stimulus-add-tick"]', { timeout: 15000 });
  for (let guard = 0; guard < desired + 4; guard += 1) {
    const count = await readTickCount(page);
    if (count >= desired) return;
    await page.getByTestId('ide-stimulus-add-tick').click();
    await page.waitForTimeout(120);
  }
  assert(false, `could not create ${desired} Verify cases`);
}

async function setInputCell(page, fieldId, tick, value) {
  const testId = `ide-stimulus-cell-${fieldId}-t${tick}`;
  const cell = page.getByTestId(testId).first();
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
  const testId = expectedCellTestId(fieldId, tick);
  const cell = page.getByTestId(testId).first();
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

async function readCellValue(page, testId) {
  const title = await page.getByTestId(testId).first().getAttribute('title');
  if (/:\s*1\s*-\s*drag/i.test(title ?? '')) return 1;
  if (/:\s*0\s*-\s*drag/i.test(title ?? '')) return 0;
  if (/:\s*not set\s*-\s*drag/i.test(title ?? '')) return null;
  return null;
}

async function readTickCount(page) {
  const ids = await page.locator('[data-testid^="ide-stimulus-cell-"]').evaluateAll((elements) =>
    Array.from(
      new Set(
        elements
          .map((element) => /-t(\d+)$/.exec(element.getAttribute('data-testid') ?? '')?.[1])
          .filter(Boolean),
      ),
    ).map(Number),
  );
  return ids.length;
}

function expectedCellTestId(fieldId, tick) {
  return `ide-stimulus-expected-${fieldId}-t${tick}`;
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

async function clickRepairRerun(page) {
  await page.getByTestId('ide-verify-repair-rerun').click();
  await page.waitForTimeout(100);
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').trim().replace(/\s+/g, ' ');
}

async function capture(page, filename) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
}
