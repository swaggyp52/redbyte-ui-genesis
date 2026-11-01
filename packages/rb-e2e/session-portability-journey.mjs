// Complete-session portability through the visible UI, into a second browser origin.
//
// A student's browser-local project lives in one origin's IndexedDB. The product offers
// File > Export Project Backup, which downloads a complete `.rb-session.json` (project,
// scenarios, retained recordings, package receipts), and File > Open Existing Project...
// > "Open .rbproj File", whose file chooser accepts that backup and restores it. This
// journey performs exactly those visible operations and nothing else that drives state:
//
//   1. load the 2-bit counter lab, run with its saved checks, author one stimulus change
//      in the timeline, run again (two retained recordings with different verdicts);
//   2. generate the package ZIP (its receipt SHA-256 is part of the session), save;
//   3. export the session backup from the File menu and capture the download;
//   4. open a page at a DIFFERENT ORIGIN in the SAME browser context - a fresh context
//      would make "the project is not there" vacuous; a different origin in the same
//      context proves that browser-local projects are origin-scoped - assert the project
//      is absent from its Open Existing list and its IndexedDB;
//   5. restore the backup through the visible file chooser and assert the same recording
//      ids / sequence numbers / output digests / assertion statuses, the same scenario
//      event ids, the same circuit node count and the same package receipt SHA;
//   6. assert the source origin still has its project.
//
// Reads go through window.__RB_PROJECT_RUNTIME__.getState() and read-only IndexedDB
// transactions for assertions only. No runtime method is called to drive the task.
import { launchChromium, BASE_URL, editStimulus, evidenceDir } from './harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const out = evidenceDir('session-portability', process.env.RB_SHOT_LABEL ?? 'current');
const VIEWPORT = { width: 1440, height: 900 };

/** HTTP status for a URL from Node, or 0 when nothing answers. Used only to pick a reachable second origin. */
const httpStatus = (url) => new Promise((resolve) => {
  const request = http.get(url, (response) => { response.resume(); resolve(response.statusCode ?? 0); });
  request.on('error', () => resolve(0));
  request.setTimeout(3000, () => { request.destroy(); resolve(0); });
});

/**
 * A second origin for the same server. RB_SECOND_ORIGIN_URL wins when set; otherwise the
 * loopback spellings that differ from BASE_URL's host are probed in order. `127.0.0.1` and
 * `[::1]` are different hosts from `localhost` for the browser's storage partitioning even
 * when they reach the same process; which one answers depends on how the server is bound.
 */
async function resolveSecondOrigin() {
  const base = new URL(BASE_URL);
  const explicit = process.env.RB_SECOND_ORIGIN_URL?.trim();
  const candidates = explicit
    ? [explicit.replace(/\/?$/, '/')]
    : ['127.0.0.1', '[::1]', 'localhost']
      .filter((host) => host !== base.hostname)
      .map((host) => { const url = new URL(BASE_URL); url.hostname = host; return url.toString(); });
  const probes = [];
  for (const candidate of candidates) {
    const status = await httpStatus(candidate);
    probes.push({ candidate, status });
    if (status === 200 && new URL(candidate).origin !== base.origin) return { url: candidate, probes };
  }
  throw new Error(`No reachable second origin for ${BASE_URL}; probed ${JSON.stringify(probes)}. ` +
    'Set RB_SECOND_ORIGIN_URL to a different host spelling the dev server answers on.');
}

const browser = await launchChromium();
const context = await browser.newContext({ viewport: VIEWPORT, acceptDownloads: true });
const errors = [];
let page;
let page2;
const attach = (target, label) => target.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));

/** Assertion-only read of the runtime: identities, not the whole trace. */
const readSession = (target) => target.evaluate(() => {
  const s = window.__RB_PROJECT_RUNTIME__.getState();
  const run = (r) => ({
    runId: r.runId, sequence: r.sequence ?? null, outputDigest: r.outputDigest ?? null,
    assertionStatus: r.assertionStatus ?? null, scenarioId: r.scenarioId ?? null, projectId: r.projectId ?? null,
    ticks: r.waveform?.length ?? 0, checkRows: r.report?.rows?.length ?? 0,
    checksPassed: r.report?.passed ?? null, deterministicHash: r.deterministicHash ?? null,
  });
  return JSON.parse(JSON.stringify({
    origin: location.origin,
    projectId: s.projectId ?? null, projectKind: s.projectKind ?? null, projectName: s.projectName ?? null,
    nodes: s.circuit?.nodes?.length ?? 0, connections: s.circuit?.connections?.length ?? 0,
    nodeIds: (s.circuit?.nodes ?? []).map((node) => node.id),
    scenarios: (s.scenarios ?? []).map((scenario) => ({
      id: scenario.id, name: scenario.name ?? null,
      eventIds: (scenario.vectors ?? []).map((vector) => vector.id ?? null),
      vectorCount: (scenario.vectors ?? []).length,
    })),
    activeScenarioId: s.activeScenarioId ?? null,
    scenariosRaw: s.scenarios ?? [],
    lastRun: s.verifyLastRun ? run(s.verifyLastRun) : null,
    archive: (s.verifyRunArchive ?? []).map(run),
    history: (s.verifyRunHistory ?? []).map((entry) => ({ runId: entry.runId, status: entry.status ?? null })),
    exportHistory: (s.exportHistory ?? []).map((entry) => ({
      packageHash: entry.packageHash ?? null, downloadKind: entry.downloadKind ?? null,
    })),
  }));
});

