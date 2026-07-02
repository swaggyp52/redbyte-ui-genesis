#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  runIdeGate,
  saveObservedOutputs,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'scratch-testbench-repair-flow',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const VIEWPORT = { label: '1366x768', width: 1366, height: 768 };

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE scratch testbench repair flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-scratch-testbench-repair-flow',
    generatedAtIso: new Date().toISOString(),
    viewport: VIEWPORT.label,
    phases: [],
    browserProblems,
  };

  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=scratch-testbench-repair-flow`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertSurfaceSafe(page, 'Project startup');

  await clickVisible(
    page,
    '[data-testid="ide-project-build-fresh-primary"], [data-testid="ide-project-path-build-fresh"]',
    'Build Fresh',
  );
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  await assertSurfaceSafe(page, 'Design fresh');

  await renameProject(page, 'RB Scratch Testbench Repair Flow');
  await revealDesignLibrary(page);
  await setDesignZoomPreset(page, '50');
  await buildScratchLogic(page, record);
  await capture(page, '01-scratch-design-complete.png');

  await openMode(page, baseUrl, 'verify', 'scratch-testbench-repair-flow');
  await assertSurfaceSafe(page, 'Verify startup');
  const cases = await buildScratchCases(page);
  await authorInputCases(page, cases);
  await runObserveSaveAndAssertExpected(page, cases, 'scratch repair');
  await capture(page, '02-observe-saved-expected.png');

  const target = {
    fieldId: cases[2].outputIds.Cout,
    tick: 2,
    original: cases[2].expected[cases[2].outputIds.Cout],
    label: 'Cout',
  };
  await flipExpectedCell(page, target.fieldId, target.tick);
  const wrongValue = await readCellValue(page, expectedCellTestId(target.fieldId, target.tick));
  assert(wrongValue !== target.original, `expected ${target.label} t${target.tick} to become intentionally wrong`);

  await runCompareAndExpect(page, 'intentional wrong expected output', 'fail');
  await assertFailureRepairPanel(page, {
    signalLabel: target.label,
    expected: String(wrongValue),
    observed: String(target.original),
    inputTerms: ['A=1', 'B=1', 'C=0'],
  });
  await capture(page, '03-compare-fail-repair-panel.png');

  await page.getByTestId('ide-verify-repair-use-observed').click();
  await page.waitForFunction(
    ({ fieldId, tick, value }) => {
      const vectors = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? [];
      return vectors.some((vector) => vector.tick === tick && vector.expected?.[fieldId] === value);
    },
    { fieldId: target.fieldId, tick: target.tick, value: target.original },
    { timeout: 8000 },
  );
  const repairedValue = await readCellValue(page, expectedCellTestId(target.fieldId, target.tick));
  assert(
    repairedValue === target.original,
    `Use observed value as expected should repair ${target.label} t${target.tick}; got ${repairedValue}`,
  );

  await clickRepairRerun(page);
  await waitForVerifyResult(page, { timeout: 20000 }).catch((error) => {
    throw new Error(`repair rerun: Verify result did not settle: ${error instanceof Error ? error.message : String(error)}`);
  });
  let status = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyPass(status), `repaired Compare should PASS, got "${status}"`);
  await capture(page, '04-repaired-compare-pass.png');

  await flipExpectedCell(page, target.fieldId, target.tick);
  await page.waitForSelector('[data-testid="ide-verify-primary-status-rerun"]', { timeout: 10000 });
  const staleText = await text(page.locator('[data-testid="ide-verify-primary-status"]'));
  assert(
    /Testbench changed|Stimulus or saved checks changed|Rerun Compare/i.test(staleText),
    `Verify must make stale testbench evidence obvious after edit, got "${staleText}"`,
  );
  await capture(page, '05-testbench-edit-stale.png');

  await openMode(page, baseUrl, 'export', 'scratch-testbench-repair-flow-stale-export');
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  const staleExport = await text(page.locator('[data-testid="ide-export-provenance-verify"]'));
  const staleHandoff = await text(page.locator('[data-testid="ide-export-handoff-summary-state"]'));
  assert(
    /stale|current verify|trusted evidence still pending|pending/i.test(`${staleExport} ${staleHandoff}`),
    `Export must not present stale Verify evidence as trusted current evidence; got "${staleExport}" / "${staleHandoff}"`,
  );
  assert(!/Checks match/i.test(staleExport), `stale Export provenance must not say Checks match: "${staleExport}"`);
  await capture(page, '06-export-stale-not-trusted.png');

  await openMode(page, baseUrl, 'verify', 'scratch-testbench-repair-flow-final-verify');
  await setExpectedCell(page, target.fieldId, target.tick, target.original);
  await runCompareAndExpect(page, 'final repaired expected output', 'pass');
  status = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyPass(status), `final Compare should PASS, got "${status}"`);

  await openMode(page, baseUrl, 'export', 'scratch-testbench-repair-flow-current-export');
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  const exportVerify = await text(page.locator('[data-testid="ide-export-provenance-verify"]'));
  const evidenceRows = await text(page.locator('[data-testid="ide-export-vivado-evidence-rows"]'));
  assert(/Checks match/i.test(exportVerify), `current Export provenance should show Checks match, got "${exportVerify}"`);
  assert(/E0/i.test(evidenceRows), 'Export evidence rows must keep the E0 boundary visible');
  assert(/external evidence required|manual observation required/i.test(evidenceRows), 'Export must keep E1/E2/E3 external');
  await capture(page, '07-export-current-e0-boundary.png');

  record.phases.push({ phase: 'complete', cases: cases.map((entry) => entry.name) });
  await writeFile(path.join(ARTIFACT_ROOT, 'scratch-testbench-repair-flow.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function installCleanStudentContext(page) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('rb-onboarding-v1-seen', '1');
    } catch {
      // Storage can be unavailable on intermediate documents.
    }
    try {
      sessionStorage.clear();
    } catch {
      // Storage can be unavailable on intermediate documents.
    }
  });
}

async function buildScratchLogic(page, record) {
  const nodes = {};
  nodes.A = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw0"]', 'A', { x: 0.10, y: 0.30 });
  nodes.B = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw1"]', 'B', { x: 0.10, y: 0.50 });
  nodes.C = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw2"]', 'C', { x: 0.10, y: 0.70 });
  nodes.adder = await placeAndLabel(page, '[data-testid="ide-design-palette-fulladder"]', 'FA_sum_carry', { x: 0.46, y: 0.45 });
  nodes.anyOr = await placeAndLabel(page, '[data-testid="ide-design-palette-or"]', 'a_or_b', { x: 0.46, y: 0.72 });
  nodes.Sum = await placeAndLabel(page, '[data-testid="ide-design-board-output-ld0"]', 'Sum', { x: 0.86, y: 0.36 });
  nodes.Cout = await placeAndLabel(page, '[data-testid="ide-design-board-output-ld1"]', 'Cout', { x: 0.86, y: 0.54 });
  nodes.Any = await placeAndLabel(page, '[data-testid="ide-design-board-output-ld2"]', 'Any', { x: 0.86, y: 0.72 });

  const wires = [
    [nodes.A, 'out', nodes.adder, 'A'],
    [nodes.B, 'out', nodes.adder, 'B'],
    [nodes.C, 'out', nodes.adder, 'Cin'],
    [nodes.adder, 'Sum', nodes.Sum, 'in'],
    [nodes.adder, 'Cout', nodes.Cout, 'in'],
    [nodes.A, 'out', nodes.anyOr, 'a'],
    [nodes.B, 'out', nodes.anyOr, 'b'],
    [nodes.anyOr, 'out', nodes.Any, 'in'],
  ];

  for (const wire of wires) {
    await connectPorts(page, ...wire);
  }

  const circuit = await readCircuit(page);
  assert(circuit.nodeCount >= 8, `scratch circuit must have at least 8 nodes, got ${circuit.nodeCount}`);
  assert(circuit.connectionCount === wires.length, `scratch circuit should have ${wires.length} wires, got ${circuit.connectionCount}`);
  record.phases.push({ phase: 'design', nodes: circuit.nodeCount, connections: circuit.connectionCount });
  await fitCenterZoom(page);
}

async function buildScratchCases(page) {
  const rows = await readIoRows(page);
  const ids = {
    A: requireRowIdByLabel(rows, 'A'),
    B: requireRowIdByLabel(rows, 'B'),
    C: requireRowIdByLabel(rows, 'C'),
    Sum: requireRowIdByLabel(rows, 'Sum'),
    Cout: requireRowIdByLabel(rows, 'Cout'),
    Any: requireRowIdByLabel(rows, 'Any'),
  };
  const outputIds = { Sum: ids.Sum, Cout: ids.Cout, Any: ids.Any };
  return [
    {
      name: '000',
      inputs: { [ids.A]: 0, [ids.B]: 0, [ids.C]: 0 },
      expected: { [ids.Sum]: 0, [ids.Cout]: 0, [ids.Any]: 0 },
      outputIds,
    },
    {
      name: '010',
      inputs: { [ids.A]: 0, [ids.B]: 1, [ids.C]: 0 },
      expected: { [ids.Sum]: 1, [ids.Cout]: 0, [ids.Any]: 1 },
      outputIds,
    },
    {
      name: '110',
      inputs: { [ids.A]: 1, [ids.B]: 1, [ids.C]: 0 },
      expected: { [ids.Sum]: 0, [ids.Cout]: 1, [ids.Any]: 1 },
      outputIds,
    },
    {
      name: '111',
      inputs: { [ids.A]: 1, [ids.B]: 1, [ids.C]: 1 },
      expected: { [ids.Sum]: 1, [ids.Cout]: 1, [ids.Any]: 1 },
      outputIds,
    },
  ];
}

async function assertFailureRepairPanel(page, options) {
  await page.waitForSelector('[data-testid="ide-verify-repair-panel"]', { timeout: 10000 });
  const panel = page.locator('[data-testid="ide-verify-repair-panel"]').first();
  const panelText = await text(panel);
  assert(/Compare failed/i.test(panelText), `repair panel must name Compare failed, got "${panelText}"`);
  assert(panelText.includes(options.signalLabel), `repair panel must show signal ${options.signalLabel}: "${panelText}"`);
  assert(panelText.includes(options.expected), `repair panel must show expected ${options.expected}: "${panelText}"`);
  assert(panelText.includes(options.observed), `repair panel must show observed ${options.observed}: "${panelText}"`);
  for (const inputTerm of options.inputTerms) {
    assert(panelText.includes(inputTerm), `repair panel must show input ${inputTerm}: "${panelText}"`);
  }
  for (const testId of [
    'ide-verify-repair-edit-expected',
    'ide-verify-repair-use-observed',
    'ide-verify-repair-open-design',
    'ide-verify-repair-rerun',
  ]) {
    assert(await page.getByTestId(testId).first().isVisible().catch(() => false), `repair action ${testId} must be visible`);
  }
}

async function clickRepairRerun(page) {
  await page.getByTestId('ide-verify-repair-rerun').click();
  await page.waitForTimeout(100);
}

async function runObserveSaveAndAssertExpected(page, cases, label) {
  await setVerifyRunMode(page, 'observe');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 }).catch((error) => {
    throw new Error(`Observe run did not settle: ${error instanceof Error ? error.message : String(error)}`);
  });
  const savedSelector = await saveObservedOutputs(page);
  assert(savedSelector, `${label}: Verify must allow saving observed outputs after Observe`);
  await page.waitForFunction(
    () => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? []).some((vector) => Object.keys(vector.expected ?? {}).length > 0),
    { timeout: 8000 },
  );
  await assertExpectedCells(page, cases, label);
}

async function runCompareAndExpect(page, label, expectation) {
  assert(await setVerifyRunMode(page, 'compare'), `${label}: Compare mode must be selectable`);
  await clickVerifyRunAndWaitForNewResult(page, label, expectation);
  const status = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  if (expectation === 'pass') {
    assert(isVerifyPass(status), `${label}: Compare should PASS, got "${status}"`);
  } else {
    assert(isVerifyFail(status), `${label}: Compare should FAIL, got "${status}"`);
  }
}

async function clickVerifyRunAndWaitForNewResult(page, label, expectation) {
  const previousReportHash = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null,
  );
  await clickVerifyRun(page);
  try {
    await page.waitForFunction(
      (previous) => {
        const nextHash = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null;
        return Boolean(nextHash && nextHash !== previous);
      },
      previousReportHash,
      { timeout: 20000 },
    );
  } catch {
    const state = await page.evaluate(() => ({
      previousReportHash: window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null,
      status: document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? '',
      runButton: document.querySelector('[data-testid="ide-vcb-run"]')?.textContent ?? '',
      primaryStatus: document.querySelector('[data-testid="ide-verify-primary-status"]')?.textContent ?? '',
    }));
    if (
      expectation === 'pass' &&
      isVerifyPass(state.status) &&
      !/Testbench changed|Stimulus or saved checks changed|Run Compare/i.test(state.primaryStatus)
    ) {
      return;
    }
    throw new Error(`${label}: Verify report hash did not change from ${previousReportHash}: ${JSON.stringify(state)}`);
  }
  await waitForVerifyResult(page, { timeout: 10000 });
}

async function authorInputCases(page, cases) {
  await ensureCaseCount(page, cases.length);
  for (let tick = 0; tick < cases.length; tick += 1) {
    for (const [fieldId, value] of Object.entries(cases[tick].inputs)) {
      await setInputCell(page, fieldId, tick, value);
    }
  }
}

async function ensureCaseCount(page, desired) {
  await page.waitForSelector('[data-testid="ide-stimulus-add-tick"]', { timeout: 15000 });
  for (let guard = 0; guard < desired + 4; guard += 1) {
    const count = await readTickCount(page);
    if (count >= desired) return;
    await page.locator('[data-testid="ide-stimulus-add-tick"]').first().click();
    await page.waitForTimeout(120);
  }
  assert(false, `could not create ${desired} Verify cases`);
}

async function setInputCell(page, fieldId, tick, value) {
  const testId = `ide-stimulus-cell-${fieldId}-t${tick}`;
  const cell = page.getByTestId(testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readCellValue(page, testId);
    if (current === value) return;
    await cell.click();
    await page.waitForTimeout(100);
  }
  const current = await readCellValue(page, testId);
  assert(current === value, `expected ${testId} to become ${value}, got ${current}`);
}

async function assertExpectedCells(page, cases, label) {
  for (let tick = 0; tick < cases.length; tick += 1) {
    for (const [fieldId, value] of Object.entries(cases[tick].expected)) {
      const actual = await readCellValue(page, expectedCellTestId(fieldId, tick));
      assert(actual === value, `${label} case ${cases[tick].name} expected ${fieldId}=${value}, got ${actual}`);
    }
  }
}

async function setExpectedCell(page, fieldId, tick, value) {
  const testId = expectedCellTestId(fieldId, tick);
  const cell = page.getByTestId(testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readCellValue(page, testId);
    if (current === value) return;
    await cell.click();
    await page.waitForTimeout(100);
  }
  const current = await readCellValue(page, testId);
  assert(current === value, `expected ${testId} to become ${value}, got ${current}`);
}

async function flipExpectedCell(page, fieldId, tick) {
  const current = await readCellValue(page, expectedCellTestId(fieldId, tick));
  assert(current === 0 || current === 1, `expected ${fieldId} t${tick} to have a saved 0/1 value before flip`);
  await setExpectedCell(page, fieldId, tick, current === 0 ? 1 : 0);
}

async function readCellValue(page, testId) {
  const title = await page.getByTestId(testId).first().getAttribute('title');
  if (/:\s*1\s*-\s*drag/i.test(title ?? '')) return 1;
  if (/:\s*0\s*-\s*drag/i.test(title ?? '')) return 0;
  return null;
}

async function readTickCount(page) {
  const ids = await page.locator('[data-testid^="ide-stimulus-cell-"]').evaluateAll((elements) =>
    Array.from(
      new Set(
        elements
          .map((element) => /-t(\d+)$/.exec(element.getAttribute('data-testid') ?? '')?.[1])
          .filter(Boolean),
      ),
    ).map(Number),
  );
  return ids.length;
}

function expectedCellTestId(fieldId, tick) {
  return `ide-stimulus-expected-${fieldId}-t${tick}`;
}

async function renameProject(page, name) {
  const title = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  assert(await title.isVisible().catch(() => false), 'topbar project title must be visible');
  await title.dblclick();
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(name);
  await input.press('Enter');
  await page.waitForFunction(
    (expected) => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectName === expected,
    name,
    { timeout: 5000 },
  );
}

async function revealDesignLibrary(page) {
  const palette = page.locator('[data-testid="ide-design-dock-palette"]').first();
  if (await palette.isVisible().catch(() => false)) return;
  const toggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"], [data-testid="ide-design-library-toggle"]').first();
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
  }
  await page.waitForSelector('[data-testid="ide-design-dock-palette"]', { timeout: 10000 });
}

async function placeAndLabel(page, selector, label, position) {
  const nodeId = await placeFromPalette(page, selector, position);
  await editNodeLabel(page, nodeId, label);
  await moveNodeToCanvasFraction(page, nodeId, position);
  return nodeId;
}

async function placeFromPalette(page, selector, position) {
  await revealDesignLibrary(page);
  const before = await readNodeIds(page);
  const button = page.locator(selector).first();
  assert(await button.isVisible().catch(() => false), `palette entry ${selector} must be visible`);
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-placement-active') === '1',
    { timeout: 5000 },
  );
  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const bounds = await canvas.boundingBox();
  assert(Boolean(bounds), `design canvas bounds unavailable for placement from ${selector}`);
  await page.mouse.click(bounds.x + bounds.width * position.x, bounds.y + bounds.height * position.y);
  try {
    await page.waitForFunction(
      (knownIds) => {
        const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
        return nodes.some((node) => !knownIds.includes(node.id));
      },
      before,
      { timeout: 8000 },
    );
  } catch {
    const afterTimeout = await readNodeIds(page);
    throw new Error(
      `placing ${selector} did not publish a new node; before=${JSON.stringify(before)} after=${JSON.stringify(afterTimeout)}`,
    );
  }
  const after = await readNodeIds(page);
  const added = after.filter((id) => !before.includes(id));
  assert(added.length >= 1, `placing ${selector} did not add a node`);
  return added.at(-1);
}

async function editNodeLabel(page, nodeId, label) {
  await clickNode(page, nodeId);
  await clickVisible(page, '[data-testid="ide-design-label-edit-btn"]', `label edit for ${nodeId}`);
  const input = page.locator('[data-testid="ide-design-label-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(label);
  await page.locator('[data-testid="ide-design-label-save"]').first().click();
  await page.waitForFunction(
    ({ id, expected }) => {
      const node = (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? []).find((entry) => entry.id === id);
      return node?.label === expected;
    },
    { id: nodeId, expected: label },
    { timeout: 5000 },
  );
}

async function clickNode(page, nodeId) {
  const body = page.locator(`[data-node-id="${nodeId}"] .logic-node-body`).first();
  await body.scrollIntoViewIfNeeded();
  const box = await body.boundingBox();
  assert(Boolean(box), `node ${nodeId} must have a clickable box`);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  if (await activeWireStart(page)) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort,
      { timeout: 5000 },
    );
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  }
}

async function clickPort(page, nodeId, portName) {
  const port = page.locator(`[data-node-id="${nodeId}"] [data-port-id="${portName}"]`).first();
  await port.waitFor({ state: 'visible', timeout: 8000 });
  const box = await port.boundingBox();
  assert(Boolean(box), `port ${nodeId}.${portName} must have a clickable box`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function connectPorts(page, fromNodeId, fromPort, toNodeId, toPort) {
  const before = await readCircuit(page);
  await clickPort(page, fromNodeId, fromPort);
  assert(await activeWireStart(page), `clicking ${fromNodeId}.${fromPort} must start a wire`);
  await clickPort(page, toNodeId, toPort);
  await waitForConnectionCount(page, before.connectionCount + 1, `connect ${fromNodeId}.${fromPort}->${toNodeId}.${toPort}`);
}

async function waitForConnectionCount(page, expected, label) {
  try {
    await page.waitForFunction(
      (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) === count,
      expected,
      { timeout: 8000 },
    );
  } catch {
    const actualTimeout = (await readCircuit(page)).connectionCount;
    throw new Error(`${label}: connection count did not reach ${expected}; got ${actualTimeout}`);
  }
  const actual = (await readCircuit(page)).connectionCount;
  assert(actual === expected, `${label}: expected ${expected} connections, got ${actual}`);
}

async function moveNodeToCanvasFraction(page, nodeId, position) {
  const node = page.locator(`[data-node-id="${nodeId}"] .logic-node-body`).first();
  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const nodeBox = await node.boundingBox();
  const canvasBox = await canvas.boundingBox();
  assert(Boolean(nodeBox) && Boolean(canvasBox), `node ${nodeId} and canvas must be measurable`);
  const start = { x: nodeBox.x + nodeBox.width / 2, y: nodeBox.y + nodeBox.height / 2 };
  const target = {
    x: canvasBox.x + canvasBox.width * position.x,
    y: canvasBox.y + canvasBox.height * position.y,
  };
  if (Math.abs(start.x - target.x) < 18 && Math.abs(start.y - target.y) < 18) return;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(160);
}

async function readCircuit(page) {
  return page.evaluate(() => {
    const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ?? { nodes: [], connections: [] };
    return {
      nodeCount: circuit.nodes?.length ?? 0,
      connectionCount: circuit.connections?.length ?? 0,
    };
  });
}

async function readNodeIds(page) {
  return page.evaluate(() => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? []).map((node) => node.id));
}

async function activeWireStart(page) {
  return page.evaluate(() => Boolean(window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort));
}

async function readIoRows(page) {
  return page.evaluate(() =>
    (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      pin: row.pin,
      nodeId: row.nodeId,
    })),
  );
}

function requireRowIdByLabel(rows, label) {
  const row = rows.find((entry) => entry.label === label);
  assert(row?.id, `missing IO row for label ${label}: ${JSON.stringify(rows)}`);
  return row.id;
}

async function clickVisible(page, selector, label) {
  const locator = page.locator(selector).first();
  assert(await locator.isVisible().catch(() => false), `${label} must be visible (${selector})`);
  await locator.scrollIntoViewIfNeeded().catch(() => null);
  await locator.click();
}

async function setDesignZoomPreset(page, preset) {
  const button = page.locator(`[data-testid="ide-design-zoom-preset-${preset}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await page.waitForTimeout(120);
  }
}

async function fitCenterZoom(page) {
  for (const selector of ['[data-testid="ide-design-fit-view"]', '[data-testid="ide-design-toolbar-fit"]']) {
    const button = page.locator(selector).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      await page.waitForTimeout(160);
      return;
    }
  }
}

async function assertSurfaceSafe(page, label) {
  await assertBuildHash(page, label);
  await assertNoRootOverflow(page, label);
  const state = await page.evaluate(() => ({
    hasBoundary: Boolean(document.querySelector('[data-testid="error-boundary-fallback"]')),
    rootText: document.body.textContent?.replace(/\s+/g, ' ').slice(0, 1800) ?? '',
  }));
  assert(!state.hasBoundary, `${label}: workspace error boundary visible`);
  assert(!/workspace encountered an error|loading failed|dynamic import/i.test(state.rootText), `${label}: stop-ship workspace load text visible`);
}

async function capture(page, fileName) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fileName), fullPage: true });
}

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}
