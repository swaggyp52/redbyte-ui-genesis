// P2.5 — Full Adder operational acceptance journey (UI-only).
//
// Drives the REAL student workflow through the actual UI with zero project/store
// actions: first use -> Start a Lab -> Lab 3 Full Adder -> Design -> Simulate ->
// Compare PASS -> a runnable wrong-logic edit (gate swap) -> Compare FAIL with a
// concrete mismatch -> Trace in Design -> repair -> Compare PASS. Runtime reads are
// assertions only; nothing is loaded, mutated, mapped, or exported through a store.
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
    { timeout: 8000 }
  );
  console.log(`[${label}] E. Trace in Design opened the Design surface`);

  // ── F. REPAIR + RERUN -> PASS ─────────────────────────────────────────────
  // Trace in Design arrived with the failing gate already selected (its inspector
  // + debug context are focused on xor2), which is the honest trace context: the
  // student repairs it directly via the compatible-gate swap. No store mutation.
  await page.waitForSelector(tid('node-OR-xor2_node'), { timeout: 8000 });
  const tracedSelected = await page.locator(tid('node-OR-xor2_node')).getAttribute('data-node-selected');
  assert(tracedSelected === '1', 'trace-in-Design arrived with the failing SUM gate selected');
  await page.waitForSelector(tid('ide-design-swap-xor'), { state: 'visible', timeout: 6000 });
  await page.click(tid('ide-design-swap-xor')); // repair: OR -> XOR
  await page.waitForSelector(tid('node-XOR-xor2_node'), { timeout: 6000 });
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-vcb-run'), { timeout: 8000 });
  await page.click(tid('ide-vcb-run'));
  await settleRun(page);
  assert((await summaryKind(page)) === 'pass', `repaired circuit should PASS again (got ${await summaryKind(page)})`);
  console.log(`[${label}] F. Repair (OR->XOR) -> Compare PASS again`);

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
