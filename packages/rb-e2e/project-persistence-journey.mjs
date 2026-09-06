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

/** Read one SAVED SNAPSHOT's stored run evidence straight out of browser storage. */
const storedEvidence = (projectId) => page.evaluate((id) => {
  const raw = localStorage.getItem(`rb.ide.project.v1:${id}`);
  if (!raw) return { present: false, savedAtIso: null, hasEvidence: false, historyIds: [], rows: 0 };
  const snapshot = JSON.parse(raw);
  return {
    present: true,
    savedAtIso: snapshot.savedAtIso ?? null,
    hasEvidence: Boolean(snapshot.runEvidence),
    historyIds: (snapshot.runEvidence?.history ?? []).map((entry) => entry.runId),
    rows: snapshot.runEvidence?.lastRun?.report?.rows?.length ?? 0,
  };
}, projectId);

/** Every saved snapshot, with what its stored bytes actually contain. */
const savedSnapshots = () => page.evaluate(() => {
  let index = [];
  try { index = JSON.parse(localStorage.getItem('rb.ide.projects.v1.index') ?? '[]'); } catch { index = []; }
  const ids = (Array.isArray(index) ? index : index.projects ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry.projectId))
    .filter(Boolean);
  return ids.map((id) => {
    const raw = localStorage.getItem(`rb.ide.project.v1:${id}`);
    if (!raw) return { projectId: id, present: false };
    const snapshot = JSON.parse(raw);
    let nodes = -1;
    let vectors = -1;
    let expectations = -1;
    try {
      const project = JSON.parse(snapshot.rbprojJson);
      nodes = (project.circuit?.nodes ?? []).length;
      vectors = (project.vectors ?? []).length;
      expectations = (project.vectors ?? []).reduce(
        (n, v) => n + Object.keys(v.expected ?? {}).length, 0);
    } catch { /* left at -1 so an undecodable snapshot is never chosen */ }
    return {
      projectId: id,
      present: true,
      projectName: snapshot.projectName,
      nodes,
      vectors,
      expectations,
      hasEvidence: Boolean(snapshot.runEvidence),
    };
  });
});

/**
 * Wait until a project's saved snapshot has stopped being rewritten. Autosave is
 * debounced, so this is how the journey knows a later write is the one it caused
 * rather than one already in flight. Bounded, and it waits on real storage state.
 */
const waitForSaveQuiet = (projectId, quietMs = 1500) => page.waitForFunction(
  ({ id, quiet }) => {
    const raw = localStorage.getItem(`rb.ide.project.v1:${id}`);
    if (!raw) return false;
    const savedAt = Date.parse(JSON.parse(raw).savedAtIso ?? '');
    return Number.isFinite(savedAt) && Date.now() - savedAt >= quiet;
  },
  { id: projectId, quiet: quietMs },
  { timeout: 20000 }
);

/**
 * Wait for the workbench's own save indicator to read `saved`. Autosave is debounced,
 * and it rewrites the whole project record without run evidence, so a close-save issued
 * while an autosave is still pending is overwritten a moment later. `saved` is the word
 * the product shows a student before they close a tab, so the journey waits for it too.
 */
const waitForWorkspaceSaved = async (projectId) => {
  await page.waitForSelector('[data-testid="ide-save-state"][data-state="saved"]', { timeout: 20000 });
  await waitForSaveQuiet(projectId);
};

/**
 * The close-save: the write the product performs when the tab goes away. Dispatching
 * `beforeunload` is the only way to reach it without ending the session, and it is a
 * real window event, not a store write — the handler decides what to persist.
 */
const closeSave = async (projectId) => {
  const before = await storedEvidence(projectId);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeunload', { cancelable: true }));
  });
  await page.waitForFunction(
    ({ id, previous }) => {
      const raw = localStorage.getItem(`rb.ide.project.v1:${id}`);
      if (!raw) return false;
      return (JSON.parse(raw).savedAtIso ?? null) !== previous;
    },
    { id: projectId, previous: before.savedAtIso },
    { timeout: 8000 }
  );
  return storedEvidence(projectId);
};

