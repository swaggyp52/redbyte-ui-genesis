// RB-DEBT-023 acceptance in a real browser: import, navigation, reload, switching, failed writes and
// a browser restart, through the controls a student uses. Storage is observed independently by
// reading IndexedDB; nothing writes the app's runtime. No fixed sleeps: every wait is on a state.
import { launchChromium, chromiumExecutablePath, BASE_URL, evidenceDir, REPO_ROOT } from './harness.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const out = evidenceDir('durable-navigation', process.env.RB_SHOT_LABEL ?? 'current');
const FIXTURES = {
  alu: { file: path.join(REPO_ROOT, 'packages/rb-apps/src/fixtures/classroom/golden-basys3-alu.rbproj'), name: 'golden-basys3-alu', nodes: 49 },
  and: { file: path.join(REPO_ROOT, 'packages/rb-apps/src/fixtures/classroom/golden-basys3-switch-and.rbproj'), name: 'golden-basys3-switch-and', nodes: 4 },
};
const byNodes = new Map(Object.values(FIXTURES).map(fixture => [fixture.nodes, fixture]));
const META_KEY = 'rb.ide.sessionMeta.v1';
const RUNTIME_KEY = 'rb.ide.project-runtime.v1';
const STUDIO_URL = BASE_URL + '?studio=meridian';
const results = [];
const record = (step, detail) => { results.push({ step, ...detail }); console.log(`ok ${step} ${JSON.stringify(detail)}`); };

/** Every record in the IDE session database, read in the page without touching the app. */
const disk = page => page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('redbyte-ide-sessions-v1');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    if (!db.objectStoreNames.contains('records')) return {};
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('records');
      const request = transaction.objectStore('records').getAll();
      transaction.oncomplete = () => resolve(Object.fromEntries(request.result.map(entry => [entry.key, { value: entry.value, revision: entry.revision }])));
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
});

/** What the stored working session and its metadata name. */
function stored(records) {
  const parse = text => { try { return JSON.parse(text); } catch { return null; } };
  const meta = records[META_KEY]?.value ? parse(records[META_KEY].value) : null;
  const runtime = records[RUNTIME_KEY]?.value ? parse(records[RUNTIME_KEY].value) : null;
  const state = runtime?.state ?? runtime;
  return {
    metaProjectId: meta?.projectId ?? null,
    metaRuntimeRevision: meta?.runtimeRevision ?? null,
    runtimeRevision: records[RUNTIME_KEY]?.revision ?? 0,
    runtimeProjectId: state?.projectId ?? null,
    runtimeNodes: Array.isArray(state?.circuit?.nodes) ? state.circuit.nodes.length : null,
  };
}

/** The open project as the page shows it (read-only). */
const open = page => page.evaluate(() => {
  const state = window.__RB_PROJECT_RUNTIME__?.getState();
  return state ? { projectId: state.projectId, projectName: state.projectName, nodes: state.circuit.nodes.length } : null;
});

async function ready(page) {
  await page.waitForFunction(() => Boolean(window.__RB_PROJECT_RUNTIME__) && Boolean(document.querySelector('[data-testid="ide-save-state"], [data-testid="meridian-status"]')));
}

/** Import through the visible file input; resolves once the page shows the imported project. */
async function importProject(page, fixture) {
  const before = (await open(page))?.projectId ?? null;
  await page.getByTestId('ide-project-file-input').setInputFiles(fixture.file);
  await page.waitForFunction(({ before, nodes }) => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState();
    return state && state.projectId !== before && state.circuit.nodes.length === nodes;
  }, { before, nodes: fixture.nodes });
  return open(page);
}

/** Durable means the disk names the open project and its metadata never runs ahead of the record. */
async function untilDurable(page, projectId) {
  await page.waitForFunction(async ({ projectId, META_KEY, RUNTIME_KEY }) => {
    const db = await new Promise(resolve => { const request = indexedDB.open('redbyte-ide-sessions-v1'); request.onsuccess = () => resolve(request.result); });
    try {
      const all = await new Promise(resolve => { const tx = db.transaction('records'); const r = tx.objectStore('records').getAll(); tx.oncomplete = () => resolve(r.result); });
      const get = key => all.find(entry => entry.key === key);
      const meta = get(META_KEY)?.value ? JSON.parse(get(META_KEY).value) : null;
      const runtime = get(RUNTIME_KEY)?.value ? JSON.parse(get(RUNTIME_KEY).value) : null;
      const state = runtime?.state ?? runtime;
      return meta?.projectId === projectId && state?.projectId === projectId
        && (meta.runtimeRevision === undefined || meta.runtimeRevision <= get(RUNTIME_KEY).revision);
    } finally { db.close(); }
  }, { projectId, META_KEY, RUNTIME_KEY }, { polling: 50 });
}

