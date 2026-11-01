#!/usr/bin/env node

// A full adder, authored from a blank project through the controls a student uses, checked
// against a truth table that does not come from the circuit.
//
//   1. Blank project -> Design. Three input pins, two output pins, five gates and twelve wires
//      are placed, named and connected with the palette, the label editor and the port-to-port
//      wire gesture. Nothing is injected into the project.
//   2. Simulate. Eight cases are authored by hand in the case table: every input combination,
//      with the SUM and COUT a full adder must produce, computed here by arithmetic
//      (a + b + cin). "Generate all" is not used and observed outputs are never copied into
//      the expectations.
//   3. The run passes all sixteen checks.
//   4. A real fault: the gate that ANDs A with B is swapped to an OR in Design. Arithmetic says
//      which cases that breaks (010 and 100, on COUT only). The rerun must fail on exactly
//      those and nothing else.
//   5. The gate is swapped back and the rerun passes again.
//
// The placement, labelling and wiring techniques follow the maintained scratch gates
// (ide-blank-adder-authoring-depth, ide-scratch-testbench-repair-flow), which drive the same
// palette and port controls; their board-palette and stimulus-canvas selectors predate the
// current Design library and case table, so this gate uses the current ones. Runtime state is
// read to identify the part just placed and to wait for a change; every change is made
// through the page.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, clickVerifyRun, runIdeGate } from './_gateHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const OUT = path.resolve(process.env.RB_FULL_ADDER_OUT ?? path.join('.redbyte', 'studio-restart', 'm3-full-adder'));
const VIEWPORT = { width: 1440, height: 900 };

/** Every input combination and what a full adder produces for it: binary addition. */
const TRUTH_TABLE = [];
for (let a = 0; a <= 1; a += 1) {
  for (let b = 0; b <= 1; b += 1) {
    for (let cin = 0; cin <= 1; cin += 1) {
      const total = a + b + cin;
      TRUTH_TABLE.push({ name: `${a}${b}${cin}`, a, b, cin, sum: total % 2, cout: total >= 2 ? 1 : 0 });
    }
  }
}

/** The fault: carry_ab computes A OR B instead of A AND B. What the broken circuit produces,
 *  again by arithmetic on its definition rather than by asking the simulator. */
function withOrFault(row) {
  const carryAb = row.a | row.b;
  const carryCin = (row.a ^ row.b) & row.cin;
  return { sum: row.a ^ row.b ^ row.cin, cout: carryAb | carryCin };
}

await mkdir(OUT, { recursive: true });

