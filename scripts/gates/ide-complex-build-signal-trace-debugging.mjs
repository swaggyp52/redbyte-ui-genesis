#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyFail, waitForVerifyResult } from './_verifyStatus.mjs';
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
  'complex-build-signal-trace-debugging',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const RESPONSIVE_CANVAS_TOOL_IDS = new Map([
  ['ide-design-zoom-out', 'ide-design-overflow-zoom-out'],
  ['ide-design-zoom-in', 'ide-design-overflow-zoom-in'],
  ['ide-design-fit-circuit-canvas', 'ide-design-overflow-fit'],
  ['ide-design-zoom-reset', 'ide-design-overflow-reset'],
]);

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE complex-build signal trace debugging satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-complex-build-signal-trace-debugging',
    generatedAtIso: new Date().toISOString(),
    viewports: [],
    browserProblems,
  };

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=complex-build-signal-trace-debugging`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
    await assertSurfaceSafe(page, `${viewport.label} Project startup`);

    await clickVisible(
      page,
      '[data-testid="ide-project-build-fresh-primary"], [data-testid="ide-project-path-build-fresh"]',
      `${viewport.label} Build Fresh`,
    );
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
    await assertSurfaceSafe(page, `${viewport.label} Design fresh`);

    await renameProject(page, `RB Signal Trace Debug ${viewport.label}`);
    await revealDesignLibrary(page);
    await exerciseDesignCamera(page);
    const nodes = await buildWrongFullAdderSumCircuit(page);
    await capture(page, `${viewport.label}-01-two-stage-wrong-sum.png`);

    await openMode(page, baseUrl, 'verify', `complex-build-signal-trace-debugging-${viewport.label}`);
    await assertSurfaceSafe(page, `${viewport.label} Verify startup`);
    const cases = await buildFullAdderSumCases(page);
    await authorInputCases(page, cases);
    await openExpectedAuthoring(page, cases);
    await authorExpectedCases(page, cases);
    await capture(page, `${viewport.label}-02-full-adder-sum-checks.png`);

    await runCompareAndExpectFail(page, `${viewport.label} wrong final OR against full-adder sum expectations`);
    await assertWrongBuildRepairPanel(page, {
      signalLabel: 'SUM_OUT',
      expected: '0',
      observed: '1',
      inputTerms: ['A=1', 'B=0', 'CIN=1'],
    });

    await page.getByTestId('ide-verify-repair-open-design').click();
    await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ide-design-debug-context-banner"]', { timeout: 10000 });
    await assertComplexSignalTracePanel(page, nodes);
    await capture(page, `${viewport.label}-03-design-signal-trace-panel.png`);

    record.viewports.push({
      viewport: viewport.label,
      nodes,
      phase: 'trace-panel-visible',
    });
  }

  await writeFile(
    path.join(ARTIFACT_ROOT, 'complex-build-signal-trace-debugging.json'),
    JSON.stringify(record, null, 2),
  );
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

async function buildWrongFullAdderSumCircuit(page) {
  const nodes = {};
  nodes.A = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw0"]', 'A', { x: 0.1, y: 0.28 });
  nodes.B = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw1"]', 'B', { x: 0.1, y: 0.48 });
  nodes.CIN = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw2"]', 'CIN', { x: 0.1, y: 0.68 });
  nodes.XOR_AB = await placeAndLabel(page, '[data-testid="ide-design-palette-xor"]', 'XOR_AB', { x: 0.38, y: 0.38 });
  nodes.wrongOr = await placeAndLabel(page, '[data-testid="ide-design-palette-or"]', 'wrong_or_should_be_xor', { x: 0.62, y: 0.5 });
  nodes.SUM_OUT = await placeAndLabel(page, '[data-testid="ide-design-board-output-ld0"]', 'SUM_OUT', { x: 0.86, y: 0.5 });

  const wires = [
    [nodes.A, 'out', nodes.XOR_AB, 'a'],
    [nodes.B, 'out', nodes.XOR_AB, 'b'],
    [nodes.XOR_AB, 'out', nodes.wrongOr, 'a'],
    [nodes.CIN, 'out', nodes.wrongOr, 'b'],
    [nodes.wrongOr, 'out', nodes.SUM_OUT, 'in'],
  ];

  for (const wire of wires) {
    await connectPorts(page, ...wire);
  }

  const circuit = await readCircuit(page);
  assert(circuit.nodeCount >= 6, `complex debug circuit must have at least 6 nodes, got ${circuit.nodeCount}`);
  assert(circuit.connectionCount === wires.length, `complex debug circuit should have ${wires.length} wires, got ${circuit.connectionCount}`);
  await fitCenterZoom(page);
  return nodes;
}

async function buildFullAdderSumCases(page) {
  const rows = await readIoRows(page);
  const ids = {
    A: requireRowIdByLabel(rows, 'A'),
    B: requireRowIdByLabel(rows, 'B'),
    CIN: requireRowIdByLabel(rows, 'CIN'),
    SUM_OUT: requireRowIdByLabel(rows, 'SUM_OUT'),
  };
  return [
    { inputs: { [ids.A]: 0, [ids.B]: 0, [ids.CIN]: 0 }, expected: { [ids.SUM_OUT]: 0 } },
    { inputs: { [ids.A]: 1, [ids.B]: 0, [ids.CIN]: 0 }, expected: { [ids.SUM_OUT]: 1 } },
    { inputs: { [ids.A]: 1, [ids.B]: 0, [ids.CIN]: 1 }, expected: { [ids.SUM_OUT]: 0 } },
    { inputs: { [ids.A]: 1, [ids.B]: 1, [ids.CIN]: 1 }, expected: { [ids.SUM_OUT]: 1 } },
  ];
}

async function assertWrongBuildRepairPanel(page, options) {
  await page.waitForSelector('[data-testid="ide-verify-repair-panel"]', { timeout: 10000 });
  const panel = page.locator('[data-testid="ide-verify-repair-panel"]').first();
  const decision = page.locator('[data-testid="ide-verify-repair-decision"]').first();
  assert(await decision.isVisible().catch(() => false), 'wrong-build repair decision must be directly visible');
  assert(
    /expected output wrong.*circuit wrong/i.test(await text(decision)),
    'wrong-build repair must distinguish expected-output repair from circuit repair',
  );
  assert(
    (await page.locator('details[data-testid="ide-verify-advanced-failure"], [data-testid="ide-verify-advanced-failure"] > summary').count()) === 0,
    'retired Failure details disclosure must remain absent',
  );
  const panelText = await text(panel);
  assert(/Compare failed/i.test(panelText), `repair panel must name Compare failed, got "${panelText}"`);
  assert(/expected value is correct|circuit issue|design repair|gate or wire/i.test(panelText), `repair panel must route circuit debugging, got "${panelText}"`);
  assert(panelText.includes(options.signalLabel), `repair panel must show signal ${options.signalLabel}: "${panelText}"`);
  assert(panelText.includes(options.expected), `repair panel must show expected ${options.expected}: "${panelText}"`);
  assert(panelText.includes(options.observed), `repair panel must show observed ${options.observed}: "${panelText}"`);
  for (const inputTerm of options.inputTerms) {
    assert(panelText.includes(inputTerm), `repair panel must show input ${inputTerm}: "${panelText}"`);
  }
  assert(await page.getByTestId('ide-verify-repair-open-design').isVisible(), 'Inspect Design action must be visible');
}

async function assertComplexSignalTracePanel(page, nodes) {
  const bannerText = await text(page.locator('[data-testid="ide-design-debug-context-banner"]').first());
  assert(/SUM_OUT/i.test(bannerText), `Design failure banner must name SUM_OUT, got "${bannerText}"`);
  assert(/wrong_or_should_be_xor/i.test(bannerText), `Design banner must still show the direct wrong OR driver, got "${bannerText}"`);

  const panel = page.locator('[data-testid="ide-design-debug-trace-panel"]').first();
  await panel.waitFor({ state: 'visible', timeout: 10000 });
  const panelText = await text(panel);
  for (const term of ['Signal trace', 'SUM_OUT', 'wrong_or_should_be_xor', 'XOR_AB', 'CIN', 'A', 'B']) {
    assert(panelText.includes(term), `trace panel must include ${term}, got "${panelText}"`);
  }
  assert(/upstream/i.test(panelText), `trace panel must explain upstream logic, got "${panelText}"`);
  assert(/Follow the highlighted/i.test(panelText), `trace panel must instruct student to follow the highlighted path, got "${panelText}"`);

  for (const nodeId of [nodes.SUM_OUT, nodes.wrongOr, nodes.XOR_AB, nodes.CIN, nodes.A, nodes.B]) {
    assert(
      await page.getByTestId(`ide-design-debug-trace-node-${nodeId}`).isVisible().catch(() => false),
      `trace row for ${nodeId} must be visible`,
    );
  }

  await page.getByTestId(`ide-design-debug-trace-focus-${nodes.XOR_AB}`).click();
  await page.waitForFunction(
    (nodeId) => {
      const selection = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection;
      return Boolean(selection?.nodes?.has?.(nodeId));
    },
    nodes.XOR_AB,
    { timeout: 5000 },
  );
}

async function runCompareAndExpectFail(page, label) {
  assert(await setVerifyRunMode(page, 'compare'), `${label}: Compare mode must be selectable`);
  const previousReportHash = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null,
  );
  await clickVerifyRun(page);
  await page.waitForFunction(
    (previous) => {
      const nextHash = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null;
      return Boolean(nextHash && nextHash !== previous);
    },
    previousReportHash,
    { timeout: 20000 },
  );
  await waitForVerifyResult(page, { timeout: 10000 });
  const status = await text(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyFail(status), `${label}: Compare should FAIL, got "${status}"`);
}

async function authorInputCases(page, cases) {
  await ensureCaseCount(page, cases.length);
  for (let tick = 0; tick < cases.length; tick += 1) {
    for (const [fieldId, value] of Object.entries(cases[tick].inputs)) {
      await setInputCell(page, fieldId, tick, value);
    }
  }
}

async function authorExpectedCases(page, cases) {
  for (let tick = 0; tick < cases.length; tick += 1) {
    for (const [fieldId, value] of Object.entries(cases[tick].expected)) {
      await setExpectedCell(page, fieldId, tick, value);
    }
  }
}

async function openExpectedAuthoring(page, cases) {
  const firstOutputId = Object.keys(cases[0]?.expected ?? {})[0];
  assert(Boolean(firstOutputId), 'complex-build scenario must define at least one expected output');
  const firstExpectedCell = page.getByTestId(`ide-stimulus-expected-${firstOutputId}-t0`).first();
  if (await firstExpectedCell.isVisible().catch(() => false)) return;

  const checksWorkspace = page.getByTestId('ide-vcb-workspace-checks').first();
  if (await checksWorkspace.isVisible().catch(() => false)) {
    await checksWorkspace.click();
    await firstExpectedCell.waitFor({ state: 'visible', timeout: 5000 });
    return;
  }

  // Compatibility path for the earlier Verify command bar.
  const authorExpected = page.getByTestId('ide-vcb-author-expected').first();
  const authoringDiagnostics = await page.locator('[data-testid*="expected"], [data-testid*="vcb"]').evaluateAll((elements) =>
    elements.slice(0, 40).map((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        testId: element.getAttribute('data-testid'),
        text: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '',
        display: style.display,
        visibility: style.visibility,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        disabled: element instanceof HTMLButtonElement ? element.disabled : null,
      };
    })
  );
  assert(await authorExpected.isVisible().catch(() => false),
    `Expected-output authoring action must be visible: ${JSON.stringify(authoringDiagnostics)}`);
  assert(await authorExpected.isEnabled().catch(() => false), 'Add expected outputs action must be enabled');
  await authorExpected.click();
  await firstExpectedCell.waitFor({ state: 'visible', timeout: 5000 });
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

async function setExpectedCell(page, fieldId, tick, value) {
  const testId = `ide-stimulus-expected-${fieldId}-t${tick}`;
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
  await page.waitForFunction(
    (knownIds) => {
      const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
      return nodes.some((node) => !knownIds.includes(node.id));
    },
    before,
    { timeout: 8000 },
  );
  const after = await readNodeIds(page);
  const added = after.filter((id) => !before.includes(id));
  assert(added.length >= 1, `placing ${selector} did not add a node`);
  return added.at(-1);
}

async function editNodeLabel(page, nodeId, label) {
  await clickNode(page, nodeId);
  const edit = page.locator('[data-testid="ide-design-label-edit-btn"]').first();
  await edit.waitFor({ state: 'visible', timeout: 8000 });
  await edit.click();
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
  await body.waitFor({ state: 'visible', timeout: 8000 });
  await body.click();
  if (await activeWireStart(page)) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort,
      { timeout: 5000 },
    );
    await body.click();
  }
  await page.waitForFunction(
    (expectedNodeId) => {
      const selection = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection;
      return selection?.nodes?.size === 1 && selection.nodes.has(expectedNodeId);
    },
    nodeId,
    { timeout: 5000 },
  );
}

async function clickPort(page, nodeId, portName) {
  const port = page.locator(`[data-node-id="${nodeId}"] [data-port-id="${portName}"]`).first();
  await port.waitFor({ state: 'visible', timeout: 8000 });
  await port.click();
}

async function connectPorts(page, fromNodeId, fromPort, toNodeId, toPort) {
  const before = await readCircuit(page);
  await clickPort(page, fromNodeId, fromPort);
  assert(await activeWireStart(page), `clicking ${fromNodeId}.${fromPort} must start a wire`);
  await clickPort(page, toNodeId, toPort);
  await waitForConnectionCount(page, before.connectionCount + 1, `connect ${fromNodeId}.${fromPort}->${toNodeId}.${toPort}`);
}

async function waitForConnectionCount(page, expected, label) {
  await page.waitForFunction(
    (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) === count,
    expected,
    { timeout: 8000 },
  );
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

async function exerciseDesignCamera(page) {
  assert(
    !(await page.getByTestId('ide-design-view-tools-toggle').first().isVisible().catch(() => false)),
    'Design camera controls must remain available without the obsolete View tools disclosure',
  );

  await clickCanvasTool(page, 'ide-design-zoom-reset', 'Reset zoom');
  await page.waitForTimeout(180);
  const resetCamera = await readDesignCamera(page, 'reset zoom');

  await clickCanvasTool(page, 'ide-design-zoom-out', 'Zoom out');
  const zoomedOut = await waitForDesignZoomChange(page, resetCamera.zoom, 'zoom out');
  assert(
    zoomedOut.zoom < resetCamera.zoom,
    `Zoom out must reduce the live camera zoom (${resetCamera.zoom} -> ${zoomedOut.zoom})`,
  );

  await clickCanvasTool(page, 'ide-design-zoom-in', 'Zoom in');
  const zoomedIn = await waitForDesignZoomChange(page, zoomedOut.zoom, 'zoom in');
  assert(
    zoomedIn.zoom > zoomedOut.zoom,
    `Zoom in must increase the live camera zoom (${zoomedOut.zoom} -> ${zoomedIn.zoom})`,
  );

  await clickCanvasTool(page, 'ide-design-zoom-reset', 'Reset zoom');
  await page.waitForTimeout(180);
  const readyCamera = await readDesignCamera(page, 'camera reset after direct controls');
  assert(
    Math.abs(readyCamera.zoom - resetCamera.zoom) < 0.001,
    `Reset zoom must restore its live camera baseline (${resetCamera.zoom} vs ${readyCamera.zoom})`,
  );
}

async function fitCenterZoom(page) {
  const before = await readDesignCamera(page, 'before Fit circuit');
  await clickCanvasTool(page, 'ide-design-fit-circuit-canvas', 'Fit circuit');
  await page.waitForFunction(
    (previous) => {
      const camera = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.camera;
      return Boolean(
        camera &&
          Number.isFinite(camera.x) &&
          Number.isFinite(camera.y) &&
          Number.isFinite(camera.zoom) &&
          (Math.abs(camera.x - previous.x) > 0.001 ||
            Math.abs(camera.y - previous.y) > 0.001 ||
            Math.abs(camera.zoom - previous.zoom) > 0.001),
      );
    },
    before,
    { timeout: 5000 },
  );
  await readDesignCamera(page, 'after Fit circuit');
}

async function clickCanvasTool(page, primaryTestId, label) {
  let control = page.getByTestId(primaryTestId).first();
  let overflow = null;
  let closeOverflow = false;

  if (!(await control.isVisible().catch(() => false))) {
    const responsiveTestId = RESPONSIVE_CANVAS_TOOL_IDS.get(primaryTestId);
    assert(Boolean(responsiveTestId), `${label}: missing responsive camera mapping for ${primaryTestId}`);
    overflow = page.getByTestId('ide-design-toolbar-overflow').first();
    assert(await overflow.isVisible().catch(() => false), `${label}: More tools must be visible`);
    closeOverflow = (await overflow.getAttribute('open')) === null;
    if (closeOverflow) await overflow.locator('summary').click();
    control = page.getByTestId(responsiveTestId).first();
  }

  await control.waitFor({ state: 'visible', timeout: 5000 });
  assert(await control.isEnabled(), `${label} camera control must be enabled`);
  await control.click();

  if (closeOverflow && overflow && (await overflow.getAttribute('open')) !== null) {
    await overflow.locator('summary').click();
  }
}

async function waitForDesignZoomChange(page, previousZoom, label) {
  await page.waitForFunction(
    (previous) => {
      const zoom = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.camera?.zoom;
      return Number.isFinite(zoom) && Math.abs(zoom - previous) > 0.001;
    },
    previousZoom,
    { timeout: 5000 },
  );
  return readDesignCamera(page, label);
}

async function readDesignCamera(page, label) {
  const snapshot = await page.evaluate(() => {
    const camera = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.camera ?? null;
    return {
      camera: camera ? { x: camera.x, y: camera.y, zoom: camera.zoom } : null,
      readback:
        document.querySelector('[data-testid="ide-design-canvas-stat-zoom"]')?.textContent?.trim() ?? '',
    };
  });
  assert(
    snapshot.camera &&
      Number.isFinite(snapshot.camera.x) &&
      Number.isFinite(snapshot.camera.y) &&
      Number.isFinite(snapshot.camera.zoom) &&
      snapshot.camera.zoom > 0,
    `${label}: camera state must remain finite, got ${JSON.stringify(snapshot.camera)}`,
  );
  const readbackPercent = Number(/([0-9]+(?:\.[0-9]+)?)\s*%/.exec(snapshot.readback)?.[1] ?? Number.NaN);
  assert(Number.isFinite(readbackPercent), `${label}: zoom readback must expose a percentage, got "${snapshot.readback}"`);
  assert(
    Math.abs(readbackPercent - snapshot.camera.zoom * 100) <= 1.5,
    `${label}: zoom readback must match live camera state (${snapshot.readback} vs ${snapshot.camera.zoom})`,
  );
  return snapshot.camera;
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
