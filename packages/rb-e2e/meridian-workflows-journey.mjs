// Meridian V1 workflows from normal student actions: open a design in the studio, Simulate (3),
// Run (Ctrl+Enter), read the recording on the sheet, and come back to it after a reload. Expected
// outcomes are fixed by what each design is, never read from the engine: shipped references pass
// every check, a register follows its enable (computed by hand below), a starter is incomplete
// and never passes, and a design with a swapped gate fails on the output that gate drives.
// The counter's full instrument (lenses, causes, board, source) is ide-meridian-counter-slice.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { BASE_URL, evidenceDir, launchChromium } from './harness.mjs';

const out = evidenceDir('meridian-workflows', process.env.RB_SHOT_LABEL ?? 'current');
fs.mkdirSync(out, { recursive: true });
const STUDIO = (query = '') => `${BASE_URL}?studio=meridian${query}`;
const browser = await launchChromium();
const results = [];

/** An enabled register, LD0 = Q: after each row's clock edge Q takes D only while EN is 1. */
function registerProjectFile() {
  const at = (x, y) => ({ position: { x, y }, x, y, rotation: 0, config: {}, state: {} });
  const rows = [[1, 1], [0, 0], [0, 1], [1, 0], [1, 1]];
  let q = 0;
  const vectors = rows.map(([d, en], tick) => { if (en) q = d; return { tick, inputs: { d, en }, expected: { q } }; });
  const project = {
    kind: 'rb-project', version: 1, createdAt: '2026-10-28T00:00:00.000Z', updatedAt: '2026-10-28T00:00:00.000Z',
    name: 'Enabled register', description: 'Q takes D on a rising edge while EN is high.',
    circuit: {
      nodes: [
        { id: 'clk', type: 'INPUT', label: 'CLK100MHZ', ...at(80, 60) },
        { id: 'd', type: 'INPUT', label: 'SW0', ...at(80, 160) },
        { id: 'en', type: 'INPUT', label: 'SW1', ...at(80, 260) },
        { id: 'r', type: 'Register1', ...at(300, 160), config: { width: 1, resetKind: 'none', hasEnable: true, enablePolarity: 'active_high', clockPolarity: 'rising_edge' } },
        { id: 'q', type: 'OUTPUT', label: 'LD0', ...at(520, 160) },
      ],
      connections: [['clk', 'out', 'r', 'CLK'], ['d', 'out', 'r', 'D'], ['en', 'out', 'r', 'EN'], ['r', 'Q', 'q', 'in']]
        .map(([from, fromPort, to, toPort], index) => ({ id: `w${index}`, from: { nodeId: from, portName: fromPort }, to: { nodeId: to, portName: toPort } })),
    },
    ioMapping: {
      inputs: [['clk', 'CLK100MHZ'], ['d', 'SW0'], ['en', 'SW1']].map(([nodeId, pin]) => ({ id: nodeId, nodeId, port: 'out', label: pin, pin })),
      outputs: [{ id: 'q', nodeId: 'q', port: 'in', label: 'LD0', pin: 'LD0' }],
    },
    vectors,
    hdl: { top: 'enabled_register', sources: [] },
    fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'enabled_register' },
    meta: { projectId: 'meridian-enabled-register' },
  };
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rb-meridian-')), 'enabled-register.rbproj');
  fs.writeFileSync(file, JSON.stringify(project, null, 2));
  return { file, expected: vectors.map((vector) => vector.expected.q) };
}

