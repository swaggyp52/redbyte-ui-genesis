// Visual evidence capture - a tool, not a journey.
//
// It asserts nothing and can never fail a gate: it loads one fixture, walks the five
// workspaces and writes a screenshot per state, so a wave can be compared before and after.
// Kept beside the journeys because it needs the same harness (browser resolution, base URL,
// evidence directory), and named so the journey inventory can tell the two apart.
//
// RB_SHOT_LABEL  evidence subdirectory (default 'after')
// RB_ROOT_PX     document root font size, for text-enlargement states (default 16)
// RB_MODES       comma-separated workspaces (default all five)
// RB_SIZES       comma-separated WxH viewports (default 1440x900,1366x768)
import { BASE_URL, launchChromium, evidenceDir } from './harness.mjs';
import path from 'node:path';

const label = process.env.RB_SHOT_LABEL ?? 'after';
const ROOT_PX = Number(process.env.RB_ROOT_PX ?? '16');
const MODES = (process.env.RB_MODES ?? 'project,design,verify,hardware,export').split(',');
const SIZES = (process.env.RB_SIZES ?? '1440x900,1366x768').split(',').map((s) => s.split('x').map(Number));
const OUT = evidenceDir('visual-craft', label);
const tid = (id) => `[data-testid="${id}"]`;
const browser = await launchChromium();

async function shoot(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const tag = `${width}x${height}`;
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('full-adder'));
    await page.waitForTimeout(700);
    if (ROOT_PX !== 16) await page.addStyleTag({ content: `html { font-size: ${ROOT_PX}px !important; }` });
    await page.waitForTimeout(500);
    for (const mode of MODES) {
      await page.click(tid(`mode-button-${mode}`));
      await page.waitForTimeout(1600);
      if (mode === 'design') {
        const n = page.locator('[data-node-id]').first();
        if (await n.count()) { await n.click({ force: true }); await page.waitForTimeout(700); }
      }
      await page.screenshot({ path: path.join(OUT, `${tag}${ROOT_PX === 16 ? '' : `-r${ROOT_PX}`}-${mode}.png`) });
    }
  } finally {
    await context.close();
  }
}

try {
  for (const [w, h] of SIZES) await shoot(w, h);
  console.log('captures in', OUT);
} finally {
  await browser.close();
}
