// Selected recording, chronological comparison and staleness through real controls.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const out = evidenceDir('recording-comparison', process.env.RB_SHOT_LABEL ?? 'current');
const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(15000);
const tid = id => page.getByTestId(id);
const selected = () => page.evaluate(() => structuredClone(window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun));
const command = async id => {
  await page.keyboard.press('Control+k');
  await tid('ide-command-palette').waitFor();
  if (await tid(`ide-command-${id}`).count() === 0) await tid('ide-command-palette-query').fill(id.split('.').at(-1));
  await tid(`ide-command-${id}`).click();
  await tid('ide-command-palette').waitFor({ state: 'detached' });
};
const run = async () => {
  const before = (await selected())?.runId;
  await tid('ide-vcb-run').click();
  await page.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId !== id, before);
  return selected();
};
// DOM observations prove what the student sees; runtime reads only identify owners.
const observations = () => tid('ide-case-lab').locator('tbody .ide-case-lab-obs code')
  .allTextContents().then(values => values.map(value => value.trim()));
const verdicts = () => tid('ide-case-lab').locator('tbody .ide-case-lab-verdict')
  .allTextContents().then(values => values.map(value => value.trim()));
const assertReadOnlyObservations = async () => assert.equal(
  await tid('ide-case-lab').locator('tbody .ide-case-lab-obs button, tbody .ide-case-lab-obs input').count(),
  0, 'Recorded observations are read-only');
