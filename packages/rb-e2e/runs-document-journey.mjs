// P1-B — the Runs document projects the store's verify run ledger into the
// Project workspace. Through the real UI: run a verification in Simulate, then
// open Project, click the "Runs" document in the Project explorer, and confirm
// the run appears in the Runs document. The store is read only to confirm the
// ledger grew and that the document projects it faithfully; the run trigger,
// the document navigation and the Runs list are real UI.
import { chromium } from 'playwright';
// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fail = (m) => { throw new Error(m); };
const ledger = () => page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyRunHistory);
const ledgerLen = async () => (await ledger()).length;

// P2.5 grammar: entering Project opens the Overview document; a document row in
// the Project explorer must be CLICKED to open its document.
const openRunsDocument = async () => {
  await page.getByTestId('ide-project-row-doc:runs').click();
  await page.waitForTimeout(400);
};
// The Runs document header states the ledger size ("N recorded · browser simulation only").
const runsMeta = async () =>
  ((await page.locator('[data-testid="ide-project-runs-document"] .rb-doc-header .wb-toolbar-meta').textContent()) ?? '').trim();
const runRows = () => page.locator('[data-testid="ide-project-runs-table"] tbody tr[data-testid^="ide-project-run-"]');

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
await page.waitForTimeout(400);

if (await ledgerLen() !== 0) fail('expected an empty run ledger at start');

// ── Project: Runs document is empty before any run ───────────────────────────
await page.getByTestId('mode-button-project').click(); await page.waitForTimeout(700);
await openRunsDocument();
if (await page.getByTestId('ide-project-runs-document').count() === 0) fail('Runs document not rendered');
if (await runRows().count() !== 0) fail('Runs document should list no runs before any run');
const emptyCell = page.locator('[data-testid="ide-project-runs-table"] td.wb-table-empty');
if (await emptyCell.count() === 0) fail('Runs document should show its empty state before any run');
const emptyText = ((await emptyCell.textContent()) ?? '').trim();
if (!/no runs recorded yet/i.test(emptyText)) fail(`empty state did not name the missing evidence: "${emptyText}"`);
let meta = await runsMeta();
if (!/^0 recorded\b/.test(meta)) fail(`empty Runs header expected "0 recorded…", got "${meta}"`);
console.log('① Runs document opens from the Project explorer; empty before any run');

// ── Simulate: run a verification (records a ledger entry) ────────────────────
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(1200);
const runBtn = page.getByTestId('ide-vcb-run');
if (await runBtn.count() === 0) fail('Simulate Run button not found');
await runBtn.first().click(); await page.waitForTimeout(1500);
if (await ledgerLen() < 1) fail(`run did not record a ledger entry (len=${await ledgerLen()})`);
console.log(`② ran verification in Simulate → ledger has ${await ledgerLen()} entry`);

// ── Project: the run now appears in the Runs document ────────────────────────
await page.getByTestId('mode-button-project').click(); await page.waitForTimeout(800);
await openRunsDocument();
meta = await runsMeta();
if (!/^1 recorded\b/.test(meta)) fail(`Runs header should say "1 recorded", got "${meta}"`);
let entries = await ledger();
let newest = entries[entries.length - 1];
// Newest first: the top row must be the run the store just recorded.
const topRowId = await runRows().first().getAttribute('data-testid');
if (topRowId !== `ide-project-run-${newest.runId}`) {
  fail(`Runs document does not show the newest run first (top row ${topRowId}, newest ${newest.runId})`);
}
// The result cell must project the ledger's own verdict, in today's vocabulary:
// a compare run reads PASS/FAIL, an observe run reads "observed".
const isCompare = newest.runKind ? newest.runKind === 'verify' : newest.passedRows + newest.failedRows > 0;
const expectedResult = isCompare ? (newest.status === 'pass' ? 'PASS' : 'FAIL') : 'observed';
const status0 = ((await runRows().first().locator('td').first().textContent()) ?? '').trim();
if (status0 !== expectedResult) fail(`run row result "${status0}" does not project the ledger verdict "${expectedResult}"`);
// The state word is the runtime's own staleness authority; a just-recorded run is current.
const stateWord = ((await runRows().first().locator('td').nth(7).textContent()) ?? '').trim();
if (stateWord !== 'current') fail(`a just-recorded run should read "current", got "${stateWord}"`);
console.log(`③ Runs document now reports "${meta}"; newest run result = ${status0} (${stateWord})`);

// Run a second time so change-tracking has a prior run to compare against.
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(800);
await page.getByTestId('ide-vcb-run').first().click(); await page.waitForTimeout(1500);
await page.getByTestId('mode-button-project').click(); await page.waitForTimeout(700);
await openRunsDocument();
meta = await runsMeta();
if (!/^2 recorded\b/.test(meta)) fail(`after a second run the Runs header should say "2 recorded", got "${meta}"`);
const rowCount = await runRows().count();
if (rowCount !== 2) fail(`Runs document should list 2 runs, listed ${rowCount}`);
entries = await ledger();
newest = entries[entries.length - 1];
if ((await runRows().first().getAttribute('data-testid')) !== `ide-project-run-${newest.runId}`) {
  fail('the second run is not at the top of the Runs document');
}
// The earlier run must say it was superseded — the ledger is a history, not one result.
const priorState = ((await runRows().nth(1).locator('td').nth(7).textContent()) ?? '').trim();
if (priorState !== 'superseded') fail(`the earlier run should read "superseded", got "${priorState}"`);
console.log(`④ after a second run the Runs document reports "${meta}"; the earlier run is ${priorState}`);

// Open Simulate from the Runs document (the actionable link).
await page.getByTestId('ide-project-runs-open-simulate').click(); await page.waitForTimeout(700);
const stage = await page.evaluate(() => document.querySelector('[data-ide-stage]')?.getAttribute('data-ide-stage'));
if (stage !== 'verify') fail(`Open Simulate from Runs expected verify, got ${stage}`);
console.log('⑤ "Open Simulate" from the Runs document navigates to Simulate');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — the Runs document projects the verify ledger into Project and is actionable.');
await browser.close();
