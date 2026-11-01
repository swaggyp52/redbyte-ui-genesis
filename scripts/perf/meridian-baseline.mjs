#!/usr/bin/env node

/**
 * Meridian performance baseline (P0/P1). It reports and never asserts: the numbers describe one
 * machine, one browser build and one run, and are for comparison against later phases.
 *
 * It measures the classic workbench and the Meridian studio over the same project in the same
 * browser context: stage switches, wheel zoom, background pan, tick scrubbing and Run, on the
 * shipped 2-Bit Up Counter and on the 321-node synthetic fan-out fixture (the same generator as
 * ide-signal-journey-complexity-proof). For every action it records the driver's wall-clock time,
 * requestAnimationFrame intervals and PerformanceObserver long tasks.
 *
 * Usage: RB_GATE_BASE_URL=http://localhost:5431 node scripts/perf/meridian-baseline.mjs
 * (without RB_GATE_BASE_URL the gate harness serves the built preview).
 * Output: .redbyte/meridian/perf/meridian-baseline.json (override with RB_MERIDIAN_PERF_OUT).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { clickVerifyRun, ensureVerifyVectorsReady, runIdeGate, setVerifyRunMode } from '../gates/_gateHarness.mjs';

const OUT = process.env.RB_MERIDIAN_PERF_OUT ? path.resolve(process.env.RB_MERIDIAN_PERF_OUT)
  : path.join(process.cwd(), '.redbyte', 'meridian', 'perf');
await mkdir(OUT, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };
const FIXED_ISO = '2026-01-01T00:00:00.000Z';
const report = { kind: 'meridian-perf-baseline', viewport: VIEWPORT, node: process.version, userAgent: null, fixtures: [] };

const PERF_INIT = () => {
  window.__rbPerf = { longTasks: [], frames: [], mark: 0, recording: false };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__rbPerf.longTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch { /* long tasks unsupported: reported as zero */ }
};

async function measure(page, label, action, settleMs = 400) {
  // An action that navigates replaces the recorder: the new page's init script reports its long
  // tasks since navigation start (mark 0) and no frame intervals.
  await page.evaluate(() => {
    const perf = window.__rbPerf ?? (window.__rbPerf = { longTasks: [], frames: [], mark: 0, recording: false });
    perf.frames = []; perf.mark = performance.now(); perf.recording = true;
    const loop = (time) => { if (!perf.recording) return; perf.frames.push(time); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const start = Date.now();
  await action();
  const actionMs = Date.now() - start;
  await page.waitForTimeout(settleMs);
  const stats = await page.evaluate(() => {
    const perf = window.__rbPerf;
    perf.recording = false;
    const gaps = perf.frames.slice(1).map((time, index) => time - perf.frames[index]).sort((a, b) => a - b);
    const tasks = perf.longTasks.filter((task) => task.start >= perf.mark);
    const at = (q) => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * q))] : null);
    return {
      frames: perf.frames.length,
      p95FrameMs: at(0.95),
      maxFrameMs: gaps.length ? gaps[gaps.length - 1] : null,
      framesOver50ms: gaps.filter((gap) => gap > 50).length,
      longTasks: tasks.length,
      longTaskTotalMs: tasks.reduce((sum, task) => sum + task.duration, 0),
      longestTaskMs: tasks.reduce((max, task) => Math.max(max, task.duration), 0),
    };
  });
  const round = (value) => (typeof value === 'number' ? Math.round(value * 10) / 10 : value);
  const entry = { label, actionMs, ...Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, round(value)])) };
  console.log(`  ${label}: ${actionMs} ms · p95 frame ${entry.p95FrameMs} ms · max frame ${entry.maxFrameMs} ms · long tasks ${entry.longTasks} (${entry.longTaskTotalMs} ms)`);
  return entry;
}

async function wheelZoom(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 10; i += 1) await page.mouse.wheel(0, -120);
  for (let i = 0; i < 10; i += 1) await page.mouse.wheel(0, 120);
}

async function backgroundPan(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + 24, box.y + box.height - 24);
  await page.mouse.down();
  for (let i = 1; i <= 20; i += 1) await page.mouse.move(box.x + 24 + i * 10, box.y + box.height - 24 - i * 4);
  await page.mouse.up();
}

async function classicStages(page, entries) {
  for (const [mode, label] of [['verify', 'Simulate'], ['hardware', 'Board'], ['design', 'Design']]) {
    entries.push(await measure(page, `classic stage → ${label}`, async () => {
      await page.getByTestId(`mode-button-${mode}`).click();
      await page.getByTestId(`ide-mode-${mode}`).waitFor({ state: 'visible' });
    }));
  }
}

