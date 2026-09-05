// P2.5H §7 — persistence is not one operation.
//
// A page reload, a Save As, a Duplicate, and closing a project and reopening it from
// Recent are different operations with different code paths, and a student loses
// different things in each. This journey performs all of them on a project it authored
// through the real UI, and after every one asks the same questions: is the authored work
// still here, is the run evidence still here and still REPLAYABLE (a summary row in the
// ledger is not a trace), and does project A ever see project B's work.
//
// No store injection. Every action is a real click or key press. Reads go through the
// runtime only to inspect what the UI just did.
import { BASE_URL, launchChromium, evidenceDir } from './harness.mjs';

const OUT = evidenceDir('persistence');
const VIEWPORT = { width: 1440, height: 900 };
const tid = (id) => `[data-testid="${id}"]`;

const browser = await launchChromium();
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

const fail = (msg) => { throw new Error(msg); };
const assert = (cond, msg) => { if (!cond) fail(msg); };

const state = () => page.evaluate(() => {
  const st = window.__RB_PROJECT_RUNTIME__.getState();
  const ledger = st.verifyRunHistory ?? [];
  const last = st.verifyLastRun ?? null;
  return {
    projectId: st.projectId ?? null,
    projectName: st.projectName ?? null,
    nodes: (st.circuit?.nodes ?? []).length,
    connections: (st.circuit?.connections ?? []).length,
    ioRows: (st.projectIoRows ?? []).length,
    vectors: (st.projectVectors ?? []).length,
    scenarios: (st.scenarios ?? []).length,
    scenarioVectors: (st.scenarios ?? []).reduce((n, s) => n + (s.vectors?.length ?? 0), 0),
    expectations: (st.projectVectors ?? []).reduce(
      (n, v) => n + Object.keys(v.expected ?? {}).length, 0),
    ledgerCount: ledger.length,
    ledgerIds: ledger.map((e) => e.runId),
    ledgerProjects: [...new Set(ledger.map((e) => e.projectId ?? 'unowned'))],
    lastRunId: (ledger[ledger.length - 1] ?? {}).runId ?? last?.runId ?? null,
    lastRunProject: last?.projectId ?? null,
    // A replayable trace needs the per-vector results, not just a pass/fail summary.
    lastRunRows: last?.report?.rows?.length ?? 0,
    lastRunPassed: last?.report?.passed ?? null,
    savedProjects: (window.__RB_SAVED_PROJECTS__ ?? []).map((p) => p.projectId),
  };
});

const runCommand = async (commandId) => {
  await page.keyboard.press('Control+k');
  await page.waitForSelector(tid('ide-command-palette'), { state: 'visible', timeout: 8000 });
  const item = page.getByTestId(`ide-command-${commandId}`);
  if ((await item.count()) === 0) {
    // Narrow the palette until the command is offered, the way a person would.
    await page.getByTestId('ide-command-palette-query').fill(commandId.split('.').pop());
    await page.waitForTimeout(250);
  }
  await page.waitForSelector(tid(`ide-command-${commandId}`), { state: 'visible', timeout: 8000 });
  await page.click(tid(`ide-command-${commandId}`));
  await page.waitForSelector(tid('ide-command-palette'), { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
};

/**
 * Reopen a saved project the way the product offers it: Open Existing Project. The Start
 * Center's Recent list only renders when nothing is loaded, so with a project open this
 * modal is the reopen path a student actually has.
 */
const openSavedProject = async (projectId) => {
  await runCommand('project.open');
  await page.waitForSelector(tid('ide-load-project-modal'), { state: 'visible', timeout: 8000 });
  const offered = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="ide-load-project-"]')]
      .map((el) => el.getAttribute('data-testid'))
      .filter((id) => id !== 'ide-load-project-modal' && id !== 'ide-load-project-list'));
  console.log('   Open Existing offers:', offered.join(', ') || '(none)');
  assert(offered.includes(`ide-load-project-${projectId}`),
    `${projectId} is not offered by Open Existing Project; offered: ${offered.join(', ') || 'nothing'}`);
  await page.click(tid(`ide-load-project-${projectId}`));
  await page.waitForTimeout(1800);
};

/** Run through the real Run command and wait for a NEW terminal run owned by this project. */
const runAndSettle = async (label) => {
  const before = await state();
  await page.click(tid('mode-button-verify'));
  await page.waitForTimeout(600);
  await page.waitForSelector(tid('ide-vcb-run'), { state: 'visible', timeout: 10000 });
  await page.click(tid('ide-vcb-run'));
  await page.waitForFunction(
    (previous) => {
      const st = window.__RB_PROJECT_RUNTIME__.getState();
      const history = st.verifyRunHistory ?? [];
      const last = history[history.length - 1];
      if (!last?.runId || last.runId === previous) return false;
      if (last.status !== 'pass' && last.status !== 'fail') return false;
      return Boolean(st.verifyLastRun?.report);
    },
    before.lastRunId,
    { timeout: 30000 }
  );
  const after = await state();
  assert(after.lastRunId && after.lastRunId !== before.lastRunId, `[${label}] no new run identity`);
  assert(after.lastRunProject === after.projectId,
    `[${label}] run owned by ${after.lastRunProject}, project is ${after.projectId}`);
  assert(after.lastRunRows > 0, `[${label}] run carries no per-vector rows`);
  return after;
};

