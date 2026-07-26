#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';
import {
  assertBuildHash,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'export-fresh-after-mapping-compare',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const VIEWPORT = { label: '1366x768', width: 1366, height: 768 };

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE export freshness after mapping Compare satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);
  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=export-fresh-after-mapping-compare`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, 'export freshness Project startup');

  const rows = await page.evaluate(({ project, vectors }) => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    runtime?.loadFromProject?.(project);
    // Seed one genuine Design history entry before the student authors a
    // testbench. This is the order that exposed the RC authority split.
    runtime?.connectDesignNodes?.({
      fromNodeId: 'and_node',
      fromPort: 'out',
      toNodeId: 'carry_node',
      toPort: 'in',
    });
    runtime?.setVectors?.(vectors);
    runtime?.renameScenario?.('Half Adder Truth Table');
    return (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      direction: row.direction,
    }));
  }, { project: buildHalfAdderProject(), vectors: buildHalfAdderVectors() });
  assert(rows.length === 4, `Half Adder must expose four required I/O rows: ${JSON.stringify(rows)}`);

  await clickMode(page, 'verify');
  assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must be available before mapping');
  await runCompare(page);
  let runtime = await readRuntime(page);
  assert(runtime.verifyStatus === 'pass', `pre-mapping Compare must pass: ${JSON.stringify(runtime)}`);
  assert(runtime.passedRows === 8 && runtime.failedRows === 0, `initial named testbench must pass 8/8 checks: ${JSON.stringify(runtime)}`);
  assert(runtime.verifyQualification === 'incomplete-mapping', `pre-mapping Compare must record incomplete mapping: ${JSON.stringify(runtime)}`);
  assert(runtime.dirtySinceVerify === false, `pre-mapping Compare must clear stale state: ${JSON.stringify(runtime)}`);
  const initialRuntime = runtime;
  await capture(page, '01-initial-named-testbench-pass.png');

  await clickMode(page, 'design');
  const undo = page.getByTestId('ide-design-tool-undo').first();
  await undo.waitFor({ state: 'visible', timeout: 10000 });
  assert(await undo.isEnabled(), 'Design Undo must own the pre-testbench Carry connection');
  await undo.click();
  await page.waitForFunction(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length === 5,
    { timeout: 10000 },
  );

  runtime = await readRuntime(page);
  assert(runtime.scenarioName === 'Half Adder Truth Table', `wire Undo must preserve the named testbench: ${JSON.stringify(runtime)}`);
  assert(runtime.scenarioVectors.length === 4, `wire Undo must preserve four authored vectors: ${JSON.stringify(runtime)}`);
  assert(JSON.stringify(runtime.projectVectors) === JSON.stringify(runtime.scenarioVectors), `wire Undo must keep compatibility vectors aligned with the active scenario: ${JSON.stringify(runtime)}`);
  assert(runtime.verifyStatus === null, `wire Undo must invalidate prior PASS evidence: ${JSON.stringify(runtime)}`);
  const undoneRuntime = runtime;
  await capture(page, '02-carry-wire-undone-testbench-preserved.png');

  // Repair by drawing a new logical connection, not by redoing the historical
  // snapshot. The RC defect survived this normal repair path.
  await page.evaluate(() => {
    window.__RB_PROJECT_RUNTIME__?.getState?.()?.connectDesignNodes?.({
      fromNodeId: 'and_node',
      fromPort: 'out',
      toNodeId: 'carry_node',
      toPort: 'in',
    });
  });
  await page.waitForFunction(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length === 6,
    { timeout: 10000 },
  );
  await capture(page, '03-carry-wire-repaired.png');

  await clickMode(page, 'verify');
  assert(await setVerifyRunMode(page, 'compare'), 'Compare mode must remain available after repair');
  await runCompare(page);
  runtime = await readRuntime(page);
  assert(runtime.verifyStatus === 'pass', `repaired Compare must pass: ${JSON.stringify(runtime)}`);
  assert(runtime.passedRows === 8 && runtime.failedRows === 0, `repaired named testbench must pass 8/8 checks: ${JSON.stringify(runtime)}`);
  const repairedRuntime = runtime;

  await clickMode(page, 'hardware');
  const mappingByLabel = { A: 'SW0', B: 'SW1', Sum: 'LD0', Carry: 'LD1' };
  for (const row of rows) {
    const alias = mappingByLabel[row.label];
    assert(alias, `No Basys3 alias selected for ${JSON.stringify(row)}`);
    await mapRowToAlias(page, row.id, alias);
  }
  await page.waitForFunction(
    () => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      return (state?.projectIoRows ?? []).length === 4 &&
        (state?.projectIoRows ?? []).every((row) => String(row.pin ?? '').trim().length > 0);
    },
    { timeout: 10000 },
  );
  runtime = await readRuntime(page);
  assert(runtime.dirtySinceVerify === true, `mapping change must make prior Compare stale: ${JSON.stringify(runtime)}`);
  const mappedStaleRuntime = runtime;
  await capture(page, '04-mapping-complete-verify-stale.png');

  await clickMode(page, 'export');
  await page.waitForSelector('[data-testid="ide-export-readiness-hero"]', { timeout: 15000 });
  await assertExportTrust(page, 'draft', 'stale before rerun');
  await capture(page, '05-export-stale-before-rerun.png');

  const openVerify = page.getByTestId('ide-export-package-build-v1').first();
  assert(await visible(openVerify), 'Export must expose its Verify repair action');
  assert(/verify/i.test(await text(openVerify)), `Export repair action must route to Verify, got "${await text(openVerify)}"`);
  await openVerify.click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  const staleRerun = page.getByTestId('ide-verify-stale-keep-reference').first();
  assert(await visible(staleRerun), 'Verify must expose Rerun saved checks after mapping changed');
  await staleRerun.click();
  await waitForVerifyResult(page, { timeout: 20000 });
  await page.waitForFunction(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectHealthCore?.dirtySinceVerify === false,
    { timeout: 10000 },
  );
  runtime = await readRuntime(page);
  assert(runtime.verifyStatus === 'pass', `post-mapping Compare must pass: ${JSON.stringify(runtime)}`);
  assert(runtime.passedRows === 8 && runtime.failedRows === 0, `post-mapping Compare must pass 8/8 checks: ${JSON.stringify(runtime)}`);
  assert(runtime.verifyQualification === null, `post-mapping Compare must remove incomplete qualification: ${JSON.stringify(runtime)}`);
  assert(runtime.dirtySinceVerify === false, `post-mapping Compare must clear stale state: ${JSON.stringify(runtime)}`);
  const finalRuntime = runtime;
  await capture(page, '06-verify-current-after-rerun.png');

  await clickMode(page, 'export');
  await page.waitForSelector('[data-testid="ide-export-readiness-hero"]', { timeout: 15000 });
  await assertExportTrust(page, 'trusted', 'current after post-mapping Compare');
  await capture(page, '07-export-trusted-after-rerun.png');

  const record = {
    gate: 'ide-export-fresh-after-mapping-compare',
    viewport: VIEWPORT.label,
    rows,
    stages: {
      initialRuntime,
      undoneRuntime,
      repairedRuntime,
      mappedStaleRuntime,
      finalRuntime,
    },
    exportTitle: await text(page.getByTestId('ide-export-readiness-hero').locator('h2').first()),
    exportVerifyAxis: await text(page.getByTestId('ide-export-verification-axis').first()),
    browserProblems,
  };
  await writeFile(path.join(ARTIFACT_ROOT, 'export-fresh-after-mapping-compare.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function clickMode(page, mode) {
  const button = page.getByTestId(`mode-button-${mode}`).first();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
}

async function runCompare(page) {
  const historyLength = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyRunHistory?.length ?? 0,
  );
  await clickVerifyRun(page);
  await page.waitForFunction(
    (before) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyRunHistory?.length ?? 0) > before,
    historyLength,
    { timeout: 20000 },
  );
  await waitForVerifyResult(page, { timeout: 20000 });
  const status = await text(page.getByTestId('ide-verify-summary-status').first());
  assert(isVerifyPass(status), `Compare must pass, got "${status}"`);
}

async function mapRowToAlias(page, rowId, alias) {
  const row = page.locator(`[data-testid="ide-hw-map-row-${rowId}"]`).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.click();
  const select = page.getByTestId('ide-hw-direct-resource-select').first();
  await select.waitFor({ state: 'visible', timeout: 10000 });
  await select.selectOption(alias);
  await page.getByTestId('ide-hw-assign-selected-resource').first().click();
  await page.waitForFunction(
    ({ rowId: expectedRowId, alias: expectedAlias }) => {
      const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
      return state?.projectIoRows?.find((entry) => entry.id === expectedRowId)?.pin === expectedAlias;
    },
    { rowId, alias },
    { timeout: 10000 },
  );
}

async function assertExportTrust(page, expected, label) {
  const inspector = page.getByTestId('ide-export-package-inspector-v1').first();
  const trust = await inspector.getAttribute('data-export-verification-trust');
  assert(trust === expected, `${label}: expected Export Verify trust ${expected}, got ${trust}; ${await text(inspector)}`);
  const verifyAxis = await text(page.getByTestId('ide-export-verification-axis').first());
  if (expected === 'trusted') {
    assert(/trusted/i.test(verifyAxis), `${label}: Verify axis must say Trusted, got "${verifyAxis}"`);
  } else {
    assert(!/trusted/i.test(verifyAxis), `${label}: stale Verify axis must not say Trusted, got "${verifyAxis}"`);
  }
}

async function readRuntime(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const scenario = state?.scenarios?.find((entry) => entry.id === state.activeScenarioId);
    const ledger = state?.verifyRunHistory?.[state.verifyRunHistory.length - 1];
    return {
      dirtySinceVerify: state?.projectHealthCore?.dirtySinceVerify ?? null,
      verifyStatus: state?.verifyLastRun?.status ?? null,
      verifyQualification: state?.verifyLastRun?.qualification ?? null,
      passedRows: ledger?.passedRows ?? null,
      failedRows: ledger?.failedRows ?? null,
      scenarioAuthority: state?.scenarioAuthority ?? null,
      scenarioName: scenario?.name ?? null,
      ledgerProjectHash: ledger?.projectHash ?? null,
      projectVectors: state?.projectVectors ?? [],
      scenarioVectors: scenario?.vectors ?? [],
      projectIoRows: (state?.projectIoRows ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        nodeId: row.nodeId,
        direction: row.direction,
        pin: row.pin,
      })),
    };
  });
}

async function capture(page, filename) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
}

function buildHalfAdderProject() {
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:00:00.000Z',
    name: 'Half Adder Browser Freshness',
    description: 'Fresh logical Half Adder before its Carry output is wired.',
    circuit: {
      nodes: [
        { id: 'a_node', type: 'INPUT', label: 'A', position: { x: 80, y: 100 }, x: 80, y: 100, config: {}, state: {} },
        { id: 'b_node', type: 'INPUT', label: 'B', position: { x: 80, y: 260 }, x: 80, y: 260, config: {}, state: {} },
        { id: 'xor_node', type: 'XOR', label: 'XOR', position: { x: 300, y: 100 }, x: 300, y: 100, config: {}, state: {} },
        { id: 'and_node', type: 'AND', label: 'AND', position: { x: 300, y: 260 }, x: 300, y: 260, config: {}, state: {} },
        { id: 'sum_node', type: 'OUTPUT', label: 'Sum', position: { x: 520, y: 100 }, x: 520, y: 100, config: {}, state: {} },
        { id: 'carry_node', type: 'OUTPUT', label: 'Carry', position: { x: 520, y: 260 }, x: 520, y: 260, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'a_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'a' } },
        { from: { nodeId: 'b_node', portName: 'out' }, to: { nodeId: 'xor_node', portName: 'b' } },
        { from: { nodeId: 'a_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'a' } },
        { from: { nodeId: 'b_node', portName: 'out' }, to: { nodeId: 'and_node', portName: 'b' } },
        { from: { nodeId: 'xor_node', portName: 'out' }, to: { nodeId: 'sum_node', portName: 'in' } },
      ],
    },
    ioMapping: {
      inputs: [
        { id: 'a', nodeId: 'a_node', port: 'out', label: 'A', pin: '' },
        { id: 'b', nodeId: 'b_node', port: 'out', label: 'B', pin: '' },
      ],
      outputs: [
        { id: 'sum', nodeId: 'sum_node', port: 'in', label: 'Sum', pin: '' },
        { id: 'carry', nodeId: 'carry_node', port: 'in', label: 'Carry', pin: '' },
      ],
    },
    vectors: [],
    meta: { projectId: 'half-adder-browser-freshness' },
  };
}

function buildHalfAdderVectors() {
  return [
    { id: 'vec-00', tick: 0, inputs: { a: 0, b: 0 }, expected: { sum: 0, carry: 0 } },
    { id: 'vec-01', tick: 1, inputs: { a: 0, b: 1 }, expected: { sum: 1, carry: 0 } },
    { id: 'vec-10', tick: 2, inputs: { a: 1, b: 0 }, expected: { sum: 1, carry: 0 } },
    { id: 'vec-11', tick: 3, inputs: { a: 1, b: 1 }, expected: { sum: 0, carry: 1 } },
  ];
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
