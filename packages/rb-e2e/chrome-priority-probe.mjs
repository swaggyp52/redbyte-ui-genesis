// Does the application frame survive a shortage of room?
//
// A narrow window and a large text setting are the same problem, so both are driven here: the
// viewport shrinks and, separately, the document's root font size is raised, which is what a
// reader changing their browser's text size actually does.
//
// The contract is priority, not preservation. When the frame runs short of room these six must
// still be there and still be reachable, in this order:
//   1 the current document or selected engineering object
//   2 the current primary operation
//   3 save / dirty state
//   4 the active project
//   5 the current target
//   6 command access
// Anything else may fold into a menu, a tooltip or the status bar - but nothing may collide,
// nothing may be clipped without a way to recover the text, and the page may never scroll
// sideways.
import { BASE_URL, launchChromium } from './harness.mjs';

const tid = (id) => `[data-testid="${id}"]`;
const failures = [];
const note = (message) => failures.push(message);

const browser = await launchChromium();

async function open(context, root) {
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('full-adder'));
  await page.waitForTimeout(700);
  if (root !== 16) await page.addStyleTag({ content: `html { font-size: ${root}px !important; }` });
  await page.waitForTimeout(600);
  return page;
}

async function checkFrame(page, at) {
  // ── Nothing in the application bar may paint over its neighbour ────────────
  const collisions = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="ide-top-bar"]');
    const boxes = [...bar.children]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0)
      .sort((a, b) => a.r.x - b.r.x);
    const hits = [];
    for (let i = 1; i < boxes.length; i += 1) {
      const gap = boxes[i].r.x - boxes[i - 1].r.right;
      if (gap < -1) {
        const name = (el) => el.getAttribute('data-testid') || (el.className || '').toString().split(' ')[0];
        hits.push(`${name(boxes[i - 1].el)} over ${name(boxes[i].el)} by ${Math.abs(Math.round(gap))}px`);
      }
    }
    return hits;
  });
  if (collisions.length) note(`${at} application bar collides: ${collisions.join('; ')}`);

  // A collision that steals clicks is worse than one that only looks wrong, so the top-left
  // corner of every bar control must belong to that control.
  const stolen = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="ide-top-bar"]');
    const out = [];
    for (const el of bar.querySelectorAll('button, [role="button"], input')) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const owner = document.elementFromPoint(r.x + 4, r.y + r.height / 2);
      if (owner && !el.contains(owner) && !owner.contains(el)) {
        out.push(`${el.getAttribute('data-testid') ?? el.className}`);
      }
    }
    return out;
  });
  if (stolen.length) note(`${at} bar controls whose own box belongs to something else: ${stolen.join(', ')}`);

  // ── The six ───────────────────────────────────────────────────────────────
  const six = await page.evaluate(() => {
    const visible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const byId = (id) => document.querySelector(`[data-testid="${id}"]`);
    const compactMenu = byId('ide-menu-compact');
    const inMenu = (id) => Boolean(compactMenu && byId(id));
    return {
      selection: visible(byId('ide-topbar-selection')) || visible(document.querySelector('.wb-cmdbar-search')),
      primary: visible(byId('ide-topbar-save-btn')),
      saveState: visible(byId('ide-save-state')),
      saveWord: (() => {
        const label = document.querySelector('[data-testid="ide-save-state"] .wb-cmdbar-fact-label');
        return Boolean(label && label.getBoundingClientRect().width > 4);
      })(),
      project: visible(document.querySelector('.wb-cmdbar-project-text')),
      target: visible(byId('ide-topbar-target')) || inMenu('ide-menu-compact-target'),
      commands: visible(byId('ide-menu-file')) || visible(compactMenu),
      mark: (() => {
        const svg = document.querySelector('.wb-cmdbar-brand svg');
        return Boolean(svg && svg.getBoundingClientRect().width > 4);
      })(),
    };
  });
  for (const [key, ok] of Object.entries(six)) {
    if (!ok) note(`${at} ${key} did not survive`);
  }

  // ── Text that is cut must be recoverable ──────────────────────────────────
  const unrecoverable = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="ide-top-bar"]');
    const out = [];
    for (const el of bar.querySelectorAll('*')) {
      if (el.children.length) continue;
      const text = (el.textContent ?? '').trim();
      if (!text) continue;
      const cut = el.scrollWidth - el.clientWidth;
      if (cut <= 1) continue;
      const holder = el.closest('[title], [aria-label]');
      if (!holder) out.push(`${text.slice(0, 24)} (+${cut}px)`);
    }
    return out;
  });
  if (unrecoverable.length) {
    note(`${at} clipped with no title or label to recover it: ${unrecoverable.join('; ')}`);
  }

  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  if (overflow.doc > 0 || overflow.body > 0) {
    note(`${at} the document scrolls sideways: ${JSON.stringify(overflow)}`);
  }
  return { collisions: collisions.length, six, overflow };
}

async function checkTransport(page, at) {
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-verify-command-bar'), { timeout: 12000 });
  await page.waitForTimeout(1200);
  const facts = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="ide-verify-command-bar"]');
    const seg = document.querySelector('[data-testid="ide-vcb-run-intent"]');
    const run = document.querySelector('[data-testid="ide-vcb-run"]');
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const segR = rect(seg);
    const runR = rect(run);
    // "Same row" means the two boxes share vertical space, not that their tops match - the
    // controls are different heights.
    const sameRow = segR && runR && Math.min(segR.bottom, runR.bottom) - Math.max(segR.top, runR.top) > 4;
    return {
      barHeight: Math.round(bar.getBoundingClientRect().height),
      segClipped: seg ? seg.scrollWidth - seg.clientWidth : null,
      runVisible: Boolean(runR && runR.width > 4 && runR.right <= window.innerWidth),
      sameRow: Boolean(sameRow),
    };
  });
  if (facts.segClipped === null) note(`${at} the run intent is absent`);
  else if (facts.segClipped > 1) note(`${at} the run intent is clipped by ${facts.segClipped}px`);
  if (!facts.runVisible) note(`${at} the primary run action is not on screen`);
  if (!facts.sameRow) note(`${at} the primary run action is orphaned from the run intent`);
  return facts;
}

for (const [root, w, h] of [[16, 1440, 900], [16, 1366, 768], [32, 1440, 900], [32, 1366, 768], [16, 1024, 720]]) {
  const at = `[${w}x${h} root ${root}px]`;
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await open(context, root);
  const frame = await checkFrame(page, at);
  const transport = await checkTransport(page, at);
  console.log(
    `${at} bar collisions ${frame.collisions}, six ${Object.values(frame.six).filter(Boolean).length}/8, `
    + `overflow ${frame.overflow.doc}, transport ${transport.barHeight}px `
    + `intent-clip ${transport.segClipped} run-with-intent ${transport.sameRow}`
  );
  await context.close();
}
await browser.close();

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log('\nPASS — the frame keeps its six priorities, its controls own their own boxes, and the transport keeps intent and action together at every size.');
