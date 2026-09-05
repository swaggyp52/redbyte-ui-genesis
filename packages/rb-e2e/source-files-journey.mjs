// P2 — the first-class source model is visible in the Project explorer with
// honest capability tiers. Loading a project that carries HDL sources (as an
// imported project does) populates the source authority via deriveSourceModel,
// and the Project explorer renders the source files grouped by fileset with
// their language-capability tier and the derived compile order. Store reads are
// assertions; loadFromProject is the real load entry point (same path import uses).
import { chromium } from 'playwright';
// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fail = (m) => { throw new Error(m); };

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// Load a project that carries HDL sources — exactly what an imported project holds.
await page.evaluate(() => {
  window.__RB_PROJECT_RUNTIME__.getState().loadFromProject({
    kind: 'rb-project', version: 1,
    name: 'Imported AND', createdAt: 'x', updatedAt: 'x',
    circuit: {
      nodes: [
        { id: 'sw0', type: 'INPUT', position: { x: 0, y: 0 } },
        { id: 'sw1', type: 'INPUT', position: { x: 0, y: 80 } },
        { id: 'and0', type: 'AND', position: { x: 160, y: 40 } },
        { id: 'ld0', type: 'OUTPUT', position: { x: 320, y: 40 } },
      ],
      connections: [
        { from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'and0', portName: 'a' } },
        { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'and0', portName: 'b' } },
        { from: { nodeId: 'and0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } },
      ],
    },
    hdl: {
      top: 'student_top',
      sources: [
        { path: 'rtl/student_top.vhd', language: 'vhdl', text: 'entity student_top is end student_top;' },
        { path: 'rtl/and_gate.v', language: 'verilog', text: 'module and_gate(); endmodule' },
      ],
    },
  });
});
await page.waitForTimeout(300);

// The store's source authority is populated from the HDL on load.
const model = await page.evaluate(() => {
  const m = window.__RB_PROJECT_RUNTIME__.getState().sourceModel;
  return { top: m.topEntity, paths: m.files.map((f) => f.path), languages: m.files.map((f) => f.language) };
});
if (model.top !== 'student_top') fail(`top entity not derived: ${JSON.stringify(model)}`);
if (model.paths.length !== 2) fail(`source files not populated: ${JSON.stringify(model)}`);
console.log(`① store source authority populated from HDL: ${model.paths.join(', ')} (top ${model.top})`);

// Navigate to the Project center where the explorer lives.
await page.getByTestId('mode-button-project').click();
await page.waitForTimeout(500);

// The source files section renders with the honest tiers + compile order.
const sources = page.getByTestId('ide-project-sources');
if (await sources.count() === 0) fail('source files section not rendered in Project explorer');
const count = (await page.getByTestId('ide-project-sources-count').textContent())?.trim();
if (count !== '2 files') fail(`unexpected source count: ${count}`);
const top = (await page.getByTestId('ide-project-sources-top').textContent()) ?? '';
if (!top.includes('student_top')) fail(`top entity not shown: ${top}`);
console.log(`② Project explorer shows the Source files section: ${count}, ${top.trim()}`);

// Both HDL files are classified as reconstructable (structural-subset, available).
const vhdlTier = (await page.getByTestId('ide-project-source-tier-src-rtl-student-top-vhd').textContent())?.trim();
const vTier = (await page.getByTestId('ide-project-source-tier-src-rtl-and-gate-v').textContent())?.trim();
if (vhdlTier !== 'reconstructable' || vTier !== 'reconstructable')
  fail(`unexpected tiers: vhd=${vhdlTier} v=${vTier}`);
console.log(`③ honest capability tiers rendered: VHDL=${vhdlTier}, Verilog=${vTier}`);

// The derived compile order lists both design sources.
const order = await page.getByTestId('ide-project-sources-compile-order').textContent();
if (!order.includes('student_top.vhd') || !order.includes('and_gate.v'))
  fail(`compile order missing sources: ${order}`);
console.log('④ derived compile order lists both design sources');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — the first-class source authority is visible with honest tiers in Project.');
await browser.close();
