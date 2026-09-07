// Simulate — the instrument survives the scales, and its ruler tells the truth.
//
// Six things this asserts, each one measured after it was found by measuring:
//
//   1. Every column the ruler draws can hold the cursor. The run is 8 cycles with events at
//      t0..t6, the ruler draws 11 columns, and t7..t10 used to leave the blue column on t0
//      while the readout, the header chip and the observed values all said t7..t10 - 240px of
//      a 660px ruler that could not be inspected, with every value attributed to the wrong tick.
//   2. Clicking the tick NUMBER moves the cursor. The number, the grid line and the edge marker
//      are drawn after the hit rect, so they sat on top of it and swallowed the click.
//   3. The axis does not grow under the pointer: the spare columns follow the experiment, not
//      the cursor, so clicking one column does not re-fit TICK_W and slide the rest.
//   4. Opening "Generators and full event editor" does not destroy the editor. It used to take
//      the 662px its content wanted, squeeze the lanes from 476px to 1px, and paint over the
//      composer bar - elementFromPoint at Add event / Duplicate / Delete / run length all
//      returned the disclosure's own summary.
//   5. The case table's failure navigation is painted at hostile scales. At 1024x720 and at
//      200% text "< Fail" and "Fail >" were 48.5px and 78.9px boxes painting 0px, in a bar that
//      does not wrap inside a pane that clips and does not scroll.
//   6. The trace keeps a floor. At 200% text the canvas was 35px under a 226px run line.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import path from 'node:path';

const OUT = evidenceDir('simulate-instrument-probe');
const tid = (id) => `[data-testid="${id}"]`;
let failures = 0;
const assert = (cond, message) => {
  if (!cond) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
};

/** What of this element is actually painted, after intersecting every clipping ancestor. */
const PAINTED = `(sel) => {
  const n = document.querySelector(sel);
  if (!n) return null;
  const r = n.getBoundingClientRect();
  let box = { l: r.left, t: r.top, right: r.right, b: r.bottom };
  for (let a = n.parentElement; a; a = a.parentElement) {
    const cs = getComputedStyle(a);
    const scrolls = a.scrollHeight - a.clientHeight > 1 || a.scrollWidth - a.clientWidth > 1;
    const clips = !(cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible');
    if (!clips || scrolls) continue;
    const ar = a.getBoundingClientRect();
    box = { l: Math.max(box.l, ar.left), t: Math.max(box.t, ar.top), right: Math.min(box.right, ar.right), b: Math.min(box.b, ar.bottom) };
  }
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    pw: Math.max(0, Math.round(box.right - box.l)), ph: Math.max(0, Math.round(box.b - box.t)),
  };
}`;

async function openCounter(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* private mode */
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(tid('ide-project-start-a-lab-primary'), { timeout: 15000 });
  await page.click(tid('ide-project-start-a-lab-primary'));
  await page.waitForTimeout(500);
  await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
  await page.waitForTimeout(2600);
  await page.click(tid('mode-button-verify'));
  await page.waitForTimeout(1200);
  const run = page.locator(tid('ide-vcb-run'));
  if ((await run.count()) > 0) {
    await run.click();
    await page.waitForTimeout(3000);
  }
}

const browser = await launchChromium();