/** Open a starter the way the palette offers one, replacement prompt included. */
const openStarter = async (exampleId, searchText) => {
  await runCommand('project.open-starter');
  await page.waitForSelector(tid('ide-project-starter-picker'), { state: 'visible', timeout: 8000 });
  await page.fill(tid('ide-projectx-examples-search'), searchText);
  await page.waitForSelector(tid(`ide-project-landing-example-${exampleId}`), { state: 'visible', timeout: 8000 });
  await page.click(tid(`ide-project-landing-example-${exampleId}`));
  await page.waitForFunction(
    (id) => window.__RB_PROJECT_RUNTIME__.getState().sourceExampleId === id
      || Boolean(document.querySelector('[data-testid="ide-example-confirm"]')),
    exampleId,
    { timeout: 10000 }
  );
  if ((await page.locator(tid('ide-example-confirm')).count()) > 0) {
    await page.click(tid('ide-example-confirm'));
  }
  await page.waitForFunction(
    (id) => window.__RB_PROJECT_RUNTIME__.getState().sourceExampleId === id,
    exampleId,
    { timeout: 10000 }
  );
  await page.waitForTimeout(1200);
};

/** What the Runs ledger document actually shows the student. */
const readRunsLedger = async () => {
  await page.click(tid('mode-button-project'));
  await page.waitForSelector(tid('ide-project-row-doc:runs'), { state: 'visible', timeout: 8000 });
  await page.click(tid('ide-project-row-doc:runs'));
  await page.waitForSelector(tid('ide-project-runs-document'), { state: 'visible', timeout: 8000 });
  return page.evaluate(() => ({
    rowIds: [...document.querySelectorAll('[data-testid^="ide-project-run-run-"]')]
      .map((el) => (el.getAttribute('data-testid') ?? '').replace('ide-project-run-', '')),
    text: (document.querySelector('[data-testid="ide-project-runs-table"]')?.textContent ?? '').trim(),
  }));
};

/** The always-present evidence word in the status bar. */
const statusRunLabel = () => page.textContent(tid('ide-status-run')).catch(() => null);

// G. The counts a transition is never allowed to change.
const COUNTED = [
  ['nodes', 'circuit nodes'],
  ['connections', 'connections'],
  ['ioRows', 'io rows'],
  ['vectors', 'vectors'],
  ['expectations', 'authored expectations'],
];

/**
 * G. No silent data loss. Every transition this journey performs is measured against
 * the state that went into it; a drop is reported by name with both numbers, never
 * absorbed. Deliberate replacements (opening a different project) are excluded and
 * say so at the call site.
 */
