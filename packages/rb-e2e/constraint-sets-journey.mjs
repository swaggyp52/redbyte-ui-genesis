// Named constraints: UI capture/restore governs canonical mapping, preview and actual ZIP bytes.
// Fresh profiles protect the owner's IndexedDB. Runtime and IndexedDB reads are assertion-only.
import { BASE_URL, launchChromium, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../rb-apps/package.json', import.meta.url));
const JSZip = require('jszip');
const out = evidenceDir('constraint-authority', process.env.RB_SHOT_LABEL ?? 'current');
const browser = await launchChromium();
const results = { baseUrl: BASE_URL, browserVersion: browser.version(), viewports: [] };

const PROJECT = {
  kind: 'rb-project', version: 1,
  name: 'Constraint authority fixture', createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z',
  circuit: {
    nodes: [
      { id: 'a', type: 'INPUT', label: 'A', position: { x: 0, y: 0 } },
      { id: 'ld', type: 'OUTPUT', label: 'Y', position: { x: 160, y: 0 } },
    ],
    connections: [{ id: 'a-y', from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'ld', portName: 'in' } }],
  },
  ioMapping: {
    inputs: [{ id: 'a', nodeId: 'a', port: 'out', label: 'A', pin: 'V17' }],
    outputs: [{ id: 'y', nodeId: 'ld', port: 'in', label: 'Y', pin: 'U16' }],
  },
  hdl: { top: 'top', sources: [
    { path: 'constraints/original.xdc', language: 'xdc', text: 'if {$enabled} { set_property PACKAGE_PIN W17 [get_ports A] }' },
  ] },
  fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'top' },
};
const fixture = path.join(out, 'constraint-authority.rbproj');
fs.writeFileSync(fixture, JSON.stringify(PROJECT, null, 2));

const read = page => page.evaluate(() => {
  const s = window.__RB_PROJECT_RUNTIME__.getState();
  return JSON.parse(JSON.stringify({ projectId: s.projectId, constraintSets: s.constraintSets,
    mapping: s.hardwareMappingV2, rows: s.projectIoRows, sourceModel: s.sourceModel, exportHistory: s.exportHistory }));
});
const fileMenu = async (page, command) => {
  await page.getByTestId('ide-menu-file').click();
  await page.getByTestId(`ide-menu-item-${command}`).click();
};
const save = async page => {
  await page.getByTestId('ide-topbar-save-btn').click();
  await page.locator('[data-testid="ide-save-state"][data-state="saved"]').waitFor({ timeout: 30000 });
};
const board = async page => {
  await page.getByTestId('mode-button-hardware').click();
  const disclosure = page.getByTestId('ide-hw-constraints-tool');
  if (!(await disclosure.evaluate(el => el.open))) await disclosure.locator(':scope > summary').click();
};
const capture = async (page, name) => {
  await page.getByTestId('ide-constraint-sets-add-name').fill(name);
  await page.getByTestId('ide-constraint-sets-add').click();
  const model = await read(page);
  const captured = model.constraintSets.sets.find(set => set.name === name);
  assert(captured?.mappingSnapshot, `capture ${name} must retain structured mapping`);
  return captured.id;
};
const assertA = async page => {
  const model = await read(page);
  assert.equal(model.rows.find(row => row.id === 'a').pin, 'V17');
  assert.equal(model.constraintSets.sets.find(set => set.id === model.constraintSets.activeId)?.name, 'Capture A');
  return model;
};
const downloadZip = async (page, label) => {
  await page.getByTestId('mode-button-export').click();
  await page.getByTestId('ide-export-file-top-xdc').click();
  const preview = await page.getByTestId('ide-export-preview-code').locator('.rb-pkg-code-line').evaluateAll(lines =>
    lines.map(line => { const text = line.children[1].textContent; return text === ' ' ? '' : text; }).join('\n'));
  assert.match(preview, /PACKAGE_PIN V17\b.*\{A\}/);
  assert.doesNotMatch(preview, /PACKAGE_PIN V16\b/);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.locator('[data-testid="ide-export-draft-download-v1"], [data-testid="ide-export-package-build-v1"], [data-testid="ide-export-package-download-v1"]').click(),
  ]);
  const zipPath = path.join(out, `package-${label}.zip`);
  await download.saveAs(zipPath);
  const bytes = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(bytes);
  const xdcPath = Object.keys(zip.files).find(name => /(?:^|\/)top\.xdc$/.test(name));
  assert(xdcPath, 'download must contain top.xdc');
  const xdc = await zip.file(xdcPath).async('string');
  assert.equal(xdc, preview, 'downloaded top.xdc bytes must equal the rendered preview');
  const manifestPath = Object.keys(zip.files).find(name => /project\.rbproj\.json$/.test(name));
  assert(manifestPath, 'download must include its round-trip manifest');
  const manifest = JSON.parse(await zip.file(manifestPath).async('string'));
  assert.equal(manifest.fpga.constraints.text, xdc, 'manifest must carry exact packaged constraints');
  const sha = createHash('sha256').update(bytes).digest('hex');
  await page.waitForFunction(hash => window.__RB_PROJECT_RUNTIME__.getState().exportHistory.some(receipt => receipt.packageHash === hash), sha);
  await page.screenshot({ path: path.join(out, `package-${label}.png`) });
  return { zipPath, sha, xdcPath, xdc };
};

