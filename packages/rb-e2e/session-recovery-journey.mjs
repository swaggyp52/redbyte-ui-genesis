// Real UI recovery under an environmental IndexedDB write failure. No runtime
// mutation: the injected fault changes only the browser's storage capability.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const out = evidenceDir('session-recovery', process.env.RB_SHOT_LABEL ?? 'current');
const browser = await launchChromium();
let page;
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  const tid = id => page.getByTestId(id);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const read = key => page.evaluate(async key => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('redbyte-ide-sessions-v1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction('records');
        const request = transaction.objectStore('records').get(key);
        transaction.oncomplete = () => resolve(request.result?.value ?? null);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }, key);
  const state = () => page.evaluate(() => {
    const s = window.__RB_PROJECT_RUNTIME__.getState();
    return JSON.parse(JSON.stringify({ projectId: s.projectId, circuit: s.circuit,
      scenarios: s.scenarios, activeScenarioId: s.activeScenarioId,
      archive: s.verifyRunArchive, lastRun: s.verifyLastRun }));
  });
  const save = async () => {
    await tid('ide-topbar-save-btn').click();
    await page.locator('[data-testid="ide-save-state"][data-state="saved"]').waitFor();
  };
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await tid('ide-project-start-a-lab-primary').click();
  await page.locator('[data-testid^="ide-project-gannon-lab-card-"]').nth(4).click();
  await page.locator('[data-testid^="ide-project-gannon-lab-start-"]').first().click();
  await tid('mode-button-verify').click();
  await tid('ide-vcb-run').click();
  await tid('ide-run-identity').waitFor();
  await save();
  const before = await state();
  assert.ok(before.archive.length > 0);
  const key = 'rb.ide.project.v1:' + before.projectId;
  const lastGood = await read(key);
  assert.ok(lastGood);
  await page.evaluate(() => {
    window.__RB_ORIGINAL_IDB_PUT__ = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'records') throw new DOMException('Controlled storage capacity failure', 'QuotaExceededError');
      return window.__RB_ORIGINAL_IDB_PUT__.apply(this, args);
    };
  });
  if (await tid('ide-verify-view-timeline').count()) await tid('ide-verify-view-timeline').click();
  await page.getByRole('gridcell', { name: /^EN at t2:/ }).click();
  const edited = await state();
  assert.notDeepEqual(edited.scenarios, before.scenarios);
  assert.deepEqual(edited.archive, before.archive);
  await tid('ide-topbar-save-btn').click();
  await tid('ide-session-save-failure').waitFor();
  assert.equal(await tid('ide-save-state').getAttribute('data-state'), 'save-failed');
  assert.equal(await read(key), lastGood, 'Failed write preserves the previous committed project byte for byte');
  assert.deepEqual(await state(), edited, 'Write failure leaves the authored session and recordings open');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    tid('ide-session-save-failure').getByRole('button', { name: 'Download session backup' }).click(),
  ]);
  const backupPath = path.join(out, download.suggestedFilename());
  await download.saveAs(backupPath);
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.deepEqual(backup.snapshot.scenarios, edited.scenarios);
  assert.equal(backup.snapshot.projectId, edited.projectId);
  assert.equal(backup.snapshot.runEvidence.archive.length, edited.archive.length);
  assert.equal(backup.snapshot.runEvidence.lastRun.runId, edited.lastRun.runId);
  assert.equal(await read(key), lastGood, 'Downloading the backup does not mutate the last good save');
  await page.screenshot({ path: path.join(out, 'save-failure-backup-1440x900.png') });
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.__RB_ORIGINAL_IDB_PUT__; });
  await save();
  assert.notEqual(await read(key), lastGood);
  await page.reload({ waitUntil: 'networkidle' });
  await tid('ide-topbar-save-btn').waitFor();
  await tid('mode-button-verify').click();
  assert.deepEqual(await state(), edited, 'Successful retry and reload restore the complete edited session');
  await page.screenshot({ path: path.join(out, 'recovered-session-1440x900.png') });
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ baseUrl: BASE_URL,
    projectId: edited.projectId, recordings: edited.archive.length, backup: path.basename(backupPath),
    lastGoodPreserved: true, retryReopenedExactly: true, errors }, null, 2));
  console.log('PASS failed durable write, complete backup, exact last-good preservation and successful retry/reload: ' + out);
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    fs.writeFileSync(path.join(out, 'failure.txt'), String(error) + '\n' + await page.locator('body').innerText().catch(() => ''));
  }
  throw error;
} finally { await browser.close(); }
