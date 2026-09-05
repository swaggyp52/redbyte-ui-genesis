// P2 Chapter F — complex imported-project journey, end to end, through the REAL
// UI only. Nothing here mutates the store to bypass a user action: the project is
// opened through the actual file input, and every step is a real click / type /
// file selection. It imports a multi-file project (VHDL + Verilog + two XDC sets +
// circuit), then exercises every P2 surface in one continuous session:
// Project (source files + cross-probe), Design, Simulate (provider + VCD Analyzer),
// Board & Constraints (constraint sets), and Build & Export. ~25 steps.
// Runs at 1440×900.
//
// P2.5 grammar note: Project is a document workbench (explorer · document ·
// inspector). Entering the workspace opens Overview; "Sources" is one click on the
// explorer's document row. Cross-probe is no longer a standalone pill panel — the
// design→source direction is the inspector's Source section for the selected
// module, and the source→design direction is the source document's Relationships
// list. Both directions are still asserted here, by their current owners.
import { chromium } from 'playwright';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'rb-complex-'));

const PROJECT = {
  kind: 'rb-project', version: 1,
  name: 'Complex Import', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  circuit: {
    nodes: [
      { id: 'a', type: 'INPUT', position: { x: 0, y: 0 } },
      { id: 'b', type: 'INPUT', position: { x: 0, y: 80 } },
      { id: 'g1', type: 'AND', position: { x: 160, y: 20 } },
      { id: 'g2', type: 'OR', position: { x: 160, y: 120 } },
      { id: 'y', type: 'OUTPUT', position: { x: 320, y: 40 } },
      { id: 'z', type: 'OUTPUT', position: { x: 320, y: 120 } },
    ],
    connections: [
      { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'g1', portName: 'a' } },
      { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'g1', portName: 'b' } },
      { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'g2', portName: 'a' } },
      { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'g2', portName: 'b' } },
      { from: { nodeId: 'g1', portName: 'out' }, to: { nodeId: 'y', portName: 'in' } },
      { from: { nodeId: 'g2', portName: 'out' }, to: { nodeId: 'z', portName: 'in' } },
    ],
  },
  hdl: {
    top: 'gate_top',
    sources: [
      { path: 'rtl/gate_top.vhd', language: 'vhdl', text: 'library ieee;\nentity gate_top is\n  port ( a : in std_logic; b : in std_logic; y : out std_logic; z : out std_logic );\nend gate_top;' },
      { path: 'rtl/helper.v', language: 'verilog', text: 'module helper(input a, input b, output w); assign w = a & b; endmodule' },
      { path: 'constraints/basys3.xdc', language: 'xdc', text: 'set_property PACKAGE_PIN V17 [get_ports a]\nset_property PACKAGE_PIN V16 [get_ports b]\nset_property PACKAGE_PIN U16 [get_ports y]' },
      { path: 'constraints/variant.xdc', language: 'xdc', text: 'set_property PACKAGE_PIN W17 [get_ports a]' },
    ],
  },
};
const projectPath = join(dir, 'complex.rbproj');
writeFileSync(projectPath, JSON.stringify(PROJECT, null, 2), 'utf8');

const VCD = ['$timescale 1ns $end', '$var wire 1 A clk $end', '$var wire 4 B data $end', '$var wire 4 C addr $end',
  '$enddefinitions $end', '#0', '0A', 'b0000 B', 'b0001 C', '#5', '1A', 'b1010 B', '#10', '0A', 'b1111 C'].join('\n');
const vcdPath = join(dir, 'trace.vcd');
writeFileSync(vcdPath, VCD, 'utf8');

// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const fail = (m) => { throw new Error(m); };
let step = 0;
const ok = (msg) => console.log(`  ${String(++step).padStart(2, '0')}. ${msg}`);

const noOverflow = async (page, where) => {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o > 1) fail(`horizontal overflow at ${where}: ${o}px`);
};

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

