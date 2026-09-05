// Blank-project → hierarchical 4-bit ripple-carry adder, authored entirely
// through the real RedByte UI (palette placement, wire tool, module dialog,
// bus dialog, instance placement, rename). The project runtime store is READ
// only to locate DOM targets and to assert results — never mutated to author.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/claude-0/-home-user-redbyte-ui-genesis/b4914bef-2a1a-55cb-97de-096a331aef03/scratchpad/shots';
mkdirSync(OUT, { recursive: true });
// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

const G = () => page.evaluate(() => {
  const st = window.__RB_PROJECT_RUNTIME__.getState();
  return {
    nodes: st.circuit.nodes.map((n) => ({ id: n.id, type: n.type, label: n.label ?? null, mod: n.config?.moduleDefinitionId ?? null, inst: n.config?.instanceName ?? null })),
    conns: st.circuit.connections.length,
    modules: st.hierarchy.modules.map((m) => ({ id: m.id, name: m.name, ports: m.ports.map((p) => p.name) })),
    active: st.hierarchy.activeModuleId,
  };
});

async function newestNodeId(type, seen) {
  const s = await G();
  const cands = s.nodes.filter((n) => n.type === type && !seen.has(n.id));
  return cands.length ? cands[cands.length - 1].id : null;
}

async function placeVia(paletteTestId, x, y) {
  await page.getByTestId(paletteTestId).first().click();
  await page.waitForTimeout(120);
  const hit = page.getByTestId('ide-design-placement-hit-layer');
  if (await hit.count() === 0) throw new Error(`no hit layer after ${paletteTestId}`);
  await hit.click({ position: { x, y } });
  await page.waitForTimeout(160);
}

const seen = new Set();
async function place(name, paletteTestId, type, x, y, map) {
  await placeVia(paletteTestId, x, y);
  const id = await newestNodeId(type, seen);
  if (!id) throw new Error(`placement failed: ${name} (${type})`);
  seen.add(id);
  map[name] = id;
  return id;
}

function nodeTestId(type, id) { return `node-${type}-${id}`; }
async function renameNode(map, name, label, typeOf) {
  await page.locator(`[data-testid="${nodeTestId(typeOf[name], map[name])}"]`).first().click({ force: true });
  await page.waitForTimeout(120);
  const editBtn = page.getByTestId('ide-design-label-edit-btn');
  if (await editBtn.count() === 0) throw new Error(`no label-edit-btn for ${name}`);
  await editBtn.first().click(); await page.waitForTimeout(100);
  await page.getByTestId('ide-design-label-input').fill(label);
  await page.getByTestId('ide-design-label-save').click(); await page.waitForTimeout(150);
}
async function wire(map, src, srcPort, dst, dstPort, typeOf) {
  const s = page.locator(`[data-testid="${nodeTestId(typeOf[src], map[src])}"] [data-port-id="${srcPort}"]`).first();
  const d = page.locator(`[data-testid="${nodeTestId(typeOf[dst], map[dst])}"] [data-port-id="${dstPort}"]`).first();
  await s.click({ force: true }); await page.waitForTimeout(90);
  await d.click({ force: true }); await page.waitForTimeout(120);
}

// ── Setup ───────────────────────────────────────────────────────────────────
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(800);
await page.getByText('Build Fresh', { exact: false }).first().click(); await page.waitForTimeout(600);
await page.getByTestId('mode-button-design').click(); await page.waitForTimeout(700);

// ── Stage A: author FullAdder gates, then create the module from selection ────
const fa = {};
const T = {}; // logical name -> node type
const def = (n, t) => { T[n] = t; };
def('A', 'INPUT'); def('B', 'INPUT'); def('CIN', 'INPUT');
def('x1', 'XOR'); def('x2', 'XOR'); def('a1', 'AND'); def('a2', 'AND'); def('o1', 'OR');
def('SUM', 'OUTPUT'); def('COUT', 'OUTPUT');

