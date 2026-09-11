// The bottom panel at real browser zoom.
//
// The existing scale coverage says plainly what it does not prove: "NOT proven here: real browser
// zoom". Text zoom (`documentElement.style.fontSize`) and browser zoom are different failures - text
// zoom grows type inside a fixed CSS viewport, browser zoom shrinks the CSS viewport under
// everything at once, so a panel with a floor in px and a page with a `100vh` frame fail at
// different settings. This probe covers the second one.
//
// Browser zoom at Z on a physical W×H window is exactly a CSS viewport of W/Z × H/Z rendered at a
// device pixel ratio of Z, which is what Playwright's viewport + deviceScaleFactor produce.
//
// What it asserts, in the state a reader reaches it in: the panel exists, it is on screen rather
// than off the bottom, the status bar is still the last thing in the window, the control that puts
// the panel away can actually be clicked, the problems count still opens it, and nothing scrolls
// sideways. At 200% on a 1440×900 machine that is a 720×450 CSS viewport, which is the hardest of
// these and the one a student with a small laptop and large zoom actually gets.
import { BASE_URL, launchChromium, evidenceDir } from './harness.mjs';

const OUT = evidenceDir('bottom-panel-zoom');
const tid = (t) => `[data-testid="${t}"]`;
const PHYSICAL = { width: 1440, height: 900 };
const ZOOMS = [1, 1.25, 1.5, 2];

const browser = await launchChromium();
const failures = [];
const note = (msg) => { failures.push(msg); console.log(`   FAIL ${msg}`); };

