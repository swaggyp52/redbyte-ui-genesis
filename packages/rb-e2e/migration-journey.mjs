// P2 Chapter G — project-format migration UX. Opening an older-format project
// never upgrades it silently: RedByte shows a "Project update required" dialog
// with the changes, and the user chooses to open an upgraded copy, export the
// original untouched, review, or cancel. The original file is never overwritten;
// only an in-memory upgraded copy is loaded, durable on save. This journey drives
// the real file input with a pre-versioned (v0) .rbproj. Runs at 1440×900 and 1366×768.
import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A pre-versioned (v0) document: project-shaped (has a circuit) but no version field.
const V0_PROJECT = JSON.stringify({
  name: 'Legacy Project',
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
  circuit: {
    nodes: [
      { id: 'sw0', type: 'INPUT', position: { x: 0, y: 0 } },
      { id: 'ld0', type: 'OUTPUT', position: { x: 160, y: 0 } },
    ],
    connections: [{ from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } }],
  },
}, null, 2);

const dir = mkdtempSync(join(tmpdir(), 'rb-migrate-'));
const legacyPath = join(dir, 'legacy.rbproj');
writeFileSync(legacyPath, V0_PROJECT, 'utf8');

// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const fail = (m) => { throw new Error(m); };

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // ① Open a v0 project through the real file input → the update dialog appears.
  await page.getByTestId('ide-project-file-input').setInputFiles(legacyPath);
  await page.waitForTimeout(400);
  if (await page.getByTestId('ide-format-migration-dialog').count() === 0) fail('migration dialog did not appear for a v0 project');
  const from = (await page.getByTestId('ide-format-migration-from').textContent())?.trim();
  if (from !== 'v0') fail(`expected from-version v0, got ${from}`);
  const changes = (await page.getByTestId('ide-format-migration-changes').textContent()) ?? '';
  if (changes.trim().length === 0) fail('no migration changes listed');
  console.log(`[${width}×${height}] ① v0 project → "update required" dialog with changes`);

  // ② Export original backup → a download of the untouched original.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('ide-format-migration-backup').click(),
  ]);
  const suggested = download.suggestedFilename();
  if (!suggested.includes('original')) fail(`backup filename not marked original: ${suggested}`);
  const savedTo = join(dir, 'downloaded-backup.rbproj');
  await download.saveAs(savedTo);
  const backup = readFileSync(savedTo, 'utf8');
  if (backup !== V0_PROJECT) fail('exported backup is not byte-identical to the original v0 document');
  console.log(`[${width}×${height}] ② exported original backup — byte-identical, untouched`);

  // The dialog stays open after a backup; the store has NOT loaded the project yet.
  const loadedBefore = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length);
  if (await page.getByTestId('ide-format-migration-dialog').count() === 0) fail('dialog closed after backup (should stay open)');

  // ③ Open upgraded copy → the project loads, upgraded; a durable record is set.
  await page.getByTestId('ide-format-migration-open').click();
  await page.waitForTimeout(500);
  if (await page.getByTestId('ide-format-migration-dialog').count() !== 0) fail('dialog still open after opening the upgraded copy');
  const state = await page.evaluate(() => {
    const s = window.__RB_PROJECT_RUNTIME__.getState();
    return { nodes: s.circuit.nodes.length, lastSavedAt: s.lastSavedAt };
  });
  if (state.nodes < 2) fail(`upgraded project not loaded (nodes=${state.nodes})`);
  if (!/Upgraded/.test(state.lastSavedAt) || !/v0/.test(state.lastSavedAt)) fail(`migration record missing: ${state.lastSavedAt}`);
  console.log(`[${width}×${height}] ③ opened upgraded copy — loaded (${state.nodes} nodes), record: "${state.lastSavedAt}"`);

  // ④ Cancel path: re-open the v0 file, then cancel — nothing loads/changes.
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByTestId('ide-project-file-input').setInputFiles(legacyPath);
  await page.waitForTimeout(400);
  await page.getByTestId('ide-format-migration-cancel').click();
  await page.waitForTimeout(200);
  if (await page.getByTestId('ide-format-migration-dialog').count() !== 0) fail('dialog still open after cancel');
  console.log(`[${width}×${height}] ④ cancel dismisses the dialog without loading`);

  // ⑤ No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);
  console.log(`[${width}×${height}] ⑤ no horizontal overflow (${overflow}px)`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — project-format migration UX honest at 1440×900 and 1366×768.');