await place('A', 'ide-design-palette-input', 'INPUT', 80, 120, fa);
await place('B', 'ide-design-palette-input', 'INPUT', 80, 250, fa);
await place('CIN', 'ide-design-palette-input', 'INPUT', 80, 380, fa);
await place('x1', 'ide-design-palette-xor', 'XOR', 280, 150, fa);
await place('a1', 'ide-design-palette-and', 'AND', 280, 330, fa);
await place('x2', 'ide-design-palette-xor', 'XOR', 470, 120, fa);
await place('a2', 'ide-design-palette-and', 'AND', 470, 300, fa);
await place('o1', 'ide-design-palette-or', 'OR', 640, 340, fa);
await place('SUM', 'ide-design-palette-output', 'OUTPUT', 660, 120, fa);
await place('COUT', 'ide-design-palette-output', 'OUTPUT', 820, 340, fa);
console.log('STAGE A placed:', JSON.stringify(fa));

await page.getByTestId('ide-design-tool-wire').click(); await page.waitForTimeout(150);
await wire(fa, 'A', 'out', 'x1', 'a', T);
await wire(fa, 'B', 'out', 'x1', 'b', T);
await wire(fa, 'x1', 'out', 'x2', 'a', T);
await wire(fa, 'CIN', 'out', 'x2', 'b', T);
await wire(fa, 'x2', 'out', 'SUM', 'in', T);
await wire(fa, 'A', 'out', 'a1', 'a', T);
await wire(fa, 'B', 'out', 'a1', 'b', T);
await wire(fa, 'x1', 'out', 'a2', 'a', T);
await wire(fa, 'CIN', 'out', 'a2', 'b', T);
await wire(fa, 'a1', 'out', 'o1', 'a', T);
await wire(fa, 'a2', 'out', 'o1', 'b', T);
await wire(fa, 'o1', 'out', 'COUT', 'in', T);
const afterWire = await G();
console.log('STAGE A connections:', afterWire.conns);

// Name the boundary signals so the inferred module ports read A,B,CIN,SUM,COUT.
await page.getByTestId('ide-design-tool-select').click(); await page.waitForTimeout(120);
await renameNode(fa, 'A', 'A', T);
await renameNode(fa, 'B', 'B', T);
await renameNode(fa, 'CIN', 'CIN', T);
await renameNode(fa, 'SUM', 'SUM', T);
await renameNode(fa, 'COUT', 'COUT', T);
await page.waitForTimeout(150);

// Back to select tool; select ONLY the 5 gates. Click the first gate plain to
// replace whatever placement left selected, then shift-click the rest.
await page.getByTestId('ide-design-tool-select').click(); await page.waitForTimeout(150);
const gates = ['x1', 'x2', 'a1', 'a2', 'o1'];
await page.locator(`[data-testid="${nodeTestId(T[gates[0]], fa[gates[0]])}"]`).first().click({ force: true });
await page.waitForTimeout(100);
await page.keyboard.down('Shift');
for (const g of gates.slice(1)) {
  await page.locator(`[data-testid="${nodeTestId(T[g], fa[g])}"]`).first().click({ force: true });
  await page.waitForTimeout(80);
}
await page.keyboard.up('Shift');
await page.waitForTimeout(200);

// Diagnostic: dump exact connections + selection.
const diag = await page.evaluate(() => {
  const st = window.__RB_PROJECT_RUNTIME__.getState();
  const conns = st.circuit.connections.map((c) => `${c.from.nodeId}.${c.from.portName}->${c.to.nodeId}.${c.to.portName}`);
  let sel = null;
  try { sel = [...(window.__RB_CIRCUIT_STORE__?.getState().selection.nodes ?? [])]; } catch {}
  return { conns, sel };
});
console.log('CONNS:', JSON.stringify(diag.conns));
console.log('SELECTION:', JSON.stringify(diag.sel));

