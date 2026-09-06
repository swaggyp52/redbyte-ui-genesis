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
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { BASE_URL } from './harness.mjs';

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
// One base-URL authority for every journey; RB_BASE_URL overrides it.
const BASE = BASE_URL.replace(/\/+$/, '');
// jszip is a first-party dependency of @redbyte/rb-apps (the package builder itself uses it).
const JSZip = createRequire(new URL('../rb-apps/package.json', import.meta.url))('jszip');

const tid = (t) => `[data-testid="${t}"]`;

/**
 * Read a downloaded package with jszip — the same archive tooling the app builds packages
 * with, resolved through the rb-apps package so this journey adds no dependency. Directory
 * entries are reported separately from files: a raw entry count conflates the two.
 */
async function readPackage(zipPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const entries = Object.values(zip.files);
  const files = entries.filter((entry) => !entry.dir);
  const text = new Map();
  for (const file of files) text.set(file.name, await file.async('string'));
  return {
    fileNames: files.map((file) => file.name).sort(),
    directoryCount: entries.length - files.length,
    entryCount: entries.length,
    text,
    find: (pattern) => files.map((file) => file.name).find((name) => pattern.test(name)) ?? null,
    read: (pattern) => {
      const name = files.map((file) => file.name).find((entry) => pattern.test(entry));
      return name ? text.get(name) : null;
    },
  };
}
const browser = await chromium.launch();

/** The run ledger's identity for the newest run, or null when nothing has run. */
async function latestRunId(page) {
  return page.evaluate(() => {
    const history = window.__RB_PROJECT_RUNTIME__?.getState?.().verifyRunHistory ?? [];
    return history.length > 0 ? history[history.length - 1].runId : null;
  });
}

/**
 * Click the real Run command and prove a NEW run completed — not that some earlier result is
 * still on screen. The ledger's runId embeds the run's own timestamp, so even a repeat of an
 * identical scenario appends a distinct entry; we wait for that entry, require a terminal
 * status, and check it belongs to this project and the active scenario. Runtime reads here are
 * assertions only: the run itself is started by clicking the button a student clicks.
 */
async function runAndSettle(page, label, assert) {
  const before = await latestRunId(page);
  await page.click(tid('ide-vcb-run'));
  await page.waitForFunction(
    (previous) => {
      const history = window.__RB_PROJECT_RUNTIME__?.getState?.().verifyRunHistory ?? [];
      const last = history[history.length - 1];
      return Boolean(last && last.runId !== previous && (last.status === 'pass' || last.status === 'fail'));
    },
    before,
    { timeout: 25000 }
  );
  // The surface must have caught up with the ledger before anything reads it.
  await page.waitForFunction(
    () => Boolean(document.querySelector('[data-testid="ide-verify-results-summary"]')?.getAttribute('data-kind')),
    undefined,
    { timeout: 12000 }
  );
  const fresh = await page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    const history = state.verifyRunHistory;
    const last = history[history.length - 1];
    return {
      runId: last.runId,
      status: last.status,
      ledgerProject: last.projectId ?? null,
      ledgerScenario: last.scenarioId ?? null,
      currentProject: state.projectId,
      activeScenario: state.activeScenarioId ?? null,
      lastRunProject: state.verifyLastRun?.projectId ?? null,
      rows: (state.verifyLastRun?.report?.rows ?? []).map((row) => ({
        tick: row.tick, signal: row.signal, expected: row.expected, actual: row.actual, status: row.status,
      })),
    };
  });
  assert(fresh.runId !== before, `${label}: the ledger must carry a new run (still ${fresh.runId})`);
  assert(fresh.ledgerProject === fresh.currentProject,
    `${label}: the run must belong to this project (${fresh.ledgerProject} vs ${fresh.currentProject})`);
  assert(fresh.lastRunProject === null || fresh.lastRunProject === fresh.currentProject,
    `${label}: the current run evidence must be owned by this project`);
  if (fresh.activeScenario) {
    assert(fresh.ledgerScenario === fresh.activeScenario,
      `${label}: the run must belong to the active scenario (${fresh.ledgerScenario} vs ${fresh.activeScenario})`);
  }
  return fresh;
}

