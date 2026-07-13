#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  runIdeGate,
} from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'wrong-build-recovery-correction-flow',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE wrong-build recovery correction flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-wrong-build-recovery-correction-flow',
    generatedAtIso: new Date().toISOString(),
    viewports: [],
    browserProblems,
  };

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const viewportRecord = { viewport: viewport.label, paths: [] };
    record.viewports.push(viewportRecord);

    viewportRecord.paths.push(await runWrongExpectedFlow(page, baseUrl, viewport.label));
    viewportRecord.paths.push(await runWrongCircuitFlow(page, baseUrl, viewport.label));
    viewportRecord.paths.push(await runDisconnectedOutputFlow(page, baseUrl, viewport.label));
  }

  await writeFile(
    path.join(ARTIFACT_ROOT, 'wrong-build-recovery-correction-flow.json'),
    JSON.stringify(record, null, 2),
  );
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function runWrongExpectedFlow(page, baseUrl, viewportLabel) {
  await startBlankProject(page, baseUrl, `wrong-build-recovery-a-${viewportLabel}`, `Wrong expected ${viewportLabel}`);
  await revealDesignLibrary(page);
  await setDesignZoomPreset(page, '50');
  await buildTwoInputCircuit(page, 'XOR', 'XOR_OUT');
  await assertSurfaceSafe(page, `${viewportLabel}/A correct XOR design`);
  await capture(page, `${viewportLabel}-a-01-correct-xor-design.png`);

  await openMode(page, baseUrl, 'verify', `wrong-build-recovery-a-${viewportLabel}`);
  const cases = await buildXorCases(page, 'XOR_OUT');
  await authorInputCases(page, cases);
  await authorExpectedCases(page, cases);
  await runCompare(page, 'wrong expected baseline', 'pass');

  const outputId = cases[3].outputId;
  await setExpectedCell(page, outputId, 3, 1);
  await runCompare(page, 'wrong expected output', 'fail');
  await assertVisibleFailureAuthority(page, `${viewportLabel}/A`);
  await openFailureDetails(page, `${viewportLabel}/A`);
  const panel = page.locator('[data-testid="ide-verify-repair-panel"]').first();
  const panelText = await text(panel);
  assert(/Use observed only when the circuit behavior is correct/i.test(panelText), `${viewportLabel}/A must explain Use observed boundary, got "${panelText}"`);
  assert(await page.getByTestId('ide-verify-repair-use-observed').isVisible().catch(() => false), `${viewportLabel}/A must expose Use observed`);
  assert(await page.getByTestId('ide-verify-repair-edit-expected').isVisible().catch(() => false), `${viewportLabel}/A must expose expected edit path`);
  await capture(page, `${viewportLabel}-a-02-wrong-expected-fail.png`);

  await page.getByTestId('ide-verify-repair-use-observed').click();
  await page.getByTestId('ide-verify-repair-rerun').click();
  await waitForVerifyStatus(page, /PASS|Compare PASS|Checks aligned/i, `${viewportLabel}/A repaired expected output`);
  await capture(page, `${viewportLabel}-a-03-use-observed-repaired-pass.png`);
  return { path: 'A wrong expected output', panelText };
}

async function runWrongCircuitFlow(page, baseUrl, viewportLabel) {
  await startBlankProject(page, baseUrl, `wrong-build-recovery-b-${viewportLabel}`, `Wrong circuit ${viewportLabel}`);
  await revealDesignLibrary(page);
  await setDesignZoomPreset(page, '50');
  await buildTwoInputCircuit(page, 'OR', 'XOR_OUT');
  await assertSurfaceSafe(page, `${viewportLabel}/B wrong OR design`);
  await capture(page, `${viewportLabel}-b-01-wrong-or-design.png`);

  await openMode(page, baseUrl, 'verify', `wrong-build-recovery-b-${viewportLabel}`);
  const cases = await buildXorCases(page, 'XOR_OUT');
  await authorInputCases(page, cases);
  await authorExpectedCases(page, cases);
  await runCompare(page, 'wrong OR circuit', 'fail');
  await assertVisibleFailureAuthority(page, `${viewportLabel}/B`);
  await openFailureDetails(page, `${viewportLabel}/B`);
  const panel = page.locator('[data-testid="ide-verify-repair-panel"]').first();
  const panelText = await text(panel);
  const category = await panel.getAttribute('data-category');
  assert(/Inspect Design/i.test(panelText), `${viewportLabel}/B must offer Inspect Design, got "${panelText}"`);
  assert(/gate or wire|checking the circuit path|expected output is correct/i.test(panelText), `${viewportLabel}/B must steer circuit repair, got "${panelText}"`);
  assert(/Use observed only/i.test(panelText), `${viewportLabel}/B must warn against blind observed-value repair, got "${panelText}"`);
  assert(
    category === 'design-output-wrong' || category === 'possible-wrong-gate-or-wire',
    `${viewportLabel}/B diagnosis category must be design-oriented, got "${category}"`,
  );
  await capture(page, `${viewportLabel}-b-02-wrong-circuit-fail.png`);

  await page.getByTestId('ide-verify-repair-open-design').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-debug-context-banner"]', { timeout: 10000 });
  const designText = await text(page.locator('[data-testid="ide-design-debug-context-banner"]').first());
  assert(/XOR_OUT/i.test(designText), `${viewportLabel}/B Design handoff must name failed output, got "${designText}"`);
  assert(/OR|wrong_or_should_be_xor|Driver/i.test(designText), `${viewportLabel}/B Design handoff must show driver context, got "${designText}"`);
  await capture(page, `${viewportLabel}-b-03-design-driver-context.png`);
  return { path: 'B wrong circuit OR instead of XOR', panelText, category, designText };
}

