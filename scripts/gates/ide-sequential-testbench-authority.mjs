#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  openMode,
} from './_workbenchReconstructionHarness.mjs';
import { isVerifyPass, isVerifyTrace, waitForVerifyResult } from './_verifyStatus.mjs';

const VIEWPORT = { label: '1440x900', width: 1440, height: 900 };
const TESTBENCH_NAME = 'Manual Counter Authority';
const RUN_CYCLES = 12;
const EXPECTED_STEPS = 24;
const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'sequential-testbench-authority',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE sequential testbench authority satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const steps = [];
  const routes = [];
  const recordStep = (label, evidence) => {
    const number = steps.length + 1;
    steps.push({ number, label, evidence });
    console.log(`  Step ${number}/${EXPECTED_STEPS}: ${label}`);
  };
  const recordRoute = (label) => routes.push({ label, url: page.url() });

  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('rb-onboarding-v1-seen', '1');
    } catch {
      // Storage can be unavailable on intermediate browser documents.
    }
  });

  console.log(`  Browser proof URL: ${baseUrl}`);
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=sequential-testbench-authority`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, 'sequential-testbench-authority/startup');
  await assertNoRootOverflow(page, 'sequential-testbench-authority/startup');
  recordRoute('startup', page.url());

  await loadStarterProject(page, { exactExampleId: 'two-bit-counter' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  const loaded = await readProjectInspection(page);
  assert(loaded.sourceExampleId === 'two-bit-counter', `2-bit counter source was not authoritative: ${JSON.stringify(loaded)}`);
  assert(loaded.nodeIds.includes('q0_ff') && loaded.nodeIds.includes('q1_ff'), '2-bit counter flip-flops did not load');
  recordStep('Load the 2-bit counter starter', loaded);
  recordRoute('counter-design', page.url());

  await openMode(page, baseUrl, 'verify', 'sequential-testbench-authority-author');
  await page.waitForSelector('[data-testid="ide-testbench-documents"]', { timeout: 15000 });
  const beforeCreate = await readDocumentState(page);
  await clickVisible(page, '[data-testid="ide-scenario-create-btn"]', 'New testbench');
  await page.waitForFunction(
    ({ previousId, previousCount }) => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      return Boolean(
        state?.activeScenarioId &&
          state.activeScenarioId !== previousId &&
          (state.scenarios?.length ?? 0) === previousCount + 1
      );
    },
    { previousId: beforeCreate.id, previousCount: beforeCreate.scenarioCount },
    { timeout: 8000 },
  );
  const created = await readDocumentState(page);
  assert(created.name === 'New Scenario', `new testbench did not become active: ${JSON.stringify(created)}`);
  recordStep('Create an independent testbench document', {
    id: created.id,
    scenarioCount: created.scenarioCount,
    copiedCaseCount: created.vectors.length,
  });

  await renameActiveTestbench(page, TESTBENCH_NAME);
  const named = await readDocumentState(page);
  assert(named.name === TESTBENCH_NAME, `testbench name was not committed: ${JSON.stringify(named)}`);
  recordStep('Name the active testbench', { id: named.id, name: named.name, version: named.version });

  const generators = page.getByTestId('ide-scenario-generators-disclosure');
  if ((await generators.getAttribute('open')) === null) await generators.locator('summary').first().click();
  const clockPanel = page.getByTestId('ide-verify-clock-policy-panel').first();
  if ((await clockPanel.getAttribute('open')) === null) await clockPanel.locator('summary').click();
  const runCyclesInput = page.getByTestId('ide-verify-clock-run-cycles-input').first();
  await runCyclesInput.fill(String(RUN_CYCLES));
  await page.waitForFunction(
    (expected) => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      const active = state?.scenarios?.find((scenario) => scenario.id === state.activeScenarioId);
      return active?.sequentialPolicy?.runCycles === expected;
    },
    RUN_CYCLES,
    { timeout: 8000 },
  );
  assert(Number(await runCyclesInput.inputValue()) > 0, 'Auto runCycles must remain positive in the UI');
  recordStep('Set and persist the Auto runCycles policy', { runCycles: RUN_CYCLES });

  await clickVisible(page, '[data-testid="ide-verify-clock-mode-manual"]', 'Manual pulses mode');
  await page.waitForFunction(
    () => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      const active = state?.scenarios?.find((scenario) => scenario.id === state.activeScenarioId);
      return active?.sequentialPolicy?.overrideMode === 'manual-pulses';
    },
    { timeout: 8000 },
  );
  await page.waitForSelector('[data-testid="ide-stimulus-clock-row"]', { timeout: 10000 });
  const manualState = await readDocumentState(page);
  assert(
    /Manual pulses/i.test(await text(page.getByTestId('ide-verify-clock-mode-summary'))),
    'Verify did not present Manual pulses as the active mode',
  );
  assert(
    manualState.sequentialPolicy?.executionModel === 'manual',
    `saved manual policy retained a non-manual execution model: ${JSON.stringify(manualState.sequentialPolicy)}`,
  );
  assert(
    manualState.sequentialPolicy?.resetBehavior === 'custom',
    `saved manual policy retained hidden auto reset behavior: ${JSON.stringify(manualState.sequentialPolicy)}`,
  );
  recordStep('Select Manual pulses mode', manualState.sequentialPolicy);
  assert(
    /authored row/i.test(await text(page.getByTestId('ide-verify-clock-authored-run-length'))),
    'Manual mode must present authored rows as its real run length',
  );
  assert(
    (await page.getByTestId('ide-verify-clock-run-cycles-input').count()) === 0,
    'Manual mode must not expose a no-op cycle-count input',
  );
  recordStep('Confirm Manual run length is owned by authored rows', {
    label: await text(page.getByTestId('ide-verify-clock-authored-run-length')),
  });

  const clockRow = await readClockRow(page);
  const flatChecks = await authorCounterExpectedChecks(page);
  const flatDocument = await readDocumentState(page);
  const flatClock = await readClockTimeline(page, clockRow);
  assert(flatClock.values.every((value) => value === 0), `starter clock must remain flat-low: ${JSON.stringify(flatClock)}`);
  recordStep('Replace starter assumptions with flat-low saved checks', flatChecks);

  assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must be selectable for flat-low proof');
  const flatRun = await runFreshVerification(page, { kind: 'verify', status: 'pass' });
  const flatProof = assertCounterClockAuthority(flatRun, flatDocument, { requireFlatLow: true });
  recordStep('Prove flat-low authored clock cannot advance state', flatProof);

  const rising = await applyClockPattern(page, 'ide-stimulus-clock-behavior-rising', [0, 1], clockRow);
  recordStep('Author an explicit rising edge', {
    from: rising.values[0],
    to: rising.values[1],
    ticks: rising.ticks,
  });
  const falling = await applyClockPattern(page, 'ide-stimulus-clock-behavior-falling', [1, 0], clockRow);
  recordStep('Author an explicit falling edge', {
    from: falling.values[0],
    to: falling.values[1],
    ticks: falling.ticks,
  });

  const patternCount = page.getByTestId('ide-stimulus-clock-pattern-count').first();
  await patternCount.fill('2');
  const highHold = await applyClockPattern(page, 'ide-stimulus-clock-behavior-high', [1, 1], clockRow);
  recordStep('Author a high hold interval', { values: highHold.values, ticks: highHold.ticks });
  const lowHold = await applyClockPattern(page, 'ide-stimulus-clock-behavior-low', [0, 0], clockRow);
  recordStep('Author a low hold interval', { values: lowHold.values, ticks: lowHold.ticks });

  const appendedTicks = [...rising.ticks, ...falling.ticks, ...highHold.ticks, ...lowHold.ticks];
  const controlProof = await setCounterControls(page, appendedTicks);
  const outputChecks = await authorCounterExpectedChecks(page);
  recordStep('Author edge-correlated controls and Q0/Q1 checks', {
    controls: controlProof,
    checks: outputChecks,
  });

  const authoredBeforeSave = await readDocumentState(page);
  await clickVisible(page, '[data-testid="ide-topbar-save-btn"]', 'Save project');
  const persisted = await waitForPersistedDocument(page, authoredBeforeSave);
  await capture(page, '01-authored-before-reload');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await assertBuildHash(page, 'sequential-testbench-authority/reload');
  const reloaded = await readDocumentState(page);
  assertSameAuthoredDocument(authoredBeforeSave, reloaded, 'save/reload');
  assert(
    /Manual pulses/i.test(await text(page.getByTestId('ide-verify-clock-mode-summary'))),
    'manual mode did not survive reload',
  );
  assert(
    reloaded.sequentialPolicy?.executionModel === 'manual' &&
      reloaded.sequentialPolicy?.resetBehavior === 'custom',
    `stored manual execution/reset policy did not survive reload: ${JSON.stringify(reloaded.sequentialPolicy)}`,
  );
  assert(
    reloaded.sequentialPolicy?.runCycles === RUN_CYCLES,
    'persisted policy runCycles did not survive reload',
  );
  assert(
    /authored row/i.test(await text(page.getByTestId('ide-verify-clock-authored-run-length'))),
    'Manual authored-row run length did not survive reload',
  );
  recordStep('Save and reload the complete testbench authority', {
    persistedProjectId: persisted.projectId,
    scenarioId: reloaded.id,
    scenarioVersion: reloaded.version,
    caseCount: reloaded.vectors.length,
    runCycles: reloaded.sequentialPolicy?.runCycles,
  });
  recordRoute('reloaded-verify', page.url());

  await page.getByTestId('ide-verify-details').click();
  await page.getByTestId('ide-sim-clear-checks').click();
  await page.getByLabel('Close simulation details').click();
  const unchecked = await readDocumentState(page);
  assert(unchecked.vectors.every(vector => Object.keys(vector.expected ?? {}).length === 0), 'Observation must have no configured checks');
  assert(stable(unchecked.vectors.map(({ tick, inputs }) => ({ tick, inputs }))) === stable(reloaded.vectors.map(({ tick, inputs }) => ({ tick, inputs }))), 'Clearing checks must preserve authored stimulus');
  const observeRun = await runFreshVerification(page, { kind: 'trace' });
  assert(isVerifyTrace(observeRun.summaryText), `Observe did not publish trace authority: ${observeRun.summaryText}`);
  assert(observeRun.waveform.length > 0, 'Observe must publish waveform samples');
  recordStep('Record outputs without optional checks', summarizeRun(observeRun));

  await authorCounterExpectedChecks(page);
  assert(await setVerifyRunMode(page, 'compare'), 'Authored checks must be configured');
  const compareRun = await runFreshVerification(page, { kind: 'verify', status: 'pass' });
  assert(isVerifyPass(compareRun.summaryText), `Compare did not pass: ${compareRun.summaryText}`);
  const metrics = await assertDistinctRunMetrics(page, compareRun);
  const authoredClockProof = assertCounterClockAuthority(compareRun, reloaded);
  recordStep('Run authored checks and distinguish events from checks', {
    ...summarizeRun(compareRun),
    metrics,
    authoredClockProof,
  });

  const waveformProof = await assertWaveformAuthority(page, compareRun.ioRows);
  await capture(page, '02-compare-waveform');
  recordStep('Render authored clock and one canonical waveform lane per logical IO signal', {
    ...waveformProof,
    clockValues: authoredClockProof.waveformClockValues,
    risingTicks: authoredClockProof.risingTicks,
  });

  const beforePulseEdit = await readDocumentState(page);
  const editedPulseTick = rising.ticks[1];
  const pulseTitleBefore = await readScenarioVectorBit(page, 'inputs', clockRow, editedPulseTick);
  await setStimulusBit(page, clockRow, editedPulseTick, pulseTitleBefore === 1 ? 0 : 1);
  assert(await readRuntimeDirty(page), 'Editing an authored pulse must stale prior recording evidence');
  assert(await page.getByTestId('ide-run-identity').getAttribute('data-currency') === 'differs', 'The visible recording must report that current work differs');
  const afterPulseEdit = await readDocumentState(page);
  assert(afterPulseEdit.id === beforePulseEdit.id, 'pulse edit changed testbench identity');
  assert(
    JSON.stringify(afterPulseEdit.sequentialPolicy) === JSON.stringify(beforePulseEdit.sequentialPolicy),
    'pulse edit changed sequential policy authority',
  );
  await capture(page, '03-pulse-edit-stale');
  recordStep('Edit the authored pulse and mark prior evidence stale', {
    tick: editedPulseTick,
    before: pulseTitleBefore,
    after: await readScenarioVectorBit(page, 'inputs', clockRow, editedPulseTick),
    summaryKind: await page.getByTestId('ide-run-identity').getAttribute('data-currency'),
  });

  assert(await setVerifyRunMode(page, 'compare'), 'Compare must remain selectable after pulse edit');
  const failedPulseRun = await runFreshVerification(page, { kind: 'verify', status: 'fail' });
  assert(!(await readRuntimeDirty(page)), 'failed pulse rerun must still publish current evidence');
  recordStep('Rerun the broken edge and expose saved-check failures', summarizeRun(failedPulseRun));

  await setStimulusBit(page, clockRow, editedPulseTick, 1);
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-run-identity"]')?.getAttribute('data-currency') === 'differs',
    { timeout: 8000 },
  );
  recordStep('Restore the authored rising edge and stale the failed evidence', {
    tick: editedPulseTick,
    restoredValue: 1,
    summaryKind: await page.getByTestId('ide-run-identity').getAttribute('data-currency'),
  });

  const pulseRerun = await runFreshVerification(page, { kind: 'verify', status: 'pass' });
  assert(!(await readRuntimeDirty(page)), 'restored pulse rerun must make the evidence current');
  const restoredDocument = await readDocumentState(page);
  const restoredProof = assertCounterClockAuthority(pulseRerun, restoredDocument);
  recordStep('Rerun the restored edge timeline to current PASS', {
    ...summarizeRun(pulseRerun),
    restoredProof,
  });

  const exportProof = await assertAuthoredTestbenchExport(page, baseUrl, clockRow);
  await capture(page, '04-authored-testbench-export');
  recordStep('Inspect exported testbench authored-clock semantics', exportProof);
  recordRoute('manual-testbench-export', page.url());

  const authoredBeforeBreak = await readDocumentState(page);
  await openMode(page, baseUrl, 'design', 'sequential-testbench-authority-break-design');
  recordRoute('break-design', page.url());
  await fitCircuit(page);
  const brokenWire = await findQ1OutputWire(page);
  const connectionsBeforeBreak = await readConnectionCount(page);
  await selectWire(page, brokenWire.id);
  await clickVisible(page, '[data-testid="ide-design-context-delete-wire"]', 'Delete Q1 output wire');
  await waitForConnectionCount(page, connectionsBeforeBreak - 1, 'break Q1 output');
  await openMode(page, baseUrl, 'verify', 'sequential-testbench-authority-broken');
  const afterBreak = await readDocumentState(page);
  assertSameAuthoredDocument(authoredBeforeBreak, afterBreak, 'after Design break');
  assert(await readRuntimeDirty(page), 'Design break must invalidate prior Verify authority');
  assert(
    (await page.getByTestId('ide-run-identity').count()) === 0 ||
      (await page.getByTestId('ide-run-identity').getAttribute('data-currency')) !== 'current',
    'broken Design must not retain a current PASS summary',
  );
  await capture(page, '05-design-broken-timeline-preserved');
  recordStep('Break Design while the authored timeline survives intact', {
    wire: brokenWire,
    connectionCount: connectionsBeforeBreak - 1,
    scenarioId: afterBreak.id,
    scenarioVersion: afterBreak.version,
    caseCount: afterBreak.vectors.length,
    policy: afterBreak.sequentialPolicy,
  });

  await openMode(page, baseUrl, 'design', 'sequential-testbench-authority-repair-design');
  await fitCircuit(page);
  await connectPorts(page, brokenWire.fromNodeId, brokenWire.fromPort, brokenWire.toNodeId, brokenWire.toPort);
  await waitForConnectionCount(page, connectionsBeforeBreak, 'repair Q1 output');
  await openMode(page, baseUrl, 'verify', 'sequential-testbench-authority-final-rerun');
  const afterRepair = await readDocumentState(page);
  assertSameAuthoredDocument(authoredBeforeBreak, afterRepair, 'after Design repair');
  assert(await setVerifyRunMode(page, 'compare'), 'Compare must remain selectable after Design repair');
  const finalRun = await runFreshVerification(page, { kind: 'verify', status: 'pass' });
  assert(!(await readRuntimeDirty(page)), 'repaired rerun must publish current evidence');
  await assertWaveformAuthority(page, finalRun.ioRows);
  const finalClockProof = assertCounterClockAuthority(finalRun, afterRepair);
  await capture(page, '06-design-repaired-current');
  recordStep('Repair Design and rerun the same testbench to current PASS', {
    wire: brokenWire,
    connectionCount: connectionsBeforeBreak,
    finalClockProof,
    ...summarizeRun(finalRun),
  });
  recordRoute('repaired-verify', page.url());

  assert(
    steps.length === EXPECTED_STEPS,
    `expected exactly ${EXPECTED_STEPS} workflow steps, recorded ${steps.length}`,
  );
  await assertNoRootOverflow(page, 'sequential-testbench-authority/complete');

  const artifact = {
    gate: 'ide-sequential-testbench-authority',
    generatedAtIso: new Date().toISOString(),
    baseUrl,
    viewport: VIEWPORT,
    routes,
    steps,
    consoleStatus: browserProblems.length === 0 ? 'clean' : 'errors',
    browserProblems,
    previewLifecycle: process.env.RB_GATE_BASE_URL ? 'Used supplied local built server; lifecycle owned by candidate launcher' : 'runIdeGate started a production preview on a reserved port and stopped it in finally',
    proofBoundary: 'Browser-local UI behavior only; no Vivado, bitstream, board programming, or hardware observation claimed.',
  };
  await writeFile(
    path.join(ARTIFACT_ROOT, 'ide-sequential-testbench-authority.json'),
    `${JSON.stringify(artifact, null, 2)}\n`,
    'utf8',
  );

  assert(browserProblems.length === 0, `browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function renameActiveTestbench(page, name) {
  await page.getByLabel('Manage testbench', { exact: true }).click();
  await clickVisible(page, '[data-testid="ide-scenario-rename-btn"]', 'Rename testbench');
  const input = page.getByTestId('ide-scenario-rename-input').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(name);
  await input.press('Enter');
  await page.waitForFunction(
    (expected) => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      return state?.scenarios?.find((scenario) => scenario.id === state.activeScenarioId)?.name === expected;
    },
    name,
    { timeout: 5000 },
  );
}

