#!/usr/bin/env node

// Normal-control proof of 0111 + 0001 = 1000 through repeated FullAdderCell instances.
// Runtime and DOM reads identify objects and evidence; all mutations use visible controls.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, clickVerifyRun, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

const OUT = path.resolve(process.env.RB_HIERARCHY_OUT ?? '.redbyte/signal-journey/hierarchy-dev');
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 650 }];
assert(process.env.RB_GATE_BASE_URL, 'Set RB_GATE_BASE_URL to the actual candidate server for this external-server proof');
await mkdir(OUT, { recursive: true });

await runIdeGate('Signal Journey hierarchical carry signature through normal controls', async ({ page, baseUrl }) => {
  const receipt = { baseUrl, node: process.version, startedAt: new Date().toISOString(), steps: [], captures: [], pageErrors: [], consoleErrors: [] };
  let stage = 'clean start';
  page.on('pageerror', error => receipt.pageErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') receipt.consoleErrors.push(message.text()); });
  page.on('dialog', dialog => dialog.accept().catch(() => null));
  await page.addInitScript(() => { try { localStorage.setItem('rb-onboarding-v1-seen', '1'); } catch {} });
  await page.setViewportSize(VIEWPORTS[0]);
  try {
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=signal-journey-hierarchy-proof`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 20000 });
    await loadStarterProject(page, { exactExampleId: 'four-bit-adder-hierarchical' });
    await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.some(node => node.label === 'u_fa3'));
    receipt.steps.push({ step: 'loaded existing hierarchical starter through Project catalog' });

    stage = 'author signature case';
    await openWorkspace(page, 'verify');
    await page.getByTestId('ide-case-lab-table').waitFor({ state: 'visible' });
    const io = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().projectIoRows.map(row => ({ id: row.id, nodeId: row.nodeId, label: row.label, pin: row.pin })));
    const rowFor = id => { const row = io.find(item => item.nodeId === id); assert(row, `Missing ${id} boundary in ${JSON.stringify(io)}`); return row.id; };
    for (let bit = 0; bit < 4; bit += 1) {
      await setBit(page, `ide-case-lab-input-3-${rowFor(`a${bit}`)}`, bit < 3 ? 1 : 0);
      await setBit(page, `ide-case-lab-input-3-${rowFor(`b${bit}`)}`, bit === 0 ? 1 : 0);
      await setBit(page, `ide-case-lab-exp-3-${rowFor(`sum${bit}`)}`, bit === 3 ? 1 : 0);
    }
    await setBit(page, `ide-case-lab-exp-3-${rowFor('carry-out')}`, 0);
    await capture(page, receipt, '00-authored-inputs-before-new-recording');
    await page.getByRole('checkbox', { name: 'Evaluation steps', exact: true }).check();
    const previousRun = await page.getByTestId('ide-run-identity').getAttribute('data-run-id').catch(() => null);
    await clickVerifyRun(page);
    await page.waitForFunction(previous => {
      const current = document.querySelector('[data-testid="ide-run-identity"]')?.getAttribute('data-run-id');
      return Boolean(current) && current !== previous;
    }, previousRun, { timeout: 25000 });
    await waitForVerifyResult(page, { timeout: 25000 });
    const run = await readRun(page);
    const retainedBefore = await page.evaluate(id => JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive.find(item => item.runId === id)), run.runId);
    assert(retainedBefore, 'New recording must be retained in the archive before inspection');
    await writeFile(path.join(OUT, 'retained-run.json'), JSON.stringify(run, null, 2));
    await writeFile(path.join(OUT, 'retained-archive.json'), retainedBefore);
    assert(run.evaluationTrace?.status === 'complete', `Signature needs a complete observation trace, got ${run.evaluationTrace?.status}`);
    const signatureChecks = run.report.rows.filter(row => row.tick === 3);
    assert(signatureChecks.length === 5 && signatureChecks.every(row => row.expected === row.actual), `Signature's five independent checks must match: ${JSON.stringify(signatureChecks)}`);
    for (let bit = 0; bit < 4; bit += 1) {
      const observed = await page.getByTestId(`ide-case-lab-obs-3-${rowFor(`sum${bit}`)}`).innerText();
      assert(observed.trim() === String(bit === 3 ? 1 : 0), `SUM[${bit}] must be ${bit === 3 ? 1 : 0}, got ${observed}`);
    }
    assert((await page.getByTestId(`ide-case-lab-obs-3-${rowFor('carry-out')}`).innerText()).trim() === '0', 'CARRY must be 0 for 7+1');
    receipt.steps.push({ step: 'authored signature and ran', runId: run.runId, expected: '0111 + 0001 = 1000, CARRY 0', checks: signatureChecks });
    await capture(page, receipt, '01-signature-passing');

    stage = 'follow exact SUM3';
    await page.getByTestId(`ide-case-lab-obs-3-${rowFor('sum3')}`).click();
    assert(await page.getByTestId('ide-verify-selected-result').getAttribute('data-tick') === '3', 'Observed SUM3 must select exact t3');
    assert((await page.getByTestId('ide-verify-selected-result').innerText()).includes('Case 4'), 'SelectedResult must name t3 as Case 4, matching tick-order CaseLab labels');
    await page.getByTestId('ide-follow-signal').click();
    const journey = page.getByTestId('ide-signal-journey');
    await journey.waitFor({ state: 'visible' });
    assert(await journey.getAttribute('data-node-id') === 'sum3', 'Follow signal must bind SUM3, not another same-named bit');
    assert(await journey.getAttribute('data-tick') === '3', 'Journey must preserve t3');
    assert(await journey.getAttribute('data-run-id') === run.runId, 'Journey must bind the actual signature recording');
    await capture(page, receipt, '02-follow-sum3');
    await journey.getByRole('button', { name: 'Play evaluations', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="ide-signal-journey"]')?.getAttribute('data-event') !== 'sample');
    await journey.getByRole('button', { name: 'Pause', exact: true }).click();
    const paused = await journey.getAttribute('data-event');
    await page.waitForTimeout(800);
    assert(await journey.getAttribute('data-event') === paused, 'Pause must stop captured evaluation playback without changing the phase');
    receipt.steps.push({ step: 'playback paused on captured observation', eventOrder: paused });

    stage = 'actual carry evaluation';
    const sourceEntry = Object.entries(run.elaborationSources ?? {}).find(([, source]) => source.localNodeId === 'o1' && source.displayPath.includes('u_fa2'));
    assert(sourceEntry, 'The retained source adapter must identify o1 in the u_fa2 instance');
    const [carryId, carrySource] = sourceEntry;
    const carryEvent = run.evaluationTrace.events.find(event => event.nodeId === carryId && event.context.tick === 3 && event.evaluationPhase === 'evaluate');
    const chosenEvent = carryEvent ?? run.evaluationTrace.events.find(event => event.nodeId === carryId && event.context.tick === 3);
    assert(chosenEvent, 'The SUM3 cone must have an actual captured carry evaluation in u_fa2 at t3');
    let steps = 0;
    while (await journey.getAttribute('data-event') !== String(chosenEvent.order) && steps < run.evaluationTrace.events.length) {
      const next = journey.getByRole('button', { name: 'Next evaluation', exact: true });
      assert(!await next.isDisabled(), `Playback ended before actual u_fa2 carry event ${chosenEvent.order}`);
      await next.click();
      steps += 1;
    }
    assert(await journey.getAttribute('data-event') === String(chosenEvent.order), 'Actual carry evaluation must be the paused phase');
    assert(chosenEvent.outputs.out === 1, `u_fa2 carry must be 1 while adding 7+1: ${JSON.stringify(chosenEvent.outputs)}`);
    const instanceSelect = journey.getByRole('combobox', { name: 'Instance', exact: true });
    await instanceSelect.selectOption(JSON.stringify(carrySource.instancePath));
    const carryObject = journey.locator(`[data-projection-node="${carryId}"]`);
    assert(await carryObject.isVisible(), 'Entering u_fa2 must expose its real carry gate');
    await carryObject.click();
    assert(await journey.getAttribute('data-node-id') === carryId, 'Selecting carry gate must commit its exact elaborated identity');
    assert(await journey.getAttribute('data-event') === String(chosenEvent.order), 'Entering and selecting the carry must preserve its evaluation phase');
    receipt.steps.push({ step: 'paused actual carry and entered u_fa2', nodeId: carryId, instancePath: carrySource.instancePath, eventOrder: chosenEvent.order, event: chosenEvent, uiSteps: steps });
    const understand = journey.getByTestId('ide-journey-understand');
    assert(/0 OR 1 = 1/.test(await understand.innerText()), 'The primary local rule must use the actual carry input/output values');
    assert(/stayed at 1/.test(await understand.innerText()), 'The primary explanation must describe the unchanged output');
    assert(!(await journey.locator('.rb-journey-heading').innerText()).includes(run.identity.design.slice(0,12)), 'Revision bookkeeping belongs in explicit details');
    const incomingCarry = run.circuitSnapshot.connections.find(w => w.to.nodeId === carryId && w.to.portName === 'a');
    assert(incomingCarry, 'Carry must have a retained input-a connection');
    const drawnCarryWire = `${incomingCarry.from.nodeId}.${incomingCarry.from.portName}-${incomingCarry.to.nodeId}.${incomingCarry.to.portName}`;
    await journey.locator(`[data-projection-wire="${drawnCarryWire}"]`).press('Enter');
    assert(await journey.getAttribute('data-node-id') === carryId && (await understand.innerText()).includes('Input a = 0'), 'Keyboard wire selection must inspect the exact input, not its output');
    assert(await journey.getAttribute('data-event') === String(chosenEvent.order), 'Selecting a connection must preserve the actual paused event');
    await capture(page, receipt, '03a-select-carry-connection');
    await journey.getByRole('button', {name:'Inspect gate output',exact:true}).click();
    assert(/0 OR 1 = 1/.test(await understand.innerText()), 'Inspect output must restore the same gate rule');
    receipt.steps.push({step:'direct keyboard connection -> exact input -> gate output', wire:incomingCarry.id, eventOrder:chosenEvent.order});
    await capture(page, receipt, '03-paused-carry-instance');

    stage = 'linked local logic';
    await journey.getByRole('button', { name: 'Logic', exact: true }).click();
    assert(await journey.getAttribute('data-node-id') === carryId && await journey.getAttribute('data-event') === String(chosenEvent.order), 'Logic must preserve carry object and captured phase');
    assert(await journey.getAttribute('data-active-node') === carryId, 'Logic must describe the exact active carry gate');
    for (const read of chosenEvent.inputReads) assert(await journey.locator(`[data-journey-term="${read.driver.nodeId}"]`).count() > 0,
      `Local expression must link the actual ${read.portName} driver ${read.driver.nodeId}`);
    const branch = journey.locator(`[data-journey-branch="${chosenEvent.inputReads[0].driver.nodeId}"]`).first();
    await branch.getByRole('button',{name:/Explore inputs/}).click();
    assert(await branch.locator('ul').count() === 1, 'A selected logic branch must expand its real inputs without expanding the whole formula');
    assert(await journey.getAttribute('data-event') === String(chosenEvent.order), 'Logic exploration must preserve the paused moment');
    await capture(page, receipt, '04-carry-local-logic');

    stage = 'generated HDL and reverse correspondence';
    await journey.getByRole('button', { name: 'Generated HDL', exact: true }).click();
    const sourceSpan = run.generatedSource.spans.find(span => span.definitionId === carrySource.definitionId && span.nodeId === carrySource.localNodeId);
    assert(sourceSpan, 'Carry gate must have exact deterministic generated source correspondence');
    const mapped = journey.locator('.rb-journey-source .is-selected');
    assert(await mapped.count() > 0, 'Generated HDL must visibly identify the mapped span');
    const snippetBox = await journey.getByTestId('ide-journey-mapped-source').boundingBox();
    assert(snippetBox && snippetBox.y >= 0 && snippetBox.y + snippetBox.height <= page.viewportSize().height,
      'Exact mapped source snippet must already be visible on lens entry without manual scrolling');
    await capture(page, receipt, '05-carry-generated-hdl');
    await journey.getByRole('button', { name: `Select source object at line ${sourceSpan.startLine}`, exact: true }).click();
    assert(await journey.getAttribute('data-node-id') === carryId, 'Reverse HDL selection must resolve u_fa2/o1, not a same-named sibling');
    assert(await journey.getAttribute('data-tick') === '3' && await journey.getAttribute('data-event') === String(chosenEvent.order), 'Reverse HDL selection must preserve moment and evaluation phase');
    await journey.getByRole('button', { name: 'Circuit', exact: true }).click();
    assert(await journey.locator(`[data-projection-node="${carryId}"]`).isVisible(), 'Circuit return must keep the same instance visible');
    receipt.steps.push({ step: 'local logic -> exact generated source -> reverse selection -> same instance/phase', sourceSpan });
    await capture(page, receipt, '06-return-same-carry-phase');

    stage = 'viewport and keyboard correspondence';
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await journey.focus();
      const before = await journey.getAttribute('data-event');
      await page.keyboard.press('ArrowLeft');
      assert(await journey.getAttribute('data-event') !== before, 'Keyboard ArrowLeft must seek a retained evaluation');
      await page.keyboard.press('ArrowRight');
      assert(await journey.getAttribute('data-event') === before, 'Keyboard ArrowRight must return to exact paused evaluation');
      await capture(page, receipt, '07-keyboard-same-phase');
      assert(await journey.getAttribute('data-run-id') === run.runId && await journey.getAttribute('data-tick') === '3', 'Viewport changes must preserve run and tick');
      const connections = journey.locator('.rb-journey-connections');
      await connections.scrollIntoViewIfNeeded();
      assert(await connections.isVisible(), 'Follow driver/load controls must remain reachable through ordinary journey scrolling');
      if (viewport.height < 700) await capture(page, receipt, '07a-reachable-follow-controls');
      await journey.locator('.rb-journey-heading').scrollIntoViewIfNeeded();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert(await journey.getAttribute('data-event') === String(chosenEvent.order), 'Reduced motion must retain exact explanatory phase');
    await capture(page, receipt, '07b-reduced-motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    stage = 'hierarchical top-level live exploration availability';
    await page.setViewportSize(VIEWPORTS[0]);
    await page.getByTestId('ide-journey-return').click();
    await openWorkspace(page, 'design');
    const returnToCurrent = page.getByTestId('ide-design-current-design');
    if (await returnToCurrent.isVisible()) await returnToCurrent.click();
    await page.getByTestId('ide-design-fit-circuit-canvas').first().click();
    const explore = page.getByTestId('ide-design-explore');
    assert(await explore.isEnabled(), 'Supported combinational hierarchy must be directly explorable');
    assert((await readRun(page)).runId === run.runId, 'Entering current Design must retain the signature recording');
    const liveOwners = await page.evaluate(() => { const s = window.__RB_PROJECT_RUNTIME__.getState(); return JSON.stringify({circuit:s.circuit,hierarchy:s.hierarchy,scenarios:s.scenarios,projectVectors:s.projectVectors,archive:s.verifyRunArchive,history:s.verifyRunHistory,last:s.verifyLastRun,health:s.projectHealthCore}); });
    await explore.click();
    const live = page.getByTestId('ide-live-hierarchy');
    await live.waitFor({state:'visible'});
    await page.getByTestId('ide-design-live-reset').click();
    for (const id of ['a0','a1','a2','b0']) await live.getByTestId(`switch-toggle-${id}`).click();
    assert((await live.getByTestId('ide-live-boundary-words').innerText()).includes('1000 = 8'), 'Live boundary word must show actual 7+1 result');
    const parentConnection = live.locator('[data-projection-wire="u-fa1.COUT-u-fa2.CIN"]');
    await parentConnection.press('Enter');
    await live.getByRole('button',{name:'Enter this instance',exact:true}).click();
    assert(await live.getAttribute('data-instance-path') === JSON.stringify(['u-fa2']), 'Live carry connection must enter the exact repeated instance');
    await live.locator('[data-projection-node="o1"]').click();
    assert((await live.getByTestId('ide-live-local-rule').innerText()).includes('0 OR 1 = 1'), 'Live rule must use parent execution values');
    assert(await live.getByRole('button',{name:/Toggle/}).count() === 0, 'Internal boundary nodes and loads must not become input controls');
    await capture(page, receipt, '07c-live-exact-instance');
    await live.getByRole('button',{name:'Whole circuit',exact:true}).click();
    assert(await parentConnection.getAttribute('aria-pressed') === 'true', 'Returning to parent must restore selected carry connection');
    await explore.click();
    const afterLiveOwners = await page.evaluate(() => { const s = window.__RB_PROJECT_RUNTIME__.getState(); return JSON.stringify({circuit:s.circuit,hierarchy:s.hierarchy,scenarios:s.scenarios,projectVectors:s.projectVectors,archive:s.verifyRunArchive,history:s.verifyRunHistory,last:s.verifyLastRun,health:s.projectHealthCore}); });
    assert(afterLiveOwners === liveOwners, 'Live hierarchy must preserve authored cases, definitions, entire recording and export authority');
    receipt.steps.push({ step: 'hierarchical live exploration and exact instance', available: true, inputs:'7+1', result:'1000 = 8', instancePath:['u-fa2'], rule:'0 OR 1 = 1', ownersUnchanged:true });

    stage = 'historical identity after friendly rename and topology edit';
    const top = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.map(node => ({ id: node.id, label: node.label, type: node.type })));
    const instance = top.find(node => node.label === 'u_fa2');
    assert(instance, 'Current design must retain editable u_fa2');
    await selectDesignPart(page, instance.id);
    await page.getByTestId('ide-design-label-edit-btn').click();
    await page.getByTestId('ide-design-label-input').fill('carry_stage_two');
    await page.getByTestId('ide-design-label-save').click();
    await page.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.find(node => node.id === id)?.label === 'carry_stage_two', instance.id);
    await page.keyboard.press('Escape');
    await page.getByTestId('ide-design-palette-not').first().click();
    await page.waitForFunction(() => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-placement-active') === '1', null, { timeout: 5000 });
    const sheet = await page.getByTestId('ide-design-live-canvas').boundingBox();
    assert(sheet, 'Editable sheet must be available for a topology change');
    const placementPoint = { x: sheet.x + sheet.width * .50, y: sheet.y + sheet.height * .24 };
    await page.mouse.move(placementPoint.x, placementPoint.y);
    receipt.steps.push({ step: 'additive topology placement target', target: await page.evaluate(point => {
      const target = document.elementFromPoint(point.x, point.y);
      return { tag: target?.tagName, testId: target?.getAttribute('data-testid'), blocked: Boolean(target?.closest('[data-blocks-canvas-placement="1"], [data-node-id], [data-wire-id]')) };
    }, placementPoint) });
    await page.mouse.click(placementPoint.x, placementPoint.y);
    await page.waitForFunction(count => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length === count + 1, top.length);
    await page.keyboard.press('Escape');
    await capture(page, receipt, '08-current-renamed-topology');
    await openWorkspace(page, 'verify');
    const history = page.getByRole('combobox', { name: 'Recorded run', exact: true });
    if (await history.isVisible()) await history.selectOption(run.runId);
    else {
      const recording = page.getByRole('button', { name: `Recording ${run.sequence ?? 1}`, exact: true });
      if (!await recording.isVisible()) await page.getByTestId('ide-run-details').locator('summary').click();
      await recording.click();
    }
    await page.getByTestId(`ide-case-lab-obs-3-${rowFor('sum3')}`).click();
    assert(await page.getByTestId('ide-verify-selected-result').getAttribute('data-tick') === '3'
      && (await page.getByTestId('ide-verify-selected-result').innerText()).includes('Case 4'),
      'Historical SelectedResult must retain exact t3/Case4 identity after current design edits');
    await page.getByTestId('ide-follow-signal').click();
    assert(await journey.getAttribute('data-run-id') === run.runId && await journey.getAttribute('data-tick') === '3', 'Old recording must reopen its original SUM3 moment after edits');
    await journey.getByRole('combobox', { name: 'Instance', exact: true }).selectOption(JSON.stringify(carrySource.instancePath));
    assert((await journey.getByRole('combobox', { name: 'Instance', exact: true }).innerText()).includes('u_fa2'), 'Retained instance name must remain u_fa2');
    await journey.locator(`[data-projection-node="${carryId}"]`).click();
    assert(await journey.getAttribute('data-node-id') === carryId, 'Historical stage must resolve its original carry object after live rename');
    const retained = await page.evaluate(id => JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive.find(item => item.runId === id)), run.runId);
    assert(retained === retainedBefore, 'Live rename/topology edits and journey inspection must preserve the entire old recording');
    receipt.steps.push({ step: 'historical snapshot survives friendly rename and additive topology edit', runId: run.runId });
    await capture(page, receipt, '09-retained-old-instance');
    assert(receipt.pageErrors.length === 0, `Page errors: ${JSON.stringify(receipt.pageErrors)}`);
    receipt.verdict = 'pass';
  } catch (error) {
    receipt.verdict = 'fail'; receipt.failedStage = stage; receipt.error = String(error);
    receipt.failureRuntime = await page.evaluate(() => {
      const current = window.__RB_PROJECT_RUNTIME__?.getState();
      return current ? { activeScenarioId: current.activeScenarioId, circuitNodes: current.circuit.nodes.map(node => ({ id: node.id, label: node.label, type: node.type })),
        archiveIds: current.verifyRunArchive.map(item => item.runId), selectedRunId: current.verifyLastRun?.runId } : null;
    }).catch(() => null);
    await capture(page, receipt, 'failure').catch(() => null);
    throw error;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    await writeFile(path.join(OUT, 'hierarchy-proof.json'), JSON.stringify(receipt, null, 2));
  }
});

async function openWorkspace(page, mode) {
  await page.getByTestId(`mode-button-${mode}`).click();
  await page.getByTestId(`ide-mode-${mode}`).waitFor({ state: 'visible' });
}
async function setBit(page, testId, value) {
  const cell = page.getByTestId(testId);
  for (let guard = 0; guard < 4 && (await cell.innerText()).trim() !== String(value); guard += 1) {
    await cell.click();
    await page.waitForTimeout(110);
  }
  assert((await cell.innerText()).trim() === String(value), `Authored cell ${testId} must be ${value}`);
}
async function readRun(page) { return page.evaluate(() => JSON.parse(JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun))); }
async function capture(page, receipt, name) {
  const viewport = page.viewportSize();
  const artifact = `${name}-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path: path.join(OUT, artifact) });
  const geometry = await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, root: { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight },
    journey: document.querySelector('[data-testid="ide-signal-journey"]')?.getBoundingClientRect().toJSON(),
    context: document.querySelector('.rb-journey-heading')?.textContent, playback: document.querySelector('.rb-journey-playback')?.textContent }));
  receipt.captures.push({ artifact, geometry });
  assert(geometry.root.scrollWidth <= viewport.width + 1, `Root horizontally overflows at ${viewport.width}x${viewport.height}`);
}
async function selectDesignPart(page, id) {
  const body = page.locator(`[data-node-id="${id}"] .rb-sym-body`).first();
  await body.scrollIntoViewIfNeeded();
  const box = await body.boundingBox();
  assert(box, `Design part ${id} must be visible`);
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(8, box.height / 4));
  await page.waitForFunction(nodeId => window.__RB_LOGIC_VIEW_STORE__.getState().selection.nodes.has(nodeId), id);
}