async function runDisconnectedOutputFlow(page, baseUrl, viewportLabel) {
  await startBlankProject(page, baseUrl, `wrong-build-recovery-c-${viewportLabel}`, `Disconnected ${viewportLabel}`);
  await revealDesignLibrary(page);
  await setDesignZoomPreset(page, '50');
  await placeAndLabel(page, '[data-testid="ide-design-board-input-sw0"]', 'A', { x: 0.18, y: 0.44 });
  await placeAndLabel(page, '[data-testid="ide-design-board-output-ld0"]', 'OUT', { x: 0.78, y: 0.44 });
  await assertSurfaceSafe(page, `${viewportLabel}/C disconnected output design`);
  await capture(page, `${viewportLabel}-c-01-disconnected-output-design.png`);

  await openMode(page, baseUrl, 'verify', `wrong-build-recovery-c-${viewportLabel}`);
  const rows = await readIoRows(page);
  const inputId = requireRowIdByLabel(rows, 'A');
  const outputId = requireRowIdByLabel(rows, 'OUT');
  const cases = [
    { inputs: { [inputId]: 0 }, expected: { [outputId]: 0 }, outputId },
    { inputs: { [inputId]: 1 }, expected: { [outputId]: 1 }, outputId },
  ];
  await authorInputCases(page, cases);
  await authorExpectedCases(page, cases);
  await runCompare(page, 'disconnected output', 'fail');

  await openFailureDetails(page, `${viewportLabel}/C`);
  await page.waitForSelector('[data-testid="ide-verify-structural-recovery-panel"]', { timeout: 10000 });
  const structuralText = await text(page.locator('[data-testid="ide-verify-structural-recovery-panel"]').first());
  assert(/OUT/i.test(structuralText), `${viewportLabel}/C must name missing output OUT, got "${structuralText}"`);
  assert(/connect a driver/i.test(structuralText), `${viewportLabel}/C must tell the student to connect a driver, got "${structuralText}"`);
  assert(/Open Design/i.test(structuralText), `${viewportLabel}/C must offer Open Design, got "${structuralText}"`);
  await capture(page, `${viewportLabel}-c-02-disconnected-output-recovery.png`);

  await page.getByTestId('ide-verify-structural-open-design').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  await capture(page, `${viewportLabel}-c-03-open-design-to-reconnect-output.png`);
  return { path: 'C disconnected output', structuralText };
}

async function assertVisibleFailureAuthority(page, label) {
  const summary = page.getByTestId('ide-verify-results-summary').first();
  await summary.waitFor({ state: 'visible', timeout: 10000 });
  assert((await summary.getAttribute('data-kind')) === 'fail', `${label}: visible result authority must be FAIL`);
  const guidance = await text(page.getByTestId('ide-verify-results-guidance').first());
  assert(/Expected value is incorrect/i.test(guidance), `${label}: visible FAIL guidance must mention expected values`);
  assert(/Circuit logic is incorrect/i.test(guidance), `${label}: visible FAIL guidance must mention circuit logic`);
  assert(/Output is disconnected/i.test(guidance), `${label}: visible FAIL guidance must mention disconnected outputs`);
}

async function openFailureDetails(page, label) {
  const details = page.getByTestId('ide-verify-advanced-failure').first();
  await details.waitFor({ state: 'visible', timeout: 10000 });
  if ((await details.getAttribute('open')) === null) {
    await details.locator('summary').click();
  }
  assert((await details.getAttribute('open')) !== null, `${label}: Failure details must expand`);
}

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