async function applyClockPattern(page, testId, expectedValues, clockRow) {
  const before = await readClockTimeline(page, clockRow);
  await clickVisible(page, `[data-testid="${testId}"]`, testId);
  await page.waitForFunction(
    (expectedCount) => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      const active = state?.scenarios?.find((scenario) => scenario.id === state.activeScenarioId);
      return (active?.vectors?.length ?? 0) === expectedCount;
    },
    before.values.length + expectedValues.length,
    { timeout: 8000 },
  );
  const after = await readClockTimeline(page, clockRow);
  const values = after.values.slice(-expectedValues.length);
  const ticks = after.ticks.slice(-expectedValues.length);
  assert(
    JSON.stringify(values) === JSON.stringify(expectedValues),
    `${testId} materialized ${JSON.stringify(values)}, expected ${JSON.stringify(expectedValues)}`,
  );
  return { values, ticks };
}

async function setCounterControls(page, ticks) {
  const documentState = await readDocumentState(page);
  const inputs = documentState.ioRows.filter((row) => row.direction === 'in');
  const enable = inputs.find((row) => normalize(row.id) === 'en' || normalize(row.nodeId) === 'en_node');
  const reset = inputs.find((row) => normalize(row.id) === 'rst' || normalize(row.nodeId) === 'rst_node');
  assert(enable, `counter enable row missing: ${JSON.stringify(inputs)}`);
  for (const tick of ticks) {
    await setStimulusBit(page, enable, tick, 1);
    if (reset) await setStimulusBit(page, reset, tick, 0);
  }
  return {
    enable: enable.id,
    reset: reset?.id ?? null,
    ticks,
    enableValues: ticks.map(() => 1),
    resetValues: ticks.map(() => 0),
  };
}

