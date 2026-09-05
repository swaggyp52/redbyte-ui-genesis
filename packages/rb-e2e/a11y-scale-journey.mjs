// Accessibility and scale — one record per claim, and no claim wider than its check.
//
// What this journey proves, separately:
//   1 landmark      exactly one <main>.
//   2 bounded list   a 500-signal imported VCD renders a bounded number of rows with an
//                    honest "showing N of M" hint instead of 500 DOM rows.
//   3 reachable      a signal past the row cap is still reachable and operable through the
//                    filter, so bounding hides nothing permanently.
//   4 keyboard       a control is reached by Tab and OPERATED by key, with the resulting
//                    state change asserted - not merely focusable.
//   5 reflow         no horizontal overflow at the test viewport, and none at half of it,
//                    which is reflow at a narrow width (WCAG 1.4.10).
//   6 text resize    text scaled to 200% (WCAG 1.4.4) keeps the same controls operable.
//
// What it does NOT prove, and must not be described as proving: real browser zoom, screen
// reader output, colour contrast, focus-order quality across every surface, or performance.
// Those are separate records and are not asserted here.
//
// The waveform and the schematic are engineering canvases: they are ALLOWED to scroll
// horizontally inside their own containers. The overflow checks below are on the document,
// never on those canvases, and nothing here should be "fixed" by hiding clipped content.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, launchChromium } from './harness.mjs';

// A 500-signal VCD.
const vcdLines = ['$timescale 1ns $end'];
const ids = [];
for (let i = 0; i < 500; i++) { const id = `s${i}`; ids.push(id); vcdLines.push(`$var wire 4 ${id} sig${i} $end`); }
vcdLines.push('$enddefinitions $end', '#0');
for (const id of ids) vcdLines.push(`b1010 ${id}`);
const dir = mkdtempSync(join(tmpdir(), 'rb-a11y-'));
const vcdPath = join(dir, 'big.vcd');
writeFileSync(vcdPath, vcdLines.join('\n'), 'utf8');

const browser = await launchChromium();
const fail = (m) => { throw new Error(m); };

