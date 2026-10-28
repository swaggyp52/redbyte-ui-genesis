// Every stage of a loaded lab at the four classroom viewports, in the light and the dark theme,
// at the default and an enlarged root text size. A student-visible layout defect fails the sweep:
// the page scrolling sideways, text drawn over other text, a status-line control drawn over another
// or cut off at the edge, or text below WCAG 1.4.3 contrast (4.5:1, 3:1 for large text). A short
// window at double text size checks the status line, where Show left / right panel live.
// Not inspected: text inside svg and canvas drawings (the schematic, board views, waveforms and
// figures; the Design, Board and Simulate journeys own those), and the painted-order test cannot
// see elements with pointer-events: none.
import fs from 'node:fs';
import path from 'node:path';
import { BASE_URL, evidenceDir, launchChromium } from './harness.mjs';

const out = evidenceDir('responsive-theme-sweep', process.env.RB_SHOT_LABEL ?? 'current');
fs.mkdirSync(out, { recursive: true });
const VIEWPORTS = [[1440, 900], [1366, 768], [1280, 650], [720, 450]];
const THEMES = ['light', 'dark'];
const ROOTS = [16, 24];
const STAGES = ['project', 'design', 'verify', 'hardware', 'export'];

const browser = await launchChromium();
const report = [];
const failures = [];

