// P2 Chapter A — the imported-VCD Analyzer is mounted in the real Simulate
// surface. It integrates the existing bounded VCD reader + simulation-provider
// model (no second parser, no second store) into a three-zone workbench
// (SIGNALS / WAVEFORM / MEASUREMENTS) with honest provider identity: imported
// external evidence, replayed but never executed. This journey drives the real
// UI: it loads a .vcd through the actual file input, reads the store only for
// setup/assertions, measures values at a cursor, changes radix, and proves the
// Analyzer survives a reload. Runs at 1440×900 and 1366×768.
import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const VCD = [
  '$timescale 1ns $end',
  '$var wire 1 A clk $end',
  '$var wire 4 B data $end',
  '$var wire 4 C addr $end',
  '$enddefinitions $end',
  '#0',
  '0A',
  'b0000 B',
  'b0001 C',
  '#5',
  '1A',
  'b1010 B',
  '#10',
  '0A',
  'b1111 C',
].join('\n');

const dir = mkdtempSync(join(tmpdir(), 'rb-vcd-'));
const vcdPath = join(dir, 'counter.vcd');
writeFileSync(vcdPath, VCD, 'utf8');
const badPath = join(dir, 'not-a-waveform.vcd');
writeFileSync(badPath, 'this file has no $var declarations at all\n', 'utf8');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fail = (m) => { throw new Error(m); };

async function loadProjectAndGoToSimulate(page) {
  await page.evaluate(() => {
    window.__RB_PROJECT_RUNTIME__.getState().loadFromProject({
      kind: 'rb-project', version: 1,
      name: 'VCD Host', createdAt: 'x', updatedAt: 'x',
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
}

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await loadProjectAndGoToSimulate(page);

  // ① The Analyzer is mounted in Simulate, empty, with honest provider identity.
  const analyzer = page.getByTestId('ide-vcd-analyzer');
  if (await analyzer.count() === 0) fail('VCD Analyzer not mounted in the Simulate surface');
  if (await page.getByTestId('ide-vcd-analyzer-empty').count() === 0) fail('Analyzer empty state missing before load');
  const provider = (await page.getByTestId('ide-vcd-analyzer-provider').textContent())?.trim();
  if (!provider?.includes('Imported VCD')) fail(`provider identity not shown: ${provider}`);
  const honesty = (await page.getByTestId('ide-vcd-analyzer-honesty').textContent()) ?? '';
  if (!honesty.includes('executes nothing')) fail(`honesty note missing: ${honesty}`);
  console.log(`[${width}×${height}] ① Analyzer mounted, empty, provider = ${provider}`);

  // ② Load a real .vcd through the actual file input (no store injection).
  await page.getByTestId('ide-vcd-analyzer-file-input').setInputFiles(vcdPath);
  await page.waitForTimeout(300);

  for (const zone of ['signals', 'waveform-zone', 'measurements']) {
    if (await page.getByTestId(`ide-vcd-analyzer-${zone}`).count() === 0) fail(`zone missing after load: ${zone}`);
  }
  const evidence = (await page.getByTestId('ide-vcd-analyzer-evidence').textContent()) ?? '';
  if (!evidence.includes('outside RedByte')) fail(`evidence tier not honest: ${evidence}`);
  const count = (await page.getByTestId('ide-vcd-analyzer-signal-count').textContent())?.trim();
  if (count !== '3') fail(`unexpected signal count: ${count}`);
  console.log(`[${width}×${height}] ② three zones render from the loaded .vcd (${count} signals, evidence honest)`);

  // Confirm the store holds the imported waveform via the provider model (not a new store).
  const tier = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().importedWaveform?.provider?.evidenceTier);
  if (tier !== 'imported-external') fail(`store waveform tier wrong: ${tier}`);

  // ③ Move the measurement cursor to t=5 and read formatted values.
  await page.getByTestId('ide-vcd-analyzer-cursor-value').fill('5');
  await page.waitForTimeout(150);
  const dataAt5 = (await page.getByTestId('ide-vcd-analyzer-measure-value-B').textContent())?.trim();
  const clkAt5 = (await page.getByTestId('ide-vcd-analyzer-measure-value-A').textContent())?.trim();
  if (dataAt5 !== '0xA') fail(`data@5 expected 0xA (hex default), got ${dataAt5}`);
  if (clkAt5 !== '1') fail(`clk@5 expected 1, got ${clkAt5}`);
  console.log(`[${width}×${height}] ③ measurements at t=5: data=${dataAt5}, clk=${clkAt5}`);

  // ④ Change data radix to decimal → the measurement reformats.
  await page.getByTestId('ide-vcd-analyzer-radix-B').selectOption('dec');
  await page.waitForTimeout(150);
  const dataDec = (await page.getByTestId('ide-vcd-analyzer-measure-value-B').textContent())?.trim();
  if (dataDec !== '10') fail(`data radix=dec expected 10, got ${dataDec}`);
  console.log(`[${width}×${height}] ④ radix change: data(dec)=${dataDec}`);

  // ⑤ Pin only clk → the waveform/measurements narrow to it.
  await page.getByTestId('ide-vcd-analyzer-pin-A').click();
  await page.waitForTimeout(150);
  if (await page.getByTestId('ide-vcd-analyzer-measure-value-A').count() === 0) fail('pinned clk missing from measurements');
  if (await page.getByTestId('ide-vcd-analyzer-measure-value-C').count() !== 0) fail('addr should be hidden when only clk is pinned');
  await page.getByTestId('ide-vcd-analyzer-clear-selection').click();
  await page.waitForTimeout(120);
  console.log(`[${width}×${height}] ⑤ pin/unpin narrows and restores the visible signals`);

  // ⑥ Search filters the signal list.
  await page.getByTestId('ide-vcd-analyzer-search').fill('addr');
  await page.waitForTimeout(150);
  if (await page.getByTestId('ide-vcd-analyzer-signal-C').count() === 0) fail('addr row missing under filter');
  if (await page.getByTestId('ide-vcd-analyzer-signal-A').count() !== 0) fail('clk row should be filtered out');
  await page.getByTestId('ide-vcd-analyzer-search').fill('');
  await page.waitForTimeout(120);
  console.log(`[${width}×${height}] ⑥ signal search filters the list`);

  // ⑦ Reload preserves the imported waveform AND the analyzer config.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByTestId('mode-button-verify').click();
  await page.waitForTimeout(400);
  const countAfter = (await page.getByTestId('ide-vcd-analyzer-signal-count').textContent())?.trim();
  if (countAfter !== '3') fail(`waveform not preserved across reload: count=${countAfter}`);
  const dataAfter = (await page.getByTestId('ide-vcd-analyzer-measure-value-B').textContent())?.trim();
  if (dataAfter !== '10') fail(`analyzer config (cursor=5, radix=dec) not preserved: data=${dataAfter}`);
  console.log(`[${width}×${height}] ⑦ reload preserved waveform + config (data(dec)@5=${dataAfter})`);

  // ⑧ A file with no signals surfaces an honest error, never a fabricated waveform.
  await page.getByTestId('ide-vcd-analyzer-file-input').setInputFiles(badPath);
  await page.waitForTimeout(250);
  if (await page.getByTestId('ide-vcd-analyzer-error').count() === 0) fail('no error banner for an unusable VCD');
  console.log(`[${width}×${height}] ⑧ unusable .vcd → honest error banner`);

  // ⑨ No horizontal overflow at this viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);
  console.log(`[${width}×${height}] ⑨ no horizontal overflow (${overflow}px)`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — imported-VCD Analyzer live in Simulate at 1440×900 and 1366×768.');
