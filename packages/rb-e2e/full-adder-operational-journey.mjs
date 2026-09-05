// P2.5 — Full Adder operational acceptance journey (UI-only).
//
// Drives the REAL student workflow through the actual UI with zero project/store
// actions: first use -> Start a Lab -> Lab 3 Full Adder -> Design -> Simulate ->
// Compare PASS -> a runnable wrong-logic edit (gate swap) -> Compare FAIL with a
// concrete mismatch -> Trace in Design -> repair -> Compare PASS -> Board mapping loop
// (clear a pin, evidence goes stale, re-map by recommendation, evidence current again) ->
// Package: trusted build downloads a real ZIP (entries and SHA checked) -> reload keeps the
// run current, the mapping complete and the package ready. Runtime reads are assertions
// only; nothing is loaded, mutated, mapped, or exported through a store.
//
// Cross-platform: default Playwright browser resolution, repo-relative evidence
// directory, os-neutral paths. Runs at 1440x900 and 1366x768.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const EVIDENCE_DIR = path.resolve(
  REPO_ROOT,
  '.redbyte',
  'product-immersion',
  'p2-5-operational-workbench',
  'evidence'
);
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
const BASE = process.env.RB_E2E_URL || 'http://localhost:5173';

const tid = (t) => `[data-testid="${t}"]`;

/** Entry names from a ZIP buffer, read from the central directory (no dependency). */
function zipEntries(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a ZIP: no end-of-central-directory record');
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const names = [];
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error('corrupt central directory');
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    names.push(buf.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
const browser = await chromium.launch();

async function settleRun(page) {
  // Wait for the results summary to reflect a completed run (kind attribute set).
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="ide-verify-results-summary"]');
      return el && el.getAttribute('data-kind');
    },
    { timeout: 12000 }
  );
}

async function summaryKind(page) {
  return page.locator(tid('ide-verify-results-summary')).getAttribute('data-kind');
}
async function text(page, t) {
  return (await page.locator(tid(t)).textContent().catch(() => '')) ?? '';
}