/**
 * The invariant every boot must keep: what opens is what the disk holds, its content is the
 * project its name says, and metadata ahead of its record is said aloud, never silently obeyed.
 */
async function assertCoherentBoot(page, label) {
  await ready(page);
  const shown = await open(page);
  const onDisk = stored(await disk(page));
  const unfinished = await page.getByTestId('ide-session-unfinished').count();
  assert.ok(shown, `${label}: a project runtime is open`);
  // A project named after a fixture carries that fixture's content (renames are allowed edits).
  const named = Object.values(FIXTURES).find(entry => entry.name === shown.projectName);
  if (named) assert.equal(shown.nodes, named.nodes, `${label}: ${named.name} opens with its own ${named.nodes} nodes`);
  // Before anything has landed the stored session is the empty home, and that is what opens.
  const emptyHome = shown.nodes === 0 && !onDisk.runtimeNodes;
  assert.ok(byNodes.has(shown.nodes) || emptyHome, `${label}: the open content (${shown.nodes} nodes) is an imported project or the stored empty home`);
  if (onDisk.runtimeProjectId) assert.equal(shown.projectId, onDisk.runtimeProjectId, `${label}: the open project is the stored working session`);
  const ahead = onDisk.metaRuntimeRevision !== null && onDisk.metaRuntimeRevision > onDisk.runtimeRevision;
  if (ahead) assert.equal(unfinished, 1, `${label}: metadata ahead of its record is reported`);
  if (!unfinished && onDisk.metaProjectId) assert.equal(onDisk.metaProjectId, shown.projectId, `${label}: metadata names the open project`);
  return { shown, onDisk, unfinished };
}

