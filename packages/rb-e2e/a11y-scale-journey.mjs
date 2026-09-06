// Accessibility and scale — one record per claim, and no claim wider than its check.
//
// The project under test is loaded the way a student loads it: first use → Start a Lab →
// Lab 3 Full Adder, through the Start Center. Nothing is written into the store to make a
// step work; every action below is a real click or a real key press, and the runtime is
// read only to ASSERT what the UI already did.
//
// What this journey proves, separately:
//   1 landmark      exactly one <main>.
//   2 bounded list   a 500-signal imported VCD renders a bounded number of rows with an
//                    honest "showing N of M" hint instead of 500 DOM rows.
//   3 reachable      a signal past the row cap is still reachable and operable through the
//                    filter, so bounding hides nothing permanently.
//   4 keyboard       a control is reached by Tab and OPERATED by key, with the resulting
//                    state change asserted - not merely focusable.
//   5 reflow         no horizontal overflow at the test viewport, and none at half of it,
//                    which is reflow at a narrow width (WCAG 1.4.10).
//   6 text resize    text scaled to 200% (WCAG 1.4.4) keeps the same controls operable.
//   7 waveform scale a 260-signal VCD that actually MOVES: a 4-bit bus declared past the
//                    row cap is found through the filter, pinned, read at four chosen
//                    times, stepped onto a transition from the keyboard, and re-radixed.
//                    Every value read back is checked against what the VCD file itself
//                    encodes - never against a second panel of the thing under test.
//   8 keyboard depth five further keyboard operations, each proven by an asserted STATE
//                    CHANGE and never by "something took focus": the command palette
//                    (Ctrl+K → ArrowDown → Enter opens the surface the command names),
//                    Escape (closes and loses no work), the document tab strip (the active
//                    document changes), the Case Lab grid (an expectation edited by key and
//                    verified in the canonical document), and the application menubar.
//   9 reduced motion during a REAL replay the tick and the values are readable as text and
//                    as attributes - no state carried by motion alone - and the replay
//                    instrument's own motion is suppressed under prefers-reduced-motion.
//
// What it does NOT prove, and must not be described as proving: real browser zoom, screen
// reader output, colour contrast, focus-order quality across every surface, or performance.
// Those are separate records and are not asserted here.
//
// Whatever the product could not be made to prove is printed as an explicit UNPROVEN line
// and carried into the closing summary. A NEW unproven item — one not already named and
// explained in KNOWN_UNPROVEN below — fails the journey instead of quietly appearing.
//
// The waveform and the schematic are engineering canvases: they are ALLOWED to scroll
// horizontally inside their own containers. The overflow checks below are on the document,
// never on those canvases, and nothing here should be "fixed" by hiding clipped content.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, launchChromium } from './harness.mjs';

const dir = mkdtempSync(join(tmpdir(), 'rb-a11y-'));

// A 500-signal VCD.
const vcdLines = ['$timescale 1ns $end'];
const ids = [];
for (let i = 0; i < 500; i++) { const id = `s${i}`; ids.push(id); vcdLines.push(`$var wire 4 ${id} sig${i} $end`); }
vcdLines.push('$enddefinitions $end', '#0');
for (const id of ids) vcdLines.push(`b1010 ${id}`);
const vcdPath = join(dir, 'big.vcd');
writeFileSync(vcdPath, vcdLines.join('\n'), 'utf8');

// A 260-signal VCD that MOVES. 500 static signals at t0 is a DOM-size proof; it says
// nothing about reading a value at a time. This one carries five timestamps and one 4-bit
// bus declared at index 240 — past the 200-row render cap — so the cap has to be defeated
// by the filter rather than by luck. DEEP_TIMELINE is the authority for every value the
// journey later expects to see.
const DEEP_INDEX = 240;
const DEEP_NAME = 'bus_probe';
const DEEP_KEY = `s${DEEP_INDEX}`;
const DEEP_WIDTH = 4;
const MOVING_SIGNAL_COUNT = 260;
const DEEP_TIMELINE = [
  { time: 0, bits: '0000' },
  { time: 10, bits: '1011' },
  { time: 20, bits: '0110' },
  { time: 30, bits: '1111' },
  { time: 40, bits: '0001' },
];
const movingLines = ['$timescale 1ns $end'];
for (let i = 0; i < MOVING_SIGNAL_COUNT; i++) {
  movingLines.push(
    i === DEEP_INDEX
      ? `$var wire ${DEEP_WIDTH} s${i} ${DEEP_NAME} $end`
      : `$var wire 1 s${i} sig${String(i).padStart(3, '0')} $end`
  );
}
movingLines.push('$enddefinitions $end');
for (const step of DEEP_TIMELINE) {
  movingLines.push(`#${step.time}`);
  if (step.time === 0) for (let i = 0; i < MOVING_SIGNAL_COUNT; i++) if (i !== DEEP_INDEX) movingLines.push(`0s${i}`);
  if (step.time === 10) movingLines.push('1s0');
  if (step.time === 30) movingLines.push('0s0');
  movingLines.push(`b${step.bits} s${DEEP_INDEX}`);
}
const movingVcdPath = join(dir, 'transitions.vcd');
writeFileSync(movingVcdPath, movingLines.join('\n'), 'utf8');

/** What the FILE says the bus holds at `time` — the last change at or before it. */
function bitsAt(time) {
  let bits = null;
  for (const step of DEEP_TIMELINE) {
    if (step.time > time) break;
    bits = step.bits;
  }
  if (bits === null) throw new Error(`the fixture encodes no value at or before t=${time}`);
  return bits;
}

/** Those bits rendered in a radix, computed here so the panel is never its own witness. */
function expectedReading(bits, radix) {
  const magnitude = BigInt(`0b${bits}`);
  if (radix === 'bin') return bits;
  if (radix === 'dec') return magnitude.toString(10);
  if (radix === 'hex') return `0x${magnitude.toString(16).toUpperCase()}`;
  const sign = 1n << BigInt(DEEP_WIDTH - 1);
  const span = 1n << BigInt(DEEP_WIDTH);
  return ((magnitude & sign) ? magnitude - span : magnitude).toString(10);
}

/**
 * Everything this build genuinely does not do, each measured rather than assumed. An
 * unproven item outside this list is a NEW gap and fails the journey; an item in this list
 * that turns out to be proven is reported as such and does not fail.
 */