// ── ①②③④ the instrument at 1440x900 ────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await openCounter(page);

  const columns = await page.locator('[data-testid^="ide-timing-lanes-tick-"]').count();
  assert(columns >= 8, `the ruler draws its columns (got ${columns})`);

  const seen = [];
  for (let tick = 0; tick < columns; tick += 1) {
    const col = page.locator(tid(`ide-timing-lanes-tick-${tick}`)).first();
    const box = await col.boundingBox();
    if (!box) {
      assert(false, `ruler column t${tick} has no box`);
      continue;
    }
    // The centre of the column is where the tick NUMBER is drawn. Clicking there is the most
    // obvious way to select a tick and must work.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(220);
    const state = await page.evaluate(() => {
      const sel = document.querySelector('rect.rb-tl-selected');
      // The readout's own tick element, not the whole strip: its text runs "t0" straight into
      // the case position, so "t0" and "t01" are indistinguishable in the concatenation.
      const tickCode = document.querySelector('.rb-wave-readout__pos code');
      const readout = (tickCode?.textContent ?? '').trim();
      return { cursorX: sel ? Number(sel.getAttribute('x')) : null, readout };
    });
    seen.push({ tick, x: state.cursorX });
    assert(
      state.cursorX != null,
      `clicking ruler column t${tick} leaves a cursor on the lanes`
    );
    assert(
      state.readout === `t${tick}`,
      `ruler column t${tick} moves the run readout to t${tick} (readout said "${state.readout}")`
    );
  }
  // Every column has its own cursor position: none of them silently share t0's.
  const positions = new Set(seen.map((s) => s.x));
  assert(
    positions.size === seen.length,
    `each of the ${seen.length} ruler columns holds the cursor at its own x (got ${positions.size} distinct positions: ${seen.map((s) => `t${s.tick}@${s.x}`).join(' ')})`
  );
  // The axis does not re-fit under the pointer: the columns stay evenly spaced.
  const gaps = seen.slice(1).map((s, i) => s.x - seen[i].x);
  assert(
    new Set(gaps).size === 1,
    `the ruler keeps one column width while the cursor moves (gaps ${gaps.join(',')})`
  );

  // ④ the alternate editor does not destroy the editor
  const before = await page.evaluate(
    (fn) => ({ lanes: eval(fn)('[data-testid="ide-timing-lanes"]') }),
    PAINTED
  );
  await page.locator(`${tid('ide-scenario-generators-disclosure')} > summary`).first().click();
  await page.waitForTimeout(700);
  const after = await page.evaluate((fn) => {
    const painted = eval(fn);
    const hits = {};
    for (const id of [
      'ide-scenario-composer-add-event',
      'ide-scenario-duplicate-event',
      'ide-scenario-delete-event',
    ]) {
      const n = document.querySelector(`[data-testid="${id}"]`);
      if (!n) { hits[id] = 'ABSENT'; continue; }
      const r = n.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      hits[id] = el === n || n.contains(el) ? 'self' : (el?.getAttribute('data-testid') || el?.tagName || '?');
    }
    return { lanes: painted('[data-testid="ide-timing-lanes"]'), hits };
  }, PAINTED);

  assert(
    (after.lanes?.ph ?? 0) >= 100,
    `opening the generators leaves the timeline usable (was ${before.lanes?.ph}px, now ${after.lanes?.ph}px painted)`
  );
  for (const [id, hit] of Object.entries(after.hits)) {
    assert(hit === 'self', `${id} is still the thing at its own centre with the generators open (got ${hit})`);
  }

  await page.screenshot({ path: path.join(OUT, 'instrument-1440x900.png') });
  await ctx.close();
}

// ── ⑤⑥ hostile scales ──────────────────────────────────────────────────────
for (const [w, h, root] of [
  [1024, 720, null],
  [1440, 900, 32],
  [720, 450, null],
]) {
  const label = `${w}x${h}${root ? ` root${root}` : ''}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await openCounter(page);
  if (root) {
    await page.addStyleTag({ content: `html{font-size:${root}px !important}` });
    await page.waitForTimeout(700);
  }

  // ⑤ the case table's failure navigation
  await page.locator(tid('ide-verify-view-table')).first().click();
  await page.waitForTimeout(800);
  for (const id of ['ide-case-lab-prev-failure', 'ide-case-lab-next-failure', 'ide-case-lab-failures-only']) {
    const m = await page.evaluate((args) => eval(args[1])(`[data-testid="${args[0]}"]`), [id, PAINTED]);
    if (!m) continue;
    assert(m.pw > 0 && m.ph > 0, `[${label}] ${id} is painted (box ${m.w}x${m.h}, painted ${m.pw}x${m.ph})`);
  }

  // ⑥ the trace keeps a floor
  const waveButton = page.locator(tid('ide-verify-view-waveform')).first();
  if ((await waveButton.count()) > 0 && (await waveButton.isEnabled())) {
    await waveButton.click();
    await page.waitForTimeout(900);
    const canvas = await page.evaluate((fn) => eval(fn)('[data-testid="ide-verify-waveform-preview"]'), PAINTED);
    assert(
      canvas != null && canvas.h >= 120,
      `[${label}] the trace canvas keeps a floor (box height ${canvas?.h ?? 'absent'})`
    );
  }

  await page.screenshot({ path: path.join(OUT, `instrument-${label.replace(/\s+/g, '-')}.png`) });
  await ctx.close();
}

await browser.close();

if (failures > 0) {
  console.error(`\nFAIL — ${failures} assertion(s) about the Simulate instrument.`);
  process.exit(1);
}
console.log('\nPASS — the ruler holds the cursor in every column it draws, the alternate editor leaves the instrument alone, and the trace and the failure navigation survive 1024x720, 200% text and 200% browser zoom.');
