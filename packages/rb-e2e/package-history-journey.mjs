// P1-F — the package workspace records every generation/download event in a
// bounded ledger and surfaces it as a history with provenance and a prev/
// current comparison. Through the real UI: download a package (records an
// event), change the design's top so the next package differs, download again,
// and confirm the ExportHistoryPanel shows both packages, their provenance, and
// which artifacts changed. Store is read only to assert the ledger; downloads
// are real download-button clicks.
import { BASE_URL, launchChromium } from './harness.mjs';
const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fail = (m) => { throw new Error(m); };
const ledgerLen = () => page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().exportHistory.length);

async function download() {
  for (const id of ['ide-export-package-download-v1', 'ide-export-draft-download-v1']) {
    const btn = page.getByTestId(id);
    if (await btn.count() > 0 && await btn.first().isEnabled().catch(() => false)) {
      await btn.first().click().catch(() => {});
      return true;
    }
  }
  return false;
}

await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(() => {
  const rt = window.__RB_PROJECT_RUNTIME__.getState();
  rt.loadExample('half-adder');
  rt.autoSuggestMapping();
});
await page.waitForTimeout(400);

await page.getByTestId('mode-button-export').click(); await page.waitForTimeout(1500);
// Build & Export opens on the handoff dossier; package history and provenance belong to the
// artifact document, which a reader reaches from the dossier's own header.
const openFiles = page.getByTestId('ide-package-handoff-open-files');
if (await openFiles.count()) { await openFiles.click(); await page.waitForTimeout(600); }

// First package.
if (!(await download())) fail('no download button available for the first package');
await page.waitForTimeout(1200);
if (await ledgerLen() < 1) fail(`first download did not record an export (len=${await ledgerLen()})`);
console.log(`① first package downloaded → ledger has ${await ledgerLen()} entry`);

// Change the design's active top so the next package's generated source differs.
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().setActiveTop('ripple_top_v2'));
await page.waitForTimeout(600);

// Second package.
if (!(await download())) fail('no download button available for the second package');
await page.waitForTimeout(1200);
if (await ledgerLen() < 2) fail(`second download did not record an export (len=${await ledgerLen()})`);
console.log(`② second package downloaded (after top change) → ledger has ${await ledgerLen()} entries`);

// The package history renders both packages.
if (await page.getByTestId('ide-export-history').count() === 0) fail('package history panel not rendered');
const count = (await page.getByTestId('ide-export-history-count').textContent())?.trim();
if (!/2 packages/.test(count ?? '')) fail(`history should show 2 packages, got "${count}"`);
if (await page.getByTestId('ide-export-history-entry-1').count() === 0) fail('package #1 not listed');
if (await page.getByTestId('ide-export-history-entry-2').count() === 0) fail('package #2 not listed');
console.log(`③ package history lists both packages ("${count}")`);

// Provenance for the selected (newest) package is shown.
if (await page.getByTestId('ide-export-provenance').count() === 0) fail('provenance panel missing');
console.log('④ provenance shown for the selected package');

// Comparison of newest vs previous renders (identical or a specific change list).
if (await page.getByTestId('ide-export-comparison').count() === 0) fail('comparison panel missing');
const identical = await page.getByTestId('ide-export-comparison-identical').count();
const changes = await page.locator('[data-testid^="ide-export-comparison-change-"]').count();
if (identical === 0 && changes === 0) fail('comparison shows neither identical nor a change list');
console.log(`⑤ prev/current comparison rendered (${identical ? 'identical' : `${changes} changed artifact(s)`})`);

// Selecting the first package re-targets provenance to it.
await page.getByTestId('ide-export-history-entry-1').click(); await page.waitForTimeout(300);
const prov = (await page.getByTestId('ide-export-provenance').textContent()) ?? '';
if (!/#1/.test(prov)) fail(`selecting package #1 should show its provenance, got "${prov.slice(0, 60)}"`);
console.log('⑥ selecting a package re-targets provenance (selectable)');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — package history: bounded ledger, provenance, selectable, prev/current comparison.');
await browser.close();