const KNOWN_UNPROVEN = new Map([
  ['palette-escape-focus-return',
    'Escape closes the command palette but focus is not returned to the control that opened it (it lands on <body>).'],
  ['menu-activation-focus-return',
    'Activating a menubar item closes the menu without returning focus to the menu button (Escape does return it).'],
  ['play-toggle-aria-pressed',
    'The replay Play/Stop control publishes no aria-pressed; its state is carried by the visible label only.'],
  ['analyzer-bus-expansion',
    'The imported-VCD Analyzer offers no bus expand/collapse; radix is the only per-signal value affordance it has.'],
  ['analyzer-radix-past-cap',
    'The per-signal radix control lives only in the capped SIGNALS list, so a pinned signal past the cap can only be re-radixed while a filter is applied.'],
  ['reduced-motion-not-universal',
    'prefers-reduced-motion does not reach every control: .ide-button rules keep a 120-150ms hover/press transition, the replay transport among them. Nothing that carries replay state moves.'],
]);

const browser = await launchChromium();
const fail = (m) => { throw new Error(m); };
const tid = (t) => `[data-testid="${t}"]`;

/** Load Lab 3 the way a student does. No project is placed in the store. */
async function startFullAdderLab(page) {
  await page.waitForSelector(tid('ide-project-start-a-lab-primary'), { timeout: 20000 });
  await page.click(tid('ide-project-start-a-lab-primary'));
  await page.waitForSelector(tid('ide-project-gannon-lab-details-full-adder'), { state: 'visible', timeout: 10000 });
  await page.click(tid('ide-project-gannon-lab-details-full-adder'));
  await page.waitForSelector(tid('ide-project-gannon-lab-start-full-adder'), { state: 'visible', timeout: 10000 });
  await page.click(tid('ide-project-gannon-lab-start-full-adder'));
  await page.waitForFunction(
    () => (window.__RB_PROJECT_RUNTIME__?.getState?.().projectVectors ?? []).length > 0,
    undefined,
    { timeout: 20000 }
  );
  await page.waitForSelector(tid('mode-button-verify'), { timeout: 10000 });
}

async function openSimulate(page) {
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-vcd-analyzer-file-input'), { state: 'attached', timeout: 15000 });
}

/** The data-testid of whatever currently has focus — used to steer, never as a proof. */
function focusedTestId(page) {
  return page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
}

/** Tab from `fromTestId` until `match` accepts the focused element. Returns the hop count. */
async function tabUntil(page, fromTestId, match, budget = 40) {
  await page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.focus(), fromTestId);
  for (let hops = 1; hops <= budget; hops += 1) {
    await page.keyboard.press('Tab');
    const reached = await focusedTestId(page);
    if (reached && match(reached)) return { reached, hops };
  }
  return { reached: null, hops: budget };
}

/** Everything a student could lose: the document, the imported evidence, the analyzer view. */
function workSnapshot(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    const vectors = [...(state.projectVectors ?? []), ...(state.customVectors ?? [])];
    return JSON.stringify({
      project: state.projectName ?? null,
      vectors: vectors.map((vector) => [vector.tick, JSON.stringify(vector.expected ?? {})]).sort(),
      importedSignals: state.importedWaveform?.signals?.length ?? 0,
      pinned: [...(state.vcdAnalyzer?.selectedKeys ?? [])].sort(),
      cursor: state.vcdAnalyzer?.cursorTime ?? null,
      search: state.vcdAnalyzer?.search ?? null,
    });
  });
}