/** The complete retained recordings, for an exact comparison after restore. */
const readArchive = (target) => target.evaluate(() =>
  JSON.parse(JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive ?? [])));

/**
 * Read-only look at the durable store for one project record. `indexedDB.databases()` is
 * consulted first so a fresh origin is never given a database by the act of looking.
 */
const durableRecord = (target, projectId) => target.evaluate(async (id) => {
  const key = 'rb.ide.project.v1:' + id;
  const databases = await indexedDB.databases();
  const present = databases.some((entry) => entry.name === 'redbyte-ide-sessions-v1');
  if (!present) return { databaseExists: false, storeExists: false, recordExists: false, chars: 0 };
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('redbyte-ide-sessions-v1');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    if (!db.objectStoreNames.contains('records')) return { databaseExists: true, storeExists: false, recordExists: false, chars: 0 };
    const value = await new Promise((resolve, reject) => {
      const transaction = db.transaction('records', 'readonly');
      const request = transaction.objectStore('records').get(key);
      transaction.oncomplete = () => resolve(request.result?.value ?? null);
      transaction.onabort = () => reject(transaction.error);
    });
    return { databaseExists: true, storeExists: true, recordExists: value !== null, chars: value?.length ?? 0 };
  } finally { db.close(); }
}, projectId);

const saveTitle = (target) => target.getByTestId('ide-save-state').getAttribute('title');

const save = async (target) => {
  await target.getByTestId('ide-topbar-save-btn').click();
  await target.locator('[data-testid="ide-save-state"][data-state="saved"]').waitFor({ timeout: 30000 });
};

/** Open a File-menu item the way a person does: the File button, then the visible item. */
const fileMenu = async (target, commandId) => {
  await target.getByTestId('ide-menu-file').click();
  const item = target.getByTestId(`ide-menu-item-${commandId}`);
  await item.waitFor({ state: 'visible' });
  assert.notEqual(await item.getAttribute('aria-disabled'), 'true', `File > ${commandId} is disabled: ${await item.getAttribute('title')}`);
  await item.click();
};

/** Run and wait for a NEW recording to be the selected one. */
const runAgain = async (target) => {
  const previous = (await readSession(target)).lastRun?.runId ?? null;
  const started = Date.now();
  await target.getByTestId('ide-vcb-run').click();
  await target.waitForFunction((id) => {
    const run = window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun;
    return Boolean(run?.runId) && run.runId !== id && Boolean(run.report);
  }, previous, { timeout: 30000 });
  await target.getByTestId('ide-run-identity').waitFor();
  return { milliseconds: Date.now() - started, session: await readSession(target) };
};

const identities = (session) => session.archive.map((run) => ({
  runId: run.runId, sequence: run.sequence, outputDigest: run.outputDigest, assertionStatus: run.assertionStatus,
}));
const eventIds = (session) => session.scenarios.map((scenario) => ({ id: scenario.id, eventIds: scenario.eventIds }));

const result = { baseUrl: BASE_URL, browserVersion: browser.version(), steps: [], errors };
const step = (name, data) => { result.steps.push({ name, ...data }); console.log(`${name}: ${JSON.stringify(data)}`); };