async function studioStages(page, entries) {
  for (const [key, stage, ready] of [['3', 'Simulate', 'meridian-lens-time'], ['4', 'Board', 'meridian-lens-board'], ['2', 'Design', null]]) {
    entries.push(await measure(page, `studio stage → ${stage}`, async () => {
      await page.keyboard.press(key);
      if (ready) await page.getByTestId(ready).waitFor({ state: 'visible' });
      else await page.waitForSelector(`[data-testid="meridian-work"][data-preset="design"]`);
    }));
  }
}

async function classicRun(page, entries) {
  await page.getByTestId('mode-button-verify').click();
  await page.getByTestId('ide-mode-verify').waitFor({ state: 'visible' });
  await ensureVerifyVectorsReady(page);
  await setVerifyRunMode(page, 'compare');
  const previous = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId ?? null);
  entries.push(await measure(page, 'classic Run → result', async () => {
    await clickVerifyRun(page);
    await page.waitForFunction((id) => {
      const run = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun;
      return run && run.runId !== id;
    }, previous, { timeout: 60000 });
  }));
}

async function studioRun(page, entries) {
  await page.keyboard.press('3');
  await page.getByTestId('meridian-lens-time').waitFor({ state: 'visible' });
  const previous = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().verifyLastRun?.runId ?? null);
  entries.push(await measure(page, 'studio Run → result', async () => {
    await page.keyboard.press('Control+Enter');
    await page.waitForFunction((id) => {
      const status = document.querySelector('[data-testid="meridian-run-status"]')?.textContent ?? '';
      const run = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun;
      return /checks (passed|failed)/.test(status) && run && run.runId !== id;
    }, previous, { timeout: 60000 });
  }));
}

async function studioScrub(page, entries, steps) {
  await page.getByTestId('meridian-time').waitFor({ state: 'visible' });
  await page.getByTestId('meridian-time').focus();
  entries.push(await measure(page, `studio scrub ${steps} ticks`, async () => {
    for (let i = 0; i < steps; i += 1) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Home');
  }));
}

function node(id, type, x, y) { return { id, type, label: id, position: { x, y }, config: {}, state: {} }; }
function wire(id, from, to, port) { return { id, from: { nodeId: from, portName: 'out' }, to: { nodeId: to, portName: port } }; }
function row(id, direction, pin) { return { id, nodeId: id, port: direction === 'in' ? 'out' : 'in', label: id, direction, pin, required: true }; }
function fanoutProject() {
  const nodes = [node('a', 'INPUT', 0, 0)];
  const connections = [];
  let previous = [];
  for (let i = 0; i < 160; i += 1) {
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
    previous = next; level += 1;
  }
  nodes.push(node('out', 'OUTPUT', 400 + level * 180, 0)); connections.push(wire('output', previous[0], 'out', 'in'));
  const rows = [row('a', 'in', 'V17'), row('out', 'out', 'U16')];
  return {
    kind: 'rb-project', version: 1, name: 'Synthetic stress: 160-way fan-out and balanced reconvergence',
    description: 'Labeled browser stress fixture; not ordinary authoring evidence.', createdAt: FIXED_ISO, updatedAt: FIXED_ISO,
    circuit: { nodes, connections }, fpga: { board: 'basys3', part: 'xc7a35tcpg236-1' },
    ioMapping: { inputs: rows.filter((entry) => entry.direction === 'in'), outputs: rows.filter((entry) => entry.direction === 'out') },
    vectors: Array.from({ length: 4 }, (_, tick) => ({ tick, inputs: { a: tick % 2 }, expected: { out: 1 - (tick % 2) } })),
    meta: { tags: ['signal-journey', 'stress-fixture'], appSurface: 'ide', projectKind: 'import' },
  };
}