async function authorCounterExpectedChecks(page) {
  const before = await readDocumentState(page);
  const outputs = before.ioRows.filter((row) => row.direction === 'out');
  const q0 = outputs.find((row) => normalize(row.id) === 'q0' || normalize(row.nodeId) === 'q0_out');
  const q1 = outputs.find((row) => normalize(row.id) === 'q1' || normalize(row.nodeId) === 'q1_out');
  assert(q0 && q1, `Q0/Q1 output rows missing: ${JSON.stringify(outputs)}`);
  const timeline = computeCounterTimeline(before);
  let changedCheckCount = 0;
  for (const entry of timeline) {
    changedCheckCount += await setExpectedBit(page, q0, entry.tick, entry.q0);
    changedCheckCount += await setExpectedBit(page, q1, entry.tick, entry.q1);
  }

  const completed = await readDocumentState(page);
  for (const entry of timeline) {
    const vector = completed.vectors.find((candidate) => candidate.tick === entry.tick);
    assert(readRecordBit(vector?.expected, q0) === entry.q0, `${q0.id} check at tick ${entry.tick} is not ${entry.q0}`);
    assert(readRecordBit(vector?.expected, q1) === entry.q1, `${q1.id} check at tick ${entry.tick} is not ${entry.q1}`);
  }
  return {
    logicalSignals: [q0.id, q1.id],
    changedCheckCount,
    totalCheckCount: timeline.length * 2,
    expectedSequence: timeline.map(({ tick, count, q0: q0Value, q1: q1Value }) => ({
      tick,
      count,
      q0: q0Value,
      q1: q1Value,
    })),
  };
}

