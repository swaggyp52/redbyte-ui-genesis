#!/usr/bin/env node

// The Signal Journey acceptance demonstration, through visible controls only:
//   1. open the hierarchical 4-bit adder and record its scenario;
//   2. select CARRY at the tick where it rises and follow it;
//   3. follow its driver into the FullAdderCell instance and see the waveform transition,
//      generated HDL and board mapping for that same object;
//   4. introduce a mistake in the module, run, and trace the failing check to its cause;
//   5. correct the design, run again, and see the old evidence marked historical and the new
//      evidence current.
// Runtime and DOM reads identify objects and evidence; every change is made with the UI.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, clickVerifyRun, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

const OUT = path.resolve(process.env.RB_JOURNEY_ACCEPTANCE_OUT ?? '.redbyte/signal-journey/acceptance');
assert(process.env.RB_GATE_BASE_URL, 'Set RB_GATE_BASE_URL to the candidate server for this external-server proof');
await mkdir(OUT, { recursive: true });

const CARRY_TICK = 3; // 15 + 1: every stage carries, so CARRY rises from 0 at t2 to 1 at t3.

await runIdeGate('Signal Journey acceptance: one signal, one moment, mistake to cause to fix', async ({ page, baseUrl }) => {
  const receipt = { baseUrl, node: process.version, startedAt: new Date().toISOString(), steps: [], captures: [], pageErrors: [] };
  let stage = 'clean start';
  page.on('pageerror', (error) => receipt.pageErrors.push(String(error)));
  page.on('dialog', (dialog) => dialog.accept().catch(() => null));
  await page.addInitScript(() => { try { localStorage.setItem('rb-onboarding-v1-seen', '1'); } catch {} });
  await page.setViewportSize({ width: 1440, height: 900 });
  const journey = page.getByTestId('ide-signal-journey');
  try {
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=signal-journey-acceptance`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 20000 });
    await loadStarterProject(page, { exactExampleId: 'four-bit-adder-hierarchical' });
    await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.some((node) => node.label === 'u_fa3'));

    stage = '1 record the scenario';
    await openWorkspace(page, 'verify');
    await page.getByTestId('ide-case-lab-table').waitFor({ state: 'visible' });
    await page.getByRole('checkbox', { name: 'Evaluation steps', exact: true }).check();
    const first = await runAndRead(page);
    assert(first.status === 'pass', `The starter's own scenario must pass first, got ${first.status}`);
    const carryRow = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().projectIoRows.find((row) => row.nodeId === 'carry-out').id);
    receipt.steps.push({ step: 'recorded the starter scenario', runId: first.runId });
    await capture(page, receipt, '01-recorded');

    stage = '2 select CARRY where it rises and follow it';
    await page.getByTestId(`ide-case-lab-obs-${CARRY_TICK}-${carryRow}`).click();
    assert(await page.getByTestId('ide-verify-selected-result').getAttribute('data-tick') === String(CARRY_TICK), 'Selecting CARRY must select its tick');
    await page.getByTestId('ide-follow-signal').click();
    await journey.waitFor({ state: 'visible' });
    assert(await journey.getAttribute('data-node-id') === 'carry-out' && await journey.getAttribute('data-tick') === String(CARRY_TICK)
      && await journey.getAttribute('data-run-id') === first.runId, 'The journey must open on CARRY at the selected tick of this recording');
    assert(await journey.getByTestId('ide-journey-currency').getAttribute('data-currency') === 'current', 'A fresh recording of the open design is current');
    const transition = journey.getByTestId('ide-journey-transition');
    assert(await transition.getAttribute('data-value') === '1' && await transition.getAttribute('data-since') === String(CARRY_TICK)
      && /0\s*→\s*1/.test(await transition.innerText()), `CARRY must rise 0 → 1 at t${CARRY_TICK}: ${await transition.innerText()}`);
    const checks = journey.getByTestId('ide-journey-checks');
    assert(Number(await checks.getAttribute('data-checks')) === first.report.rows.filter((row) => row.signal === carryRow || row.signal === 'carry-out').length
      && await checks.getAttribute('data-failed') === '0', `Every recorded CARRY check must be counted and match: ${await checks.innerText()}`);
    receipt.steps.push({ step: 'followed CARRY', transition: await transition.innerText(), checks: await checks.innerText() });
    await capture(page, receipt, '02-carry-rises');

    stage = '3 follow the driver into the module and across lenses';
    await journey.locator('.rb-journey-connections button').first().click();
    const driverId = await journey.getAttribute('data-node-id');
    const driverSource = first.elaborationSources?.[driverId];
    assert(driverSource && driverSource.localNodeId === 'o1' && driverSource.displayPath.join('/').includes('u_fa3'),
      `CARRY's driver must be the o1 gate inside u_fa3, got ${driverId} ${JSON.stringify(driverSource)}`);
    assert(await journey.getAttribute('data-tick') === String(CARRY_TICK), 'Following the driver must keep the moment');
    assert((await journey.locator('.rb-journey-heading').innerText()).includes('u_fa3'), 'The heading must name the instance the driver lives in');
    await journey.getByRole('button', { name: 'Generated HDL', exact: true }).click();
    const mapped = await journey.getByTestId('ide-journey-mapped-source').innerText();
    assert(/\bo1\b/i.test(mapped) && /or/i.test(mapped), `The HDL lens must show the o1 OR assignment of FullAdderCell: ${mapped}`);
    await capture(page, receipt, '03a-driver-hdl');
    await journey.getByRole('button', { name: 'Board boundary', exact: true }).click();
    const boardRow = journey.getByTestId(`ide-journey-board-row-${carryRow}`);
    assert(/LD4/.test(await boardRow.innerText()) && /W18/.test(await boardRow.innerText()) && await boardRow.getAttribute('data-changed') === 'false',
      `CARRY must be on LD4 (W18) in the recording and now: ${await boardRow.innerText()}`);
    assert(/no physical board observation/i.test(await journey.locator('.rb-journey-board').innerText()), 'The board lens must say this is simulation, not a board observation');
    await capture(page, receipt, '03b-board');
    await journey.getByRole('button', { name: 'Circuit', exact: true }).click();
    receipt.steps.push({ step: 'driver o1 inside u_fa3 with HDL and board', driverId, hdl: mapped.slice(0, 160) });

    stage = '4a introduce a mistake in FullAdderCell';
    await journey.getByTestId('ide-journey-return').click();
    await openWorkspace(page, 'design');
    await openModule(page, 'FullAdderCell');
    const brokenWire = 'fa-c10'; // a2.out -> o1.b in FullAdderCell
    await deleteWire(page, brokenWire);
    receipt.steps.push({ step: 'deleted a wire in FullAdderCell through the canvas', wire: brokenWire });
    await capture(page, receipt, '04a-mistake');
    await page.getByRole('button', { name: 'Resume signal', exact: true }).click();
    await journey.waitFor({ state: 'visible' });
    const afterEdit = journey.getByTestId('ide-journey-currency');
    assert(await afterEdit.getAttribute('data-currency') === 'stale' && /design changed/i.test(await afterEdit.innerText()),
      `After the edit the same recording must read as historical because the design changed: ${await afterEdit.innerText()}`);
    await capture(page, receipt, '04b-recording-now-historical');
    await journey.getByTestId('ide-journey-return').click();

    stage = '4b run and trace the failing check to its cause';
    await openWorkspace(page, 'verify');
    const broken = await runAndRead(page);
    assert(broken.status === 'fail', 'Removing a2 → o1 must break the carry chain');
    const failing = broken.report.rows.find((row) => row.tick === CARRY_TICK && (row.signal === carryRow || row.signal === 'carry-out') && row.expected !== row.actual);
    assert(failing && failing.expected === '1' && failing.actual === '0', `CARRY at t${CARRY_TICK} must now be observed 0 against expected 1: ${JSON.stringify(failing)}`);
    await traceCause(page, failing);
    await journey.waitFor({ state: 'visible' });
    assert(await journey.getAttribute('data-node-id') === 'carry-out' && await journey.getAttribute('data-tick') === String(CARRY_TICK)
      && await journey.getAttribute('data-run-id') === broken.runId, 'Trace cause must open the failing signal at the failing tick of the new recording');
    assert(await journey.getByTestId('ide-journey-currency').getAttribute('data-currency') === 'current', 'The failing recording describes the design as it now is');
    assert(Number(await journey.getByTestId('ide-journey-checks').getAttribute('data-failed')) > 0
      && /expected 1, observed 0/.test(await journey.getByTestId('ide-journey-checks').innerText()), 'The journey must state the failing check');
    await journey.locator('.rb-journey-connections button').first().click();
    const brokenDriver = await journey.getAttribute('data-node-id');
    assert(broken.elaborationSources?.[brokenDriver]?.localNodeId === 'o1', 'The cause path must reach the same o1 gate');
    const cause = await journey.getByTestId('ide-journey-understand').innerText();
    const o1Reads = broken.circuitSnapshot.connections.filter((wire) => wire.to.nodeId === brokenDriver).map((wire) => wire.to.portName);
    assert(!o1Reads.includes('b'), `The recording must show o1 has no driver on b: ${JSON.stringify(o1Reads)}`);
    receipt.steps.push({ step: 'traced CARRY t3 mismatch to o1 in u_fa3', o1Inputs: o1Reads, cause: cause.slice(0, 200) });
    await capture(page, receipt, '04c-cause');
    await journey.getByTestId('ide-journey-return').click();

    stage = '5 correct the design, run again, compare evidence';
    await openWorkspace(page, 'design');
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    await page.waitForFunction((wire) => document.querySelector(`[data-wire-id="${wire}"]`) !== null, brokenWire, { timeout: 8000 });
    await openWorkspace(page, 'verify');
    const fixed = await runAndRead(page);
    assert(fixed.status === 'pass', 'Restoring the wire must make every check pass again');
    await page.getByTestId(`ide-case-lab-obs-${CARRY_TICK}-${carryRow}`).click();
    await page.getByTestId('ide-follow-signal').click();
    await journey.waitFor({ state: 'visible' });
    assert(await journey.getAttribute('data-run-id') === fixed.runId && await journey.getByTestId('ide-journey-currency').getAttribute('data-currency') === 'current',
      'The new recording is the current evidence');
    await journey.getByTestId('ide-journey-return').click();
    await selectRecording(page, broken);
    await page.getByTestId(`ide-case-lab-obs-${CARRY_TICK}-${carryRow}`).click();
    await page.getByTestId('ide-follow-signal').click();
    await journey.waitFor({ state: 'visible' });
    const old = journey.getByTestId('ide-journey-currency');
    assert(await journey.getAttribute('data-run-id') === broken.runId && await old.getAttribute('data-currency') === 'stale',
      `The failing recording must now read as historical: ${await old.innerText()}`);
    assert(await journey.getByTestId('ide-journey-transition').getAttribute('data-value') === '0', 'Historical values stay what that recording observed');
    receipt.steps.push({ step: 'old recording historical, new recording current', old: await old.innerText() });
    await capture(page, receipt, '05-old-evidence-historical');

    assert(receipt.pageErrors.length === 0, `Page errors: ${JSON.stringify(receipt.pageErrors)}`);
    receipt.verdict = 'pass';
  } catch (error) {
    receipt.verdict = 'fail'; receipt.failedStage = stage; receipt.error = String(error);
    await capture(page, receipt, 'failure').catch(() => null);
    throw error;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    await writeFile(path.join(OUT, 'acceptance.json'), JSON.stringify(receipt, null, 2));
  }
});

