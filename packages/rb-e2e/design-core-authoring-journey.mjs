// Bounded core authoring/repair journey. Uses the same palette/port controls as
// nested-adder-journey; runtime access only reads identity and observed values.
import { launchChromium, BASE_URL, evidenceDir } from './harness.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const out = evidenceDir('design-core-authoring', process.env.RB_SHOT_LABEL ?? 'current');
const browser = await launchChromium();
const results = [];
try {
  for (const kind of ['combinational', 'register']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 650 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const tid = id => page.getByTestId(id);
    const state = () => page.evaluate(() => {
      const runtime = window.__RB_PROJECT_RUNTIME__.getState();
      return structuredClone({ circuit: runtime.circuit, sim: runtime.sim, run: runtime.verifyLastRun });
    });
    const seen = new Set();
    const paletteVisibility = [];
    const revealLibrary = async () => {
      if (!await tid('ide-design-search').isVisible()) await tid('ide-show-left-dock').click();
    };
    const place = async (type, x, y) => {
      await revealLibrary();
      await tid('ide-design-search').fill(type === 'Register1' ? 'register' : type.toLowerCase());
      await tid(`ide-design-palette-${type.toLowerCase()}`).first().click();
      await tid('ide-design-placement-hit-layer').click({ position: { x, y } });
      await page.waitForFunction(count => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length > count, seen.size);
      const node = (await state()).circuit.nodes.find(node => node.type === type && !seen.has(node.id));
      assert.ok(node, `${type} placement creates one node`);
      seen.add(node.id);
      await page.waitForTimeout(180); // Let the first-node camera fit and panel geometry settle.
      paletteVisibility.push({ type, visible: await tid('ide-design-search').isVisible() });
      return node.id;
    };
    const select = async id => {
      await tid('ide-design-tool-select').click();
      await page.locator(`[data-node-id="${id}"]`).first().click();
    };
    const wire = async (from, fromPort, to, toPort) => {
      const canvasTop = async () => (await tid('ide-design-canvas').boundingBox()).y;
      const cueSize = async () => { const box = await tid('ide-design-wire-cuebar').boundingBox(); return `${box.width.toFixed(1)}x${box.height.toFixed(1)}`; };
      const top = await canvasTop();
      // A finished wire returns to Select; clicking the next source port starts Wire again.
      const cue = await tid('ide-design-wire-cuebar').count() ? await cueSize() : null;
      await tid(`port-${from}-${fromPort}`).click();
      await tid('ide-design-wire-cancel').waitFor();
      assert.ok(Math.abs(await canvasTop() - top) <= 1, `Arming a wire must not move the canvas (${top} -> ${await canvasTop()})`);
      // Esc cancels and Cancel share one cell: arming cannot change the row's width and rewrap it.
      if (cue) assert.equal(await cueSize(), cue, 'Arming a wire keeps the Wire cue one size');
      await tid(`port-${to}-${toPort}`).click();
    };
    const rename = async (id, label) => {
      await select(id);
      await page.keyboard.press('F2');
      await tid('ide-design-canvas-rename-input').fill(label);
      await tid('ide-design-canvas-rename-input').press('Enter');
    };
    const run = async () => {
      const before = (await state()).run?.runId;
      await tid('ide-vcb-run').click();
      await page.waitForFunction(id => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId !== id, before);
      return (await state()).run;
    };
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await tid('ide-project-build-fresh-primary').click();
      await tid('mode-button-design').click();
      assert.equal(await tid('ide-design-view-canvas').getAttribute('aria-pressed'), 'true');
      await tid('ide-design-zoom-readout').click();
      const a = await place('INPUT', 120, 80);
      await page.screenshot({ path: path.join(out, `${kind}-first-input-1280x650.png`) });
      const b = await place('INPUT', 120, 270);
      const gate = await place(kind === 'register' ? 'Register1' : 'AND', 420, 180);
      const output = await place('OUTPUT', 760, 180);
      await page.keyboard.press('Escape');
      await tid('ide-design-fit-circuit-canvas').click();
      const port = tid(`port-${a}-out`);
      const before = await port.boundingBox();
      const toolbarBefore = await tid('ide-design-toolbar').boundingBox();
      await tid('ide-design-tool-wire').click();
      const after = await port.boundingBox();
      const toolbarAfter = await tid('ide-design-toolbar').boundingBox();
      // What to do next is said in full, in the announced status line. Beside the commands (rc.6) it
      // had 13px of this window.
      const readCue = () => page.evaluate(() => {
        const cue = document.querySelector('[data-testid="ide-design-wire-cue"]');
        return cue && { text: cue.textContent.trim(), width: cue.clientWidth, needsWidth: cue.scrollWidth, height: cue.clientHeight, needsHeight: cue.scrollHeight, announced: Boolean(cue.closest('[role="status"]')) };
      });
      // Sizes are whole pixels of fractional boxes: one pixel of rounding is not a clipped line.
      const readable = (cue) => cue && cue.text.length > 0 && cue.width > 0 && cue.needsWidth <= cue.width + 1 && cue.needsHeight <= cue.height + 1;
      const barHeight = async () => (await tid('ide-status-bar').boundingBox()).height;
      const guidance = await readCue();
      const idleBar = await barHeight();
      assert.ok(guidance?.announced, `Wire guidance must be in the announced status line: ${JSON.stringify(guidance)}`);
      assert.ok(readable(guidance), `Wire guidance must be readable in full at 1280x650: ${JSON.stringify(guidance)}`);
      // The longest message the Wire tool has: an output clicked as the target of an output.
      await tid(`port-${a}-out`).click();
      await tid('ide-design-wire-cancel').waitFor();
      await tid(`port-${b}-out`).click();
      await tid('ide-design-wire-feedback').waitFor();
      const refusal = await readCue();
      assert.match(refusal.text, /Outputs cannot be wired directly/);
      assert.ok(readable(refusal), `A refusal must be readable in full at 1280x650: ${JSON.stringify(refusal)}`);
      // Two lines fit the status line's own height: a long message never moves the workspace.
      assert.ok(Math.abs(await barHeight() - idleBar) < 0.5, `The status line keeps its height for a refusal (${idleBar} -> ${await barHeight()})`);
      await tid('ide-design-wire-cancel').click(); // ends the wire and Wire mode
      await page.waitForFunction(() => !document.querySelector('[data-testid="ide-design-wire-cuebar"]'));
      await tid('ide-design-tool-wire').click();
      await tid('ide-design-wire-cuebar').waitFor();
      await wire(a, 'out', gate, kind === 'register' ? 'D' : 'a');
      await wire(b, 'out', gate, kind === 'register' ? 'CLK' : 'b');
      await wire(gate, kind === 'register' ? 'Q' : 'out', output, 'in');
      assert.equal((await state()).circuit.connections.length, 3);
      await page.keyboard.press('Escape');
      assert.equal(await tid('ide-design-tool-select').getAttribute('aria-pressed'), 'true');
      await select(gate);
      await page.keyboard.press('Delete');
      await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().circuit.nodes.length === 3);
      await tid('ide-design-tool-undo').click();
      assert.equal((await state()).circuit.nodes.length, 4);
      assert.equal((await state()).circuit.connections.length, 3);
      await tid('ide-design-tool-redo').click();
      assert.equal((await state()).circuit.nodes.length, 3);
      await tid('ide-design-tool-undo').click();
      assert.equal((await state()).circuit.connections.length, 3);
      await rename(a, kind === 'register' ? 'D' : 'A');
      await rename(b, kind === 'register' ? 'CLK' : 'B');
      await rename(output, kind === 'register' ? 'Q' : 'Y');
      if (kind === 'register') {
        if (await tid('ide-show-right-dock').count()) await tid('ide-show-right-dock').click();
        await select(gate);
        await tid('ide-design-right-tab-properties').click();
        await tid('ide-design-register-has-enable').uncheck(); // This D/CLK/Q circuit has no enable input.
        await tid('ide-design-right-tab-inspector').click();
      }
      await tid('ide-design-explore').click();
      const body = tid(`switch-toggle-${a}`);
      for (const expected of [1, 0, 1]) {
        await body.click();
        await page.waitForFunction(({ id, expected }) => window.__RB_PROJECT_RUNTIME__.getState().sim.inputs[id] === expected, { id: a, expected });
      }
      await tid('ide-design-live-reset').click();
      assert.equal((await state()).sim.inputs[a], 0, 'Reset after repeated canvas-body toggles restores the authored LOW default');
      assert.equal((await state()).circuit.nodes.find(node => node.id === a).state?.isOn ?? 0, 0, 'Exploration retains the authored input default');
      await body.click();
      if (await tid('ide-show-right-dock').count()) await tid('ide-show-right-dock').click();
      assert.equal(await tid('ide-design-inspector-input-toggle').getAttribute('aria-pressed'), 'true');
      await tid('ide-design-inspector-input-toggle').click();
      assert.equal((await state()).sim.inputs[a], 0, 'Inspector and canvas share the same live value');
      await tid('ide-design-inspector-input-toggle').click();
      if (kind === 'register') await tid('ide-design-live-step').click();
      else {
        await tid(`switch-toggle-${b}`).click();
      }
      assert.equal(Number((await state()).sim.signals[`${output}.in`]), 1, 'Exploratory inputs/clock produce the expected high output');
      assert.match(await tid('ide-design-learning-mode').innerText(), /Finish exploring/);
      await tid('ide-design-live-reset').click();
      assert.equal(Number((await state()).sim.signals[`${output}.in`]), 0, 'Reset restores the exploratory output');
      await tid('ide-design-explore').click();
      await tid('ide-design-test-design').click();
      if (kind === 'combinational') await tid('ide-case-lab-generate').click();
      const observed = await run();
      assert.ok(observed.waveform.length > 0);
      if (kind === 'combinational') {
        await tid('ide-verify-view-table').click();
        const expectation = page.locator('[data-testid^="ide-case-lab-exp-0-"]').first();
        await expectation.click(); // Blank → expected 1; AND at 00 actually records 0.
        const failed = await run();
        assert.equal(failed.status, 'fail');
        // Edit in Design opens the live design to change it (64bf7aa93); the recorded failure is
        // investigated in Simulate (causal-capture and recorded-investigation journeys).
        const failedSignals = [...new Set(failed.report.rows.filter((row) => (row.expected === '0' || row.expected === '1') && row.actual !== row.expected).map((row) => row.signal))];
        assert.ok(failedSignals.length > 0, 'the failed run names the failing output');
        await tid('ide-verify-fail-focus-trace').click();
        await tid('ide-design-toolbar').waitFor();
        // The design itself, editable, with the failed output named as the place to start.
        assert.equal(await tid('ide-root').getAttribute('data-ide-stage'), 'design');
        assert.equal(await tid('ide-design-current-design').count(), 0, 'Edit in Design edits the current design, not a recorded view');
        assert.equal(await tid('ide-design-tool-wire').isEnabled(), true, 'the editing tools are live');
        const focus = await tid('ide-design-verify-focus').innerText();
        // The focus names the output as the student sees it, by its label (11f30d4: "Inspect Y
        // first" for the report's signal y), so the name is matched as a word, ignoring case.
        const namesSignal = (signal) => new RegExp(`(^|[^A-Za-z0-9_])${signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z0-9_])`, 'i').test(focus);
        assert.ok(failedSignals.some(namesSignal), `Edit in Design points at the failed output (${failedSignals.join(', ')}): "${focus}"`);
        assert.equal(await page.locator('.ide-design-canvasWrap [data-testid="ide-design-debug-context-banner"]').count(), 0);
        await page.screenshot({ path: path.join(out, 'failure-edit-design-1280x650.png') });
        await tid('ide-design-test-design').click();
        await tid('ide-verify-view-table').click();
        await expectation.click(); // 1 → 0 repairs the deliberately incorrect check.
        const repaired = await run();
        assert.equal(repaired.status, 'pass');
      }
      assert.deepEqual(errors, []);
      const geometry = { portBefore: before, portAfter: after, toolbarBefore, toolbarAfter };
      results.push({ kind, paletteVisibility, geometry, nodes: (await state()).circuit.nodes.length, observedRun: observed.runId, errors });
      assert.ok(paletteVisibility.every(entry => entry.visible), 'Placing a component must leave the library available for continued construction');
      assert.ok(Math.abs(before.y - after.y) <= 1, 'Entering Wire must not move the port vertically');
      assert.ok(Math.abs(toolbarBefore.height - toolbarAfter.height) <= 1, 'Wire toolbar keeps its height');
    } catch (error) {
      fs.writeFileSync(path.join(out, `${kind}-failure-state.json`), JSON.stringify(await state(), null, 2));
      await page.screenshot({ path: path.join(out, `${kind}-failure-1280x650.png`) });
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));
  await browser.close();
}
console.log(`PASS blank core authoring: ${out}`);