/** The canonical authored expectation for one case/signal, read from the project document. */
function authoredExpected(page, tick, signalId) {
  return page.evaluate(({ tick, signalId }) => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    const vectors = [...(state.projectVectors ?? []), ...(state.customVectors ?? [])];
    const value = vectors.find((vector) => vector.tick === tick)?.expected?.[signalId];
    return value === undefined || value === null ? null : String(value);
  }, { tick, signalId });
}

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const at = `[${width}×${height}]`;
  const unproven = [];
  const cannotProve = (id, detail) => {
    unproven.push(id);
    console.log(`${at} UNPROVEN (${id}) — ${detail}`);
  };

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await startFullAdderLab(page);
  await openSimulate(page);

  // ① Exactly one main landmark.
  const mains = await page.locator('main').count();
  if (mains !== 1) fail(`expected one <main> landmark, found ${mains}`);
  console.log(`${at} ① exactly one main landmark`);

  // ② Load a 500-signal VCD → the signal list is bounded, not exploded.
  await page.getByTestId('ide-vcd-analyzer-file-input').setInputFiles(vcdPath);
  await page.waitForFunction(
    () => window.__RB_PROJECT_RUNTIME__.getState().importedWaveform?.signals?.length === 500,
    undefined,
    { timeout: 15000 }
  );
  const totalSignals = (await page.getByTestId('ide-vcd-analyzer-signal-count').textContent())?.trim();
  if (totalSignals !== '500') fail(`expected 500 signals reported, got ${totalSignals}`);
  const renderedRows = await page.locator('[data-testid^="ide-vcd-analyzer-signal-"]').count();
  // testid prefix also matches signal-count / signal-more; the row cap is 200.
  if (renderedRows > 210) fail(`signal rows not bounded (rendered ${renderedRows})`);
  if (await page.getByTestId('ide-vcd-analyzer-signal-more').count() === 0) fail('bounded "showing N of M" hint missing');
  const shownRows = await page.locator('.ide-vcd-analyzer-signal-row').count();
  if (shownRows === 0) fail('no signal rows rendered at all');
  console.log(`${at} ② 500 signals reported, ${shownRows} rows rendered, honest hint present`);

  // ③ Bounded is not hidden: a signal past the cap is reachable and operable via the filter.
  // The row testid carries the signal KEY, which is not the display name. Ask the panel
  // which key belongs to the signal that is past the cap.
  const deepName = 'sig473';
  const deepSignal = await page.evaluate(() => {
    const wf = window.__RB_PROJECT_RUNTIME__.getState().importedWaveform;
    const hit = (wf?.signals ?? []).find((sig) => sig.name === 'sig473');
    return hit ? hit.key : null;
  });
  if (!deepSignal) fail('sig473 is not in the loaded waveform');
  const beforeFilter = await page.locator(`[data-testid="ide-vcd-analyzer-signal-${deepSignal}"]`).count();
  if (beforeFilter !== 0) fail(`${deepSignal} was already rendered; pick a signal past the row cap`);
  await page.getByTestId('ide-vcd-analyzer-search').fill(deepName);
  await page.waitForTimeout(300);
  const deepRow = page.locator(`[data-testid="ide-vcd-analyzer-signal-${deepSignal}"]`);
  if (await deepRow.count() === 0) fail(`${deepName} is unreachable through the filter — the cap hides work`);
  await page.getByTestId(`ide-vcd-analyzer-pin-${deepSignal}`).check();
  await page.waitForTimeout(250);
  const pinned = await page.evaluate((key) => {
    const row = document.querySelector(`[data-testid="ide-vcd-analyzer-signal-${key}"]`);
    const box = document.querySelector(`[data-testid="ide-vcd-analyzer-pin-${key}"]`);
    return {
      pinnedClass: row?.className.includes('is-pinned') ?? false,
      checked: box instanceof HTMLInputElement ? box.checked : null,
    };
  }, deepSignal);
  if (!pinned.checked) fail(`${deepSignal} could not be pinned after the filter reached it`);
  console.log(`${at} ③ ${deepName} — past the row cap — is reachable and pinnable through the filter`);
  await page.getByTestId('ide-vcd-analyzer-search').fill('');
  await page.waitForTimeout(250);

  // ④ Keyboard OPERATION, not just focus: reach a control with Tab and act on it with a key,
  // then assert the state it was supposed to change.
  await page.getByTestId('ide-vcd-analyzer-search').focus();
  let hops = 0;
  let reached = null;
  while (hops < 40) {
    await page.keyboard.press('Tab');
    hops += 1;
    reached = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
    if (reached && reached.startsWith('ide-vcd-analyzer-pin-')) break;
  }
  if (!reached || !reached.startsWith('ide-vcd-analyzer-pin-')) {
    fail(`no signal pin control was reachable by Tab within ${hops} hops`);
  }
  const pinKey = reached.replace('ide-vcd-analyzer-pin-', '');
  const wasChecked = await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el instanceof HTMLInputElement ? el.checked : null;
  }, reached);
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  const nowChecked = await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el instanceof HTMLInputElement ? el.checked : null;
  }, reached);
  if (nowChecked === wasChecked) {
    fail(`Space on the focused pin control for ${pinKey} changed nothing — focusable is not operable`);
  }
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  console.log(`${at} ④ keyboard: Tab reached ${pinKey} in ${hops} hops and Space operated it`);

  // ⑤ Reflow: no horizontal overflow of the DOCUMENT at this viewport, or at half of it.
  // Engineering canvases may still scroll inside their own containers; that is not overflow
  // of the page and must not be "fixed" by clipping them.
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);
  await page.setViewportSize({ width: Math.round(width / 2), height: Math.round(height / 2) });
  await page.waitForTimeout(300);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${Math.round(width / 2)}×${Math.round(height / 2)}: ${overflow}px`);
  console.log(`${at} ⑤ reflow: no document overflow at full width or half width (reduced motion)`);

  // ⑥ Text resize to 200% (WCAG 1.4.4) — the control must still be there and operable.
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(200);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.waitForTimeout(400);
  const resized = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ide-vcd-analyzer-search"]');
    if (!(el instanceof HTMLElement)) return null;
    const box = el.getBoundingClientRect();
    return { visible: box.width > 0 && box.height > 0, root: getComputedStyle(document.documentElement).fontSize };
  });
  if (!resized?.visible) fail('the analyzer filter disappears when text is scaled to 200%');
  await page.getByTestId('ide-vcd-analyzer-search').fill('sig12');
  await page.waitForTimeout(300);
  const stillWorks = await page.locator('.ide-vcd-analyzer-signal-row').count();
  if (stillWorks === 0) fail('filtering does not work with text scaled to 200%');
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.getByTestId('ide-vcd-analyzer-search').fill('');
  await page.waitForTimeout(250);
  console.log(`${at} ⑥ text resize: root ${resized.root}, filter still visible and operable`);

  // ⑦ WAVEFORM SCALE WITH REAL TRANSITIONS.
  // 260 signals, five timestamps, one 4-bit bus past the row cap. Everything asserted below
  // is computed from DEEP_TIMELINE — the text this journey wrote into the .vcd — so the
  // panel is never checked against itself.
  await page.getByTestId('ide-vcd-analyzer-file-input').setInputFiles(movingVcdPath);
  await page.waitForFunction(
    (count) => window.__RB_PROJECT_RUNTIME__.getState().importedWaveform?.signals?.length === count,
    MOVING_SIGNAL_COUNT,
    { timeout: 15000 }
  );
  const movingTotal = (await page.getByTestId('ide-vcd-analyzer-signal-count').textContent())?.trim();
  if (movingTotal !== String(MOVING_SIGNAL_COUNT)) {
    fail(`the moving VCD should report ${MOVING_SIGNAL_COUNT} signals, the panel says ${movingTotal}`);
  }
  if (await page.locator(tid('ide-vcd-analyzer-notes')).count() > 0) {
    const notes = (await page.locator(tid('ide-vcd-analyzer-notes')).textContent()) ?? '';
    fail(`the moving VCD parsed with complaints, so nothing below would be trustworthy: ${notes.slice(0, 200)}`);
  }
  if (await page.locator(tid(`ide-vcd-analyzer-signal-${DEEP_KEY}`)).count() !== 0) {
    fail(`${DEEP_NAME} must start past the ${MOVING_SIGNAL_COUNT}-signal render cap for this record to mean anything`);
  }
  // Find it, reveal it, pin it.
  await page.getByTestId('ide-vcd-analyzer-search').fill(DEEP_NAME);
  await page.waitForSelector(tid(`ide-vcd-analyzer-signal-${DEEP_KEY}`), { timeout: 8000 });
  await page.getByTestId(`ide-vcd-analyzer-pin-${DEEP_KEY}`).check();
  await page.waitForSelector(tid(`ide-vcd-analyzer-measure-value-${DEEP_KEY}`), { timeout: 8000 });
  const busRow = await page.evaluate((key) => {
    const row = document.querySelector(`[data-testid="ide-vcd-analyzer-measure-${key}"]`);
    return row ? Array.from(row.querySelectorAll('th,td')).map((cell) => (cell.textContent ?? '').trim()) : null;
  }, DEEP_KEY);
  if (!busRow) fail(`${DEEP_NAME} was pinned but never appeared in MEASUREMENTS`);
  if (busRow[3] !== String(DEEP_TIMELINE.length)) {
    fail(`${DEEP_NAME} records ${DEEP_TIMELINE.length} value changes in the file; the panel counts ${busRow[3]}`);
  }
  // Read it at four times: on a transition, between two, on the next, and at the end.
  const readBus = async () => ((await page.getByTestId(`ide-vcd-analyzer-measure-value-${DEEP_KEY}`).textContent()) ?? '').trim();
  const setCursor = async (time) => {
    await page.getByTestId('ide-vcd-analyzer-cursor-value').fill(String(time));
    await page.waitForFunction(
      (want) => window.__RB_PROJECT_RUNTIME__.getState().vcdAnalyzer?.cursorTime === want,
      time,
      { timeout: 8000 }
    );
  };
  for (const time of [10, 25, 30, 40, 0]) {
    await setCursor(time);
    const want = expectedReading(bitsAt(time), 'hex');
    const got = await readBus();
    if (got !== want) {
      fail(`${DEEP_NAME} at t=${time}: the file encodes ${bitsAt(time)} (hex ${want}), the Analyzer reads "${got}"`);
    }
  }
  // Step onto a transition from the keyboard: t=9 holds the previous value, ArrowRight lands
  // on t=10 where the file changes it.
  await setCursor(9);
  const beforeEdge = await readBus();
  if (beforeEdge !== expectedReading(bitsAt(9), 'hex')) {
    fail(`${DEEP_NAME} at t=9 should read ${expectedReading(bitsAt(9), 'hex')}, reads "${beforeEdge}"`);
  }
  await page.evaluate(() => document.querySelector('[data-testid="ide-vcd-analyzer-cursor"]')?.focus());
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(
    () => window.__RB_PROJECT_RUNTIME__.getState().vcdAnalyzer?.cursorTime === 10,
    undefined,
    { timeout: 8000 }
  );
  const afterEdge = await readBus();
  if (afterEdge !== expectedReading(bitsAt(10), 'hex')) {
    fail(`stepping the cursor to t=10 should read ${expectedReading(bitsAt(10), 'hex')}, reads "${afterEdge}"`);
  }
  if (afterEdge === beforeEdge) {
    fail(`t=9 and t=10 read the same value ("${afterEdge}") — the cursor did not cross the transition`);
  }
  // Re-radix it. Each rendering is computed here from the same four bits.
  for (const radix of ['dec', 'signed', 'bin', 'hex']) {
    await page.getByTestId(`ide-vcd-analyzer-radix-${DEEP_KEY}`).selectOption(radix);
    await page.waitForFunction(
      ({ key, want }) => window.__RB_PROJECT_RUNTIME__.getState().vcdAnalyzer?.radixByKey?.[key] === want,
      { key: DEEP_KEY, want: radix },
      { timeout: 8000 }
    );
    const want = expectedReading(bitsAt(10), radix);
    const got = await readBus();
    if (got !== want) fail(`${DEEP_NAME} at t=10 in ${radix} should read ${want}, the Analyzer reads "${got}"`);
  }
  // The radix control is keyboard-operable too, and the reading follows it.
  await page.evaluate((key) => document.querySelector(`[data-testid="ide-vcd-analyzer-radix-${key}"]`)?.focus(), DEEP_KEY);
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(
    (key) => window.__RB_PROJECT_RUNTIME__.getState().vcdAnalyzer?.radixByKey?.[key] === 'bin',
    DEEP_KEY,
    { timeout: 8000 }
  );
  const keyboardRadixReading = await readBus();
  if (keyboardRadixReading !== expectedReading(bitsAt(10), 'bin')) {
    fail(`ArrowUp on the radix control should render ${expectedReading(bitsAt(10), 'bin')}, reads "${keyboardRadixReading}"`);
  }
  // The pin survives clearing the filter: the bus is measured because it is pinned, not
  // because a filter happens to be narrowing the list.
  await page.getByTestId('ide-vcd-analyzer-search').fill('');
  await page.waitForFunction(
    () => (window.__RB_PROJECT_RUNTIME__.getState().vcdAnalyzer?.search ?? '') === '',
    undefined,
    { timeout: 8000 }
  );
  const unfilteredReading = await readBus();
  if (unfilteredReading !== keyboardRadixReading) {
    fail(`clearing the filter changed the pinned reading from "${keyboardRadixReading}" to "${unfilteredReading}"`);
  }
  // The capability is 'a pinned signal past the cap can still be re-radixed', not 'the
  // SIGNALS list still holds its control'. Measurements is where a pinned signal lives once
  // the filter is gone, so accept either control - and OPERATE whichever exists, so this is
  // a working affordance rather than a present one.
  const listRadixSel = tid(`ide-vcd-analyzer-radix-${DEEP_KEY}`);
  const measureRadixSel = tid(`ide-vcd-analyzer-measure-radix-${DEEP_KEY}`);
  const radixControl = (await page.locator(listRadixSel).count()) !== 0
    ? listRadixSel
    : (await page.locator(measureRadixSel).count()) !== 0
      ? measureRadixSel
      : null;
  if (radixControl) {
    await page.selectOption(radixControl, 'hex');
    await page.waitForTimeout(250);
    const asHex = await readBus();
    if (asHex !== expectedReading(bitsAt(10), 'hex')) {
      fail(`re-radixing ${DEEP_NAME} past the cap read "${asHex}", expected "${expectedReading(bitsAt(10), 'hex')}" from the .vcd`);
    }
    await page.selectOption(radixControl, 'bin');
    await page.waitForTimeout(250);
    const backToBin = await readBus();
    if (backToBin !== keyboardRadixReading) {
      fail(`restoring the radix read "${backToBin}", expected "${keyboardRadixReading}"`);
    }
    console.log(`${at} a past-the-cap pinned signal is still re-radixable with no filter (${radixControl.includes('measure') ? 'in Measurements' : 'in the list'}): hex ${asHex}, back to ${backToBin}`);
  } else {
    cannotProve('analyzer-radix-past-cap',
      `${DEEP_NAME} stays measured with no filter, but its radix control is gone: the per-signal radix select lives only in the 200-row SIGNALS list.`);
  }
  const busAffordances = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="ide-vcd-analyzer"]');
    if (!panel) return null;
    return Array.from(panel.querySelectorAll('[data-testid]'))
      .map((el) => el.getAttribute('data-testid'))
      .filter((id) => /bus|expand|collapse/i.test(id ?? ''));
  });
  if (busAffordances === null) fail('the Analyzer panel vanished while record ⑦ was reading it');
  if (busAffordances.length === 0) {
    cannotProve('analyzer-bus-expansion',
      'the imported Analyzer exposes no bus expand/collapse control, so "expand a bus" is proven only as a radix change on the 4-bit bus.');
  }
  console.log(`${at} ⑦ waveform scale: ${MOVING_SIGNAL_COUNT} signals, ${DEEP_NAME} (past the cap) found, pinned, read correctly at t=0/10/25/30/40, stepped 9→10 by key, and rendered in hex/dec/signed/bin — every value matching the .vcd`);

  // ⑧ KEYBOARD DEPTH. Five operations, each proven by a state change.

  // ⑧a Command palette: Ctrl+K, ArrowDown, Enter — and the named surface opens.
  const modeNow = () => page.evaluate(() =>
    document.querySelector('[data-testid="ide-workspace-rail"] [data-active="true"]')?.getAttribute('data-stage') ?? null);
  const modeBeforePalette = await modeNow();
  if (modeBeforePalette !== 'verify') fail(`record ⑧a expects to start in Simulate, the rail says ${modeBeforePalette}`);
  await page.keyboard.press('Control+K');
  await page.waitForSelector(tid('ide-command-palette'), { timeout: 8000 });
  await page.keyboard.type('board');
  await page.waitForSelector(tid('ide-command-surface.board.open'), { timeout: 8000 });
  const targetIndex = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="ide-command-palette-results"] [role="option"]'))
      .findIndex((el) => el.getAttribute('data-testid') === 'ide-command-surface.board.open'));
  if (targetIndex < 0) fail('"Open Board & Constraints" is not offered by the palette for the query "board"');
  for (let step = 0; step < targetIndex; step += 1) await page.keyboard.press('ArrowDown');
  const selectedByArrows = await page.locator(tid('ide-command-surface.board.open')).getAttribute('aria-selected');
  if (selectedByArrows !== 'true') {
    fail(`${targetIndex} ArrowDown presses did not move the palette selection onto the Board command (aria-selected=${selectedByArrows})`);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-command-palette"]') === null,
    undefined,
    { timeout: 8000 }
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="mode-button-hardware"]')?.getAttribute('data-active') === 'true',
    undefined,
    { timeout: 10000 }
  );
  const modeAfterPalette = await modeNow();
  if (modeAfterPalette !== 'hardware') {
    fail(`Enter on "Open Board & Constraints" should open Board & Constraints; the rail says ${modeAfterPalette}`);
  }
  console.log(`${at} ⑧a palette: Ctrl+K → "board" → ${targetIndex}×ArrowDown → Enter opened Board & Constraints (verify → hardware)`);
  await openSimulate(page);
  await page.waitForSelector(tid('ide-doc-tab-cases:default'), { timeout: 15000 });

  // ⑧b Escape closes the palette and loses no work.
  const workBefore = await workSnapshot(page);
  await page.evaluate(() => document.querySelector('[data-testid="mode-button-verify"]')?.focus());
  const focusBeforePalette = await focusedTestId(page);
  await page.keyboard.press('Control+K');
  await page.waitForSelector(tid('ide-command-palette'), { timeout: 8000 });
  await page.keyboard.type('theme');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-command-palette"]') === null,
    undefined,
    { timeout: 8000 }
  );
  const workAfter = await workSnapshot(page);
  if (workAfter !== workBefore) {
    fail(`opening, typing into and Escaping the palette changed the workspace:\n  before ${workBefore}\n  after  ${workAfter}`);
  }
  const focusAfterEscape = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    return el.getAttribute('data-testid') ?? el.tagName;
  });
  if (focusAfterEscape === null) {
    cannotProve('palette-escape-focus-return',
      `Escape closed the palette but focus fell to <body>; it was on ${focusBeforePalette} before Ctrl+K, so a keyboard user restarts the tab order.`);
  } else if (focusAfterEscape !== focusBeforePalette) {
    console.log(`${at} ⑧b note: Escape moved focus to ${focusAfterEscape}, not back to ${focusBeforePalette}`);
  }
  console.log(`${at} ⑧b Escape: the palette closed and the project, imported evidence and analyzer view are byte-identical`);

  // ⑧c Document tabs from the keyboard: the ACTIVE DOCUMENT changes, not just the focus.
  await page.click(tid('ide-doc-tab-cases:default'));
  await page.waitForSelector(tid('ide-case-lab'), { timeout: 10000 });
  const tabKeys = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="tab"][data-doc-key]')).map((el) => el.getAttribute('data-doc-key')));
  const activeDoc = () => page.evaluate(() =>
    document.querySelector('[role="tab"][data-doc-key][aria-selected="true"]')?.getAttribute('data-doc-key') ?? null);
  const docBefore = await activeDoc();
  if (docBefore !== 'cases:default') fail(`record ⑧c expects the Cases document active, the strip says ${docBefore}`);
  const expectedNeighbour = tabKeys[(tabKeys.indexOf(docBefore) + 1) % tabKeys.length];
  const tabWalk = await tabUntil(page, 'ide-topbar-project-rename', (id) => id === `ide-doc-tab-${docBefore}`, 30);
  if (!tabWalk.reached) {
    fail(`the active document tab was not reachable by Tab within ${tabWalk.hops} hops from the project title`);
  }
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(
    (previous) => document.querySelector('[role="tab"][data-doc-key][aria-selected="true"]')?.getAttribute('data-doc-key') !== previous,
    docBefore,
    { timeout: 8000 }
  );
  const docAfterRight = await activeDoc();
  if (docAfterRight !== expectedNeighbour) {
    fail(`ArrowRight should activate ${expectedNeighbour}, the strip activated ${docAfterRight}`);
  }
  if (await page.locator(tid('ide-case-lab')).count() !== 0) {
    fail(`the tab strip says ${docAfterRight} is active but the Case Lab is still rendered — the tab moved, the document did not`);
  }
  await page.keyboard.press('ArrowLeft');
  await page.waitForSelector(tid('ide-case-lab'), { timeout: 10000 });
  const docBack = await activeDoc();
  if (docBack !== docBefore) fail(`ArrowLeft should return to ${docBefore}, the strip shows ${docBack}`);
  console.log(`${at} ⑧c document tabs: Tab reached ${docBefore} in ${tabWalk.hops} hops; ArrowRight activated ${docAfterRight} (Case Lab gone) and ArrowLeft brought it back`);

  // ⑧d Case Lab: follow a signal by key, move in the grid by key, edit an expectation by
  // key — and read the CANONICAL DOCUMENT afterwards, not the cell that was typed into.
  const followedBefore = await page.evaluate(() =>
    document.querySelector('[data-testid^="ide-case-lab-col-"][aria-current="true"]')?.getAttribute('data-testid') ?? null);
  // Follow a lane the workbench is NOT already following, so Enter has something to change.
  const alreadyFollowing = followedBefore ? followedBefore.replace('ide-case-lab-col-', '') : null;
  const outputLane = await page.evaluate((current) =>
    Array.from(document.querySelectorAll('[data-testid^="ide-verify-signal-"]'))
      .map((el) => el.getAttribute('data-testid'))
      .find((id) =>
        /^ide-verify-signal-ld\d/.test(id ?? '') &&
        !/-up-|-down-/.test(id ?? '') &&
        (current === null || !(id ?? '').startsWith(`ide-verify-signal-${current}`))) ?? null,
    alreadyFollowing);
  if (!outputLane) fail('no unfollowed output signal lane was offered in Simulate, so nothing can be followed by key');
  await page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.focus(), outputLane);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (previous) => {
      const now = document.querySelector('[data-testid^="ide-case-lab-col-"][aria-current="true"]')?.getAttribute('data-testid') ?? null;
      return now !== null && now !== previous;
    },
    followedBefore,
    { timeout: 8000 }
  );
  const followedAfter = await page.evaluate(() =>
    document.querySelector('[data-testid^="ide-case-lab-col-"][aria-current="true"]')?.getAttribute('data-testid') ?? null);
  const followedField = followedAfter.replace('ide-case-lab-col-', '');
  const gridWalk = await tabUntil(page, 'ide-case-lab-failures-only', (id) => id === 'ide-case-lab-table', 40);
  if (!gridWalk.reached) fail(`the Case Lab grid was not reachable by Tab within ${gridWalk.hops} hops`);
  const selectedCase = () => page.evaluate(() => {
    const row = document.querySelector('.ide-case-lab-row.is-selected');
    const id = row?.getAttribute('data-testid') ?? null;
    return id ? Number(id.replace('ide-case-lab-row-', '')) : null;
  });
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.querySelector('.ide-case-lab-row.is-selected') !== null, undefined, { timeout: 8000 });
  const firstCase = await selectedCase();
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(
    (previous) => {
      const row = document.querySelector('.ide-case-lab-row.is-selected');
      const id = row?.getAttribute('data-testid') ?? null;
      return id !== null && Number(id.replace('ide-case-lab-row-', '')) !== previous;
    },
    firstCase,
    { timeout: 8000 }
  );
  const editCase = await selectedCase();
  if (editCase === null || editCase === firstCase) {
    fail(`ArrowDown did not move the Case Lab selection (still case ${firstCase})`);
  }
  const originalExpected = await authoredExpected(page, editCase, followedField);
  for (const key of ['0', '1']) {
    await page.keyboard.press(key);
    await page.waitForFunction(
      ({ tick, field, want }) => {
        const state = window.__RB_PROJECT_RUNTIME__.getState();
        const vectors = [...(state.projectVectors ?? []), ...(state.customVectors ?? [])];
        const value = vectors.find((vector) => vector.tick === tick)?.expected?.[field];
        return value !== undefined && value !== null && String(value) === want;
      },
      { tick: editCase, field: followedField, want: key },
      { timeout: 8000 }
    ).catch(() => {});
    const written = await authoredExpected(page, editCase, followedField);
    if (written !== key) {
      fail(`pressing "${key}" on case ${editCase} should write ${followedField}=${key} into the project document; it holds ${written}`);
    }
  }
  if (originalExpected === null) await page.keyboard.press('Backspace');
  else if (originalExpected !== '1') await page.keyboard.press(originalExpected);
  await page.waitForTimeout(300);
  const restored = await authoredExpected(page, editCase, followedField);
  if (restored !== originalExpected) {
    fail(`the journey must leave the document as it found it: ${followedField} on case ${editCase} was ${originalExpected}, is now ${restored}`);
  }
  console.log(`${at} ⑧d Case Lab: Enter followed ${followedField} (column ${followedBefore} → ${followedAfter}), Tab reached the grid in ${gridWalk.hops} hops, ArrowDown moved case ${firstCase} → ${editCase}, and "0"/"1" wrote through to the project document (restored to ${restored})`);

  // ⑧e The application menubar: open, move, activate, Escape — all without a mouse.
  const themeSetting = () => page.evaluate(() => document.documentElement.getAttribute('data-rb-theme-setting'));
  const themeBefore = await themeSetting();
  const menuWalk = await tabUntil(page, 'ide-topbar-project-rename', (id) => id === 'ide-menu-view', 12);
  if (!menuWalk.reached) fail(`the View menu was not reachable by Tab within ${menuWalk.hops} hops from the project title`);
  await page.keyboard.press('ArrowDown');
  await page.waitForSelector(tid('ide-menu-view-popup'), { timeout: 8000 });
  const menuItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="ide-menu-view-popup"] [role="menuitemcheckbox"]'))
      .map((el) => el.getAttribute('data-testid')));
  const wantedTheme = themeBefore === 'dark' ? 'ide-menu-item-theme.light' : 'ide-menu-item-theme.dark';
  const themeIndex = menuItems.indexOf(wantedTheme);
  if (themeIndex < 0) fail(`the View menu offers no ${wantedTheme}; it lists ${menuItems.join(', ')}`);
  for (let step = 0; step < themeIndex; step += 1) await page.keyboard.press('ArrowDown');
  const activeItem = await focusedTestId(page);
  if (activeItem !== wantedTheme) {
    fail(`${themeIndex} ArrowDown presses should land on ${wantedTheme}; the menu is on ${activeItem}`);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (previous) => document.documentElement.getAttribute('data-rb-theme-setting') !== previous,
    themeBefore,
    { timeout: 8000 }
  );
  const themeAfter = await themeSetting();
  if (themeAfter === themeBefore) fail(`Enter on ${wantedTheme} changed nothing (theme still ${themeBefore})`);
  if (await page.locator(tid('ide-menu-view-popup')).count() !== 0) fail('activating a menu item left the menu open');
  const focusAfterActivate = await page.evaluate(() => {
    const el = document.activeElement;
    return !el || el === document.body || el === document.documentElement ? null : (el.getAttribute('data-testid') ?? el.tagName);
  });
  if (focusAfterActivate === null) {
    cannotProve('menu-activation-focus-return',
      'running a menu item by Enter closed the menu and dropped focus to <body> rather than back onto the menu button.');
  }
  // Escape: the menu closes and focus DOES come back here.
  await page.evaluate(() => document.querySelector('[data-testid="ide-menu-view"]')?.focus());
  await page.keyboard.press('ArrowDown');
  await page.waitForSelector(tid('ide-menu-view-popup'), { timeout: 8000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-menu-view-popup"]') === null,
    undefined,
    { timeout: 8000 }
  );
  const focusAfterMenuEscape = await focusedTestId(page);
  if (focusAfterMenuEscape !== 'ide-menu-view') {
    fail(`Escape from the View menu should return focus to the menu button, focus is on ${focusAfterMenuEscape}`);
  }
  // Put the theme back the way it was, again from the keyboard.
  await page.keyboard.press('ArrowDown');
  await page.waitForSelector(tid('ide-menu-view-popup'), { timeout: 8000 });
  const restoreItems = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="ide-menu-view-popup"] [role="menuitemcheckbox"]'))
      .map((el) => el.getAttribute('data-testid')));
  const restoreIndex = restoreItems.indexOf(`ide-menu-item-theme.${themeBefore}`);
  if (restoreIndex < 0) fail(`the View menu cannot restore theme "${themeBefore}"`);
  for (let step = 0; step < restoreIndex; step += 1) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (want) => document.documentElement.getAttribute('data-rb-theme-setting') === want,
    themeBefore,
    { timeout: 8000 }
  );
  console.log(`${at} ⑧e menubar: Tab reached View in ${menuWalk.hops} hops, ArrowDown opened it, ${themeIndex}×ArrowDown + Enter switched the theme ${themeBefore} → ${themeAfter}, Escape closed the menu and returned focus to the button, and the theme was restored by key`);

  // ⑨ REDUCED MOTION DURING A REAL REPLAY.
  await page.waitForSelector(tid('ide-vcb-run'), { timeout: 10000 });
  const runsBefore = await page.evaluate(() => (window.__RB_PROJECT_RUNTIME__?.getState?.().verifyRunHistory ?? []).length);
  await page.click(tid('ide-vcb-run'));
  await page.waitForFunction(
    (previous) => {
      const history = window.__RB_PROJECT_RUNTIME__?.getState?.().verifyRunHistory ?? [];
      const last = history[history.length - 1];
      return history.length > previous && Boolean(last) && (last.status === 'pass' || last.status === 'fail');
    },
    runsBefore,
    { timeout: 30000 }
  );
  await page.waitForSelector(tid('ide-verify-playback'), { timeout: 15000 });
  if (!(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches))) {
    fail('the context was created with reducedMotion: reduce but the page does not report the preference');
  }
  const tickText = () => page.evaluate(() =>
    document.querySelector('[data-testid="ide-verify-selected-tick"]')?.textContent?.trim() ?? null);
  const tickBeforePlay = await tickText();
  if (!tickBeforePlay || !/t\d+/.test(tickBeforePlay)) {
    fail(`the replay position must be readable as text; the readout says "${tickBeforePlay}"`);
  }
  await page.click(tid('ide-verify-play'));
  await page.waitForFunction(
    (previous) => (document.querySelector('[data-testid="ide-verify-selected-tick"]')?.textContent?.trim() ?? null) !== previous,
    tickBeforePlay,
    { timeout: 15000 }
  );
  if ((await page.locator(tid('ide-verify-play')).getAttribute('aria-pressed')) === null) {
    cannotProve('play-toggle-aria-pressed',
      'the replay toggle advertises no aria-pressed while playing; only its visible label ("■ Stop") says the replay is running.');
  }
  const playingLabel = ((await page.locator(tid('ide-verify-play')).textContent()) ?? '').trim();
  if (!/stop/i.test(playingLabel)) fail(`while replaying, the transport should offer Stop; it reads "${playingLabel}"`);
  // Motion, measured where it actually happens: the replay instrument.
  const motion = await page.evaluate((instrumentIds) => {
    const seconds = (value) => {
      const parts = String(value).split(',').map((part) => {
        const token = part.trim();
        if (token.endsWith('ms')) return Number.parseFloat(token) / 1000;
        if (token.endsWith('s')) return Number.parseFloat(token);
        return 0;
      }).filter((n) => Number.isFinite(n));
      return parts.length === 0 ? 0 : Math.max(...parts);
    };
    const describe = (el) => el.getAttribute('data-testid') ?? `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim().split(/\s+/).slice(0, 2).join('.')}`;
    const root = document.querySelector('.ide-root') ?? document.body;
    const instrument = instrumentIds
      .map((id) => document.querySelector(`[data-testid="${id}"]`))
      .filter((node) => node !== null);
    const inInstrument = (el) => instrument.some((node) => node === el || node.contains(el));
    let instrumentMax = 0;
    let instrumentWorst = null;
    let animationMax = 0;
    let animationWorst = null;
    let instrumentCount = 0;
    // A control that eases its own hover/press is a different thing from a surface that
    // moves as the replay advances. Both are measured; only the second is excusable.
    const buttonOffenders = [];
    const otherOffenders = [];
    for (const el of root.querySelectorAll('*')) {
      const style = getComputedStyle(el);
      const transition = seconds(style.transitionDuration);
      const animation = seconds(style.animationDuration);
      if (animation > animationMax) { animationMax = animation; animationWorst = describe(el); }
      if (inInstrument(el)) {
        instrumentCount += 1;
        if (transition > instrumentMax) { instrumentMax = transition; instrumentWorst = describe(el); }
      }
      if (transition > 0.05) {
        const entry = `${describe(el)} (${transition}s)`;
        if (el.classList.contains('ide-button')) buttonOffenders.push(entry);
        else otherOffenders.push(entry);
      }
    }
    const progress = document.querySelector('.rb-wave-readout__progress > span');
    return {
      instrumentCount,
      instrumentMax,
      instrumentWorst,
      animationMax,
      animationWorst,
      buttonOffenders,
      otherOffenders,
      progressTransition: progress ? getComputedStyle(progress).transitionDuration : null,
    };
  }, ['ide-verify-waveform-svg', 'ide-verify-live-readout']);
  // The strict region is everything that CARRIES REPLAY STATE — the waveform lanes and the
  // live readout. Those are the surfaces that change as the replay advances, so those are
  // the ones that must not move. The transport's own buttons are affordances, not state.
  if (motion.instrumentCount < 10) {
    fail(`the replay instrument was not on screen to measure (only ${motion.instrumentCount} elements matched)`);
  }
  if (motion.instrumentMax > 0.05) {
    fail(`reduced motion is not honoured where the replay carries its state: ${motion.instrumentWorst} transitions for ${motion.instrumentMax}s`);
  }
  if (motion.animationMax > 0.05) {
    fail(`an element keeps a ${motion.animationMax}s animation under prefers-reduced-motion: ${motion.animationWorst}`);
  }
  if (motion.progressTransition === null) {
    fail('the replay progress indicator was not found, so its motion could not be measured');
  }
  if (motion.otherOffenders.length > 0) {
    fail(`prefers-reduced-motion is escaped by something that is not a button affordance: ${motion.otherOffenders.slice(0, 6).join(', ')}`);
  }
  if (motion.buttonOffenders.length > 0) {
    cannotProve('reduced-motion-not-universal',
      `${motion.buttonOffenders.length} .ide-button hover/press affordance(s) keep a >50ms transition under prefers-reduced-motion — including the replay transport itself: ${motion.buttonOffenders.slice(0, 6).join(', ')}.`);
  }
  // Stop, settle, and read the position and the values as text/attributes.
  await page.click(tid('ide-verify-play'));
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="ide-verify-play"]');
      return Boolean(el) && /play/i.test(el.textContent ?? '');
    },
    undefined,
    { timeout: 10000 }
  );
  const settled = await tickText();
  await page.waitForTimeout(600);
  if ((await tickText()) !== settled) fail('the replay kept moving after Stop, so nothing can be read at a known position');
  const replay = await page.evaluate(() => {
    const tick = Number(/t(\d+)/.exec(document.querySelector('[data-testid="ide-verify-selected-tick"]')?.textContent ?? '')?.[1] ?? NaN);
    const lanes = Array.from(document.querySelectorAll('[data-testid^="ide-verify-lane-value-"]')).map((el) => ({
      value: el.getAttribute('data-value'),
      title: el.querySelector('title')?.textContent ?? '',
    }));
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    const vectors = [...(state.projectVectors ?? []), ...(state.customVectors ?? [])];
    return {
      tick,
      lanes,
      readout: document.querySelector('[data-testid="ide-verify-live-readout"]')?.textContent ?? '',
      outputs: document.querySelector('[data-testid="ide-verify-live-outputs"]')?.textContent ?? '',
      inputs: vectors.find((vector) => vector.tick === tick)?.inputs ?? null,
    };
  });
  if (!Number.isFinite(replay.tick)) fail(`the stopped replay position is not readable as a number ("${settled}")`);
  if (!replay.inputs) fail(`no authored case carries tick ${replay.tick}, so the replayed values cannot be judged`);
  if (replay.lanes.length === 0) fail('the waveform exposes no per-lane value at the cursor');
  if (!/=/.test(replay.outputs)) fail(`the live readout carries no NAME=VALUE text: "${replay.outputs.slice(0, 120)}"`);
  // The independent authority is the full-adder truth table over the AUTHORED case inputs —
  // not the run report, and not the panel being read.
  const bits = Object.keys(replay.inputs).sort().map((key) => Number(replay.inputs[key]) & 1);
  if (bits.length !== 3) fail(`case ${replay.tick} should carry three inputs, it carries ${bits.length}`);
  const truth = {
    sum: String(bits[0] ^ bits[1] ^ bits[2]),
    carry: String(bits[0] + bits[1] + bits[2] >= 2 ? 1 : 0),
  };
  const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  let checked = 0;
  for (const lane of replay.lanes) {
    const name = normalize(lane.title.split(' = ')[0] ?? '');
    const want = name.startsWith('ld1') ? truth.sum : name.startsWith('ld0') ? truth.carry : null;
    if (want === null) continue;
    checked += 1;
    if (lane.value !== want) {
      fail(`at t${replay.tick} (A=${bits[0]} B=${bits[1]} CIN=${bits[2]}) the truth table gives ${want}; the waveform lane "${lane.title}" carries data-value="${lane.value}"`);
    }
    if (!lane.title.includes(`= ${want}`)) {
      fail(`the lane's own text must state the value: "${lane.title}" does not read "= ${want}"`);
    }
    if (!replay.outputs.includes(`=${want}`)) {
      fail(`the live readout must state ${want} in text at t${replay.tick}: "${replay.outputs.slice(0, 160)}"`);
    }
  }
  if (checked < 2) fail(`only ${checked} output lane(s) could be judged against the truth table; expected both SUM and CARRY`);
  if (!/RECORDED|REPLAYING|RUNNING/i.test(replay.readout)) {
    fail(`the replay must say in words what it is showing; the readout reads "${replay.readout.slice(0, 120)}"`);
  }
  console.log(`${at} ⑨ replay under reduced motion: position "${settled}" and ${checked} output values readable as text and data-value (SUM=${truth.sum} CARRY=${truth.carry} from the truth table); the ${motion.instrumentCount} elements carrying replay state transition ≤ ${motion.instrumentMax}s, nothing in the workbench animates above ${motion.animationMax}s, progress indicator ${motion.progressTransition}`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  const surprises = unproven.filter((id) => !KNOWN_UNPROVEN.has(id));
  if (surprises.length > 0) {
    fail(`new unproven item(s) this build did not have before: ${surprises.join(', ')} — name and explain them in KNOWN_UNPROVEN or fix the product`);
  }
  for (const [id, detail] of KNOWN_UNPROVEN) {
    if (!unproven.includes(id)) console.log(`${at} NOW PROVEN — ${id}: ${detail}`);
  }
  await context.close();
  console.log(`${at} PASS (${unproven.length} unproven item(s) named above)`);
  return unproven;
}