// The inspector's property grid is label/value sibling pairs; the cross-probe rows
// are labelled by link quality ("Exact"/"Partial"/…) and valued by `path:line`.
const inspectorRows = () => page.evaluate(() => {
  const grid = document.querySelector('[data-testid="ide-project-inspector-grid"]');
  if (!grid) return [];
  return [...grid.querySelectorAll('.wb-propgrid-label')].map((label) => ({
    label: (label.textContent ?? '').trim(),
    value: (label.nextElementSibling?.textContent ?? '').trim(),
  }));
});
const TOP_ENTITY_PROBE = { label: 'Exact', value: 'rtl/gate_top.vhd:2' };
const hasTopEntityProbe = (rows) => rows.some((r) => r.label === TOP_ENTITY_PROBE.label && r.value === TOP_ENTITY_PROBE.value);

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// ── Import through the REAL file input (a user action, not a store call) ──
await page.getByTestId('ide-project-file-input').setInputFiles(projectPath);
await page.waitForTimeout(500);
if (await page.getByTestId('ide-format-migration-dialog').count() !== 0) fail('a v1 project should not trigger the migration dialog');
ok('imported a complex multi-file project through the real file input');

// ── Project surface ──
await page.getByTestId('mode-button-project').click();
await page.waitForTimeout(500);
if (await page.getByTestId('ide-mode-project').count() === 0) fail('not on Project');
if (await page.getByTestId('ide-project-explorer').count() === 0) fail('project explorer missing for a loaded project');
ok('landed on the Project surface (explorer · document · inspector)');