const browser = await launchChromium();
let page;
try {
  // 1. Import, then reload at once (several times, alternating): never a project the disk lacks.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    // A student who is asked and leaves anyway: the worst case the boot must survive.
    let asked = 0;
    page.on('dialog', dialog => { asked += 1; void dialog.accept(); });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await ready(page);
    const outcomes = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      const fixture = attempt % 2 === 0 ? FIXTURES.alu : FIXTURES.and;
      const imported = await importProject(page, fixture);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const boot = await assertCoherentBoot(page, `import-reload #${attempt}`);
      outcomes.push({ imported: fixture.name, opened: boot.shown.projectName, landed: boot.shown.projectId === imported.projectId, unfinished: boot.unfinished });
      if (boot.unfinished) await page.getByTestId('ide-session-unfinished').getByRole('button', { name: 'Dismiss' }).click();
    }
    // The control: an import that has landed reopens exactly.
    const imported = await importProject(page, FIXTURES.alu);
    await untilDurable(page, imported.projectId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const boot = await assertCoherentBoot(page, 'import-durable-reload');
    assert.equal(boot.shown.projectId, imported.projectId, 'A landed import reopens after reload');
    assert.deepEqual(errors, []);
    record('import-then-reload', { outcomes, leaveWarnings: asked, durableReopen: true });
    await context.close();
  }

  // 1b. The same on a slow disk: each working-session write stays in flight while further reads
  //     keep its transaction open (no data changes), so a reload lands inside the write window
  //     where metadata used to commit ahead of the record it names (RB-DEBT-023).
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(({ RUNTIME_KEY }) => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, ...rest) {
        const request = put.call(this, value, ...rest);
        if (value && value.key === RUNTIME_KEY) {
          const store = this; let reads = 0;
          const spin = () => { if (++reads < 1500) store.count().onsuccess = spin; };
          spin();
        }
        return request;
      };
    }, { RUNTIME_KEY });
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let asked = 0;
    page.on('dialog', dialog => { asked += 1; void dialog.accept(); });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await ready(page);
    const outcomes = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const fixture = attempt % 2 === 0 ? FIXTURES.alu : FIXTURES.and;
      const imported = await importProject(page, fixture);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const boot = await assertCoherentBoot(page, `slow-disk import-reload #${attempt}`);
      outcomes.push({ imported: fixture.name, opened: boot.shown.projectName, landed: boot.shown.projectId === imported.projectId, unfinished: boot.unfinished });
      if (boot.unfinished) await page.getByTestId('ide-session-unfinished').getByRole('button', { name: 'Dismiss' }).click();
    }
    assert.deepEqual(errors, []);
    record('slow-disk-import-then-reload', { outcomes, leaveWarnings: asked });
    await context.close();
  }

  // 2. Import, then leave for Meridian at once: the studio opens the imported project, or the
  //    workbench warned before leaving a change that had not landed.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const dialogs = [];
    page.on('dialog', dialog => { dialogs.push(dialog.type()); void dialog.dismiss(); });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await ready(page);
    const imported = await importProject(page, FIXTURES.and);
    let left = false;
    try { await page.goto(STUDIO_URL, { waitUntil: 'domcontentloaded', timeout: 10000 }); left = true; } catch { left = false; }
    if (!left || dialogs.includes('beforeunload')) {
      // The guard kept the student here; the change is still open and lands before leaving.
      assert.equal((await open(page)).projectId, imported.projectId, 'Staying keeps the imported project open');
      await untilDurable(page, imported.projectId);
      await page.goto(STUDIO_URL, { waitUntil: 'domcontentloaded' });
    }
    await page.getByTestId('meridian-status').waitFor();
    const studio = await open(page);
    assert.equal(studio.projectId, imported.projectId, 'Meridian opens the project imported in the workbench');
    assert.equal(studio.nodes, FIXTURES.and.nodes);
    // Back through the studio's rail: the link waits for the last change and the workbench opens it.
    await page.locator('a.mrd-rail-link', { hasText: 'Project' }).first().click();
    await page.waitForURL(/mode=project/);
    await ready(page);
    assert.equal((await open(page)).projectId, imported.projectId, 'The rail link returns to the same project');
    assert.equal(await page.getByTestId('meridian-leave-notice').count(), 0);
    assert.deepEqual(errors, []);
    record('import-then-navigate', { warnedBeforeLeaving: dialogs.includes('beforeunload'), studioProject: studio.projectName });
    await context.close();
  }

  // 3. Switch rapidly between two saved projects, then reload: the last choice opens, both intact.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await ready(page);
    const projects = {};
    for (const key of ['alu', 'and']) {
      projects[key] = await importProject(page, FIXTURES[key]);
      await page.getByTestId('ide-topbar-save-btn').click();
      await page.locator('[data-testid="ide-save-state"][data-state="saved"]').waitFor();
    }
    // File -> Open Existing Project lists the saved projects; a row opens one.
    const openSaved = async id => {
      await page.getByTestId('ide-menu-file').click();
      await page.getByTestId('ide-menu-item-project.open').click();
      await page.getByTestId(`ide-load-project-${id}`).click();
    };
    const sequence = ['alu', 'and', 'alu', 'and'];
    // Rapid: each choice is made as soon as the menu allows, without waiting for the previous to land.
    for (const key of sequence) await openSaved(projects[key].projectId);
    const last = projects[sequence[sequence.length - 1]];
    await page.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().projectId === id, last.projectId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const boot = await assertCoherentBoot(page, 'rapid-switch');
    // Either the last choice landed, or the boot says the last change did not finish: never a third state.
    if (!boot.unfinished) assert.equal(boot.shown.projectId, last.projectId, 'The last project chosen reopens');
    for (const key of ['alu', 'and']) {
      await openSaved(projects[key].projectId);
      await page.waitForFunction(({ id, nodes }) => { const s = window.__RB_PROJECT_RUNTIME__.getState(); return s.projectId === id && s.circuit.nodes.length === nodes; },
        { id: projects[key].projectId, nodes: FIXTURES[key].nodes });
    }
    assert.deepEqual(errors, []);
    record('rapid-switch', { last: last.projectName, reopened: boot.shown.projectName, unfinished: boot.unfinished });
    await context.close();
  }

  // 4. Save, edit and restore; a write that fails warns before leaving and loses nothing newer.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const dialogs = [];
    page.on('dialog', dialog => { dialogs.push(dialog.type()); void dialog.dismiss(); });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await ready(page);
    const imported = await importProject(page, FIXTURES.and);
    const rename = async name => {
      await page.getByTestId('ide-topbar-project-rename').click();
      const input = page.getByTestId('ide-topbar-project-name-input');
      await input.fill(name);
      await input.press('Enter');
      await page.waitForFunction(name => window.__RB_PROJECT_RUNTIME__.getState().projectName === name, name);
    };
    await rename('Durable edit one');
    await page.getByTestId('ide-topbar-save-btn').click();
    await page.locator('[data-testid="ide-save-state"][data-state="saved"]').waitFor();
    await untilDurable(page, imported.projectId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertCoherentBoot(page, 'edit-save-reload');
    assert.equal((await open(page)).projectName, 'Durable edit one', 'A saved edit is restored after reload');

    // The disk refuses writes (quota): the edit stays open, the state says so, leaving warns.
    const before = stored(await disk(page));
    await page.evaluate(() => {
      window.__RB_ORIGINAL_IDB_PUT__ = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'records') throw new DOMException('Controlled storage capacity failure', 'QuotaExceededError');
        return window.__RB_ORIGINAL_IDB_PUT__.apply(this, args);
      };
    });
    await rename('Durable edit two');
    await page.locator('[data-testid="ide-save-state"][data-state="save-failed"]').waitFor();
    assert.deepEqual(stored(await disk(page)), before, 'A refused write leaves the disk exactly as it was');
    // The page-level handler dismisses (Stay); the reload is cancelled and the page keeps its state.
    const asked = page.waitForEvent('dialog', { timeout: 10000 });
    const leaving = page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).then(() => 'reloaded', () => 'stayed');
    assert.equal((await asked).type(), 'beforeunload', 'Leaving with an unsaved change asks first');
    assert.equal(await leaving, 'stayed', 'Choosing Stay keeps the page');
    assert.equal((await open(page)).projectName, 'Durable edit two', 'Staying keeps the newer edit open');
    // The disk recovers: retrying lands the newer edit, and a reload restores it without a warning.
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__RB_ORIGINAL_IDB_PUT__; });
    await page.getByTestId('ide-topbar-save-btn').click();
    await page.locator('[data-testid="ide-save-state"][data-state="saved"]').waitFor();
    await untilDurable(page, imported.projectId);
    const dialogsBeforeReload = dialogs.length;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertCoherentBoot(page, 'retry-reload');
    assert.equal((await open(page)).projectName, 'Durable edit two', 'The retried write restores the newer edit');
    assert.equal(dialogs.length, dialogsBeforeReload, 'A landed change leaves without a warning');
    await page.screenshot({ path: path.join(out, 'retry-restored-1440x900.png') });
    assert.deepEqual(errors, []);
    record('save-edit-restore-and-failed-write', { warned: true, restored: 'Durable edit two' });
    await context.close();
  }

  // 5. Browser restart: a persistent profile closes and reopens on the same project and edit;
  //    a crash between the record and its metadata is reported at the next boot.
  {
    const profile = path.join(out, 'profile');
    fs.rmSync(profile, { recursive: true, force: true });
    const launchOptions = { viewport: { width: 1440, height: 900 }, ...(chromiumExecutablePath() ? { executablePath: chromiumExecutablePath() } : {}) };
    let context = await chromium.launchPersistentContext(profile, launchOptions);
    page = context.pages()[0] ?? await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await ready(page);
    const imported = await importProject(page, FIXTURES.alu);
    await untilDurable(page, imported.projectId);
    await context.close();
    context = await chromium.launchPersistentContext(profile, launchOptions);
    page = context.pages()[0] ?? await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const boot = await assertCoherentBoot(page, 'browser-restart');
    assert.equal(boot.shown.projectId, imported.projectId, 'The project reopens after the browser restarts');
    assert.equal(boot.shown.nodes, FIXTURES.alu.nodes);
    // Simulate the crash window: metadata claims a runtime revision the record never reached.
    await page.evaluate(async ({ META_KEY }) => {
      const db = await new Promise(resolve => { const request = indexedDB.open('redbyte-ide-sessions-v1'); request.onsuccess = () => resolve(request.result); });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('records', 'readwrite'); const store = tx.objectStore('records');
        const read = store.get(META_KEY);
        read.onsuccess = () => {
          const entry = read.result; const meta = JSON.parse(entry.value);
          store.put({ ...entry, value: JSON.stringify({ ...meta, runtimeRevision: (meta.runtimeRevision ?? 0) + 1000 }), revision: entry.revision + 1 });
        };
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
      });
      db.close();
    }, { META_KEY });
    await context.close();
    context = await chromium.launchPersistentContext(profile, launchOptions);
    page = context.pages()[0] ?? await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    const crashed = await assertCoherentBoot(page, 'metadata-ahead');
    assert.equal(crashed.unfinished, 1, 'Metadata ahead of its record is reported at boot');
    assert.match(await page.getByTestId('ide-session-unfinished').innerText(), /did not finish saving/);
    assert.equal(crashed.shown.projectId, imported.projectId, 'The stored working session is what opens');
    await page.screenshot({ path: path.join(out, 'unfinished-notice-1440x900.png') });
    record('browser-restart-and-metadata-ahead', { reopened: crashed.shown.projectName });
    await context.close();
  }

  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));
  console.log(`PASS durable navigation: ${results.length} steps; ${out}`);
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    fs.writeFileSync(path.join(out, 'failure.txt'), String(error?.stack ?? error) + '\n' + await page.locator('body').innerText().catch(() => ''));
  }
  throw error;
} finally { await browser.close(); }