// Original authoring files must survive the same explicit project lifecycle as
// recordings. Generated top.vhd/top.xdc are separate downstream projections.
async function authoringPortability() {
  const authoringContext = await browser.newContext({ viewport: VIEWPORT, acceptDownloads: true });
  const p = await authoringContext.newPage();
  attach(p, 'authoring');
  const project = {
    kind: 'rb-project', version: 1, name: 'Portable original sources',
    createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
    circuit: {
      nodes: [
        { id: 'a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'INPUT', label: 'B', position: { x: 0, y: 120 } },
        { id: 'gate', type: 'AND', label: 'Both', position: { x: 180, y: 60 } },
        { id: 'y', type: 'OUTPUT', label: 'Y', position: { x: 360, y: 60 } },
      ],
      connections: [
        { id: 'a-g', from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'gate', portName: 'a' } },
        { id: 'b-g', from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'gate', portName: 'b' } },
        { id: 'g-y', from: { nodeId: 'gate', portName: 'out' }, to: { nodeId: 'y', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [{ id: 'a', nodeId: 'a', port: 'out', label: 'A', pin: 'V17' },
        { id: 'b', nodeId: 'b', port: 'out', label: 'B', pin: 'W16' }],
      outputs: [{ id: 'y', nodeId: 'y', port: 'in', label: 'Y', pin: 'U16' }],
    },
    fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'student_top' },
    hdl: { top: 'student_top', sources: [
      { path: 'rtl/student_top.vhd', language: 'vhdl', text: '-- ORIGINAL student top\nlibrary ieee; use ieee.std_logic_1164.all;\nentity student_top is port(A,B: in std_logic; Y: out std_logic); end;\narchitecture rtl of student_top is begin Y <= A and B; end;\n' },
      { path: 'rtl/student_helper.v', language: 'verilog', text: '// ORIGINAL helper retained as a read-only source\nmodule student_helper(input a, input b, output y); assign y = a & b; endmodule\n' },
      { path: 'constraints/original-A.xdc', language: 'xdc', text: '# ORIGINAL A\nset_property PACKAGE_PIN V17 [get_ports A]\n' },
      { path: 'constraints/original-B.xdc', language: 'xdc', text: '# ORIGINAL B\nset_property PACKAGE_PIN V16 [get_ports A]\n' },
    ] },
  };
  const fixture = path.join(out, 'original-authoring.rbproj');
  fs.writeFileSync(fixture, JSON.stringify(project, null, 2));
  const read = () => p.evaluate(() => {
    const s = window.__RB_PROJECT_RUNTIME__.getState();
    return JSON.parse(JSON.stringify({ projectId: s.projectId, sourceModel: s.sourceModel,
      constraintSets: s.constraintSets, activeTop: s.activeTop, hierarchy: s.hierarchy,
      circuit: s.circuit, mapping: s.hardwareMappingV2, scenarios: s.scenarios.map(scenario => ({ ...scenario, probes: scenario.probes ?? [] })) }));
  });
  try {
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    await p.getByTestId('ide-project-file-input').setInputFiles(fixture);
    await p.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().sourceModel.files.length === 4);
    await p.getByTestId('mode-button-hardware').click();
    const constraints = p.getByTestId('ide-hw-constraints-tool');
    if (!(await constraints.evaluate(el => el.open))) await constraints.locator(':scope > summary').click();
    await p.getByTestId('ide-hw-map-row-action-a').click();
    await p.getByTestId('ide-hw-direct-resource-select').selectOption('SW0');
    assert.equal(await p.getByTestId('ide-hw-direct-resource-select').inputValue(), 'SW0');
    await p.getByTestId('ide-constraint-sets-add-name').fill('Captured A');
    await p.getByTestId('ide-constraint-sets-add').click();
    await p.getByTestId('ide-hw-direct-resource-select').selectOption('SW1');
    await p.getByTestId('ide-hw-assign-selected-resource').click();
    await p.getByTestId('ide-constraint-sets-add-name').fill('Captured B');
    await p.getByTestId('ide-constraint-sets-add').click();
    const captured = (await read()).constraintSets.sets.find(set => set.name === 'Captured A');
    assert.ok(captured.mappingSnapshot);
    await p.getByTestId(`ide-constraint-set-activate-${captured.id}`).click();
    const before = await read();
    assert.equal(before.constraintSets.activeId, captured.id);
    await save(p);
    await fileMenu(p, 'project.close');
    await p.getByTestId('ide-project-landing').waitFor();
    await fileMenu(p, 'project.open');
    await p.getByTestId(`ide-load-project-${before.projectId}`).click();
    await p.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().projectId === id, before.projectId);
    const reopened = await read();
    await p.screenshot({ path: path.join(out, 'authoring-reopen-1440x900.png') });
    fs.writeFileSync(path.join(out, 'authoring-reopen-comparison.json'), JSON.stringify({ before, reopened }, null, 2));
    assert.deepEqual(reopened.sourceModel, before.sourceModel, 'Save → Close → reopen must retain original paths, languages, text and source top');
    assert.deepEqual(reopened.constraintSets, before.constraintSets, 'Save → Close → reopen must retain both named sets and selection');
    assert.equal(reopened.activeTop, before.activeTop, 'reopen must retain HDL top identity');
    assert.deepEqual(reopened.hierarchy, before.hierarchy, 'reopen must retain native hierarchy');
    step('authoring-close-reopen', { files: before.sourceModel.files.map(f => f.path), sets: before.constraintSets.sets.map(s => s.name) });
    const compareAuthoring = async label => {
      const current = await read();
      for (const key of ['sourceModel', 'constraintSets', 'activeTop', 'hierarchy', 'mapping', 'scenarios']) {
        assert.deepEqual(current[key], before[key], `${label}: ${key} must survive`);
      }
      step(label, { projectId: current.projectId, files: current.sourceModel.files.length });
      return current;
    };
    const openSaved = async id => {
      await fileMenu(p, 'project.open');
      await p.getByTestId(`ide-load-project-${id}`).click();
      await p.waitForFunction(want => window.__RB_PROJECT_RUNTIME__.getState().projectId === want, id);
    };
    // Open a separate supported project B, then reopen A from the saved list.
    const projectB = { ...project, name: 'Project B', hdl: { ...project.hdl, sources: [] } };
    const fixtureB = path.join(out, 'project-B.rbproj');
    fs.writeFileSync(fixtureB, JSON.stringify(projectB));
    await p.getByTestId('ide-project-file-input').setInputFiles(fixtureB);
    await p.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().projectName === 'Project B');
    await openSaved(before.projectId);
    await compareAuthoring('authoring-open-B-reopen-A');
    await fileMenu(p, 'project.save-as');
    // Save As names the copy in its dialog (the suggested name is valid) and saves on confirm.
    await p.getByTestId('ide-save-as-confirm').click();
    await p.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().projectId !== id, before.projectId);
    const savedAs = await compareAuthoring('authoring-save-as');
    await openSaved(savedAs.projectId);
    await compareAuthoring('authoring-save-as-reopen');
    await fileMenu(p, 'project.duplicate');
    await fileMenu(p, 'project.open');
    const copyRow = p.getByTestId('ide-load-project-list').getByRole('button').filter({ hasText: 'Portable original sources Copy' });
    await copyRow.first().click();
    await p.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().projectName.endsWith(' Copy'));
    await compareAuthoring('authoring-duplicate-reopen');
    await p.reload({ waitUntil: 'networkidle' });
    await compareAuthoring('authoring-refresh');
    // App/tab restart uses the same durable origin; backup restore uses a fresh profile.
    await p.goto('about:blank');
    await p.goto(BASE_URL, { waitUntil: 'networkidle' });
    await compareAuthoring('authoring-app-restart');
    // Cancel the visible Open workflow before choosing replacement content.
    await fileMenu(p, 'project.open');
    await p.getByTestId('ide-load-modal').waitFor();
    await p.keyboard.press('Escape');
    await compareAuthoring('authoring-canceled-open');
    await p.getByTestId('ide-project-file-input').setInputFiles([]);
    await compareAuthoring('authoring-canceled-file-selection');
    const invalid = path.join(out, 'invalid-authoring.rbproj');
    fs.writeFileSync(invalid, '{ invalid json');
    p.on('dialog', dialog => dialog.dismiss());
    await p.getByTestId('ide-project-file-input').setInputFiles(invalid);
    await p.getByTestId('ide-project-open-error').waitFor();
    assert.match(await p.getByTestId('ide-project-open-error').innerText(), /current project is preserved/);
    await p.getByTestId('ide-project-open-error').getByRole('button', { name: 'Close', exact: true }).click();
    await compareAuthoring('authoring-failed-import');
    const [download] = await Promise.all([p.waitForEvent('download'), fileMenu(p, 'project.export-backup')]);
    const backupPath = path.join(out, 'authoring.rb-session.json');
    await download.saveAs(backupPath);
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    assert.deepEqual(JSON.parse(backup.snapshot.rbprojJson).sourceModel, before.sourceModel);
    assert.deepEqual(JSON.parse(backup.snapshot.rbprojJson).constraintSets, before.constraintSets);
    const unsupported = path.join(out, 'unsupported-authoring.rbproj');
    fs.writeFileSync(unsupported, JSON.stringify({ ...project, sourceModel: { schemaVersion: '2.0', files: [] } }));
    await p.getByTestId('ide-project-file-input').setInputFiles(unsupported);
    await p.getByTestId('ide-project-open-error').waitFor();
    assert.match(await p.getByTestId('ide-project-open-error').innerText(), /Unsupported sourceModel schema 2.0/);
    await p.keyboard.press('Escape');
    await compareAuthoring('authoring-unsupported-schema-refusal');
    const brokenBackup = path.join(out, 'broken-authoring.rb-session.json');
    fs.writeFileSync(brokenBackup, JSON.stringify({ ...backup, version: 999 }));
    await p.getByTestId('ide-project-file-input').setInputFiles(brokenBackup);
    await p.getByTestId('ide-project-open-error').waitFor();
    await p.keyboard.press('Escape');
    await compareAuthoring('authoring-failed-backup-restore');
    const fresh = await browser.newContext({ viewport: VIEWPORT, acceptDownloads: true });
    try {
      const restoredPage = await fresh.newPage();
      attach(restoredPage, 'fresh-authoring');
      await restoredPage.goto(BASE_URL, { waitUntil: 'networkidle' });
      await restoredPage.getByTestId('ide-project-file-input').setInputFiles(backupPath);
      await restoredPage.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().sourceModel.files.length === 4);
      const restored = await restoredPage.evaluate(() => {
        const s = window.__RB_PROJECT_RUNTIME__.getState();
        return JSON.parse(JSON.stringify({ sourceModel: s.sourceModel, constraintSets: s.constraintSets,
          activeTop: s.activeTop, hierarchy: s.hierarchy, mapping: s.hardwareMappingV2, scenarios: s.scenarios.map(scenario => ({ ...scenario, probes: scenario.probes ?? [] })) }));
      });
      for (const key of Object.keys(restored)) assert.deepEqual(restored[key], before[key], `fresh backup restore: ${key}`);
      step('authoring-fresh-backup-restore', { files: restored.sourceModel.files.length });
    } finally { await fresh.close(); }
  } finally { await authoringContext.close(); }
}