async function check(zoom) {
  const width = Math.round(PHYSICAL.width / zoom);
  const height = Math.round(PHYSICAL.height / zoom);
  const at = `${Math.round(zoom * 100)}% (${width}×${height} CSS)`;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: zoom,
  });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(tid('ide-project-landing'), { timeout: 20000 });

  // A real project, because an empty workspace is not where the panel is under pressure.
  await page.getByTestId('ide-project-start-a-lab-primary').click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
  await page.waitForTimeout(2000);

  for (const mode of ['project', 'design', 'verify', 'hardware', 'export']) {
    await page.getByTestId(`mode-button-${mode}`).click();
    await page.waitForTimeout(700);

    // Ask for the problems the way a reader does: press the count in the status bar.
    const count = page.getByTestId('ide-status-problems');
    if ((await count.count()) === 0) { note(`${at} ${mode}: no problems count in the status bar`); continue; }
    await count.click();
    await page.waitForTimeout(600);

    const measured = await page.evaluate(() => {
      const el = (id) => document.querySelector(`[data-testid="${id}"]`);
      const panel = el('ide-workbench-console');
      const status = el('ide-status-bar') ?? document.querySelector('.ide-workbench-statusbar');
      const collapse = document.querySelector('.ide-workbench-console-bar .ide-workbench-dock-collapse')
        ?? el('ide-hide-bottom-dock');
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const box = (n) => (n ? n.getBoundingClientRect() : null);
      const pb = box(panel);
      const sb = box(status);
      const cb = box(collapse);
      const clickable = cb && cb.width > 0 && cb.height > 0
        ? (() => {
            const hit = document.elementFromPoint(cb.left + cb.width / 2, cb.top + cb.height / 2);
            return Boolean(hit && (hit === collapse || collapse.contains(hit) || hit.contains(collapse)));
          })()
        : false;
      const body = document.scrollingElement ?? document.documentElement;
      return {
        state: panel ? panel.getAttribute('data-console-state') : 'absent',
        panelBottom: pb ? Math.round(pb.bottom) : null,
        panelTop: pb ? Math.round(pb.top) : null,
        panelHeight: pb ? Math.round(pb.height) : 0,
        statusBottom: sb ? Math.round(sb.bottom) : null,
        statusHeight: sb ? Math.round(sb.height) : 0,
        collapseSize: cb ? `${Math.round(cb.width)}×${Math.round(cb.height)}` : 'absent',
        collapseClickable: clickable,
        vh,
        vw,
        overflowX: Math.max(0, Math.round(body.scrollWidth - body.clientWidth)),
      };
    });

    const where = `${at} ${mode}`;
    if (measured.state !== 'expanded') {
      note(`${where}: pressing the problems count produced a ${measured.state} panel`);
    }
    if (measured.panelBottom !== null && measured.panelBottom > measured.vh + 1) {
      note(`${where}: the panel ends ${measured.panelBottom - measured.vh}px below the window`);
    }
    if (measured.panelTop !== null && measured.panelTop < 0) {
      note(`${where}: the panel starts ${-measured.panelTop}px above the window`);
    }
    if (measured.statusBottom !== null && Math.abs(measured.statusBottom - measured.vh) > 2) {
      note(`${where}: the status bar ends at ${measured.statusBottom} in a ${measured.vh}px window`);
    }
    if (measured.statusHeight === 0) note(`${where}: the status bar has no height`);
    if (!measured.collapseClickable) {
      note(`${where}: the control that puts the panel away is ${measured.collapseSize} and not clickable`);
    }
    if (measured.overflowX > 0) note(`${where}: the document scrolls ${measured.overflowX}px sideways`);

    console.log(`   ${where}: ${measured.state} ${measured.panelHeight}px, ` +
      `status ${measured.statusHeight}px at ${measured.statusBottom}/${measured.vh}, ` +
      `hide ${measured.collapseSize}${measured.collapseClickable ? '' : ' (unclickable)'}, ` +
      `overflowX ${measured.overflowX}px`);
  }

  // And it can be put away and got back, at this zoom, without a reload.
  await page.getByTestId('mode-button-design').click();
  await page.waitForTimeout(500);
  const hide = page.locator('.ide-workbench-console-bar .ide-workbench-dock-collapse').first();
  if ((await hide.count()) > 0) {
    await hide.click();
    await page.waitForTimeout(500);
    const recovery = await page.evaluate(() => {
      const strip = document.querySelector('[data-testid="ide-show-bottom-dock"]');
      const panel = document.querySelector('[data-testid="ide-workbench-console"]');
      const b = strip ? strip.getBoundingClientRect() : null;
      return {
        strip: Boolean(strip),
        stripVisible: b ? b.width > 0 && b.height > 0 && b.bottom <= window.innerHeight + 1 : false,
        panelState: panel ? panel.getAttribute('data-console-state') : 'absent',
      };
    });
    if (!recovery.strip || !recovery.stripVisible) {
      note(`${at}: hiding the panel left no visible way back (strip ${recovery.strip ? 'offscreen' : 'absent'})`);
    } else {
      await page.getByTestId('ide-show-bottom-dock').click();
      await page.waitForTimeout(500);
      const back = await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="ide-workbench-console"]');
        return panel ? panel.getAttribute('data-console-state') : 'absent';
      });
      if (back === 'hidden' || back === 'absent') note(`${at}: the panel did not come back (${back})`);
      console.log(`   ${at} hide -> strip -> ${back}`);
    }
  } else {
    note(`${at}: there is no control to put the panel away`);
  }

  await page.screenshot({ path: `${OUT}/bottom-panel-zoom-${Math.round(zoom * 100)}.png` });
  await context.close();
}

try {
  console.log(`Bottom panel at browser zoom, on a ${PHYSICAL.width}×${PHYSICAL.height} window:`);
  for (const zoom of ZOOMS) await check(zoom);
  if (failures.length > 0) {
    console.log(`\nFAIL — ${failures.length} problem(s) at browser zoom:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`\nPASS — at 100/125/150/200% browser zoom, on all five workspaces: the problems count ` +
      `opens the panel expanded, the panel stays inside the window, the status bar stays at the bottom, ` +
      `the hide control is clickable, nothing scrolls sideways, and hiding is recoverable.`);
  }
} finally {
  await browser.close();
}