await runIdeGate('Meridian performance baseline (report only)', async ({ page, baseUrl }) => {
  await page.setViewportSize(VIEWPORT);
  await page.addInitScript(PERF_INIT);
  report.userAgent = await page.evaluate(() => navigator.userAgent);

  // ── 2-Bit Up Counter ──
  console.log('Counter (13 nodes, 17 wires)');
  const counter = { id: 'two-bit-counter', nodes: 13, wires: 17, entries: [] };
  report.fixtures.push(counter);
  counter.entries.push(await measure(page, 'studio open → sheet', async () => {
    await page.goto(`${baseUrl}/?studio=meridian&example=two-bit-counter&stage=design`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('meridian-sheet').waitFor({ state: 'visible', timeout: 60000 });
  }, 800));
  const sheet = page.getByTestId('meridian-sheet');
  await studioStages(page, counter.entries);
  counter.entries.push(await measure(page, 'studio wheel zoom ×20', () => wheelZoom(page, sheet)));
  counter.entries.push(await measure(page, 'studio background pan', () => backgroundPan(page, sheet)));
  await studioRun(page, counter.entries);
  await studioScrub(page, counter.entries, 6);

  counter.entries.push(await measure(page, 'classic open → Design', async () => {
    await page.goto(`${baseUrl}/?mode=design&e2e=1`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ide-mode-design').waitFor({ state: 'visible', timeout: 60000 });
    await page.getByTestId('ide-design-canvas').waitFor({ state: 'visible' });
  }, 800));
  await classicStages(page, counter.entries);
  counter.entries.push(await measure(page, 'classic wheel zoom ×20', () => wheelZoom(page, page.getByTestId('ide-design-canvas'))));
  await classicRun(page, counter.entries);

  // ── 321-node fan-out fixture, imported through the workbench's own file input ──
  const fixture = fanoutProject();
  const fixtureFile = path.join(OUT, 'fanout.rbproj.json');
  await writeFile(fixtureFile, JSON.stringify(fixture, null, 2));
  console.log(`Fan-out (${fixture.circuit.nodes.length} nodes, ${fixture.circuit.connections.length} wires)`);
  const fanout = { id: 'fanout-321', nodes: fixture.circuit.nodes.length, wires: fixture.circuit.connections.length, entries: [] };
  report.fixtures.push(fanout);
  await page.goto(`${baseUrl}/?mode=project&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ide-mode-project').waitFor({ state: 'visible', timeout: 60000 });
  const importStart = Date.now();
  await page.getByTestId('ide-project-file-input').setInputFiles(fixtureFile);
  await page.waitForFunction((name) => window.__RB_PROJECT_RUNTIME__?.getState().projectName === name, fixture.name, { timeout: 60000 });
  const inMemoryMs = Date.now() - importStart;
  // The runtime writes the session to IndexedDB asynchronously and has no unload flush
  // (RB-DEBT-023): navigating before the write lands reopens the previous project. Wait until
  // the stored session record names the fixture.
  await page.waitForFunction(async (name) => new Promise((resolve) => {
    const open = indexedDB.open('redbyte-ide-sessions-v1');
    open.onerror = () => resolve(false);
    open.onsuccess = () => {
      try {
        const read = open.result.transaction('records', 'readonly').objectStore('records').get('rb.ide.project-runtime.v1');
        read.onsuccess = () => { resolve(typeof read.result?.value === 'string' && read.result.value.includes(name)); open.result.close(); };
        read.onerror = () => { resolve(false); open.result.close(); };
      } catch { resolve(false); open.result.close(); }
    };
  }), fixture.name, { timeout: 60000, polling: 50 });
  fanout.importTimings = { inMemoryMs, persistedMs: Date.now() - importStart };
  console.log(`  import → in memory ${inMemoryMs} ms · → persisted session ${fanout.importTimings.persistedMs} ms`);

  fanout.entries.push(await measure(page, 'classic open → Design', async () => {
    await page.goto(`${baseUrl}/?mode=design&e2e=1`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ide-mode-design').waitFor({ state: 'visible', timeout: 60000 });
    await page.getByTestId('ide-design-canvas').waitFor({ state: 'visible' });
  }, 800));
  await classicStages(page, fanout.entries);
  fanout.entries.push(await measure(page, 'classic wheel zoom ×20', () => wheelZoom(page, page.getByTestId('ide-design-canvas'))));
  await classicRun(page, fanout.entries);

  fanout.entries.push(await measure(page, 'studio open → sheet', async () => {
    await page.goto(`${baseUrl}/?studio=meridian&stage=design`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('meridian-sheet').waitFor({ state: 'visible', timeout: 60000 });
  }, 800));
  // One run opened the previous project here (the session written by the workbench had not
  // reached the studio's rehydrate). The numbers below are kept only when the fixture loaded.
  const loaded = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.length);
  if (loaded !== fixture.circuit.nodes.length) {
    fanout.invalid = `studio opened a ${loaded}-node project instead of the ${fixture.circuit.nodes.length}-node fixture`;
    console.log(`  INVALID: ${fanout.invalid}`);
  }
  fanout.entries.push({ label: 'studio sheet element count', ...(await page.evaluate(() => ({
    project: window.__RB_PROJECT_RUNTIME__?.getState().projectName,
    circuitNodes: window.__RB_PROJECT_RUNTIME__?.getState().circuit.nodes.length,
    zoom: document.querySelector('[data-testid="meridian-zoom"]')?.textContent,
    nets: document.querySelectorAll('[data-net-id]').length,
    symbols: document.querySelectorAll('[data-sheet-node]').length,
    svgElements: document.querySelector('[data-testid="meridian-sheet"]')?.querySelectorAll('*').length ?? 0,
  }))) });
  await studioStages(page, fanout.entries);
  fanout.entries.push(await measure(page, 'studio wheel zoom ×20', () => wheelZoom(page, sheet)));
  fanout.entries.push(await measure(page, 'studio background pan', () => backgroundPan(page, sheet)));
  await studioRun(page, fanout.entries);
  await studioScrub(page, fanout.entries, 3);

  await writeFile(path.join(OUT, 'meridian-baseline.json'), JSON.stringify(report, null, 2));
  console.log(`report: ${path.relative(process.cwd(), path.join(OUT, 'meridian-baseline.json'))}`);
});
