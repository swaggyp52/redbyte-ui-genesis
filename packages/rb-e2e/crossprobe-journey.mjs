// P2 Chapter B — the source ↔ visual cross-probe is live in the Project explorer.
// A live index is built from the real design (top module + hierarchy) and the
// first-class source model by scanning source text for honest declaration
// ranges. Each design element shows its link quality (Exact / Partial /
// Ambiguous / Stale / Unavailable); selecting an element on either side
// highlights its counterpart on the other. This journey loads an imported
// project through the real load path and asserts the rendered panel + the
// bidirectional highlight. Runs at 1440×900 and 1366×768.
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fail = (m) => { throw new Error(m); };

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

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.evaluate((project) => {
    window.__RB_PROJECT_RUNTIME__.getState().loadFromProject(project);
  }, PROJECT);
  await page.waitForTimeout(250);

  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(500);

  // ① Cross-probe panel is mounted in the Project explorer.
  const panel = page.getByTestId('ide-crossprobe');
  if (await panel.count() === 0) fail('cross-probe panel not mounted in the Project explorer');
  const count = (await page.getByTestId('ide-crossprobe-count').textContent())?.trim();
  console.log(`[${width}×${height}] ① cross-probe mounted (${count})`);

  // ② The legend shows all five honest quality tiers.
  const legend = (await page.getByTestId('ide-crossprobe-legend').textContent()) ?? '';
  for (const tier of ['Exact', 'Partial', 'Ambiguous', 'Stale', 'Unavailable']) {
    if (!legend.includes(tier)) fail(`legend missing tier ${tier}: ${legend}`);
  }
  console.log(`[${width}×${height}] ② quality legend shows all five tiers`);

  // ③ The top module 'adder' has an EXACT link to its entity declaration.
  const moduleQuality = page.getByTestId('ide-crossprobe-quality-module:top:adder');
  if (await moduleQuality.count() === 0) fail('top module cross-probe row not rendered');
  const q = (await moduleQuality.textContent())?.trim();
  if (q !== 'Exact') fail(`module link expected Exact, got ${q}`);
  console.log(`[${width}×${height}] ③ module adder → source is Exact`);

  // ④ The source pane lists the link back to the design (source → design).
  if (await page.getByTestId('ide-crossprobe-link-module:top:adder').count() === 0)
    fail('source pane missing the module link back to design');
  console.log(`[${width}×${height}] ④ source pane lists the reverse link`);

  // ⑤ Selecting the design element highlights the matching source link (bidirectional).
  const designRow = page.getByTestId('ide-crossprobe-design-module:top:adder');
  await designRow.locator('button').click();
  await page.waitForTimeout(150);
  const designClass = await designRow.getAttribute('class');
  const sourceClass = await page.getByTestId('ide-crossprobe-link-module:top:adder').getAttribute('class');
  if (!designClass?.includes('is-selected')) fail('design row not selected after click');
  if (!sourceClass?.includes('is-selected')) fail('matching source link not highlighted (cross-probe broken)');
  const selection = (await page.getByTestId('ide-crossprobe-selection').textContent()) ?? '';
  if (!selection.includes('adder')) fail(`selection readout wrong: ${selection}`);
  console.log(`[${width}×${height}] ⑤ bidirectional: design→source highlight works`);

  // ⑥ Clicking the source link re-drives selection (source → design).
  await page.getByTestId('ide-crossprobe-clear').click();
  await page.waitForTimeout(100);
  await page.getByTestId('ide-crossprobe-link-module:top:adder').locator('button').click();
  await page.waitForTimeout(150);
  const designClass2 = await page.getByTestId('ide-crossprobe-design-module:top:adder').getAttribute('class');
  if (!designClass2?.includes('is-selected')) fail('source→design highlight failed');
  console.log(`[${width}×${height}] ⑥ bidirectional: source→design highlight works`);

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
console.log('\nPASS — source ↔ visual cross-probe live in the Project explorer at 1440×900 and 1366×768.');
