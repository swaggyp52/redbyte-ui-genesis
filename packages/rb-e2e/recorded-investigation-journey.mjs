// Connected observation, recorded circuit inspection and stale recording retention.
// Reuses the operational counter starter and the repository browser harness.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

const out = evidenceDir('recorded-investigation');
const browser = await launchChromium();
const results = [];
let activePage;
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 650 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    activePage = page;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const tid = (id) => page.getByTestId(id);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await tid('ide-project-start-a-lab-primary').click();
    await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();
    await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
    await tid('mode-button-verify').click();
    await tid('ide-vcb-run').waitFor();
    // The input cell performs an actual stimulus edit, separate from moving the ruler.
    const inputCell = page.locator('[data-testid^="ide-timing-cell-"][data-testid$="-2"]:not([data-generated="true"])').first();
    await inputCell.click();
    await tid('ide-vcb-observe-only').click();
    await tid('ide-vcb-run').click();
    await tid('ide-verify-inspect-circuit').waitFor();
    assert.match(await tid('ide-verify-results-summary-headline').innerText(), /simulat|complete|record|observ/i);
    await page.screenshot({ path: path.join(out, `counter-observed-${viewport.width}x${viewport.height}.png`) });
    await tid('ide-verify-inspect-circuit').click();
    await tid('ide-recorded-circuit-svg').waitFor();
    await page.getByLabel('Recorded circuit signal').selectOption('LD0');
    await tid('ide-verify-waveform-scroll').press('Home');
    await page.screenshot({ path: path.join(out, `counter-investigation-${viewport.width}x${viewport.height}.png`) });
    const recordedContext = await tid('ide-recorded-circuit-context').innerText();
    assert.match(recordedContext, /LD0/);
    const nodes = await tid('ide-recorded-circuit-svg').locator('[data-node-id]').count();
    assert.ok(nodes >= 5, `Real circuit nodes present: ${nodes}`);
    const selectedWires = await tid('ide-recorded-circuit-svg').locator('[data-wire-selected="1"]').count();
    assert.ok(selectedWires > 0, 'Selected output is linked to its real net');
    const paintedNet = await tid('ide-recorded-circuit-svg').locator('.rb-net-line').first().evaluate((node) => getComputedStyle(node).stroke);
    assert.notEqual(paintedNet, 'none', 'Actual net geometry has visible schematic ink');
    await page.getByRole('button', { name: 'Circuit focus', exact: true }).click();
    assert.equal(await tid('ide-recorded-circuit-context').innerText(), recordedContext);
    await page.screenshot({ path: path.join(out, `counter-circuit-focus-${viewport.width}x${viewport.height}.png`) });
    await page.getByRole('button', { name: 'Timeline focus', exact: true }).click();
    await page.getByRole('button', { name: 'Together', exact: true }).click();
    assert.equal(await tid('ide-recorded-circuit-context').innerText(), recordedContext);
    await tid('ide-verify-view-timeline').click();
    await inputCell.click();
    await tid('ide-verify-view-waveform').click();
    assert.equal(await tid('ide-recorded-circuit-context').innerText(), recordedContext, 'Draft edit leaves the observed sample and run unchanged');
    assert.equal(await tid('ide-verify-workspace-waveform').getAttribute('data-state'), 'stale');
    await page.screenshot({ path: path.join(out, `counter-stale-${viewport.width}x${viewport.height}.png`) });
    await tid('ide-vcb-run').click();
    assert.notEqual(await tid('ide-verify-workspace-waveform').getAttribute('data-state'), 'stale');
    assert.equal(await page.getByLabel('Recorded run', { exact: true }).locator('option').count(), 2);

    // Give this same counter experiment a deliberately wrong check, inspect the
    // recorded net/time, repair the check, and retain the failed recording in full.
    const selectedRun = () => page.evaluate(() => {
      const run = window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun;
      return { id: run.runId, status: run.status, rows: run.report.rows,
        waveform: run.waveform, circuit: run.circuitSnapshot, inputs: run.evidence?.vectors };
    });
    const compare = async () => {
      const previous = (await selectedRun()).id;
      await tid('ide-vcb-use-saved-checks').click();
      await tid('ide-vcb-run').click();
      await page.waitForFunction((id) => {
        const run = window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun;
        return run?.runId !== id && (run?.status === 'pass' || run?.status === 'fail');
      }, previous);
      return selectedRun();
    };
    const setExpected = async (cell, value) => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if ((await cell.innerText()).trim() === value) return;
        await cell.click();
      }
      assert.equal((await cell.innerText()).trim(), value, 'Authored counter expectation changed through its cell');
    };
    await page.getByRole('button', { name: 'Close circuit investigation', exact: true }).click();
    await tid('ide-verify-view-table').click();
    const ld0Header = page.locator('[data-testid^="ide-case-lab-col-"]').filter({ hasText: /^LD0$/ });
    const field = (await ld0Header.getAttribute('data-testid')).slice('ide-case-lab-col-'.length);
    const checkTick = 2;
    const expectedCell = tid(`ide-case-lab-exp-${checkTick}-${field}`);
    await tid(`ide-case-lab-row-${checkTick}`).locator('td').first().click();
    await ld0Header.click();
    const actual = (await tid('ide-sim-context-inspector').locator('dl > div')
      .filter({ has: page.getByText('Current value', { exact: true }) }).locator('dd').innerText()).trim();
    assert.match(actual, /^[01]$/, 'Counter has a recorded binary output at the chosen case');
    const caseObserved = await expectedCell.evaluate((cell) => cell.closest('td').nextElementSibling.textContent.trim());
    assert.equal(caseObserved, actual,
      `Observe case table and selected-signal inspector show the same recorded value: ${JSON.stringify({ field, sample: (await selectedRun()).waveform.find((sample) => sample.tick === checkTick) })}`);
    assert.match(await tid(`ide-case-lab-row-${checkTick}`).getAttribute('class'), /is-observed/,
      'Saved expectations are not graded by the observation');
    assert.equal(await tid('ide-case-lab-history').count(), 0, 'An observation is not labeled as a passed comparison');
    assert.match(await tid('ide-sim-context-inspector').innerText(), /Not evaluated/);
    await page.screenshot({ path: path.join(out, `counter-observed-table-${viewport.width}x${viewport.height}.png`) });
    // One recording/sample owns both the drawing and its expanded state table.
    const boardRun = await selectedRun();
    await tid('mode-button-hardware').click();
    await tid('ide-hw-mode-btn-live').click();
    if (await tid('ide-show-left-dock').isVisible()) await tid('ide-show-left-dock').click();
    if (await tid('ide-show-right-dock').isVisible()) await tid('ide-show-right-dock').click();
    for (const tick of [checkTick, checkTick + 1]) {
      if (tick !== checkTick) await tid('ide-hw-simulated-board-next').click();
      await page.waitForFunction((tick) => document.querySelector('[data-testid="ide-hw-simulated-board-tick"]')?.textContent === String(tick), tick);
      const sample = boardRun.waveform.find((entry) => entry.tick === tick);
      const table = await tid('ide-hardware-live-state-table').locator('tbody tr').evaluateAll((rows) =>
        Object.fromEntries(rows.map((row) => [row.cells[0].textContent.trim(), row.cells[1].textContent.trim()])));
      // The expected value comes from the recording itself, through its own circuit snapshot: the
      // boundary node carrying each label and that node's recorded output. That is a different route
      // from Board's mapping lookup, so agreement here is not the product agreeing with itself.
      const recordedKey = (label) => {
        const node = boardRun.circuit.nodes.find((entry) => entry.label === label && /^(INPUT|OUTPUT)$/.test(entry.type));
        assert.ok(node, `The recording's circuit has a boundary node labelled ${label}`);
        return `${node.id}.out`;
      };
      for (const [alias, label, id] of [['LD0', 'LD0', 'ld-0'], ['LD1', 'LD1', 'ld-1'], ['SW0', 'EN', 'sw-0']]) {
        const expected = sample.signals[recordedKey(label)];
        assert.match(String(expected), /^[01]$/, `The recording has a binary ${label} at t${tick}`);
        assert.equal(table[alias], expected, `${alias} table agrees with recording at t${tick}`);
        assert.equal(await tid(`ide-hw-${id}`).getAttribute('data-on'), expected, `${alias} drawing agrees at t${tick}`);
      }
      if (tick === checkTick) assert.equal(table.LD0, actual, 'Board and Simulate report the same LD0 for the same recorded tick');
      assert.match(await tid('ide-hw-simulated-board-readout').innerText(), new RegExp(`^t${tick} · `), 'Board readout names the tick Simulate names');
      assert.ok((await tid('ide-hw-simulated-board-source').innerText()).includes(boardRun.id), 'Board identifies the exact recording');
      await page.screenshot({ path: path.join(out, `counter-board-t${tick}-${viewport.width}x${viewport.height}.png`) });
    }
    assert.deepEqual(await selectedRun(), boardRun, 'Board readback does not mutate the recording');
    await tid('mode-button-verify').click();
    await tid('ide-verify-view-table').click();
    await tid(`ide-case-lab-row-${checkTick}`).locator('td').first().click();
    await ld0Header.click();
    const wrong = actual === '0' ? '1' : '0';
    await setExpected(expectedCell, wrong);
    const failedRun = await compare();
    assert.equal(failedRun.status, 'fail');
    const failedRow = failedRun.rows.find((row) => row.tick === checkTick && String(row.expected) === wrong && String(row.actual) === actual);
    assert.ok(failedRow, 'The deliberate counter check fails at the chosen recorded time');
    await tid('ide-verify-view-table').click();
    await tid(`ide-case-lab-row-${checkTick}`).locator('td').first().click();
    await tid('ide-verify-inspect-circuit').click();
    await page.getByLabel('Recorded circuit signal').selectOption('LD0');
    const failedContext = await tid('ide-recorded-circuit-context').innerText();
    assert.ok(failedContext.includes(`t${checkTick}`) && failedContext.includes(`LD0 = ${actual}`), failedContext);
    assert.ok(await tid('ide-recorded-circuit-svg').locator('[data-wire-selected="1"]').count() > 0,
      'The failed counter output remains linked to its recorded net');
    await page.screenshot({ path: path.join(out, `counter-failed-check-${viewport.width}x${viewport.height}.png`) });
    await page.getByRole('button', { name: 'Close circuit investigation', exact: true }).click();
    await tid('ide-verify-view-table').click();
    await setExpected(expectedCell, actual);
    const repairedRun = await compare();
    assert.equal(repairedRun.status, 'pass', 'Correcting the counter expectation restores passing checks');
    const recordingPicker = page.getByLabel('Recorded run', { exact: true });
    await recordingPicker.selectOption(failedRun.id);
    assert.deepEqual(await selectedRun(), failedRun, 'Repair and rerun preserve the exact failed record');
    await tid('ide-verify-view-table').click();
    await tid(`ide-case-lab-row-${checkTick}`).locator('td').first().click();
    await tid('ide-verify-inspect-circuit').click();
    await page.getByLabel('Recorded circuit signal').selectOption('LD0');
    assert.equal(await tid('ide-recorded-circuit-context').innerText(), failedContext,
      'Reopening the failed counter record restores the same selected net and time');
    await page.screenshot({ path: path.join(out, `counter-retained-failure-${viewport.width}x${viewport.height}.png`) });
    await recordingPicker.selectOption(repairedRun.id);
    assert.equal((await selectedRun()).status, 'pass');
    console.log(`${viewport.width}x${viewport.height}: counter LD0 t${checkTick} expected ${wrong} / actual ${actual} failed; corrected to ${actual}, passed; failed run ${failedRun.id} retained exactly.`);
    // Root-text scaling is distinct from browser zoom; keep controls reachable at 200%.
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.getByRole('button', { name: 'Circuit focus', exact: true }).click();
    await page.getByRole('button', { name: 'Fit circuit', exact: true }).click();
    await page.screenshot({ path: path.join(out, `counter-large-text-${viewport.width}x${viewport.height}.png`) });
    assert.equal(await tid('mode-button-verify').getAttribute('aria-selected'), 'true');
    assert.equal(errors.length, 0, errors.join('\n'));
    results.push({ viewport, nodes, selectedWires, recordedContext, counterRepair: { tick: checkTick, signal: 'LD0', wrong, actual,
      failedRunId: failedRun.id, repairedRunId: repairedRun.id, failedContext }, errors });
    await context.close();
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(out, `failure-${activePage.viewportSize().width}x${activePage.viewportSize().height}.png`) }).catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ url: BASE_URL, results }, null, 2));
  await browser.close();
}
console.log(`PASS connected recorded inspection at ${results.length} viewports. Evidence: ${out}`);
