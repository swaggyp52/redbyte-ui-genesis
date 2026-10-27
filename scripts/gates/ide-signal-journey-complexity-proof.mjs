#!/usr/bin/env node

// Imported, explicitly labeled scale fixtures qualify bounds; they are not first-use proof.
// All project mutations use file import or visible controls. Runtime reads are evidence only.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { assert, clickVerifyRun, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const OUT = path.resolve(process.env.RB_COMPLEXITY_OUT ?? '.redbyte/signal-journey-comprehension/complexity');
const LABEL = process.env.RB_COMPLEXITY_LABEL ?? 'candidate';
const VIEWPORT = { width: 1440, height: 900 };
const MAX_GAP_MS = 2000;
const MAX_ACTION_MS = 5000;
const FIXED_ISO = '2026-10-07T00:00:00.000Z';
const ONLY = new Set((process.env.RB_COMPLEXITY_CASES ?? 'hierarchy,fanout,limit').split(','));
assert(process.version === 'v20.19.0', `Use pinned Node 20.19.0, got ${process.version}`);
assert(process.env.RB_GATE_BASE_URL, 'Set RB_GATE_BASE_URL to the actual candidate server');
await mkdir(OUT, { recursive: true });

await runIdeGate('Signal Journey complexity and bounded capture through imported fixtures', async ({ page, baseUrl }) => {
  const receipt = {
    label: LABEL, baseUrl, node: process.version, startedAt: new Date().toISOString(), viewport: VIEWPORT,
    scriptSha256: hash(await readFile(new URL(import.meta.url), 'utf8')),
    host: { platform: os.platform(), arch: os.arch(), cpus: os.cpus().length, cpu: os.cpus()[0]?.model },
    bounds: { heartbeatIntervalMs: 50, maximumObservedGapMs: MAX_GAP_MS, ordinaryActionMs: MAX_ACTION_MS,
      basis: 'Generous boundedness thresholds retained for comparison. Whole Import and Run measured; active computation/cancellation measured separately.' },
    cases: [], errors: [], evidenceLimits: [
      'Synthetic imported projects exercise scale, not ordinary circuit authoring or student discoverability.',
      'Heartbeat measures main-thread availability; it does not prove memory ceilings or browser-process CPU utilization.',
      'Playback Pause and real worker Run cancellation are separate checks. Local repeated timings are host/fixture measurements.',
      'No engine or scheduler implementation is changed by this gate. Engine-v2 identity and fixture arithmetic are asserted; focused engine regressions remain separate.'
    ]
  };
  page.on('pageerror', error => receipt.errors.push({ kind: 'pageerror', text: String(error) }));
  page.on('console', message => { if (message.type() === 'error') receipt.errors.push({ kind: 'console', text: message.text() }); });
  page.on('dialog', dialog => dialog.accept().catch(() => null));
  await page.addInitScript(() => {
    try { localStorage.setItem('rb-onboarding-v1-seen', '1'); } catch {}
    const clock = { gaps: [], longTasks: [], previous: performance.now() };
    window.__RB_COMPLEXITY_MEASUREMENT__ = clock;
    setInterval(() => {
      const now = performance.now();
      clock.gaps.push({ at: now, duration: now - clock.previous });
      if (clock.gaps.length > 30000) clock.gaps.shift();
      clock.previous = now;
    }, 50);
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) clock.longTasks.push({ at: entry.startTime, duration: entry.duration });
        if (clock.longTasks.length > 30000) clock.longTasks.splice(0, clock.longTasks.length - 30000);
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });
  await page.setViewportSize(VIEWPORT);
  let stage = 'load existing hierarchical fixture';
  try {
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=signal-journey-complexity`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ide-mode-project').waitFor({ state: 'visible', timeout: 20000 });
    let hierarchical;
    if (ONLY.has('hierarchy')) {
      await loadStarterProject(page, { exactExampleId: 'four-bit-adder-hierarchical' });
      const existing = await page.evaluate(() => {
        const runtime = window.__RB_PROJECT_RUNTIME__.getState();
        return { circuit: runtime.circuit, hierarchy: runtime.hierarchy, rows: runtime.projectIoRows, vectors: runtime.scenarios.find(s => s.id === runtime.activeScenarioId)?.vectors };
      });
      assert(existing.hierarchy?.modules.length > 0, 'Existing starter must supply its real reusable hierarchy');
      hierarchical = project('Stress qualification: existing hierarchical 4-bit adder', existing.circuit, existing.rows, existing.vectors, existing.hierarchy);
    }
    const fixtures = [
      ONLY.has('hierarchy') && { id: 'hierarchy', project: hierarchical, output: 'sum3', expectedCapture: 'complete', hierarchy: true },
      ONLY.has('fanout') && { id: 'fanout', project: fanoutProject(), output: 'out', expectedCapture: 'complete', largeDrawing: true, longSource: true },
      ONLY.has('limit') && { id: 'limit', project: limitProject(), output: 'out', expectedCapture: 'truncated', longTable: true }
    ].filter(Boolean);
    for (const fixture of fixtures) {
      const record = { id: fixture.id, name: fixture.project.name, actions: [], screenshots: [], checks: [], status: 'running' };
      receipt.cases.push(record);
      stage = `${fixture.id}: import`;
      const fixtureFile = path.join(OUT, `${fixture.id}.rbproj.json`);
      await writeFile(fixtureFile, JSON.stringify(fixture.project, null, 2));
      record.fixture = { path: fixtureFile, sha256: hash(JSON.stringify(fixture.project)), nodes: fixture.project.circuit.nodes.length,
        wires: fixture.project.circuit.connections.length, cases: fixture.project.vectors.length, moduleDefinitions: fixture.project.hierarchy?.modules.length ?? 0 };
      await action(page, record, 'import actual fixture file', async () => {
        await page.getByTestId('ide-project-file-input').setInputFiles(fixtureFile);
        await page.waitForFunction(name => window.__RB_PROJECT_RUNTIME__?.getState().projectName === name, fixture.project.name, { timeout: 30000 });
        await page.getByTestId('ide-mode-project').waitFor({ state: 'visible' });
      }, false);
      await workspace(page, 'verify');
      await page.getByRole('checkbox', { name: 'Evaluation steps', exact: true }).check();
      const previous = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId ?? null);
      stage = `${fixture.id}: actual Run and capture`;
      await action(page, record, 'Run actual fixture with evaluation capture', async () => {
        await clickVerifyRun(page);
        await page.waitForFunction(previousId => {
          const run = window.__RB_PROJECT_RUNTIME__?.getState().verifyLastRun;
          return run?.runId && run.runId !== previousId;
        }, previous, { timeout: 45000 });
        await page.getByTestId('ide-run-identity').waitFor({ state: 'visible' });
        await page.waitForFunction(() => Number.isFinite(window.__RB_PROJECT_RUNTIME__.getState().verificationExecution.timings?.visibleOpportunityMs));
      }, false);
      record.executionTimings = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verificationExecution.timings);
      if (fixture.id === 'limit') {
        record.cancellations = [];
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const completedBefore = await page.evaluate(() => { const s=window.__RB_PROJECT_RUNTIME__.getState(); return JSON.stringify({last:s.verifyLastRun,archive:s.verifyRunArchive,history:s.verifyRunHistory,health:s.projectHealthCore,authority:s.scenarioAuthority}); });
          const submit = performance.now();
          await clickVerifyRun(page);
          await page.getByTestId('ide-verify-cancel-execution').waitFor({state:'visible'});
          const busyVisibleMs = performance.now()-submit;
          await page.waitForFunction(() => { const job=window.__RB_PROJECT_RUNTIME__.getState().verificationExecution; return job.status==='computing' && job.completedCases >= 1 && job.completedCases < 512; });
          const during = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verificationExecution);
          // A real keyboard interaction while the engine is evaluating later cases.
          await page.getByTestId('ide-verify-cancel-execution').focus();
          assert(await page.getByTestId('ide-verify-cancel-execution').evaluate(element => element === document.activeElement), 'Keyboard focus must respond during active computation');
          const cancelAt=performance.now();
          await page.keyboard.press('Enter');
          await page.waitForFunction(() => window.__RB_PROJECT_RUNTIME__.getState().verificationExecution.status==='cancelled');
          await page.getByTestId('ide-verify-execution-status').waitFor({state:'visible'});
          const cancelledVisibleMs=performance.now()-cancelAt;
          const completedAfter = await page.evaluate(() => { const s=window.__RB_PROJECT_RUNTIME__.getState(); return JSON.stringify({last:s.verifyLastRun,archive:s.verifyRunArchive,history:s.verifyRunHistory,health:s.projectHealthCore,authority:s.scenarioAuthority}); });
          assert(completedAfter===completedBefore,'Cancel must preserve the last completed recording and all proof authority');
          record.cancellations.push({attempt,busyVisibleMs,cancelledVisibleMs,wholeCancelledActionMs:performance.now()-submit,actualCompletedCasesBeforeCancel:during.completedCases,requestId:during.requestId});
        }
        await page.screenshot({path:path.join(OUT,'limit-real-run-cancelled-1440x900.png')});
        const oldId=await page.evaluate(()=>window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun.runId);
        await action(page,record,'Successful Run after three actual cancellations',async()=>{await clickVerifyRun(page);await page.waitForFunction(id=>window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId!==id,oldId);await page.waitForFunction(()=>Number.isFinite(window.__RB_PROJECT_RUNTIME__.getState().verificationExecution.timings?.visibleOpportunityMs));},false);
        record.recoveredExecutionTimings=await page.evaluate(()=>window.__RB_PROJECT_RUNTIME__.getState().verificationExecution.timings);
      }
      const run = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun);
      assert(run?.runId, 'Run must produce a real retained recording');
      // RB-DEBT-014 bumped the engine to v3 (node-order-independent feedback schedule).
      assert(run.identity?.engine === 'redbyte-browser-v3', `Stress qualification must retain engine-v3, got ${run.identity?.engine}`);
      assert(run.report.rows.length > 0 && run.report.rows.every(row => [0, 1, '0', '1'].includes(row.expected) && [0, 1, '0', '1'].includes(row.actual) && String(row.expected) === String(row.actual)), 'Every authored stress-fixture check must match a known actual engine result');
      assert(run.waveform.length === fixture.project.vectors.length, 'Capture truncation must preserve every published sample');
      const trace = run.evaluationTrace;
      assert(trace && trace.status === fixture.expectedCapture, `${fixture.id} needs ${fixture.expectedCapture} capture, got ${trace?.status}`);
      assert(trace.maxEvents === 10000 && trace.maxBytes === 4 * 1024 * 1024, 'Actual Run must expose the configured 10k-event / 4MiB bounds');
      assert(trace.events.length <= trace.maxEvents && trace.bytes <= trace.maxBytes, 'Retained capture must stay inside both configured bounds');
      if (fixture.expectedCapture === 'truncated') {
        const largestEvent = Math.max(...trace.events.map(event => Buffer.byteLength(JSON.stringify(event))));
        assert(trace.events.length === trace.maxEvents || trace.maxBytes - trace.bytes <= largestEvent * 2, 'Truncation must arise at an actual event/byte bound, not from a small unexplained trace');
        assert(trace.events.length >= 2000, 'Limit fixture must retain a substantial real trace');
        record.bindingLimit = trace.events.length === trace.maxEvents ? 'event count' : 'serialized bytes';
      }
      record.recording = { runId: run.runId, engine: run.identity.engine, nodes: run.circuitSnapshot.nodes.length, samples: run.waveform.length,
        authoredChecks: run.report.rows.length, capture: { status: trace.status, events: trace.events.length, bytes: trace.bytes, maxEvents: trace.maxEvents, maxBytes: trace.maxBytes },
        sourceFiles: run.generatedSource?.files.map(file => ({ path: file.path, lines: file.text.split('\n').length, bytes: Buffer.byteLength(file.text) })) };
      await writeFile(path.join(OUT, `${fixture.id}-recording.json`), JSON.stringify(run, null, 2));
      const retainedBefore = await archivedJson(page, run.runId);
      stage = `${fixture.id}: follow and render`;
      const outputRow = run.executionInput.ioRows.find(row => row.nodeId === fixture.output);
      assert(outputRow, `Fixture output ${fixture.output} must exist in the retained boundary mapping`);
      const observed = page.getByTestId(`ide-case-lab-obs-0-${outputRow.id}`);
      await observed.waitFor({ state: 'visible' });
      await observed.click();
      await action(page, record, 'Follow exact output and render Journey', async () => {
        await page.getByTestId('ide-follow-signal').click();
        await page.getByTestId('ide-signal-journey').waitFor({ state: 'visible' });
      });
      const journey = page.getByTestId('ide-signal-journey');
      assert(await journey.getAttribute('data-run-id') === run.runId && await journey.getAttribute('data-tick') === '0', 'Follow must bind the imported fixture recording and exact first case');
      assert(await journey.getAttribute('data-node-id') === fixture.output, 'Follow must bind the exact output identity');
      if (fixture.expectedCapture === 'truncated') {
        assert(/truncat|capture limit/i.test(await journey.innerText()), 'Actual truncated recording must expose a readable capture-limit status');
        record.checks.push('Actual truncated capture status visible; all published samples remain retained');
      }
      await shot(page, record, `${fixture.id}-01-follow`);
      stage = `${fixture.id}: playback cancellation`;
      await action(page, record, 'Play and cancel with Pause', async () => {
        await journey.getByRole('button', { name: 'Play evaluations', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="ide-signal-journey"]')?.getAttribute('data-event') !== 'sample');
        await journey.getByRole('button', { name: 'Pause', exact: true }).click();
      });
      const paused = await journey.getAttribute('data-event');
      await page.waitForTimeout(900);
      assert(await journey.getAttribute('data-event') === paused, 'Pause must cancel subsequent playback updates');
      await action(page, record, 'Step exact next evaluation', async () => {
        const previousEvent = await journey.getAttribute('data-event');
        await journey.getByRole('button', { name: 'Next evaluation', exact: true }).click();
        assert(await journey.getAttribute('data-event') !== previousEvent, 'Next evaluation must change captured phase');
      });
      if (fixture.hierarchy) {
        const retainedInstances = [...new Set(Object.values(run.elaborationSources).filter(source => source.instancePath.length).map(source => JSON.stringify(source.instancePath)))];
        assert(retainedInstances.length >= 4, 'Existing adder must keep all four repeated instances');
        const scope = journey.getByRole('combobox', { name: 'Instance', exact: true });
        await action(page, record, 'Enter a repeated module instance', () => scope.selectOption(retainedInstances[2]));
        assert(await journey.locator('[data-projection-node]').count() > 0, 'A local repeated-instance drawing must remain available');
      }
      if (fixture.largeDrawing) {
        stage = `${fixture.id}: bounded whole-circuit fallback and recovery`;
        const scope = journey.getByRole('combobox', { name: 'Instance', exact: true });
        await action(page, record, 'Request whole circuit beyond drawing bound', () => scope.selectOption('whole'));
        const overviewNodes = await journey.locator('[data-projection-node]').count();
        assert(overviewNodes <= 256, 'Large overview must not render an unbounded schematic');
        assert(/limit|bounded|smaller|focus|large/i.test(await journey.locator('.rb-journey-sheet').innerText()), 'Large overview must explain its bounded fallback');
        await shot(page, record, `${fixture.id}-02-bounded-overview`);
        const focus = journey.getByRole('button', { name: 'Focus selected connection', exact: true }).first();
        assert(await focus.isVisible(), 'Oversized drawing fallback must expose a usable local-focus recovery control');
        await action(page, record, 'Recover selected local focus', () => focus.click());
        const focusNodes = await journey.locator('[data-projection-node]').count();
        assert(focusNodes > 0 && focusNodes <= 256, 'Oversized flat circuit must still provide a bounded local focus drawing');
        const selectedNode = await journey.getAttribute('data-node-id');
        assert(await journey.locator(`[data-projection-node="${selectedNode}"]`).isVisible(), 'Recovered local drawing must include the selected object');
        await shot(page, record, `${fixture.id}-02a-recovered-local-focus`);
        const firstWire = journey.locator('[data-projection-wire]').first();
        const wireId = await firstWire.getAttribute('data-projection-wire');
        const actualWire = run.circuitSnapshot.connections.find(wire => `${wire.from.nodeId}.${wire.from.portName}-${wire.to.nodeId}.${wire.to.portName}` === wireId);
        assert(actualWire, 'Visible local connection must resolve to an exact retained canonical connection');
        const eventBefore = await journey.getAttribute('data-event');
        await action(page, record, 'Inspect exact local connection with keyboard', () => firstWire.press('Enter'));
        const inspected = await inspectedEndpoint(journey);
        assert((inspected.nodeId === actualWire.to.nodeId && inspected.port === actualWire.to.portName)
          || (inspected.nodeId === actualWire.from.nodeId && inspected.port === actualWire.from.portName),
        'Local connection selection must commit an exact endpoint of the rendered retained connection');
        assert(await journey.getAttribute('data-event') === eventBefore, 'Inspecting a local connection must retain the paused evaluation phase');
        if (fixture.id === 'fanout') {
          if (inspected.nodeId !== 'a') {
            await action(page, record, 'Follow actual high fan-out driver', () => journey.getByRole('button', { name: 'a · out', exact: true }).click());
          }
          assert(await journey.getAttribute('data-node-id') === 'a', 'High fan-out paging proof must commit the actual shared source');
          assert(await journey.locator('.rb-journey-focus-note').isVisible(), 'Following a driver must retain the active local focus');
          const highFanoutNodes = await journey.locator('[data-projection-node]').count();
          assert(highFanoutNodes > 0 && highFanoutNodes <= 4, 'High fan-out local drawing must remain within the readable four-node focus bound');
          record.localFocusSmallestLabelPx = await journey.locator('[data-projection-node] text').evaluateAll(elements => Math.min(...elements.map(element => {
            const matrix = element.getScreenCTM();
            return matrix ? parseFloat(getComputedStyle(element).fontSize) * Math.hypot(matrix.a, matrix.b) : 0;
          })));
          assert(record.localFocusSmallestLabelPx >= 10, 'Recovered fan-out focus must keep actual rendered labels at least 10px at Fit');
          assert(await journey.locator('.rb-journey-connections > button').count() <= 24, 'High fan-out loads must render at most 24 destination controls');
          const before = await journey.locator('.rb-journey-connections').innerText();
          await action(page, record, 'Page high fan-out destinations', () => journey.getByRole('button', { name: 'Next loads', exact: true }).click());
          assert(await journey.locator('.rb-journey-connections').innerText() !== before, 'Next loads must present another destination set');
          assert(await journey.locator('.rb-journey-connections > button').count() <= 24, 'Subsequent load page must remain bounded');
          assert(await journey.getAttribute('data-node-id') === 'a' && await journey.getAttribute('data-event') === eventBefore, 'Load paging must not change the committed object or paused phase');
          await shot(page, record, `${fixture.id}-02b-paged-fanout-focus`);
          record.checks.push(`High fan-out focus bounded to ${highFanoutNodes} nodes; 24-load pages remain responsive`);
        }
        record.checks.push(`Whole circuit fallback and recoverable focus (${focusNodes} rendered objects)`);
      }
      stage = `${fixture.id}: connected representations`;
      await action(page, record, 'Inspect Logic representation', () => journey.getByRole('button', { name: 'Logic', exact: true }).click());
      record.expressionButtons = await journey.locator('[data-journey-term]').count();
      assert(record.expressionButtons <= 100, 'Bounded expression must not expand into an unbounded button tree');
      await action(page, record, 'Open Generated HDL', () => journey.getByRole('button', { name: 'Generated HDL', exact: true }).click());
      await journey.getByTestId('ide-journey-mapped-source').waitFor({ state: 'visible' });
      record.renderedSourceLines = await journey.locator('.rb-journey-source pre > span').count();
      const sourcePages = journey.getByRole('navigation', { name: 'Generated source pages', exact: true });
      if (fixture.longSource) {
        assert(await sourcePages.isVisible(), 'Long generated source must expose bounded page navigation');
        assert(record.renderedSourceLines <= 120, 'Generated source must render at most 120 lines per page');
      }
      const sourceNext = journey.getByTestId('ide-journey-source-next');
      if (await sourceNext.count() && !await sourceNext.isDisabled()) {
        const before = await sourcePages.innerText();
        await action(page, record, 'Page longer generated source', () => sourceNext.click());
        assert(await sourcePages.innerText() !== before, 'Next source page must visibly change the presented line range');
        assert(await journey.locator('.rb-journey-source pre > span').count() <= 120, 'Subsequent source page must remain bounded');
        record.checks.push('Generated source pagination exercised');
      }
      const sourceObjects = journey.locator('.rb-journey-source pre button[aria-label^="Select source object"]');
      if (await sourceObjects.count()) {
        const before = await journey.getAttribute('data-event');
        await action(page, record, 'Reverse select a mapped source object', () => sourceObjects.last().click());
        assert(await journey.getAttribute('data-event') === before, 'Source reverse selection must preserve the paused evaluation phase');
      }
      await shot(page, record, `${fixture.id}-03-source`);
      await action(page, record, 'Open published Case table', () => journey.getByRole('button', { name: 'Case table', exact: true }).click());
      record.renderedCaseRows = await journey.locator('.rb-journey-table tbody tr').count();
      const casePages = journey.getByRole('navigation', { name: 'Recorded cases pages', exact: true });
      if (fixture.longTable) {
        assert(await casePages.isVisible(), 'Long retained case table must expose bounded page navigation');
        assert(record.renderedCaseRows <= 50, 'Published cases must render at most 50 rows per page');
      }
      const tableNext = journey.getByTestId('ide-journey-cases-next');
      if (await tableNext.count() && !await tableNext.isDisabled()) {
        const before = await casePages.innerText();
        await action(page, record, 'Page longer published case table', () => tableNext.click());
        assert(await casePages.innerText() !== before, 'Next case page must visibly change the presented moment range');
        assert(await journey.locator('.rb-journey-table tbody tr').count() <= 50, 'Subsequent case page must remain bounded');
        record.checks.push('Published case pagination exercised');
      }
      const caseButtons = journey.locator('.rb-journey-table tbody tr td:first-child button');
      if (await caseButtons.count()) {
        await action(page, record, 'Select a later visible published case', () => caseButtons.last().click());
        assert(await journey.getAttribute('data-event') === 'sample', 'Case selection must explicitly return to a published sample');
      }
      if (fixture.longTable) {
        const moment = journey.getByRole('combobox', { name: 'Moment', exact: true });
        await action(page, record, 'Select final retained moment after truncated capture', () => moment.selectOption(String(run.waveform.at(-1).tick)));
        assert(await journey.getAttribute('data-tick') === String(run.waveform.at(-1).tick), 'Truncated capture must retain navigable final published sample');
        record.checks.push('Final published sample remains selectable after actual capture truncation');
      }
      await shot(page, record, `${fixture.id}-04-cases`);
      await journey.getByRole('combobox', { name: 'Moment', exact: true }).selectOption('0');
      await journey.getByRole('button', { name: 'Circuit', exact: true }).click();
      stage = `${fixture.id}: Return cancellation and same-phase Resume`;
      await journey.getByRole('button', { name: 'Play evaluations', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid="ide-signal-journey"]')?.getAttribute('data-event') !== 'sample');
      let closedSelection;
      await action(page, record, 'Return while playing cancels playback', async () => {
        closedSelection = { eventOrder: await journey.getAttribute('data-event'), nodeId: await journey.getAttribute('data-node-id'), tick: await journey.getAttribute('data-tick') };
        await journey.getByTestId('ide-journey-return').click();
      });
      await page.getByTestId('ide-mode-verify').waitFor({ state: 'visible' });
      await page.waitForTimeout(900);
      await action(page, record, 'Resume retained signal at same phase', async () => {
        await page.getByRole('button', { name: 'Resume signal', exact: true }).click();
        await journey.waitFor({ state: 'visible' });
      });
      assert(await journey.getAttribute('data-event') === String(closedSelection.eventOrder), 'Unmount must cancel the interval; Resume must preserve exact event order after waiting');
      assert(await journey.getAttribute('data-node-id') === closedSelection.nodeId && await journey.getAttribute('data-run-id') === run.runId, 'Resume must preserve object and recording');
      if (fixture.largeDrawing || fixture.longTable) {
        record.viewportChecks = [];
        for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 650 }]) {
          await page.setViewportSize(viewport);
          await action(page, record, `Reach representations at ${viewport.width}x${viewport.height}`, async () => {
            await journey.getByRole('button', { name: 'Case table', exact: true }).click();
            await journey.getByRole('button', { name: 'Generated HDL', exact: true }).click();
            await journey.getByRole('button', { name: 'Circuit', exact: true }).click();
          });
          const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
          assert(geometry.scrollWidth <= viewport.width + 2, `Stress inspection must fit root width at ${viewport.width}x${viewport.height}`);
          const eventOrder = await journey.getAttribute('data-event');
          assert(eventOrder === String(closedSelection.eventOrder), 'Resize and lens navigation must retain the paused phase');
          record.viewportChecks.push({ ...viewport, ...geometry, eventOrder });
          const file = path.join(OUT, `${fixture.id}-05-resumed-${viewport.width}x${viewport.height}.png`);
          await page.screenshot({ path: file }); record.screenshots.push(file);
        }
        await page.setViewportSize(VIEWPORT);
      }
      await journey.getByTestId('ide-journey-return').click();
      assert(await archivedJson(page, run.runId) === retainedBefore, 'Every scale inspection must leave retained recording byte-for-byte unchanged');
      record.checks.push('Pause and unmount cancellation; exact-phase Resume; retained recording immutable');
      record.geometry = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth }));
      assert(record.geometry.scrollWidth <= VIEWPORT.width + 2, 'Stress inspection must not cause root horizontal overflow');
      record.status = 'pass';
    }
    assert(receipt.errors.length === 0, `Browser errors: ${JSON.stringify(receipt.errors.slice(0, 8))}`);
    receipt.status = 'pass';
  } catch (error) {
    receipt.status = 'fail';
    receipt.failure = { stage, error: error instanceof Error ? error.message : String(error) };
    const current = receipt.cases.at(-1);
    if (current) current.status = 'fail';
    await page.screenshot({ path: path.join(OUT, 'failure-1440x900.png') }).catch(() => null);
    await writeFile(path.join(OUT, 'failure-dom.txt'), await page.locator('body').innerText().catch(() => 'unavailable'));
    throw error;
  } finally {
    receipt.finishedAt = new Date().toISOString();
    receipt.instrumentation = await measurement(page, 0).catch(() => null);
    await writeFile(path.join(OUT, 'complexity-proof.json'), JSON.stringify(receipt, null, 2));
  }
});

function hash(text) { return createHash('sha256').update(text).digest('hex'); }
function project(name, circuit, rows, vectors, hierarchy) {
  return { kind: 'rb-project', version: 1, name, description: 'Labeled browser stress fixture; not ordinary authoring evidence.',
    createdAt: FIXED_ISO, updatedAt: FIXED_ISO, circuit, hierarchy, fpga: { board: 'basys3', part: 'xc7a35tcpg236-1' },
    ioMapping: { inputs: rows.filter(row => row.direction === 'in'), outputs: rows.filter(row => row.direction === 'out') },
    vectors, meta: { tags: ['signal-journey', 'stress-fixture'], appSurface: 'ide', projectKind: 'import' } };
}
function node(id, type, x, y) { return { id, type, label: id, position: { x, y }, config: {}, state: {} }; }
function wire(id, from, to, port) { return { id, from: { nodeId: from, portName: 'out' }, to: { nodeId: to, portName: port } }; }
function row(id, direction, pin) { return { id, nodeId: id, port: direction === 'in' ? 'out' : 'in', label: id, direction, pin, required: true }; }
function fanoutProject() {
  const nodes = [node('a', 'INPUT', 0, 0)], connections = [];
  let previous = [];
  for (let i = 0; i < 160; i++) {
    const id = `branch_${String(i).padStart(3, '0')}`;
    nodes.push(node(id, 'NOT', 200, i * 52)); connections.push(wire(`fan_${i}`, 'a', id, 'in')); previous.push(id);
  }
  let level = 0;
  while (previous.length > 1) {
    const next = [];
    for (let i = 0; i < previous.length; i += 2) {
      if (!previous[i + 1]) { next.push(previous[i]); continue; }
      const id = `merge_${level}_${i / 2}`;
      nodes.push(node(id, 'OR', 400 + level * 180, i * 52));
      connections.push(wire(`${id}_a`, previous[i], id, 'a'), wire(`${id}_b`, previous[i + 1], id, 'b')); next.push(id);
    }
    previous = next; level++;
  }
  nodes.push(node('out', 'OUTPUT', 400 + level * 180, 0)); connections.push(wire('output', previous[0], 'out', 'in'));
  return project('Synthetic stress: 160-way fan-out and balanced reconvergence', { nodes, connections }, [row('a', 'in', 'V17'), row('out', 'out', 'U16')],
    Array.from({ length: 4 }, (_, tick) => ({ tick, inputs: { a: tick % 2 }, expected: { out: 1 - tick % 2 } })));
}
function limitProject() {
  const nodes = [node('a', 'INPUT', 0, 0)], connections = [];
  let previous = 'a';
  for (let i = 0; i < 24; i++) {
    const id = `stage_${String(i).padStart(2, '0')}`;
    nodes.push(node(id, 'NOT', 160 + i * 100, 0)); connections.push(wire(`chain_${i}`, previous, id, 'in')); previous = id;
  }
  nodes.push(node('out', 'OUTPUT', 2720, 0)); connections.push(wire('output', previous, 'out', 'in'));
  return project('Synthetic stress: 512 cases reaching actual observation limit', { nodes, connections }, [row('a', 'in', 'V17'), row('out', 'out', 'U16')],
    Array.from({ length: 512 }, (_, tick) => ({ tick, inputs: { a: tick % 2 }, expected: { out: tick % 2 } })));
}
async function workspace(page, mode) {
  const rail = page.getByTestId(`mode-button-${mode}`);
  await rail.click(); await page.getByTestId(`ide-mode-${mode}`).waitFor({ state: 'visible' });
}
async function archivedJson(page, runId) {
  return page.evaluate(id => JSON.stringify(window.__RB_PROJECT_RUNTIME__.getState().verifyRunArchive.find(run => run.runId === id)), runId);
}
async function inspectedEndpoint(journey) {
  const nodeId = await journey.getAttribute('data-node-id');
  let port = await journey.getAttribute('data-port');
  if (!port) {
    const description = await journey.locator('.rb-journey-provenance dt').filter({ hasText: /^Node \/ port$/ }).locator('xpath=following-sibling::dd[1]').textContent();
    port = description?.slice(description.lastIndexOf(' / ') + 3).trim();
  }
  return { nodeId, port };
}
async function measurement(page, since) {
  return page.evaluate(start => {
    const clock = window.__RB_COMPLEXITY_MEASUREMENT__;
    const gaps = clock.gaps.filter(entry => entry.at >= start).map(entry => entry.duration);
    const longTasks = clock.longTasks.filter(entry => entry.at >= start);
    gaps.sort((a, b) => a - b);
    return { heartbeatSamples: gaps.length, maximumGapMs: Math.max(0, ...gaps), p95GapMs: gaps[Math.floor(gaps.length * .95)] ?? 0,
      longTaskCount: longTasks.length, maximumLongTaskMs: Math.max(0, ...longTasks.map(entry => entry.duration)) };
  }, since);
}
async function action(page, record, label, fn, qualify = true) {
  const started = Date.now(), browserStart = await page.evaluate(() => performance.now());
  await fn();
  await page.waitForTimeout(75);
  const entry = { action: label, elapsedMs: Date.now() - started, ...(await measurement(page, browserStart)), qualified: qualify };
  record.actions.push(entry);
  if (qualify) {
    assert(entry.elapsedMs <= MAX_ACTION_MS, `${label} took ${entry.elapsedMs}ms, above this host's ${MAX_ACTION_MS}ms qualification bound`);
    assert(entry.maximumGapMs <= MAX_GAP_MS, `${label} blocked heartbeat for ${Math.round(entry.maximumGapMs)}ms, above this host's ${MAX_GAP_MS}ms qualification bound`);
  }
}
async function shot(page, record, name) {
  const file = path.join(OUT, `${name}-1440x900.png`);
  await page.screenshot({ path: file }); record.screenshots.push(file);
}