const wide = await run(1440, 900);
const narrow = await run(1366, 768);
await browser.close();
const stillUnproven = [...new Set([...wide, ...narrow])];
console.log(
  '\nPASS — at 1440×900 and 1366×768, on the Full Adder lab loaded through the Start Center ' +
  'with no store writes: one main landmark; a 500-signal VCD bounded with an honest hint; a ' +
  'signal past the cap reachable and pinnable through the filter; a control reached by Tab ' +
  'and operated by Space with the state change asserted; no document overflow at full or ' +
  'half width under reduced motion; text at 200% leaving the filter operable; a 260-signal ' +
  'moving VCD whose past-the-cap 4-bit bus is found, pinned, read at five times, stepped ' +
  'across a transition by key and re-radixed with every value matching the .vcd itself; five ' +
  'further keyboard operations each proven by a state change (palette Ctrl+K/ArrowDown/Enter ' +
  'opening Board & Constraints, Escape closing it with the workspace byte-identical, ' +
  'ArrowRight/ArrowLeft changing the active document, Enter+ArrowDown+"0"/"1" writing an ' +
  'expectation into the project document from the Case Lab grid, and the View menu opened, ' +
  'walked, activated and Escaped); and a real replay whose position and output values are ' +
  'readable as text and attributes — checked against the full-adder truth table — while ' +
  'everything that carries replay state stays below 50ms of motion.\n' +
  'NOT proven here: real browser zoom, screen-reader output, colour contrast, focus order ' +
  'across every surface, or performance.\n' +
  (stillUnproven.length === 0
    ? 'Every keyboard claim above was provable.'
    : `Explicitly UNPROVEN in this build:\n${stillUnproven.map((id) => `  - ${id}: ${KNOWN_UNPROVEN.get(id)}`).join('\n')}`)
);
