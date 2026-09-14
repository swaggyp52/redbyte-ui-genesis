// Isolated real-browser IndexedDB proof. This tests the storage adapter directly;
// the student workflow and ten-run workload are exercised by the large journey.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { launchChromium, evidenceDir } from './harness.mjs';
const require = createRequire(import.meta.url);
const typescript = require(require.resolve('typescript', { paths: [path.resolve('packages/rb-apps'), path.resolve('node_modules/.pnpm/typescript@5.9.3/node_modules')] }));
const source = fs.readFileSync('packages/rb-apps/src/apps/ide/durableProjectStorage.ts', 'utf8');
const moduleCode = typescript.transpileModule(source, { compilerOptions: { target: typescript.ScriptTarget.ES2022, module: typescript.ModuleKind.ES2022 } }).outputText;
const out = evidenceDir('storage-transactions', process.env.RB_SHOT_LABEL ?? 'current');
const browser = await launchChromium();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://redbyte-storage-proof.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated storage proof</title>' }));
  await page.goto('http://redbyte-storage-proof.test/');
  const result = await page.evaluate(async code => {
    const moduleUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    const { createIndexedDbSessionStorage, getBrowserSessionStorage, runtimeSessionStorage, runtimePersistence } = await import(moduleUrl);
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const factory = name => createIndexedDbSessionStorage({ indexedDB, legacyStorage: localStorage, databaseName: name });
    const key = 'rb.ide.project.v1:transaction-fixture';
    const index = 'rb.ide.projects.v1.index';
    const damagedKey = 'rb.ide.project.v1:malformed-fixture';
    const metadataKey = 'rb.ide.sessionMeta.v1';
    localStorage.setItem(key, 'legacy readable bytes');
    localStorage.setItem(index, '["legacy index"]');
    localStorage.setItem(damagedKey, '{malformed original');
    localStorage.setItem(metadataKey, '{"version":1,"projectId":"older-project","currentMode":"design","probedKeys":[]}');
    localStorage.setItem('unrelated-setting', 'unchanged');
    const first = factory('migration-proof');
    await first.ready();
    assert(first.snapshot().get(key) === localStorage.getItem(key), 'Migration must read back exact legacy bytes');
    assert(first.snapshot().get(damagedKey) === '{malformed original', 'Malformed bytes must remain recoverable');
    assert(!first.snapshot().has('unrelated-setting'), 'Migration must stay within IDE session keys');
    assert(first.snapshot().get(metadataKey) === localStorage.getItem(metadataKey), 'Navigation metadata must migrate with the session');
    const second = factory('migration-proof');
    await second.ready();
    assert(second.snapshot().get(key) === 'legacy readable bytes', 'Migration must be repeatable');
    await first.commit(new Map([[key, 'first committed session'], [index, '["first index"]']]));
    let conflict = '';
    try { await second.commit(new Map([[key, 'stale tab overwrite'], [index, '["stale index"]']])); }
    catch (error) { conflict = error.name; }
    assert(conflict === 'SessionStorageConflict', 'A stale tab must receive an explicit conflict');
    let reader = factory('migration-proof'); await reader.ready();
    assert(reader.snapshot().get(key) === 'first committed session', 'A stale tab cannot replace the last save');
    assert(reader.snapshot().get(index) === '["first index"]', 'The saved index must remain paired with its snapshot');

    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, ...args) {
      const request = originalPut.call(this, value, ...args);
      if (value.key === key && value.value === 'interrupted session') queueMicrotask(() => this.transaction.abort());
      return request;
    };
    let interrupted = false;
    try { await reader.commit(new Map([[key, 'interrupted session'], [index, '["interrupted index"]']])); }
    catch { interrupted = true; }
    finally { IDBObjectStore.prototype.put = originalPut; }
    assert(interrupted, 'An aborted transaction must reject');
    let afterAbort = factory('migration-proof'); await afterAbort.ready();
    assert(afterAbort.snapshot().get(key) === 'first committed session', 'Interruption cannot replace the previous snapshot');
    assert(afterAbort.snapshot().get(index) === '["first index"]', 'Interruption cannot leave a mismatched index');

    IDBObjectStore.prototype.put = function(value, ...args) {
      if (value.key === key) throw new DOMException('Controlled fixture quota', 'QuotaExceededError');
      return originalPut.call(this, value, ...args);
    };
    let quota = '';
    try { await afterAbort.commit(new Map([[key, 'quota rejected session'], [index, '["quota index"]']])); }
    catch (error) { quota = error.name; }
    finally { IDBObjectStore.prototype.put = originalPut; }
    assert(quota === 'QuotaExceededError', 'Quota failure must reach the persistence owner');
    const afterQuota = factory('migration-proof'); await afterQuota.ready();
    assert(afterQuota.snapshot().get(key) === 'first committed session', 'Quota failure must preserve the prior save');
    await afterQuota.commit(new Map([[key, 'recovered session'], [index, '["recovered index"]']]));
    await afterQuota.commit(new Map([[key, null]]));
    const reopened = factory('migration-proof'); await reopened.ready();
    assert(!reopened.snapshot().has(key), 'Deleted sessions must not reappear from retained legacy data');
    assert(localStorage.getItem(key) === 'legacy readable bytes', 'Original migration bytes remain unchanged');
    assert(localStorage.getItem(damagedKey) === '{malformed original', 'Malformed originals remain unchanged');
    assert(localStorage.getItem('unrelated-setting') === 'unchanged', 'Unrelated storage remains untouched');
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (this.transaction.db.name === 'migration-abort-proof' && value.key === key) throw new DOMException('Controlled migration failure', 'QuotaExceededError');
      return originalPut.call(this, value, ...args);
    };
    let migrationFailed = false;
    try { await factory('migration-abort-proof').ready(); }
    catch { migrationFailed = true; }
    finally { IDBObjectStore.prototype.put = originalPut; }
    assert(migrationFailed && localStorage.getItem(key) === 'legacy readable bytes', 'An interrupted migration must leave its original readable state');
    const retriedMigration = factory('migration-abort-proof'); await retriedMigration.ready();
    assert(retriedMigration.snapshot().get(key) === 'legacy readable bytes' && retriedMigration.snapshot().get(index) === '["legacy index"]', 'Migration must retry cleanly after an aborted initial commit');
    await Promise.all([
      retriedMigration.commit(new Map([[key, 'queued save one']])),
      retriedMigration.commit(new Map([[key, 'queued save two']])),
    ]);
    const afterQueue = factory('migration-abort-proof'); await afterQueue.ready();
    assert(afterQueue.snapshot().get(key) === 'queued save two', 'Same-tab writes must commit in request order');
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function() { throw new DOMException('Controlled full legacy store', 'QuotaExceededError'); };
    try { await afterQueue.commit(new Map([[metadataKey, '{"version":1,"projectId":"newer-project","currentMode":"verify","probedKeys":[]}']])); }
    finally { Storage.prototype.setItem = originalSetItem; }
    const metadataReopen = factory('migration-abort-proof'); await metadataReopen.ready();
    assert(JSON.parse(metadataReopen.snapshot().get(metadataKey)).projectId === 'newer-project', 'New session metadata must persist even while the old localStorage is full');
    assert(JSON.parse(localStorage.getItem(metadataKey)).projectId === 'older-project', 'Migration must not rewrite the legacy metadata');
    const facade = getBrowserSessionStorage(); await facade.ready();
    const runtimeKey = 'rb.ide.project-runtime.v1';
    await runtimeSessionStorage.setItem(runtimeKey, 'last good working session');
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (value.key === runtimeKey || value.key === metadataKey) throw new DOMException('Controlled facade quota', 'QuotaExceededError');
      return originalPut.call(this, value, ...args);
    };
    try {
      await runtimeSessionStorage.setItem(runtimeKey, 'edited working session');
      await runtimeSessionStorage.setItem(metadataKey, 'failed metadata');
    } finally { IDBObjectStore.prototype.put = originalPut; }
    await runtimeSessionStorage.setItem(metadataKey, 'newer metadata');
    assert(runtimePersistence.getStatus().state === 'failed', 'Successful metadata cannot hide the outstanding runtime failure');
    assert(facade.snapshot().get(runtimeKey) === 'last good working session', 'Failed runtime write preserves committed bytes');
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (value.key === metadataKey) throw new DOMException('Controlled metadata failure', 'QuotaExceededError');
      return originalPut.call(this, value, ...args);
    };
    try { await runtimeSessionStorage.setItem(metadataKey, 'obsolete failed metadata'); }
    finally { IDBObjectStore.prototype.put = originalPut; }
    const newerMetadataWrite = runtimeSessionStorage.setItem(metadataKey, 'newer metadata');
    await runtimePersistence.retryFailedWrites();
    await newerMetadataWrite;
    assert(runtimePersistence.getStatus().state === 'ready', 'Explicit retry must clear recovered owner failures');
    assert(facade.snapshot().get(runtimeKey) === 'edited working session', 'Explicit retry must commit the previously failed runtime');
    assert(facade.snapshot().get(metadataKey) === 'newer metadata', 'Retry must not replace newer successfully committed metadata');
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (value.key === runtimeKey) throw new DOMException('Controlled runtime failure', 'QuotaExceededError');
      return originalPut.call(this, value, ...args);
    };
    try { await runtimeSessionStorage.setItem(runtimeKey, 'obsolete failed runtime'); }
    finally { IDBObjectStore.prototype.put = originalPut; }
    const newerRuntimeWrite = runtimeSessionStorage.setItem(runtimeKey, 'newest authored runtime');
    await runtimePersistence.retryFailedWrites();
    await newerRuntimeWrite;
    assert(facade.snapshot().get(runtimeKey) === 'newest authored runtime', 'Retry must not replace a newer runtime edit already queued');
    return { migration: 'exact readback; repeatable; original bytes retained', concurrentTab: conflict,
      runtimeRetry: 'failed owner retained across metadata success; explicit retry commits exact latest failed bytes',
      interruptedMigration: 'original bytes retained; retry completed', queuedWrites: 'request order preserved',
      sessionMetadata: 'migrated and updated in IndexedDB while legacy localStorage writes fail',
      interruption: 'snapshot and index unchanged', quotaFailure: quota, retry: 'committed', deletion: 'tombstone prevents legacy resurrection', malformed: 'preserved unchanged for repository validation' };
  }, moduleCode);
  if (errors.length) throw new Error(errors.join('\n'));
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ ...result, pageErrors: errors, boundary: 'isolated native IndexedDB adapter; no student UI operation claimed' }, null, 2));
  console.log('PASS native IndexedDB migration, two-tab conflict, interrupted transaction, quota failure, recovery and tombstone: ' + out);
} finally { await browser.close(); }
