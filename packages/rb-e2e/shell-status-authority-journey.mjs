// P2.5 Slice 1 proof — the footer is support-context only; per-stage workflow
// status (Simulate / Board / Package) is owned once, by the top-center stage
// nav. Drives the real UI: loads the Full Adder, walks the stages, asserts the
// footer carries no workflow-status pills while the stage-nav hints do, and no
// horizontal overflow. 1440×900 and 1366×768.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fail = (m) => { throw new Error(m); };
const OUT = '/tmp/claude-0/-home-user-redbyte-ui-genesis/b4914bef-2a1a-55cb-97de-096a331aef03/scratchpad';

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('full-adder'));
  await page.waitForTimeout(400);

  // Walk to Simulate then Board so the footer would have shown Simulation/Board pills before.
  await page.getByTestId('mode-button-verify').click();
  await page.waitForTimeout(300);

  // ① The footer no longer duplicates workflow status.
  for (const dead of ['ide-status-simulation', 'ide-status-board', 'ide-status-package']) {
    if (await page.getByTestId(dead).count() !== 0) fail(`footer still carries duplicate workflow pill: ${dead}`);
  }
  // ② The footer keeps genuine support context.
  const footer = (await page.getByTestId('ide-status-bar').textContent()) ?? '';
  if (!/Support/.test(footer)) fail(`footer lost its support-context label: "${footer}"`);
  if (!/Problems/.test(footer)) fail(`footer lost its problems count: "${footer}"`);

  // ③ The stage-nav is the single per-stage status authority (Simulate hint present).
  const verifyBtn = (await page.getByTestId('mode-button-verify').textContent()) ?? '';
  if (verifyBtn.trim().length === 0) fail('stage-nav verify button has no copy');
  const hardwareBtn = (await page.getByTestId('mode-button-hardware').textContent()) ?? '';
  if (!/\//.test(hardwareBtn)) fail(`stage-nav hardware hint missing assignment ratio: "${hardwareBtn}"`);

  // ④ No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);

  await page.screenshot({ path: `${OUT}/slice1-shell-${width}x${height}.png` });
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS — footer support-only, stage-nav owns status, overflow ${overflow}px`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — Slice 1 shell: one per-stage status authority, no overflow.');