async function run(width, height) {
  const label = `${width}x${height}`;
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
  const assert = (cond, msg) => { if (!cond) throw new Error(`[${label}] ${msg}`); };

  // ── A. FIRST USE ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector(tid('ide-project-start-a-lab-primary'), { timeout: 10000 });
  assert((await page.locator('main').count()) === 1, 'exactly one <main> landmark');

  // Start a Lab -> reveal the Gannon pack -> Lab 3 Full Adder details -> Start.
  await page.click(tid('ide-project-start-a-lab-primary'));
  await page.waitForSelector(tid('ide-project-gannon-lab-details-full-adder'), { state: 'visible', timeout: 8000 });
  await page.click(tid('ide-project-gannon-lab-details-full-adder'));
  await page.waitForSelector(tid('ide-project-gannon-lab-start-full-adder'), { state: 'visible', timeout: 8000 });
  const labCardText = await text(page, 'ide-project-gannon-lab-card-full-adder');
  assert(/full adder/i.test(labCardText), 'Lab 3 card identifies as Full Adder');
  await page.click(tid('ide-project-gannon-lab-start-full-adder'));

  // The lab loaded — the workspace switcher is a plain tab strip now (no per-stage
  // status subtitle), so the load is confirmed by the circuit itself in Phase B.
  await page.waitForSelector(tid('mode-button-design'), { timeout: 10000 });
  await page.waitForTimeout(1000);
  console.log(`[${label}] A. first use -> Start a Lab -> Lab 3 Full Adder loaded`);

  // ── B. DESIGN — the circuit is the focal object ───────────────────────────
  await page.click(tid('mode-button-design'));
  await page.waitForSelector(tid('node-XOR-xor2_node'), { timeout: 8000 });
  await page.click(tid('node-XOR-xor2_node'));
  await page.waitForSelector(tid('ide-design-swap-group'), { state: 'visible', timeout: 6000 });
  assert(await page.locator(tid('ide-design-swap-or')).count() > 0, 'inspector offers a compatible OR swap for the selected XOR gate');
  console.log(`[${label}] B. Design — selected SUM gate (XOR2); compatible gate swaps available`);

  // ── C. BASELINE COMPARE — PASS ────────────────────────────────────────────
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-vcb-use-saved-checks'), { timeout: 8000 });
  await page.click(tid('ide-vcb-use-saved-checks')); // explicitly select Compare intent
  assert((await page.locator(tid('ide-vcb-use-saved-checks')).getAttribute('aria-pressed')) === 'true', 'Compare intent selected');
  await page.click(tid('ide-vcb-run'));
  await settleRun(page);
  assert((await summaryKind(page)) === 'pass', `baseline Compare should PASS (got ${await summaryKind(page)})`);
  assert(/Compare passed/i.test(await text(page, 'ide-verify-results-summary')), 'PASS headline present');
  console.log(`[${label}] C. Simulate — Compare PASS on the correct Full Adder`);

  // ── D. RUNNABLE WRONG-LOGIC EDIT (gate swap XOR2 -> OR) ────────────────────
  await page.click(tid('mode-button-design'));
  await page.waitForSelector(tid('node-XOR-xor2_node'), { timeout: 8000 });
  await page.click(tid('node-XOR-xor2_node'));
  await page.waitForSelector(tid('ide-design-swap-or'), { state: 'visible', timeout: 6000 });
  await page.click(tid('ide-design-swap-or')); // SUM becomes XOR1 OR CIN — runnable but wrong
  await page.waitForSelector(tid('node-OR-xor2_node'), { timeout: 6000 });
  console.log(`[${label}] D. Design — swapped SUM gate XOR->OR (runnable wrong logic)`);

  // ── E. FAIL, DIAGNOSE, TRACE ──────────────────────────────────────────────
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-vcb-run'), { timeout: 8000 });
  // The prior PASS must be stale after the design edit.
  await page.click(tid('ide-vcb-run'));
  await settleRun(page);
  assert((await summaryKind(page)) === 'fail', `broken circuit should FAIL (got ${await summaryKind(page)})`);
  const failNav = await text(page, 'ide-verify-fail-nav-summary');
  assert(/LD1|SUM/i.test(failNav) && /expected/i.test(failNav) && /got/i.test(failNav),
    `first mismatch names signal + expected + observed (got "${failNav}")`);
  assert(await page.locator(tid('ide-sim-inspector-trace-design')).count() > 0, 'Trace-in-Design action present on FAIL');
  console.log(`[${label}] E. Simulate — Compare FAIL with concrete mismatch: "${failNav.trim()}"`);
  await page.click(tid('ide-sim-inspector-trace-design'));
  await page.waitForFunction(
    () => /mode=design/.test(location.href) || document.querySelector('[data-testid="node-OR-xor2_node"]'),
    undefined,
    { timeout: 8000 }
  );
  console.log(`[${label}] E. Trace in Design opened the Design surface`);

  // ── F. REPAIR + RERUN -> PASS ───────────────────────────────────────────────
  // Trace in Design arrives with the failing SIGNAL selected (LD1, the object the
  // check named); the inspector's Connectivity section names its driver, and one
  // click on that row selects the driving gate — the student follows the causality
  // upstream and repairs it via the compatible-gate swap. No store mutation.
  await page.waitForSelector(tid('node-OR-xor2_node'), { timeout: 8000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="node-OUTPUT-ld1_node"]')?.getAttribute('data-node-selected') === '1',
    undefined,
    { timeout: 8000 }
  );
  const driverRow = page.locator(tid('ide-design-driver-row-in'));
  await driverRow.waitFor({ state: 'visible', timeout: 6000 });
  assert(/XOR2|SUM/i.test(await driverRow.textContent()), 'Connectivity names the failing output\'s driver (XOR2 / SUM)');
  await driverRow.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="node-OR-xor2_node"]')?.getAttribute('data-node-selected') === '1',
    undefined,
    { timeout: 6000 }
  );
  console.log(`[${label}] F. Trace arrived on LD1; its driver row selected the SUM gate`);
  await page.waitForSelector(tid('ide-design-swap-xor'), { state: 'visible', timeout: 6000 });
  await page.click(tid('ide-design-swap-xor')); // repair: OR -> XOR
  await page.waitForSelector(tid('node-XOR-xor2_node'), { timeout: 6000 });
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-vcb-run'), { timeout: 8000 });
  await page.click(tid('ide-vcb-run'));
  await settleRun(page);
  assert((await summaryKind(page)) === 'pass', `repaired circuit should PASS again (got ${await summaryKind(page)})`);
  console.log(`[${label}] F. Repair (OR->XOR) -> Compare PASS again`);

  // ── G. BOARD & CONSTRAINTS — the mapping loop, and evidence that follows it ──
  await page.click(tid('mode-button-hardware'));
  await page.waitForSelector(tid('ide-hw-map-row-ld1'), { timeout: 8000 });
  assert(/Unassigned\s*0/i.test(await text(page, 'ide-hw-mapping-overview-unassigned')), 'Lab 3 starts fully mapped');
  await page.click(tid('ide-hw-map-row-ld1'));
  await page.waitForSelector(tid('ide-hw-clear-selected-resource'), { state: 'visible', timeout: 6000 });
  assert(/E19/.test(await text(page, 'ide-hw-xdc-line-ld1')), 'Constraints tool names LD1\'s package pin before the change');
  await page.click(tid('ide-hw-clear-selected-resource'));
  await page.waitForFunction(
    () => /Unassigned\s*1/i.test(document.querySelector('[data-testid="ide-hw-mapping-overview-unassigned"]')?.textContent ?? ''),
    undefined,
    { timeout: 6000 }
  );
  assert(!/E19/.test(await text(page, 'ide-hw-xdc-line-ld1')), 'cleared signal has no package pin in its constraint line');
  // The recorded run depends on the mapping: it must read STALE now.
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-verify-evidence-state'), { timeout: 8000 });
  assert(/STALE/i.test(await text(page, 'ide-verify-evidence-state')), 'clearing a pin makes the recorded run STALE');
  assert(/mapping/i.test(await text(page, 'ide-verify-evidence-state-reason')), 'the stale reason names the mapping');
  await page.click(tid('mode-button-hardware'));
  await page.waitForSelector(tid('ide-hw-map-row-ld1'), { timeout: 8000 });
  await page.click(tid('ide-hw-map-row-ld1'));
  await page.waitForSelector(tid('ide-hw-use-recommended'), { state: 'visible', timeout: 6000 });
  assert(/LD1/.test(await text(page, 'ide-hw-recommendation')), 'guided mapping recommends LD1 for the SUM output');
  await page.click(tid('ide-hw-use-recommended'));
  await page.waitForFunction(
    () => /Unassigned\s*0/i.test(document.querySelector('[data-testid="ide-hw-mapping-overview-unassigned"]')?.textContent ?? ''),
    undefined,
    { timeout: 6000 }
  );
  assert(/E19/.test(await text(page, 'ide-hw-xdc-line-ld1')), 'constraint line carries E19 again after the recommendation');
  // Restoring the pin does not re-bless the recorded run: evidence becomes current by running,
  // not by undoing an edit — and every surface must say so with one voice.
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-verify-evidence-state'), { timeout: 8000 });
  assert(/STALE/i.test(await text(page, 'ide-verify-evidence-state')), 'restoring the pin does not silently re-bless the run');
  const statusAfterRestore = await text(page, 'ide-status-run');
  assert(/stale/i.test(statusAfterRestore), `the status bar agrees the simulation is stale (got "${statusAfterRestore.trim()}")`);
  await page.click(tid('ide-vcb-run'));
  await settleRun(page);
  assert((await summaryKind(page)) === 'pass', 'Compare passes again on the restored mapping');
  await page.waitForFunction(
    () => /RECORDED/i.test(document.querySelector('[data-testid="ide-verify-evidence-state"]')?.textContent ?? ''),
    undefined,
    { timeout: 8000 }
  );
  assert(/CURRENT/i.test(await text(page, 'ide-verify-evidence-state')), 'the new run is CURRENT');
  assert(!/stale/i.test(await text(page, 'ide-status-run')), 'the status bar agrees the simulation is current');
  console.log(`[${label}] G. Board — clear LD1 -> STALE (mapping) -> Use LD1 -> still stale -> re-run -> CURRENT; XDC follows`);

  // ── H. PACKAGE — trusted build, real download, ZIP inspected ───────────────
  await page.click(tid('mode-button-export'));
  await page.waitForSelector(tid('ide-export-package-inspector-v1'), { timeout: 8000 });
  const stateBefore = await page.locator(tid('ide-export-package-inspector-v1')).getAttribute('data-export-package-state');
  assert(stateBefore !== 'blocked', `package must not be blocked with a passing run and complete mapping (got ${stateBefore})`);
  const trustBefore = await page.locator(tid('ide-export-package-inspector-v1')).getAttribute('data-export-verification-trust');
  assert(trustBefore === 'trusted', `verification trust must be trusted after Compare PASS (got ${trustBefore})`);
  const buildButton = page.locator(tid('ide-export-package-build-v1'));
  await buildButton.waitFor({ state: 'visible', timeout: 6000 });
  assert(/build/i.test(await buildButton.textContent()), 'the primary action builds the current bundle');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), buildButton.click()]);
  const zipPath = path.join(EVIDENCE_DIR, `full-adder-package-${label}.zip`);
  await download.saveAs(zipPath);
  const entries = zipEntries(fs.readFileSync(zipPath));
  assert(entries.some((e) => /top\.vhd$/i.test(e)), `ZIP has top.vhd (entries: ${entries.join(', ')})`);
  assert(entries.some((e) => /top\.xdc$/i.test(e)), 'ZIP has top.xdc');
  assert(entries.some((e) => /\.tcl$/i.test(e)), 'ZIP has the Vivado import Tcl');
  await page.waitForSelector(tid('ide-export-download-success'), { timeout: 10000 });
  const successText = await text(page, 'ide-export-download-success');
  const sha = successText.match(/[0-9a-f]{64}/i)?.[0] ?? null;
  assert(sha !== null, `download evidence names the package SHA-256 (got "${successText.slice(0, 120)}")`);
  assert(/trusted/i.test(successText), 'the downloaded package is recorded as trusted');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-export-package-inspector-v1"]')?.getAttribute('data-export-package-state') === 'ready',
    undefined,
    { timeout: 8000 }
  );
  await page.waitForSelector(tid('ide-export-package-download-v1'), { state: 'visible', timeout: 6000 });
  console.log(`[${label}] H. Package — trusted build downloaded (${entries.length} entries, sha ${sha.slice(0, 12)}…), state ready`);

  // ── I. RELOAD — evidence, mapping and package survive the browser ──────────
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(tid('ide-export-package-inspector-v1'), { timeout: 15000 });
  const stateAfter = await page.locator(tid('ide-export-package-inspector-v1')).getAttribute('data-export-package-state');
  assert(stateAfter === 'ready', `package stays ready across reload (got ${stateAfter})`);
  await page.waitForSelector(tid('ide-export-package-download-v1'), { state: 'visible', timeout: 6000 });
  await page.click(tid('mode-button-verify'));
  await page.waitForFunction(
    () => /RECORDED/i.test(document.querySelector('[data-testid="ide-verify-evidence-state"]')?.textContent ?? ''),
    undefined,
    { timeout: 10000 }
  );
  assert(/CURRENT/i.test(await text(page, 'ide-verify-evidence-state')), 'the recorded run is CURRENT after reload');
  await page.click(tid('mode-button-hardware'));
  await page.waitForSelector(tid('ide-hw-mapping-overview-unassigned'), { timeout: 8000 });
  assert(/Unassigned\s*0/i.test(await text(page, 'ide-hw-mapping-overview-unassigned')), 'mapping is complete after reload');
  console.log(`[${label}] I. Reload — run CURRENT, mapping complete, package ready`);

  // ── Geometry + errors ─────────────────────────────────────────────────────
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `no root horizontal overflow (got ${overflow}px)`);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `full-adder-operational-${label}.png`) });
  assert(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
  const realConsoleErrors = consoleErrors.filter((e) => !/favicon|manifest/i.test(e));
  assert(realConsoleErrors.length === 0, `no unexpected console errors: ${realConsoleErrors.join(' | ')}`);

  await ctx.close();
  console.log(`[${label}] PASS — UI-only failure -> trace -> repair -> PASS loop, overflow ${overflow}px, 0 errors\n`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('PASS — Full Adder operational journey (UI-only core) at 1440x900 and 1366x768.');
