// P2.5 shell proof — there is exactly ONE status authority and nothing
// duplicates it. The footer owns compact actionable state (the problems
// affordance + evidence freshness); the workspace rail is a pure switcher and
// carries no per-stage status prose. Drives the real UI: loads the Full Adder,
// walks the workspaces, asserts the single ownership in both directions, and
// no horizontal overflow. 1440×900 and 1366×768.
import { BASE_URL, evidenceDir, launchChromium } from './harness.mjs';
const browser = await launchChromium();
const fail = (m) => { throw new Error(m); };
const OUT = evidenceDir();

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('full-adder'));
  await page.waitForTimeout(400);

  // Enter Simulate — the workspace that used to mint its own footer pills.
  await page.getByTestId('mode-button-verify').click();
  await page.waitForTimeout(300);

  const overflowNow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // ① The footer carries no duplicated per-workspace workflow pill.
  for (const dead of ['ide-status-simulation', 'ide-status-board', 'ide-status-package']) {
    if (await page.getByTestId(dead).count() !== 0) fail(`footer still carries duplicate workflow pill: ${dead}`);
  }
  // ② The footer is compact actionable state only. Support context, the check
  // gate and project identity moved to the frame bar / Problems panel in P2.5;
  // the footer must not narrate them a second time.
  const footer = (await page.getByTestId('ide-status-bar').textContent()) ?? '';
  if (/Support|Checks/.test(footer)) fail(`footer narrates status it no longer owns: "${footer}"`);

  // ③ The footer IS the authority for the two facts it kept: the problems
  // affordance (a real command) and evidence freshness.
  const problems = ((await page.getByTestId('ide-status-problems').textContent()) ?? '').trim();
  if (!/^(No problems|\d+ problems?)$/.test(problems)) fail(`footer lost its problems affordance: "${problems}"`);
  if (await page.getByTestId('ide-status-run').count() !== 1) fail('footer lost its single run-evidence readout');
  const runReadout = ((await page.getByTestId('ide-status-run').textContent()) ?? '').trim();
  if (runReadout !== 'Not simulated') fail(`footer run evidence should read "Not simulated" before any run: "${runReadout}"`);

  // ④ No horizontal overflow in Simulate.
  const overflow = await overflowNow();
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);

  // ⑤ The workspace rail is a pure switcher, never a second status surface: its
  // tabs carry a terse workspace name with no ratio, count or completion prose —
  // and clicking one really moves the workbench.
  const verifyBtn = ((await page.getByTestId('mode-button-verify').textContent()) ?? '').trim();
  if (verifyBtn !== 'Simulate') fail(`rail Simulate tab is not a terse switcher label: "${verifyBtn}"`);
  const hardwareBtn = ((await page.getByTestId('mode-button-hardware').textContent()) ?? '').trim();
  if (hardwareBtn !== 'Board') fail(`rail Board tab carries status prose it no longer owns: "${hardwareBtn}"`);
  await page.getByTestId('mode-button-hardware').click();
  await page.waitForTimeout(400);
  const stage = await page.evaluate(() => document.querySelector('[data-ide-stage]')?.getAttribute('data-ide-stage'));
  if (stage !== 'hardware') fail(`rail did not switch workspace: data-ide-stage="${stage}"`);
  if ((await page.getByTestId('mode-button-hardware').getAttribute('data-state')) !== 'current') {
    fail('rail does not mark Board as the current workspace');
  }
  // ⑥ Switching workspaces neither revives a footer pill nor overflows.
  for (const dead of ['ide-status-simulation', 'ide-status-board', 'ide-status-package']) {
    if (await page.getByTestId(dead).count() !== 0) fail(`footer minted a workflow pill on Board: ${dead}`);
  }
  const boardOverflow = await overflowNow();
  if (boardOverflow > 1) fail(`horizontal overflow on Board at ${width}×${height}: ${boardOverflow}px`);

  await page.screenshot({ path: `${OUT}/slice1-shell-${width}x${height}.png` });
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS — footer owns problems+evidence ("${problems}" / "${runReadout}"), rail is a pure switcher, overflow ${overflow}px/${boardOverflow}px`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — shell: one status authority (footer), rail switches only, no overflow.');
