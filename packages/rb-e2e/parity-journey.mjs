// P2 Chapter E — native/imported parity: ONE workbench grammar. An imported
// project (HDL sources + XDC + circuit) flows through the exact same
// Project → Design → Simulate → Board & Constraints → Build & Export spine as a
// native project, inside the same shell — there is no ImportedProjectSurface,
// no VCDApp, no second app root. This journey loads an imported project through
// the real load path and walks all five stages, asserting each renders in the
// single workbench and that the imported artifacts surface in the shared
// surfaces. Runs at 1440×900 and 1366×768.
import { chromium } from 'playwright';

// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const fail = (m) => { throw new Error(m); };

const PROJECT = {
  kind: 'rb-project', version: 1,
  name: 'Imported end-to-end', createdAt: 'x', updatedAt: 'x',
  circuit: {
    nodes: [
      { id: 'a', type: 'INPUT', position: { x: 0, y: 0 } },
      { id: 'b', type: 'INPUT', position: { x: 0, y: 80 } },
      { id: 'g', type: 'AND', position: { x: 160, y: 40 } },
      { id: 'y', type: 'OUTPUT', position: { x: 320, y: 40 } },
    ],
    connections: [
      { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'g', portName: 'a' } },
      { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'g', portName: 'b' } },
      { from: { nodeId: 'g', portName: 'out' }, to: { nodeId: 'y', portName: 'in' } },
    ],
  },
  hdl: {
    top: 'and_gate',
    sources: [
      { path: 'rtl/and_gate.vhd', language: 'vhdl', text: 'entity and_gate is port ( a : in std_logic; b : in std_logic; y : out std_logic ); end and_gate;' },
      { path: 'constraints/pins.xdc', language: 'xdc', text: 'set_property PACKAGE_PIN V17 [get_ports a]' },
    ],
  },
};

async function assertOneShell(page, width, height, stage) {
  const shells = await page.locator('.ide-workbench-shell').count();
  if (shells !== 1) fail(`[${width}×${height}] ${stage}: expected exactly one workbench shell, found ${shells}`);
  const mains = await page.locator('main').count();
  if (mains !== 1) fail(`[${width}×${height}] ${stage}: expected exactly one <main> landmark, found ${mains}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`[${width}×${height}] ${stage}: horizontal overflow ${overflow}px`);
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

  await page.evaluate((project) => window.__RB_PROJECT_RUNTIME__.getState().loadFromProject(project), PROJECT);
  await page.waitForTimeout(250);

  // ── Project: the imported source model + cross-probe appear in the shared surface.
  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(400);
  if (await page.getByTestId('ide-mode-project').count() === 0) fail('project mode marker missing');
  if (await page.getByTestId('ide-project-sources').count() === 0) fail('imported source files not in Project surface');
  if (await page.getByTestId('ide-crossprobe').count() === 0) fail('cross-probe not in Project surface');
  await assertOneShell(page, width, height, 'project');
  console.log(`[${width}×${height}] ① Project: imported sources + cross-probe in the shared surface`);

  // ── Design: the same design surface a native project uses.
  await page.getByTestId('mode-button-design').click();
  await page.waitForTimeout(400);
  if (await page.getByTestId('ide-mode-design').count() === 0) fail('design mode marker missing');
  await assertOneShell(page, width, height, 'design');
  console.log(`[${width}×${height}] ② Design: same surface renders for the imported project`);

  // ── Simulate: provider bar + imported-VCD Analyzer in the shared Simulate surface.
  await page.getByTestId('mode-button-verify').click();
  await page.waitForTimeout(400);
  if (await page.getByTestId('ide-mode-verify').count() === 0) fail('verify mode marker missing');
  if (await page.getByTestId('ide-sim-provider-bar').count() === 0) fail('provider bar not in Simulate surface');
  if (await page.getByTestId('ide-vcd-analyzer').count() === 0) fail('VCD Analyzer not in Simulate surface');
  await assertOneShell(page, width, height, 'verify');
  console.log(`[${width}×${height}] ③ Simulate: provider bar + VCD Analyzer in the shared surface`);

  // ── Board & Constraints: constraint sets (seeded from the imported XDC) here.
  await page.getByTestId('mode-button-hardware').click();
  await page.waitForTimeout(400);
  if (await page.getByTestId('ide-mode-hardware').count() === 0) fail('hardware mode marker missing');
  if (await page.getByTestId('ide-constraint-sets').count() === 0) fail('constraint sets not in Board & Constraints');
  await assertOneShell(page, width, height, 'hardware');
  console.log(`[${width}×${height}] ④ Board & Constraints: constraint sets in the shared surface`);

  // ── Build & Export: the same export surface completes the shared spine.
  await page.getByTestId('mode-button-export').click();
  await page.waitForTimeout(400);
  if (await page.getByTestId('ide-mode-export').count() === 0) fail('export mode marker missing');
  await assertOneShell(page, width, height, 'export');
  console.log(`[${width}×${height}] ⑤ Build & Export: same surface completes the spine`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS — one workbench grammar across all five stages`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — native/imported parity: one workbench grammar, no second app, at 1440×900 and 1366×768.');
