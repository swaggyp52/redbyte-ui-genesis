#!/usr/bin/env node

/**
 * Meridian counter slice gate (P1). One persistent sheet and synchronized lenses over one
 * Moment, on the shipped 2-Bit Up Counter, in a fresh browser context.
 *
 * What it proves (each with an assertion):
 *  - the studio entry is isolated from the workbench cascade (no ide-root rules, no Tailwind);
 *  - Edit lights nothing; Explore lights live values and applies (and counts) clock edges;
 *  - Run (Ctrl+Enter) creates a recording through the existing worker, and that recording has
 *    the same RunIdentity and output digest as classic Simulate's Run of the same project;
 *  - at t3 the sheet, Time lens, state windows, inspector, Logic, Source and Board agree with
 *    the retained recording (Q1=1, Q0=0, LD1 lit, LD0 hollow);
 *  - the inspector explains Q1 from recorded facts (t2 value, the edge, D, the stored change);
 *  - the Time lens draws Q1 and the LEDs changing at the rising edge and EN at the tick start;
 *  - one click reaches the clock edge that set Q1: the meridian stands on the edge, Q1 is still
 *    0 with its capture pending, every view agrees, and Back returns to where the student was;
 *  - the board draws RST on the centre button (BTNC · U18) with its label clear of the others;
 *  - the sheet is one DOM node across Design / Simulate / Board; the zoom is unchanged and the
 *    world point at the centre of the view stays put while a lens opens;
 *  - a move keeps recorded values, a rewire withdraws them, undo repaints them with a chip and
 *    the run status says the checks are not current; Run again is one click;
 *  - a failing expectation opens the recording at its tick and names its output on its lane;
 *  - an unconnected input is drawn as "read as 0", not as an observed 0 (and not at all in Edit);
 *  - a combinational loop (a Design issue) turns checks off for the Run, as Simulate does;
 *  - a link to another example never replaces the working session, and a reload keeps it;
 *  - focus is a solid contour, never dashes; lenses and ticks are reachable with the mouse;
 *  - Fit travels with full motion and jumps once under reduced motion, where every net carries
 *    the same value at t3; three viewports keep the root in bounds.
 *
 * Fixture boundary: the studio has no case editor or label editor in P1, so three edits use the
 * runtime's own authoring paths: one changed expectation and a 40-vector scenario (setVectors),
 * and a longer part label (applyCircuitMutation, which keeps the design identity). Everything
 * else uses the studio's controls. Simulation evidence only; no Vivado, programming or board
 * observation.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, clickVerifyRun, ensureVerifyVectorsReady, runIdeGate, setVerifyRunMode } from './_gateHarness.mjs';

const OUT = process.env.RB_MERIDIAN_OUT ? path.resolve(process.env.RB_MERIDIAN_OUT)
  : path.join(process.cwd(), '.redbyte', 'meridian', 'gate');
await mkdir(OUT, { recursive: true });

const STUDIO = (base, stage = 'design', extra = '') => `${base}/?studio=meridian&example=two-bit-counter&stage=${stage}${extra}`;

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function allNetValues(page) {
  return page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-net-id]')]
    .map((net) => [net.getAttribute('data-net-id'), net.getAttribute('data-value')])));
}
/** Zoom in with the wheel, then press F (Fit) and record each distinct world transform over ~24 frames. */
async function fitTravel(page) {
  const sheet = await page.getByTestId('meridian-sheet').boundingBox();
  await page.mouse.move(sheet.x + sheet.width / 2, sheet.y + sheet.height / 2);
  await page.mouse.wheel(0, -240);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(150);
  return page.evaluate(async () => {
    const world = document.querySelector('[data-testid="meridian-sheet"] [data-layer="world"]');
    const seen = [world.getAttribute('transform')];
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    for (let i = 0; i < 24; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const transform = world.getAttribute('transform');
      if (transform !== seen[seen.length - 1]) seen.push(transform);
    }
    return { distinct: seen.length, start: seen[0], end: seen[seen.length - 1] };
  });
}
async function netValue(page, netId) {
  return page.locator(`[data-net-id="${netId}"]`).getAttribute('data-value');
}
async function moment(page) {
  return (await page.getByTestId('meridian-moment').innerText()).trim();
}
async function valueState(page) {
  return page.getByTestId('meridian-title-block').getAttribute('data-value-state');
}
async function readRun(page) {
  return page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun ?? null);
}
async function waitForRun(page, previousRunId, status = /checks (passed|failed)/) {
  await page.waitForFunction(({ previous, source }) => {
    const text = document.querySelector('[data-testid="meridian-run-status"]')?.textContent ?? '';
    const run = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun;
    return new RegExp(source).test(text) && run && run.runId !== previous;
  }, { previous: previousRunId ?? null, source: status.source }, { timeout: 30000 });
}
async function seekTick(page, tick) {
  for (let i = 0; i < 12; i += 1) {
    const current = Number(await page.getByTestId('meridian-time').getAttribute('data-tick'));
    if (current === tick) return;
    await page.keyboard.press(current < tick ? 'ArrowRight' : 'ArrowLeft');
  }
  throw new Error(`could not seek to t${tick}`);
}
async function sheetIdentity(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-testid="meridian-sheet"]');
    if (!window.__meridianSheet) window.__meridianSheet = sheet;
    // The world point at the centre of the view (camera matrix(z 0 0 z x y)).
    const [zoom, , , , x, y] = (sheet.querySelector('[data-layer="world"]')?.getAttribute('transform') ?? '').match(/-?[\d.]+(e-?\d+)?/g)?.map(Number) ?? [];
    const rect = sheet.getBoundingClientRect();
    const centre = zoom ? { x: Math.round((rect.width / 2 - x) / zoom), y: Math.round((rect.height / 2 - y) / zoom) } : null;
    return { same: window.__meridianSheet === sheet, zoom: document.querySelector('[data-testid="meridian-zoom"]')?.textContent ?? '', centre };
  });
}
/** The trace colour on one lane at a fraction of one tick, on the logic-1 or logic-0 line. */
async function lanePixel(page, laneLabel, tick, fraction, level) {
  return page.evaluate(({ laneLabel, tick, fraction, level }) => {
    const labels = [...document.querySelectorAll('[data-testid="meridian-time"] .mrd-time-label')];
    const laneIndex = labels.findIndex((node) => node.firstChild?.textContent?.trim() === laneLabel);
    const canvas = document.querySelector('[data-testid="meridian-time-canvas"]');
    const ticks = [...document.querySelectorAll('[data-testid="meridian-time"] .mrd-time-tick')];
    const tickButton = document.querySelector(`[data-testid="meridian-tick-${tick}"]`);
    const tickIndex = ticks.indexOf(tickButton);
    const tickWidth = tickButton.getBoundingClientRect().width;
    const x = tickIndex * tickWidth + fraction * tickWidth;
    const y = laneIndex * 30 + (level === 1 ? 8 : 22);
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const ctx = canvas.getContext('2d');
    let best = [0, 0, 0, 0];
    for (const dy of [-1, 0, 1]) {
      const data = ctx.getImageData(Math.round(x * scale), Math.round((y + dy) * scale), 1, 1).data;
      if (data[3] > best[3]) best = [...data];
    }
    return { laneIndex, tickIndex, rgba: best };
  }, { laneLabel, tick, fraction, level });
}
const isBlue = (rgba) => rgba[3] > 0 && rgba[2] > 140 && rgba[0] < 70;
const isGrey = (rgba) => rgba[3] > 0 && Math.abs(rgba[0] - 125) < 30 && Math.abs(rgba[1] - 131) < 30 && Math.abs(rgba[2] - 140) < 30;
const overlaps = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
async function rects(page, selector) {
  return page.evaluate((query) => [...document.querySelectorAll(query)].map((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, text: node.textContent?.trim() ?? '' };
  }), selector);
}
function findEvent(run, nodeId, tick, phase, evaluationPhase) {
  const event = run.evaluationTrace.events.find((e) => e.nodeId === nodeId && e.context.tick === tick
    && e.context.phase === phase && e.evaluationPhase === evaluationPhase);
  assert(event, `Recording lacks ${nodeId} at t${tick}, ${phase}/${evaluationPhase}`);
  return event;
}
function assertCounterRecording(run) {
  assert(run.schedule === 'clocked_macro', `Counter must retain the clocked_macro schedule, got ${run.schedule}`);
  assert(run.evaluationTrace?.status === 'complete', `Counter capture must be complete, got ${run.evaluationTrace?.status ?? 'absent'}`);
  assert(run.report.rows.length === 14, `Counter must retain 14 checks, got ${run.report.rows.length}`);
  assert(run.report.rows.every((row) => row.expected === row.actual), 'Every shipped counter check must agree with its actual result');
  assert(run.generatedSource?.files?.length > 0, 'The recording must retain its generated source');
}

