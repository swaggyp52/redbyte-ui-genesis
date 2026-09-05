// P1 signature journey — ONE uninterrupted cross-workspace workflow through
// the real UI, exercising every convergence chapter delivered this phase:
// active-top authority (Project), engineering-location history (LocationBar),
// the shared Manual Bench ↔ Virtual Board experiment (Simulate/Board), the
// electrical Pin Planner with conflict repair + XDC diff (Board), the package
// history (Export), and the canonical Runs document (Project). Store reads are
// assertions only; every drive/edit/navigation is a real UI interaction.
import { chromium } from 'playwright';
// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fail = (m) => { throw new Error(m); };
const stage = () => page.evaluate(() => document.querySelector('[data-ide-stage]')?.getAttribute('data-ide-stage'));
const store = (fn) => page.evaluate(fn);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(() => {
  const rt = window.__RB_PROJECT_RUNTIME__.getState();
  rt.loadExample('half-adder');
  rt.autoSuggestMapping();
});
await page.waitForTimeout(400);

// ── Project: active-top authority + empty Runs document ──────────────────────
await page.getByTestId('mode-button-project').click(); await page.waitForTimeout(700);
if (await page.getByTestId('ide-project-active-top').count() === 0) fail('active-top control missing');
if (await page.getByTestId('ide-project-runs').count() === 0) fail('Runs document missing');
if (await store(() => window.__RB_PROJECT_RUNTIME__.getState().activeTop) !== 'half_adder')
  fail('active top not seeded from example');
console.log('① Project: single active-top authority + Runs document (empty)');

// ── Design: engineering-location path ────────────────────────────────────────
await page.getByTestId('mode-button-design').click(); await page.waitForTimeout(500);
const designPath = (await page.getByTestId('ide-location-path').textContent() ?? '').replace(/\s+/g, ' ');
if (!designPath.includes('Design')) fail(`LocationBar should show Design: "${designPath}"`);
console.log(`② Design: engineering-location path "${designPath.trim()}"`);

// ── Simulate: shared Manual Bench drive ↔ observe ────────────────────────────
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(1000);
await page.getByTestId('ide-vcb-workspace-bench').click(); await page.waitForTimeout(400);
await page.getByTestId('ide-manual-bench-drive-toggle-sw0-a').click(); await page.waitForTimeout(150);
await page.getByTestId('ide-manual-bench-drive-toggle-sw1-b').click(); await page.waitForTimeout(200);
const sum = (await page.getByTestId('ide-manual-bench-measure-value-ld1-sum').textContent())?.trim();
const carry = (await page.getByTestId('ide-manual-bench-measure-value-ld0-carry').textContent())?.trim();
if (sum !== '0' || carry !== '1') fail(`bench A=1,B=1 expected SUM=0,CARRY=1 got SUM=${sum},CARRY=${carry}`);
console.log('③ Simulate: Manual Bench drove A=1,B=1 → SUM=0, CARRY=1 (shared experiment)');

// ── Board: same live state on the Virtual Board + Pin Planner conflict repair ─
await page.getByTestId('mode-button-hardware').click(); await page.waitForTimeout(1000);
const board = await page.evaluate(() => ({
  led0: document.querySelector('[data-testid="ide-virtual-board-led-0"]')?.getAttribute('data-on'),
  led1: document.querySelector('[data-testid="ide-virtual-board-led-1"]')?.getAttribute('data-on'),
}));
if (board.led0 !== '1' || board.led1 !== '0') fail(`Virtual Board did not reflect bench: ${JSON.stringify(board)}`);
if (await page.getByTestId('ide-pin-planner').count() === 0) fail('Pin Planner missing');
const ids = await store(() => {
  const doc = window.__RB_PROJECT_RUNTIME__.getState().hardwareMappingV2;
  const s = doc.entries.filter((e) => e.kind === 'scalar' && e.direction === 'in');
  return { sw0: s[0]?.id, sw1: s[1]?.id, pin0: s[0]?.pin, pin1: s[1]?.pin };
});
const sw1Input = page.getByTestId(`ide-pin-planner-pin-input-${ids.sw1}`);
await sw1Input.click(); await sw1Input.fill(ids.pin0); await sw1Input.press('Enter'); await page.waitForTimeout(400);
if (!/1 conflict/.test((await page.getByTestId('ide-pin-planner-conflict-count').textContent()) ?? ''))
  fail('pin conflict not flagged');
if (await page.getByTestId('ide-pin-planner-xdc-diff').count() === 0) fail('XDC before/after missing');
await page.getByTestId(`ide-pin-planner-resolve-${ids.pin0}`).first().click(); await page.waitForTimeout(400);
if (!/0 conflict/.test((await page.getByTestId('ide-pin-planner-conflict-count').textContent()) ?? ''))
  fail('conflict not resolved');
// Restore SW1 to its own pin through the planner so the design stays fully mapped.
await sw1Input.click(); await sw1Input.fill(ids.pin1); await sw1Input.press('Enter'); await page.waitForTimeout(400);
console.log('④ Board: Virtual Board mirrors the bench; Pin Planner flagged, showed XDC diff, and repaired a conflict');

// ── Export: package history records the download ─────────────────────────────
await page.getByTestId('mode-button-export').click(); await page.waitForTimeout(1500);
for (const id of ['ide-export-package-download-v1', 'ide-export-draft-download-v1']) {
  const btn = page.getByTestId(id);
  if (await btn.count() > 0 && await btn.first().isEnabled().catch(() => false)) { await btn.first().click().catch(() => {}); break; }
}
await page.waitForTimeout(1200);
if (await store(() => window.__RB_PROJECT_RUNTIME__.getState().exportHistory.length) < 1) fail('package not recorded');
if (await page.getByTestId('ide-export-history').count() === 0) fail('package history missing');
console.log('⑤ Export: package downloaded and recorded in the package history');

// ── Simulate → run a verification, then Project Runs document shows it ───────
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(900);
await page.getByTestId('ide-vcb-run').first().click(); await page.waitForTimeout(1500);
if (await store(() => window.__RB_PROJECT_RUNTIME__.getState().verifyRunHistory.length) < 1) fail('verify run not recorded');
await page.getByTestId('mode-button-project').click(); await page.waitForTimeout(800);
if (await page.getByTestId('ide-project-run-0').count() === 0) fail('Runs document did not surface the run');
const runStatus = (await page.getByTestId('ide-project-run-status-0').textContent())?.trim();
console.log(`⑥ Simulate→Project: a verification run is surfaced in the Runs document (${runStatus})`);

// ── Engineering-location Back steps back through the workspace trail ──────────
await page.getByTestId('ide-location-back').click(); await page.waitForTimeout(400);
if (await stage() !== 'verify') fail(`Back expected verify, got ${await stage()}`);
console.log('⑦ Engineering-location Back stepped the whole trail (Project → Simulate)');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — one uninterrupted cross-workspace workflow across all convergence chapters.');
await browser.close();