/** A student's full adder with SUM through OR: expectations are the full adder's, by hand. */
function wrongFullAdderFile() {
  const at = (x, y) => ({ position: { x, y }, x, y, rotation: 0, config: {}, state: {} });
  const nodes = [
    ['a', 'INPUT', 'SW0', 80, 60], ['b', 'INPUT', 'SW1', 80, 160], ['cin', 'INPUT', 'SW2', 80, 260],
    ['x1', 'XOR', null, 260, 100], ['x2', 'OR', null, 440, 120], ['a1', 'AND', null, 260, 240], ['a2', 'AND', null, 440, 240],
    ['o1', 'OR', null, 600, 260], ['sum', 'OUTPUT', 'LD0', 760, 120], ['cout', 'OUTPUT', 'LD1', 760, 260],
  ].map(([id, type, label, x, y]) => ({ id, type, ...(label ? { label } : {}), ...at(x, y) }));
  const wires = [['a', 'out', 'x1', 'a'], ['b', 'out', 'x1', 'b'], ['x1', 'out', 'x2', 'a'], ['cin', 'out', 'x2', 'b'], ['x2', 'out', 'sum', 'in'],
    ['a', 'out', 'a1', 'a'], ['b', 'out', 'a1', 'b'], ['x1', 'out', 'a2', 'a'], ['cin', 'out', 'a2', 'b'],
    ['a1', 'out', 'o1', 'a'], ['a2', 'out', 'o1', 'b'], ['o1', 'out', 'cout', 'in']];
  const vectors = Array.from({ length: 8 }, (_, tick) => {
    const [a, b, cin] = [(tick >> 2) & 1, (tick >> 1) & 1, tick & 1];
    return { tick, inputs: { a, b, cin }, expected: { sum: a ^ b ^ cin, cout: (a & b) | (cin & (a ^ b)) } };
  });
  const failingTicks = vectors.filter(({ inputs }) => (inputs.a ^ inputs.b) === 1 && inputs.cin === 1).map(({ tick }) => tick);
  const project = {
    kind: 'rb-project', version: 1, createdAt: '2026-10-28T00:00:00.000Z', updatedAt: '2026-10-28T00:00:00.000Z',
    name: 'My full adder', description: 'A full adder with a mistake.',
    circuit: { nodes, connections: wires.map(([from, fromPort, to, toPort], index) => ({ id: `w${index}`, from: { nodeId: from, portName: fromPort }, to: { nodeId: to, portName: toPort } })) },
    ioMapping: {
      inputs: [['a', 'SW0'], ['b', 'SW1'], ['cin', 'SW2']].map(([nodeId, pin]) => ({ id: nodeId, nodeId, port: 'out', label: pin, pin })),
      outputs: [['sum', 'LD0'], ['cout', 'LD1']].map(([nodeId, pin]) => ({ id: nodeId, nodeId, port: 'in', label: pin, pin })),
    },
    vectors,
    hdl: { top: 'my_full_adder', sources: [] },
    fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'my_full_adder' },
    meta: { projectId: 'meridian-my-full-adder' },
  };
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rb-meridian-')), 'my-full-adder.rbproj');
  fs.writeFileSync(file, JSON.stringify(project, null, 2));
  return { file, failingTicks };
}

const runtime = async (page) => {
  await page.waitForFunction(() => Boolean(window.__RB_PROJECT_RUNTIME__));
  return readRuntime(page);
};
const readRuntime = (page) => page.evaluate(() => {
  const state = window.__RB_PROJECT_RUNTIME__.getState();
  const run = state.verifyLastRun;
  return {
    projectId: state.projectId,
    nodes: state.circuit.nodes.length,
    run: run ? {
      runId: run.runId, status: run.status, engine: run.identity?.engine,
      checks: run.report.rows.filter((row) => row.expected === '0' || row.expected === '1').length,
      failing: run.report.rows.filter((row) => row.status === 'fail').map((row) => `t${row.tick} ${row.signal}`),
      rows: run.report.rows.map((row) => ({ tick: row.tick, signal: row.signal, actual: row.actual, expected: row.expected })),
    } : null,
  };
});

/**
 * Open a catalogue design in the studio. A link opens it straight into an empty session; over
 * work the studio asks first, and the student chooses to open the example.
 */
async function openExample(page, example) {
  await page.goto(STUDIO(`&example=${example}&stage=design`), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__RB_PROJECT_RUNTIME__));
  await page.waitForFunction((id) => window.__RB_PROJECT_RUNTIME__.getState().activeExampleId === id
    || Boolean(document.querySelector('[data-testid="meridian-example-notice"]')), example);
  const notice = page.getByTestId('meridian-example-open');
  if (await notice.count()) await notice.click();
  await page.waitForFunction((id) => window.__RB_PROJECT_RUNTIME__.getState().activeExampleId === id, example);
  await page.getByTestId('meridian-sheet').waitFor();
}

/** Simulate, then Run, as a student does in the studio; resolves with the new recording. */
async function runInStudio(page) {
  const before = (await runtime(page)).run?.runId ?? null;
  await page.getByTestId('meridian-sheet').waitFor();
  await page.keyboard.press('3');
  await page.getByTestId('meridian-lens-time').waitFor({ state: 'visible' });
  await page.keyboard.press('Control+Enter');
  await page.waitForFunction((previous) => {
    const run = window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun;
    const text = document.querySelector('[data-testid="meridian-run-status"]')?.textContent ?? '';
    return run && run.runId !== previous && /check|record/i.test(text);
  }, before, { timeout: 30000 });
  await page.getByTestId('meridian-time').waitFor({ state: 'visible' });
  return (await runtime(page)).run;
}

/**
 * The sheet shows the recording: at the moment the studio names (t<N> in the title block), every
 * net's drawn value is the value recorded on its driver at that tick. A net id is its driver
 * endpoint, the key the recording uses.
 */