/** The canonical authored expectation for one case/signal, read from the project document. */
async function authoredExpected(page, tick, signalId) {
  return page.evaluate(({ tick, signalId }) => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    const all = [...(state.projectVectors ?? []), ...(state.customVectors ?? [])];
    const vector = all.find((entry) => entry.tick === tick);
    const value = vector?.expected?.[signalId];
    return value === undefined || value === null ? null : String(value);
  }, { tick, signalId });
}

/**
 * Bring the Case Lab back. Documents own the Simulate instrument: a completed run opens the
 * Waveform document (the surface switches to replay), so returning to authoring means opening
 * the Cases document — the same tab a student clicks.
 */
async function openCasesDocument(page) {
  if ((await page.locator(tid('ide-case-lab')).count()) > 0) return;
  await page.click(tid('ide-doc-tab-cases:default'));
  await page.waitForSelector(tid('ide-case-lab'), { timeout: 8000 });
}

/** Click an expected cell until it holds the wanted value ('0', '1' or '' for no check). */
async function setExpectedCell(page, tick, signalId, want, assert) {
  await openCasesDocument(page);
  const cell = page.locator(tid(`ide-case-lab-exp-${tick}-${signalId}`));
  await cell.waitFor({ state: 'visible', timeout: 8000 });
  for (let click = 0; click < 4; click += 1) {
    const shown = ((await cell.textContent()) ?? '').trim().replace('·', '');
    if (shown === want) return;
    await cell.click();
    await page.waitForTimeout(120);
  }
  const shown = ((await cell.textContent()) ?? '').trim().replace('·', '');
  assert(shown === want, `expected cell t${tick}/${signalId} should read "${want}", reads "${shown}"`);
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
  await runAndSettle(page, 'baseline Compare', assert);
  assert((await summaryKind(page)) === 'pass', `baseline Compare should PASS (got ${await summaryKind(page)})`);
  assert(/Compare passed/i.test(await text(page, 'ide-verify-results-summary')), 'PASS headline present');
  console.log(`[${label}] C. Simulate — Compare PASS on the correct Full Adder`);

  // ── C2. AUTHOR AN EXPECTATION THROUGH CASE LAB ────────────────────────────
  // The expectation is computed from the full-adder truth table, never copied from the output
  // being judged: for case 7 (A=1, B=1, CIN=1) SUM = A^B^CIN = 1. We first author the WRONG
  // value, prove the run consumed it, then author the right one — which is the authoring loop
  // a student actually performs.
  await openCasesDocument(page);
  const AUTHOR_TICK = 7;
  const SUM_FIELD = 'ld1';
  const caseInputs = await page.evaluate((tick) => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    const all = [...(state.projectVectors ?? []), ...(state.customVectors ?? [])];
    return all.find((entry) => entry.tick === tick)?.inputs ?? null;
  }, AUTHOR_TICK);
  assert(caseInputs, `case ${AUTHOR_TICK} must exist to author against`);
  const bits = Object.keys(caseInputs).sort().map((key) => Number(caseInputs[key]) & 1);
  const truthSum = String(bits.reduce((acc, bit) => acc ^ bit, 0));
  const wrongSum = truthSum === '1' ? '0' : '1';
  assert(truthSum === '1', `full-adder truth table for case ${AUTHOR_TICK} should give SUM=1, computed ${truthSum}`);
  const beforeAuthoring = await authoredExpected(page, AUTHOR_TICK, SUM_FIELD);

  await setExpectedCell(page, AUTHOR_TICK, SUM_FIELD, wrongSum, assert);
  const authoredWrong = await authoredExpected(page, AUTHOR_TICK, SUM_FIELD);
  assert(authoredWrong === wrongSum,
    `authoring must reach the canonical document (was ${beforeAuthoring}, cell set to ${wrongSum}, document holds ${authoredWrong})`);
  // Semantic wait: the edit invalidates the run, and every surface must say so.
  await page.waitForFunction(
    () => /STALE/i.test(document.querySelector('[data-testid="ide-verify-evidence-state"]')?.textContent ?? ''),
    undefined,
    { timeout: 8000 }
  ).catch(() => {});
  assert(/STALE/i.test(await text(page, 'ide-verify-evidence-state')),
    'editing an expectation must invalidate the current evidence');
  assert(/stale/i.test(await text(page, 'ide-status-run')),
    'the status bar must agree that the simulation is stale after an authoring edit');

  const wrongRun = await runAndSettle(page, 'authored-wrong Compare', assert);
  assert((await summaryKind(page)) === 'fail', 'the run must fail against the wrong authored expectation');
  const authoredRow = wrongRun.rows.find((row) => row.tick === AUTHOR_TICK && /ld1|sum/i.test(row.signal));
  assert(authoredRow, `the report must carry a row for case ${AUTHOR_TICK} / SUM`);
  assert(String(authoredRow.expected) === wrongSum,
    `the run must use the AUTHORED expectation (${wrongSum}), the report says ${authoredRow.expected}`);
  assert(authoredRow.status === 'fail', 'the authored-wrong case must be the failing one');

  await setExpectedCell(page, AUTHOR_TICK, SUM_FIELD, truthSum, assert);
  assert((await authoredExpected(page, AUTHOR_TICK, SUM_FIELD)) === truthSum,
    'repairing the expectation must reach the canonical document');
  const repairedRun = await runAndSettle(page, 'authored-right Compare', assert);
  assert((await summaryKind(page)) === 'pass', 'the run must pass once the expectation matches the truth table');
  const repairedRow = repairedRun.rows.find((row) => row.tick === AUTHOR_TICK && /ld1|sum/i.test(row.signal));
  assert(repairedRow && String(repairedRow.expected) === truthSum && repairedRow.status === 'pass',
    'the repaired expectation must be the one the run graded');

  // The authored value survives leaving the workspace and coming back.
  await page.click(tid('mode-button-design'));
  await page.waitForSelector(tid('node-XOR-xor2_node'), { timeout: 8000 });
  await page.click(tid('mode-button-verify'));
  await openCasesDocument(page);
  await page.waitForSelector(tid(`ide-case-lab-exp-${AUTHOR_TICK}-${SUM_FIELD}`), { timeout: 8000 });
  assert((await authoredExpected(page, AUTHOR_TICK, SUM_FIELD)) === truthSum,
    'the authored expectation must survive leaving and re-entering Simulate');
  const shownAfterReturn = ((await page.locator(tid(`ide-case-lab-exp-${AUTHOR_TICK}-${SUM_FIELD}`)).textContent()) ?? '').trim();
  assert(shownAfterReturn === truthSum,
    `the Case Lab must show the authored value after returning (shows "${shownAfterReturn}")`);
  console.log(`[${label}] C2. Authored SUM for case ${AUTHOR_TICK}: wrong -> FAIL on the authored value -> right -> PASS, and it survives navigation`);

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
  await runAndSettle(page, 'broken-circuit Compare', assert);
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
  await runAndSettle(page, 'repaired Compare', assert);
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
  await runAndSettle(page, 'restored-mapping Compare', assert);
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
  // Build & Export opens on the handoff dossier - what was made, what proves it, what to do with
  // it - and the artifact browser is a second document reached from the dossier's own header.
  // Asserted on the acceptance path because that path arrives here straight after a run, which is
  // exactly where the document host used to leave the workspace with no document of its own.
  await page.waitForSelector(tid('ide-package-handoff-document'), { timeout: 8000 });
  assert(await page.locator(tid('ide-package-handoff-manifest')).count() > 0,
    'the dossier lists the files the package will contain');
  await page.click(tid('ide-package-handoff-open-files'));
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
  const archive = await readPackage(zipPath);
  // Report the set this fixture actually produces; never assert a universal file count.
  console.log(`[${label}] H. payload: ${archive.fileNames.length} files + ${archive.directoryCount} directory entries`);
  console.log(`[${label}]    ${archive.fileNames.join('\n           ')}`);
  const xdcName = archive.find(/\.xdc$/i);
  const testbenchName = archive.find(/testbench\.vhd$/i);
  const topName = archive.find(/sources_1\/new\/top\.vhd$/i);
  const importTclName = archive.find(/vivado_import\.tcl$/i);
  for (const [role, name] of [['design source', topName], ['constraints', xdcName], ['testbench', testbenchName], ['Vivado import Tcl', importTclName]]) {
    assert(name, `the package must carry a ${role} (files: ${archive.fileNames.join(', ')})`);
  }

  // The downloaded constraints must match the mapping performed through the UI, pin for pin.
  const mapping = await page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    return {
      part: state.fpgaConfig?.part ?? null,
      rows: (state.projectIoRows ?? [])
        .filter((row) => (row.pin ?? '').trim().length > 0)
        .map((row) => ({ id: row.id, label: row.label, pin: row.pin.trim() })),
    };
  });
  const xdcText = archive.text.get(xdcName);
  const pinLines = xdcText.split('\n').filter((line) => /PACKAGE_PIN/.test(line));
  assert(pinLines.length === mapping.rows.length,
    `the .xdc must carry one PACKAGE_PIN line per mapped signal (${pinLines.length} lines vs ${mapping.rows.length} mapped rows)`);
  for (const row of mapping.rows) {
    assert(new RegExp(`PACKAGE_PIN\\s+${row.pin}\\b`).test(xdcText),
      `the .xdc must assign ${row.label} to the pin the UI mapped (${row.pin}); lines: ${pinLines.join(' | ')}`);
  }
  const sumPin = mapping.rows.find((row) => row.id === 'ld1')?.pin ?? null;
  assert(sumPin && new RegExp(`PACKAGE_PIN\\s+${sumPin}\\b.*LD1`, 'i').test(xdcText),
    `the .xdc must bind LD1 to the pin restored through the Board UI (${sumPin})`);

  // The generated testbench must grade the expectation authored in Case Lab, not some default.
  const testbenchText = archive.text.get(testbenchName);
  assert(new RegExp(`Vector ${AUTHOR_TICK} failed on LD1[^\n]*expected '${truthSum}'`).test(testbenchText),
    `the testbench must assert the authored expectation for case ${AUTHOR_TICK} (SUM='${truthSum}')`);

  // The target part is the Board authority's, and every file the Tcl adds is really in the archive.
  const importTcl = archive.text.get(importTclName);
  if (mapping.part) {
    const partSeen = importTcl.includes(mapping.part) || (archive.read(/\.xpr$/i) ?? '').includes(mapping.part);
    assert(partSeen, `the package must target the Board authority's part (${mapping.part})`);
  }
  // Only the files the script ADDS must be archive members; paths it creates (the Vivado project
  // output directory) are not shipped and must not be asserted as such.
  const referenced = [...importTcl.matchAll(/file join \$script_dir "([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => /\.(vhd|v|sv|xdc|tcl|xpr|json|md|txt)$/i.test(reference));
  assert(referenced.length > 0, 'the import Tcl must reference the source files it adds');
  for (const reference of referenced) {
    assert(archive.fileNames.some((name) => name.endsWith(reference)),
      `the import Tcl references "${reference}", which is not in the archive`);
  }

  // What the workspace previews and what the browser downloaded must be the same bytes.
  await page.click(tid(`ide-export-file-${xdcName.split('/').pop().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`)).catch(() => {});
  const previewPath = await page.locator(tid('ide-export-preview-path')).textContent().catch(() => null);
  if (previewPath && xdcName.endsWith(previewPath.trim())) {
    const previewed = await page.locator(tid('ide-export-preview-code')).textContent();
    const normalise = (value) => value.replace(/\s+/g, ' ').trim();
    assert(normalise(previewed).includes(normalise(pinLines[pinLines.length - 1])),
      'the previewed .xdc must show the same constraint lines the download carries');
  }
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
  console.log(`[${label}] H. Package — trusted build downloaded and inspected: constraints match the UI mapping, the testbench grades the authored expectation, sha ${sha.slice(0, 12)}…, state ready`);

  // Isolate the reload: read the evidence in Simulate BEFORE reloading, so a stale chip can be
  // attributed to the package build rather than to persistence.
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-verify-evidence-state'), { timeout: 8000 });
  const chipAfterPackage = (await text(page, 'ide-verify-evidence-state')).trim();
  assert(/RECORDED/i.test(chipAfterPackage) && /CURRENT/i.test(chipAfterPackage),
    `building and downloading a package must not invalidate simulation evidence (chip reads "${chipAfterPackage}")`);
  await page.click(tid('mode-button-export'));
  // Returning to a workspace restores the document last read there; the dossier is the default
  // for a first visit, so accept either and reach the artifacts through the dossier's header.
  if (await page.locator(tid('ide-package-handoff-open-files')).count()) {
    await page.click(tid('ide-package-handoff-open-files'));
  }
  await page.waitForSelector(tid('ide-export-package-inspector-v1'), { timeout: 8000 });

  const evidenceBeforeReload = await page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    return {
      runHash: state.verifyLastRun?.deterministicHash ?? null,
      scenarioContentHash: state.verifyLastRun?.scenarioContentHash ?? null,
      scenarioId: state.verifyLastRun?.scenarioId ?? null,
      activeScenarioId: state.activeScenarioId ?? null,
      ioRows: (state.projectIoRows ?? []).map((row) => `${row.id}:${row.pin ?? ''}`).join(','),
      scenarioVectorIds: ((state.scenarios ?? []).find((s) => s.id === state.activeScenarioId)?.vectors ?? []).map((v) => v.id ?? '(none)').join(','),
      chip: document.querySelector('[data-testid="ide-verify-evidence-state"]')?.textContent ?? null,
    };
  });

  // ── I. RELOAD — evidence, mapping and package survive the browser ──────────
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector(tid('ide-export-package-inspector-v1'), { timeout: 15000 });
  const stateAfter = await page.locator(tid('ide-export-package-inspector-v1')).getAttribute('data-export-package-state');
  const trustAfter = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="ide-export-package-inspector-v1"]');
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    return {
      axes: root ? Object.fromEntries([...root.attributes].filter((a) => a.name.startsWith('data-export')).map((a) => [a.name, a.value])) : null,
      lastExport: state.projectHealthCore?.lastExport
        ? { status: state.projectHealthCore.lastExport.status, hash: String(state.projectHealthCore.lastExport.hash ?? '').slice(0, 16) }
        : null,
      dirtySinceExport: state.projectHealthCore?.dirtySinceExport ?? null,
      dirtySinceVerify: state.projectHealthCore?.dirtySinceVerify ?? null,
    };
  });
  // `data-export-package-state` tracks the DOWNLOAD ACTION (contract: a trusted package that has
  // not been downloaded in this session reads "draft"), so a reload legitimately resets it — the
  // browser cannot know the file is still on disk. What must survive is the package's TRUTH: it is
  // still structurally downloadable and still browser-verified against the current evidence.
  assert(trustAfter.axes['data-export-verification-trust'] === 'trusted',
    `the package must still be browser-verified after reload — ${JSON.stringify(trustAfter)}`);
  assert(trustAfter.axes['data-export-structural-state'] === 'downloadable',
    `the package must still be downloadable after reload — ${JSON.stringify(trustAfter)}`);
  assert(trustAfter.axes['data-export-derived-state'] === 'downloadable-trusted',
    `the derived state must read downloadable-trusted after reload (got ${trustAfter.axes['data-export-derived-state']})`);
  assert(trustAfter.lastExport && trustAfter.lastExport.status === 'ok',
    'the successful build must still be recorded after reload');
  assert(trustAfter.dirtySinceExport === false && trustAfter.dirtySinceVerify === false,
    `an unchanged reload must not mark the project dirty — ${JSON.stringify(trustAfter)}`);
  assert(stateAfter === 'draft',
    `the download action resets across reload by contract (got ${stateAfter})`);
  // Exactly one primary action, and it leads to the package.
  const primaryAfterReload = await page.evaluate(() => {
    const surface = document.querySelector('[data-ide-mode-marker="export"]');
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    return [...new Set(surface.querySelectorAll('.ide-button-primary'))]
      .filter(visible)
      .map((button) => `${button.getAttribute('data-testid')}|${(button.textContent ?? '').trim()}`);
  });
  assert(primaryAfterReload.length === 1,
    `the Package surface must offer one primary action after reload, found ${JSON.stringify(primaryAfterReload)}`);
  assert(/download|build|rebuild/i.test(primaryAfterReload[0]),
    `the primary action after reload must lead to the package (got ${primaryAfterReload[0]})`);
  await page.click(tid('mode-button-verify'));
  await page.waitForSelector(tid('ide-verify-evidence-state'), { timeout: 10000 });
  const evidenceAfterReload = (await text(page, 'ide-verify-evidence-state')).trim();
  const authorityAfterReload = await page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    return {
      dirtySinceVerify: state.projectHealthCore?.dirtySinceVerify ?? null,
      lastVerify: state.projectHealthCore?.lastVerify?.status ?? null,
      runProject: state.verifyLastRun?.projectId ?? null,
      project: state.projectId,
      historyLength: (state.verifyRunHistory ?? []).length,
    };
  });
  const evidenceDetail = await page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__.getState();
    return {
      runHash: state.verifyLastRun?.deterministicHash ?? null,
      scenarioContentHash: state.verifyLastRun?.scenarioContentHash ?? null,
      scenarioId: state.verifyLastRun?.scenarioId ?? null,
      activeScenarioId: state.activeScenarioId ?? null,
      ioRows: (state.projectIoRows ?? []).map((row) => `${row.id}:${row.pin ?? ''}`).join(','),
      scenarioVectorIds: ((state.scenarios ?? []).find((s) => s.id === state.activeScenarioId)?.vectors ?? []).map((v) => v.id ?? '(none)').join(','),
    };
  });
  assert(/RECORDED/i.test(evidenceAfterReload) && /CURRENT/i.test(evidenceAfterReload),
    `an unchanged reload must restore the run as RECORDED · CURRENT (chip reads "${evidenceAfterReload}")
   before: ${JSON.stringify(evidenceBeforeReload)}
   after:  ${JSON.stringify(evidenceDetail)}
   authority: ${JSON.stringify(authorityAfterReload)}`);
  assert(authorityAfterReload.runProject === null || authorityAfterReload.runProject === authorityAfterReload.project,
    `the restored run must be owned by this project — ${JSON.stringify(authorityAfterReload)}`);
  await page.click(tid('mode-button-hardware'));
  await page.waitForSelector(tid('ide-hw-mapping-overview-unassigned'), { timeout: 8000 });
  assert(/Unassigned\s*0/i.test(await text(page, 'ide-hw-mapping-overview-unassigned')), 'mapping is complete after reload');
  assert((await authoredExpected(page, AUTHOR_TICK, SUM_FIELD)) === truthSum,
    'the authored expectation must survive a reload');
  console.log(`[${label}] I. Reload — run CURRENT, mapping complete, package ready, authored expectation intact`);

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
