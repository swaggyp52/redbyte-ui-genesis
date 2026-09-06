// DIAGNOSTIC PROBE (not a student workflow): the focal instrument must fit the pane the
// workbench gave it, at every size RedByte claims to support.
//
// This exists because a viewport-relative min-height once demanded 558px inside a 485px pane:
// the schematic was laid out 73px past its container, that band sat under the Problems console,
// and the console swallowed clicks on any symbol placed low on the sheet. Nothing about that
// was visible in a screenshot.
//
// It measures, in Design and in Board & Constraints, at 1440x900, 1366x768, a halved viewport
// (reflow) and text scaled to 200%:
//   - the document never overflows horizontally;
//   - the focal instrument is not laid out past its own pane;
//   - the focal instrument does not run underneath the console;
//   - every workspace rail button is still visible.
//
// It deliberately does NOT constrain the canvases themselves: a schematic and a waveform are
// two-dimensional instruments and are meant to pan inside their own frames.
import { BASE_URL, launchChromium } from './harness.mjs';

const tid = (id) => `[data-testid="${id}"]`;
const browser = await launchChromium();

async function check(label, width, height, zoomMode) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('full-adder'));
    await page.waitForTimeout(500);

    if (zoomMode === 'text') {
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await page.waitForTimeout(500);
    }

    for (const [mode, focal] of [['design', 'circuit-canvas'], ['hardware', 'basys3-board-workbench']]) {
      await page.click(tid(`mode-button-${mode}`));
      await page.waitForTimeout(1200);
      if (mode === 'design') {
        // The inspector only fills to its real height with something selected, which is the
        // state a student is in whenever they are actually working.
        const node = page.locator('[data-node-id]').first();
        if (await node.count()) {
          await node.click({ force: true });
          await page.waitForTimeout(700);
        }
      }
      const m = await page.evaluate((focalKey) => {
        const doc = document.documentElement;
        const focalEl = document.querySelector(`[data-hierarchy-focal="${focalKey}"]`);
        const parent = focalEl?.parentElement ?? null;
        const rect = (el) => {
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { y: Math.round(b.y), h: Math.round(b.height), bottom: Math.round(b.bottom) };
        };
        const consoleEl = document.querySelector('[data-testid="ide-workbench-console"]');
        const railButtons = [...document.querySelectorAll('[data-testid^="mode-button-"]')].map((el) => {
          const b = el.getBoundingClientRect();
          return { id: el.getAttribute('data-testid'), visible: b.width > 0 && b.height > 0, y: Math.round(b.y) };
        });
        return {
          docOverflowX: doc.scrollWidth - doc.clientWidth,
          focal: rect(focalEl),
          parent: rect(parent),
          console: rect(consoleEl),
          railAllVisible: railButtons.every((b) => b.visible),
          railCount: railButtons.length,
        };
      }, focal);
      const overflowsParent = m.focal && m.parent ? m.focal.bottom - m.parent.bottom : 0;
      const overlapsConsole = m.focal && m.console ? m.focal.bottom - m.console.y : null;
      console.log(
        `${label} ${mode}: docOverflowX=${m.docOverflowX} focalPastPane=${overflowsParent}px ` +
        `focalVsConsole=${overlapsConsole === null ? 'no console' : overlapsConsole + 'px'} ` +
        `rail=${m.railCount} allVisible=${m.railAllVisible}`
      );
      if (m.docOverflowX > 1) throw new Error(`${label} ${mode}: document overflows horizontally by ${m.docOverflowX}px`);
      if (overflowsParent > 1) throw new Error(`${label} ${mode}: focal instrument laid out ${overflowsParent}px past its pane`);
      if (overlapsConsole !== null && overlapsConsole > 1) {
        throw new Error(`${label} ${mode}: focal instrument runs ${overlapsConsole}px under the console`);
      }
      if (!m.railAllVisible) throw new Error(`${label} ${mode}: a workspace rail button is not visible`);

      // Clipped-and-scrollable is fine. Clipped-and-unscrollable is content the student
      // cannot reach: the Design inspector once held 1134px of sections in an 816px dock
      // with overflow hidden and no scroller anywhere inside it, so Source, Evidence,
      // Mapping and Related simply could not be seen.
      const unreachable = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('[data-testid$="-dock"], [data-testid^="ide-right-dock"], [data-testid^="ide-left-dock"]')) {
          if (!(el instanceof HTMLElement)) continue;
          const cs = getComputedStyle(el);
          const hidesY = cs.overflowY === 'hidden' || cs.overflow === 'hidden';
          const hiddenPx = el.scrollHeight - el.clientHeight;
          if (!hidesY || hiddenPx <= 8) continue;
          let scrollable = false;
          for (const d of el.querySelectorAll('*')) {
            const dcs = getComputedStyle(d);
            if ((dcs.overflowY === 'auto' || dcs.overflowY === 'scroll') && d.scrollHeight - d.clientHeight > 8) {
              scrollable = true;
              break;
            }
          }
          if (!scrollable) out.push({ id: el.getAttribute('data-testid'), hiddenPx, boxPx: el.clientHeight });
        }
        return out;
      });
      if (unreachable.length > 0) {
        const detail = unreachable
          .map((u) => `${u.id} hides ${u.hiddenPx}px of content in a ${u.boxPx}px box with no scroller`)
          .join('; ');
        throw new Error(`${label} ${mode}: unreachable dock content — ${detail}`);
      }
    }
    if (errors.length) throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  } finally {
    await context.close();
  }
}

try {
  await check('1440x900        ', 1440, 900, 'none');
  await check('1366x768        ', 1366, 768, 'none');
  await check('halved (reflow) ', 720, 450, 'none');
  await check('text-200%       ', 1440, 900, 'text');
  console.log('\nPASS — Design and Board fit their panes and keep the rail operable at each size, with no document overflow.');
} finally {
  await browser.close();
}
