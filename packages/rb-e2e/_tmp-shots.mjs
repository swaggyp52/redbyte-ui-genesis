// Exact-state captures for the visual craft campaign.
import { BASE_URL, launchChromium, evidenceDir } from './harness.mjs';
import path from 'node:path';

const label = process.env.RB_SHOT_LABEL ?? 'after';
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
    for (const mode of ['project', 'design', 'verify', 'hardware', 'export']) {
      await page.click(tid(`mode-button-${mode}`));
      await page.waitForTimeout(1600);
      if (mode === 'design') {
        const n = page.locator('[data-node-id]').first();
        if (await n.count()) { await n.click({ force: true }); await page.waitForTimeout(700); }
      }
      await page.screenshot({ path: path.join(OUT, `${tag}-${mode}.png`) });
    }
  } finally {
    await context.close();
  }
}

try {
  await shoot(1440, 900);
  await shoot(1366, 768);
  console.log('captures in', OUT);
} finally {
  await browser.close();
}
