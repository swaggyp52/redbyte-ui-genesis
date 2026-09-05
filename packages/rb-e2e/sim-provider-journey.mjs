// P2 Chapter D — simulation-provider selection + run provenance in Simulate.
// RedByte serves simulation through providers with honest evidence tiers:
// Browser Logic (Browser-E0, executes the browser model) and Imported VCD
// (imported-external, replayed, executes nothing). The source toggle makes the
// active provider — the run-of-record — explicit and selectable, and the
// imported Analyzer is de-emphasized when it is not the active provider.
//
// P2.5 grammar: the source toggle is a *choice*, so it renders only once there
// is something to choose. Before an import Simulate offers exactly one import
// route ("Load .vcd file") and no chooser; the toggle mounts with the waveform.
// Provenance is carried by each pill's evidence label (its `title`) and by the
// Analyzer's own evidence/honesty lines — the standalone `ide-sim-provider-active`
// and `ide-sim-provenance` readouts were retired with the old full-width banner.
// Runs at 1440×900 and 1366×768.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_URL, launchChromium } from './harness.mjs';

const VCD = [
  '$timescale 1ns $end',
  '$var wire 1 A clk $end',
  '$var wire 4 B data $end',
  '$enddefinitions $end',
  '#0', '0A', 'b0000 B', '#5', '1A', 'b1010 B',
].join('\n');
const dir = mkdtempSync(join(tmpdir(), 'rb-provider-'));
const vcdPath = join(dir, 'run.vcd');
writeFileSync(vcdPath, VCD, 'utf8');

const browser = await launchChromium();
const fail = (m) => { throw new Error(m); };

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.__RB_PROJECT_RUNTIME__.getState().loadFromProject({
      kind: 'rb-project', version: 1, name: 'Provider Host', createdAt: 'x', updatedAt: 'x',
      circuit: {
        nodes: [
          { id: 'sw0', type: 'INPUT', position: { x: 0, y: 0 } },
          { id: 'and0', type: 'AND', position: { x: 160, y: 0 } },
          { id: 'ld0', type: 'OUTPUT', position: { x: 320, y: 0 } },
        ],
        connections: [
          { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and0', portName: 'a' } },
          { from: { nodeId: 'and0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
        ],
      },
    });
  });
  await page.waitForTimeout(250);
  await page.getByTestId('mode-button-verify').click();
  await page.waitForTimeout(400);

  const analyzer = page.getByTestId('ide-vcd-analyzer');
  const bar = page.getByTestId('ide-sim-provider-bar');

  // ① Nothing to choose yet: no source toggle, but the import route is real and reachable.
  if (await bar.count() !== 0)
    fail('source toggle rendered before there was a second source to choose');
  const loadRoute = page.getByTestId('ide-vcd-analyzer-load');
  if (await loadRoute.count() !== 1)
    fail(`Simulate must offer exactly one .vcd import route, found ${await loadRoute.count()}`);
  if (!(await loadRoute.first().isVisible())) fail('the .vcd import route is not visible in Simulate');
  if (await analyzer.getAttribute('data-active-provider') !== 'false')
    fail('Analyzer claims to be the active provider with no imported waveform');
  console.log(`[${width}×${height}] ① no chooser without a second source; one visible .vcd import route`);

  // ② Import a VCD → the source toggle mounts; Browser logic is still the run-of-record.
  await page.getByTestId('ide-vcd-analyzer-file-input').setInputFiles(vcdPath);
  await page.waitForTimeout(400);
  if (await bar.count() !== 1) fail('source toggle did not mount after importing a waveform');
  const browserPill = page.getByTestId('ide-sim-provider-browser-logic');
  const importedPill = page.getByTestId('ide-sim-provider-imported-vcd');
  if (await browserPill.count() !== 1 || await importedPill.count() !== 1)
    fail('both simulation sources must be selectable once a waveform is imported');
  if (await browserPill.getAttribute('aria-checked') !== 'true')
    fail('Browser logic should still be the run-of-record immediately after an import');
  if (await importedPill.getAttribute('aria-checked') !== 'false')
    fail('an imported waveform silently became the run-of-record');
  const browserProv = (await browserPill.getAttribute('title')) ?? '';
  if (!browserProv.includes('Browser E0') || !browserProv.includes('RedByte logic simulation'))
    fail(`Browser-E0 provenance not honest: ${browserProv}`);
  console.log(`[${width}×${height}] ② waveform imported → toggle mounted, Browser logic still the run-of-record (${browserProv})`);

  // ③ The Analyzer de-emphasizes itself while it is not the run-of-record.
  if (await page.getByTestId('ide-vcd-analyzer-inactive').count() === 0)
    fail('Analyzer should show the inactive-provider strip while Browser Logic is active');
  if (await analyzer.getAttribute('data-active-provider') !== 'false')
    fail('Analyzer marked itself active while Browser Logic is the run-of-record');
  console.log(`[${width}×${height}] ③ Analyzer marked inactive while Browser logic is active`);

  // ④ Select the imported waveform → it becomes the run-of-record; provenance is honest.
  await importedPill.click();
  await page.waitForTimeout(250);
  if (await importedPill.getAttribute('aria-checked') !== 'true')
    fail('active provider did not switch to the imported waveform');
  if (await browserPill.getAttribute('aria-checked') !== 'false')
    fail('two providers are marked as the run-of-record at once');
  const importedProv = (await importedPill.getAttribute('title')) ?? '';
  if (!importedProv.includes('Imported evidence') || !importedProv.includes('outside RedByte'))
    fail(`imported provenance not honest: ${importedProv}`);
  const evidence = (await page.getByTestId('ide-vcd-analyzer-evidence').textContent()) ?? '';
  if (!evidence.includes('outside RedByte'))
    fail(`Analyzer evidence line does not name the external origin: ${evidence}`);
  const honesty = (await page.getByTestId('ide-vcd-analyzer-honesty').textContent()) ?? '';
  if (!/replays/i.test(honesty) || !/executes nothing/i.test(honesty))
    fail(`imported evidence does not state that RedByte executed nothing: ${honesty}`);
  if (await page.getByTestId('ide-vcd-analyzer-inactive').count() !== 0)
    fail('Analyzer inactive strip should be gone once Imported VCD is active');
  if (await analyzer.getAttribute('data-active-provider') !== 'true')
    fail('Analyzer not marked as active provider');
  console.log(`[${width}×${height}] ④ selected the imported waveform → run-of-record + honest imported-external provenance`);

  // ⑤ Switch back to Browser Logic → Analyzer de-emphasized again.
  await browserPill.click();
  await page.waitForTimeout(250);
  if (await browserPill.getAttribute('aria-checked') !== 'true')
    fail('Browser logic did not become the run-of-record again');
  if (await page.getByTestId('ide-vcd-analyzer-inactive').count() === 0)
    fail('Analyzer should re-mark inactive on Browser Logic');
  if (await analyzer.getAttribute('data-active-provider') !== 'false')
    fail('Analyzer still marked active after switching back to Browser logic');
  console.log(`[${width}×${height}] ⑤ switched back to Browser Logic → Analyzer de-emphasized`);

  // ⑥ No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);
  console.log(`[${width}×${height}] ⑥ no horizontal overflow (${overflow}px)`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — simulation-provider selection + provenance live in Simulate at 1440×900 and 1366×768.');