// Project opens on Overview; the imported sources are one click away in the explorer.
await page.getByTestId('ide-project-row-doc:sources').click();
await page.waitForTimeout(350);
if (await page.getByTestId('ide-project-sources-document').count() === 0) fail('Sources document did not open');
if (await page.getByTestId('ide-project-sources').count() === 0) fail('source files missing');
const srcCount = ((await page.locator('[data-testid="ide-project-sources-document"] .rb-doc-header .wb-toolbar-meta').first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
if (!srcCount.includes('4 files')) fail(`Sources document does not account for the 4 imported files: "${srcCount}"`);
ok(`imported source files render (${srcCount})`);

// Filesets: HDL lands in the compiled design fileset (the Sources table), XDC lands
// in the constraint fileset (the explorer's Constraints group). Both are asserted.
for (const id of ['src-rtl-gate-top-vhd', 'src-rtl-helper-v']) {
  if (await page.getByTestId(`ide-project-source-${id}`).count() === 0) fail(`design source row missing from the Sources table: ${id}`);
}
for (const id of ['src-constraints-basys3-xdc', 'src-constraints-variant-xdc']) {
  const inConstraints = page.locator('[data-testid="ide-project-explorer-group-constraints"]').getByTestId(`ide-project-row-file:${id}`);
  if (await inConstraints.count() === 0) fail(`imported XDC not classified into the constraint fileset: ${id}`);
}
ok('sources classified into design + constraint filesets');

// Cross-probe, design → source: selecting the top module resolves it to its entity.
await page.getByTestId('ide-project-row-module:top').click();
await page.waitForTimeout(250);
if (await page.getByTestId('ide-project-inspector').count() === 0) fail('inspector did not open for the selected top module');
const moduleProbe = await inspectorRows();
if (!hasTopEntityProbe(moduleProbe)) fail(`top module cross-probe not Exact at its entity: ${JSON.stringify(moduleProbe)}`);
ok('cross-probe resolves the top module to its entity (Exact · rtl/gate_top.vhd:2)');

// Cross-probe, source → design: the source document's relationships jump back.
await page.getByTestId('ide-project-row-file:src-rtl-gate-top-vhd').dblclick();
await page.waitForTimeout(400);
if (await page.getByTestId('ide-project-source-file-document').count() === 0) fail('source document did not open from the explorer');
if (await page.getByTestId('ide-project-source-links').count() === 0) fail('source → design relationships missing');
const moduleLink = page.locator('[data-testid="ide-project-source-links"] li').filter({ hasText: 'gate_top' }).first();
if (await moduleLink.count() === 0) fail('no relationship back to the gate_top module');
const linkQuality = await moduleLink.locator('button').getAttribute('data-quality');
if (linkQuality !== 'exact') fail(`source → design link is not exact: ${linkQuality}`);
await moduleLink.locator('button').click();
await page.waitForTimeout(250);
const probedKind = ((await page.locator('[data-testid="ide-project-inspector"] .rb-inspector-kind').first().textContent()) ?? '').trim();
const probedName = ((await page.locator('[data-testid="ide-project-inspector"] .rb-inspector-name').first().textContent()) ?? '').trim();
if (probedKind !== 'top module' || probedName !== 'gate_top') fail(`source → design probe did not select the top module: "${probedKind}" / "${probedName}"`);
ok('cross-probe bidirectional highlight works (source line → the design module it produced)');
await noOverflow(page, 'project');

// ── Design surface ──
await page.getByTestId('mode-button-design').click();
await page.waitForTimeout(500);
if (await page.getByTestId('ide-mode-design').count() === 0) fail('not on Design');
ok('Design surface renders for the imported project');
await noOverflow(page, 'design');

// ── Simulate surface ──
await page.getByTestId('mode-button-verify').click();
await page.waitForTimeout(500);
// P2.5: the provider bar is a *choice*. With only the native simulator there is
// nothing to choose, so it renders nothing; the import route is the affordance.
if (await page.getByTestId('ide-sim-provider-bar').count() !== 0) fail('provider bar should not offer a choice before any waveform is imported');
if (await page.getByTestId('ide-vcd-analyzer-load').count() !== 1) fail('Simulate offers no route to import external waveform evidence');
ok('Simulate: native run-of-record, with exactly one route to import external evidence');
await page.getByTestId('ide-vcd-analyzer-file-input').setInputFiles(vcdPath);
await page.waitForTimeout(400);
const sigCount = (await page.getByTestId('ide-vcd-analyzer-signal-count').textContent())?.trim();
if (sigCount !== '3') fail(`VCD signal count wrong: ${sigCount}`);
if (await page.getByTestId('ide-sim-provider-bar').count() !== 1) fail('provider bar did not mount once an imported waveform existed');
if (await page.getByTestId('ide-sim-provider-browser-logic').getAttribute('aria-checked') !== 'true')
  fail('importing a waveform must not silently change the run-of-record');
ok(`imported a VCD into the Analyzer (${sigCount} signals); Browser Logic is still the run-of-record`);
await page.getByTestId('ide-sim-provider-imported-vcd').click();
await page.waitForTimeout(200);
if (await page.getByTestId('ide-sim-provider-imported-vcd').getAttribute('aria-checked') !== 'true') fail('provider did not switch to Imported');
const evidenceLabel = ((await page.getByTestId('ide-vcd-analyzer-evidence').textContent()) ?? '').trim();
if (!/^Imported evidence/i.test(evidenceLabel)) fail(`imported provenance is not stated honestly: "${evidenceLabel}"`);
ok('selected the Imported VCD provider (evidence: external, not executed)');
await page.getByTestId('ide-vcd-analyzer-cursor-value').fill('5');
await page.waitForTimeout(150);
const dataAt5 = (await page.getByTestId('ide-vcd-analyzer-measure-value-B').textContent())?.trim();
if (dataAt5 !== '0xA') fail(`measurement at t=5 wrong: ${dataAt5}`);
ok(`measured data = ${dataAt5} at cursor t=5`);
await page.getByTestId('ide-vcd-analyzer-radix-B').selectOption('dec');
await page.waitForTimeout(150);
if ((await page.getByTestId('ide-vcd-analyzer-measure-value-B').textContent())?.trim() !== '10') fail('radix change failed');
ok('changed data radix to decimal (10)');
await page.getByTestId('ide-vcd-analyzer-search').fill('addr');
await page.waitForTimeout(150);
if (await page.getByTestId('ide-vcd-analyzer-signal-C').count() === 0) fail('signal search failed');
await page.getByTestId('ide-vcd-analyzer-search').fill('');
ok('filtered Analyzer signals by name');
await page.getByTestId('ide-vcd-analyzer-pin-B').click();
await page.waitForTimeout(150);
if (await page.getByTestId('ide-vcd-analyzer-measure-value-C').count() !== 0) fail('pinning did not narrow the measurements');
ok('pinned a single signal to focus the waveform + measurements');
await page.getByTestId('ide-vcd-analyzer-clear-selection').click();
await page.waitForTimeout(120);
await page.getByTestId('ide-sim-provider-browser-logic').click();
await page.waitForTimeout(150);
if (await page.getByTestId('ide-vcd-analyzer-inactive').count() === 0) fail('switching back to Browser Logic did not de-emphasize the Analyzer');
ok('switched back to Browser Logic — Analyzer honestly de-emphasized');
await noOverflow(page, 'simulate');

// ── Board & Constraints surface ──
await page.getByTestId('mode-button-hardware').click();
await page.waitForTimeout(500);
if (await page.getByTestId('ide-constraint-sets').count() === 0) fail('constraint sets missing');
const setCount = (await page.getByTestId('ide-constraint-sets-count').textContent())?.trim();
if (setCount !== '2 sets') fail(`expected 2 seeded sets, got ${setCount}`);
ok(`Board & Constraints: 2 sets seeded from the imported XDC`);
const cs = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().constraintSets.sets.map((s) => s.id));
await page.getByTestId(`ide-constraint-set-activate-${cs[1]}`).click();
await page.waitForTimeout(150);
if (await page.getByTestId(`ide-constraint-set-active-${cs[1]}`).count() === 0) fail('activating the second set failed');
ok('activated the second constraint set');
await page.getByTestId(`ide-constraint-set-rename-${cs[1]}`).click();
await page.getByTestId(`ide-constraint-set-rename-input-${cs[1]}`).fill('Variant B');
await page.getByTestId(`ide-constraint-set-rename-input-${cs[1]}`).press('Enter');
await page.waitForTimeout(150);
if ((await page.evaluate((id) => window.__RB_PROJECT_RUNTIME__.getState().constraintSets.sets.find((s) => s.id === id)?.name, cs[1])) !== 'Variant B')
  fail('rename failed');
ok('renamed a constraint set inline');
await noOverflow(page, 'hardware');

// ── Build & Export surface ──
await page.getByTestId('mode-button-export').click();
await page.waitForTimeout(500);
if (await page.getByTestId('ide-mode-export').count() === 0) fail('not on Export');
ok('Build & Export surface completes the spine');
await noOverflow(page, 'export');

// ── Return to Project: the imported artifacts persist within the session ──
await page.getByTestId('mode-button-project').click();
await page.waitForTimeout(400);
await page.getByTestId('ide-project-row-doc:sources').click();
await page.waitForTimeout(350);
if (await page.getByTestId('ide-project-source-src-rtl-gate-top-vhd').count() === 0) fail('sources lost after navigating the spine');
if (await page.getByTestId('ide-project-source-src-rtl-helper-v').count() === 0) fail('sources lost after navigating the spine');
await page.getByTestId('ide-project-row-module:top').click();
await page.waitForTimeout(250);
if (!hasTopEntityProbe(await inspectorRows())) fail('cross-probe lost after navigating the spine');
ok('returning to Project shows the imported sources + cross-probe intact');

// ── Whole-session integrity ──
if (await page.locator('.ide-workbench-shell').count() !== 1) fail('more than one workbench shell');
ok('exactly one workbench shell across the whole journey (no second app)');
if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
ok('no page errors across the whole session');

await context.close();
await browser.close();
console.log(`\nPASS — complex imported-project journey: ${step} real-UI steps, no store injection.`);