async function setStimulusBit(page, row, tick, target) {
  const current = await readScenarioVectorBit(page, 'inputs', row, tick);
  if (current === target) return 0;
  const output = (await readDocumentState(page)).ioRows.find(field => field.direction === 'out');
  await page.getByTestId(`ide-timing-check-${output.id}-${tick}`).click();
  const editor = page.getByTestId('ide-scenario-event-editor-details');
  if ((await editor.getAttribute('open')) === null) await editor.locator('summary').click();
  const testId = `ide-scenario-input-${row.id}`;
  const cell = page.getByTestId(testId).first();
  await activateStimulusCellByKeyboard(page, cell, `Set ${row.id} t${tick}=${target}`);
  await page.waitForFunction(
    ({ aliases, vectorTick, expected }) => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      const scenario = state?.scenarios?.find((entry) => entry.id === state.activeScenarioId);
      const record = scenario?.vectors?.find((vector) => vector.tick === vectorTick)?.inputs ?? {};
      const normalizeSignal = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      return Object.entries(record).some(([key, value]) => aliases.includes(normalizeSignal(key)) && value === expected);
    },
    { aliases: Array.from(signalAliases(row)), vectorTick: tick, expected: target },
    { timeout: 5000 },
  );
  return 1;
}

async function setExpectedBit(page, row, tick, target) {
  let clickCount = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await readScenarioVectorBit(page, 'expected', row, tick);
    if (current === target) return clickCount;
    await page.getByTestId(`ide-timing-check-${row.id}-${tick}`).click();
    const editor = page.getByTestId('ide-scenario-event-editor-details');
    if ((await editor.getAttribute('open')) === null) await editor.locator('summary').click();
    const testId = `ide-scenario-check-${row.id}`;
    const cell = page.getByTestId(testId).first();
    await activateStimulusCellByKeyboard(page, cell, `Set ${row.id} expected t${tick}`);
    clickCount += 1;
    await page.waitForFunction(
      ({ aliases, vectorTick, previous }) => {
        const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
        const scenario = state?.scenarios?.find((entry) => entry.id === state.activeScenarioId);
        const record = scenario?.vectors?.find((vector) => vector.tick === vectorTick)?.expected ?? {};
        const normalizeSignal = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const value = Object.entries(record).find(([key]) => aliases.includes(normalizeSignal(key)))?.[1];
        return (value === 0 || value === 1 ? value : null) !== previous;
      },
      { aliases: Array.from(signalAliases(row)), vectorTick: tick, previous: current },
      { timeout: 5000 },
    );
  }
  throw new Error(`Could not set ${row.id} expected value at tick ${tick} to ${target}`);
}

async function activateStimulusCellByKeyboard(page, cell, label) {
  assert(await visible(cell), `${label} cell must be visible`);
  await cell.evaluate((element) => element.focus({ preventScroll: true }));
  assert(await cell.evaluate((element) => document.activeElement === element), `${label} cell must receive focus`);
  await page.keyboard.press('Enter');
}

