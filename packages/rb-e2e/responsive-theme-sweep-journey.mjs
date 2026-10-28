// Every stage of a loaded lab at the four classroom viewports, in the light and the dark theme,
// at the default and an enlarged root text size. A student-visible layout defect fails the sweep:
// the page scrolling sideways, text drawn over other text, or chrome text below 3:1 contrast
// (1.4.11 floor; text below 4.5:1 is listed for review). The schematic sheet is excluded: its
// symbols are drawn by the student and covered by the Design journeys.
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

function inspect() {
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
  return {
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    overlaps,
    lowContrast,
  };
}

try {
  for (const [width, height] of VIEWPORTS) {
    for (const colorScheme of THEMES) {
      const context = await browser.newContext({ viewport: { width, height }, colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
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
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-rb-theme'));
      for (const root of ROOTS) {
        await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, root);
        for (const stage of STAGES) {
          await tid(`mode-button-${stage}`).click();
          await page.waitForFunction((s) => document.querySelector('[data-testid="ide-root"]')?.getAttribute('data-ide-stage') === s || document.querySelector(`[data-testid="ide-mode-${s}"]`), stage);
          await page.waitForTimeout(250);
          const label = `${width}x${height}-${colorScheme}-${root}px-${stage}`;
          const found = await page.evaluate(inspect);
          const severe = found.lowContrast.filter((entry) => entry.ratio < 3);
          report.push({ label, theme, ...found, lowContrastCount: found.lowContrast.length });
          const problems = [];
          if (found.horizontalOverflow > 1) problems.push(`page scrolls sideways by ${found.horizontalOverflow}px`);
          if (found.overlaps.length) problems.push(`text over text: ${found.overlaps.slice(0, 4).join('; ')}`);
          if (severe.length) problems.push(`text below 3:1: ${severe.slice(0, 4).map((entry) => `"${entry.text}" ${entry.ratio} (${entry.testid})`).join('; ')}`);
          if (theme !== colorScheme) problems.push(`theme ${theme} after choosing Workbench ${colorScheme}`);
          if (problems.length) {
            failures.push(`${label}: ${problems.join(' | ')}`);
            await page.screenshot({ path: path.join(out, `${label}.png`) });
          }
          console.log(`${label}: overflow ${found.horizontalOverflow}, overlaps ${found.overlaps.length}, <4.5:1 ${found.lowContrast.length}, <3:1 ${severe.length}`);
        }
      }
      await context.close();
    }
  }
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ base: BASE_URL, failures, report }, null, 2));
  await browser.close();
}

if (failures.length) {
  console.error(`FAIL responsive/theme sweep: ${failures.length} configurations\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`PASS responsive/theme sweep: ${VIEWPORTS.length} viewports x ${THEMES.length} themes x ${ROOTS.length} text sizes x ${STAGES.length} stages -> ${out}`);