const receipt = {
  gate: 'ide-meridian-counter-slice', generatedAtIso: new Date().toISOString(),
  proofBoundary: 'Fresh isolated Playwright contexts; CSS-pixel viewports (emulation, not real browser zoom); logical simulation only',
  checks: [], timings: {}, browserProblems: [], parity: null,
};
const check = (label, condition, detail) => {
  receipt.checks.push({ label, pass: Boolean(condition), ...(detail === undefined ? {} : { detail }) });
  assert(condition, `${label}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
};

await runIdeGate('IDE Meridian counter slice', async ({ page, baseUrl }) => {
  const problems = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(STUDIO(baseUrl), { waitUntil: 'domcontentloaded' });
    await page.getByTestId('meridian-sheet').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(300);

    // ── Isolation ──
    const isolation = await page.evaluate(() => {
      const texts = [...document.styleSheets].flatMap((sheet) => {
        try { return [...sheet.cssRules].map((rule) => rule.cssText); } catch { return []; }
      });
      return {
        mode: document.documentElement.dataset.redbyteMode,
        legacyRules: texts.filter((text) => /\.ide-root|\.ide-workbench-shell|\.wb-toolbar/.test(text)).length,
        tailwind: texts.filter((text) => /--tw-/.test(text)).length,
        studioRules: texts.filter((text) => /\[data-rb-studio\]/.test(text)).length,
      };
    });
    check('studio entry marks the document as studio', isolation.mode === 'studio', isolation);
    check('no workbench cascade rule reaches the studio', isolation.legacyRules === 0, isolation);
    check('no Tailwind preflight reaches the studio', isolation.tailwind === 0, isolation);
    check('the Meridian token sheet is the visual authority', isolation.studioRules > 20, isolation);

    // ── Edit: no Moment, no light ──
    check('Edit lights nothing', /Editing · nothing lit/.test(await moment(page)) && (await valueState(page)) === 'none');
    check('no net carries a value while editing', await page.locator('[data-net-id][data-value]').count() === 0);
    const margins = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-margin-pin]')]
      .map((node) => [node.getAttribute('data-margin-pin'), node.textContent.trim()])));
    check('margin labels print the board resource only where it differs from the port name, plus the pin',
      margins.LD0 === 'pin U16' && margins.LD1 === 'pin E19' && margins.CLK100MHZ === 'pin W5' && margins.SW0 === 'SW0 · V17' && margins.BTNC === 'BTNC · U18', margins);
    const editPressed = await page.evaluate(() => {
      const edit = getComputedStyle(document.querySelector('[data-testid="meridian-mode-edit"]')).backgroundColor;
      const run = getComputedStyle(document.querySelector('[data-testid="meridian-run"]')).backgroundColor;
      const solid = [...document.querySelectorAll('[data-rb-studio] .mrd-btn')].filter((button) => getComputedStyle(button).backgroundColor === run).map((button) => button.textContent.trim());
      return { edit, run, solid };
    });
    check('only Run is a solid ink block (a pressed toggle is quiet)', editPressed.edit !== editPressed.run && editPressed.solid.length === 1 && /^Run/.test(editPressed.solid[0]), editPressed);
    const rail = await page.evaluate(() => [...document.querySelectorAll('a.mrd-rail-item')].map((link) => ({ href: link.getAttribute('href'), key: Boolean(link.querySelector('.mrd-rail-key')), text: link.textContent.trim() })));
    check('Project and Package read as links out of the studio, not stages', rail.filter((link) => /mode=(project|export)/.test(link.href)).every((link) => !link.key && link.text.endsWith('↗')), rail);
    await page.locator('[data-sheet-node="q1_ff"]').click();
    check('selecting Q1 shows one selection ring and the inspector', await page.locator('[data-selection-ring="q1_ff"]').count() === 1
      && await page.getByTestId('meridian-inspector').getAttribute('data-node-id') === 'q1_ff');
    const editInspector = await page.getByTestId('meridian-inspector').innerText();
    check('Edit inspector: student kind name, pin names, no dash column, says Edit shows no values',
      (await page.getByTestId('meridian-inspector-kind').innerText()).startsWith('D flip-flop') && !editInspector.includes('—') && /Edit shows no values/.test(editInspector), editInspector);
    const layering = await page.evaluate(() => {
      const layers = [...document.querySelectorAll('[data-testid="meridian-sheet"] [data-layer]')].map((node) => node.getAttribute('data-layer'));
      return { layers, ring: document.querySelector('[data-selection-ring]')?.closest('[data-layer]')?.getAttribute('data-layer') };
    });
    check('the selection ring lies under the wires (selection layer before nets)', layering.ring === 'selection' && layering.layers.indexOf('selection') < layering.layers.indexOf('nets'), layering);
    // A label crosses a ring when it straddles the ring's edge: inside the body is fine, outside is fine.
    const inside = (inner, outer) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;
    const crosses = (ring, label) => overlaps(ring, label) && !inside(label, ring);
    for (const nodeId of ['en_node', 'xor1', 'q1_ff']) {
      await page.locator(`[data-sheet-node="${nodeId}"]`).click();
      const rings = await rects(page, '[data-selection-ring] .mrd-ring-outer, [data-selection-ring] .mrd-ring-inner');
      const labels = await page.evaluate((id) => {
        const sheet = getComputedStyle(document.querySelector('[data-rb-studio]')).getPropertyValue('--mrd-sheet').trim();
        return [...document.querySelectorAll(`[data-sheet-node="${id}"] .mrd-margin-pin, [data-sheet-node="${id}"] .rb-sym-title, [data-sheet-node="${id}"] .rb-sym-type`)].map((node) => {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const probe = document.createElement('span');
          probe.style.color = sheet;
          document.body.appendChild(probe);
          const sheetRgb = getComputedStyle(probe).color;
          probe.remove();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, text: node.textContent.trim(), halo: style.paintOrder.startsWith('stroke') && style.stroke === sheetRgb && parseFloat(style.strokeWidth) >= 2 };
        });
      }, nodeId);
      // A name the ring passes behind is drawn above it on a paper halo (the ring lies in the first layer).
      check(`the selection ring around ${nodeId} hugs its body and never strikes through its names`, rings.length === 2 && labels.length > 0
        && labels.every((label) => label.halo || rings.every((ring) => !crosses(ring, label))), { rings, labels });
    }
    await page.mouse.move(5, 5);
    await page.locator('[data-sheet-node="q1_ff"]').hover();
    const pinDot = await page.evaluate(() => getComputedStyle(document.querySelector('[data-sheet-node="q1_ff"] .rb-sym-pin-dot')).opacity);
    check('Edit: hovering a part shows where its pins are', Number(pinDot) > 0.5, { pinDot });
    const before = await sheetIdentity(page);
    await shot(page, '1440-01-design-select-q1');

    // ── Explore: live values and counted clock edges ──
    await page.keyboard.press('e');
    check('Explore is a live, unrecorded moment', /Exploring · not recorded/.test(await moment(page)));
    await page.locator('[data-sheet-node="en_node"]').click();
    await page.waitForFunction(() => document.querySelector('[data-net-id="en_node.out"]')?.getAttribute('data-value') === '1');
    const q0Before = await netValue(page, 'q0_ff.Q');
    await page.keyboard.press('.');
    await page.waitForFunction(() => document.querySelector('[data-net-id="q0_ff.Q"]')?.getAttribute('data-value') === '1', null, { timeout: 5000 });
    check('one clock edge with EN=1 advances Q0 from 0 to 1 (live)', q0Before === '0' && await netValue(page, 'q0_ff.Q') === '1', { q0Before });
    await page.keyboard.press('.');
    check('Explore confirms how many clock edges were applied', /2 clock edges/.test(await moment(page)), await moment(page));
    const enBefore = await netValue(page, 'en_node.out');
    await page.getByTestId('meridian-toggle-input').click();
    await page.waitForFunction((value) => document.querySelector('[data-net-id="en_node.out"]')?.getAttribute('data-value') !== value, enBefore);
    check('Explore: the selected input toggles from the inspector', await netValue(page, 'en_node.out') !== enBefore, { enBefore });
    await shot(page, '1440-02-explore-clock-edge');
    await page.keyboard.press('e');
    check('leaving Explore returns to no light', await page.locator('[data-net-id][data-value]').count() === 0);
    await page.locator('[data-sheet-node="q1_ff"]').click();

    // ── Simulate: Run through the existing worker ──
    await page.keyboard.press('3');
    await page.getByTestId('meridian-lens-time').waitFor({ state: 'visible' });
    check('Simulate before any run states that Run creates a recording', await page.getByTestId('meridian-time-empty').isVisible()
      && /No recording yet/.test(await moment(page)));
    const runStart = Date.now();
    await page.keyboard.press('Control+Enter');
    await waitForRun(page, null);
    receipt.timings.studioRunToResultMs = Date.now() - runStart;
    const studioRun = await readRun(page);
    assertCounterRecording(studioRun);
    check('Run created a recording that passes all 14 checks', true, { runId: studioRun.runId, engine: studioRun.identity?.engine });
    const identity = { design: studioRun.identity.design, stimulus: studioRun.identity.stimulus, engine: studioRun.identity.engine, outputDigest: studioRun.outputDigest };

    // ── t3 across every perspective ──
    await page.getByTestId('meridian-time').waitFor({ state: 'visible' });
    check('a new recording opens at its first tick', await page.getByTestId('meridian-time').getAttribute('data-tick') === '0');
    await seekTick(page, 3);
    check('sheet at t3: Q1=1, Q0=0 from the recording', await netValue(page, 'q1_ff.Q') === '1' && await netValue(page, 'q0_ff.Q') === '0');
    const valuesAt3 = await allNetValues(page);
    check('register state windows show the retained transitions', (await page.locator('[data-state-window="q1_ff"] text').textContent()).trim() === '0→1'
      && (await page.locator('[data-state-window="q0_ff"] text').textContent()).trim() === '1→0');
    const windowBox = (await rects(page, '[data-state-window="q1_ff"] rect'))[0];
    const bodyBox = (await rects(page, '[data-sheet-node="q1_ff"] .rb-sym-body'))[0];
    const pinNames = await rects(page, '[data-sheet-node="q1_ff"] .rb-sym-pin-name');
    check('the state window is printed inside the register, clear of its pin names', windowBox.left >= bodyBox.left && windowBox.right <= bodyBox.right
      && windowBox.top >= bodyBox.top && windowBox.bottom <= bodyBox.bottom && pinNames.length >= 3 && pinNames.every((pin) => !overlaps(windowBox, pin)), { windowBox, bodyBox, pinNames });
    check('the clock net shows an edge, not a sampled level', await page.locator('[data-net-id="clk_node.out"]').getAttribute('data-clock') === '1'
      && (await page.locator('[data-net-tag="clk_node.out"]').textContent()) === '↑');
    check('inspector reads Q=1 at t3', await page.locator('[data-testid="meridian-inspector"] [data-pin="Q"] td[data-value]').getAttribute('data-value') === '1');
    check('inspector pins are headed by the Moment, and the clock pin shows an edge',
      (await page.getByTestId('meridian-pins-heading').innerText()).toLowerCase() === 'pins at t3'
        && /↑ rose in t3/.test(await page.locator('[data-testid="meridian-inspector"] [data-pin="CLK"]').innerText()));
    const explainedT3 = await page.getByTestId('meridian-explanation').innerText();
    check('the inspector explains Q1 at t3 from recorded facts: t2 value, the edge, D and the stored change',
      /Q1 was 0 at t2 and is 1 at t3/.test(explainedT3) && /At the rising clock edge in t3, Q1 read D = 1/.test(explainedT3)
        && /changed 0 → 1/.test(explainedT3) && !/unavailable|published sample|publication/i.test(explainedT3), explainedT3);
    check('checks at t3 are both passing and the current check is marked', /2 checks passed/.test(await page.getByTestId('meridian-check-3').getAttribute('aria-label'))
      && await page.getByTestId('meridian-check-3').getAttribute('aria-current') === 'true' && await page.getByTestId('meridian-check-2').getAttribute('aria-current') === null);
    check('the meridian stands on t3 at the sample instant', (await page.getByTestId('meridian-cursor').getAttribute('data-label')) === 't3'
      && await page.getByTestId('meridian-cursor').getAttribute('data-at') === '0.5');
    const meridianBox = (await rects(page, '[data-testid="meridian-cursor"]'))[0];
    const checksRow = (await rects(page, '[data-testid="meridian-time"] .mrd-time-checks'))[0];
    check('the meridian stops above the checks row', meridianBox.bottom <= checksRow.top + 0.5, { meridianBox, checksRow });
    const strip = await page.getByTestId('meridian-title-block').innerText();
    check('the title strip carries the Moment once: no run label and no check count', !/r-[0-9a-f]{4}/.test(strip) && !/checks passed/.test(strip), strip);
    // The Time lens draws changes where the recording says they happened.
    const ld1Before = await lanePixel(page, 'LD1', 3, 0.15, 0);
    const ld1BeforeHigh = await lanePixel(page, 'LD1', 3, 0.15, 1);
    const ld1After = await lanePixel(page, 'LD1', 3, 0.5, 1);
    const q1Before = await lanePixel(page, 'Q1', 3, 0.15, 0);
    const q1After = await lanePixel(page, 'Q1', 3, 0.5, 1);
    const enStart = await lanePixel(page, 'EN', 2, 0.15, 1);
    const enBeforeLow = await lanePixel(page, 'EN', 1, 0.85, 0);
    const enBeforeHigh = await lanePixel(page, 'EN', 1, 0.85, 1);
    check('Time lens: LD1 and Q1 are still 0 before t3\'s rising edge and 1 after it', isGrey(ld1Before.rgba) && !isBlue(ld1BeforeHigh.rgba) && isBlue(ld1After.rgba)
      && isGrey(q1Before.rgba) && isBlue(q1After.rgba), { ld1Before, ld1BeforeHigh, ld1After, q1Before, q1After });
    check('Time lens: EN is still 0 at the end of t1 and 1 from the start of t2 (when t2\'s inputs are applied)',
      isGrey(enBeforeLow.rgba) && !isBlue(enBeforeHigh.rgba) && isBlue(enStart.rgba), { enBeforeLow, enBeforeHigh, enStart });
    const laneOrder = await page.evaluate(() => [...document.querySelectorAll('[data-testid="meridian-time"] .mrd-time-label')].map((node) => node.firstChild?.textContent?.trim()));
    check('Time lens: a selected register shows its data input directly above Q', laneOrder.includes('Q1.D') && laneOrder.indexOf('Q1.D') === laneOrder.indexOf('Q1') - 1, laneOrder);
    check('the Time lens covers the whole recording with retained evaluations', await page.getByTestId('meridian-time').getAttribute('data-evaluated') === 'complete');
    const at3 = await sheetIdentity(page);
    check('the sheet is the same DOM node across Design and Simulate, camera unchanged', at3.same && at3.zoom === before.zoom, { before, at3 });
    check('opening the Time lens keeps the world point at the centre of the view', Boolean(before.centre && at3.centre)
      && Math.abs(at3.centre.x - before.centre.x) <= 1 && Math.abs(at3.centre.y - before.centre.y) <= 1, { before: before.centre, at3: at3.centre });
    await shot(page, '1440-03-simulate-t3');

    // ── Causal navigation: the clock edge that set Q1, and back ──
    const capture = findEvent(studioRun, 'q1_ff', 3, 'macro-high-sample', 'capture');
    check('the retained Q1 capture at t3 changes 0 to 1', capture.previousOutputs.Q === 0 && capture.outputs.Q === 1);
    const tickEvents = studioRun.evaluationTrace.events.filter((event) => event.context.tick === 3).sort((a, b) => a.order - b.order);
    const step = tickEvents.findIndex((event) => event.order === capture.order) + 1;
    check('the inspector offers the clock edge that set Q1', (await page.getByTestId('meridian-show-cause').innerText()).trim() === 'Show the clock edge that set Q1');
    await page.getByTestId('meridian-show-cause').click();
    await page.waitForFunction((order) => document.querySelector('[data-testid="meridian-cursor"]')?.getAttribute('data-event-order') === String(order), capture.order);
    check('one click reaches the exact retained Q1 capture', true, { order: capture.order, step, of: tickEvents.length });
    const edgeCursor = await page.evaluate(() => {
      const cursor = document.querySelector('[data-testid="meridian-cursor"]');
      const tick = document.querySelector('[data-testid="meridian-tick-3"]').getBoundingClientRect();
      const track = document.querySelector('[data-testid="meridian-time"] .mrd-time-track').getBoundingClientRect();
      return { at: cursor.getAttribute('data-at'), label: cursor.getAttribute('data-label'), left: parseFloat(cursor.style.left), expected: tick.left - track.left + 0.3 * tick.width };
    });
    check('the meridian stands on t3\'s rising edge, labelled by its step', edgeCursor.at === '0.3' && Math.abs(edgeCursor.left - edgeCursor.expected) <= 1
      && edgeCursor.label === `t3 · ${step}/${tickEvents.length}`, edgeCursor);
    const edgeMoment = await moment(page);
    check('the strip names the position in words', edgeMoment === `t3 · rising clock edge · step ${step} of ${tickEvents.length} · Q1`, edgeMoment);
    check('no global evaluation ordinal is shown to the student', !(await page.locator('body').innerText()).match(new RegExp(`\\be${capture.order}\\b|evaluation ${capture.order}`)));
    check('at the edge Q1 still shows 0 and its state window shows the capture pending', await netValue(page, 'q1_ff.Q') === '0'
      && (await page.locator('[data-state-window="q1_ff"] text').textContent()).trim() === '0→1…'
      && await page.locator('[data-state-window="q1_ff"]').getAttribute('data-pending') === '1');
    const edgeInspector = await page.getByTestId('meridian-inspector').innerText();
    check('the inspector explains the capture: D = 1 at the edge, 0 → 1, Q pending until the shared commit',
      /reads D = 1/.test(edgeInspector) && /captures 1: its stored value changes 0 → 1/.test(edgeInspector) && /Q still shows 0/.test(edgeInspector)
        && (await page.locator('[data-testid="meridian-inspector"] [data-pin="Q"] td[data-value]').innerText()).trim() === '0 · becomes 1', edgeInspector);
    await page.keyboard.press('l');
    const edgeRow = await page.evaluate(() => {
      const table = document.querySelector('[data-testid="meridian-truth-table"]');
      const heads = [...table.querySelectorAll('thead th')].map((cell) => cell.textContent.trim());
      const rows = [...table.querySelectorAll('tbody tr[data-current="1"]')];
      const cells = rows.length === 1 ? [...rows[0].querySelectorAll('td')].map((cell) => cell.textContent.trim()) : [];
      return { count: rows.length, row: Object.fromEntries(heads.map((head, index) => [head, cells[index]])) };
    });
    check('the Logic lens marks the values at this edge (Q1=0, Q0=1, EN=1, RST=0 -> Q1 next 1) and names what Q1 captures',
      /values at this clock edge → what Q1 captures/.test(await page.getByTestId('meridian-logic-caption').innerText())
        && edgeRow.count === 1 && edgeRow.row.Q1 === '0' && edgeRow.row.Q0 === '1' && edgeRow.row.EN === '1' && edgeRow.row.RST === '0' && edgeRow.row['Q1 next'] === '1', edgeRow);
    await shot(page, '1440-04-clock-edge-that-set-q1');
    await page.keyboard.press('4');
    await page.getByTestId('meridian-board').waitFor({ state: 'visible' });
    const edgeBoard = await page.evaluate(() => ({
      ld1: document.querySelector('[data-board-resource="LD1"]')?.getAttribute('data-value'),
      legend: document.querySelector('[data-testid="meridian-board-legend"]')?.innerText ?? '',
    }));
    check('the board at the edge agrees with the sheet: LD1 not yet lit', edgeBoard.ld1 === '0' && new RegExp(`step ${step} of ${tickEvents.length}`).test(edgeBoard.legend), edgeBoard);
    await page.getByTestId('meridian-back').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="meridian-moment"]')?.textContent?.trim() === 't3');
    check('Back returns to t3 after the edge, on the same stage, with Q1 still selected', await netValue(page, 'q1_ff.Q') === '1'
      && await page.locator('[data-board-resource="LD1"]').getAttribute('data-value') === '1'
      && await page.getByTestId('meridian-inspector').getAttribute('data-node-id') === 'q1_ff');
    await page.keyboard.press('3');
    // One lens fits at 1440: Logic replaced Time above; T brings the Time lens back on screen.
    if (!(await page.getByTestId('meridian-lens-time').isVisible())) await page.keyboard.press('t');
    await page.getByTestId('meridian-time').waitFor({ state: 'visible' });
    await page.keyboard.press('ArrowRight');
    const explainedT4 = await page.getByTestId('meridian-explanation').innerText();
    check('at t4 the inspector says Q1 kept 1, D settled after the edge, and points back to t3',
      /Q1 was 1 at t3 and is still 1 at t4/.test(explainedT4) && /So it kept 1/.test(explainedT4) && /D settled to 0/.test(explainedT4)
        && (await page.getByTestId('meridian-show-cause').innerText()).trim() === 'Show the clock edge that set Q1 (t3)', explainedT4);
    await page.getByTestId('meridian-show-cause').click();
    await page.waitForFunction((order) => document.querySelector('[data-testid="meridian-cursor"]')?.getAttribute('data-event-order') === String(order), capture.order);
    check('from t4 the cause is the same t3 edge; Back returns to t4', /^Back to t4/.test((await page.getByTestId('meridian-back').innerText()).trim()));
    await page.keyboard.press('Escape');
    check('Esc goes Back first and restores t4, keeping the selection', (await moment(page)) === 't4' && (await page.getByTestId('meridian-cursor').getAttribute('data-label')) === 't4'
      && await page.getByTestId('meridian-inspector').getAttribute('data-node-id') === 'q1_ff');
    await seekTick(page, 3);

    // ── Logic, Source, Board read the same object and moment ──
    await page.keyboard.press('l');
    if (!(await page.getByTestId('meridian-lens-logic').isVisible())) await page.keyboard.press('l');
    const expression = await page.getByTestId('meridian-logic-expression').innerText();
    check('Logic derives the next state of Q1 and explains its operators', /⊕/.test(expression) && /¬RST/.test(expression)
      && /⊕ = XOR/.test(await page.getByTestId('meridian-logic-operators').innerText()), expression);
    // The marked row is the one for t3's recorded values (Q1=1, Q0=0, EN=1, RST=0), and D1 there is 1.
    const logicRow = await page.evaluate(() => {
      const table = document.querySelector('[data-testid="meridian-truth-table"]');
      const heads = [...table.querySelectorAll('thead th')].map((cell) => cell.textContent.trim());
      const rows = [...table.querySelectorAll('tbody tr[data-current="1"]')];
      const cells = rows.length === 1 ? [...rows[0].querySelectorAll('td')].map((cell) => cell.textContent.trim()) : [];
      return { count: rows.length, heads, row: Object.fromEntries(heads.map((head, index) => [head, cells[index]])) };
    });
    check('Logic marks exactly the row of t3 (Q1=1, Q0=0, EN=1, RST=0 -> Q1 next 1)', logicRow.count === 1 && logicRow.heads.at(-1) === 'Q1 next'
      && logicRow.row.Q1 === '1' && logicRow.row.Q0 === '0' && logicRow.row.EN === '1' && logicRow.row.RST === '0' && logicRow.row['Q1 next'] === '1', logicRow);
    check('Logic says which row is marked', /values recorded at t3/.test(await page.getByTestId('meridian-logic-caption').innerText()));
    await shot(page, '1440-05-logic');
    await page.keyboard.press('h');
    const source = page.getByTestId('meridian-source');
    // The lens shows the recording's own top.vhd (its line count, not the live design's), and
    // the marked lines are exactly Q1's recorded span.
    const sourceTruth = await page.evaluate(() => {
      const run = window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun;
      const recorded = run.generatedSource?.files.find((entry) => entry.path === 'top.vhd');
      const spans = (run.generatedSource?.spans ?? []).filter((span) => span.path === 'top.vhd' && span.nodeId === 'q1_ff' && (span.definitionId ?? 'top') === 'top');
      const expected = new Set();
      for (const span of spans) for (let line = span.startLine; line <= span.endLine; line += 1) expected.add(line);
      const shown = document.querySelectorAll('[data-testid="meridian-source"] [data-line]').length;
      const active = [...document.querySelectorAll('[data-testid="meridian-source"] [data-active="1"]')].map((line) => Number(line.getAttribute('data-line')));
      const first = document.querySelector('[data-testid="meridian-source"] [data-active="1"]');
      const second = first?.nextElementSibling;
      return {
        recordedLines: recorded ? recorded.text.split('\n').length : 0,
        shownLines: shown,
        expected: [...expected].sort((a, b) => a - b),
        active: active.sort((a, b) => a - b),
        meta: document.querySelector('[data-testid="meridian-lens-source"] .mrd-lens-meta')?.textContent ?? '',
        firstOwner: first?.querySelector('.mrd-src-owner')?.textContent ?? null,
        secondOwner: second?.querySelector('.mrd-src-owner')?.textContent ?? null,
        tint: first ? getComputedStyle(first).backgroundColor : null,
        panel2: getComputedStyle(document.querySelector('[data-rb-studio]')).getPropertyValue('--mrd-panel-2').trim(),
      };
    });
    check('Source shows the recording\'s retained top.vhd with exactly Q1\'s recorded span marked',
      await source.getAttribute('data-active-node') === 'q1_ff' && await source.getAttribute('data-path') === 'top.vhd'
        && /Q1 = lines \d+–\d+ · as recorded/.test(sourceTruth.meta) && sourceTruth.recordedLines === sourceTruth.shownLines
        && sourceTruth.expected.length > 0 && JSON.stringify(sourceTruth.active) === JSON.stringify(sourceTruth.expected), sourceTruth);
    check('Source names the owning part once in the gutter, and marks it without logic-1 blue', sourceTruth.firstOwner === 'Q1' && sourceTruth.secondOwner === null
      && sourceTruth.tint === 'rgb(241, 240, 236)', sourceTruth);
    await shot(page, '1440-06-source');
    await page.keyboard.press('4');
    await page.getByTestId('meridian-board').waitFor({ state: 'visible' });
    const leds = await page.evaluate(() => ({
      ld1: document.querySelector('[data-board-resource="LD1"]')?.getAttribute('data-value'),
      ld0: document.querySelector('[data-board-resource="LD0"]')?.getAttribute('data-value'),
      sw0: document.querySelector('[data-board-resource="SW0"]')?.getAttribute('data-mapped'),
      btnc: document.querySelector('[data-board-resource="BTNC"]')?.getAttribute('data-mapped'),
      btncPin: document.querySelector('[data-board-resource="BTNC"]')?.getAttribute('data-package-pin'),
      others: [...document.querySelectorAll('[data-board-resource^="BTN"][data-mapped]')].map((node) => node.getAttribute('data-board-resource')),
      ld1Fill: getComputedStyle(document.querySelector('[data-board-resource="LD1"] .mrd-board-led')).fill,
      ld15: getComputedStyle(document.querySelector('[data-board-resource="LD15"]')).opacity,
      ld1Opacity: getComputedStyle(document.querySelector('[data-board-resource="LD1"]')).opacity,
      rings: [...document.querySelectorAll('[data-board-resource] .mrd-board-mapped-ring')].map((node) => node.closest('[data-board-resource]').getAttribute('data-board-resource')),
    }));
    check('Board at t3: LD1 lit, LD0 hollow, SW0 carries EN', leds.ld1 === '1' && leds.ld0 === '0' && leds.sw0 === 'EN', leds);
    check('Board: RST is bound to the centre button BTNC (U18), and only that button is ringed', leds.btnc === 'RST' && leds.btncPin === 'U18'
      && JSON.stringify(leds.others) === '["BTNC"]' && JSON.stringify(leds.rings) === '["BTNC"]', leds);
    const rst = (await rects(page, '[data-board-resource="BTNC"] .mrd-board-mapped-label'))[0];
    const buttons = await page.evaluate(() => Object.fromEntries(['BTNU', 'BTNL', 'BTNR', 'BTND', 'BTNC'].map((alias) => {
      const rect = document.querySelector(`[data-board-resource="${alias}"] .mrd-board-button`).getBoundingClientRect();
      return [alias, { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }];
    })));
    check('Board: the RST label crosses no other pushbutton', rst?.text === 'RST' && ['BTNU', 'BTNL', 'BTNR', 'BTND'].every((alias) => !overlaps(rst, buttons[alias])), { rst, buttons });
    check('Board: the D-pad keeps the physical layout (C centred between U, D, L and R)', buttons.BTNU.bottom <= buttons.BTNC.top && buttons.BTND.top >= buttons.BTNC.bottom
      && buttons.BTNL.right <= buttons.BTNC.left && buttons.BTNR.left >= buttons.BTNC.right, buttons);
    check('Board: a lit LED is unmistakable and unused parts recede', leds.ld1Fill === 'rgb(111, 179, 245)' && Number(leds.ld15) === 0.6 && Number(leds.ld1Opacity) === 1, leds);
    const legend = await page.getByTestId('meridian-board-legend').innerText();
    check('Board states its evidence and names the button binding', /not a board observation/.test(legend) && /RST = centre button \(BTNC · U18\)/.test(legend), legend);
    const atBoard = await sheetIdentity(page);
    check('the sheet persists into Board, camera unchanged', atBoard.same && atBoard.zoom === before.zoom);
    await shot(page, '1440-07-board');
    await page.getByTestId('meridian-next-tick').click();
    check('Board: the tick stepper moves the board to t4 by mouse', /· t4 ·/.test(await page.getByTestId('meridian-board-legend').innerText())
      && await page.locator('[data-board-resource="LD0"]').getAttribute('data-value') === '1');
    await page.getByTestId('meridian-prev-tick').click();
    // Lenses by mouse only: the footer switches lenses and the inspector.
    await page.keyboard.press('3');
    await page.getByTestId('meridian-lens-toggle-logic').click();
    check('mouse: the footer opens the Logic lens', await page.getByTestId('meridian-lens-logic').isVisible()
      && await page.getByTestId('meridian-lens-toggle-logic').getAttribute('aria-pressed') === 'true');
    await page.getByTestId('meridian-lens-toggle-time').click();
    check('mouse: the footer brings the Time lens back', await page.getByTestId('meridian-lens-time').isVisible());
    await page.keyboard.press('i');
    await page.getByTestId('meridian-inspector-toggle').click();
    check('mouse: the footer re-opens the inspector', await page.getByTestId('meridian-work').getAttribute('data-inspector') === 'open');
    const canvasBox = await page.getByTestId('meridian-time-canvas').boundingBox();
    const t5 = await page.getByTestId('meridian-tick-5').boundingBox();
    await page.mouse.click(t5.x + t5.width / 2, canvasBox.y + 10);
    check('mouse: clicking a trace seeks to its tick', await page.getByTestId('meridian-time').getAttribute('data-tick') === '5');
    await seekTick(page, 3);

    // ── Parity with classic Simulate ──
    await page.goto(`${baseUrl}/?mode=verify&e2e=1`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ide-mode-verify').waitFor({ state: 'visible', timeout: 30000 });
    await ensureVerifyVectorsReady(page);
    assert(await setVerifyRunMode(page, 'compare'), 'classic Simulate must offer the saved checks');
    const classicStart = Date.now();
    await clickVerifyRun(page);
    await page.waitForFunction((previous) => {
      const run = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun;
      return run && run.runId !== previous;
    }, studioRun.runId, { timeout: 30000 });
    receipt.timings.classicRunToResultMs = Date.now() - classicStart;
    const classicRun = await readRun(page);
    receipt.parity = { studio: identity, classic: { design: classicRun.identity?.design, stimulus: classicRun.identity?.stimulus, engine: classicRun.identity?.engine, outputDigest: classicRun.outputDigest } };
    check('studio and classic Run share one RunIdentity', identity.design === classicRun.identity?.design
      && identity.stimulus === classicRun.identity?.stimulus && identity.engine === classicRun.identity?.engine, receipt.parity);
    check('studio and classic Run produce the same output digest', identity.outputDigest === classicRun.outputDigest, receipt.parity);

    // ── Back in the studio: editing and staleness ──
    await page.goto(STUDIO(baseUrl, 'design'), { waitUntil: 'domcontentloaded' });
    await page.getByTestId('meridian-sheet').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(300);
    const xor1 = page.locator('[data-sheet-node="xor1"]');
    const origin = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.find((node) => node.id === 'xor1').position);
    const box = await xor1.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 40, { steps: 6 });
    await page.mouse.up();
    const moved = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.find((node) => node.id === 'xor1').position);
    await page.keyboard.press('3');
    await page.getByTestId('meridian-time').waitFor({ state: 'visible' });
    check('a moved gate keeps recorded values on the sheet', (moved.x !== origin.x || moved.y !== origin.y) && (await valueState(page)) === 'recorded', { origin, moved });

    await page.keyboard.press('2');
    const connectionsBefore = await page.evaluate(() => JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().circuit.connections));
    await page.getByTestId('port-xor0-out').click();
    const wiring = await page.waitForFunction(() => /Wiring from XOR0\.out · click an input pin · Esc cancels/
      .test(document.querySelector('[data-testid="meridian-moment"]')?.textContent ?? ''), null, { timeout: 2000 }).then(() => true, () => false);
    check('Edit: the strip says which pin a wire is being drawn from', wiring, await moment(page));
    await page.getByTestId('port-xor1-out').click();
    const refused = await page.waitForFunction(() => /Connect an output to an input/
      .test(document.querySelector('[data-testid="meridian-wire-notice"]')?.textContent ?? ''), null, { timeout: 2000 }).then(() => true, () => false);
    check('Edit: two outputs make no wire, and the status line says why', await page.evaluate(() => JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().circuit.connections)) === connectionsBefore
      && refused);
    await page.getByTestId('port-en_node-out').click();
    await page.getByTestId('port-xor1-b').click();
    const rewired = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.connections
      .filter((wire) => (wire.to.nodeId ?? wire.to) === 'xor1').map((wire) => `${wire.from.nodeId}.${wire.from.portName}->${wire.to.portName}`));
    check('two pin clicks rewire XOR1.b to EN, replacing its previous driver', rewired.includes('en_node.out->b') && !rewired.includes('and_en.out->b'), rewired);
    await page.keyboard.press('3');
    check('a rewire withdraws recorded values from the sheet', (await valueState(page)) === 'withdrawn' && /design changed · values withdrawn/.test(await moment(page)));
    check('the Time lens stays as recorded', await page.getByTestId('meridian-time').getAttribute('data-stale') === '1');
    check('withdrawn: no net carries a value', await page.locator('[data-net-id][data-value]').count() === 0);
    check('withdrawn: the run status says the checks are not current, never as a current pass', await page.getByTestId('meridian-run-status').getAttribute('data-tone') === 'stale'
      && /not current/.test(await page.getByTestId('meridian-run-status').innerText()));
    check('withdrawn: Run again is one click in the strip', await page.getByTestId('meridian-rerun').isVisible());
    await shot(page, '1440-08-withdrawn-after-rewire');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelector('[data-testid="meridian-title-block"]')?.getAttribute('data-value-state') === 'recorded');
    check('undo repaints recorded values and a chip says the recording must be run again to count',
      (await page.getByTestId('meridian-currency-chip').innerText()).trim() === 'not current'
        && /Same design as this run.*Run again to make its checks current/.test(await page.getByTestId('meridian-currency-chip').getAttribute('title'))
        && await page.getByTestId('meridian-run-status').getAttribute('data-tone') === 'stale');

    // ── Failure: one authored expectation changed, Run, the failure is drawn and named ──
    const previousRunId = (await readRun(page)).runId;
    await page.evaluate(() => {
      const state = window.__RB_PROJECT_RUNTIME__.getState();
      const scenario = state.scenarios.find((entry) => entry.id === state.activeScenarioId);
      // Expectations are keyed by IO field id (q1), not node id.
      const vectors = (scenario?.vectors ?? state.projectVectors).map((vector) => vector.tick === 3
        ? { ...vector, expected: { ...vector.expected, q1: 0 } } : vector);
      state.setVectors(vectors);
    });
    await page.getByTestId('meridian-rerun').click();
    await waitForRun(page, previousRunId);
    const failed = await readRun(page);
    const failedRows = failed.report.rows.filter((row) => row.expected !== row.actual);
    check('the failing recording records exactly one failed check at t3', failedRows.length === 1 && failedRows[0].tick === 3,
      { runId: failed.runId, rows: failed.report.rows.length, failedRows: failedRows.slice(0, 4) });
    check('a failing recording opens at its failed tick', await page.getByTestId('meridian-time').getAttribute('data-tick') === '3');
    const failCell = page.getByTestId('meridian-check-3');
    check('the failure is drawn at t3, names its output, and states expected and recorded values', await failCell.getAttribute('data-result') === 'fail'
      && /≠ LD1/.test(await failCell.innerText()) && /LD1 expected 0, recorded 1/.test(await failCell.getAttribute('title'))
      && /1 of 14 checks failed/.test(await page.getByTestId('meridian-run-status').innerText()), { cell: await failCell.innerText(), title: await failCell.getAttribute('title') });
    check('the failing lane is marked and says what was expected at this tick', await page.locator('.mrd-time-label[data-fail]', { hasText: 'LD1' }).count() === 1
      && /≠ expected 0/.test(await page.locator('.mrd-time-label[data-fail]').innerText()));
    await shot(page, '1440-09-failure');
    await page.getByTestId('meridian-check-0').click();
    check('a check cell is a button that seeks its tick', await page.getByTestId('meridian-time').getAttribute('data-tick') === '0');

    // ── Unconnected input: topology, not an observed 0 ──
    await page.keyboard.press('2');
    await page.locator('[data-wire-id="en_node.out-xor0.b"] .mrd-net-hit').dispatchEvent('pointerdown', { button: 0 });
    await page.getByTestId('meridian-delete-wire').click();
    await page.locator('[data-unconnected="xor0.b"]').waitFor({ state: 'visible' });
    check('Delete wire leaves its input drawn as unconnected · read as 0', await page.getByTestId('meridian-unconnected-count').isVisible()
      && await page.evaluate(() => !window.__RB_PROJECT_RUNTIME__.getState().circuit.connections.some((wire) => wire.to?.nodeId === 'xor0' && wire.to?.portName === 'b')));
    check('Edit shows no value-like 0 on the unconnected input, only its marker', await page.locator('[data-unconnected="xor0.b"] text').count() === 0
      && await page.locator('[data-unconnected="xor0.b"] circle').count() === 1);
    await page.getByTestId('meridian-unconnected-count').click();
    check('the unconnected count leads to the part, and the inspector says the input is read as 0',
      await page.getByTestId('meridian-inspector').getAttribute('data-node-id') === 'xor0'
        && /unconnected · read as 0/.test(await page.getByTestId('meridian-inspector').innerText()));
    await shot(page, '1440-10-unconnected');
    await page.keyboard.press('Control+z');

    // ── A Design issue turns checks off for the Run, as Simulate does ──
    // XOR0.b from RST0 instead of EN closes a combinational loop (XOR0 -> RST0 -> XOR0), which
    // the workbench refuses to grade. (A floating output is only a warning there.)
    await page.getByTestId('port-d0_rst-out').click();
    await page.getByTestId('port-xor0-b').click();
    await page.locator('[data-wire-id="d0_rst.out-xor0.b"]').waitFor({ state: 'attached' });
    const beforeBlocked = (await readRun(page)).runId;
    await page.keyboard.press('3');
    await page.keyboard.press('Control+Enter');
    await waitForRun(page, beforeBlocked, /checks off/);
    await page.getByTestId('meridian-time').waitFor({ state: 'visible' });
    const blockedRun = await readRun(page);
    const blockedStatus = await page.getByTestId('meridian-run-status').innerText();
    const blockedTitle = await page.getByTestId('meridian-run-status').getAttribute('title');
    const hintOnce = (() => { const match = /Fix: (.{20})/.exec(blockedTitle ?? ''); return !match || (blockedTitle ?? '').split(match[1]).length === 2; })();
    check('a combinational loop turns checks off: the Run records without checks and names the Design issue briefly (its fix said once)',
      blockedRun.report.rows.length === 0 && /checks off · not simulated · Combinational loop/i.test(blockedStatus) && blockedStatus.length <= 80
        && /Fix it in Design/.test(blockedTitle ?? '') && hintOnce && await page.getByTestId('meridian-run-status').getAttribute('data-tone') === 'none', { blockedStatus, blockedTitle, rows: blockedRun.report.rows.length });
    check('the Time lens says the recording has no checks', await page.getByTestId('meridian-checks-none').isVisible());
    // The simulator refused the loop and recorded only the test inputs: those are drawn, nothing else.
    await seekTick(page, 3);
    const blockedEn = await lanePixel(page, 'EN', 3, 0.75, 1);
    check('a design the simulator refused still draws the recorded test inputs, and says only they were recorded',
      isBlue(blockedEn.rgba) && /not simulated · only the test inputs were recorded/.test(await page.locator('[data-testid="meridian-lens-time"] .mrd-lens-meta').innerText())
        && await netValue(page, 'en_node.out') === '1' && await netValue(page, 'q1_ff.Q') === 'none', { blockedEn });
    await shot(page, '1440-11-checks-off');
    await page.keyboard.press('2');
    await page.keyboard.press('Control+z');
    await page.locator('[data-wire-id="en_node.out-xor0.b"]').waitFor({ state: 'attached' });

    // ── Keyboard reach and focus ──
    await page.getByTestId('meridian-sheet').focus();
    await page.keyboard.press('Tab');
    const focusedNode = await page.evaluate(() => document.activeElement?.getAttribute('data-sheet-node'));
    check('Tab moves from the sheet to a part', Boolean(focusedNode), { focusedNode });
    const focusRing = await page.evaluate(() => {
      const ring = document.activeElement?.querySelector('.mrd-focus-ring');
      return ring ? { display: getComputedStyle(ring).display, dash: getComputedStyle(ring).strokeDasharray } : null;
    });
    check('a focused part shows one solid focus contour', focusRing?.display !== 'none' && focusRing?.dash === 'none', focusRing);
    await page.keyboard.press('Enter');
    check('Enter selects the focused part', await page.getByTestId('meridian-inspector').getAttribute('data-node-id') === focusedNode);
    await page.locator('[data-sheet-node="q1_ff"]').click();
    await page.keyboard.press('ArrowRight');
    const dashes = await page.evaluate(() => [...document.querySelectorAll('[data-testid="meridian-sheet"] .rb-sym-body')]
      .map((body) => getComputedStyle(body).strokeDasharray).filter((dash) => dash !== 'none'));
    check('keyboard focus never dashes a part outline (dashes mean pending or unrecorded)', dashes.length === 0, dashes);

    // ── The strip at its fullest, and Back across a trip through Design ──
    // A fresh run (it fails at t3: the authored expectation above), Q1 at t4, the edge that set it,
    // then an edit and its undo in Design (same design identity: values repaint with the chip). Back must still
    // lead to t4 after the trip.
    await page.keyboard.press('3');
    const beforeFresh = (await readRun(page)).runId;
    await page.getByTestId('meridian-rerun').click();
    await waitForRun(page, beforeFresh);
    check('the fresh run opens at its failed tick', await page.getByTestId('meridian-time').getAttribute('data-tick') === '3');
    await page.getByTestId('meridian-fit').click();
    await page.waitForTimeout(400);
    await page.locator('[data-sheet-node="q1_ff"]').click();
    await page.keyboard.press('ArrowRight');
    await page.getByTestId('meridian-show-cause').click();
    await page.waitForFunction(() => /^t3 /.test(document.querySelector('[data-testid="meridian-moment"]')?.textContent ?? ''));
    // An edit and its undo: the same design again, so the values repaint, but the evidence is not current.
    await page.keyboard.press('2');
    await page.getByTestId('port-en_node-out').click();
    await page.getByTestId('port-xor1-b').click();
    await page.keyboard.press('Control+z');
    await page.keyboard.press('3');
    await page.getByTestId('meridian-currency-chip').waitFor({ state: 'visible' });
    check('after a trip through Design the step is restored and Back still leads to where the student was (t4)',
      /^t3 · rising clock edge · step \d+ of \d+ · Q1$/.test(await moment(page)) && /^Back to t4/.test((await page.getByTestId('meridian-back').innerText()).trim()), await moment(page));
    // A longer part name makes the Moment longer; the strip must still keep it whole.
    await page.evaluate(() => {
      const state = window.__RB_PROJECT_RUNTIME__.getState();
      state.applyCircuitMutation({ ...state.circuit, nodes: state.circuit.nodes.map((node) => (node.id === 'q1_ff' ? { ...node, label: 'Q1_NEXT_STATE' } : node)) });
    });
    await page.waitForFunction(() => /Q1_NEXT_STATE$/.test(document.querySelector('[data-testid="meridian-moment"]')?.getAttribute('title') ?? ''));

    // ── Viewports ──
    // 1152x720 is the CSS-pixel viewport of a 1440x900 window at 125% browser zoom (layout only; this context keeps DPR 1).
    for (const viewport of [{ width: 1536, height: 864 }, { width: 1366, height: 768 }, { width: 1280, height: 650 }, { width: 1152, height: 720 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.keyboard.press('3');
      await page.waitForTimeout(250);
      const bounds = await page.evaluate(() => {
        const project = document.querySelector('[data-testid="meridian-project"]');
        const strip = document.querySelector('[data-testid="meridian-title-block"]').getBoundingClientRect();
        const rerun = document.querySelector('[data-testid="meridian-rerun"]')?.getBoundingClientRect() ?? null;
        const back = document.querySelector('[data-testid="meridian-back"]')?.getBoundingClientRect() ?? null;
        const tools = document.querySelector('[data-testid="meridian-title-block"] .mrd-sheet-tools')?.getBoundingClientRect() ?? null;
        const inside = (box) => Boolean(box) && box.left >= strip.left && box.right <= strip.right && box.top >= strip.top && box.bottom <= strip.bottom;
        return {
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          overflowY: document.documentElement.scrollHeight - window.innerHeight,
          sheet: document.querySelector('[data-testid="meridian-sheet"]')?.getBoundingClientRect().height ?? 0,
          lens: document.querySelector('[data-testid="meridian-lens-time"]')?.getBoundingClientRect().height ?? 0,
          projectTruncated: project.scrollWidth > project.clientWidth,
          momentTruncated: (() => { const node = document.querySelector('[data-testid="meridian-moment"]'); return node.scrollWidth > node.clientWidth; })(),
          momentText: document.querySelector('[data-testid="meridian-moment"]').textContent,
          rerunInside: inside(rerun),
          backInside: inside(back),
          toolsInside: inside(tools),
        };
      });
      check(`${viewport.width}x${viewport.height}: nothing overflows the window`, bounds.overflowX <= 0 && bounds.overflowY <= 0, bounds);
      check(`${viewport.width}x${viewport.height}: the sheet and the Time lens both have room`, bounds.sheet >= 200 && bounds.lens >= 200, bounds);
      check(`${viewport.width}x${viewport.height}: at a step with Back, the chip and Run again, the Moment and the project name are whole and every strip control stays inside the strip`,
        !bounds.projectTruncated && !bounds.momentTruncated && /step \d+ of \d+ · Q1_NEXT_STATE$/.test(bounds.momentText) && bounds.rerunInside && bounds.backInside && bounds.toolsInside, bounds);
      await shot(page, `${viewport.width}-simulate`);
      // Explore at the same width: the edge count must stay readable.
      await page.keyboard.press('2');
      await page.keyboard.press('e');
      await page.keyboard.press('.');
      await page.keyboard.press('.');
      const explore = await page.evaluate(() => { const node = document.querySelector('[data-testid="meridian-moment"]'); return { text: node.innerText, truncated: node.scrollWidth > node.clientWidth }; });
      check(`${viewport.width}x${viewport.height}: Explore keeps its clock-edge count readable`, !explore.truncated && /2 clock edges/.test(explore.text), explore);
      await page.keyboard.press('e');
      await page.keyboard.press('3');
      await page.waitForTimeout(150);
      // The Board stage gives the board lens more height; the sheet must keep its room too.
      await page.keyboard.press('4');
      await page.waitForTimeout(250);
      const board = await page.evaluate(() => ({
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        overflowY: document.documentElement.scrollHeight - window.innerHeight,
        sheet: document.querySelector('[data-testid="meridian-sheet"]')?.getBoundingClientRect().height ?? 0,
        lens: document.querySelector('[data-testid="meridian-lens-board"]')?.getBoundingClientRect().height ?? 0,
      }));
      check(`${viewport.width}x${viewport.height}: Board stage keeps the sheet and the board lens in view`,
        board.overflowX <= 0 && board.overflowY <= 0 && board.sheet >= 200 && board.lens >= 200, board);
      await shot(page, `${viewport.width}-board`);
    }

    // ── A link to another example never replaces the working session ──
    const guard = await page.context().newPage();
    try {
      await guard.goto(`${baseUrl}/?studio=meridian&example=half-adder&stage=design`, { waitUntil: 'domcontentloaded' });
      await guard.getByTestId('meridian-example-notice').waitFor({ state: 'visible', timeout: 30000 });
      const kept = await guard.evaluate(() => ({ nodes: window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length, example: new URL(location.href).searchParams.get('example') }));
      check('a link to another example asks first and keeps the working session', kept.nodes === 13 && kept.example === null, kept);
      await guard.getByTestId('meridian-example-keep').click();
      await guard.reload({ waitUntil: 'domcontentloaded' });
      await guard.getByTestId('meridian-sheet').waitFor({ state: 'visible', timeout: 30000 });
      const reloaded = await guard.evaluate(() => ({
        nodes: window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length,
        notice: Boolean(document.querySelector('[data-testid="meridian-example-notice"]')),
      }));
      check('a reload keeps the working session', reloaded.nodes === 13 && !reloaded.notice, reloaded);
    } finally {
      await guard.close();
    }

    // ── A long recording: the lane names stay put and the meridian stays in view ──
    await page.setViewportSize({ width: 1152, height: 720 });
    await page.keyboard.press('3');
    const beforeLong = (await readRun(page)).runId;
    await page.evaluate(() => {
      const state = window.__RB_PROJECT_RUNTIME__.getState();
      const scenario = state.scenarios.find((entry) => entry.id === state.activeScenarioId);
      const first = scenario.vectors[0];
      state.setVectors(Array.from({ length: 40 }, (_, tick) => ({
        ...first, id: `long-${tick}`, tick, inputs: { ...first.inputs, en: tick === 0 ? 0 : 1, rst: tick === 0 ? 1 : 0 }, expected: {},
      })));
    });
    await page.keyboard.press('Control+Enter');
    await waitForRun(page, beforeLong, /recorded without checks/);
    if (!(await page.getByTestId('meridian-lens-time').isVisible())) await page.keyboard.press('t');
    await page.getByTestId('meridian-time').waitFor({ state: 'visible' });
    await page.keyboard.press('End');
    await page.waitForTimeout(250);
    const long = await page.evaluate(() => {
      const body = document.querySelector('[data-testid="meridian-lens-time"] .mrd-lens-body');
      const box = body.getBoundingClientRect();
      const labels = document.querySelector('[data-testid="meridian-time"] .mrd-time-labels').getBoundingClientRect();
      const meridian = document.querySelector('[data-testid="meridian-cursor"]').getBoundingClientRect();
      return {
        ticks: document.querySelectorAll('[data-testid="meridian-time"] .mrd-time-tick').length,
        scrollable: body.scrollWidth > body.clientWidth, scrolled: body.scrollLeft,
        labelsLeft: labels.left, labelsRight: labels.right, bodyLeft: box.left, bodyRight: box.right, meridian: meridian.left,
      };
    });
    check('a 40-tick recording scrolls sideways, keeps the lane names at the left edge and the meridian in view at its last tick',
      long.ticks >= 40 && long.scrollable && long.scrolled > 0 && Math.abs(long.labelsLeft - long.bodyLeft) <= 1
        && long.meridian > long.labelsRight && long.meridian < long.bodyRight, long);
    await shot(page, '1152-long-recording');

    // ── Motion: with full motion, Fit travels over several frames ──
    for (let i = 0; i < 3 && !(await page.getByTestId('meridian-inspector-empty').isVisible().catch(() => false)); i += 1) await page.keyboard.press('Escape');
    const travel = await fitTravel(page);
    check('full motion: Fit travels through intermediate camera positions', travel.distinct > 2, travel);

    // ── Reduced motion: a second fresh context; same final values, zero translation ──
    const reduced = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    try {
      const calm = await reduced.newPage();
      await calm.goto(STUDIO(baseUrl, 'simulate'), { waitUntil: 'domcontentloaded' });
      await calm.getByTestId('meridian-sheet').waitFor({ state: 'visible', timeout: 30000 });
      check('reduced motion is honoured by the studio root', await calm.getByTestId('meridian-studio').getAttribute('data-motion') === 'reduced');
      await calm.keyboard.press('Control+Enter');
      await waitForRun(calm, null);
      await seekTick(calm, 3);
      const calmValues = await allNetValues(calm);
      check('reduced motion: every net carries the same recorded value at t3', JSON.stringify(calmValues) === JSON.stringify(valuesAt3)
        && calmValues['q1_ff.Q'] === '1' && calmValues['q0_ff.Q'] === '0', { full: valuesAt3, reduced: calmValues });
      const calmTravel = await fitTravel(calm);
      check('reduced motion: Fit jumps once, with no intermediate camera positions', calmTravel.distinct === 2, calmTravel);
    } finally {
      await reduced.close();
    }
  } finally {
    receipt.browserProblems = problems;
  }
  check('no page errors or console errors', problems.length === 0, problems.slice(0, 8));
});

receipt.finishedAtIso = new Date().toISOString();
receipt.status = process.exitCode ? 'fail' : 'pass';
await writeFile(path.join(OUT, 'meridian-counter-slice.json'), JSON.stringify(receipt, null, 2));
console.log(`checks: ${receipt.checks.filter((entry) => entry.pass).length}/${receipt.checks.length} · status ${receipt.status}`);