async function readScenarioVectorBit(page, field, row, tick) {
  return page.evaluate(
    ({ recordField, aliases, vectorTick }) => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      const scenario = state?.scenarios?.find((entry) => entry.id === state.activeScenarioId);
      const record = scenario?.vectors?.find((vector) => vector.tick === vectorTick)?.[recordField] ?? {};
      const normalizeSignal = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const value = Object.entries(record).find(([key]) => aliases.includes(normalizeSignal(key)))?.[1];
      return value === 0 || value === 1 ? value : null;
    },
    { recordField: field, aliases: Array.from(signalAliases(row)), vectorTick: tick },
  );
}

async function waitForPersistedDocument(page, expected) {
  await page.locator('[data-testid="ide-save-state"][data-state="saved"]').waitFor({ timeout: 20000 });
  const stored = await page.evaluate(async () => {
    const projectId = window.__RB_PROJECT_RUNTIME__.getState().projectId;
    const databases = await indexedDB.databases();
    if (!databases.some(entry => entry.name === 'redbyte-ide-sessions-v1')) return null;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('redbyte-ide-sessions-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const value = await new Promise((resolve, reject) => {
        const transaction = db.transaction('records', 'readonly');
        const request = transaction.objectStore('records').get(`rb.ide.project.v1:${projectId}`);
        transaction.oncomplete = () => resolve(request.result?.value ?? null);
        transaction.onabort = () => reject(transaction.error);
      });
      return { projectId, snapshot: value ? JSON.parse(value) : null };
    } finally { db.close(); }
  });
  const snapshot = stored?.snapshot;
  const scenario = snapshot?.scenarios?.find(entry => entry.id === expected.id);
  assert(snapshot?.activeScenarioId === expected.id, 'Committed IndexedDB active scenario differs');
  assert(scenario, 'Committed IndexedDB record must contain the authored scenario');
  assertSameAuthoredDocument(expected, { ...scenario, steps: scenario.steps ?? [] }, 'committed IndexedDB save');
  return { projectId: stored.projectId, activeScenarioId: snapshot.activeScenarioId };
}
async function runFreshVerification(page, expectation) {
  const beforeHistory = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyRunHistory?.length ?? 0,
  );
  await clickVerifyRun(page);
  await page.waitForFunction(
    (historyLength) =>
      (window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyRunHistory?.length ?? 0) > historyLength,
    beforeHistory,
    { timeout: 30000 },
  );
  await waitForVerifyResult(page, { timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-run-identity"]')?.getAttribute('data-run-id') === window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.runId,
    { timeout: 10000 },
  );
  const run = await readRunState(page);
  assert(run.runKind === expectation.kind, `expected ${expectation.kind} run, got ${run.runKind}`);
  if (expectation.status) {
    assert(run.status === expectation.status, `expected ${expectation.status} run, got ${run.status}: ${run.summaryText}`);
  }
  return run;
}

async function assertDistinctRunMetrics(page, run) {
  const settings = page.getByTestId('ide-timing-settings');
  if ((await settings.getAttribute('open')) === null) await settings.locator('summary').click();
  const count = page.getByTestId('ide-timing-lab-count');
  assert(await visible(count), 'Timing event/check counts must be visible on request');
  const countText = await text(count);
  const cases = run.report.vectors.length;
  const checks = run.report.rows.length;
  assert(countText.includes(`${cases} events`) && countText.includes(`${checks} checks`), `Event/check counts differ from recorded report: ${countText}`);
  const verdict = await text(page.getByTestId('ide-run-check-result'));
  const passed = run.report.rows.filter(row => row.status === 'pass').length;
  const failed = run.report.rows.filter(row => row.status === 'fail').length;
  assert(verdict === `${passed} checks passed`, `Visible check verdict differs from recorded checks: ${verdict}`);
  assert(failed === 0 && passed === checks, 'Passing counter must grade every authored check');
  assert(run.runTickCount === cases && run.waveform.length === cases, 'Authored events, execution ticks and waveform samples must agree');
  assert(!/coverage/i.test(countText), 'Sequential events must not imply combinational coverage');
  return { events: cases, checks, passed, failed, executionTicks: run.runTickCount, waveformSamples: run.waveform.length, countText, verdict };
}
async function assertWaveformAuthority(page, ioRows) {
  const waveform = page.getByTestId('ide-timing-lanes').locator('svg').first();
  assert(await visible(waveform), 'waveform SVG must be visible');
  const lanes = await page.locator('[data-testid^="ide-timing-lane-"]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-testid')?.replace('ide-timing-lane-', '') ?? '').filter(Boolean),
  );
  assert(lanes.length > 0, 'waveform must contain signal lanes');
  assert(new Set(lanes.map(normalize)).size === lanes.length, `waveform contains duplicate normalized lanes: ${JSON.stringify(lanes)}`);

  const logicalLaneCounts = new Map();
  for (const lane of lanes) {
    const matches = ioRows.filter((row) => signalAliases(row).has(normalize(lane)));
    assert(matches.length <= 1, `waveform lane ${lane} ambiguously matches logical IO rows ${matches.map((row) => row.id).join(', ')}`);
    if (matches.length === 1) {
      const row = matches[0];
      assert(normalize(lane) === normalize(row.id), `logical ${row.id} rendered under alias lane ${lane}`);
      logicalLaneCounts.set(row.id, (logicalLaneCounts.get(row.id) ?? 0) + 1);
    }
  }
  for (const row of ioRows) {
    assert(logicalLaneCounts.get(row.id) === 1, `logical IO ${row.id} must have exactly one waveform lane; got ${logicalLaneCounts.get(row.id) ?? 0}`);
  }
  return {
    laneCount: lanes.length,
    lanes,
    logicalIoLaneCounts: Object.fromEntries(logicalLaneCounts),
  };
}

async function readProjectInspection(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    return {
      projectName: state?.projectName ?? null,
      sourceExampleId: state?.sourceExampleId ?? state?.activeExample?.id ?? null,
      activeExampleId: state?.activeExampleId ?? null,
      nodeIds: (state?.circuit?.nodes ?? []).map((node) => node.id),
      connectionCount: state?.circuit?.connections?.length ?? 0,
    };
  });
}