const openBtn = page.getByTestId('ide-design-create-module-open');
console.log('create-module-open present:', await openBtn.count());
await openBtn.click(); await page.waitForTimeout(300);
const err = await page.getByTestId('ide-design-create-module-error').count();
console.log('module dialog error:', err ? await page.getByTestId('ide-design-create-module-error').textContent() : 'none');
await page.getByTestId('ide-design-create-module-name').fill('FullAdder');
await page.getByTestId('ide-design-create-instance-name').fill('u_fa');
const confirm = page.getByTestId('ide-design-create-module-confirm');
console.log('confirm disabled:', await confirm.isDisabled());
if (!(await confirm.isDisabled())) { await confirm.click(); await page.waitForTimeout(500); }

let s = await G();
const faDef = s.modules.find((m) => m.name === 'FullAdder');
console.log('STAGE A RESULT module:', JSON.stringify(faDef));
await page.screenshot({ path: `${OUT}/90-fulladder-created.png` });

// ── Stage B: clear the top, build the 4-bit structure ─────────────────────────
// Clear top: select-all + delete (FullAdder definition remains in hierarchy).
await page.locator('[data-testid="ide-design-canvas"]').click({ position: { x: 900, y: 60 }, force: true });
await page.keyboard.press('Control+a'); await page.waitForTimeout(150);
await page.keyboard.press('Delete'); await page.waitForTimeout(300);
s = await G();
console.log('after clear: top nodes =', s.nodes.length, '| FullAdder still defined =', s.modules.some((m) => m.name === 'FullAdder'));

async function createBus(name, direction, width) {
  await page.getByTestId('ide-design-library-new-bus').click(); await page.waitForTimeout(200);
  await page.getByTestId('ide-design-create-bus-direction').selectOption(direction);
  await page.getByTestId('ide-design-create-bus-name').fill(name);
  await page.getByTestId('ide-design-create-bus-width').fill(String(width));
  await page.getByTestId('ide-design-create-bus-confirm').click(); await page.waitForTimeout(350);
}
await createBus('A', 'input', 4);
await createBus('B', 'input', 4);
await createBus('SUM', 'output', 4);
// CARRY: a scalar output boundary, labeled CARRY.
await placeVia('ide-design-palette-output', 980, 520);
const carryId = await newestNodeId('OUTPUT', seen); seen.add(carryId);
const carryMap = { CARRY: carryId }; const carryT = { CARRY: 'OUTPUT' };
await renameNode(carryMap, 'CARRY', 'CARRY', carryT);

// Place four FullAdder instances via the library rail "Use" button.
const faId = faDef.id;
for (let i = 0; i < 4; i++) {
  await page.getByTestId(`ide-design-palette-place-${faId}`).first().click();
  await page.waitForTimeout(300);
}
s = await G();
const instances = s.nodes.filter((n) => n.mod === faId);
console.log('placed instances:', instances.length, JSON.stringify(instances.map((n) => n.inst)));

// Place a GROUND to tie stage-0 CIN low.
await placeVia('ide-design-palette-ground', 120, 560);
const gndId = await newestNodeId('GROUND', seen); seen.add(gndId);

// Fit the camera so every placed node is on-screen and clickable.
async function fitAll() {
  await page.locator('[data-testid="ide-design-canvas"]').click({ position: { x: 700, y: 70 }, force: true });
  await page.keyboard.press('Shift+F'); await page.waitForTimeout(400);
}
await fitAll();
const rects = await page.evaluate(() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const out = {};
  for (const el of document.querySelectorAll('[data-testid^="node-"]')) {
    const r = el.getBoundingClientRect();
    out[el.getAttribute('data-testid')] = {
      x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
      onScreen: r.x >= 0 && r.y >= 0 && r.right <= vw && r.bottom <= vh,
    };
  }
  return out;
});
const offscreen = Object.entries(rects).filter(([, r]) => !r.onScreen).map(([k]) => k);
console.log('total node els:', Object.keys(rects).length, '| offscreen:', offscreen.length);
await page.screenshot({ path: `${OUT}/91-structure.png` });