try {
  await authoringPortability();
  if (process.env.RB_PORTABILITY_AUTHORING_ONLY === '1') {
    await browser.close();
    console.log('PASS original authoring portability');
    process.exit(0);
  }
  // ── 1. Source origin: the counter lab, two recordings with different verdicts ─────────
  page = await context.newPage();
  attach(page, 'source');
  page.setDefaultTimeout(20000);
  const tid = (id) => page.getByTestId(id);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await tid('ide-project-start-a-lab-primary').click();
  await tid('ide-project-gannon-lab-card-counter-sequential').click();
  await tid('ide-project-gannon-lab-start-counter-sequential').click();
  await page.waitForFunction(() => (window.__RB_PROJECT_RUNTIME__.getState().circuit?.nodes ?? []).length > 0);
  const loaded = await readSession(page);
  assert.ok(loaded.projectId, 'the lab opened without a project identity');
  step('lab', { projectId: loaded.projectId, projectName: loaded.projectName, nodes: loaded.nodes, connections: loaded.connections,
    scenarios: loaded.scenarios.length, savedChecksVectors: loaded.scenarios[0]?.vectorCount ?? 0 });

  await tid('mode-button-verify').click();
  const first = await runAgain(page);
  assert.equal(first.session.archive.length, 1, 'the first run must be retained as one recording');
  step('run-1', { ms: first.milliseconds, ...identities(first.session)[0], checkRows: first.session.lastRun.checkRows });

  // One authored stimulus change: EN at t2 in the timeline grid (a real click on a visible cell).
  if (await tid('ide-verify-view-timeline').count()) await tid('ide-verify-view-timeline').click();
  const cell = page.getByRole('gridcell', { name: /^EN at t2:/ });
  await cell.waitFor({ state: 'visible' });
  const cellBefore = await cell.getAttribute('aria-label');
  // A recording is on screen: editing its stimulus is the explicit mode (RB-DEBT-020).
  await editStimulus(page);
  await cell.click();
  await page.waitForFunction((label) =>
    document.querySelector(`[role="gridcell"][aria-label^="EN at t2:"]`)?.getAttribute('aria-label') !== label, cellBefore);
  const cellAfter = await page.locator('[role="gridcell"][aria-label^="EN at t2:"]').first().getAttribute('aria-label');
  const edited = await readSession(page);
  assert.notDeepEqual(edited.scenariosRaw, first.session.scenariosRaw, 'the stimulus edit must change the authored scenario');
  step('stimulus-edit', { before: cellBefore, after: cellAfter, eventIds: eventIds(edited) });

  const second = await runAgain(page);
  assert.equal(second.session.archive.length, 2, `two retained recordings expected, found ${second.session.archive.length}`);
  const statuses = identities(second.session).map((run) => run.assertionStatus);
  assert.equal(new Set(statuses).size, 2,
    `the two recordings must carry different check verdicts (one failed, one passed); got ${JSON.stringify(statuses)}`);
  assert.equal(new Set(identities(second.session).map((run) => run.outputDigest)).size, 2, 'the stimulus change must change the recorded outputs');
  const visibleDigest = await tid('ide-run-output-digest').getAttribute('data-digest');
  const visibleVerdict = (await tid('ide-run-check-result').innerText()).trim();
  assert.equal(visibleDigest, second.session.lastRun.outputDigest, 'the visible digest must be the selected recording\'s');
  step('run-2', { ms: second.milliseconds, ...identities(second.session)[1], checkRows: second.session.lastRun.checkRows, visibleVerdict });
  await page.screenshot({ path: path.join(out, 'source-two-recordings-1440x900.png') });

  // ── 2. Package ZIP (cheap for this design) and Save ────────────────────────────────────
  let packageSha256 = null;
  let packageSkipped = null;
  await tid('mode-button-export').click();
  await tid('ide-export-package-files').waitFor();
  const generate = page.getByRole('button', { name: /^Generate.*ZIP$/ });
  if (await generate.count() === 0) packageSkipped = 'no Generate ZIP button is offered';
  else if (await generate.isDisabled()) packageSkipped = `Generate ZIP is disabled: ${await generate.getAttribute('title')}`;
  if (!packageSkipped) {
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), generate.click()]);
    const zipPath = path.join(out, 'source-package.zip');
    await download.saveAs(zipPath);
    await tid('ide-export-download-success').waitFor();
    packageSha256 = createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
    assert.equal((await tid('ide-export-package-sha256').innerText()).trim(), packageSha256, 'the visible receipt must be the downloaded ZIP\'s SHA-256');
    const receipt = (await readSession(page)).exportHistory;
    assert.equal(receipt.at(-1)?.packageHash, packageSha256, 'the session must retain the package receipt');
  }
  step('package', packageSkipped ? { skipped: packageSkipped } : { packageSha256 });
  await save(page);
  let sourceBefore = await readSession(page);
  const sourceArchive = await readArchive(page);
  const sourceDurable = await durableRecord(page, sourceBefore.projectId);
  assert.ok(sourceDurable.recordExists, 'Save must leave a durable record in the source origin');
  step('saved', { origin: sourceBefore.origin, projectId: sourceBefore.projectId, durableChars: sourceDurable.chars,
    recordings: identities(sourceBefore), eventIds: eventIds(sourceBefore), nodes: sourceBefore.nodes,
    receipts: sourceBefore.exportHistory.map((entry) => entry.packageHash) });

  // A dirty experiment is checkpointed before replacement, including its
  // current authored values and the complete immutable recording archive.
  await tid('mode-button-verify').click();
  const recoveryCell = page.getByRole('gridcell', { name: /^EN at t2:/ });
  await editStimulus(page);
  await recoveryCell.click();
  const recoveryExpected = await readSession(page);
  await fileMenu(page, 'project.build-fresh');
  await tid('ide-project-build-fresh-confirm').click();
  await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length === 0);
  page.once('dialog', dialog => dialog.accept());
  await fileMenu(page, 'project.recovery.restore');
  await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().projectName.startsWith('Backup -'));
  const recovered = await readSession(page);
  assert.deepEqual(recovered.archive, sourceBefore.archive.map(run => ({ ...run, projectId: recovered.projectId })),
    'recovery must preserve recording identity and content, rebinding ownership to the separately named backup project');
  assert.deepEqual(recovered.scenariosRaw, recoveryExpected.scenariosRaw, 'recovery must preserve authored scenarios');
  assert.deepEqual(recovered.exportHistory, sourceBefore.exportHistory, 'recovery must preserve package receipts');
  step('explicit-recovery', { recordings: recovered.archive.length, receipts: recovered.exportHistory.length });
  // Recovery opens the separately named backup project. The original saved
  // project remains available; return to it for the cross-origin backup proof.
  await fileMenu(page, 'project.open');
  await tid(`ide-load-project-${sourceBefore.projectId}`).click();
  await page.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().projectId === id, sourceBefore.projectId);
  sourceBefore = await readSession(page);

  // ── 3. File > Export Project Backup ──────────────────────────────────────────────────
  const [backupDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    fileMenu(page, 'project.export-backup'),
  ]);
  const backupName = backupDownload.suggestedFilename();
  assert.match(backupName, /\.rb-session\.json$/, `the backup must be a .rb-session.json, got ${backupName}`);
  const backupPath = path.join(out, backupName);
  await backupDownload.saveAs(backupPath);
  assert.ok(fs.statSync(backupPath).size > 0, 'the captured backup must contain bytes');
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.equal(backup.kind, 'rb-ide-session');
  assert.equal(backup.snapshot.projectId, sourceBefore.projectId);
  const backupRuns = (backup.snapshot.runEvidence?.archive ?? []).map((run) => ({
    runId: run.runId, sequence: run.sequence ?? null, outputDigest: run.outputDigest ?? null, assertionStatus: run.assertionStatus ?? null }));
  assert.deepEqual(backupRuns, identities(sourceBefore), 'the backup file must carry every retained recording identity');
  const backupReceipts = (backup.snapshot.runEvidence?.exportHistory ?? []).map((entry) => entry.packageHash);
  if (packageSha256) assert.ok(backupReceipts.includes(packageSha256), 'the backup file must carry the package receipt');
  step('backup', { file: backupName, bytes: fs.statSync(backupPath).size, statusTitle: await saveTitle(page),
    recordings: backupRuns, receipts: backupReceipts, scenarios: (backup.snapshot.scenarios ?? []).length });

  // ── 4. A different origin, same browser context: the project is not there ──────────────
  const second_origin = await resolveSecondOrigin();
  page2 = await context.newPage();
  attach(page2, 'second-origin');
  page2.setDefaultTimeout(20000);
  const tid2 = (id) => page2.getByTestId(id);
  await page2.goto(second_origin.url, { waitUntil: 'networkidle' });
  await tid2('ide-project-landing').waitFor();
  const empty = await readSession(page2);
  assert.notEqual(empty.origin, sourceBefore.origin, 'the second page must be a different origin');
  assert.equal(empty.projectKind, 'home', `the second origin opened with ${empty.projectKind}, expected nothing open`);
  assert.equal(empty.nodes, 0, 'the second origin must not show the source circuit');
  const absent = await durableRecord(page2, sourceBefore.projectId);
  assert.equal(absent.recordExists, false, 'the source project record must not exist in the second origin\'s IndexedDB');
  await fileMenu(page2, 'project.open');
  await tid2('ide-load-project-modal').waitFor({ state: 'visible' });
  const offered = await page2.evaluate(() => [...document.querySelectorAll('[data-testid^="ide-load-project-"]')]
    .map((el) => el.getAttribute('data-testid')).filter((id) => id !== 'ide-load-project-modal' && id !== 'ide-load-project-list'));
  assert.ok(!offered.includes(`ide-load-project-${sourceBefore.projectId}`), `Open Existing in the second origin offers the source project: ${offered.join(', ')}`);
  await page2.screenshot({ path: path.join(out, 'second-origin-open-existing-empty-1440x900.png') });
  step('second-origin-absent', { origin: empty.origin, probes: second_origin.probes, durable: absent, openExistingOffers: offered });

  // ── 5. Restore through the visible file chooser ────────────────────────────────────────
  const loadFile = tid2('ide-load-file');
  await loadFile.waitFor({ state: 'visible' });
  const [chooser] = await Promise.all([page2.waitForEvent('filechooser', { timeout: 20000 }), loadFile.click()]);
  await chooser.setFiles(backupPath);
  const restoreStarted = Date.now();
  await page2.waitForFunction((want) => (window.__RB_PROJECT_RUNTIME__.getState().circuit?.nodes ?? []).length === want, sourceBefore.nodes, { timeout: 30000 });
  await page2.waitForFunction((want) => (window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive ?? []).length === want, sourceBefore.archive.length, { timeout: 30000 });
  await tid2('ide-load-project-modal').waitFor({ state: 'detached' }).catch(() => {});
  const restoreMs = Date.now() - restoreStarted;
  const restored = await readSession(page2);
  const restoredArchive = await readArchive(page2);
  assert.equal(restored.origin, empty.origin);
  assert.equal(restored.projectId, sourceBefore.projectId, `the restore should keep the project identity in an origin with no collision; got ${restored.projectId}`);
  assert.equal(restored.nodes, sourceBefore.nodes, 'circuit node count');
  assert.deepEqual(restored.nodeIds, sourceBefore.nodeIds, 'circuit node ids');
  assert.equal(restored.connections, sourceBefore.connections, 'connection count');
  assert.deepEqual(eventIds(restored), eventIds(sourceBefore), 'scenario event ids');
  assert.deepEqual(restored.scenariosRaw, sourceBefore.scenariosRaw, 'the complete authored scenarios (events, stimulus, checks)');
  assert.equal(restored.activeScenarioId, sourceBefore.activeScenarioId, 'active scenario');
  assert.deepEqual(identities(restored), identities(sourceBefore), 'retained recording identities (run id, sequence, output digest, assertion status)');
  assert.equal(restored.lastRun?.runId, sourceBefore.lastRun?.runId, 'selected recording');
  assert.deepEqual(restored.history, sourceBefore.history, 'run ledger');
  assert.deepEqual(restored.exportHistory.map((entry) => entry.packageHash), sourceBefore.exportHistory.map((entry) => entry.packageHash), 'package receipt SHA-256');
  assert.deepEqual(restoredArchive, sourceArchive, 'the complete retained recordings (samples, report rows, identity) are byte-for-byte the source\'s');
  step('restored', { ms: restoreMs, statusTitle: await saveTitle(page2), projectId: restored.projectId, nodes: restored.nodes,
    recordings: identities(restored), eventIds: eventIds(restored), receipts: restored.exportHistory.map((entry) => entry.packageHash),
    archiveDeepEqual: true });

  // What the student sees after the restore: the same recording, verdict and receipt.
  await tid2('mode-button-verify').click();
  await tid2('ide-run-identity').waitFor();
  assert.equal(await tid2('ide-run-output-digest').getAttribute('data-digest'), visibleDigest, 'Simulate must show the same output digest');
  assert.equal((await tid2('ide-run-check-result').innerText()).trim(), visibleVerdict, 'Simulate must show the same check verdict');
  const picker = page2.getByLabel('Recorded run', { exact: true });
  const pickerOptions = await picker.locator('option').evaluateAll((nodes) => nodes.map((node) => node.value));
  for (const run of identities(sourceBefore)) assert.ok(pickerOptions.includes(run.runId), `the recording picker must offer ${run.runId}`);
  await page2.screenshot({ path: path.join(out, 'second-origin-restored-simulate-1440x900.png') });
  let visiblePackageSha = null;
  await tid2('mode-button-export').click();
  await tid2('ide-export-package-files').waitFor();
  if (await tid2('ide-export-package-sha256').count()) {
    visiblePackageSha = (await tid2('ide-export-package-sha256').innerText()).trim();
    if (packageSha256) assert.equal(visiblePackageSha, packageSha256, 'Build & Export must show the same receipt SHA-256');
  }
  await page2.screenshot({ path: path.join(out, 'second-origin-restored-export-1440x900.png') });
  step('restored-visible', { digest: visibleDigest, verdict: visibleVerdict, pickerOptions, visiblePackageSha });

  // The restore is durable in the second origin: save, reload, same recordings.
  await save(page2);
  const secondDurable = await durableRecord(page2, restored.projectId);
  assert.ok(secondDurable.recordExists, 'Save after the restore must leave a durable record in the second origin');
  await page2.reload({ waitUntil: 'networkidle' });
  await page2.waitForFunction(() => Boolean(window.__RB_PROJECT_RUNTIME__?.getState?.().projectId));
  const reloaded2 = await readSession(page2);
  assert.equal(reloaded2.projectId, restored.projectId);
  assert.deepEqual(identities(reloaded2), identities(sourceBefore), 'reloading the second origin keeps the restored recordings');
  assert.deepEqual(eventIds(reloaded2), eventIds(sourceBefore));
  step('second-origin-durable', { durableChars: secondDurable.chars, recordings: identities(reloaded2).length });

  // ── 6. The source origin still has its project ─────────────────────────────────────────
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__RB_PROJECT_RUNTIME__?.getState?.().projectId));
  const sourceAfter = await readSession(page);
  const sourceDurableAfter = await durableRecord(page, sourceBefore.projectId);
  assert.equal(sourceAfter.origin, sourceBefore.origin);
  assert.equal(sourceAfter.projectId, sourceBefore.projectId, 'the source origin must still open its own project');
  assert.equal(sourceAfter.nodes, sourceBefore.nodes);
  assert.deepEqual(identities(sourceAfter), identities(sourceBefore), 'the source origin keeps its recordings');
  assert.deepEqual(eventIds(sourceAfter), eventIds(sourceBefore));
  assert.deepEqual(sourceAfter.exportHistory, sourceBefore.exportHistory);
  assert.ok(sourceDurableAfter.recordExists, 'the source durable record must still exist');
  assert.deepEqual(await readArchive(page), sourceArchive, 'the source retained recordings are unchanged');
  step('source-preserved', { origin: sourceAfter.origin, projectId: sourceAfter.projectId, durableChars: sourceDurableAfter.chars });

  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  result.outcome = 'PASS';
  result.sourceOrigin = sourceBefore.origin;
  result.secondOrigin = restored.origin;
  result.projectId = sourceBefore.projectId;
  result.backup = backupName;
  result.packageSha256 = packageSha256;
  result.packageSkipped = packageSkipped;
  result.recordings = identities(sourceBefore);
  result.eventIds = eventIds(sourceBefore);
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  console.log(`PASS complete session backup exported from ${sourceBefore.origin}, absent from ${restored.origin}, restored there through the visible file chooser with identical recordings, event ids, circuit and receipt; source preserved: ${out}`);
} catch (error) {
  result.outcome = 'FAIL';
  result.failure = String(error);
  for (const [label, target] of [['source', page], ['second-origin', page2]]) {
    if (target && !target.isClosed()) {
      await target.screenshot({ path: path.join(out, `failure-${label}.png`) }).catch(() => {});
      fs.writeFileSync(path.join(out, `failure-${label}.txt`), String(error) + '\n' + await target.locator('body').innerText().catch(() => ''));
    }
  }
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  throw error;
} finally {
  await context.close();
  await browser.close();
}
