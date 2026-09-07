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

  // ⑦ The bottom panel exists on every workspace, and the count in the footer opens it.
  // It used to be `problemsLedgerCount > 0 ? 'collapsed' : 'hidden'` on four of the five, so a
  // project with no problems had no panel, no strip to open one, and a footer problems count
  // that was a button doing nothing. Whether there is anything to report is the panel's answer
  // to give, not a reason for it to disappear.
  for (const mode of ['project', 'design', 'verify', 'hardware', 'export']) {
    await page.getByTestId(`mode-button-${mode}`).click();
    await page.waitForTimeout(700);
    const reachable = await page.evaluate(() => {
      const open = document.querySelector('[data-testid="ide-workbench-console"]');
      const strip = document.querySelector('[data-testid="ide-show-bottom-dock"]');
      return Boolean(open || strip);
    });
    if (!reachable) fail(`${mode} offers no way to reach the bottom panel at ${width}×${height}`);
  }

  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(700);
  await page.getByTestId('ide-status-problems').click();
  await page.waitForTimeout(700);
  const opened = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="ide-workbench-console"]');
    const problems = document.querySelector('[data-testid="ide-problems-panel"]');
    const status = document.querySelector('[data-testid="ide-status-bar"]');
    const panelBox = panel ? panel.getBoundingClientRect() : null;
    const statusBox = status ? status.getBoundingClientRect() : null;
    return {
      state: panel ? panel.getAttribute('data-console-state') : null,
      height: panelBox ? Math.round(panelBox.height) : 0,
      problemsVisible: Boolean(problems && problems.getBoundingClientRect().height > 0),
      panelBelowFold: panelBox ? panelBox.bottom > window.innerHeight + 1 : true,
      statusBelowFold: statusBox ? statusBox.bottom > window.innerHeight + 1 : true,
    };
  });
  if (opened.state !== 'expanded') {
    fail(`the footer problems count left the panel "${opened.state}" - clicking a count should show what it counts`);
  }
  if (!opened.problemsVisible) fail('the panel opened without its problems list');
  if (opened.panelBelowFold) fail(`the opened panel runs past the viewport at ${width}×${height}`);
  if (opened.statusBelowFold) fail(`the status bar is below the viewport at ${width}×${height}`);

  // ...and it can be put away again, both ways, from controls that are on screen.
  await page.getByTestId('ide-console-toggle').click();
  await page.waitForTimeout(500);
  const collapsed = await page.evaluate(() =>
    document.querySelector('[data-testid="ide-workbench-console"]')?.getAttribute('data-console-state') ?? null);
  if (collapsed !== 'collapsed') fail(`collapsing left the panel "${collapsed}"`);
  await page.getByTestId('ide-hide-bottom-dock').click();
  await page.waitForTimeout(500);
  const recoverable = await page.getByTestId('ide-show-bottom-dock').count();
  if (recoverable === 0) fail('hiding the panel left no way to bring it back');
  console.log(`[${width}×${height}] ⑦ bottom panel: reachable on all five workspaces, the footer count opens it ` +
    `(${opened.height}px, problems listed), and hiding it leaves a strip to restore it`);
  // ⑧ The panel keeps a preference per workspace, and each workspace restores its own.
  // Dock state is per-surface throughout this shell; opening Problems on Project is not a
  // statement about Design. What must hold is that leaving and coming back restores what that
  // workspace was left in, and that a changing problem count never silently overrides it.
  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(600);
  await page.getByTestId('ide-status-problems').click();
  await page.waitForTimeout(600);
  const panelState = () => page.evaluate(() => {
    const panel = document.querySelector('[data-testid="ide-workbench-console"]');
    return panel ? panel.getAttribute('data-console-state') : 'absent';
  });
  if ((await panelState()) !== 'expanded') fail('Project did not keep the panel open');
  await page.getByTestId('mode-button-design').click();
  await page.waitForTimeout(700);
  const designState = await panelState();
  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(700);
  if ((await panelState()) !== 'expanded') {
    fail('returning to Project did not restore the panel it was left open on');
  }
  await page.getByTestId('mode-button-design').click();
  await page.waitForTimeout(700);
  if ((await panelState()) !== designState) {
    fail(`Design's own panel preference changed behind its back: ${designState} -> ${await panelState()}`);
  }
  console.log(`[${width}×${height}] ⑧ per-surface panel preference: Project expanded, Design ${designState}, both restored on return`);

  // And a change in what there is to report does not decide the panel for the reader. The count is
  // the panel's content, not its state: four problems or none, the panel is the one the reader left
  // it in. (Blocking diagnostics still force it into view - a different thing, and one that does not
  // write the preference.) The step fails if the count does not actually move, because an invariant
  // asserted over an unchanged value is not an assertion.
  const storedBottom = () => page.evaluate(() => {
    try {
      const raw = localStorage.getItem('rb.ide.workspace.preferences.v2');
      if (!raw) return 'absent';
      const dock = JSON.parse(raw)?.surfaces?.project?.docks?.bottom;
      return dock
        ? `${dock.visible ? 'visible' : 'hidden'}/${dock.expanded ? 'expanded' : 'collapsed'}`
        : 'unset';
    } catch { return '<unreadable>'; }
  });
  const problemCount = () => page.evaluate(() => {
    const el = document.querySelector('[data-testid="ide-status-problems"]');
    const digits = el ? (el.textContent.match(/\d+/) ?? [])[0] : null;
    return digits ? Number(digits) : 0;
  });
  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(600);
  const beforeCount = await problemCount();
  const beforePref = await storedBottom();

  // Give the ledger something to report: remove a symbol and leave its wires dangling.
  await page.getByTestId('mode-button-design').click();
  await page.waitForTimeout(1000);
  await page.locator('[data-node-id]').first().click({ force: true });
  await page.waitForTimeout(400);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(1200);

  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(900);
  const afterCount = await problemCount();
  const afterPref = await storedBottom();
  if (afterCount === beforeCount) {
    fail(`the ledger did not move (${beforeCount}), so this step proved nothing about the panel`);
  }
  if (afterPref !== beforePref) {
    fail(`the problem count decided the panel for the reader: ${beforePref} -> ${afterPref} ` +
      `while the count went ${beforeCount} -> ${afterCount}`);
  }
  console.log(`[${width}×${height}] ⑧b the ledger went ${beforeCount} -> ${afterCount} problems and the stored ` +
    `panel preference stayed ${afterPref}`);

  // Put the design back so the rest of the journey reads the project it was given.
  await page.getByTestId('mode-button-design').click();
  await page.waitForTimeout(700);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(1000);

  // ⑨ The splitter is operable from the keyboard.
  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(600);
  const panelHeight = () => page.evaluate(() => {
    const panel = document.querySelector('[data-testid="ide-workbench-console"]');
    return panel ? Math.round(panel.getBoundingClientRect().height) : 0;
  });
  const beforeResize = await panelHeight();
  await page.focus('[data-testid="ide-resize-bottom-dock"]');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(400);
  const afterResize = await panelHeight();
  if (afterResize <= beforeResize) {
    fail(`the bottom splitter did not respond to the keyboard: ${beforeResize}px -> ${afterResize}px`);
  }

  // An empty project still has a usable way in: no problems is an answer, not a disappearance.
  const emptyEntry = await page.evaluate(() => {
    const open = document.querySelector('[data-testid="ide-workbench-console"]');
    const strip = document.querySelector('[data-testid="ide-show-bottom-dock"]');
    const problems = document.querySelector('[data-testid="ide-problems-panel"]');
    return { reachable: Boolean(open || strip), problemsRendered: Boolean(problems) };
  });
  if (!emptyEntry.reachable) fail('a project with no problems has no way to the panel');
  console.log(`[${width}×${height}] ⑨ splitter by keyboard ${beforeResize}px -> ${afterResize}px; ` +
    `panel reachable with the ledger ${emptyEntry.problemsRendered ? 'rendered' : 'empty'}`);

  // ⑨b A layout reset is the way back from any arrangement, including a hidden panel. Hide it,
  // then reset, and the panel must be there again at the size the workspace ships with.
  const hideControl = page.locator('.ide-workbench-console-bar .ide-workbench-dock-collapse').first();
  if ((await hideControl.count()) === 0) fail('there is no control to put the panel away');
  await hideControl.click();
  await page.waitForTimeout(500);
  const hiddenState = await panelState();
  if (hiddenState !== 'absent') fail(`hiding the panel left it ${hiddenState}`);
  await page.keyboard.press('Control+k');
  await page.waitForSelector('[data-testid="ide-command-palette"]', { state: 'visible', timeout: 8000 });
  await page.getByTestId('ide-command-palette-query').fill('reset');
  await page.waitForSelector('[data-testid="ide-command-workspace.layout.reset"]', { state: 'visible', timeout: 8000 });
  await page.getByTestId('ide-command-workspace.layout.reset').click();
  await page.waitForTimeout(900);
  const recovered = await panelState();
  const recoveredHeight = await panelHeight();
  if (recovered === 'absent') {
    fail('a layout reset did not bring the bottom panel back');
  }
  if (recoveredHeight === afterResize) {
    fail(`a layout reset kept the resized height (${recoveredHeight}px), so it reset nothing`);
  }
  console.log(`[${width}×${height}] ⑨b hide -> layout reset -> panel ${recovered} at ${recoveredHeight}px ` +
    `(was ${afterResize}px before the reset)`);
  await page.screenshot({ path: `${OUT}/slice1-shell-${width}x${height}.png` });
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS — footer owns problems+evidence ("${problems}" / "${runReadout}"), rail is a pure switcher, overflow ${overflow}px/${boardOverflow}px`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — shell: one status authority (footer), rail switches only, no overflow.');
