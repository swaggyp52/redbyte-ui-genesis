// P2 Chapter B — the source ↔ visual cross-probe is live in the P2.5 Project workbench.
// A live index is built from the real design (top module + hierarchy) and the
// first-class source model by scanning source text for honest declaration
// ranges. Each link carries a quality tier (Exact / Partial / Ambiguous /
// Stale / Unavailable). In the P2.5 grammar the probe is owned by the Project
// workbench itself: the explorer publishes the engineering object, the
// inspector resolves it to an exact source location (design → source), and the
// source document lists the design elements that resolve to it and re-drives
// the selection when one is clicked (source → design). This journey loads an
// imported project through the real load path and asserts both directions
// through the shipped UI. Runs at 1440×900 and 1366×768.
import { BASE_URL, launchChromium } from './harness.mjs';

const browser = await launchChromium();
const fail = (m) => { throw new Error(m); };

const QUALITY_TIERS = ['Exact', 'Partial', 'Ambiguous', 'Stale', 'Unavailable'];

const PROJECT = {
  kind: 'rb-project', version: 1,
  name: 'Adder (imported)', createdAt: 'x', updatedAt: 'x',
  circuit: {
    nodes: [
      { id: 'a', type: 'INPUT', position: { x: 0, y: 0 } },
      { id: 'b', type: 'INPUT', position: { x: 0, y: 80 } },
      { id: 'g', type: 'XOR', position: { x: 160, y: 40 } },
      { id: 'sum', type: 'OUTPUT', position: { x: 320, y: 40 } },
    ],
    connections: [
      { from: { nodeId: 'a', portName: 'out' }, to: { nodeId: 'g', portName: 'a' } },
      { from: { nodeId: 'b', portName: 'out' }, to: { nodeId: 'g', portName: 'b' } },
      { from: { nodeId: 'g', portName: 'out' }, to: { nodeId: 'sum', portName: 'in' } },
    ],
  },
  hdl: {
    top: 'adder',
    sources: [
      {
        path: 'rtl/adder.vhd',
        language: 'vhdl',
        text: [
          'library ieee;',
          'entity adder is',
          '  port ( a : in std_logic; b : in std_logic; sum : out std_logic );',
          'end adder;',
          'architecture rtl of adder is begin',
          '  sum <= a xor b;',
          'end rtl;',
        ].join('\n'),
      },
      {
        path: 'constraints/pins.xdc',
        language: 'xdc',
        text: 'set_property PACKAGE_PIN V17 [get_ports a]\nset_property PACKAGE_PIN V16 [get_ports b]\n',
      },
    ],
  },
};

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.evaluate((project) => {
    window.__RB_PROJECT_RUNTIME__.getState().loadFromProject(project);
  }, PROJECT);
  await page.waitForTimeout(250);

  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(500);

  // Read the inspector property grid as ordered { section, label, value } rows.
  const inspectorRows = () =>
    page.evaluate(() => {
      const grid = document.querySelector('[data-testid="ide-project-inspector-grid"]');
      if (!grid) return [];
      const rows = [];
      let section = '';
      let label = null;
      for (const child of Array.from(grid.children)) {
        if (child.classList.contains('wb-propgrid-group')) { section = (child.textContent ?? '').trim(); label = null; }
        else if (child.classList.contains('wb-propgrid-label')) { label = (child.textContent ?? '').trim(); }
        else if (child.classList.contains('wb-propgrid-value')) { rows.push({ section, label: label ?? '', value: (child.textContent ?? '').trim() }); label = null; }
      }
      return rows;
    });
  const inspectorHead = async () => ({
    kind: ((await page.locator('[data-testid="ide-project-inspector"] .rb-inspector-kind').textContent()) ?? '').trim(),
    name: ((await page.locator('[data-testid="ide-project-inspector"] .rb-inspector-name').textContent()) ?? '').trim(),
  });

  // ① The cross-probe is mounted in the Project workbench: selecting the top
  //    module in the explorer resolves it in the inspector.
  if (await page.getByTestId('ide-project-explorer').count() === 0) fail('Project explorer not mounted');
  const topRow = page.getByTestId('ide-project-row-module:top');
  if (await topRow.count() === 0) fail('top module row missing from the Design Sources group');
  await topRow.click();
  await page.waitForTimeout(200);
  if (await page.getByTestId('ide-project-inspector').count() === 0) fail('inspector did not resolve the selected design element');
  const head = await inspectorHead();
  if (head.kind !== 'top module' || head.name !== 'adder') fail(`inspector resolved the wrong object: ${head.kind} / ${head.name}`);
  console.log(`[${width}×${height}] ① cross-probe mounted (explorer → inspector on ${head.kind} ${head.name})`);

  // ② The top module 'adder' has an EXACT link to its entity declaration
  //    (design → source: the design element names its precise source location).
  const moduleRows = (await inspectorRows()).filter((row) => row.section === 'Source');
  if (moduleRows.length === 0) fail('inspector has no Source section for the top module');
  const exact = moduleRows.find((row) => row.value === 'rtl/adder.vhd:2');
  if (!exact) fail(`no link to the entity declaration; Source rows: ${JSON.stringify(moduleRows)}`);
  if (exact.label !== 'Exact') fail(`module link expected Exact, got ${exact.label}`);
  for (const row of moduleRows) {
    if (!QUALITY_TIERS.includes(row.label)) fail(`Source row label is not an honest quality tier: ${row.label}`);
  }
  console.log(`[${width}×${height}] ② design → source: module adder is Exact at rtl/adder.vhd:2`);

  // ③ The source document lists the reverse link (source → design).
  await page.getByTestId('ide-project-row-file:src-rtl-adder-vhd').dblclick();
  await page.waitForTimeout(300);
  if (await page.getByTestId('ide-project-source-file-document').count() === 0) fail('source document did not open');
  const links = page.locator('[data-testid="ide-project-source-links"] li');
  if (await links.count() === 0) fail('source document lists no design relationships');
  const moduleLink = links.filter({ has: page.locator('code', { hasText: /^adder$/ }) }).first();
  if (await moduleLink.count() === 0) fail('source document is missing the module link back to the design');
  const linkText = ((await moduleLink.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  if (!linkText.includes('module')) fail(`module relationship does not name its kind: ${linkText}`);
  if (!linkText.includes('L2')) fail(`module relationship does not name the declaration line: ${linkText}`);
  console.log(`[${width}×${height}] ③ source pane lists the reverse link (${linkText})`);

  // ④ Every relationship carries an honest quality tier, and this one reads Exact.
  const tiers = await page.locator('[data-testid="ide-project-source-links"] .wb-mark').evaluateAll((marks) =>
    marks.map((mark) => mark.getAttribute('title') ?? '')
  );
  if (tiers.length === 0) fail('relationships carry no quality tier');
  for (const tier of tiers) {
    if (!QUALITY_TIERS.includes(tier)) fail(`relationship tier is outside the honest vocabulary: "${tier}"`);
  }
  const moduleTier = await moduleLink.locator('.wb-mark').getAttribute('title');
  if (moduleTier !== 'Exact') fail(`module relationship tier expected Exact, got ${moduleTier}`);
  console.log(`[${width}×${height}] ④ quality tiers are honest (${[...new Set(tiers)].join(', ')})`);

  // ⑤ Bidirectional: clicking the source relationship re-drives the design
  //    selection (source → design) — inspector and explorer both follow.
  await moduleLink.locator('button').click();
  await page.waitForTimeout(200);
  const back = await inspectorHead();
  if (back.kind !== 'top module' || back.name !== 'adder') fail(`source→design failed: inspector shows ${back.kind} / ${back.name}`);
  if ((await page.getByTestId('ide-project-row-module:top').getAttribute('aria-selected')) !== 'true')
    fail('source→design failed: explorer did not select the linked design element');
  console.log(`[${width}×${height}] ⑤ bidirectional: source→design re-drives the selection`);

  // ⑥ A source position probes back too: clicking the declaration line selects
  //    that range, highlights it, and the inspector names file + line.
  const declLine = page.locator('[data-testid="ide-project-source-code"] [data-line="2"]');
  await declLine.click();
  await page.waitForTimeout(200);
  if (!(await declLine.getAttribute('class'))?.includes('is-selected')) fail('declaration line not highlighted after selection');
  const rangeHead = await inspectorHead();
  if (rangeHead.kind !== 'source' || rangeHead.name !== 'rtl/adder.vhd') fail(`source range not resolved: ${rangeHead.kind} / ${rangeHead.name}`);
  const lineRow = (await inspectorRows()).find((row) => row.label === 'Line');
  if (lineRow?.value !== '2') fail(`inspector reports the wrong line: ${JSON.stringify(lineRow)}`);
  console.log(`[${width}×${height}] ⑥ source position → probe: rtl/adder.vhd line 2`);

  // ⑦ No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);
  console.log(`[${width}×${height}] ⑦ no horizontal overflow (${overflow}px)`);

  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — source ↔ visual cross-probe live in the Project workbench at 1440×900 and 1366×768.');