try {
  // ── Setup: a real lab, opened the way a student opens it ───────────────────
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector(tid('ide-project-start-a-lab-primary'), { timeout: 15000 });
  await page.click(tid('ide-project-start-a-lab-primary'));
  await page.waitForSelector(tid('ide-project-gannon-lab-details-full-adder'), { state: 'visible', timeout: 8000 });
  await page.click(tid('ide-project-gannon-lab-details-full-adder'));
  await page.waitForSelector(tid('ide-project-gannon-lab-start-full-adder'), { state: 'visible', timeout: 8000 });
  await page.click(tid('ide-project-gannon-lab-start-full-adder'));
  await page.waitForTimeout(1500);

  const seeded = await state();
  assert(seeded.nodes > 0, 'lab did not load');
  console.log(`setup: ${seeded.projectName} (${seeded.projectId}) — ${seeded.nodes} nodes, ` +
    `${seeded.vectors} vectors, ${seeded.expectations} expectations`);

  const runA = await runAndSettle('A');
  console.log(`A. run ${runA.lastRunId} rows=${runA.lastRunRows} passed=${runA.lastRunPassed}`);

  // ── P1. Page reload ────────────────────────────────────────────────────────
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const afterReload = await state();
  assert(afterReload.projectId === runA.projectId, 'reload changed the project identity');
  assert(afterReload.vectors === runA.vectors && afterReload.expectations === runA.expectations,
    `reload lost authored work (${runA.vectors}/${runA.expectations} -> ${afterReload.vectors}/${afterReload.expectations})`);
  assert(afterReload.lastRunId === runA.lastRunId, 'reload lost the run identity');
  assert(afterReload.lastRunRows === runA.lastRunRows,
    `reload kept a summary but lost the trace (${runA.lastRunRows} rows -> ${afterReload.lastRunRows})`);
  console.log(`P1 reload: identity, ${afterReload.expectations} expectations and a ${afterReload.lastRunRows}-row trace survive`);

  // ── P2. Save As — a new identity that owns its own evidence ────────────────
  await runCommand('project.save-as');
  const afterSaveAs = await state();
  assert(afterSaveAs.projectId !== runA.projectId,
    `Save As did not change identity (still ${afterSaveAs.projectId})`);
  assert(afterSaveAs.vectors === runA.vectors && afterSaveAs.expectations === runA.expectations,
    'Save As lost authored work');
  assert(afterSaveAs.lastRunRows === runA.lastRunRows,
    `Save As kept a summary but lost the trace (${runA.lastRunRows} -> ${afterSaveAs.lastRunRows})`);
  assert(afterSaveAs.lastRunProject === afterSaveAs.projectId,
    `Save As left evidence owned by ${afterSaveAs.lastRunProject}, not the new project ${afterSaveAs.projectId}`);
  const projectB = afterSaveAs.projectId;
  console.log(`P2 Save As: ${runA.projectId} -> ${projectB}, evidence re-owned, trace intact`);

  // ── P3. Duplicate ──────────────────────────────────────────────────────────
  await runCommand('project.duplicate');
  const afterDuplicate = await state();
  assert(afterDuplicate.vectors === runA.vectors && afterDuplicate.expectations === runA.expectations,
    'Duplicate lost authored work');
  console.log(`P3 Duplicate: active is ${afterDuplicate.projectId}, ` +
    `${afterDuplicate.expectations} expectations intact`);

  // ── P4. Diverge B, then reopen A from Recent ───────────────────────────────
  // Give the copy its own evidence so a leak between projects is visible.
  const runB = await runAndSettle('B');
  console.log(`P4 B has its own run ${runB.lastRunId} (project ${runB.lastRunProject})`);

  await openSavedProject(runA.projectId);

  const reopenedA = await state();
  assert(reopenedA.projectId === runA.projectId,
    `Recent opened ${reopenedA.projectId}, expected ${runA.projectId}`);
  assert(reopenedA.vectors === runA.vectors && reopenedA.expectations === runA.expectations,
    `reopening A lost authored work (${runA.vectors}/${runA.expectations} -> ${reopenedA.vectors}/${reopenedA.expectations})`);
  // The point of §7: a reopened project gets its own trace back, not an empty Simulate and
  // not a bare summary row. Rows are the per-vector results a student replays.
  assert(reopenedA.lastRunId === runA.lastRunId,
    `reopening A restored run ${reopenedA.lastRunId ?? 'none'}, expected its own ${runA.lastRunId}`);
  assert(reopenedA.lastRunRows === runA.lastRunRows,
    `reopening A restored ${reopenedA.lastRunRows} result rows, expected ${runA.lastRunRows}`);
  assert(reopenedA.ledgerIds.includes(runA.lastRunId),
    "project A's ledger lost its own run");
  assert(reopenedA.lastRunProject === runA.projectId,
    `restored evidence is owned by ${reopenedA.lastRunProject}, expected ${runA.projectId}`);
  console.log(`P4 reopen A: ${reopenedA.expectations} expectations, ` +
    `${reopenedA.ledgerCount} ledger entries, last run ${reopenedA.lastRunId ?? 'none'} ` +
    `with ${reopenedA.lastRunRows} rows`);

  // ── P5. Isolation — A must never show B's evidence ─────────────────────────
  assert(!reopenedA.ledgerIds.includes(runB.lastRunId),
    `project A's ledger contains project B's run ${runB.lastRunId}`);
  assert(reopenedA.lastRunId !== runB.lastRunId, "project A's evidence is project B's run");
  const foreign = reopenedA.ledgerProjects.filter((id) => id !== runA.projectId && id !== 'unowned');
  assert(foreign.length === 0, `project A's ledger carries evidence owned by ${foreign.join(', ')}`);
  console.log('P5 isolation: A carries no evidence belonging to B');

  await page.screenshot({ path: `${OUT}/persistence-final.png` });
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
  console.log('\nPASS — reload, Save As, Duplicate, reopen from Recent, and A/B isolation.');
} finally {
  await context.close();
  await browser.close();
}