async function run(width, height) {
  const label = `${width}x${height}`;
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const evidence = { label, errors, packages: [] };
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByTestId('ide-project-file-input').setInputFiles(fixture);
    await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().projectName === 'Constraint authority fixture');
    await board(page);
    const initial = await read(page);
    assert.equal(initial.constraintSets.activeId, null, 'raw Tcl is a retained reference');
    const rawId = initial.constraintSets.sets[0].id;
    assert(await page.getByTestId(`ide-constraint-set-activate-${rawId}`).isDisabled());
    const a = await capture(page, 'Capture A');
    await page.getByTestId(`ide-constraint-set-activate-${a}`).click();
    await page.getByTestId('ide-hw-map-row-action-a').click();
    await page.getByTestId('ide-hw-direct-resource-select').selectOption('SW1');
    await page.getByTestId('ide-hw-assign-selected-resource').click();
    assert.equal((await read(page)).constraintSets.activeId, null, 'pin edit must detach named selection');
    assert.equal((await read(page)).rows.find(row => row.id === 'a').pin, 'V16');
    const b = await capture(page, 'Capture B');
    await page.getByTestId(`ide-constraint-set-activate-${a}`).click();
    await assertA(page);
    assert.equal(await page.getByTestId('ide-hw-direct-resource-select').inputValue(), 'SW0', 'restoring A updates the selected editor and board highlight');
    assert.match(await page.getByTestId('ide-hw-xdc-line-a').textContent(), /PACKAGE_PIN V17/);
    await page.screenshot({ path: path.join(out, `board-active-A-${label}.png`) });
    evidence.packages.push(await downloadZip(page, label));
    await save(page);
    const beforeClose = await read(page);
    await fileMenu(page, 'project.close');
    await page.getByTestId('ide-project-landing').waitFor();
    await fileMenu(page, 'project.open');
    await page.getByTestId(`ide-load-project-${beforeClose.projectId}`).click();
    await page.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().projectId === id, beforeClose.projectId);
    const reopened = await assertA(page);
    assert.deepEqual(reopened.constraintSets, beforeClose.constraintSets, 'explicit reopen preserves named snapshots and selection');
    assert.deepEqual(reopened.sourceModel, beforeClose.sourceModel, 'unsupported raw Tcl original text survives explicit reopen');
    await page.reload({ waitUntil: 'networkidle' });
    await assertA(page);
    evidence.packages.push(await downloadZip(page, `${label}-reopen`));
    const [backup] = await Promise.all([page.waitForEvent('download'), fileMenu(page, 'project.export-backup')]);
    const backupPath = path.join(out, `backup-${label}.rb-session.json`);
    await backup.saveAs(backupPath);
    const restoreContext = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
    try {
      const restoredPage = await restoreContext.newPage();
      restoredPage.on('pageerror', error => errors.push(`restore: ${error.message}`));
      await restoredPage.goto(BASE_URL, { waitUntil: 'networkidle' });
      await restoredPage.getByTestId('ide-project-file-input').setInputFiles(backupPath);
      await restoredPage.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().projectId === id, beforeClose.projectId);
      const restored = await assertA(restoredPage);
      assert.deepEqual(restored.constraintSets, beforeClose.constraintSets, 'backup restore preserves complete constraint authority');
      assert.deepEqual(restored.sourceModel, beforeClose.sourceModel, 'backup restore preserves raw original source text');
      evidence.packages.push(await downloadZip(restoredPage, `${label}-backup`));
    } finally { await restoreContext.close(); }
    await board(page);
    await page.getByTestId(`ide-constraint-set-remove-${a}`).click();
    const afterRemove = await read(page);
    assert.equal(afterRemove.constraintSets.activeId, null, 'active deletion explicitly returns to current live mapping');
    assert.equal(afterRemove.rows.find(row => row.id === 'a').pin, 'V17', 'deletion cannot apply B unexpectedly');
    assert(afterRemove.constraintSets.sets.some(set => set.id === b));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, `horizontal overflow: ${overflow}px`);
    assert.deepEqual(errors, []);
    evidence.overflowPx = overflow;
    evidence.status = 'pass';
    console.log(`PASS ${label}: A/B activation, preview/ZIP/manifest/SHA, reopen/reload/backup and safe deletion`);
  } catch (error) {
    evidence.status = 'fail'; evidence.error = error.stack;
    await page.screenshot({ path: path.join(out, `failure-${label}.png`) }).catch(() => {});
    throw error;
  } finally {
    results.viewports.push(evidence);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    await context.close();
  }
}
try { await run(1440, 900); await run(1280, 650); }
finally { await browser.close(); }