async function loadAndOpenSimulate(page) {
  await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadFromProject({
    kind: 'rb-project', version: 1, name: 'A11y Host', createdAt: 'x', updatedAt: 'x',
    circuit: { nodes: [{ id: 'sw0', type: 'INPUT', position: { x: 0, y: 0 } }, { id: 'ld0', type: 'OUTPUT', position: { x: 160, y: 0 } }],
      connections: [{ from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } }] },
  }));
  await page.waitForTimeout(250);
  await page.getByTestId('mode-button-verify').click();
  await page.waitForTimeout(400);
}

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await loadAndOpenSimulate(page);

  // ① Exactly one main landmark.
  const mains = await page.locator('main').count();
  if (mains !== 1) fail(`expected one <main> landmark, found ${mains}`);
  console.log(`[${width}×${height}] ① exactly one main landmark`);

  // ② Load a 500-signal VCD → the signal list is bounded, not exploded.
  await page.getByTestId('ide-vcd-analyzer-file-input').setInputFiles(vcdPath);
  await page.waitForTimeout(400);
  const totalSignals = (await page.getByTestId('ide-vcd-analyzer-signal-count').textContent())?.trim();
  if (totalSignals !== '500') fail(`expected 500 signals reported, got ${totalSignals}`);
  const renderedRows = await page.locator('[data-testid^="ide-vcd-analyzer-signal-"]').count();
  // testid prefix also matches signal-count / signal-more; the row cap is 200.
  if (renderedRows > 210) fail(`signal rows not bounded (rendered ${renderedRows})`);
  if (await page.getByTestId('ide-vcd-analyzer-signal-more').count() === 0) fail('bounded "showing N of M" hint missing');
  const shownRows = await page.locator('.ide-vcd-analyzer-signal-row').count();
  if (shownRows === 0) fail('no signal rows rendered at all');
  console.log(`[${width}×${height}] ② 500 signals reported, ${shownRows} rows rendered, honest hint present`);

  // ③ Bounded is not hidden: a signal past the cap is reachable and operable via the filter.
  // The row testid carries the signal KEY, which is not the display name. Ask the panel
  // which key belongs to the signal that is past the cap.
  const deepName = 'sig473';
  const deepSignal = await page.evaluate(() => {
    const wf = window.__RB_PROJECT_RUNTIME__.getState().importedWaveform;
    const hit = (wf?.signals ?? []).find((sig) => sig.name === 'sig473');
    return hit ? hit.key : null;
  });
  if (!deepSignal) fail('sig473 is not in the loaded waveform');
  const beforeFilter = await page.locator(`[data-testid="ide-vcd-analyzer-signal-${deepSignal}"]`).count();
  if (beforeFilter !== 0) fail(`${deepSignal} was already rendered; pick a signal past the row cap`);
  await page.getByTestId('ide-vcd-analyzer-search').fill(deepName);
  await page.waitForTimeout(300);
  const deepRow = page.locator(`[data-testid="ide-vcd-analyzer-signal-${deepSignal}"]`);
  if (await deepRow.count() === 0) fail(`${deepName} is unreachable through the filter — the cap hides work`);
  await page.getByTestId(`ide-vcd-analyzer-pin-${deepSignal}`).check();
  await page.waitForTimeout(250);
  const pinned = await page.evaluate((key) => {
    const row = document.querySelector(`[data-testid="ide-vcd-analyzer-signal-${key}"]`);
    const box = document.querySelector(`[data-testid="ide-vcd-analyzer-pin-${key}"]`);
    return {
      pinnedClass: row?.className.includes('is-pinned') ?? false,
      checked: box instanceof HTMLInputElement ? box.checked : null,
    };
  }, deepSignal);
  if (!pinned.checked) fail(`${deepSignal} could not be pinned after the filter reached it`);
  console.log(`[${width}×${height}] ③ ${deepName} — past the row cap — is reachable and pinnable through the filter`);
  await page.getByTestId('ide-vcd-analyzer-search').fill('');
  await page.waitForTimeout(250);

  // ④ Keyboard OPERATION, not just focus: reach a control with Tab and act on it with a key,
  // then assert the state it was supposed to change.
  await page.getByTestId('ide-vcd-analyzer-search').focus();
  let hops = 0;
  let reached = null;
  while (hops < 40) {
    await page.keyboard.press('Tab');
    hops += 1;
    reached = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
    if (reached && reached.startsWith('ide-vcd-analyzer-pin-')) break;
  }
  if (!reached || !reached.startsWith('ide-vcd-analyzer-pin-')) {
    fail(`no signal pin control was reachable by Tab within ${hops} hops`);
  }
  const pinKey = reached.replace('ide-vcd-analyzer-pin-', '');
  const wasChecked = await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el instanceof HTMLInputElement ? el.checked : null;
  }, reached);
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  const nowChecked = await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el instanceof HTMLInputElement ? el.checked : null;
  }, reached);
  if (nowChecked === wasChecked) {
    fail(`Space on the focused pin control for ${pinKey} changed nothing — focusable is not operable`);
  }
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  console.log(`[${width}×${height}] ④ keyboard: Tab reached ${pinKey} in ${hops} hops and Space operated it`);

  // ⑤ Reflow: no horizontal overflow of the DOCUMENT at this viewport, or at half of it.
  // Engineering canvases may still scroll inside their own containers; that is not overflow
  // of the page and must not be "fixed" by clipping them.
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);
  await page.setViewportSize({ width: Math.round(width / 2), height: Math.round(height / 2) });
  await page.waitForTimeout(300);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${Math.round(width / 2)}×${Math.round(height / 2)}: ${overflow}px`);
  console.log(`[${width}×${height}] ⑤ reflow: no document overflow at full width or half width (reduced motion)`);

  // ⑥ Text resize to 200% (WCAG 1.4.4) — the control must still be there and operable.
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(200);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.waitForTimeout(400);
  const resized = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ide-vcd-analyzer-search"]');
    if (!(el instanceof HTMLElement)) return null;
    const box = el.getBoundingClientRect();
    return { visible: box.width > 0 && box.height > 0, root: getComputedStyle(document.documentElement).fontSize };
  });
  if (!resized?.visible) fail('the analyzer filter disappears when text is scaled to 200%');
  await page.getByTestId('ide-vcd-analyzer-search').fill('sig12');
  await page.waitForTimeout(300);
  const stillWorks = await page.locator('.ide-vcd-analyzer-signal-row').count();
  if (stillWorks === 0) fail('filtering does not work with text scaled to 200%');
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  console.log(`[${width}×${height}] ⑥ text resize: root ${resized.root}, filter still visible and operable`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log(
  '\nPASS — at 1440×900 and 1366×768: one main landmark; a 500-signal VCD bounded with an ' +
  'honest hint; a signal past the cap reachable and pinnable through the filter; a control ' +
  'reached by Tab and operated by Space with the state change asserted; no document overflow ' +
  'at full or half width under reduced motion; and text at 200% leaving the filter operable.\n' +
  'NOT proven here: real browser zoom, screen-reader output, colour contrast, focus order ' +
  'across every surface, or performance.'
);
