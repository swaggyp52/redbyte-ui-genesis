// P2 Chapter D — simulation-provider selection + run provenance in Simulate.
// RedByte serves simulation through providers with honest evidence tiers:
// Browser Logic (Browser-E0, executes the browser model) and Imported VCD
// (imported-external, replayed, executes nothing). The provider bar makes the
// active provider — the run-of-record — explicit and selectable, and the
// imported Analyzer is de-emphasized when it is not the active provider.
// Runs at 1440×900 and 1366×768.
import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fail = (m) => { throw new Error(m); };

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
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

  // ① The provider bar is mounted; Browser Logic is the default run-of-record.
  if (await page.getByTestId('ide-sim-provider-bar').count() === 0) fail('provider bar not mounted in Simulate');
  const active0 = (await page.getByTestId('ide-sim-provider-active').textContent())?.trim();
  if (!active0?.includes('Browser logic')) fail(`default active provider wrong: ${active0}`);
  const prov0 = (await page.getByTestId('ide-sim-provenance').textContent()) ?? '';
  if (!prov0.includes('Browser E0') || !prov0.includes('not Vivado')) fail(`Browser-E0 provenance not honest: ${prov0}`);
  console.log(`[${width}×${height}] ① provider bar mounted, Browser Logic active, Browser-E0 provenance`);

  // ② Imported VCD provider is disabled until a waveform is loaded.
  const importedChip = page.getByTestId('ide-sim-provider-imported-vcd');
  if (!(await importedChip.isDisabled())) fail('Imported VCD should be disabled without a waveform');
  console.log(`[${width}×${height}] ② Imported VCD disabled until a waveform is loaded`);

  // ③ Load a VCD → Imported provider enables; the Analyzer marks itself inactive.
  await page.getByTestId('ide-vcd-analyzer-file-input').setInputFiles(vcdPath);
  await page.waitForTimeout(300);
  if (await importedChip.isDisabled()) fail('Imported VCD still disabled after loading a waveform');
  if (await page.getByTestId('ide-vcd-analyzer-inactive').count() === 0)
    fail('Analyzer should show the inactive-provider strip while Browser Logic is active');
  console.log(`[${width}×${height}] ③ waveform loaded → Imported enabled, Analyzer marked inactive`);

  // ④ Select Imported VCD → it becomes the run-of-record; provenance is honest.
  await importedChip.click();
  await page.waitForTimeout(200);
  const active1 = (await page.getByTestId('ide-sim-provider-active').textContent())?.trim();
  if (!active1?.includes('Imported waveform')) fail(`active provider did not switch: ${active1}`);
  const prov1 = (await page.getByTestId('ide-sim-provenance').textContent()) ?? '';
  if (!prov1.includes('outside RedByte') || !prov1.includes('never executed')) fail(`imported provenance not honest: ${prov1}`);
  if (await page.getByTestId('ide-vcd-analyzer-inactive').count() !== 0)
    fail('Analyzer inactive strip should be gone once Imported VCD is active');
  const activeAttr = await page.getByTestId('ide-vcd-analyzer').getAttribute('data-active-provider');
  if (activeAttr !== 'true') fail('Analyzer not marked as active provider');
  console.log(`[${width}×${height}] ④ selected Imported VCD → run-of-record + honest imported-external provenance`);

  // ⑤ Switch back to Browser Logic → Analyzer de-emphasized again.
  await page.getByTestId('ide-sim-provider-browser-logic').click();
  await page.waitForTimeout(200);
  if (await page.getByTestId('ide-vcd-analyzer-inactive').count() === 0) fail('Analyzer should re-mark inactive on Browser Logic');
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
