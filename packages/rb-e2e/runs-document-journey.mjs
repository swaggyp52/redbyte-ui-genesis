// P1-B — the Runs document projects the store's verify run ledger into the
// Project workspace. Through the real UI: run a verification in Simulate, then
// open Project and confirm the run appears in the Runs document. The store is
// read only to confirm the ledger grew; the run trigger and the Runs list are
// real UI.
import { chromium } from 'playwright';
// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fail = (m) => { throw new Error(m); };
const ledgerLen = () => page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyRunHistory.length);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
await page.waitForTimeout(400);

if (await ledgerLen() !== 0) fail('expected an empty run ledger at start');

// ── Project: Runs document is empty before any run ───────────────────────────
await page.getByTestId('mode-button-project').click(); await page.waitForTimeout(700);
if (await page.getByTestId('ide-project-runs').count() === 0) fail('Runs document not rendered');
if (await page.getByTestId('ide-project-runs-empty').count() === 0) fail('Runs document should show empty state');
let count = (await page.getByTestId('ide-project-runs-count').textContent())?.trim();
if (count !== 'None yet') fail(`empty count expected "None yet", got "${count}"`);
console.log('① Runs document renders in Project; empty before any run');

// ── Simulate: run a verification (records a ledger entry) ────────────────────
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(1200);
const runBtn = page.getByTestId('ide-vcb-run');
if (await runBtn.count() === 0) fail('Simulate Run button not found');
await runBtn.first().click(); await page.waitForTimeout(1500);
if (await ledgerLen() < 1) fail(`run did not record a ledger entry (len=${await ledgerLen()})`);
console.log(`② ran verification in Simulate → ledger has ${await ledgerLen()} entry`);

// ── Project: the run now appears in the Runs document ────────────────────────
await page.getByTestId('mode-button-project').click(); await page.waitForTimeout(800);
count = (await page.getByTestId('ide-project-runs-count').textContent())?.trim();
if (!count || !/recorded/.test(count)) fail(`Runs count should say "N recorded", got "${count}"`);
if (await page.getByTestId('ide-project-run-0').count() === 0) fail('Runs document shows no run row after a run');
const status0 = (await page.getByTestId('ide-project-run-status-0').textContent())?.trim();
if (status0 !== 'PASS' && status0 !== 'FAIL') fail(`run row status unexpected: "${status0}"`);
console.log(`③ Runs document now shows "${count}"; newest run status = ${status0}`);

// Run a second time so change-tracking has a prior run to compare against.
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(800);
await page.getByTestId('ide-vcb-run').first().click(); await page.waitForTimeout(1500);
await page.getByTestId('mode-button-project').click(); await page.waitForTimeout(700);
count = (await page.getByTestId('ide-project-runs-count').textContent())?.trim();
console.log(`④ after a second run the Runs document reports "${count}"`);

// Open Simulate from the Runs document (the actionable link).
await page.getByTestId('ide-project-runs-open-verify').click(); await page.waitForTimeout(700);
const stage = await page.evaluate(() => document.querySelector('[data-ide-stage]')?.getAttribute('data-ide-stage'));
if (stage !== 'verify') fail(`Open Simulate from Runs expected verify, got ${stage}`);
console.log('⑤ "Open Simulate" from the Runs document navigates to Simulate');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — the Runs document projects the verify ledger into Project and is actionable.');
await browser.close();