async function readDocumentState(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const scenario = state?.scenarios?.find((entry) => entry.id === state.activeScenarioId);
    return {
      id: scenario?.id ?? null,
      name: scenario?.name ?? null,
      version: scenario?.version ?? null,
      scenarioCount: state?.scenarios?.length ?? 0,
      vectors: (scenario?.vectors ?? []).map((vector) => ({
        id: vector.id ?? null,
        tick: vector.tick,
        inputs: { ...(vector.inputs ?? {}) },
        expected: { ...(vector.expected ?? {}) },
      })),
      steps: (scenario?.steps ?? []).map((step) => ({ ...step })),
      sequentialPolicy: scenario?.sequentialPolicy ? { ...scenario.sequentialPolicy } : null,
      scenarioAuthority: state?.scenarioAuthority ?? null,
      ioRows: (state?.projectIoRows ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        nodeId: row.nodeId,
        direction: row.direction,
        timingRole: row.timingRole,
      })),
    };
  });
}

async function readClockRow(page) {
  const documentState = await readDocumentState(page);
  const row = documentState.ioRows.find((entry) => entry.direction === 'in' && entry.timingRole === 'clock') ??
    documentState.ioRows.find((entry) => entry.direction === 'in' && /clk|clock/i.test(`${entry.id} ${entry.label} ${entry.nodeId}`));
  assert(row, `clock IO row missing: ${JSON.stringify(documentState.ioRows)}`);
  return row;
}

async function readClockTimeline(page, clockRow) {
  return page.evaluate((row) => {
    const normalizeSignal = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const aliases = new Set(
      [row.id, row.label, row.nodeId, `${row.nodeId}.out`, `${row.nodeId}_out`, `${row.nodeId}:out`]
        .map(normalizeSignal)
        .filter(Boolean),
    );
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const scenario = state?.scenarios?.find((entry) => entry.id === state.activeScenarioId);
    const sorted = [...(scenario?.vectors ?? [])].sort((left, right) => left.tick - right.tick);
    return {
      ticks: sorted.map((vector) => vector.tick),
      values: sorted.map((vector) => {
        const match = Object.entries(vector.inputs ?? {}).find(([key]) => aliases.has(normalizeSignal(key)));
        return match?.[1] === 1 || match?.[1] === true ? 1 : 0;
      }),
    };
  }, clockRow);
}

async function readRunState(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const run = state?.verifyLastRun;
    const ticks = new Set([
      ...(run?.report?.rows ?? []).map((row) => row.tick),
      ...(run?.waveform ?? []).map((sample) => sample.tick),
    ]);
    return {
      runKind: run?.runKind ?? null,
      status: run?.status ?? null,
      reportHash: run?.reportHash ?? null,
      generatedAtIso: run?.generatedAtIso ?? null,
      schedule: run?.schedule ?? null,
      clockPolicy: run?.clockPolicy ? { ...run.clockPolicy } : null,
      report: {
        vectors: (run?.report?.vectors ?? []).map((vector) => ({ ...vector })),
        rows: (run?.report?.rows ?? []).map((row) => ({ ...row })),
      },
      waveform: (run?.waveform ?? []).map((sample) => ({ tick: sample.tick, signals: { ...sample.signals } })),
      runTickCount: ticks.size,
      summaryText: document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      resultsKind: document.querySelector('[data-testid="ide-run-identity"]')?.getAttribute('data-currency') ?? null,
      ioRows: (state?.projectIoRows ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        nodeId: row.nodeId,
        direction: row.direction,
      })),
    };
  });
}

function computeCounterTimeline(documentState) {
  const inputs = documentState.ioRows.filter((row) => row.direction === 'in');
  const clock = inputs.find((row) => row.timingRole === 'clock') ??
    inputs.find((row) => /clk|clock/i.test(`${row.id} ${row.label} ${row.nodeId}`));
  const enable = inputs.find((row) => normalize(row.id) === 'en' || normalize(row.nodeId) === 'en_node');
  const reset = inputs.find((row) => normalize(row.id) === 'rst' || normalize(row.nodeId) === 'rst_node');
  assert(clock && enable, `counter clock/enable rows missing: ${JSON.stringify(inputs)}`);

  let previousClock = documentState.sequentialPolicy?.startLevel === 1 ? 1 : 0;
  let count = 0;
  return [...documentState.vectors]
    .sort((left, right) => left.tick - right.tick)
    .map((vector) => {
      const clockValue = readRecordBit(vector.inputs, clock) ?? 0;
      const enableValue = readRecordBit(vector.inputs, enable) ?? 0;
      const resetValue = reset ? readRecordBit(vector.inputs, reset) ?? 0 : 0;
      const rising = previousClock === 0 && clockValue === 1;
      const falling = previousClock === 1 && clockValue === 0;
      const holdHigh = previousClock === 1 && clockValue === 1;
      const holdLow = previousClock === 0 && clockValue === 0;
      if (rising) {
        if (resetValue === 1) count = 0;
        else if (enableValue === 1) count = (count + 1) % 4;
      }
      previousClock = clockValue;
      return {
        tick: vector.tick,
        clock: clockValue,
        enable: enableValue,
        reset: resetValue,
        rising,
        falling,
        holdHigh,
        holdLow,
        count,
        q0: count & 1,
        q1: (count >> 1) & 1,
      };
    });
}