function inspect(stage) {
  const excluded = (el) => Boolean(el.closest('svg, canvas, [data-testid="ide-design-canvas"], [data-testid="ide-recorded-circuit"], [aria-hidden="true"], .rb-sim-region--waveform'));
  const visible = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      if (node.tagName === 'DETAILS' && !node.open && node !== el && !el.closest('summary')) return false;
    }
    return true;
  };
  const clipOf = (el) => {
    let clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/auto|scroll|hidden|clip/.test(style.overflowX + style.overflowY)) {
        const r = parent.getBoundingClientRect();
        clip = { left: Math.max(clip.left, r.left), top: Math.max(clip.top, r.top), right: Math.min(clip.right, r.right), bottom: Math.min(clip.bottom, r.bottom) };
      }
    }
    return clip;
  };
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || !node.textContent.trim() || excluded(el) || !visible(el)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const clip = clipOf(el);
    for (const r of range.getClientRects()) {
      const box = { left: Math.max(r.left, clip.left), top: Math.max(r.top, clip.top), right: Math.min(r.right, clip.right), bottom: Math.min(r.bottom, clip.bottom) };
      if (box.right - box.left > 2 && box.bottom - box.top > 2) texts.push({ el, box, text: node.textContent.trim().slice(0, 40) });
    }
  }
  // Two runs of text from unrelated elements painting over each other. A small tolerance absorbs
  // line-height slack between stacked lines.
  const overlaps = [];
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = texts[i], b = texts[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
      const h = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
      if (w > 3 && h > 4) {
        // Painted order decides whether the reader sees both: only report when both are actually painted there.
        const x = Math.max(a.box.left, b.box.left) + w / 2, y = Math.max(a.box.top, b.box.top) + h / 2;
        const stack = document.elementsFromPoint(x, y);
        const aPainted = stack.some((n) => n === a.el || a.el.contains(n));
        const bPainted = stack.some((n) => n === b.el || b.el.contains(n));
        const top = stack[0];
        const opaqueCover = top && !(top === a.el || a.el.contains(top) || top === b.el || b.el.contains(top));
        if (aPainted && bPainted && !opaqueCover) overlaps.push(`"${a.text}" x "${b.text}" (${Math.round(w)}x${Math.round(h)} at ${Math.round(x)},${Math.round(y)})`);
      }
    }
  }
  const ink = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (color) => { ink.clearRect(0, 0, 1, 1); ink.fillStyle = 'rgba(0,0,0,0)'; ink.fillStyle = color; ink.fillRect(0, 0, 1, 1); const [r, g, b, a] = ink.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255]; };
  const lum = (c) => c.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const lowContrast = [];
  const seen = new Set();
  for (const { el, box, text } of texts) {
    if (seen.has(el)) continue;
    seen.add(el);
    const style = getComputedStyle(el);
    if (el.closest(':disabled, [aria-disabled="true"]')) continue; // 1.4.3 exempts inactive controls
    let background = [255, 255, 255];
    const chain = [];
    for (let node = el; node; node = node.parentElement) chain.push(node);
    for (const node of chain.reverse()) {
      const s = getComputedStyle(node);
      const layer = rgba(s.backgroundColor);
      const alpha = layer[3] * Number(s.opacity);
      if (alpha > 0) background = layer.slice(0, 3).map((v, i) => v * alpha + background[i] * (1 - alpha));
    }
    const fgLayer = rgba(style.color);
    const fg = fgLayer.slice(0, 3).map((v, i) => v * fgLayer[3] + background[i] * (1 - fgLayer[3]));
    const [l1, l2] = [lum(fg), lum(background)];
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) lowContrast.push({ text, ratio: Math.round(ratio * 100) / 100, size, testid: el.closest('[data-testid]')?.getAttribute('data-testid') ?? null, at: [Math.round(box.left), Math.round(box.top)] });
  }
  // The status line: no control drawn over another, none outside the bar.
  const statusLine = [];
  const bar = document.querySelector('[data-testid="ide-status-bar"]');
  if (bar) {
    const edge = bar.getBoundingClientRect();
    const controls = [...bar.querySelectorAll('button')].filter((button) => visible(button)).map((button) => ({
      label: (button.getAttribute('aria-label') || button.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
      r: button.getBoundingClientRect(),
    }));
    for (const { label, r } of controls) {
      if (r.left < edge.left - 0.5 || r.right > edge.right + 0.5 || r.top < edge.top - 0.5 || r.bottom > edge.bottom + 0.5) statusLine.push(`"${label}" outside the status line`);
    }
    for (let i = 0; i < controls.length; i += 1) {
      for (let j = i + 1; j < controls.length; j += 1) {
        const a = controls[i].r, b = controls[j].r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 0.5 && h > 0.5) statusLine.push(`"${controls[i].label}" x "${controls[j].label}" (${Math.round(w)}px)`);
      }
    }
  }
  return {
    inspected: texts.length,
    // Text the stage's own workspace renders (drawn or scrolled out of view alike): zero while only
    // its loading placeholder is up.
    inspectedInStage: (() => {
      const root = document.querySelector(`[data-testid="ide-mode-${stage}"]`);
      if (!root) return 0;
      let count = 0;
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walk.nextNode(); node; node = walk.nextNode()) if (node.textContent.trim() && node.parentElement && visible(node.parentElement)) count += 1;
      return count;
    })(),
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    overlaps,
    lowContrast,
    statusLine,
  };
}

async function openLab(page, colorScheme) {
  const tid = (id) => page.getByTestId(id);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  // A student opens a lab from the catalogue.
  await tid('ide-project-start-a-lab-primary').click();
  await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();
  const start = page.locator('[data-testid^="ide-project-gannon-lab-start-"]');
  if (await start.count()) await start.first().click();
  await page.waitForFunction(() => (window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.length ?? 0) > 0);
  // The workbench theme is chosen in the command palette (it does not follow the system by default).
  await page.keyboard.press('Control+k');
  await tid('ide-command-palette').waitFor({ state: 'visible' });
  await tid('ide-command-palette-query').fill(`Workbench ${colorScheme}`);
  await tid(`ide-command-theme.${colorScheme}`).click();
  await page.waitForFunction((t) => document.documentElement.getAttribute('data-rb-theme') === t, colorScheme);
  return page.evaluate(() => document.documentElement.getAttribute('data-rb-theme'));
}