async function openWorkspace(page, mode) {
  await page.getByTestId(`mode-button-${mode}`).click();
  await page.getByTestId(`ide-mode-${mode}`).waitFor({ state: 'visible' });
}
async function runAndRead(page) {
  const previous = await page.getByTestId('ide-run-identity').getAttribute('data-run-id').catch(() => null);
  await clickVerifyRun(page);
  await page.waitForFunction((id) => {
    const current = document.querySelector('[data-testid="ide-run-identity"]')?.getAttribute('data-run-id');
    return Boolean(current) && current !== id;
  }, previous, { timeout: 25000 });
  await waitForVerifyResult(page, { timeout: 25000 });
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun)));
}
async function openModule(page, name) {
  const instance = page.locator('[data-node-id="u-fa0"]').first();
  await instance.waitFor({ state: 'visible' });
  const box = await instance.boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction((moduleName) => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    const active = state.hierarchy?.modules.find((module) => module.id === state.activeModuleId);
    return active?.name === moduleName && document.querySelector('[data-node-id="o1"]');
  }, name, { timeout: 8000 });
}
async function deleteWire(page, wireId) {
  const wire = page.locator(`[data-wire-id="${wireId}"] path`).first();
  await wire.waitFor({ state: 'attached' });
  const box = await wire.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction((id) => window.__RB_LOGIC_VIEW_STORE__.getState().selection.wires?.has?.(id), wireId, { timeout: 4000 });
  await page.keyboard.press('Delete');
  await page.waitForFunction((id) => document.querySelector(`[data-wire-id="${id}"]`) === null, wireId, { timeout: 4000 });
}
async function traceCause(page, failing) {
  const explainer = page.getByTestId('ide-verify-explainer-trace');
  if (await explainer.isVisible().catch(() => false)) { await explainer.click(); return; }
  const id = `${failing.signal}-${failing.tick}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  const row = page.locator(`[data-testid^="ide-verify-mismatch-trace-"][data-testid$="${failing.tick}"]`).first();
  if (!(await row.isVisible().catch(() => false))) {
    const tab = page.getByRole('tab', { name: /Mismatches|Details/ }).first();
    if (await tab.isVisible().catch(() => false)) await tab.click();
  }
  const exact = page.getByTestId(`ide-verify-mismatch-trace-${id}`);
  await ((await exact.isVisible().catch(() => false)) ? exact : row).click();
}
async function selectRecording(page, run) {
  const history = page.getByRole('combobox', { name: 'Recorded run', exact: true });
  if (await history.isVisible().catch(() => false)) { await history.selectOption(run.runId); return; }
  const recording = page.getByRole('button', { name: `Recording ${run.sequence ?? 1}`, exact: true });
  if (!(await recording.isVisible().catch(() => false))) await page.getByTestId('ide-run-details').locator('summary').click();
  await recording.click();
}
async function capture(page, receipt, name) {
  const viewport = page.viewportSize();
  const artifact = `${name}-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path: path.join(OUT, artifact) });
  receipt.captures.push(artifact);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  assert(width <= viewport.width + 1, `Root horizontally overflows at ${viewport.width}x${viewport.height}`);
}
