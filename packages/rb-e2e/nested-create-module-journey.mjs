// P1-C — create-module-from-selection while drilled into a nested module.
// Through the real Design UI: author an Outer module from the half-adder gates,
// drill into it, select its gates, and create an Inner module from that
// selection WHILE nested. The parent's port internal-refs are re-derived so the
// design still simulates. Store reads are assertions; the module authoring is
// the real create-module dialog + canvas selection.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const fail = (m) => { throw new Error(m); };
const G = () => page.evaluate(() => {
  const st = window.__RB_PROJECT_RUNTIME__.getState();
  return {
    modules: st.hierarchy.modules.map((m) => ({ id: m.id, name: m.name })),
    active: st.hierarchy.activeModuleId,
    topNodeTypes: st.circuit.nodes.map((n) => n.type),
  };
});

async function selectGatesAndCreate(name, instanceName) {
  // Find the AND/XOR node ids in the CURRENTLY rendered circuit (top or module).
  const ids = await page.evaluate(() => {
    const st = window.__RB_PROJECT_RUNTIME__.getState();
    const active = st.hierarchy.activeModuleId;
    const circuit = active === 'top' ? st.circuit
      : st.hierarchy.modules.find((m) => m.id === active).circuit;
    return {
      and: circuit.nodes.find((n) => n.type === 'AND')?.id,
      xor: circuit.nodes.find((n) => n.type === 'XOR')?.id,
    };
  });
  if (!ids.and || !ids.xor) fail('could not find AND/XOR to select');
  await page.keyboard.press('Shift+F'); await page.waitForTimeout(300);
  await page.locator(`[data-testid="node-AND-${ids.and}"]`).first().click({ force: true });
  await page.waitForTimeout(150);
  await page.locator(`[data-testid="node-XOR-${ids.xor}"]`).first().click({ modifiers: ['Shift'], force: true });
  await page.waitForTimeout(200);
  const open = page.getByTestId('ide-design-create-module-open');
  if (await open.count() === 0) fail(`create-module button not shown for ${name}`);
  await open.first().click(); await page.waitForTimeout(250);
  await page.getByTestId('ide-design-create-module-name').fill(name);
  await page.getByTestId('ide-design-create-module-confirm').click(); await page.waitForTimeout(600);
}

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
await page.waitForTimeout(300);
await page.getByTestId('mode-button-design').click(); await page.waitForTimeout(700);

// ── Author the Outer module at top ──────────────────────────────────────────
await selectGatesAndCreate('Outer', 'u_outer');
let s = await G();
if (s.modules.length !== 1 || s.modules[0].name !== 'Outer') fail(`Outer not created: ${JSON.stringify(s.modules)}`);
const outerId = s.modules[0].id;
console.log(`① authored Outer module at top (${outerId})`);

// ── Drill into Outer (the Design "open module" action) ──────────────────────
await page.evaluate((id) => window.__RB_PROJECT_RUNTIME__.getState().setActiveModule(id), outerId);
await page.waitForTimeout(500);
if ((await G()).active !== outerId) fail('did not drill into Outer');

// ── Create the Inner module from a selection WHILE nested ────────────────────
await selectGatesAndCreate('Inner', 'u_inner');
s = await G();
if (s.modules.length !== 2) fail(`nested create did not add Inner: ${JSON.stringify(s.modules)}`);
if (!s.modules.some((m) => m.name === 'Inner')) fail('Inner module missing');
if (s.active !== outerId) fail(`should still be inside Outer, got ${s.active}`);
const innerId = s.modules.find((m) => m.name === 'Inner').id;
console.log(`② created Inner module (${innerId}) from a selection WHILE inside Outer`);

// Outer instantiates Inner; the top still instantiates Outer only.
const nested = await page.evaluate((ids) => {
  const st = window.__RB_PROJECT_RUNTIME__.getState();
  const outer = st.hierarchy.modules.find((m) => m.id === ids.outer);
  const outerHasInner = outer.circuit.nodes.filter((n) => n.config?.moduleDefinitionId === ids.inner).length;
  const topHasInner = st.circuit.nodes.filter((n) => n.config?.moduleDefinitionId === ids.inner).length;
  const topHasOuter = st.circuit.nodes.filter((n) => n.config?.moduleDefinitionId === ids.outer).length;
  return { outerHasInner, topHasInner, topHasOuter };
}, { outer: outerId, inner: innerId });
if (nested.outerHasInner !== 1 || nested.topHasInner !== 0 || nested.topHasOuter !== 1)
  fail(`nesting wrong: ${JSON.stringify(nested)}`);
console.log('③ Outer instantiates Inner; the top circuit is untouched (Outer only)');

// ── The design still simulates: SW0=1, SW1=1 → carry=1, sum=0 ────────────────
await page.evaluate(() => {
  const a = window.__RB_PROJECT_RUNTIME__.getState().actions.sim;
  a.setInput('sw0_node', 1); a.setInput('sw1_node', 1);
});
await page.waitForTimeout(300);
const sim = await page.evaluate(() => {
  const s = window.__RB_PROJECT_RUNTIME__.getState().sim;
  const read = (id) => s.signals[`${id}.out`] ?? s.signals[id] ?? null;
  return { carry: read('ld0_node'), sum: read('ld1_node') };
});
if (sim.carry !== 1 || sim.sum !== 0) fail(`two-level-nested half adder wrong: ${JSON.stringify(sim)}`);
console.log('④ two-level-nested design still simulates: SW0=1,SW1=1 → CARRY=1, SUM=0');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — create-module-from-selection works while drilled into a nested module.');
await browser.close();
