// P1-D acceptance — the Manual Bench (Simulate) and the Virtual Board
// (Board & Constraints) are two instruments over ONE experiment state
// (useProjectRuntime().sim). This journey drives from the bench and confirms
// the board reflects it, then drives from the board and confirms the bench
// reflects it — both directions, through the real UI. It also proves that
// live driving never mutates the persistent testbench (scenarios) or run
// history. Browser-E0 simulation only; the board is never "programmed".
//
// The Half Adder circuit is loaded through its own shipped load path
// (loadExample — the exact action the Project example card's Load button
// runs). Every DRIVE and every OBSERVE below is through real bench/board DOM.
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

const fail = (msg) => { throw new Error(msg); };
const sim = () => page.evaluate(() => {
  const st = window.__RB_PROJECT_RUNTIME__.getState();
  const read = (nodeId) => {
    const i = st.sim.inputs[nodeId];
    if (i === 0 || i === 1) return i;
    return st.sim.signals[nodeId] ?? st.sim.signals[`${nodeId}.out`] ?? st.sim.signals[`${nodeId}.in`] ?? null;
  };
  return {
    sw0: read('sw0_node'), sw1: read('sw1_node'),
    carry: read('ld0_node'), sum: read('ld1_node'),
    scenarioVectorCount: (st.scenarios ?? []).reduce((n, s) => n + (s.vectors?.length ?? 0), 0),
    scenarioStepCount: (st.scenarios ?? []).reduce((n, s) => n + (s.steps?.length ?? 0), 0),
    runHistory: (st.verifyRunHistory ?? []).length,
    lastRun: st.verifyLastRun ? 1 : 0,
  };
});

// ── Setup: load the Half Adder through its shipped load path ──────────────────
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
await page.waitForTimeout(400);
{
  const s = await page.evaluate(() => {
    const st = window.__RB_PROJECT_RUNTIME__.getState();
    return { nodes: st.circuit.nodes.length, name: st.projectName };
  });
  if (s.nodes < 4) fail(`half-adder did not load (nodes=${s.nodes})`);
  console.log(`loaded: ${s.name} (${s.nodes} nodes)`);
}

// Baseline before any live driving — captured to prove no testbench mutation.
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(1200);
const baseline = await sim();
console.log('baseline persistent:', JSON.stringify({
  vectors: baseline.scenarioVectorCount, steps: baseline.scenarioStepCount,
  runs: baseline.runHistory, lastRun: baseline.lastRun,
}));

// ── 1. Open the Bench tab and DRIVE A=1, B=1 ─────────────────────────────────
await page.getByTestId('ide-vcb-workspace-bench').click(); await page.waitForTimeout(400);
if (await page.getByTestId('ide-manual-bench').count() === 0) fail('Manual Bench did not mount');

await page.getByTestId('ide-manual-bench-drive-toggle-sw0-a').click(); await page.waitForTimeout(150);
await page.getByTestId('ide-manual-bench-drive-toggle-sw1-b').click(); await page.waitForTimeout(200);

let benchSum = (await page.getByTestId('ide-manual-bench-measure-value-ld1-sum').textContent()).trim();
let benchCarry = (await page.getByTestId('ide-manual-bench-measure-value-ld0-carry').textContent()).trim();
if (benchSum !== '0') fail(`bench SUM expected 0, got ${benchSum}`);
if (benchCarry !== '1') fail(`bench CARRY expected 1, got ${benchCarry}`);
let s1 = await sim();
if (!(s1.sw0 === 1 && s1.sw1 === 1 && s1.sum === 0 && s1.carry === 1)) fail(`store after bench drive: ${JSON.stringify(s1)}`);
console.log('① bench drive A=1,B=1 → SUM=0, CARRY=1 (bench + store agree)');
await page.screenshot({ path: `${OUT}/bench-01-drive.png` });

// ── 2. Go to the Virtual Board — it must reflect the SAME state (bench→board) ─
await page.getByTestId('mode-button-hardware').click(); await page.waitForTimeout(1200);
if (await page.getByTestId('ide-virtual-board').count() === 0) fail('Virtual Board did not mount');
const boardState = async () => page.evaluate(() => ({
  sw0: document.querySelector('[data-testid="ide-virtual-board-sw-0"]')?.getAttribute('data-on'),
  sw1: document.querySelector('[data-testid="ide-virtual-board-sw-1"]')?.getAttribute('data-on'),
  led0: document.querySelector('[data-testid="ide-virtual-board-led-0"]')?.getAttribute('data-on'),
  led1: document.querySelector('[data-testid="ide-virtual-board-led-1"]')?.getAttribute('data-on'),
}));
let b1 = await boardState();
if (!(b1.sw0 === '1' && b1.sw1 === '1' && b1.led0 === '1' && b1.led1 === '0'))
  fail(`board did not reflect bench drive: ${JSON.stringify(b1)}`);
console.log('② board reflects bench: SW0=1 SW1=1 LD0(CARRY)=1 LD1(SUM)=0 — one shared state');
await page.screenshot({ path: `${OUT}/bench-02-board.png` });

// ── 3. Drive from the Virtual Board — toggle SW1 OFF (board→shared state) ─────
await page.getByTestId('ide-virtual-board-sw-1').click(); await page.waitForTimeout(250);
let s2 = await sim();
if (s2.sw1 !== 0) fail(`board toggle did not reach store: sw1=${s2.sw1}`);
let b2 = await boardState();
if (!(b2.sw1 === '0' && b2.led1 === '1' && b2.led0 === '0'))
  fail(`board self-update wrong: ${JSON.stringify(b2)}`);
console.log('③ board drive SW1→0 → store sw1=0, LD1(SUM)=1, LD0(CARRY)=0');

// ── 4. Back to the Bench — it must reflect the board's drive (board→bench) ────
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(1000);
await page.getByTestId('ide-vcb-workspace-bench').click(); await page.waitForTimeout(400);
benchSum = (await page.getByTestId('ide-manual-bench-measure-value-ld1-sum').textContent()).trim();
benchCarry = (await page.getByTestId('ide-manual-bench-measure-value-ld0-carry').textContent()).trim();
if (benchSum !== '1') fail(`bench SUM after board drive expected 1, got ${benchSum}`);
if (benchCarry !== '0') fail(`bench CARRY after board drive expected 0, got ${benchCarry}`);
console.log('④ bench reflects board: SUM=1, CARRY=0 — both directions proven');
await page.screenshot({ path: `${OUT}/bench-03-reflect.png` });

// ── 5. No implicit testbench / run mutation from any of the live driving ─────
const after = await sim();
if (after.scenarioVectorCount !== baseline.scenarioVectorCount ||
    after.scenarioStepCount !== baseline.scenarioStepCount ||
    after.runHistory !== baseline.runHistory ||
    after.lastRun !== baseline.lastRun) {
  fail(`live driving mutated persistent state: base=${JSON.stringify(baseline)} after=${JSON.stringify(after)}`);
}
console.log('⑤ persistent testbench + run history unchanged by live driving');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — shared Bench ↔ Virtual Board experiment, both directions, no testbench mutation.');
await browser.close();
