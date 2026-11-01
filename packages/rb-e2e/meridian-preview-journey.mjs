// Meridian Preview is a deliberate entry from the classic workbench, on the same project (owner
// decision for 1.0: classic stays primary; Meridian was reachable only by typing ?studio=meridian).
// The entry saves what is open before leaving, Meridian shows the same project and revision, a
// run made there lands in the same ledger, and every way back stays in this one tab.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BASE_URL, evidenceDir, launchChromium } from './harness.mjs';

const out = evidenceDir('meridian-preview', process.env.RB_SHOT_LABEL ?? 'current');
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium();
const results = {};
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(90000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => { errors.push(`dialog: ${dialog.message()}`); void dialog.dismiss(); });
  const runtime = (fn) => page.evaluate(fn);

  // 1. A starter, one edit (a part placed) so there is unsaved work.
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Starters/ }).first().click();
  await page.getByText('2-Bit Up Counter (Basys3)', { exact: true }).first().click();
  await page.getByRole('button', { name: /^(Open starter|Start .+)$/ }).first().click();
  await page.waitForFunction(() => (window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.length ?? 0) > 0);
  await page.getByTestId('mode-button-design').click();
  const canvas = page.getByTestId('ide-design-canvas');
  await canvas.waitFor();
  const placed = await runtime(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length);
  await page.getByText('NOT Gate', { exact: true }).first().click();
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width - 120, box.y + box.height - 120);
  await page.waitForFunction((n) => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length > n, placed);
  await page.keyboard.press('Escape');
  const before = await runtime(() => { const s = window.__RB_PROJECT_RUNTIME__.getState(); return { id: s.projectId, revision: s.designRevision, nodes: s.circuit.nodes.length, runs: s.verifyRunHistory.length }; });

  // 2. The entry is in the View menu; it leaves in this tab for the same project, with no example.
  await page.getByTestId('ide-menu-view').click();
  const entry = page.getByTestId('ide-menu-item-workspace.meridian-preview.open');
  assert.equal(await entry.isEnabled(), true, 'Open in Meridian Preview is enabled with a design open');
  await Promise.all([page.waitForURL(/studio=meridian/), entry.click()]);
  await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__?.persist?.hasHydrated?.() === true);
  const studioUrl = new URL(page.url());
  assert.equal(studioUrl.searchParams.get('stage'), 'design');
  assert.equal(studioUrl.searchParams.has('example'), false, 'the entry never opens an example over the project');
  await page.getByTestId('meridian-sheet').waitFor();
  assert.match(await page.getByTestId('meridian-preview-label').innerText(), /Meridian Preview/);
  const inStudio = await runtime(() => { const s = window.__RB_PROJECT_RUNTIME__.getState(); return { id: s.projectId, revision: s.designRevision, nodes: s.circuit.nodes.length }; });
  assert.deepEqual(inStudio, { id: before.id, revision: before.revision, nodes: before.nodes }, 'Meridian opens the same project at the same revision');
  await page.screenshot({ path: path.join(out, 'meridian-preview-design.png') });

  // 3. A run in Meridian.
  await page.keyboard.press('3');
  await page.keyboard.press('Control+Enter');
  await page.waitForFunction((n) => window.__RB_PROJECT_RUNTIME__.getState().verifyRunHistory.length > n, before.runs, { timeout: 30000 });
  const studioRun = await runtime(() => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId ?? null);

  // 4. Back to the classic workbench with a modified click: same tab, the matching stage.
  const back = page.getByTestId('meridian-back-to-classic');
  assert.equal(await back.getAttribute('href'), '?mode=verify');
  await Promise.all([page.waitForURL(/mode=verify/), back.click({ modifiers: ['Control'] })]);
  // The workbench starts from a default state and then hydrates the stored session.
  await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__?.persist?.hasHydrated?.() === true);
  assert.equal(context.pages().length, 1, 'following the link opened a second tab');
  const after = await runtime(() => { const s = window.__RB_PROJECT_RUNTIME__.getState(); return { id: s.projectId, nodes: s.circuit.nodes.length, runs: s.verifyRunHistory.map((r) => r.runId), last: s.verifyLastRun?.runId ?? null }; });
  assert.equal(after.id, before.id, 'the workbench keeps the same project');
  assert.equal(after.nodes, before.nodes);
  assert.equal(after.runs.length, before.runs + 1, 'exactly one new run, the one made in Meridian');
  assert.equal(after.last, studioRun);
  assert.equal(new Set(after.runs).size, after.runs.length, 'no run is duplicated');
  const bodyText = await page.locator('body').innerText();
  assert.doesNotMatch(bodyText, /could not be opened/i);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(out, 'back-in-simulate.png') });
  Object.assign(results, { project: before.id, revision: before.revision, studioRun, pages: context.pages().length });
  console.log(`ok: View > Open in Meridian Preview on ${before.id} (revision ${before.revision}); Meridian run ${studioRun} is in the workbench ledger; one tab`);
  await context.close();
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(`PASS — Meridian Preview: one project, one ledger, one tab -> ${out}`);