async function startBlankProject(page, baseUrl, gateLabel, projectName) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=${gateLabel}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertSurfaceSafe(page, `${gateLabel}/Project startup`);
  await clickVisible(
    page,
    '[data-testid="ide-project-build-fresh-primary"], [data-testid="ide-project-path-build-fresh"]',
    'Build Fresh',
  );
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  await renameProject(page, projectName);
}

async function buildTwoInputCircuit(page, gateType, outputLabel) {
  const nodes = {};
  nodes.A = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw0"]', 'A', { x: 0.12, y: 0.35 });
  nodes.B = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw1"]', 'B', { x: 0.12, y: 0.58 });
  const gateSelector = gateType === 'XOR' ? '[data-testid="ide-design-palette-xor"]' : '[data-testid="ide-design-palette-or"]';
  nodes.gate = await placeAndLabel(
    page,
    gateSelector,
    gateType === 'XOR' ? 'xor_gate' : 'wrong_or_should_be_xor',
    { x: 0.48, y: 0.46 },
  );
  nodes.out = await placeAndLabel(page, '[data-testid="ide-design-board-output-ld0"]', outputLabel, { x: 0.84, y: 0.46 });
  await connectPorts(page, nodes.A, 'out', nodes.gate, 'a');
  await connectPorts(page, nodes.B, 'out', nodes.gate, 'b');
  await connectPorts(page, nodes.gate, 'out', nodes.out, 'in');
  await fitCenterZoom(page);
  return nodes;
}

async function buildXorCases(page, outputLabel) {
  const rows = await readIoRows(page);
  const ids = {
    A: requireRowIdByLabel(rows, 'A'),
    B: requireRowIdByLabel(rows, 'B'),
    OUT: requireRowIdByLabel(rows, outputLabel),
  };
  return [
    { inputs: { [ids.A]: 0, [ids.B]: 0 }, expected: { [ids.OUT]: 0 }, outputId: ids.OUT },
    { inputs: { [ids.A]: 0, [ids.B]: 1 }, expected: { [ids.OUT]: 1 }, outputId: ids.OUT },
    { inputs: { [ids.A]: 1, [ids.B]: 0 }, expected: { [ids.OUT]: 1 }, outputId: ids.OUT },
    { inputs: { [ids.A]: 1, [ids.B]: 1 }, expected: { [ids.OUT]: 0 }, outputId: ids.OUT },
  ];
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

async function runCompare(page, label, expectation) {
  await setVerifyRunMode(page, 'compare');
  const previousReportHash = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null);
  await page.getByTestId('ide-vcb-run').click();
  await page.waitForFunction(
    (previous) => {
      const nextHash = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null;
      return Boolean(nextHash && nextHash !== previous);
    },
    previousReportHash,
    { timeout: 20000 },
  );
  const expectedPattern = expectation === 'pass' ? /PASS|Compare PASS|Checks aligned/i : /FAIL|Compare FAIL|Checks need review/i;
  await waitForVerifyStatus(page, expectedPattern, label);
}

async function waitForVerifyStatus(page, pattern, label = 'verify status') {
  await page.waitForFunction(
    (source) => {
      const re = new RegExp(source, 'i');
      const status = document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? '';
      return re.test(status);
    },
    pattern.source,
    { timeout: 15000 },
  ).catch(async () => {
    const state = await page.evaluate(() => ({
      status: document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent ?? '',
      primary: document.querySelector('[data-testid="ide-verify-primary-status"]')?.textContent ?? '',
      run: document.querySelector('[data-testid="ide-vcb-run"]')?.textContent ?? '',
    }));
    throw new Error(`${label}: status did not match ${pattern}: ${JSON.stringify(state)}`);
  });
}

async function ensureCaseCount(page, desired) {
  await page.waitForSelector('[data-testid="ide-stimulus-add-tick"]', { timeout: 15000 });
  for (let guard = 0; guard < desired + 4; guard += 1) {
    const count = await readTickCount(page);
    if (count >= desired) return;
    await page.locator('[data-testid="ide-stimulus-add-tick"]').first().click();
    await page.waitForTimeout(120);
  }
  throw new Error(`could not create ${desired} Verify cases`);
}

async function setInputCell(page, fieldId, tick, value) {
  await toggleCellToValue(page, `ide-stimulus-cell-${fieldId}-t${tick}`, value);
}

async function setExpectedCell(page, fieldId, tick, value) {
  await toggleCellToValue(page, `ide-stimulus-expected-${fieldId}-t${tick}`, value);
}