async function showStage(page, stage) {
  await page.getByTestId(`mode-button-${stage}`).click();
  // The stage's own workspace, not its loading placeholder (Design, Simulate, Board and Package load
  // on first use), then the frame after its layout settles.
  await page.waitForFunction((s) => {
    const root = document.querySelector(`[data-testid="ide-mode-${s}"]`);
    if (document.querySelector('[data-testid="ide-root"]')?.getAttribute('data-ide-stage') !== s || !root) return false;
    if (document.querySelector('[data-testid="ide-surface-loading"]')) return false;
    // Shown, not fading in: some text of the stage's own is painted.
    const painted = (el) => { for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) === 0) return false; } return true; };
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walk.nextNode(); node; node = walk.nextNode()) if (node.textContent.trim() && node.parentElement && painted(node.parentElement)) return true;
    return false;
  }, stage);
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
}

try {
  for (const [width, height] of VIEWPORTS) {
    for (const colorScheme of THEMES) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const theme = await openLab(page, colorScheme);
      for (const root of ROOTS) {
        await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, root);
        for (const stage of STAGES) {
          await showStage(page, stage);
          const label = `${width}x${height}-${colorScheme}-${root}px-${stage}`;
          const found = await page.evaluate(inspect, stage);
          report.push({ label, theme, ...found, lowContrastCount: found.lowContrast.length });
          const problems = [];
          // A sweep that read none of the stage's own text proves nothing about the stage.
          if (found.inspectedInStage < 5) problems.push(`only ${found.inspectedInStage} runs of the stage's own text inspected`);
          if (found.horizontalOverflow > 1) problems.push(`page scrolls sideways by ${found.horizontalOverflow}px`);
          if (found.overlaps.length) problems.push(`text over text: ${found.overlaps.slice(0, 4).join('; ')}`);
          if (found.statusLine.length) problems.push(`status line: ${found.statusLine.slice(0, 4).join('; ')}`);
          if (found.lowContrast.length) problems.push(`text below 4.5:1 (3:1 large): ${found.lowContrast.slice(0, 4).map((entry) => `"${entry.text}" ${entry.ratio} (${entry.testid})`).join('; ')}`);
          if (theme !== colorScheme) problems.push(`theme ${theme} after choosing Workbench ${colorScheme}`);
          if (problems.length) {
            failures.push(`${label}: ${problems.join(' | ')}`);
            await page.screenshot({ path: path.join(out, `${label}.png`) });
          }
          console.log(`${label}: ${found.inspectedInStage}/${found.inspected} text runs in the stage, overflow ${found.horizontalOverflow}, overlaps ${found.overlaps.length}, status line ${found.statusLine.length}, low contrast ${found.lowContrast.length}`);
        }
      }
      await context.close();
    }
  }
  // Double text size in the short window: the status line wraps rather than drawing controls over
  // each other (rc.6 drew Show left panel over Hide bottom panel here).
  for (const stage of STAGES) {
    const context = await browser.newContext({ viewport: { width: 720, height: 450 }, colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await openLab(page, 'light');
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    await showStage(page, stage);
    const label = `720x450-light-32px-${stage}-status-line`;
    const found = await page.evaluate(inspect, stage);
    report.push({ label, statusLine: found.statusLine, horizontalOverflow: found.horizontalOverflow });
    const problems = [];
    if (found.horizontalOverflow > 1) problems.push(`page scrolls sideways by ${found.horizontalOverflow}px`);
    if (found.statusLine.length) problems.push(`status line: ${found.statusLine.slice(0, 4).join('; ')}`);
    if (problems.length) {
      failures.push(`${label}: ${problems.join(' | ')}`);
      await page.screenshot({ path: path.join(out, `${label}.png`) });
    }
    console.log(`${label}: overflow ${found.horizontalOverflow}, status line ${found.statusLine.length}`);
    await context.close();
  }
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ base: BASE_URL, failures, report }, null, 2));
  await browser.close();
}

if (failures.length) {
  console.error(`FAIL responsive/theme sweep: ${failures.length} configurations\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`PASS responsive/theme sweep: ${VIEWPORTS.length} viewports x ${THEMES.length} themes x ${ROOTS.length} text sizes x ${STAGES.length} stages, and the status line at 720x450 with 32px text -> ${out}`);
