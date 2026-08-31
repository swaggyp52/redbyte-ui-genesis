// P2.5 Slice 3 — the Compare repair loop now shows a real verdict. Before this
// slice, running the Full Adder's saved checks rendered "Simulation complete"
// with no pass/fail proof for BOTH a correct and a broken circuit — the central
// classroom activity gave no verdict. This journey drives the real UI through
// PASS -> (break a gate in Design) -> FAIL -> (undo) -> PASS and asserts the
// verdict each time: the pass-hero proof block on PASS, a "Compare failed"
// verdict on FAIL. Store reads are assertions only. 1440×900 and 1366×768.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const fail = (m) => { throw new Error(m); };
const OUT = '/tmp/claude-0/-home-user-redbyte-ui-genesis/b4914bef-2a1a-55cb-97de-096a331aef03/scratchpad';

async function runCompare(page) {
  await page.getByTestId('mode-button-verify').click();
  await page.waitForTimeout(700);
  await page.getByTestId('ide-vcb-run').first().click();
  await page.waitForTimeout(1400);
}
const summaryKind = (page) => page.getByTestId('ide-verify-results-summary').getAttribute('data-kind');
const summaryText = async (page) => ((await page.getByTestId('ide-verify-results-summary').textContent()) ?? '').replace(/\s+/g, ' ').trim();

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const rt = window.__RB_PROJECT_RUNTIME__.getState(); rt.loadExample('full-adder'); rt.autoSuggestMapping(); });
  await page.waitForTimeout(400);

  // ① Correct Full Adder: Compare PASSES with a visible pass-hero proof block.
  await runCompare(page);
  if (await summaryKind(page) !== 'pass') fail(`correct circuit should PASS; got kind=${await summaryKind(page)} ("${await summaryText(page)}")`);
  if (await page.getByTestId('ide-verify-pass-hero').count() === 0) fail('pass proof block (ide-verify-pass-hero) missing on a passing compare');
  if (!(await summaryText(page)).includes('Compare passed')) fail(`PASS headline wrong: "${await summaryText(page)}"`);
  console.log(`[${width}×${height}] ① correct Full Adder → Compare PASSED (pass-hero shown)`);

  // ② Break the circuit in Design: delete one gate node through the real canvas.
  const gate = await page.evaluate(() => {
    const n = window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.find((x) => ['AND', 'OR', 'XOR'].includes(x.type));
    return n ? { id: n.id, type: n.type } : null;
  });
  if (!gate) fail('no gate to break');
  await page.getByTestId('mode-button-design').click();
  await page.waitForTimeout(500);
  await page.locator(`[data-testid="node-${gate.type}-${gate.id}"]`).first().click({ force: true });
  await page.waitForTimeout(150);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);

  // ③ Re-run: Compare now FAILS with a real verdict (not "Simulation complete").
  await runCompare(page);
  const brokenKind = await summaryKind(page);
  if (brokenKind !== 'fail') fail(`broken circuit should FAIL; got kind=${brokenKind} ("${await summaryText(page)}")`);
  if (!(await summaryText(page)).includes('Compare failed')) fail(`FAIL headline wrong: "${await summaryText(page)}"`);
  if (await page.getByTestId('ide-verify-pass-hero').count() !== 0) fail('pass-hero must not show on a failing compare');
  console.log(`[${width}×${height}] ② broke a ${gate.type} gate → Compare FAILED (verdict shown, no pass-hero)`);

  // ④ Repair via undo, then re-run: back to PASS.
  await page.getByTestId('mode-button-design').click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  await runCompare(page);
  if (await summaryKind(page) !== 'pass') fail(`repaired circuit should PASS again; got kind=${await summaryKind(page)}`);
  if (await page.getByTestId('ide-verify-pass-hero').count() === 0) fail('pass-hero missing after repair');
  console.log(`[${width}×${height}] ③ undo repaired the gate → Compare PASSED again`);

  // ⑤ No horizontal overflow through the loop.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);

  await page.screenshot({ path: `${OUT}/slice3-compare-verdict-${width}x${height}.png` });
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS — verdict-driven Compare repair loop (pass → fail → pass), overflow ${overflow}px`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — Slice 3 Compare repair loop shows a real verdict at 1440×900 and 1366×768.');
