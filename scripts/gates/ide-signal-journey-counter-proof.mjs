#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  assert, clickVerifyRun, ensureVerifyVectorsReady, loadStarterProject, runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { assertBuildHash, assertNoRootOverflow, captureBrowserProblems } from './_workbenchReconstructionHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

// This proof discovers and opens the shipped starter through normal controls. Runtime
// reads below only inspect the recording made by Run; no project/storage fixture is injected.
assert(process.env.RB_GATE_BASE_URL, 'Set RB_GATE_BASE_URL to the already running local candidate for this proof');
const OUT = process.env.RB_COUNTER_OUT ? path.resolve(process.env.RB_COUNTER_OUT)
  : path.join(process.cwd(), '.redbyte', 'signal-journey', 'counter-dev');
const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1000x650', width: 1000, height: 650 },
];
await mkdir(OUT, { recursive: true });

await runIdeGate('IDE Signal Journey counter proof', async ({ page, baseUrl }) => {
  const problems = captureBrowserProblems(page);
  const receipt = {
    gate: 'ide-signal-journey-counter-proof', baseUrl, generatedAtIso: new Date().toISOString(),
    proofBoundary: 'Fresh isolated Playwright context; CSS-pixel viewports, logical simulation, no physical board observation',
    records: [], browserProblems: problems, failures: [], timings: [],
  };
  let originalRecording;
  try {
    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
    await timed(receipt, 'open Project', async () => {
      await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=signal-journey-counter-proof`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('ide-mode-project').waitFor({ state: 'visible', timeout: 20000 });
    });
    await assertBuildHash(page, 'counter candidate');
    await timed(receipt, 'discover and load 2-Bit Up Counter starter', () => loadStarterProject(page, { exactExampleId: 'two-bit-counter' }));
    await openWorkspace(page, 'verify');
    await ensureVerifyVectorsReady(page);
    assert(await setVerifyRunMode(page, 'compare'), 'Starter saved checks must be available');
    const capture = page.getByRole('checkbox', { name: 'Evaluation steps', exact: true });
    await capture.waitFor({ state: 'visible' });
    await capture.check();
    assert(await capture.isChecked(), 'Evaluation steps must be enabled through its normal checkbox');
    await shot(page, VIEWPORTS[0], '01-counter-scenario');
    await timed(receipt, 'Run with evaluation capture', async () => {
      await clickVerifyRun(page);
      await waitForVerifyResult(page, { timeout: 30000 });
    });
    let status = (await page.getByTestId('ide-verify-summary-status').first().innerText()).trim();
    assert(isVerifyPass(status), `Shipped counter checks must pass; UI says ${JSON.stringify(status)}`);
    originalRecording = await readRun(page);
    assert(originalRecording, 'Run must create a retained recording');
    assertCounterRecording(originalRecording);
    const baselineRecording = originalRecording;
    await writeFile(path.join(OUT, 'retained-counter-baseline.json'), JSON.stringify(baselineRecording, null, 2));
    const baselineReset = findEvent(baselineRecording, 'rst_node', 5, 'macro-high-sample', 'before-capture');
    assert(baselineReset.outputs.out === 0, 'The shipped t5 transition is rollover with reset low; it must not be called a reset demonstration');
    receipt.baselineRun = { runId: baselineRecording.runId, t5Reset: eventSummary(baselineReset),
      transition: '11 to 00 with EN=1, RST=0 is rollover' };
    await timed(receipt, 'author reset from nonzero count through normal controls', async () => {
      receipt.resetAuthorship = await authorNonzeroReset(page);
    });
    await shot(page, VIEWPORTS[0], '01b-authored-nonzero-reset');
    await timed(receipt, 'Run independently checked nonzero reset with capture', async () => {
      await clickVerifyRun(page);
      await waitForVerifyResult(page, { timeout: 30000 });
    });
    status = (await page.getByTestId('ide-verify-summary-status').first().innerText()).trim();
    assert(isVerifyPass(status), `Authored nonzero reset must pass the independent saved 00 expectation; UI says ${JSON.stringify(status)}`);
    originalRecording = await readRun(page);
    assert(originalRecording.runId !== baselineRecording.runId, 'The reset experiment must create a separate retained recording');
    assertCounterRecording(originalRecording);
    assert(originalRecording.clockPolicy.resetBehavior === 'custom', 'Run must retain the authored reset policy rather than override it with reset at t0');
    const archivedBaseline = await readArchivedRun(page, baselineRecording.runId);
    await writeFile(path.join(OUT, 'retained-counter-baseline-after-reset.json'), JSON.stringify(archivedBaseline, null, 2));
    // Runtime clone normalizes optional undefined properties; compare the complete saved
    // JSON content, including trace/state/source snapshots, rather than object prototypes.
    assert(isDeepStrictEqual(JSON.parse(JSON.stringify(archivedBaseline)), JSON.parse(JSON.stringify(baselineRecording))),
      'Authoring and rerunning reset must preserve the entire saved baseline recording content');
    await writeFile(path.join(OUT, 'retained-counter-run.json'), JSON.stringify(originalRecording, null, 2));
    receipt.run = {
      runId: originalRecording.runId, engine: originalRecording.identity?.engine,
      schedule: originalRecording.schedule, status, traceStatus: originalRecording.evaluationTrace.status,
      eventCount: originalRecording.evaluationTrace.events.length, sampleCount: originalRecording.waveform.length,
      checkCount: originalRecording.report.rows.length, clockPolicy: originalRecording.clockPolicy,
    };

    for (const viewport of VIEWPORTS) {
      const record = { viewport: viewport.label, checks: [], timings: [] };
      receipt.records.push(record);
      try {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await assertNoRootOverflow(page, `${viewport.label}: experiment`);
        await timed(record, 'Follow signal', async () => {
          await page.getByTestId('ide-follow-signal').click();
          await page.getByTestId('ide-signal-journey').waitFor({ state: 'visible' });
        });
        const journey = page.getByTestId('ide-signal-journey');
        assert(await journey.getAttribute('data-run-id') === originalRecording.runId, 'Journey must follow the exact recording Run created');
        assert(await journey.getAttribute('data-node-id') === 'q0_out', 'Starter Follow signal must begin on the actual LD0 output boundary');
        await assertJourneyGeometry(page, viewport, 'following output');
        await shot(page, viewport, '02-follow-output');

        await journey.getByRole('button', { name: 'Q0 · Q', exact: true }).click();
        assert(await journey.getAttribute('data-node-id') === 'q0_ff', 'Follow driver must select the retained Q0 flip-flop ID');
        await journey.getByRole('button', { name: 'Logic', exact: true }).click();
        await journey.getByText('Connection and execution details', {exact:true}).click();
        assert(/State boundary/.test(await journey.locator('.rb-journey-rule').innerText()), 'The Boolean expression must stop at the register state boundary');
        record.checks.push('Follow driver selects Q0; Boolean derivation stops at state');

        const captureEvent = findEvent(originalRecording, 'q0_ff', 2, 'macro-high-sample', 'capture');
        assert(captureEvent.inputs.D === 1 && captureEvent.inputs.CLK === 1, 'Enabled rising edge must read actual D=1, CLK=1');
        assert(captureEvent.previousOutputs.Q === 0 && captureEvent.outputs.Q === 1, 'Enabled Q0 capture must change 0 to 1');
        await timed(record, 'step to enabled Q0 capture', () => seekEventThroughKeyboard(page, captureEvent));
        const captureText = await journey.locator('.rb-journey-rule').innerText();
        assert(/Q: 0 → 1/.test(captureText) && /pending shared commit/.test(captureText), 'UI must expose the actual pending Q0 result at the shared capture boundary');
        assert(await journey.getAttribute('data-phase') === 'capture'
          && /Storage evaluation at the common capture boundary/.test(captureText)
          && /Captured result · not yet published/.test(await journey.locator('.rb-journey-playback').innerText()),
        'UI must identify the actual storage capture phase and pending common publication separately from a published sample');
        const canonical = journey.getByTestId('ide-journey-canonical-outputs');
        assert(await canonical.locator('[data-output-ports="Q,q,out"]').count() === 1, 'Genuine Q/q/out aliases must have one canonical transition row');
        const learning = await journey.getByTestId('ide-journey-understand').innerText();
        assert(/Data input D/.test(learning) && /Clock/.test(learning) && /0 → 1/.test(learning), 'Primary learning view must show data, clock and actual state transition');
        assert(!/macro-high|current-evaluation|pending shared commit/.test(learning), 'Raw execution names belong in details');
        await journey.getByText('Recorded state before / after', { exact: true }).click();
        const stateText = await journey.locator('.rb-journey-rule details').filter({ hasText: 'Recorded state before / after' }).innerText();
        assert(stateText.includes(JSON.stringify(captureEvent.stateBefore)) && stateText.includes(JSON.stringify(captureEvent.stateAfter)), 'UI must show the actual retained state snapshots');
        await journey.getByText('Connection and execution details', {exact:true}).click();
        await journey.getByText('Recorded state before / after', {exact:true}).click();
        await shot(page, viewport, '03-enabled-capture');
        record.checks.push({ enabledCapture: eventSummary(captureEvent), stateText });

        // Space and arrows are exercised on the focusable panel, including a timed pause.
        await timed(record, 'keyboard play, pause, previous and next', async () => {
          await journey.focus();
          await page.keyboard.press('Space');
          await journey.getByRole('button', { name: 'Pause', exact: true }).waitFor({ state: 'visible' });
          await page.keyboard.press('Space');
          await journey.getByRole('button', { name: 'Play evaluations', exact: true }).waitFor({ state: 'visible' });
          const paused = await journey.getAttribute('data-event');
          await page.waitForTimeout(800);
          assert(await journey.getAttribute('data-event') === paused, 'Paused evaluation must stay fixed across a playback interval');
          await page.keyboard.press('ArrowLeft');
          await waitForEventChange(page, paused);
          const previous = await journey.getAttribute('data-event');
          await page.keyboard.press('ArrowRight');
          await waitForEventChange(page, previous);
          assert(await journey.getAttribute('data-event') === paused, 'Left and right must return to the same exact evaluation');
        });
        record.checks.push('Keyboard Space pauses; arrows move one actual evaluation');

        await journey.getByRole('button', { name: 'Generated HDL', exact: true }).click();
        const mapped = journey.getByTestId('ide-journey-mapped-source');
        await mapped.waitFor({ state: 'visible' });
        const sourceText = await mapped.innerText();
        assert(/top\.vhd:\d+/.test(sourceText), 'Q0 capture must have an exact generated-source span');
        assert(await journey.getAttribute('data-active-node') === captureEvent.nodeId, 'Source lens must retain the actual active evaluation object');
        assert(await journey.getAttribute('data-event') === String(captureEvent.order), 'Source lens must preserve the paused phase');
        await shot(page, viewport, '04-source-capture-boundary');
        record.checks.push({ sourceBoundary: sourceText });

        await journey.getByRole('button', { name: 'Logic', exact: true }).click();
        const holdEvent = findEvent(originalRecording, 'q0_ff', 6, 'macro-high-sample', 'capture');
        assert(holdEvent.inputs.D === 0 && holdEvent.outputs.Q === holdEvent.previousOutputs.Q, 'Disabled counter must actually capture its held Q0 value');
        await timed(record, 'step to disabled Q0 hold', () => seekEventThroughKeyboard(page, holdEvent));
        await journey.getByText('Connection and execution details', {exact:true}).click();
        const holdText = await journey.locator('.rb-journey-rule').innerText();
        assert(/Q: 0 → 0/.test(holdText), 'Disabled capture must expose unchanged Q0 output rather than a fabricated transition');
        await shot(page, viewport, '05-disabled-hold');
        record.checks.push({ disabledHold: eventSummary(holdEvent), holdText });

        const resetEvent = findEvent(originalRecording, 'rst_not', 5, 'macro-high-sample', 'before-capture');
        assert(resetEvent.inputs.in === 1 && resetEvent.outputs.out === 0, 'Reset cone must invert the actual asserted reset');
        await timed(record, 'step to synchronous reset cone', () => seekEventThroughKeyboard(page, resetEvent));
        const resetText = await journey.locator('.rb-journey-rule').innerText();
        assert(await journey.getAttribute('data-active-node') === 'rst_not' && /before-capture/.test(resetText), 'Reset must be shown in its actual pre-capture cone');
        await shot(page, viewport, '06-reset-cone');
        const resetCapture = findEvent(originalRecording, 'q0_ff', 5, 'macro-high-sample', 'capture');
        const resetCaptureHigh = findEvent(originalRecording, 'q1_ff', 5, 'macro-high-sample', 'capture');
        const resetInput = findEvent(originalRecording, 'rst_node', 5, 'macro-high-sample', 'before-capture');
        const enableInput = findEvent(originalRecording, 'en_node', 5, 'macro-high-sample', 'before-capture');
        assert(resetInput.outputs.out === 1 && enableInput.outputs.out === 0, 'Meaningful reset must actually assert RST with EN disabled');
        for (const event of [resetCapture, resetCaptureHigh]) {
          assert(event.inputs.D === 0 && event.inputs.CLK === 1, 'Synchronous reset must read D=0 at the rising edge');
          assert(event.stateBefore.q === 1 && event.stateAfter.q === 0, 'Reset must capture nonzero retained state to zero for both counter bits');
          assert(event.previousOutputs.Q === 1 && event.outputs.Q === 0, 'Reset must publish both retained Q bits from 1 to 0');
        }
        for (const nodeId of ['xor0', 'xor1']) assert(findEvent(originalRecording, nodeId, 5, 'macro-high-sample', 'before-capture').outputs.out === 1,
          'Disabled next-state logic must hold the prior 11 before reset gating; this reset must not be explained by rollover');
        await seekEventThroughKeyboard(page, resetCapture);
        const resetCaptureText = await journey.locator('.rb-journey-rule').innerText();
        assert(/Q: 1 → 0/.test(resetCaptureText), 'The selected reset capture must show its actual nonzero-to-zero result');
        const resetStateDetails = journey.locator('.rb-journey-rule details').filter({ hasText: 'Recorded state before / after' });
        if (await resetStateDetails.getAttribute('open') === null) await resetStateDetails.locator('summary').click();
        const resetStateText = await resetStateDetails.innerText();
        assert(resetStateText.includes(JSON.stringify(resetCapture.stateBefore)) && resetStateText.includes(JSON.stringify(resetCapture.stateAfter)),
          'Reset UI must expose the actual stateBefore=1 and stateAfter=0 snapshots');
        await shot(page, viewport, '06b-nonzero-reset-capture');
        record.checks.push({ resetCone: eventSummary(resetEvent), resetCapture: eventSummary(resetCapture),
          resetCaptureHigh: eventSummary(resetCaptureHigh), resetStateText,
          proof: 'EN=0 would hold 11; asserted RST gates both D inputs to 0 and captures count 3 to 0' });

        await journey.getByRole('button', { name: 'Published sample', exact: true }).click();
        await journey.getByRole('button', { name: 'Recorded time', exact: true }).click();
        const rows = await journey.locator('.rb-journey-table tbody tr').allTextContents();
        assert(rows.length === originalRecording.waveform.length, 'Recorded time must retain every actual sample, including any unasserted run-length extension');
        const headers = await journey.locator('.rb-journey-table thead th').allTextContents();
        const wordHeaders = headers.filter(text => /binary \/ decimal/.test(text));
        const cells = await journey.locator('.rb-journey-table tbody tr').evaluateAll(elements =>
          elements.map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent.trim())));
        const wordIndex = headers.findIndex(text => /LD\[1:0\].*binary \/ decimal/.test(text));
        if (wordIndex >= 0) for (let i = 0; i < originalRecording.waveform.length; i++) {
          const sample = originalRecording.waveform[i];
          const low = sample.signals['q0_out.in'], high = sample.signals['q1_out.in'];
          const bits = `${high}${low}`;
          const expectedWord = /^[01]{2}$/.test(bits) ? `${bits} / ${parseInt(bits, 2)}` : 'unrecorded';
          assert(cells[i][wordIndex] === expectedWord, `t${sample.tick}: retained LD word must read ${expectedWord}, UI shows ${cells[i][wordIndex]}`);
        }
        record.recordedTime = { rows, cells, wordHeaders,
          wordLaneStatus: wordHeaders.length ? 'present; every LD word equals its retained output pins in MSB-first order' : 'absent; no fabricated word lane' };
        await shot(page, viewport, '07-recorded-time');
        await journey.getByRole('button', { name: 'Board boundary', exact: true }).click();
        const boardText = await journey.locator('.rb-journey-board').innerText();
        assert(/no physical board observation/i.test(boardText) && /CLK100MHZ/.test(boardText) && /LD0/.test(boardText), 'Board lens must identify the recorded boundary and simulation-only evidence');
        await shot(page, viewport, '08-recorded-board-boundary');
        await assertJourneyGeometry(page, viewport, 'recorded board boundary');
        await timed(record, 'Return to experiment', async () => {
          await journey.getByTestId('ide-journey-return').click();
          await page.getByTestId('ide-mode-verify').waitFor({ state: 'visible' });
          await page.getByRole('checkbox', { name: 'Evaluation steps', exact: true }).waitFor({ state: 'visible' });
        });
        assert(await page.getByTestId('ide-signal-journey').count() === 0, 'Return must restore the normal experiment rather than leave a stale journey panel');
        assert(JSON.stringify(await readRun(page)) === JSON.stringify(originalRecording), 'Inspection must preserve the retained recording byte for byte');
        record.checks.push('Return restores experiment; archived circuit, checks, samples and trace stay immutable');
        record.status = 'pass';
      } catch (error) {
        record.status = 'fail';
        record.error = error instanceof Error ? error.message : String(error);
        receipt.failures.push(`${viewport.label}: ${record.error}`);
        await shot(page, viewport, 'failure').catch(() => null);
        await writeFile(path.join(OUT, `${viewport.label}-failure-dom.txt`), await page.locator('body').innerText().catch(() => 'unavailable'));
        const back = page.getByTestId('ide-journey-return');
        if (await back.isVisible().catch(() => false)) await back.click();
      }
    }
  } catch (error) {
    receipt.failures.push(error instanceof Error ? error.message : String(error));
    await page.screenshot({ path: path.join(OUT, 'startup-failure.png') }).catch(() => null);
    await writeFile(path.join(OUT, 'startup-failure-dom.txt'), await page.locator('body').innerText().catch(() => 'unavailable'));
  } finally {
    receipt.finishedAtIso = new Date().toISOString();
    receipt.status = receipt.failures.length || problems.length ? 'fail' : 'pass';
    await writeFile(path.join(OUT, 'counter-proof.json'), JSON.stringify(receipt, null, 2));
  }
  assert(problems.length === 0, `Browser errors: ${JSON.stringify(problems.slice(0, 8))}`);
  assert(receipt.failures.length === 0, `Counter proof blockers:\n${receipt.failures.join('\n')}`);
});

async function readRun(page) {
  return page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun ?? null);
}
async function readArchivedRun(page, id) {
  return page.evaluate(runId => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyRunArchive.find(run => run.runId === runId) ?? null, id);
}
async function authorNonzeroReset(page) {
  const generators = page.getByTestId('ide-scenario-generators-disclosure');
  if (await generators.count() && await generators.getAttribute('open') === null) await generators.locator('summary').first().click();
  const clock = page.getByTestId('ide-verify-clock-policy-panel').first();
  if (await clock.getAttribute('open') === null) await clock.locator('summary').click();
  await page.getByTestId('ide-verify-reset-mode-authored').click();
  await page.getByTestId('ide-verify-reset-mode-authored').waitFor({ state: 'visible' });
  assert(await page.getByTestId('ide-verify-reset-mode-authored').getAttribute('aria-pressed') === 'true', 'Author reset pulses must be selected through the visible control');
  const reset = page.getByTestId('ide-timing-cell-rst-5');
  const enable = page.getByTestId('ide-timing-cell-en-5');
  assert(await reset.getAttribute('data-generated') !== 'true', 'Authored reset must be editable rather than a generated policy lane');
  assert(/: 0$/.test(await reset.getAttribute('aria-label')), 'Reset at t5 begins deasserted');
  assert(/: 1$/.test(await enable.getAttribute('aria-label')), 'Enable at t5 begins asserted for rollover');
  await enable.click();
  await reset.click();
  assert(/: 0$/.test(await enable.getAttribute('aria-label')) && /: 1$/.test(await reset.getAttribute('aria-label')),
    'Normal stimulus clicks must author EN=0 and RST=1 at t5');
  const lowCheck = page.getByTestId('ide-timing-check-q0-5');
  const highCheck = page.getByTestId('ide-timing-check-q1-5');
  assert(/expected 0/.test(await lowCheck.getAttribute('aria-label')) && /expected 0/.test(await highCheck.getAttribute('aria-label')),
    'Independent saved checks must expect reset result 00 before the rerun; observed outputs must not author that expectation');
  await lowCheck.click();
  if (await clock.getAttribute('open') !== null) await clock.locator('summary').click();
  if (await generators.count() && await generators.getAttribute('open') !== null) await generators.locator('summary').first().click();
  return { tick: 5, inputs: { en: 0, rst: 1 }, expected: { q0: 0, q1: 0 },
    expectationBasis: 'Active-high synchronous reset forces both bits to zero independently of enable and prior count; saved checks were read before Run' };
}
async function openWorkspace(page, mode) {
  await page.getByTestId(`mode-button-${mode}`).click();
  await page.getByTestId(`ide-mode-${mode}`).waitFor({ state: 'visible' });
}
function findEvent(run, nodeId, tick, phase, evaluationPhase) {
  const event = run.evaluationTrace.events.find(e => e.nodeId === nodeId && e.context.tick === tick
    && e.context.phase === phase && e.evaluationPhase === evaluationPhase);
  assert(event, `Recording lacks ${nodeId} at t${tick}, ${phase}/${evaluationPhase}`);
  return event;
}
function eventSummary(event) {
  return { order: event.order, nodeId: event.nodeId, context: event.context, evaluationPhase: event.evaluationPhase,
    commitPhase: event.commitPhase, inputs: event.inputs, previousOutputs: event.previousOutputs, outputs: event.outputs,
    stateBefore: event.stateBefore, stateAfter: event.stateAfter };
}
function assertCounterRecording(run) {
  assert(run.schedule === 'clocked_macro', `Counter must retain actual clocked_macro schedule, got ${run.schedule}`);
  assert(run.evaluationTrace?.status === 'complete', `Counter capture must be complete, got ${run.evaluationTrace?.status ?? 'absent'}`);
  assert(run.waveform.length >= 7 && run.report.rows.length === 14, 'Counter must retain all seven authored moments and fourteen output checks');
  assert(run.report.rows.every(row => row.expected === row.actual), 'Every shipped counter check must agree with its actual result');
  const q0 = run.executionInput.ioRows.find(row => row.nodeId === 'q0_out');
  const q1 = run.executionInput.ioRows.find(row => row.nodeId === 'q1_out');
  const signalKey = row => row.label.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const expected = [[0, 0], [0, 0], [1, 0], [0, 1], [1, 1], [0, 0], [0, 0]];
  for (let i = 0; i < expected.length; i++) {
    const checks = run.report.rows.filter(row => row.tick === i);
    assert(checks.some(row => [q0.id, q0.label, signalKey(q0)].includes(row.signal) && Number(row.actual) === expected[i][0]), `t${i}: LD0 check must match the counter sequence`);
    assert(checks.some(row => [q1.id, q1.label, signalKey(q1)].includes(row.signal) && Number(row.actual) === expected[i][1]), `t${i}: LD1 check must match the counter sequence`);
    const phases = new Set(run.evaluationTrace.events.filter(e => e.context.tick === i).map(e => e.context.phase));
    assert(['macro-low-before', 'macro-high-sample', 'macro-low-after'].every(phase => phases.has(phase)), `t${i}: actual [0,1,0] phases must remain distinct`);
  }
  assert(new Set(run.evaluationTrace.events.map(e => e.order)).size === run.evaluationTrace.events.length, 'Captured event orders must be globally unique within the recording');
}
async function seekEventThroughKeyboard(page, target) {
  const journey = page.getByTestId('ide-signal-journey');
  await journey.locator('.rb-journey-toolbar label select').selectOption(String(target.context.tick));
  await journey.getByRole('button', { name: 'Published sample', exact: true }).click();
  await journey.focus();
  for (let step = 0; step < 160; step++) {
    const before = await journey.getAttribute('data-event');
    if (before === String(target.order)) {
      assert(await journey.getAttribute('data-active-node') === target.nodeId, 'Selected event must preserve its exact node identity');
      assert(await journey.getAttribute('data-phase') === target.evaluationPhase, 'Selected event must preserve its exact evaluation phase');
      return;
    }
    await page.keyboard.press('ArrowRight');
    await waitForEventChange(page, before);
  }
  throw new Error(`Keyboard stepping did not reach recorded evaluation ${target.order} within 160 steps`);
}
async function waitForEventChange(page, previous) {
  await page.waitForFunction(value => document.querySelector('[data-testid="ide-signal-journey"]')?.getAttribute('data-event') !== value,
    previous, { timeout: 2500 });
}
async function assertJourneyGeometry(page, viewport, label) {
  await assertNoRootOverflow(page, `${viewport.label}: ${label}`);
  const geometry = await page.getByTestId('ide-signal-journey').evaluate(element => {
    const box = element.getBoundingClientRect();
    const transport = element.querySelector('.rb-journey-playback').getBoundingClientRect();
    return { box: { x: box.x, y: box.y, width: box.width, height: box.height },
      transport: { x: transport.x, y: transport.y, right: transport.right, bottom: transport.bottom },
      viewport: { width: window.innerWidth, height: window.innerHeight } };
  });
  assert(geometry.box.width > 500 && geometry.box.height > 280, `${viewport.label}: journey needs a usable retained drawing area: ${JSON.stringify(geometry)}`);
  assert(geometry.transport.x >= 0 && geometry.transport.right <= viewport.width + 1 && geometry.transport.bottom <= viewport.height,
    `${viewport.label}: playback controls must be inside the viewport: ${JSON.stringify(geometry)}`);
}
async function shot(page, viewport, name) {
  await page.screenshot({ path: path.join(OUT, `${viewport.label}-${name}.png`) });
}
async function timed(record, action, operation) {
  const start = performance.now();
  try { return await operation(); }
  finally { record.timings.push({ action, elapsedMs: Math.round(performance.now() - start) }); }
}