const results = [];
try {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await tid('ide-project-start-a-lab-primary').click();
  await tid('ide-project-gannon-lab-details-full-adder').click();
  await tid('ide-project-gannon-lab-start-full-adder').click();
  await tid('mode-button-verify').click();
  await tid('ide-vcb-run').waitFor();
  const first = await run();
  assert.equal(first.status, 'pass');
  // Resolve the native field id from the actual table, without injecting project state.
  const expectedCell = page.locator('[data-testid^="ide-case-lab-exp-0-"]').first();
  const field = (await expectedCell.getAttribute('data-testid')).replace('ide-case-lab-exp-0-', '');
  const correct = (await expectedCell.innerText()).trim();
  const edit = async value => {
    for (let attempt = 0; attempt < 4; attempt++) {
      if ((await expectedCell.innerText()).trim() === value) return;
      await expectedCell.click();
    }
    assert.equal((await expectedCell.innerText()).trim(), value);
  };
  await edit(correct === '0' ? '1' : '0');
  const second = await run();
  assert.equal(second.status, 'fail');
  await page.screenshot({ path: path.join(out, 'pass-to-fail-1440x900.png') });
  assert.match(await tid('ide-run-check-result').innerText(), /checks failed/);
  assert.match(await tid('ide-case-lab-history').innerText(), /FAIL/, 'Table comparison must name selected failed recording, not first PASS');
  assert.match(await tid('ide-case-lab-history').innerText(), /1 more failing/);
  await edit(correct);
  const third = await run();
  assert.equal(third.status, 'pass');
  assert.match(await tid('ide-case-lab-history').innerText(), /PASS/);
  assert.match(await tid('ide-case-lab-history').innerText(), /1 fewer failing/);
  const fourth = await run();
  assert.equal(fourth.status, 'pass');
  assert.match(await tid('ide-case-lab-history').innerText(), /same as previous/);
  const picker = page.getByLabel('Recorded run', { exact: true });
  await picker.selectOption(second.runId);
  await tid('ide-verify-view-table').click();
  assert.equal((await selected()).runId, second.runId);
  assert.match(await tid('ide-case-lab-history').innerText(), /FAIL/);
  assert.match(await tid('ide-case-lab-history').innerText(), /1 more failing/);
  assert.equal(await tid('ide-case-lab-history').getAttribute('data-run-id'), second.runId);
  await picker.selectOption(fourth.runId);
  await tid('ide-verify-view-table').click();
  await edit(correct === '0' ? '1' : '0');
  assert.match(await tid('ide-case-lab-history').innerText(), /Current work differs/);
  assert.match(await tid('ide-run-check-result').innerText(), /checks passed/);
  assert.equal((await selected()).runId, fourth.runId, 'Edits retain the immutable historical verdict');
  const ownObservations = await observations();
  assert.ok(ownObservations.length > 0 && ownObservations.every(value => /^[01]$/.test(value)),
    'The owning scenario still shows its retained binary observations after an edit');
  assert.ok((await verdicts()).every(value => value === 'stale'), 'Edited checks mark the owning cases stale');
  await assertReadOnlyObservations();
  await page.getByLabel('Manage testbench', { exact: true }).click();
  await tid('ide-scenario-duplicate-btn').click();
  assert.equal(await tid('ide-case-lab-history').count(), 0, 'A new scenario must not borrow the old scenario comparison');
  assert.equal(await selected(), undefined, 'A duplicated scenario has no selected recording before its own run');
  const emptyObservations = await observations();
  assert.equal(emptyObservations.length, ownObservations.length, 'The copied authored cases retain their table shape');
  assert.ok(emptyObservations.every(value => value === '\u00b7'),
    'Matching tick and output names never borrow another scenario recording into the new case table');
  const emptyVerdicts = await verdicts();
  assert.ok(emptyVerdicts.length > 0 && emptyVerdicts.every(value => value === '\u2014'),
    'Unrun copied cases have no recorded verdict');
  await assertReadOnlyObservations();
  await page.screenshot({ path: path.join(out, 'new-scenario-empty-observations-1440x900.png') });
  const other = await run();
  assert.equal(other.status, 'fail');
  assert.match(await tid('ide-case-lab-history').innerText(), /no previous comparison/);
  assert.notEqual(other.scenarioId, fourth.scenarioId);
  const otherObservations = await observations();
  assert.ok(otherObservations.length > 0 && otherObservations.every(value => /^[01]$/.test(value)),
    'Running the copied scenario provides its own observations');
  await assertReadOnlyObservations();
  await tid(`ide-testbench-document-tab-${fourth.scenarioId}`).click();
  assert.equal((await selected()).runId, fourth.runId);
  assert.match(await tid('ide-case-lab-history').innerText(), /PASS/);
  assert.match(await tid('ide-case-lab-history').innerText(), /same as previous/);
  assert.deepEqual(await observations(), ownObservations, 'Selecting the recorded scenario restores its actual cells');
  assert.ok((await verdicts()).every(value => value === 'stale'), 'The restored recording retains the edited-check warning');
  assert.equal(await tid('ide-run-identity').getAttribute('data-currency'), 'differs');
  await tid('ide-verify-view-waveform').click();
  assert.equal(await tid('ide-verify-workspace-waveform').getAttribute('data-state'), 'stale');
  await tid('ide-verify-waveform-svg').waitFor({ state: 'visible' });
  assert.ok(await tid('ide-verify-waveform-point').count() > 0, 'The retained stale trace remains inspectable');
  assert.equal((await selected()).runId, fourth.runId, 'Opening Recorded trace preserves the exact recording');
  await page.screenshot({ path: path.join(out, 'own-scenario-retained-trace-1440x900.png') });
  await tid('ide-verify-view-table').click();
  await tid(`ide-testbench-document-tab-${other.scenarioId}`).click();
  assert.equal((await selected()).runId, other.runId, 'Switching back selects the copied scenario recording');
  assert.deepEqual(await observations(), otherObservations, 'The copied scenario restores its actual cells');
  assert.equal(await tid('ide-run-identity').getAttribute('data-currency'), 'current');
  await tid(`ide-testbench-document-tab-${fourth.scenarioId}`).click();
  assert.equal((await selected()).runId, fourth.runId);
  await picker.selectOption(second.runId);
  await tid('ide-verify-view-table').click();
  await command('project.save');
  await page.locator('[data-testid="ide-save-state"][data-state="saved"]').waitFor();
  const projectId = second.projectId;
  await command('project.close');
  await page.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().projectId !== id, projectId);
  await command('project.open');
  await tid(`ide-load-project-${projectId}`).click();
  await tid('mode-button-verify').click();
  await tid('ide-vcb-run').waitFor();
  assert.equal((await selected()).runId, second.runId, 'Save/reopen retains selected historical recording');
  await tid('ide-verify-view-table').click();
  assert.match(await tid('ide-case-lab-history').innerText(), /FAIL/);
  assert.match(await tid('ide-case-lab-history').innerText(), /1 more failing/);
  assert.match(await tid('ide-run-check-result').innerText(), /checks failed/);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await selected()).runId, second.runId, 'Reload retains historical selection');
  await tid('ide-verify-view-table').click();
  assert.match(await tid('ide-case-lab-history').innerText(), /FAIL/);
  assert.match(await tid('ide-case-lab-history').innerText(), /1 more failing/);
  results.push({ other: other.runId, savedSelection: second.runId,
    caseScope: { ownObservations, emptyObservations, otherObservations,
      unrunVerdicts: emptyVerdicts, retainedTrace: fourth.runId,
      proof: 'Real scenario duplication, run, switch and recorded-trace controls; no authored state injection' } });
  results.push({ first: first.runId, second: second.runId, third: third.runId, fourth: fourth.runId, field, errors });
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(out, 'retained-pass-stale-1440x900.png') });
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure-1440x900.png') });
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));
  await browser.close();
}
console.log(`PASS selected recording comparison: ${out}`);
