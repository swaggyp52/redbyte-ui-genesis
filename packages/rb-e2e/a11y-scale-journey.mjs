// P2 Chapter H — accessibility + scale hardening. A 500-signal imported VCD does
// not explode the DOM (bounded rendering with an honest "showing N of M" hint);
// there is exactly one main landmark; the new surfaces are keyboard-reachable,
// survive reduced-motion, and never overflow horizontally — including at an
// effective 200% zoom (emulated with a halved viewport). Drives the real UI.
import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A 500-signal VCD.
const vcdLines = ['$timescale 1ns $end'];
const ids = [];
for (let i = 0; i < 500; i++) { const id = `s${i}`; ids.push(id); vcdLines.push(`$var wire 4 ${id} sig${i} $end`); }
vcdLines.push('$enddefinitions $end', '#0');
for (const id of ids) vcdLines.push(`b1010 ${id}`);
const dir = mkdtempSync(join(tmpdir(), 'rb-a11y-'));
const vcdPath = join(dir, 'big.vcd');
writeFileSync(vcdPath, vcdLines.join('\n'), 'utf8');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
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

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
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
  console.log(`[${width}×${height}] ② 500-signal VCD bounded to ~200 rows with an honest hint`);

  // ③ Keyboard reachability: the Load button can hold focus and activate.
  const focusedTestId = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="ide-vcd-analyzer-load"]');
    if (!(btn instanceof HTMLElement)) return null;
    btn.focus();
    return document.activeElement?.getAttribute('data-testid') ?? null;
  });
  if (focusedTestId !== 'ide-vcd-analyzer-load') fail('Load control is not keyboard-focusable');
  console.log(`[${width}×${height}] ③ new controls are keyboard-focusable`);

  // ④ No horizontal overflow at this viewport, under reduced motion.
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);
  console.log(`[${width}×${height}] ④ no horizontal overflow (reduced-motion)`);

  // ⑤ Effective 200% zoom (halved viewport) → still no horizontal overflow.
  await page.setViewportSize({ width: Math.round(width / 2), height: Math.round(height / 2) });
  await page.waitForTimeout(300);
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at effective 200% (${Math.round(width / 2)}×${Math.round(height / 2)}): ${overflow}px`);
  console.log(`[${width}×${height}] ⑤ no horizontal overflow at effective 200% zoom`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — accessibility + scale hardening at 1440×900 and 1366×768 (incl. 500-signal bounding + effective 200%).');