function assertCounterClockAuthority(run, documentState, options = {}) {
  const timeline = computeCounterTimeline(documentState);
  const outputs = documentState.ioRows.filter((row) => row.direction === 'out');
  const clock = documentState.ioRows.find((row) => row.direction === 'in' && row.timingRole === 'clock') ??
    documentState.ioRows.find((row) => row.direction === 'in' && /clk|clock/i.test(`${row.id} ${row.label} ${row.nodeId}`));
  const q0 = outputs.find((row) => normalize(row.id) === 'q0' || normalize(row.nodeId) === 'q0_out');
  const q1 = outputs.find((row) => normalize(row.id) === 'q1' || normalize(row.nodeId) === 'q1_out');
  assert(clock && q0 && q1, 'counter clock/Q0/Q1 rows must exist for authority proof');

  const waveformByTick = new Map(run.waveform.map((sample) => [sample.tick, sample]));
  const actualCounts = [];
  const waveformClockValues = [];
  let previousActualCount = 0;
  for (const expected of timeline) {
    const reportVector = run.report.vectors.find((vector) => vector.tick === expected.tick);
    assert(reportVector, `run report vector missing tick ${expected.tick}`);
    const reportClock = readRecordBit(reportVector.inputs, clock);
    assert(reportClock === expected.clock, `run clock at tick ${expected.tick} is ${reportClock}, expected ${expected.clock}`);

    const waveformSample = waveformByTick.get(expected.tick);
    assert(waveformSample, `waveform sample missing tick ${expected.tick}`);
    const waveformClock = readRecordBit(waveformSample.signals, clock);
    assert(waveformClock === expected.clock, `waveform clock at tick ${expected.tick} is ${waveformClock}, expected ${expected.clock}`);
    waveformClockValues.push(waveformClock);

    const q0Row = run.report.rows.find((row) => row.tick === expected.tick && signalAliases(q0).has(normalize(row.signal)));
    const q1Row = run.report.rows.find((row) => row.tick === expected.tick && signalAliases(q1).has(normalize(row.signal)));
    assert(q0Row && q1Row, `Q0/Q1 observed rows missing at tick ${expected.tick}`);
    const actualCount = (q0Row.actual === '1' ? 1 : 0) | (q1Row.actual === '1' ? 2 : 0);
    assert(actualCount === expected.count, `counter state at tick ${expected.tick} is ${actualCount}, expected ${expected.count}`);
    if (actualCount !== previousActualCount) {
      assert(expected.rising, `counter changed at tick ${expected.tick} without an authored rising edge`);
    }
    previousActualCount = actualCount;
    actualCounts.push(actualCount);
  }

  const risingTicks = timeline.filter((entry) => entry.rising).map((entry) => entry.tick);
  const fallingTicks = timeline.filter((entry) => entry.falling).map((entry) => entry.tick);
  const highHoldTicks = timeline.filter((entry) => entry.holdHigh).map((entry) => entry.tick);
  const lowHoldTicks = timeline.filter((entry) => entry.holdLow).map((entry) => entry.tick);
  if (options.requireFlatLow) {
    assert(risingTicks.length === 0, `flat-low proof contains rising ticks: ${JSON.stringify(risingTicks)}`);
    assert(timeline.every((entry) => entry.clock === 0), 'flat-low proof contains a high clock row');
    assert(actualCounts.every((count) => count === 0), `flat-low clock advanced state: ${JSON.stringify(actualCounts)}`);
  } else {
    assert(risingTicks.length >= 2, `authored timeline must contain at least two rising edges: ${JSON.stringify(risingTicks)}`);
    assert(fallingTicks.length >= 2, `authored timeline must contain falling edges: ${JSON.stringify(fallingTicks)}`);
    assert(highHoldTicks.length >= 1, 'authored timeline must contain a high hold');
    assert(lowHoldTicks.length >= 1, 'authored timeline must contain a low hold');
  }
  return { risingTicks, fallingTicks, highHoldTicks, lowHoldTicks, actualCounts, waveformClockValues };
}

function readRecordBit(record, row) {
  const aliases = signalAliases(row);
  for (const [key, value] of Object.entries(record ?? {})) {
    if (!aliases.has(normalize(key))) continue;
    return value === 1 || value === true || value === '1' ? 1 : 0;
  }
  return null;
}

async function assertAuthoredTestbenchExport(page, baseUrl, clockRow) {
  await openMode(page, baseUrl, 'export', 'sequential-testbench-authority-export');
  await page.getByTestId('ide-export-file-browser').first().waitFor({ state: 'visible', timeout: 15000 });
  const tab = page.getByTestId('ide-export-file-testbench-vhd').first();
  assert(await visible(tab), 'testbench.vhd artifact must be visible in Export');
  await tab.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-export-preview-path"]')?.textContent?.trim() === 'testbench.vhd',
    { timeout: 10000 },
  );
  const content = await text(page.getByTestId('ide-export-preview-code'));
  assert(content.includes('-- sequence=authored-vectors'), 'exported testbench must declare authored-vector clock semantics');
  assert(!content.includes('clock_gen: process'), 'manual/custom testbench must not contain a free-running clock process');
  assert(!content.includes('CLK_HALF_PERIOD'), 'manual/custom testbench must not contain an automatic clock period');
  assert(!content.includes('wait until rising_edge'), 'manual/custom testbench must not wait on an independent rising edge');
  const clockNames = [clockRow.id, clockRow.label, 'CLK100MHZ', 'clk'].map(normalize).filter(Boolean);
  const assignments = content.match(/\b[A-Za-z_][A-Za-z0-9_]*(?:\(\d+\))?\s*<=\s*'[01]';/g) ?? [];
  const clockAssignments = assignments.filter((line) => clockNames.some((name) => normalize(line.split('<=')[0]).includes(name)));
  assert(clockAssignments.some((line) => line.includes("'0'")), `testbench clock low assignment missing: ${JSON.stringify(clockAssignments)}`);
  assert(clockAssignments.some((line) => line.includes("'1'")), `testbench clock high assignment missing: ${JSON.stringify(clockAssignments)}`);
  assert(content.includes('wait for 10 ns;'), 'authored clock vectors must receive deterministic settle time');
  return {
    path: 'testbench.vhd',
    sequence: 'authored-vectors',
    clockAssignmentCount: clockAssignments.length,
    hasLow: true,
    hasHigh: true,
    freeRunningClock: false,
    independentEdgeWait: false,
  };
}

function summarizeRun(run) {
  return {
    runKind: run.runKind,
    status: run.status,
    reportHash: run.reportHash,
    schedule: run.schedule,
    caseCount: run.report.vectors.length,
    assertedCheckCount: run.report.rows.length,
    tickCount: run.runTickCount,
    waveformSampleCount: run.waveform.length,
    clockPolicy: run.clockPolicy,
    resultsKind: run.resultsKind,
  };
}

function assertSameAuthoredDocument(expected, actual, label) {
  assert(actual.id === expected.id, `${label}: scenario id changed ${expected.id} -> ${actual.id}`);
  assert(actual.name === expected.name, `${label}: scenario name changed ${expected.name} -> ${actual.name}`);
  assert(actual.version === expected.version, `${label}: scenario version changed ${expected.version} -> ${actual.version}`);
  const expectedTimeline = vectorSemantics(expected.vectors);
  const actualTimeline = vectorSemantics(actual.vectors);
  assert(
    stable(actualTimeline) === stable(expectedTimeline),
    `${label}: authored timeline values changed: ${JSON.stringify(firstTimelineDelta(expectedTimeline, actualTimeline))}`,
  );
  assert(stable(actual.steps) === stable(expected.steps), `${label}: authored steps changed`);
  assert(stable(actual.sequentialPolicy) === stable(expected.sequentialPolicy), `${label}: sequential policy changed`);
}

