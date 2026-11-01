// Design inspector — a label and its value are two columns, not one word.
//
// The inspector's selection details are term/value rows. The signal model block that carries
// Label / Logical direction / Board resource / Package pin declares `display: block` and sits
// inside `.rb-insp-facts`, whose `> div` rule is the two-column ROW grid and outranks that
// declaration on its element selector. The block therefore became the grid and its four rows
// became grid ITEMS in a 96px / 1fr pair - and each row, no longer a grid of its own, printed
// its term hard against its value with nothing between them:
//
//     LabelLD0        Logical directionOutput signal - A value your circuit drives.
//     Board resourceLD1   Package pinE19
//
// jsdom computes no grid, so this cannot be asserted in a component test. It is asserted here,
// in a real engine, on the geometry a reader actually sees: in every term/value row of the
// inspector the term's box must END before the value's box BEGINS.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import path from 'node:path';

const OUT = evidenceDir('design-inspector-probe');
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 650 },
];

const tid = (id) => `[data-testid="${id}"]`;
let failures = 0;
const assert = (cond, message) => {
  if (!cond) {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
};

const browser = await launchChromium();

for (const viewport of VIEWPORTS) {
  const label = `${viewport.width}x${viewport.height}`;
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();

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
  // Lab index 4 is the two-bit counter: a board output whose io row id collides with the
  // register that drives it, which is what put a sentence in this block in the first place.
  await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
  await page.waitForTimeout(2600);

  await page.click(tid('mode-button-design'));
  await page.waitForTimeout(1500);

  // The sheet survives the dock mounting.
  //
  // Selecting any symbol mounts the 280px contextual inspector. Measured at 1280x650 before the
  // fix: the schematic frame went 928px -> 648px, the drawing re-centred but was not re-fitted,
  // and node-OUTPUT-q0_out ended up 96px past the frame's right edge and 80px under the dock -
  // 6 of 9 sampled points inside it hit it before, 0 after, and a click aimed at the LD1 output
  // pin landed on the inspector's Delete node button.
  const PINS = ['node-OUTPUT-q0_out', 'node-OUTPUT-q1_out', 'node-INPUT-clk_node'];
  const sampleHits = () =>
    page.evaluate((ids) => {
      const frame = document.querySelector('.rb-sch-frame');
      const out = {};
      for (const id of ids) {
        const n = document.querySelector(`[data-testid="${id}"]`);
        if (!n) { out[id] = null; continue; }
        const r = n.getBoundingClientRect();
        let hits = 0;
        for (const fx of [0.25, 0.5, 0.75]) {
          for (const fy of [0.25, 0.5, 0.75]) {
            const el = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
            if (el && (el === n || n.contains(el) || el.closest(`[data-testid="${id}"]`))) hits += 1;
          }
        }
        const fr = frame?.getBoundingClientRect();
        out[id] = {
          hits,
          pastFrame: fr ? Math.round(Math.max(0, r.right - fr.right, fr.left - r.left)) : 0,
        };
      }
      return out;
    }, PINS);

  const idleHits = await sampleHits();
  await page.locator('[data-testid^="node-OUTPUT-"]').first().click({ force: true });
  await page.waitForTimeout(1200);
  const selectedHits = await sampleHits();
  for (const id of PINS) {
    const before = idleHits[id];
    const after = selectedHits[id];
    if (!before || !after) continue;
    assert(
      after.pastFrame === 0,
      `[${label}] ${id} stays inside the schematic frame once the inspector mounts (${after.pastFrame}px past)`
    );
    assert(
      after.hits > 0,
      `[${label}] ${id} is still clickable once the inspector mounts (${before.hits}/9 hits before, ${after.hits}/9 after)`
    );
  }
  await page.waitForTimeout(400);

  const report = await page.evaluate(() => {
    // The signal model and the fact rows live in the selection-details section, not in the
    // identity card that carries the `selection-inspector` id.
    const insp =
      document.querySelector('[data-testid="ide-design-inspector-selection-details"]') ??
      document.querySelector('[data-testid="ide-design-context-inspector"]') ??
      document.querySelector('[data-testid="ide-right-dock"]');
    if (!insp) return { present: false, rows: [] };
    const rows = [];
    const candidates = [
      ...insp.querySelectorAll('.rb-insp-signal-model > div'),
      ...insp.querySelectorAll('.rb-insp-row'),
    ];
    for (const row of candidates) {
      if (!(row instanceof HTMLElement) || !row.checkVisibility?.()) continue;
      const kids = Array.from(row.children).filter(
        (k) => k instanceof HTMLElement && k.checkVisibility?.()
      );
      if (kids.length < 2) continue;
      const term = kids[0].getBoundingClientRect();
      const value = kids[kids.length - 1].getBoundingClientRect();
      rows.push({
        text: (row.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        termRight: Math.round(term.right),
        valueLeft: Math.round(value.left),
        gap: Math.round(value.left - term.right),
        sameLine: Math.min(term.bottom, value.bottom) - Math.max(term.top, value.top) > 1,
      });
    }
    // The four signal-model rows are a stack, one per line. When the block itself is laid out
    // as the two-column ROW grid they pair up instead - Label beside Logical direction, Board
    // resource beside Package pin - which reads as a table of four cells that are not a table.
    const modelRows = Array.from(insp.querySelectorAll('.rb-insp-signal-model > div'))
      .filter((n) => n instanceof HTMLElement && n.checkVisibility?.())
      .map((n) => {
        const r = n.getBoundingClientRect();
        const kids = Array.from(n.children).filter((k) => k instanceof HTMLElement && k.checkVisibility?.());
        const valueLeft = kids.length > 1 ? Math.round(kids[kids.length - 1].getBoundingClientRect().left) : null;
        return {
          left: Math.round(r.left),
          top: Math.round(r.top),
          valueLeft,
          text: (n.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30),
        };
      });
    return { present: true, rows, modelRows };
  });

  console.log(`[${label}] inspector rows: ${report.rows.length}`);
  assert(report.present, `[${label}] the selection inspector is on screen`);
  assert(report.rows.length >= 4, `[${label}] the selection inspector shows its term/value rows (got ${report.rows.length})`);

  for (const row of report.rows) {
    // A row that wrapped onto two lines is fine - the columns are still columns. Only a row
    // drawn on one line with its value starting at or before the term's right edge is the
    // collision this probe exists for.
    if (!row.sameLine) continue;
    assert(
      row.gap > 0,
      `[${label}] "${row.text}" runs its term into its value (term ends ${row.termRight}, value starts ${row.valueLeft}, gap ${row.gap}px)`
    );
  }

  const modelRows = report.modelRows ?? [];
  assert(modelRows.length >= 4, `[${label}] the signal model shows its four rows (got ${modelRows.length})`);
  for (let i = 1; i < modelRows.length; i += 1) {
    const previous = modelRows[i - 1];
    const current = modelRows[i];
    assert(
      current.left === previous.left,
      `[${label}] signal-model rows are a stack, not a pair of columns: "${previous.text}" starts at x=${previous.left} and "${current.text}" at x=${current.left}`
    );
    assert(
      current.top > previous.top,
      `[${label}] signal-model row "${current.text}" is drawn beside "${previous.text}" (both at y=${previous.top}) instead of under it`
    );
    // The values line up in a column of their own. An inline run of term-then-value starts each
    // value wherever its term happened to end, which is the same defect one step less obvious.
    if (previous.valueLeft != null && current.valueLeft != null) {
      assert(
        current.valueLeft === previous.valueLeft,
        `[${label}] signal-model values do not share a column: "${previous.text}" value at x=${previous.valueLeft}, "${current.text}" value at x=${current.valueLeft}`
      );
    }
  }

  await page.screenshot({ path: path.join(OUT, `design-inspector-${label}.png`) });
  await ctx.close();
}

await browser.close();

if (failures > 0) {
  console.error(`\nFAIL — ${failures} inspector row(s) print a label hard against its value.`);
  process.exit(1);
}
console.log('\nPASS — every Design inspector term/value row drawn on one line keeps its two columns.');