await runIdeGate('IDE full adder authored from blank and checked against a truth table', async ({ page, baseUrl }) => {
  const record = { startedAt: new Date().toISOString(), steps: [] };
  const problems = [];
  page.on('pageerror', (error) => problems.push(String(error).slice(0, 240)));
  page.on('dialog', (dialog) => dialog.accept().catch(() => null));
  await page.addInitScript(() => {
    try { localStorage.setItem('rb-onboarding-v1-seen', '1'); } catch { /* unavailable on an intermediate document */ }
  });
  await page.setViewportSize(VIEWPORT);

  // ── 1. Blank project ───────────────────────────────────────────────────────────────
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=full-adder-authoring-proof`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ide-project-build-fresh-primary"]', { timeout: 20000 });
  await page.locator('[data-testid="ide-project-build-fresh-primary"]').first().click();
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  const blank = await readCircuit(page);
  assert(blank.nodes.length === 0 && blank.connections.length === 0,
    `a blank project must start with an empty sheet, found ${blank.nodes.length} parts and ${blank.connections.length} wires`);

  // ── Design: place, name, wire ──────────────────────────────────────────────────────
  const parts = {};
  parts.A = await placeAndLabel(page, 'ide-design-palette-input', 'A', { x: 0.12, y: 0.24 });
  parts.B = await placeAndLabel(page, 'ide-design-palette-input', 'B', { x: 0.12, y: 0.44 });
  parts.CIN = await placeAndLabel(page, 'ide-design-palette-input', 'CIN', { x: 0.12, y: 0.66 });
  parts.xorAb = await placeAndLabel(page, 'ide-design-palette-xor', 'xor_ab', { x: 0.36, y: 0.30 });
  parts.sumXor = await placeAndLabel(page, 'ide-design-palette-xor', 'sum_xor', { x: 0.58, y: 0.34 });
  parts.carryAb = await placeAndLabel(page, 'ide-design-palette-and', 'carry_ab', { x: 0.36, y: 0.56 });
  parts.carryCin = await placeAndLabel(page, 'ide-design-palette-and', 'carry_cin', { x: 0.58, y: 0.62 });
  parts.coutOr = await placeAndLabel(page, 'ide-design-palette-or', 'cout_or', { x: 0.76, y: 0.58 });
  parts.SUM = await placeAndLabel(page, 'ide-design-palette-output', 'SUM', { x: 0.90, y: 0.34 });
  parts.COUT = await placeAndLabel(page, 'ide-design-palette-output', 'COUT', { x: 0.90, y: 0.58 });

  const wires = [
    [parts.A, 'out', parts.xorAb, 'a'],
    [parts.B, 'out', parts.xorAb, 'b'],
    [parts.A, 'out', parts.carryAb, 'a'],
    [parts.B, 'out', parts.carryAb, 'b'],
    [parts.xorAb, 'out', parts.sumXor, 'a'],
    [parts.CIN, 'out', parts.sumXor, 'b'],
    [parts.xorAb, 'out', parts.carryCin, 'a'],
    [parts.CIN, 'out', parts.carryCin, 'b'],
    [parts.carryAb, 'out', parts.coutOr, 'a'],
    [parts.carryCin, 'out', parts.coutOr, 'b'],
    [parts.sumXor, 'out', parts.SUM, 'in'],
    [parts.coutOr, 'out', parts.COUT, 'in'],
  ];
  for (const wire of wires) await connectPorts(page, ...wire);

  const built = await readCircuit(page);
  assert(built.nodes.length === 10, `the full adder has 10 parts, the sheet has ${built.nodes.length}`);
  assert(built.connections.length === 12, `the full adder has 12 wires, the sheet has ${built.connections.length}`);
  const typesByLabel = Object.fromEntries(built.nodes.map((node) => [node.label, node.type]));
  for (const [label, type] of [['xor_ab', 'XOR'], ['sum_xor', 'XOR'], ['carry_ab', 'AND'], ['carry_cin', 'AND'], ['cout_or', 'OR']]) {
    assert(typesByLabel[label] === type, `${label} must be a ${type} gate, it is ${typesByLabel[label]}`);
  }
  // The wires are the ones asked for, not merely twelve of something.
  for (const [from, fromPort, to, toPort] of wires) {
    assert(built.connections.some((c) => c.from === `${from}.${fromPort}` && c.to === `${to}.${toPort}`),
      `wire ${from}.${fromPort} -> ${to}.${toPort} is missing from the sheet`);
  }
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="ide-design-fit-circuit-canvas"]').first().click();
  await shot(page, '01-design-built');
  record.steps.push({ step: 'built from blank', parts: built.nodes.length, wires: built.connections.length });

  await selectPart(page, parts.A);
  await clickPort(page, parts.A, 'out');
  await page.waitForFunction(() => Boolean(window.__RB_LOGIC_VIEW_STORE__.getState().editingState.wireStartPort));
  await page.keyboard.press('Escape');
  const cancelled = await page.evaluate(() => { const state = window.__RB_LOGIC_VIEW_STORE__.getState();
    return { wiring: Boolean(state.editingState.wireStartPort), selected: [...state.selection.nodes] }; });
  assert(!cancelled.wiring && cancelled.selected.includes(parts.A), 'Escape must cancel an active wire before clearing the selected part');
  await page.getByTestId('ide-design-context-trace-fanout').click();
  const explicitTrace = await page.getByTestId('ide-design-active-trace').innerText();
  await page.getByTestId('ide-design-context-pin').click();
  const pinnedProbes = await page.evaluate(() => JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().sim.probes));
  assert(pinnedProbes !== '[]', 'Pin must retain a probe for the selected signal');
  await page.keyboard.press('Escape');
  assert((await page.evaluate(() => window.__RB_LOGIC_VIEW_STORE__.getState().selection.nodes.size)) === 0, 'ordinary Escape must clear selection');
  assert(await page.getByTestId('ide-design-active-trace').innerText() === explicitTrace, 'ordinary Escape must preserve an explicitly opened trace');
  assert(await page.evaluate(() => JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().sim.probes)) === pinnedProbes, 'ordinary Escape must preserve an explicitly pinned signal');
  assert((await readCircuit(page)).connections.length === 12, 'cancelling the transient wire must preserve all connections');
  record.steps.push({ step: 'contextual Escape preserves explicit trace and pinned signal' });

  // ── 2. Simulate: eight cases from the truth table ──────────────────────────────────
  await openWorkspace(page, 'verify');
  await page.waitForSelector('[data-testid="ide-case-lab-table"]', { timeout: 15000 }).catch(async () => {
    await page.screenshot({ path: path.join(OUT, 'failure-simulate.png') });
    throw new Error('Simulate did not show the case table for the new design');
  });
  const io = await ioRowIds(page, ['A', 'B', 'CIN', 'SUM', 'COUT']);
  const ticks = await ensureCaseCount(page, TRUTH_TABLE.length);
  for (let index = 0; index < TRUTH_TABLE.length; index += 1) {
    const row = TRUTH_TABLE[index];
    const tick = ticks[index];
    await setBit(page, `ide-case-lab-input-${tick}-${io.A}`, row.a);
    await setBit(page, `ide-case-lab-input-${tick}-${io.B}`, row.b);
    await setBit(page, `ide-case-lab-input-${tick}-${io.CIN}`, row.cin);
    await setBit(page, `ide-case-lab-exp-${tick}-${io.SUM}`, row.sum);
    await setBit(page, `ide-case-lab-exp-${tick}-${io.COUT}`, row.cout);
  }
  // Read the table back from the page: it holds the truth table, cell for cell.
  for (let index = 0; index < TRUTH_TABLE.length; index += 1) {
    const row = TRUTH_TABLE[index];
    const tick = ticks[index];
    const seen = {
      a: await readBit(page, `ide-case-lab-input-${tick}-${io.A}`),
      b: await readBit(page, `ide-case-lab-input-${tick}-${io.B}`),
      cin: await readBit(page, `ide-case-lab-input-${tick}-${io.CIN}`),
      sum: await readBit(page, `ide-case-lab-exp-${tick}-${io.SUM}`),
      cout: await readBit(page, `ide-case-lab-exp-${tick}-${io.COUT}`),
    };
    assert(seen.a === row.a && seen.b === row.b && seen.cin === row.cin && seen.sum === row.sum && seen.cout === row.cout,
      `case ${row.name}: the authored row reads ${JSON.stringify(seen)}, the truth table says ${JSON.stringify(row)}`);
  }
  assert((await caseTicks(page)).length === 8, 'the case table must still hold exactly eight cases after authoring');
  await shot(page, '02-cases-authored');

  // ── 3. The correct circuit passes every check ──────────────────────────────────────
  const passing = await runAndRead(page, io, ticks);
  assert(isVerifyPass(passing.status), `the full adder must pass its truth table, the run says "${passing.status}"`);
  assert(passing.verdict === 'pass', `the recording must be marked as passing its checks, it is marked "${passing.verdict}"`);
  assert(passing.checks.length === 16, `eight cases with two outputs are 16 checks, the run evaluated ${passing.checks.length}`);
  assert(passing.failed.length === 0, `no check may fail on the correct circuit: ${JSON.stringify(passing.failed)}`);
  for (const row of TRUTH_TABLE) {
    const observed = passing.observedByCase[row.name];
    assert(observed && observed.sum === row.sum && observed.cout === row.cout,
      `case ${row.name}: the circuit produced ${JSON.stringify(observed)}, a full adder produces SUM=${row.sum} COUT=${row.cout}`);
  }
  await shot(page, '03-run-pass');
  record.steps.push({ step: 'truth table passes', status: passing.status, checks: passing.checks.length, runId: passing.runId });

  // ── 4. A real fault in the circuit ─────────────────────────────────────────────────
  await openWorkspace(page, 'design');
  await swapGate(page, parts.carryAb, 'or');
  const faulty = await readCircuit(page);
  assert(faulty.nodes.find((node) => node.id === parts.carryAb)?.type === 'OR', 'carry_ab must now be an OR gate');
  assert(faulty.connections.length === 12, `swapping a gate must keep its wires, ${faulty.connections.length} remain`);
  await shot(page, '04-design-fault');

  await openWorkspace(page, 'verify');
  const failing = await runAndRead(page, io, ticks);
  assert(isVerifyFail(failing.status), `the faulty circuit must fail, the run says "${failing.status}"`);
  assert(failing.verdict === 'fail', `the recording must be marked as failing its checks, it is marked "${failing.verdict}"`);
  const predicted = TRUTH_TABLE.flatMap((row) => {
    const broken = withOrFault(row);
    return [
      ...(broken.sum !== row.sum ? [`${row.name}:SUM`] : []),
      ...(broken.cout !== row.cout ? [`${row.name}:COUT`] : []),
    ];
  }).sort();
  assert(predicted.join(',') === '010:COUT,100:COUT', `the fault model must predict two COUT failures, it predicts ${predicted.join(',')}`);
  const reported = failing.failed.map((check) => `${check.caseName}:${check.output}`).sort();
  assert(reported.join(',') === predicted.join(','),
    `the run must fail exactly where the fault changes the answer: expected ${predicted.join(',')}, the run reported ${reported.join(',') || 'nothing'}`);
  for (const row of TRUTH_TABLE) {
    const broken = withOrFault(row);
    const observed = failing.observedByCase[row.name];
    assert(observed && observed.sum === broken.sum && observed.cout === broken.cout,
      `case ${row.name}: the faulty circuit produced ${JSON.stringify(observed)}, the fault model says SUM=${broken.sum} COUT=${broken.cout}`);
  }
  // The student is shown it: the two failing cells are marked, and no other cell is.
  assert(failing.markedCells.sort().join(',') === predicted.join(','),
    `the case table must mark exactly the failing cells: expected ${predicted.join(',')}, marked ${failing.markedCells.join(',') || 'none'}`);
  await shot(page, '05-run-fail');
  record.steps.push({ step: 'fault detected', status: failing.status, failed: reported, runId: failing.runId });

  // The exact observed cell, rather than a second navigator, owns the investigation.
  const failureTick = ticks[2];
  await page.getByTestId(`ide-case-lab-obs-${failureTick}-${io.COUT}`).click();
  const selected = page.getByTestId('ide-verify-selected-result');
  assert(await selected.getAttribute('data-tick') === String(failureTick), 'Case 3 must select its exact recorded tick');
  assert(await selected.getAttribute('data-signal') === 'COUT', 'the selected mismatch must be COUT');
  assert((await selected.innerText()).includes('expected 0') && (await selected.innerText()).includes('observed 1'), 'the selected case must show retained expected 0 and observed 1');
  const inputs = await page.getByTestId('ide-selected-result-inputs').innerText();
  assert(inputs.includes('A=0') && inputs.includes('B=1') && inputs.includes('CIN=0'), `the selected case must show its retained inputs, got ${inputs}`);
  assert(await page.getByTestId('ide-verify-fail-nav').count() === 1, 'one failure navigator must serve the selected result');
  const retainedFailure = await retainedRecording(page, failing.runId);
  await page.getByTestId('ide-selected-result-inspect').click();
  assert(await page.getByTestId('ide-case-lab-table').isVisible(), 'opening the recorded circuit must retain the truth table');
  assert(await page.getByTestId('ide-recorded-gate').getAttribute('data-node-id') === parts.coutOr, 'the selected output must open its retained driver');
  await page.getByTestId('ide-recorded-circuit-region-whole').click();
  await page.getByRole('button', { name: 'Inspect recorded carry_ab, OR', exact: true }).click();
  const gate = page.getByTestId('ide-recorded-gate');
  assert(await gate.getAttribute('data-node-id') === parts.carryAb, 'an available recorded gate must be selectable');
  assert((await gate.locator('[data-recorded-pin="a"] code').innerText()) === '0' &&
    (await gate.locator('[data-recorded-pin="b"] code').innerText()) === '1' &&
    (await gate.locator('[data-recorded-pin="out"] code').innerText()) === '1', 'carry_ab must show its actual retained 0,1 inputs and 1 output');
  assert((await page.getByTestId('ide-recorded-local-rule').innerText()).includes('Derived local rule'), 'derived logic must be distinct from observations');
  await shot(page, '05a-investigate-recorded-gate');
  const editor = page.getByTestId('ide-selected-result-check-editor');
  await editor.locator('summary').click();
  await editor.getByRole('button', { name: 'Set 1', exact: true }).click();
  assert((await selected.innerText()).includes('expected 0'), 'editing a draft check must retain the recording\'s expected value');
  assert(await retainedRecording(page, failing.runId) === retainedFailure, 'a draft check edit must not mutate the historical recording');
  assert(await page.getByTestId('ide-run-identity').getAttribute('data-run-id') === failing.runId, 'editing a check must not execute or select another recording');
  assert(await readBit(page, `ide-case-lab-exp-${failureTick}-${io.COUT}`) === 1, 'the expectation edit must update the authored case');
  await editor.getByRole('button', { name: 'Set 0', exact: true }).click();
  await editor.locator('summary').click();
  record.steps.push({ step: 'exact recorded gate investigation and independent draft check edit', tick: failureTick, signal: 'COUT', runId: failing.runId });

  // ── 5. Repair and rerun ────────────────────────────────────────────────────────────
  await page.getByTestId('ide-verify-fail-focus-trace').click();
  await page.getByTestId('ide-design-live-canvas').waitFor({ state: 'visible' });
  assert((await page.getByTestId('ide-design-current-design').count()) === 0, 'Edit in Design must enter the editable current circuit, without a recorded replay overlay');
  await swapGate(page, parts.carryAb, 'and');
  assert((await readCircuit(page)).nodes.find((node) => node.id === parts.carryAb)?.type === 'AND', 'carry_ab must be an AND gate again');
  assert(await retainedRecording(page, failing.runId) === retainedFailure, 'a Design repair must leave the old recorded topology and samples intact');
  await openWorkspace(page, 'verify');
  const repaired = await runAndRead(page, io, ticks);
  assert(isVerifyPass(repaired.status), `the repaired circuit must pass again, the run says "${repaired.status}"`);
  assert(repaired.verdict === 'pass', `the repaired recording must be marked as passing, it is marked "${repaired.verdict}"`);
  assert(repaired.checks.length === 16 && repaired.failed.length === 0,
    `the repaired run must pass all 16 checks: ${repaired.checks.length} evaluated, ${repaired.failed.length} failed`);
  assert(repaired.markedCells.length === 0, `no cell may stay marked after the repair: ${repaired.markedCells.join(',')}`);
  assert(new Set([passing.runId, failing.runId, repaired.runId]).size === 3, 'each run must be a new recording, not an earlier one shown again');
  await shot(page, '06-run-repaired');
  record.steps.push({ step: 'repaired and passing', status: repaired.status, checks: repaired.checks.length, runId: repaired.runId });

  // Live exploration changes runtime inputs; cases and recorded evidence keep their own owners.
  const liveProof = { runId: repaired.runId, nodeId: parts.A, captures: [] };
  try {
    await openWorkspace(page, 'design');
    const returnToCurrent = page.getByTestId('ide-design-current-design');
    if (await returnToCurrent.isVisible()) await returnToCurrent.click();
    await page.getByTestId('ide-design-fit-circuit-canvas').first().click();
    const ownersBefore = await readExplorationOwners(page);
    assert(ownersBefore.runId === repaired.runId, 'Current Design must retain the repaired recording before exploration');
    await writeFile(path.join(OUT, 'live-exploration-owners-before.json'), JSON.stringify(ownersBefore, null, 2));
    const explore = page.getByTestId('ide-design-explore');
    assert(await explore.isEnabled(), 'The normally authored flat full adder must support live exploration');
    if (await explore.getAttribute('aria-pressed') !== 'true') await explore.click();
    assert(await explore.getAttribute('aria-pressed') === 'true', 'Explore must enter live Design exploration');
    const liveNote = page.getByTestId('ide-design-live-note');
    const liveNoteText = await liveNote.innerText();
    assert(await liveNote.isVisible() && /explor/i.test(liveNoteText) && /not.*record|no.*record/i.test(liveNoteText),
      'Live Design must identify exploration as unrecorded');
    const liveInput = page.locator(`[data-testid="ide-design-live-canvas"] [data-node-id="${parts.A}"][data-sim-value]`).first();
    const shownBefore = await liveInput.getAttribute('data-sim-value');
    assert(shownBefore === '0' || shownBefore === '1', 'The authored A switch must display a known live bit before toggling');
    const inputBefore = await page.evaluate(id => window.__RB_PROJECT_RUNTIME__.getState().sim.inputs[id] ?? null, parts.A);
    const expectedLiveInput = shownBefore === '1' ? 0 : 1;
    await page.getByTestId(`switch-toggle-${parts.A}`).first().click();
    await page.waitForFunction(({ id, value }) => window.__RB_PROJECT_RUNTIME__.getState().sim.inputs[id] === value,
      { id: parts.A, value: expectedLiveInput }, { timeout: 5000 });
    assert(await liveInput.getAttribute('data-sim-value') === String(expectedLiveInput),
      'The visible switch must agree with the canonical live simulation input');
    assertExplorationOwnersUnchanged(ownersBefore, await readExplorationOwners(page), 'While exploring');
    const liveEvidence = await page.evaluate(id => {
      const current = window.__RB_PROJECT_RUNTIME__.getState();
      return { input: current.sim.inputs[id], tick: current.sim.tick, running: current.sim.running,
        runId: current.verifyLastRun?.runId, archiveCount: current.verifyRunArchive.length };
    }, parts.A);
    Object.assign(liveProof, { shownBefore, inputBefore, expectedLiveInput, liveNoteText, liveEvidence,
      ownersPreserved: Object.keys(ownersBefore) });
    await shot(page, '06a-live-design-exploration');
    liveProof.captures.push('06a-live-design-exploration.png');
    await explore.click();
    assert(await explore.getAttribute('aria-pressed') !== 'true', 'Finish exploring must leave live mode');
    assert(!await liveNote.isVisible(), 'The live-only note must disappear after Finish exploring');
    assertExplorationOwnersUnchanged(ownersBefore, await readExplorationOwners(page), 'After finishing exploration');
    await openWorkspace(page, 'verify');
    assert(await page.getByTestId('ide-run-identity').getAttribute('data-run-id') === repaired.runId,
      'Returning to Simulate must retain the repaired recording without running again');
    for (let index = 0; index < TRUTH_TABLE.length; index += 1) {
      const row = TRUTH_TABLE[index];
      for (const [label, value] of [['A', row.a], ['B', row.b], ['CIN', row.cin]]) {
        assert(await readBit(page, `ide-case-lab-input-${ticks[index]}-${io[label]}`) === value,
          `Live exploration must preserve authored case ${row.name} input ${label}=${value}`);
      }
      for (const [label, value] of [['SUM', row.sum], ['COUT', row.cout]]) {
        assert(await readBit(page, `ide-case-lab-exp-${ticks[index]}-${io[label]}`) === value,
          `Live exploration must preserve authored case ${row.name} check ${label}=${value}`);
        assert(await readBit(page, `ide-case-lab-obs-${ticks[index]}-${io[label]}`) === value,
          `The original repaired recording must still display case ${row.name} ${label}=${value}`);
      }
    }
    await page.getByTestId(`ide-case-lab-obs-${failureTick}-${io.COUT}`).click();
    assert(await selected.getAttribute('data-tick') === String(failureTick)
      && (await selected.innerText()).includes('expected 0') && (await selected.innerText()).includes('observed 0'),
      'The repaired 010 case must still select its original recorded tick with COUT=0 after exploration');
    assertExplorationOwnersUnchanged(ownersBefore, await readExplorationOwners(page), 'After returning to Simulate');
    await shot(page, '06b-repaired-recording-after-exploration');
    liveProof.captures.push('06b-repaired-recording-after-exploration.png');
    Object.assign(liveProof, { verdict: 'pass', restoredTick: failureTick, authoredCasesPreserved: TRUTH_TABLE.length,
      recordedOutputChecksPreserved: TRUTH_TABLE.length * 2, newRecordingCreated: false });
    record.steps.push({ step: 'live Design input exploration preserves authored cases and recordings', ...liveProof });
  } catch (error) {
    Object.assign(liveProof, { verdict: 'fail', error: String(error) });
    await shot(page, '06-live-exploration-failure').catch(() => null);
    throw error;
  } finally {
    await writeFile(path.join(OUT, 'live-exploration-proof.json'), JSON.stringify(liveProof, null, 2));
  }

  const details = page.getByTestId('ide-run-details');
  await details.locator('summary').click();
  await page.getByRole('combobox', { name: 'Recorded run', exact: true }).selectOption(failing.runId);
  await page.getByTestId(`ide-case-lab-obs-${failureTick}-${io.COUT}`).click();
  if (!(await page.getByTestId('ide-recorded-circuit').isVisible())) await page.getByTestId('ide-selected-result-inspect').click();
  await page.getByTestId('ide-recorded-circuit-region-whole').click();
  await page.getByRole('button', { name: 'Inspect recorded carry_ab, OR', exact: true }).click();
  assert((await gate.innerText()).includes('OR') && (await gate.locator('[data-recorded-pin="out"] code').innerText()) === '1', 'reopening the old failure must show its own OR gate and sample after the live repair');
  assert(await retainedRecording(page, failing.runId) === retainedFailure, 'rerunning and selecting history must keep the original recording unchanged');
  await shot(page, '07-old-failure-after-repair');
  await page.getByRole('combobox', { name: 'Recorded run', exact: true }).selectOption(repaired.runId);
  record.steps.push({ step: 'older failure retains its own topology after repair', runId: failing.runId });

  if (process.env.RB_SIGNAL_JOURNEY_PROOF === '1') {
    const started = performance.now();
    await page.getByTestId('ide-follow-signal').click();
    const journey = page.getByTestId('ide-signal-journey');
    await journey.waitFor({state:'visible'});
    const identity = await journey.getAttribute('data-run-id');
    const tick = await journey.getAttribute('data-tick');
    assert(identity === repaired.runId, 'Signal Journey must reference the chosen repaired recording');
    await shot(page, '08-journey-authored-circuit');
    await journey.getByRole('button',{name:'Next evaluation',exact:true}).click();
    assert((await journey.getAttribute('data-event')) !== 'sample', 'stepping must select a captured evaluation');
    await shot(page, '09-journey-actual-evaluation');
    for (const lens of ['Logic','Generated HDL','Board boundary','Case table','Circuit']) {
      await journey.getByRole('button',{name:lens,exact:true}).click();
      assert(await journey.getAttribute('data-run-id') === identity && await journey.getAttribute('data-tick') === tick,
        `${lens} must carry the exact recording and moment`);
      await shot(page, `10-journey-${lens.toLowerCase().replaceAll(' ','-')}`);
    }
    await journey.getByRole('button',{name:'Published sample',exact:true}).click();
    await page.getByTestId('ide-journey-return').click();
    await openWorkspace(page,'verify');
    await page.getByRole('combobox',{name:'Recorded run',exact:true}).selectOption(failing.runId);
    await page.getByTestId('ide-follow-signal').click();
    assert(await journey.getAttribute('data-run-id') === failing.runId, 'historical journey must use the old failure');
    assert(await retainedRecording(page,failing.runId) === retainedFailure, 'journey playback cannot mutate its old recording');
    await shot(page,'11-journey-old-fault');
    record.signalJourney = { runId:identity, tick, inspectAndTraverseMs:performance.now()-started, historicalRunId:failing.runId };
  }

  if (process.env.RB_LIVE_MODULE_PROOF === '1') {
    await page.getByTestId('ide-journey-return').click().catch(() => {});
    await openWorkspace(page, 'design');
    const current = page.getByTestId('ide-design-current-design');
    if (await current.isVisible()) await current.click();
    await page.getByTestId('ide-design-fit-circuit-canvas').first().click();
    await page.keyboard.press('Escape');
    for (const [index, id] of [parts.xorAb, parts.sumXor, parts.carryAb, parts.carryCin, parts.coutOr].entries()) {
      await page.locator(`[data-node-id="${id}"] .rb-sym-body`).first().click({modifiers:index ? ['Shift'] : []});
    }
    await page.getByTestId('ide-design-create-module-open').click();
    await page.getByTestId('ide-design-create-module-dialog').waitFor({state:'visible'});
    await page.getByTestId('ide-design-create-module-confirm').click();
    const module = await page.evaluate(() => {const s=window.__RB_PROJECT_RUNTIME__.getState();const instance=s.circuit.nodes.find(node=>node.config?.moduleDefinitionId); return {instance,definition:s.hierarchy.modules.find(item=>item.id===instance.config.moduleDefinitionId)};});
    assert(module.definition.circuit.nodes.some(node=>node.id===parts.coutOr), 'Normally authored gates must belong to the created reusable module');
    const before = await readExplorationOwners(page);
    await page.getByTestId('ide-design-explore').click();
    const live=page.getByTestId('ide-live-hierarchy');
    await live.waitFor({state:'visible'});
    await page.getByTestId('ide-design-live-reset').click();
    for(const id of [parts.A,parts.B]) await live.getByTestId(`switch-toggle-${id}`).click();
    await live.locator(`[data-projection-node="${module.instance.id}"]`).click();
    await live.getByRole('button',{name:'Enter this instance',exact:true}).click();
    assert(await live.getAttribute('data-instance-path')===JSON.stringify([module.instance.id]), `Created module exploration must bind its actual parent instance: ${await live.getAttribute('data-instance-path')}`);
    await live.locator(`[data-projection-node="${parts.coutOr}"]`).click();
    assert((await live.getByTestId('ide-live-local-rule').innerText()).includes('1 OR 0 = 1'), 'User-created full-adder carry rule must use parent inputs 1+1+0');
    await shot(page,'12-authored-module-live');
    await page.getByTestId('ide-design-explore').click();
    assertExplorationOwnersUnchanged(before,await readExplorationOwners(page),'authored reusable module exploration');
    assert(await retainedRecording(page,failing.runId)===retainedFailure,'Created-module exploration must preserve old failure');
    record.steps.push({step:'ordinary authored reusable module explored',instanceId:module.instance.id,rule:'1 OR 0 = 1',ownersUnchanged:true});
  }
  record.finishedAt = new Date().toISOString();
  record.truthTable = TRUTH_TABLE;
  record.pageErrors = problems;
  await writeFile(path.join(OUT, 'full-adder-proof.json'), JSON.stringify(record, null, 2));
  assert(problems.length === 0, `the page raised errors during the journey: ${JSON.stringify(problems.slice(0, 4))}`);
});

// ── Reading the page ─────────────────────────────────────────────────────────────────

async function readCircuit(page) {
  return page.evaluate(() => {
    const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ?? { nodes: [], connections: [] };
    const end = (value) => (typeof value === 'string' ? value : `${value.nodeId}.${value.portName}`);
    return {
      nodes: circuit.nodes.map((node) => ({ id: node.id, type: node.type, label: node.label })),
      connections: circuit.connections.map((connection) => ({ from: end(connection.from), to: end(connection.to) })),
    };
  });
}

async function retainedRecording(page, runId) {
  return page.evaluate(id => JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive.find(run => run.runId === id)), runId);
}

async function readExplorationOwners(page) {
  return page.evaluate(() => {
    const current = window.__RB_PROJECT_RUNTIME__.getState();
    return { projectId: current.projectId, runId: current.verifyLastRun?.runId,
      circuit: JSON.stringify(current.circuit), projectVectors: JSON.stringify(current.projectVectors), scenarios: JSON.stringify(current.scenarios),
      archive: JSON.stringify(current.verifyRunArchive), history: JSON.stringify(current.verifyRunHistory), recording: JSON.stringify(current.verifyLastRun) };
  });
}

function assertExplorationOwnersUnchanged(before, after, label) {
  for (const key of Object.keys(before)) assert(after[key] === before[key], `${label}: live exploration must preserve ${key} exactly`);
}

async function ioRowIds(page, labels) {
  const rows = await page.evaluate(() =>
    (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? []).map((row) => ({ id: row.id, label: row.label })));
  const ids = {};
  for (const label of labels) {
    const row = rows.find((entry) => String(entry.label).toLowerCase() === label.toLowerCase());
    assert(row, `Simulate must list the ${label} signal, it lists ${JSON.stringify(rows.map((entry) => entry.label))}`);
    ids[label] = row.id;
  }
  return ids;
}

async function shot(page, name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function openWorkspace(page, mode) {
  await page.locator(`[data-testid="mode-button-${mode}"]`).click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForTimeout(500);
}

// ── Design ───────────────────────────────────────────────────────────────────────────

async function isSelected(page, nodeId) {
  return page.evaluate((id) => Boolean(window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection?.nodes?.has(id)), nodeId);
}

async function placeAndLabel(page, paletteTestId, label, position) {
  const before = (await readCircuit(page)).nodes.map((node) => node.id);
  const tile = page.locator(`[data-testid="${paletteTestId}"]`).first();
  await tile.scrollIntoViewIfNeeded();
  assert(await tile.isVisible(), `the ${paletteTestId} palette part must be visible`);
  await tile.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-placement-active') === '1',
    null, { timeout: 5000 })
    .catch(() => { throw new Error(`choosing ${paletteTestId} did not start placement`); });
  const sheet = await page.locator('[data-testid="ide-design-live-canvas"]').first().boundingBox();
  await page.mouse.click(sheet.x + sheet.width * position.x, sheet.y + sheet.height * position.y);
  await page.waitForFunction(
    (known) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? []).some((node) => !known.includes(node.id)),
    before, { timeout: 8000 })
    .catch(() => { throw new Error(`clicking the sheet did not place ${paletteTestId}`); });
  const added = (await readCircuit(page)).nodes.map((node) => node.id).filter((id) => !before.includes(id));
  assert(added.length === 1, `placing ${paletteTestId} must add exactly one part, it added ${added.length}`);
  const nodeId = added[0];

  // The part just placed is the selection, and it is on the sheet where the student can see it
  // even though selecting it opened the inspector and narrowed the sheet.
  await page.waitForFunction((id) => window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection?.nodes?.has(id), nodeId, { timeout: 5000 })
    .catch(() => { throw new Error(`the part placed from ${paletteTestId} was not selected`); });
  await page.waitForTimeout(350);
  const onSheet = await page.evaluate((id) => {
    const part = document.querySelector(`[data-node-id="${id}"] .rb-sym-body`)?.getBoundingClientRect();
    const area = document.querySelector('[data-testid="ide-design-live-canvas"]').getBoundingClientRect();
    return Boolean(part) && part.left >= area.left && part.right <= area.right && part.top >= area.top && part.bottom <= area.bottom;
  }, nodeId);
  assert(onSheet, `the part placed from ${paletteTestId} must be on the sheet after the inspector opens`);
  // One click placed one part. If the tool is still armed, put it down.
  if (await page.locator('[data-testid="ide-design-live-canvas"]').first().getAttribute('data-placement-active') === '1') {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  if (!(await isSelected(page, nodeId))) await selectPart(page, nodeId);

  await page.locator('[data-testid="ide-design-label-edit-btn"]').first().click();
  const input = page.locator('[data-testid="ide-design-label-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(label);
  await page.locator('[data-testid="ide-design-label-save"]').first().click();
  await page.waitForFunction(
    ({ id, expected }) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? []).find((node) => node.id === id)?.label === expected,
    { id: nodeId, expected: label }, { timeout: 5000 })
    .catch(() => { throw new Error(`saving the label "${label}" did not rename ${nodeId}`); });
  return nodeId;
}

async function selectPart(page, nodeId) {
  const body = page.locator(`[data-node-id="${nodeId}"] .rb-sym-body`).first();
  await body.waitFor({ state: 'visible', timeout: 8000 });
  const box = await body.boundingBox();
  assert(box, `part ${nodeId} must be on the sheet`);
  // The upper edge of the body: the centre of an input pin is its live switch.
  await page.mouse.click(box.x + box.width * 0.5, box.y + Math.min(8, box.height * 0.25));
  await page.waitForFunction((id) => window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection?.nodes?.has(id), nodeId, { timeout: 5000 })
    .catch(async () => {
      await page.screenshot({ path: path.join(OUT, 'failure-select.png') });
      throw new Error(`clicking part ${nodeId} did not select it`);
    });
}

async function clickPort(page, nodeId, portName) {
  const port = page.locator(`[data-node-id="${nodeId}"] [data-port-id="${portName}"]`).first();
  await port.waitFor({ state: 'visible', timeout: 8000 });
  const box = await port.boundingBox();
  assert(box, `port ${nodeId}.${portName} must be on the sheet`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function connectPorts(page, fromNodeId, fromPort, toNodeId, toPort) {
  const before = (await readCircuit(page)).connections.length;
  await clickPort(page, fromNodeId, fromPort);
  await page.waitForFunction(() => Boolean(window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort), null, { timeout: 5000 })
    .catch(() => { throw new Error(`clicking ${fromNodeId}.${fromPort} did not start a wire`); });
  await clickPort(page, toNodeId, toPort);
  await page.waitForFunction(
    (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) === count,
    before + 1, { timeout: 8000 })
    .catch(async () => {
      await page.screenshot({ path: path.join(OUT, 'failure-wire.png') });
      throw new Error(`wire ${fromNodeId}.${fromPort} -> ${toNodeId}.${toPort} was not made`);
    });
}

async function swapGate(page, nodeId, targetType) {
  await page.keyboard.press('Escape');
  await selectPart(page, nodeId);
  const chip = page.locator(`[data-testid="ide-design-swap-${targetType}"]`).first();
  await chip.scrollIntoViewIfNeeded();
  assert(await chip.isVisible(), `the inspector must offer swapping to ${targetType.toUpperCase()}`);
  await chip.click();
  await page.waitForFunction(
    ({ id, type }) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? []).find((node) => node.id === id)?.type === type,
    { id: nodeId, type: targetType.toUpperCase() }, { timeout: 5000 })
    .catch(() => { throw new Error(`swapping ${nodeId} to ${targetType.toUpperCase()} did not change the gate`); });
}

// ── Simulate: the case table ─────────────────────────────────────────────────────────

async function caseTicks(page) {
  const ticks = await page.locator('[data-testid^="ide-case-lab-row-"]').evaluateAll((rows) =>
    rows.map((row) => Number((row.getAttribute('data-testid') ?? '').replace('ide-case-lab-row-', ''))));
  return ticks.sort((left, right) => left - right);
}

async function ensureCaseCount(page, desired) {
  for (let guard = 0; guard < desired + 4 && (await caseTicks(page)).length < desired; guard += 1) {
    await page.locator('[data-testid="ide-case-lab-add"]').first().click();
    await page.waitForTimeout(160);
  }
  const ticks = await caseTicks(page);
  assert(ticks.length === desired, `the case table must hold ${desired} cases, it holds ${ticks.length}`);
  return ticks;
}

async function readBit(page, testId) {
  const text = ((await page.getByTestId(testId).first().textContent()) ?? '').trim();
  return text === '0' ? 0 : text === '1' ? 1 : null;
}

async function setBit(page, testId, value) {
  const cell = page.getByTestId(testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4 && (await readBit(page, testId)) !== value; attempt += 1) {
    await cell.click();
    await page.waitForTimeout(110);
  }
  const now = await readBit(page, testId);
  assert(now === value, `${testId} must read ${value} after editing, it reads ${now}`);
}

/** Runs the scenario and reads what the page then shows: the verdict, the recording it belongs
 *  to, and for every case the expected and observed value of each output. */
async function runAndRead(page, io, ticks) {
  const identity = page.locator('[data-testid="ide-run-identity"]').first();
  const previousRunId = (await identity.count()) ? await identity.getAttribute('data-run-id') : null;
  await clickVerifyRun(page);
  await page.waitForFunction(
    (previous) => {
      const id = document.querySelector('[data-testid="ide-run-identity"]')?.getAttribute('data-run-id');
      return Boolean(id) && id !== previous;
    },
    previousRunId, { timeout: 25000 })
    .catch(async () => {
      await page.screenshot({ path: path.join(OUT, 'failure-run.png') });
      throw new Error('the run did not produce a new recording');
    });
  await waitForVerifyResult(page, { timeout: 25000 });
  await page.waitForTimeout(600);
  const status = ((await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
  const runId = await identity.getAttribute('data-run-id');
  const verdict = await page.locator('[data-testid="ide-run-check-result"]').first().getAttribute('data-check-status');

  const checks = [];
  const observedByCase = {};
  const markedCells = [];
  for (let index = 0; index < TRUTH_TABLE.length; index += 1) {
    const caseName = TRUTH_TABLE[index].name;
    const tick = ticks[index];
    const observed = {};
    for (const [output, key] of [['SUM', 'sum'], ['COUT', 'cout']]) {
      const expected = await readBit(page, `ide-case-lab-exp-${tick}-${io[output]}`);
      // The observed cell is the one beside the expected cell it is compared with.
      const cell = await page.getByTestId(`ide-case-lab-exp-${tick}-${io[output]}`).first().evaluate((button) => {
        const observedCell = button.closest('td')?.nextElementSibling;
        return { text: (observedCell?.querySelector('code')?.textContent ?? '').trim(), marked: Boolean(observedCell?.classList.contains('is-fail')), isObserved: Boolean(observedCell?.classList.contains('ide-case-lab-obs')) };
      });
      assert(cell.isObserved, `case ${caseName}: the cell beside expected ${output} must be its observed value`);
      assert(cell.text === '0' || cell.text === '1', `case ${caseName}: the run must show an observed ${output}, it shows "${cell.text}"`);
      observed[key] = Number(cell.text);
      if (cell.marked) markedCells.push(`${caseName}:${output}`);
      checks.push({ caseName, output, expected, observed: Number(cell.text), pass: expected === Number(cell.text) });
    }
    observedByCase[caseName] = observed;
    // The row's own verdict must agree with the cell-by-cell comparison made here.
    const rowClass = (await page.getByTestId(`ide-case-lab-row-${tick}`).first().getAttribute('class')) ?? '';
    const rowFailed = checks.some((check) => check.caseName === caseName && !check.pass);
    assert(rowFailed ? /\bis-fail\b/.test(rowClass) : /\bis-pass\b/.test(rowClass),
      `case ${caseName}: the table marks the row "${rowClass}" but its cells ${rowFailed ? 'differ' : 'agree'}`);
  }
  return { status, verdict, runId, checks, failed: checks.filter((check) => !check.pass), observedByCase, markedCells };
}