function firstTimelineDelta(expected, actual) {
  const count = Math.max(expected.length, actual.length);
  for (let index = 0; index < count; index += 1) {
    if (stable(expected[index]) !== stable(actual[index])) {
      return { index, expected: expected[index] ?? null, actual: actual[index] ?? null };
    }
  }
  return { expectedCount: expected.length, actualCount: actual.length };
}

function vectorSemantics(vectors) {
  return vectors.map((vector) => ({
    tick: vector.tick,
    inputs: vector.inputs,
    expected: vector.expected,
  }));
}

async function findQ1OutputWire(page) {
  const wire = await page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const output = (state?.projectIoRows ?? []).find((row) => row.direction === 'out' && row.id === 'q1') ??
      (state?.projectIoRows ?? []).find((row) => row.direction === 'out' && /q1|ld1/i.test(`${row.id} ${row.label} ${row.nodeId}`));
    if (!output?.nodeId) return null;
    const readRef = (ref, fallbackPort) =>
      typeof ref === 'string'
        ? { nodeId: ref, port: fallbackPort }
        : { nodeId: ref?.nodeId, port: ref?.portName ?? ref?.port ?? fallbackPort };
    for (const connection of state?.circuit?.connections ?? []) {
      const from = readRef(connection.from, connection.fromPort ?? 'out');
      const to = readRef(connection.to, connection.toPort ?? 'in');
      if (to.nodeId !== output.nodeId) continue;
      return {
        id: connection.id ?? `${from.nodeId}.${from.port}-${to.nodeId}.${to.port}`,
        fromNodeId: from.nodeId,
        fromPort: from.port,
        toNodeId: to.nodeId,
        toPort: to.port,
        logicalOutput: output.id,
      };
    }
    return null;
  });
  assert(wire?.id && wire.fromNodeId && wire.toNodeId, `Q1 output wire not found: ${JSON.stringify(wire)}`);
  return wire;
}

async function selectWire(page, wireId) {
  const wire = page.locator(`[data-wire-id="${wireId}"]`).first();
  await wire.waitFor({ state: 'attached', timeout: 8000 });
  const hitPath = wire.locator('path').first();
  if (await hitPath.isVisible().catch(() => false)) {
    await hitPath.click({ force: true });
  } else {
    await wire.evaluate((element) => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }
  await page.waitForFunction(
    (id) => document.querySelector(`[data-wire-id="${id}"]`)?.getAttribute('data-wire-selected') === '1',
    wireId,
    { timeout: 5000 },
  );
}

async function connectPorts(page, fromNodeId, fromPort, toNodeId, toPort) {
  const before = await readConnectionCount(page);
  await clickPort(page, fromNodeId, fromPort);
  await page.waitForFunction(
    ({ nodeId, portName }) => {
      const start = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort;
      return start?.nodeId === nodeId && start?.portName === portName;
    },
    { nodeId: fromNodeId, portName: fromPort },
    { timeout: 5000 },
  );
  await clickPort(page, toNodeId, toPort);
  await waitForConnectionCount(page, before + 1, `connect ${fromNodeId}.${fromPort} to ${toNodeId}.${toPort}`);
}

async function clickPort(page, nodeId, portName) {
  const port = page.locator(`[data-node-id="${nodeId}"] [data-port-id="${portName}"]`).first();
  await port.waitFor({ state: 'visible', timeout: 8000 });
  const box = await port.boundingBox();
  assert(Boolean(box), `port ${nodeId}.${portName} is not measurable`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    const portElement = element?.closest?.('[data-port-id]');
    const nodeElement = element?.closest?.('[data-node-id]') ?? portElement?.closest?.('[data-node-id]');
    return {
      nodeId: nodeElement?.getAttribute?.('data-node-id') ?? null,
      portName: portElement?.getAttribute?.('data-port-id') ?? null,
    };
  }, point);
  if (hit.nodeId === nodeId && hit.portName === portName) {
    await page.mouse.click(point.x, point.y);
    return;
  }
  await port.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function fitCircuit(page) {
  const fit = page.locator('[data-testid="ide-design-fit-circuit-canvas"]:visible').first();
  if (await fit.isVisible().catch(() => false)) {
    await fit.click();
    await page.waitForTimeout(180);
  }
}

async function readConnectionCount(page) {
  return page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0);
}

async function waitForConnectionCount(page, expected, label) {
  await page.waitForFunction(
    (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) === count,
    expected,
    { timeout: 8000 },
  );
  assert((await readConnectionCount(page)) === expected, `${label}: connection count did not reach ${expected}`);
}

async function readRuntimeDirty(page) {
  return page.evaluate(() => Boolean(window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectHealthCore?.dirtySinceVerify));
}

async function clickVisible(page, selector, label) {
  const locator = page.locator(selector).first();
  assert(await visible(locator), `${label} must be visible (${selector})`);
  await locator.scrollIntoViewIfNeeded().catch(() => null);
  try {
    await locator.click({ timeout: 2500 });
  } catch {
    // Compact classroom geometry can put a neighboring sticky lane above a
    // visibly rendered control. Dispatch the element's ordinary click so the
    // same product handler runs without introducing runtime-store mutations.
    await locator.evaluate((element) => {
      if (!(element instanceof HTMLElement)) throw new Error('expected clickable HTMLElement');
      element.click();
    });
  }
}

async function capture(page, slug) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${VIEWPORT.label}-${slug}.png`),
    fullPage: false,
  });
}

async function text(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

function signalAliases(row) {
  return new Set(
    [
      row.id,
      row.label,
      row.nodeId,
      `${row.nodeId}.in`,
      `${row.nodeId}.out`,
      `${row.nodeId}_in`,
      `${row.nodeId}_out`,
      `${row.nodeId}:in`,
      `${row.nodeId}:out`,
    ]
      .map(normalize)
      .filter(Boolean),
  );
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