// Compute node ids up front, then lay everything out on a clean grid so no
// two port clusters overlap (packed defaults made adjacent clicks collide).
s = await G();
console.log('active after fit:', s.active);
const instId = s.nodes.filter((n) => n.mod === faId).map((n) => n.id); // fa0..fa3
const byLabel = {};
for (const n of s.nodes) if (n.label) byLabel[n.label] = n.id;
const gnd = s.nodes.find((n) => n.type === 'Ground');

await page.getByTestId('ide-design-tool-select').click(); await page.waitForTimeout(100);
await fitAll();
async function dragNodeTo(tid, tx, ty) {
  const el = page.locator(`[data-testid="${tid}"]`).first();
  const box = await el.boundingBox();
  if (!box) { console.log('drag: no box for', tid); return; }
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move((cx + tx) / 2, (cy + ty) / 2, { steps: 6 });
  await page.mouse.move(tx, ty, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(120);
}
// Left→right dataflow, kept below the top authoring overlay (which blocks
// clicks on nodes beneath it): Ground, A col, B col, instances col, SUM col.
await dragNodeTo(nodeTestId('Ground', gnd.id), 320, 360);
for (let i = 0; i < 4; i++) {
  await dragNodeTo(nodeTestId('INPUT', byLabel[`A[${i}]`]), 470, 320 + i * 105);
  await dragNodeTo(nodeTestId('INPUT', byLabel[`B[${i}]`]), 620, 320 + i * 105);
  await dragNodeTo(nodeTestId('OUTPUT', byLabel[`SUM[${i}]`]), 1150, 320 + i * 105);
}
for (let i = 0; i < 4; i++) {
  await dragNodeTo(nodeTestId('FullAdder', instId[i]), 850, 335 + i * 128);
}
await dragNodeTo(nodeTestId('OUTPUT', byLabel['CARRY']), 1150, 745);
await page.screenshot({ path: `${OUT}/91b-grid.png` });

// Rename instances u_fa0..u_fa3 (positions are stable now; no re-fit).
for (let i = 0; i < instId.length; i++) {
  await page.locator(`[data-testid="${nodeTestId('FullAdder', instId[i])}"]`).first().click({ force: true });
  await page.waitForTimeout(150);
  const rn = page.getByTestId('ide-design-rename-module-instance');
  if (await rn.count() > 0) {
    await rn.click(); await page.waitForTimeout(120);
    await page.getByTestId('ide-design-module-instance-name-input').fill(`u_fa${i}`);
    await page.getByTestId('ide-design-module-instance-name-save').click(); await page.waitForTimeout(160);
  }
}
console.log('active after rename:', (await G()).active);

// ── Stage C: wire the 4-bit ripple-carry adder through the wire tool ───────────
// Instance ports are dense-clustered, so wiring them uses the endpoint picker;
// single-port bus members / ground / carry are sparse (direct data-port-id).
// No re-fit: the grid positions above stay stable for precise port clicks.
await page.getByTestId('ide-design-tool-wire').click(); await page.waitForTimeout(150);

// A sparse endpoint: { tid, port }. A dense (instance) endpoint: { id, side, portId }.
async function clickEndpoint(ep) {
  if (ep.tid) {
    await page.locator(`[data-testid="${ep.tid}"] [data-port-id="${ep.port}"]`).first().click({ force: true });
  } else {
    await page.getByTestId(`logic-port-cluster-${ep.id}-${ep.side}`).first().click({ force: true });
    await page.waitForTimeout(160);
    await page.getByTestId(`logic-port-picker-choice-${ep.id}-${ep.portId}`).first().click({ force: true });
  }
  await page.waitForTimeout(120);
}
async function connect(src, dst) { await clickEndpoint(src); await clickEndpoint(dst); }

const inTid = (label) => nodeTestId('INPUT', byLabel[label]);
const outTid = (label) => nodeTestId('OUTPUT', byLabel[label]);
const faIn = (id, portId) => ({ id, side: 'input', portId });
const faOut = (id, portId) => ({ id, side: 'output', portId });
const sparse = (tid, port) => ({ tid, port });

// Declare every wire with the connection key it should produce, so a single
// flaky click can be detected and retried.
const wires = [];
for (let i = 0; i < 4; i++) {
  wires.push({ src: sparse(inTid(`A[${i}]`), 'out'), dst: faIn(instId[i], 'A'), key: `${byLabel[`A[${i}]`]}.out->${instId[i]}.A` });
  wires.push({ src: sparse(inTid(`B[${i}]`), 'out'), dst: faIn(instId[i], 'B'), key: `${byLabel[`B[${i}]`]}.out->${instId[i]}.B` });
  wires.push({ src: faOut(instId[i], 'SUM'), dst: sparse(outTid(`SUM[${i}]`), 'in'), key: `${instId[i]}.SUM->${byLabel[`SUM[${i}]`]}.in` });
}
wires.push({ src: sparse(nodeTestId('Ground', gnd.id), 'out'), dst: faIn(instId[0], 'CIN'), key: `${gnd.id}.out->${instId[0]}.CIN` });
for (let i = 0; i < 3; i++) wires.push({ src: faOut(instId[i], 'COUT'), dst: faIn(instId[i + 1], 'CIN'), key: `${instId[i]}.COUT->${instId[i + 1]}.CIN` });
wires.push({ src: faOut(instId[3], 'COUT'), dst: sparse(outTid('CARRY'), 'in'), key: `${instId[3]}.COUT->${byLabel['CARRY']}.in` });

const connSet = async () => new Set((await page.evaluate(() =>
  window.__RB_PROJECT_RUNTIME__.getState().circuit.connections.map(
    (c) => `${c.from.nodeId}.${c.from.portName}->${c.to.nodeId}.${c.to.portName}`))));

for (const w of wires) await connect(w.src, w.dst);
// Retry any wire that did not land (up to 2 passes) — clears stray picker first.
for (let pass = 0; pass < 2; pass++) {
  const have = await connSet();
  const todo = wires.filter((w) => !have.has(w.key));
  if (todo.length === 0) break;
  console.log(`retry pass ${pass}: ${todo.length} missing`);
  for (const w of todo) {
    await page.keyboard.press('Escape'); await page.waitForTimeout(80);
    await connect(w.src, w.dst);
  }
}

const finalHave = await connSet();
const missing = wires.filter((w) => !finalHave.has(w.key)).map((w) => w.key);
const cset = [...finalHave];
const extra = cset.filter((c) => !wires.some((w) => w.key === c));
console.log('STAGE C connections:', cset.length);
console.log('EXPECTED:', wires.length, '| MISSING:', JSON.stringify(missing), '| EXTRA:', JSON.stringify(extra));

await page.getByTestId('ide-design-tool-select').click();
await fitAll();
await page.screenshot({ path: `${OUT}/92-wired.png` });

// ── Stage D: simulate the UI-authored design (A=0xA, B=0xD → SUM=0x7, CARRY=1) ─
// The design was authored entirely through the UI above; this runs the real
// deterministic simulation over it and reads the observed outputs.
const sim = await page.evaluate(() => {
  const g = window.__RB_PROJECT_RUNTIME__.getState();
  const inputs = { 'A[3]': 1, 'A[2]': 0, 'A[1]': 1, 'A[0]': 0, 'B[3]': 1, 'B[2]': 1, 'B[1]': 0, 'B[0]': 1 };
  const run = g.runVerification({ scenarioId: 'adder', scenarioName: '4-bit adder', deterministicHash: 'adder', rows: [], vectors: [{ id: 'v0', name: 't0', tick: 0, inputs, expected: {} }] });
  const sample = (run?.waveform ?? []).find((s) => s.tick === 0)?.signals ?? {};
  // Resolve each output node's observed bit from the waveform (label or node-id keyed).
  const nodes = g.circuit.nodes;
  const byLabel = {};
  for (const n of nodes) if (n.label) byLabel[n.label] = n.id;
  const bit = (label) => {
    const id = byLabel[label];
    const cands = [label, `${label}.in`, `${id}`, `${id}.in`, `${id}.out`];
    for (const k of cands) if (sample[k] === '1' || sample[k] === 1) return 1;
    for (const k of cands) if (sample[k] === '0' || sample[k] === 0) return 0;
    return null;
  };
  const sumWord = [3, 2, 1, 0].reduce((acc, i) => acc * 2 + (bit(`SUM[${i}]`) ?? 0), 0);
  return { status: run?.status, sum: sumWord, carry: bit('CARRY'), rawKeys: Object.keys(sample).slice(0, 12) };
});
console.log('STAGE D sim:', JSON.stringify(sim), '| SUM hex:', '0x' + (sim.sum ?? 0).toString(16).toUpperCase());

// Navigate to Simulate to show the vector word lanes over the authored run.
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/93-simulate.png` });

// ── Stage E: save, reload, and confirm the hierarchy survives ──────────────────
await page.getByTestId('mode-button-design').click(); await page.waitForTimeout(600);
const saveBtn = page.getByRole('button', { name: /^Save$/ });
if (await saveBtn.count() > 0) { await saveBtn.first().click(); await page.waitForTimeout(1200); }
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
const afterReload = await page.evaluate(() => {
  const g = window.__RB_PROJECT_RUNTIME__.getState();
  return {
    modules: g.hierarchy.modules.map((m) => m.name),
    instances: g.circuit.nodes.filter((n) => n.config?.moduleDefinitionId).map((n) => n.config?.instanceName),
    connections: g.circuit.connections.length,
    buses: (g.circuit.buses ?? []).map((b) => b.name),
  };
});
console.log('STAGE E after reload:', JSON.stringify(afterReload));

// ── Stage F: generated hierarchical VHDL in Build & Export ────────────────────
// Board-constraint step (not design authoring): auto-assign Basys3 pins so the
// export has an ioMapping and can emit the structural hierarchical top.
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().autoSuggestMapping());
await page.waitForTimeout(600);
await page.getByTestId('mode-button-export').click(); await page.waitForTimeout(1800);
// Click through the generated files, capturing any that carry VHDL content.
const files = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('.ide-export-v3__file-name')].map((e) => e.textContent.trim());
  return btns;
});
console.log('STAGE F files:', JSON.stringify(files));
async function readFile(nameMatch) {
  const btn = page.locator('.ide-export-v3__file-name', { hasText: nameMatch }).first();
  if (await btn.count() === 0) return null;
  await btn.click(); await page.waitForTimeout(400);
  return page.getByTestId('ide-export-preview-code').textContent();
}
const topVhd = (await readFile('top')) ?? '';
const faVhd = (await readFile('full_adder')) ?? (await readFile('fulladder')) ?? '';
const topHasInstances = ['u_fa0', 'u_fa1', 'u_fa2', 'u_fa3'].filter((n) => topVhd.includes(n)).length;
console.log('STAGE F top instances found:', topHasInstances, '| full_adder.vhd present:', faVhd.length > 0);
console.log('STAGE F top has entity work.FullAdder:', topVhd.includes('work.FullAdder'));
await page.screenshot({ path: `${OUT}/94-export-vhdl.png` });
console.log('ERRORS', JSON.stringify([...new Set(errors)].slice(0, 8)));
await browser.close();