async function sheetShowsRecording(page) {
  return page.evaluate(() => {
    const title = document.querySelector('[data-testid="meridian-title-block"]');
    const tick = Number(/\bt(\d+)\b/.exec(title?.textContent ?? '')?.[1]);
    const sample = window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.waveform?.find((entry) => entry.tick === tick);
    const drawn = [...document.querySelectorAll('[data-testid="meridian-sheet"] [data-net-id][data-value]')]
      .map((net) => ({ net: net.getAttribute('data-net-id'), shown: net.getAttribute('data-value') }));
    const compared = drawn.filter(({ net }) => sample && net in sample.signals);
    const wrong = compared.filter(({ net, shown }) => String(sample.signals[net]).toLowerCase() !== shown)
      .map(({ net, shown }) => `${net} drawn ${shown}, recorded ${sample.signals[net]}`);
    // A wire leaving a module instance has no key of its own in the recording (the recording keys
    // the cell inside it); the caller checks those against values worked out by hand.
    const uncompared = drawn.filter(({ net }) => !(sample && net in sample.signals));
    return { state: title?.getAttribute('data-value-state'), tick, drawn: drawn.length, compared: compared.length, wrong, uncompared, signals: sample?.signals ?? {} };
  });
}

/**
 * By hand, the hierarchical 4-bit adder's instance outputs at a sample: cell i adds A_i, B_i and
 * the carry in (cell 0's is ground); SUM_i and COUT_i are the wires leaving u-fa<i>.
 */
function rippleAdderInstanceWires(signals) {
  const expected = {};
  let carry = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = Number(signals[`a${i}.out`]);
    const b = Number(signals[`b${i}.out`]);
    expected[`u-fa${i}.SUM`] = String(a ^ b ^ carry);
    carry = (a & b) | (carry & (a ^ b));
    expected[`u-fa${i}.COUT`] = String(carry);
  }
  return expected;
}