async function toggleCellToValue(page, testId, value) {
  const cell = page.getByTestId(testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readCellValue(page, testId);
    if (current === value) return;
    await cell.click();
    await page.waitForTimeout(100);
  }
  const current = await readCellValue(page, testId);
  if (current !== value) throw new Error(`expected ${testId} to become ${value}, got ${current}`);
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

async function setVerifyRunMode(page, mode) {
  const selector = mode === 'compare' ? '[data-testid="ide-vcb-use-saved-checks"]' : '[data-testid="ide-vcb-observe-only"]';
  const button = page.locator(selector).first();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  const isPressed = (await button.getAttribute('aria-pressed').catch(() => 'false')) === 'true';
  if (!isPressed) await button.click();
}

async function openMode(page, baseUrl, mode, gateLabel) {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&gate=${gateLabel}-${mode}`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
}

async function renameProject(page, name) {
  const title = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  if (!(await title.isVisible().catch(() => false))) return;
  await title.dblclick();
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(name);
  await input.press('Enter');
}

async function revealDesignLibrary(page) {
  const palette = page.locator('[data-testid="ide-design-dock-palette"]').first();
  if (await palette.isVisible().catch(() => false)) return;
  const toggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"], [data-testid="ide-design-library-toggle"]').first();
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
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
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-design-live-canvas"]')?.getAttribute('data-placement-active') === '1',
    { timeout: 5000 },
  );
  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error(`design canvas bounds unavailable for ${selector}`);
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
  return after.filter((id) => !before.includes(id)).at(-1);
}

async function editNodeLabel(page, nodeId, label) {
  await clickNode(page, nodeId);
  await clickVisible(page, '[data-testid="ide-design-label-edit-btn"]', `label edit for ${nodeId}`);
  const input = page.locator('[data-testid="ide-design-label-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(label);
  await page.locator('[data-testid="ide-design-label-save"]').first().click();
}

async function clickNode(page, nodeId) {
  const body = page.locator(`[data-node-id="${nodeId}"] .logic-node-body`).first();
  await body.scrollIntoViewIfNeeded();
  const box = await body.boundingBox();
  if (!box) throw new Error(`node ${nodeId} has no clickable box`);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  if (await activeWireStart(page)) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort, { timeout: 5000 });
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  }
}

async function connectPorts(page, fromNodeId, fromPort, toNodeId, toPort) {
  const before = await readCircuit(page);
  await clickPort(page, fromNodeId, fromPort);
  if (!(await activeWireStart(page))) throw new Error(`clicking ${fromNodeId}.${fromPort} did not start a wire`);
  await clickPort(page, toNodeId, toPort);
  await page.waitForFunction(
    (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) === count,
    before.connectionCount + 1,
    { timeout: 8000 },
  );
}

async function clickPort(page, nodeId, portName) {
  const port = page.locator(`[data-node-id="${nodeId}"] [data-port-id="${portName}"]`).first();
  await port.waitFor({ state: 'visible', timeout: 8000 });
  const box = await port.boundingBox();
  if (!box) throw new Error(`port ${nodeId}.${portName} has no clickable box`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function moveNodeToCanvasFraction(page, nodeId, position) {
  const node = page.locator(`[data-node-id="${nodeId}"] .logic-node-body`).first();
  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const nodeBox = await node.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!nodeBox || !canvasBox) return;
  const start = { x: nodeBox.x + nodeBox.width / 2, y: nodeBox.y + nodeBox.height / 2 };
  const target = { x: canvasBox.x + canvasBox.width * position.x, y: canvasBox.y + canvasBox.height * position.y };
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
    return { nodeCount: circuit.nodes?.length ?? 0, connectionCount: circuit.connections?.length ?? 0 };
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
  if (!row?.id) throw new Error(`missing IO row for label ${label}: ${JSON.stringify(rows)}`);
  return row.id;
}

async function clickVisible(page, selector, label) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  await locator.scrollIntoViewIfNeeded().catch(() => null);
  await locator.click().catch((error) => {
    throw new Error(`${label} was visible but not clickable: ${error instanceof Error ? error.message : String(error)}`);
  });
}

async function setDesignZoomPreset(page, preset) {
  const button = page.locator(`[data-testid="ide-design-zoom-preset-${preset}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await page.waitForTimeout(120);
  }
}

async function fitCenterZoom(page) {
  const button = page.locator('[data-testid="ide-design-fit-view"], [data-testid="ide-design-toolbar-fit"]').first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await page.waitForTimeout(160);
  }
}

async function assertSurfaceSafe(page, label) {
  await assertBuildHash(page, label);
  await assertNoRootOverflow(page, label);
}

async function capture(page, fileName) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fileName), fullPage: true });
}

async function text(locator) {
  return (await locator.first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() ?? '';
}