const expectNoLoss = (label, before, after) => {
  for (const [key, what] of COUNTED) {
    assert(before[key] === after[key], `[${label}] lost ${what}: ${before[key]} -> ${after[key]}`);
  }
  console.log(`   G ${label}: ${COUNTED.map(([key]) => `${key}=${after[key]}`).join(' ')} — nothing dropped`);
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

  // ── D. A foreign project must not inherit another project's evidence ───────
  // The copy is reopened, given a run of its own, and closed the way a tab closes.
  // Then a different starter is opened in its place: a real project with a design,
  // cases and authored expectations, and no workspace evidence of its own. Anything
  // it shows about a run would be borrowed from the project before it.
  await openSavedProject(projectB);
  const backB = await state();
  assert(backB.projectId === projectB,
    `Open Existing opened ${backB.projectId}, expected the copy ${projectB}`);
  expectNoLoss('reopen B', runA, backB);
  assert(backB.lastRunProject === projectB,
    `reopened B carries evidence owned by ${backB.lastRunProject ?? 'nobody'}, expected ${projectB}`);
  assert(backB.lastRunRows === runA.lastRunRows,
    `reopened B restored ${backB.lastRunRows} result rows, expected ${runA.lastRunRows}`);
  console.log(`D1 reopen B: run ${backB.lastRunId} owned by ${backB.lastRunProject}, ` +
    `${backB.lastRunRows} rows`);

  // B earns a run of its own in this session, then the tab closes on it.
  // The close-save is used here, not Ctrl+S: the ordinary Save path re-persists the
  // run it captured the first time (measured — see the report), so it cannot be
  // trusted to store the run B just produced. Closing the tab is a real student
  // action and is the path the product gets right.
  const runB2 = await runAndSettle('B-again');
  expectNoLoss('run again on B', backB, runB2);
  // Let the workspace finish saving before closing it. Autosave rewrites the whole project
  // record and does not carry run evidence, so a close-save that lands while an autosave is
  // still pending is overwritten ~700ms later (measured — see the report). A student closes
  // a tab once the workbench says `saved`, so the journey waits for the same word.
  await waitForWorkspaceSaved(projectB);
  const savedB = await closeSave(projectB);
  assert(savedB.historyIds.includes(runB2.lastRunId),
    `close-save stored ledger ${JSON.stringify(savedB.historyIds)} for B, which does not contain ` +
    `the run it just produced (${runB2.lastRunId})`);
  assert(savedB.rows === runB2.lastRunRows,
    `close-save stored a ${savedB.rows}-row trace for B, expected ${runB2.lastRunRows}`);
  await waitForSaveQuiet(projectB);
  const settledB = await storedEvidence(projectB);
  assert(settledB.historyIds.includes(runB2.lastRunId),
    `the stored run evidence for B was erased after the close-save: its snapshot now holds ` +
    `${JSON.stringify(settledB.historyIds)} and a ${settledB.rows}-row trace, expected ${runB2.lastRunId}`);
  console.log(`D2 B run ${runB2.lastRunId} (${runB2.lastRunRows} rows) is stored with the project ` +
    'and still stored once the workspace settles');

  // A different starter, opened from the palette. This is a deliberate replacement,
  // so G's equality does not apply across it; what must hold is that the new project
  // is real and carries none of B's proof.
  await openStarter('half-adder', 'Half Adder');
  const foreignProject = await state();
  assert(foreignProject.projectId !== projectB && foreignProject.projectId !== runA.projectId,
    `the starter opened under an existing identity (${foreignProject.projectId})`);
  assert(foreignProject.nodes > 0 && foreignProject.vectors > 0,
    `the starter opened with ${foreignProject.nodes} nodes and ${foreignProject.vectors} vectors, ` +
    'so "no evidence" would prove nothing');
  assert(foreignProject.ledgerCount === 0,
    `a project that has never been run shows ${foreignProject.ledgerCount} ledger entries: ${foreignProject.ledgerIds.join(', ')}`);
  assert(foreignProject.lastRunId === null,
    `a project that has never been run shows last run ${foreignProject.lastRunId}`);
  assert(foreignProject.lastRunRows === 0,
    `a project that has never been run shows a ${foreignProject.lastRunRows}-row trace`);
  assert(foreignProject.lastRunProject === null,
    `a project that has never been run shows evidence owned by ${foreignProject.lastRunProject}`);
  assert(!foreignProject.ledgerIds.includes(runB2.lastRunId) && !foreignProject.ledgerIds.includes(runA.lastRunId),
    `the starter inherited a run from another project: ${foreignProject.ledgerIds.join(', ')}`);
  const foreignLedger = await readRunsLedger();
  assert(foreignLedger.rowIds.length === 0,
    `Runs lists ${foreignLedger.rowIds.length} runs for a project that has never been run: ${foreignLedger.rowIds.join(', ')}`);
  assert(/No runs recorded yet/i.test(foreignLedger.text),
    `Runs does not read as unproven; the ledger says: ${foreignLedger.text.slice(0, 140)}`);
  const foreignStatus = await statusRunLabel();
  assert(foreignStatus !== null,
    'the status bar shows no evidence word at all for the newly opened project');
  assert(!/pass|current/i.test(foreignStatus),
    `the status bar claims "${foreignStatus}" for a project that has never been run`);
  console.log(`D3 foreign starter ${foreignProject.projectName} (${foreignProject.projectId}): ${foreignProject.nodes} nodes, ` +
    `${foreignProject.vectors} vectors, ${foreignProject.expectations} expectations, ` +
    `0 runs, status "${foreignStatus.trim()}"`);

  // Back to B: its own run, unchanged, and still nobody else's.
  const bStoredBeforeReopen = await storedEvidence(projectB);
  await openSavedProject(projectB);
  const backB2 = await state();
  assert(backB2.projectId === projectB,
    `Open Existing opened ${backB2.projectId}, expected ${projectB}`);
  expectNoLoss('reopen B after the foreign project', runB2, backB2);
  assert(backB2.lastRunId === runB2.lastRunId,
    `reopening B restored ${backB2.lastRunId ?? 'no run at all'}, expected its own ${runB2.lastRunId}; ` +
    `its saved snapshot held ${JSON.stringify(bStoredBeforeReopen.historyIds)} with a ${bStoredBeforeReopen.rows}-row trace`);
  assert(backB2.lastRunRows === runB2.lastRunRows,
    `reopening B restored ${backB2.lastRunRows} result rows, expected ${runB2.lastRunRows}`);
  assert(backB2.lastRunProject === projectB,
    `reopened B carries evidence owned by ${backB2.lastRunProject ?? 'nobody'}, expected ${projectB}`);
  const foreignOwners = backB2.ledgerProjects.filter((id) => id !== projectB && id !== 'unowned');
  assert(foreignOwners.length === 0,
    `B's ledger carries evidence owned by ${foreignOwners.join(', ')}`);
  const bLedger = await readRunsLedger();
  assert(bLedger.rowIds.includes(runB2.lastRunId),
    `B's Runs ledger does not list its own run ${runB2.lastRunId}; it lists ${bLedger.rowIds.join(', ') || 'nothing'}`);
  console.log(`D4 reopen B: run ${backB2.lastRunId} with ${backB2.lastRunRows} rows, ` +
    `${bLedger.rowIds.length} ledger row(s) on screen, none foreign`);

  // ── E. A snapshot saved before evidence existed must still open ────────────
  // This is storage surgery on a SAVED SNAPSHOT, not store injection of a student
  // action: removing `runEvidence` from one stored record is the only way to produce
  // the exact shape an older RedByte save had, before evidence was stored beside the
  // project. Everything the student does after it is still a real click.
  const stored = await savedSnapshots();
  const aged = stored.find((entry) =>
    entry.present && entry.hasEvidence
    && entry.projectId !== projectB
    && entry.projectId !== runA.projectId
    && entry.nodes === seeded.nodes
    && entry.vectors === seeded.vectors
    && entry.expectations === seeded.expectations);
  assert(aged,
    'no saved snapshot carries both this design and stored run evidence, so an older save ' +
    `cannot be simulated; saved snapshots: ${stored.map((e) => `${e.projectId}(evidence=${e.hasEvidence},nodes=${e.nodes})`).join(', ')}`);
  const surgery = await page.evaluate((id) => {
    const key = `rb.ide.project.v1:${id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return 'missing';
    const snapshot = JSON.parse(raw);
    if (!snapshot.runEvidence) return 'already-absent';
    delete snapshot.runEvidence;
    localStorage.setItem(key, JSON.stringify(snapshot));
    return 'removed';
  }, aged.projectId);
  assert(surgery === 'removed',
    `could not age the snapshot for ${aged.projectId}: ${surgery}`);
  const agedAfter = await storedEvidence(aged.projectId);
  assert(!agedAfter.hasEvidence,
    `${aged.projectId}'s snapshot still carries run evidence after the field was removed`);
  console.log(`E1 aged ${aged.projectId}: runEvidence removed from the saved snapshot ` +
    `(design ${aged.nodes} nodes, ${aged.vectors} vectors, ${aged.expectations} expectations still in its bytes)`);

  const errorsBeforeAged = pageErrors.length;
  await openSavedProject(aged.projectId);
  const openedAged = await state();
  assert(openedAged.projectId === aged.projectId,
    `Open Existing opened ${openedAged.projectId}, expected the aged snapshot ${aged.projectId}`);
  expectNoLoss('open a snapshot saved before evidence existed', seeded, openedAged);
  assert(openedAged.lastRunId === null,
    `an older save with no stored evidence opened claiming run ${openedAged.lastRunId}`);
  assert(openedAged.lastRunRows === 0,
    `an older save with no stored evidence opened with a ${openedAged.lastRunRows}-row trace`);
  assert(openedAged.ledgerCount === 0,
    `an older save with no stored evidence opened with ${openedAged.ledgerCount} ledger entries: ${openedAged.ledgerIds.join(', ')}`);
  assert(openedAged.lastRunProject === null,
    `an older save with no stored evidence opened owning evidence from ${openedAged.lastRunProject}`);
  const agedLedger = await readRunsLedger();
  assert(agedLedger.rowIds.length === 0,
    `the aged project's Runs ledger invented ${agedLedger.rowIds.length} rows: ${agedLedger.rowIds.join(', ')}`);
  assert(pageErrors.length === errorsBeforeAged,
    `opening a snapshot saved before evidence existed raised page errors: ${pageErrors.slice(errorsBeforeAged).join(' | ')}`);
  console.log(`E2 opened ${openedAged.projectId}: ${openedAged.nodes} nodes, ` +
    `${openedAged.vectors} vectors, ${openedAged.expectations} authored expectations, ` +
    'no run invented, no page error');

  // ── F. Close-save ─────────────────────────────────────────────────────────
  // The aged project earns a run, the tab closes on it, and the page comes back.
  // The run and its per-vector rows have to survive both the close and the reload.
  const runF = await runAndSettle('aged-project');
  expectNoLoss('run on the aged project', openedAged, runF);
  await waitForWorkspaceSaved(runF.projectId);
  const beforeClose = await storedEvidence(runF.projectId);
  // This step used to require that the snapshot did NOT yet hold the run, so that the
  // close-save was demonstrably the writer. That precondition only held because the autosave
  // was erasing stored evidence on every edit. The autosave now carries the evidence too, so
  // the workspace is already durable before the tab closes - which is the better behaviour and
  // the one this step should assert. What still has to be true is that the close-save does not
  // lose or downgrade what is stored.
  assert(beforeClose.rows === 0 || beforeClose.rows === runF.lastRunRows,
    `before the close-save the snapshot held a ${beforeClose.rows}-row trace, ` +
    `which is neither empty nor the ${runF.lastRunRows} rows on screen`);
  const afterClose = await closeSave(runF.projectId);
  assert(afterClose.historyIds.includes(runF.lastRunId),
    `the close-save stored ledger ${JSON.stringify(afterClose.historyIds)}, which does not contain ` +
    `the run on screen (${runF.lastRunId})`);
  assert(afterClose.rows === runF.lastRunRows,
    `the close-save stored a ${afterClose.rows}-row trace, expected ${runF.lastRunRows}`);
  await waitForSaveQuiet(runF.projectId);
  const settledClose = await storedEvidence(runF.projectId);
  assert(settledClose.historyIds.includes(runF.lastRunId),
    `the close-save was undone: the snapshot now holds ${JSON.stringify(settledClose.historyIds)} ` +
    `and a ${settledClose.rows}-row trace, expected ${runF.lastRunId}`);
  console.log(`F1 close-save: stored ledger ${JSON.stringify(beforeClose.historyIds)} -> ` +
    `${JSON.stringify(afterClose.historyIds)} with a ${afterClose.rows}-row trace, and it survived settling`);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => Boolean(window.__RB_PROJECT_RUNTIME__?.getState?.().projectId),
    undefined,
    { timeout: 15000 }
  );
  await page.waitForTimeout(1500);
  const afterCloseReload = await state();
  assert(afterCloseReload.projectId === runF.projectId,
    `the reload came back as ${afterCloseReload.projectId}, expected ${runF.projectId}`);
  expectNoLoss('reload after close-save', runF, afterCloseReload);
  assert(afterCloseReload.lastRunId === runF.lastRunId,
    `after the close and reload the workspace shows ${afterCloseReload.lastRunId ?? 'no run at all'}, ` +
    `expected ${runF.lastRunId}`);
  assert(afterCloseReload.lastRunRows === runF.lastRunRows,
    `after the close and reload the run kept ${afterCloseReload.lastRunRows} result rows, expected ${runF.lastRunRows}`);
  assert(afterCloseReload.ledgerIds.includes(runF.lastRunId),
    `after the close and reload the ledger lost the run: ${afterCloseReload.ledgerIds.join(', ') || 'empty'}`);
  assert(afterCloseReload.lastRunProject === runF.projectId,
    `after the close and reload the evidence is owned by ${afterCloseReload.lastRunProject}, expected ${runF.projectId}`);
  const reloadLedger = await readRunsLedger();
  assert(reloadLedger.rowIds.includes(runF.lastRunId),
    `the Runs ledger does not list ${runF.lastRunId} after the close and reload; it lists ${reloadLedger.rowIds.join(', ') || 'nothing'}`);
  console.log(`F2 reload after close: run ${afterCloseReload.lastRunId} with ` +
    `${afterCloseReload.lastRunRows} rows and ${reloadLedger.rowIds.length} ledger row(s) on screen`);

  // ── G. Nothing authored was lost anywhere on this path ─────────────────────
  const lineage = [
    ['setup', seeded],
    ['run A', runA],
    ['reload', afterReload],
    ['Save As', afterSaveAs],
    ['Duplicate', afterDuplicate],
    ['run B', runB],
    ['reopen A', reopenedA],
    ['reopen B', backB],
    ['run again on B', runB2],
    ['reopen B after foreign starter', backB2],
    ['aged snapshot opened', openedAged],
    ['run on aged project', runF],
    ['reload after close-save', afterCloseReload],
  ];
  for (const [label, snapshot] of lineage) {
    for (const [key, what] of COUNTED) {
      assert(snapshot[key] === seeded[key],
        `[${label}] ${what} drifted from the authored lab: ${seeded[key]} -> ${snapshot[key]}`);
    }
  }
  console.log('G every full-adder transition kept ' +
    COUNTED.map(([key]) => `${key}=${seeded[key]}`).join(' ') + ':');
  for (const [label] of lineage) console.log(`   ${label}`);

  // ── H. The stored record must keep up with the workspace ──────────────────
  // Three defects lived here, all invisible from the workspace itself because the workspace
  // was right and only the stored bytes were wrong:
  //   H1 an autosave wrote the record whole without the evidence, so editing one case a
  //      moment after a run erased the stored run entirely;
  //   H2 Save read the run through a stale closure, so the second Save re-wrote the first run;
  //   H3 together they meant "reopening a project restores its trace" held exactly once.
  // Each is asserted against what is actually on disk, not what the store is holding.
  const runH1 = await runAndSettle('stored-record');
  await waitForWorkspaceSaved(runH1.projectId);
  const storedAfterFirstRun = await storedEvidence(runH1.projectId);
  assert(storedAfterFirstRun.historyIds.includes(runH1.lastRunId),
    `after a run and a settled save the snapshot holds ${JSON.stringify(storedAfterFirstRun.historyIds)}, ` +
    `which does not contain the run on screen (${runH1.lastRunId})`);

  // H1: edit one case. The autosave that follows must not take the run away.
  const beforeEdit = await state();
  await page.click(tid('mode-button-verify'));
  await page.waitForTimeout(600);
  if ((await page.locator(tid('ide-case-lab')).count()) === 0) {
    await page.click(tid('ide-doc-tab-cases:default'));
    await page.waitForSelector(tid('ide-case-lab'), { state: 'visible', timeout: 8000 });
  }
  await page.getByTestId('ide-case-lab-duplicate-0').click();
  await page.waitForFunction(
    (previous) => (window.__RB_PROJECT_RUNTIME__.getState().projectVectors ?? []).length !== previous,
    beforeEdit.vectors,
    { timeout: 10000 }
  );
  await waitForWorkspaceSaved(runH1.projectId);
  const storedAfterEdit = await storedEvidence(runH1.projectId);
  assert(storedAfterEdit.historyIds.includes(runH1.lastRunId),
    `editing a case erased the stored run: the snapshot now holds ` +
    `${JSON.stringify(storedAfterEdit.historyIds)} with a ${storedAfterEdit.rows}-row trace, ` +
    `but the workspace still shows ${runH1.lastRunId}`);
  assert(storedAfterEdit.rows === runH1.lastRunRows,
    `editing a case reduced the stored trace to ${storedAfterEdit.rows} rows, expected ${runH1.lastRunRows}`);
  console.log(`H1 an edit after a run kept the stored run: ${JSON.stringify(storedAfterEdit.historyIds)} ` +
    `with ${storedAfterEdit.rows} rows`);

  // H2: run again, save explicitly, and require the SECOND run on disk.
  const runH2 = await runAndSettle('second-run');
  assert(runH2.lastRunId !== runH1.lastRunId, 'the second run reused the first run identity');
  await runCommand('project.save');
  await waitForWorkspaceSaved(runH2.projectId);
  const storedAfterSecondSave = await storedEvidence(runH2.projectId);
  assert(storedAfterSecondSave.historyIds.includes(runH2.lastRunId),
    `Save after a second run stored ${JSON.stringify(storedAfterSecondSave.historyIds)}, ` +
    `which does not contain the run on screen (${runH2.lastRunId}) — the save read a stale run`);
  console.log(`H2 Save after a second run stored it: ${JSON.stringify(storedAfterSecondSave.historyIds)}`);

  // H3: reopen twice. The second reopen must be as good as the first.
  await openStarter('half-adder', 'Half Adder');
  await openSavedProject(runH2.projectId);
  const firstReopen = await state();
  assert(firstReopen.lastRunId === runH2.lastRunId,
    `the first reopen restored ${firstReopen.lastRunId ?? 'no run'}, expected ${runH2.lastRunId}`);
  await waitForWorkspaceSaved(runH2.projectId);
  await openStarter('half-adder', 'Half Adder');
  await openSavedProject(runH2.projectId);
  const secondReopen = await state();
  assert(secondReopen.lastRunId === runH2.lastRunId,
    `the second reopen restored ${secondReopen.lastRunId ?? 'no run at all'}, expected ${runH2.lastRunId} — ` +
    'reopening a project only works once');
  assert(secondReopen.lastRunRows === runH2.lastRunRows,
    `the second reopen restored ${secondReopen.lastRunRows} result rows, expected ${runH2.lastRunRows}`);
  console.log(`H3 reopened twice, both times with run ${secondReopen.lastRunId} and ` +
    `${secondReopen.lastRunRows} rows`);

  // H4: the status bar and Simulate must describe the same reopened project the same way.
  const agreement = await page.evaluate(() => {
    const text = (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? null;
    return { statusRun: text('ide-status-run'), evidence: text('ide-verify-evidence-state') };
  });
  assert(agreement.statusRun !== null, 'the status bar has no run state to read');
  assert(!/not simulated/i.test(agreement.statusRun),
    `a reopened project with its own restored run reads "${agreement.statusRun}" in the status bar ` +
    'while Simulate shows the run — two authorities, two answers');
  console.log(`H4 status bar and Simulate agree on the reopened project: status "${agreement.statusRun}"` +
    (agreement.evidence ? `, evidence "${agreement.evidence}"` : ''));

  await page.screenshot({ path: `${OUT}/persistence-final.png` });
  assert(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`);
  console.log('\nPASS — reload, Save As, Duplicate, reopen from Recent, A/B isolation,' +
    '\n       a foreign project that inherits nothing, an older save with no stored evidence,' +
    '\n       the close-save, and no authored work lost at any transition.');
} finally {
  await context.close();
  await browser.close();
}