async function reloadKeepsRecording(page, runId) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('meridian-sheet').waitFor();
  await page.waitForFunction((id) => window.__RB_PROJECT_RUNTIME__?.getState().verifyLastRun?.runId === id, runId, { timeout: 15000 });
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // 1. Shipped references open from the catalogue straight into the studio and pass every check.
  for (const [kind, example] of [['combinational', 'logic-gates'], ['full adder', 'full-adder'], ['resettable counter', 'two-bit-counter'], ['reusable module', 'four-bit-adder-hierarchical']]) {
    await openExample(page, example);
    const run = await runInStudio(page);
    assert.equal(run.status, 'pass', `${kind}: the shipped reference passes in the studio (${run.failing.join(', ')})`);
    assert.ok(run.checks > 0, `${kind}: the recording grades authored checks`);
    assert.equal(run.engine, 'redbyte-browser-v3', `${kind}: recorded by engine v3`);
    const sheet = await sheetShowsRecording(page);
    assert.equal(sheet.state, 'recorded', `${kind}: the sheet shows the recording`);
    assert.ok(Number.isInteger(sheet.tick) && sheet.compared > 0, `${kind}: the sheet draws recorded values at t${sheet.tick} (${sheet.compared} of ${sheet.drawn} nets compared)`);
    assert.deepEqual(sheet.wrong, [], `${kind}: every value on the sheet is the recorded one at t${sheet.tick}`);
    const instanceWiresByHand = (at) => (example === 'four-bit-adder-hierarchical' ? rippleAdderInstanceWires(at.signals) : {});
    const checkInstanceWires = (at) => {
      const byHand = Object.entries(instanceWiresByHand(at)).map(([net, value]) => `${net}=${value}`).sort();
      assert.deepEqual(at.uncompared.map(({ net, shown }) => `${net}=${shown}`).sort(), byHand, `${kind}: at t${at.tick} every value the recording cannot key is drawn as worked out by hand`);
      assert.equal(at.compared + at.uncompared.length, at.drawn);
    };
    checkInstanceWires(sheet);
    if (example === 'four-bit-adder-hierarchical') {
      // Every recorded case, so the carries are seen rippling, not only the all-zero first sample.
      let carries = 0;
      for (const tick of [...new Set(run.rows.map((row) => row.tick))]) {
        await page.getByTestId(`meridian-tick-${tick}`).click();
        await page.waitForFunction((t) => new RegExp(String.raw`\bt${t}\b`).test(document.querySelector('[data-testid="meridian-title-block"]')?.textContent ?? ''), tick);
        const at = await sheetShowsRecording(page);
        assert.deepEqual(at.wrong, [], `${kind}: every recorded value on the sheet at t${tick}`);
        checkInstanceWires(at);
        carries += Object.entries(instanceWiresByHand(at)).filter(([net, value]) => net.endsWith('.COUT') && value === '1').length;
      }
      assert.ok(carries > 0, `${kind}: the cases ripple a carry through the instances`);
    }
    assert.match(await page.getByTestId('meridian-run-status').innerText(), /passed/i, `${kind}: the studio says the checks passed`);
    await reloadKeepsRecording(page, run.runId);
    results.push({ kind, example, runId: run.runId, checks: run.checks, nodes: (await runtime(page)).nodes });
    console.log(`ok ${kind} (${example}, ${(await runtime(page)).nodes} parts): ${run.checks} checks pass; ${sheet.compared} recorded and ${sheet.uncompared.length} instance-wire values of ${sheet.drawn} match t${sheet.tick}; recording survives reload`);
  }

  // 2. A register imported as a project file: Q follows D only while EN is high (by hand above).
  {
    const { file, expected } = registerProjectFile();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByTestId('ide-project-file-input').setInputFiles(file);
    await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.some((node) => node.type === 'Register1'));
    const imported = await runtime(page);
    await page.goto(STUDIO(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((id) => window.__RB_PROJECT_RUNTIME__?.getState().projectId === id, imported.projectId);
    const run = await runInStudio(page);
    const observed = run.rows.filter((row) => /LD0|^q$/i.test(row.signal)).map((row) => Number(row.actual));
    assert.deepEqual(observed, expected, `register: Q after each edge follows D only while EN is high (observed ${observed})`);
    assert.equal(run.status, 'pass');
    results.push({ kind: 'register', runId: run.runId, observed });
    console.log(`ok register: LD0 after each edge ${observed.join('')}`);
  }

  // 3. An incomplete starter never passes in the studio.
  {
    await openExample(page, 'lab6-full-adder');
    const before = await runtime(page);
    assert.equal(before.run, null, 'incomplete: the starter opens with no recording');
    await page.keyboard.press('3');
    await page.getByTestId('meridian-lens-time').waitFor({ state: 'visible' });
    const statusBefore = await page.getByTestId('meridian-run-status').innerText().catch(() => '');
    await page.keyboard.press('Control+Enter');
    // Settled: a recording exists, or the studio states why it made none (never while Running).
    await page.waitForFunction((previous) => {
      const text = (document.querySelector('[data-testid="meridian-run-status"]')?.textContent ?? '').trim();
      if (/running/i.test(text)) return false;
      return Boolean(window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun) || (text !== previous && text.length > 0);
    }, statusBefore, { timeout: 30000 });
    const state = await runtime(page);
    const status = await page.getByTestId('meridian-run-status').innerText();
    // By hand: the starter (labStarters.ts) has no connections and 8 vectors over SUM and Cout, so
    // 16 checks, and an output nothing drives is never credited with a level - every check fails.
    assert.ok(state.run, `incomplete: the Run records the starter (${status})`);
    assert.equal(state.run.status, 'fail', `incomplete: the starter must not pass (${status})`);
    assert.equal(state.run.checks, 16, 'incomplete: the 8 vectors grade SUM and Cout');
    assert.equal(state.run.failing.length, 16, `incomplete: no undriven output is credited (${state.run.failing.join(', ')})`);
    assert.match(status, /16 of 16 checks failed/i, 'incomplete: the studio says how many checks failed');
    results.push({ kind: 'incomplete', status: status.trim(), run: state.run?.status ?? null });
    console.log(`ok incomplete: "${status.trim()}"`);
  }

  // 4. A failed design: the student's own saved full adder, with SUM wired through OR instead of
  //    XOR and the full adder's expectations (by hand). Opened in the studio and Run, it fails on
  //    SUM exactly where A xor B = 1 and CIN = 1, and nowhere else. (A shipped lab or example
  //    cannot stand in: its starter expectations are dropped by the first design edit.)
  {
    const { file, failingTicks } = wrongFullAdderFile();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByTestId('ide-project-file-input').setInputFiles(file);
    await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__?.getState().projectName === 'My full adder');
    await page.waitForFunction(() => document.querySelector('[data-testid="ide-save-state"]')?.getAttribute('data-state') === 'saved');
    await page.goto(STUDIO(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__?.getState().projectName === 'My full adder');
    const run = await runInStudio(page);
    assert.equal(run.status, 'fail', `failed: the wrong SUM gate fails in the studio (${run.checks} checks)`);
    assert.equal(run.checks, 16, 'failed: every authored check is graded');
    assert.deepEqual(run.failing, failingTicks.map((tick) => `t${tick} ld0`), 'failed: SUM (LD0) fails exactly where A xor B = 1 and CIN = 1');
    assert.match(await page.getByTestId('meridian-run-status').innerText(), /failed/i);
    await page.screenshot({ path: path.join(out, 'failed-design-1440x900.png') });
    results.push({ kind: 'failed design', checks: run.checks, failing: run.failing });
    console.log(`ok failed design: ${run.failing.join(', ')} of ${run.checks} checks fail`);
  }

  assert.deepEqual(errors, [], 'no page errors');
  await context.close();
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`PASS — Meridian workflows: references, register, incomplete starter and a failed design -> ${out}`);
