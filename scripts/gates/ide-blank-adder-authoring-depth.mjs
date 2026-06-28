#!/usr/bin/env node

/**
 * Round 3 blank-adder authoring-depth gate.
 *
 * This is intentionally a real-browser workflow gate: Project -> blank Design
 * authoring -> Verify PASS/FAIL/repair -> Hardware mapping -> Export ZIP.
 * It reads runtime state only for assertions and artifact evidence.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  assert,
  clickVerifyRun,
  runIdeGate,
  saveObservedOutputs,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import {
  CLASSROOM_VIEWPORTS,
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
  openMode,
} from './_workbenchReconstructionHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(path.resolve(__dirname, '../../packages/rb-apps/package.json'));
const JSZip = require('jszip');

const ARTIFACT_ROOT = path.join(process.cwd(), '.redbyte', 'product-immersion', 'blank-adder-authoring-depth');
const SCREENSHOT_ROOT = path.join(ARTIFACT_ROOT, 'screenshots');

const PRIMITIVE_CASES = [
  { name: '000', inputs: { sw0: 0, sw1: 0, sw2: 0 }, expected: { ld0: 0, ld1: 0 } },
  { name: '010', inputs: { sw0: 0, sw1: 1, sw2: 0 }, expected: { ld0: 1, ld1: 0 } },
  { name: '110', inputs: { sw0: 1, sw1: 1, sw2: 0 }, expected: { ld0: 0, ld1: 1 } },
  { name: '111', inputs: { sw0: 1, sw1: 1, sw2: 1 }, expected: { ld0: 1, ld1: 1 } },
];

const ADDER4_CASES = [
  {
    name: '0000+0000+0',
    inputs: { sw0: 0, sw1: 0, sw2: 0, sw3: 0, sw4: 0, sw5: 0, sw6: 0, sw7: 0, sw8: 0 },
    expected: { ld0: 0, ld1: 0, ld2: 0, ld3: 0, ld4: 0 },
  },
  {
    name: '0001+0001+0',
    inputs: { sw0: 1, sw1: 0, sw2: 0, sw3: 0, sw4: 1, sw5: 0, sw6: 0, sw7: 0, sw8: 0 },
    expected: { ld0: 0, ld1: 1, ld2: 0, ld3: 0, ld4: 0 },
  },
  {
    name: '1111+0001+0',
    inputs: { sw0: 1, sw1: 1, sw2: 1, sw3: 1, sw4: 1, sw5: 0, sw6: 0, sw7: 0, sw8: 0 },
    expected: { ld0: 0, ld1: 0, ld2: 0, ld3: 0, ld4: 1 },
  },
  {
    name: '1010+0101+0',
    inputs: { sw0: 0, sw1: 1, sw2: 0, sw3: 1, sw4: 1, sw5: 0, sw6: 1, sw7: 0, sw8: 0 },
    expected: { ld0: 1, ld1: 1, ld2: 1, ld3: 1, ld4: 0 },
  },
  {
    name: '0111+0000+1',
    inputs: { sw0: 1, sw1: 1, sw2: 1, sw3: 0, sw4: 0, sw5: 0, sw6: 0, sw7: 0, sw8: 1 },
    expected: { ld0: 0, ld1: 0, ld2: 0, ld3: 1, ld4: 0 },
  },
];

await runIdeGate('IDE blank 4-bit adder authoring depth satisfied', async ({ page, baseUrl }) => {
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  const browserProblems = captureBrowserProblems(page);
  const records = [];
  const failures = [];

  await installCleanStudentContext(page);
  page.on('dialog', async (dialog) => dialog.accept().catch(() => null));

  for (const viewport of CLASSROOM_VIEWPORTS) {
    const record = { viewport: viewport.label, phases: [] };
    records.push(record);
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await runRound3Viewport(page, baseUrl, viewport, record);
    } catch (error) {
      record.error = error instanceof Error ? error.message : String(error);
      await captureProof(page, viewport, 'failure', record).catch(() => null);
      failures.push(`${viewport.label}: ${record.error}`);
    }
  }

  await fs.writeFile(
    path.join(ARTIFACT_ROOT, 'blank-adder-authoring-depth.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), records, browserProblems }, null, 2)
  );

  assert(browserProblems.length === 0, `Blank adder browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Blank adder authoring-depth failures:\n${failures.join('\n')}`);
});

async function runRound3Viewport(page, baseUrl, viewport, record) {
  await startFreshProject(page, baseUrl, viewport, record);
  await provePrimitiveAdder(page, viewport, record);
  await provePrimitiveVerify(page, baseUrl, viewport, record);

  await startFreshProject(page, baseUrl, viewport, record, { suffix: '4bit' });
  await proveFourBitAdder(page, viewport, record);
  await proveFourBitVerify(page, baseUrl, viewport, record);
  await proveHardwareMapping(page, baseUrl, viewport, record);
  await proveExportPackage(page, baseUrl, viewport, record);
}

async function startFreshProject(page, baseUrl, viewport, record, options = {}) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=blank-adder-authoring-depth-${viewport.label}-${options.suffix ?? 'primitive'}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertSurfaceSafe(page, `${viewport.label}/Project`);

  await clickVisible(page, '[data-testid="ide-project-build-fresh-primary"], [data-testid="ide-project-path-build-fresh"]', `${viewport.label}: Build Fresh`);
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  await assertSurfaceSafe(page, `${viewport.label}/Design fresh`);

  const projectName = options.suffix === '4bit'
    ? 'RB Blank Adder Authoring Depth 4-bit'
    : 'RB Blank Adder Authoring Depth';
  await renameProject(page, projectName, viewport);
  await revealDesignLibrary(page);
  await setDesignZoomPreset(page, '50');
  await captureProof(page, viewport, `${options.suffix ?? 'primitive'}-fresh-design`, record);
}

async function provePrimitiveAdder(page, viewport, record) {
  const nodes = {};
  nodes.A = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw0"]', 'A', { x: 0.13, y: 0.36 });
  nodes.B = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw1"]', 'B', { x: 0.13, y: 0.52 });
  nodes.Cin = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw2"]', 'Cin', { x: 0.13, y: 0.70 });
  nodes.xorAB = await placeAndLabel(page, '[data-testid="ide-design-palette-xor"]', 'xor_ab', { x: 0.36, y: 0.42 });
  nodes.sumXor = await placeAndLabel(page, '[data-testid="ide-design-palette-xor"]', 'sum_xor', { x: 0.56, y: 0.48 });
  nodes.carryAB = await placeAndLabel(page, '[data-testid="ide-design-palette-and"]', 'carry_ab', { x: 0.36, y: 0.68 });
  nodes.carryCin = await placeAndLabel(page, '[data-testid="ide-design-palette-and"]', 'carry_cin', { x: 0.56, y: 0.72 });
  nodes.coutOr = await placeAndLabel(page, '[data-testid="ide-design-palette-or"]', 'cout_or', { x: 0.75, y: 0.68 });
  nodes.Sum = await placeAndLabel(page, '[data-testid="ide-design-board-output-ld0"]', 'Sum', { x: 0.88, y: 0.46 });
  nodes.Cout = await placeAndLabel(page, '[data-testid="ide-design-board-output-ld1"]', 'Cout', { x: 0.88, y: 0.70 });

  await assertNodeLabels(page, ['A', 'B', 'Cin', 'xor_ab', 'sum_xor', 'carry_ab', 'carry_cin', 'cout_or', 'Sum', 'Cout']);
  await proveInvalidCancelDeleteUndoAndMove(page, nodes, viewport);

  const wires = [
    [nodes.A, 'out', nodes.xorAB, 'a'],
    [nodes.B, 'out', nodes.xorAB, 'b'],
    [nodes.A, 'out', nodes.carryAB, 'a'],
    [nodes.B, 'out', nodes.carryAB, 'b'],
    [nodes.xorAB, 'out', nodes.sumXor, 'a'],
    [nodes.Cin, 'out', nodes.sumXor, 'b'],
    [nodes.xorAB, 'out', nodes.carryCin, 'a'],
    [nodes.Cin, 'out', nodes.carryCin, 'b'],
    [nodes.carryAB, 'out', nodes.coutOr, 'a'],
    [nodes.carryCin, 'out', nodes.coutOr, 'b'],
    [nodes.sumXor, 'out', nodes.Sum, 'in'],
    [nodes.coutOr, 'out', nodes.Cout, 'in'],
  ];
  for (const wire of wires) {
    await connectPorts(page, ...wire);
  }
  const circuit = await readCircuit(page);
  assert(circuit.connectionCount === 12, `${viewport.label}: primitive full adder must have 12 wires, got ${circuit.connectionCount}`);
  record.phases.push({ phase: 'primitive-design', nodes: circuit.nodeCount, connections: circuit.connectionCount });
  await fitCenterZoom(page);
  await captureProof(page, viewport, 'primitive-design-complete', record);
}

async function proveInvalidCancelDeleteUndoAndMove(page, nodes, viewport) {
  const beforeInvalid = await readCircuit(page);
  await clickPort(page, nodes.A, 'out');
  const armedInvalidSource = await activeWireStart(page);
  assert(armedInvalidSource, `${viewport.label}: source output must arm a wire before invalid target test`);
  await clickPort(page, nodes.B, 'out');
  await waitForConnectionCount(page, beforeInvalid.connectionCount, `${viewport.label}: invalid output-to-output target must not add a wire`);
  const afterInvalid = await readCircuit(page);
  const activeAfterInvalid = await readActiveWireState(page);
  assert(
    afterInvalid.connectionCount === beforeInvalid.connectionCount,
    `${viewport.label}: invalid target mutated circuit ${beforeInvalid.connectionCount} -> ${afterInvalid.connectionCount}`
  );
  assert(!activeAfterInvalid.active, `${viewport.label}: invalid target must cancel the in-progress wire ${JSON.stringify(activeAfterInvalid)}`);

  await clickPort(page, nodes.A, 'out');
  assert(await activeWireStart(page), `${viewport.label}: valid source click must start a wire preview`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort, { timeout: 5000 });
  await waitForConnectionCount(page, beforeInvalid.connectionCount, `${viewport.label}: Escape cancel must not add a wire`);

  await connectPorts(page, nodes.A, 'out', nodes.xorAB, 'a');
  await selectFirstWireByEndpoint(page, nodes.A, nodes.xorAB);
  await clickVisible(page, '[data-testid="ide-design-tool-delete"]', `${viewport.label}: delete selected wire`);
  await waitForConnectionCount(page, beforeInvalid.connectionCount, `${viewport.label}: selected wire delete`);
  await clickVisible(page, '[data-testid="ide-design-tool-undo"]', `${viewport.label}: undo selected wire delete`);
  await waitForConnectionCount(page, beforeInvalid.connectionCount + 1, `${viewport.label}: undo wire delete`);
  await selectFirstWireByEndpoint(page, nodes.A, nodes.xorAB);
  await clickVisible(page, '[data-testid="ide-design-tool-delete"]', `${viewport.label}: cleanup temporary wire`);
  await waitForConnectionCount(page, beforeInvalid.connectionCount, `${viewport.label}: cleanup temporary wire`);

  const beforeMove = await readCircuit(page);
  await dragNode(page, nodes.xorAB, 34, 22);
  const afterMove = await readCircuit(page);
  assert(afterMove.connectionCount === beforeMove.connectionCount, `${viewport.label}: moving a connected component changed wire count`);
  assert(afterMove.positionsFinite, `${viewport.label}: moving a component produced non-finite node coordinates`);
}

async function provePrimitiveVerify(page, baseUrl, viewport, record) {
  await openMode(page, baseUrl, 'verify', `blank-adder-authoring-depth-${viewport.label}-primitive`);
  const cases = await buildPrimitiveCases(page);
  await authorInputCases(page, cases);
  await runObserveSaveAndAssertExpected(page, cases, viewport, 'primitive');
  await runCompareAndExpect(page, viewport, 'primitive initial', 'pass');
  await flipExpectedCell(page, cases[1].outputIds.Sum, 1);
  await runCompareAndExpect(page, viewport, 'primitive intentional mismatch', 'fail');
  await setExpectedCells(page, cases);
  await runCompareAndExpect(page, viewport, 'primitive repaired', 'pass');
  record.phases.push({ phase: 'primitive-verify', cases: cases.map((entry) => entry.name) });
  await captureProof(page, viewport, 'primitive-verify-pass', record);
}

async function proveFourBitAdder(page, viewport, record) {
  const nodes = {};
  for (let bit = 0; bit < 4; bit += 1) {
    nodes[`A${bit}`] = await placeAndLabel(page, `[data-testid="ide-design-board-input-sw${bit}"]`, `A${bit}`, { x: 0.10, y: 0.30 + bit * 0.10 });
    nodes[`B${bit}`] = await placeAndLabel(page, `[data-testid="ide-design-board-input-sw${bit + 4}"]`, `B${bit}`, { x: 0.24, y: 0.30 + bit * 0.10 });
  }
  nodes.Cin = await placeAndLabel(page, '[data-testid="ide-design-board-input-sw8"]', 'Cin', { x: 0.10, y: 0.76 });

  for (let bit = 0; bit < 4; bit += 1) {
    nodes[`FA${bit}`] = await placeAndLabel(page, '[data-testid="ide-design-palette-fulladder"]', `FA${bit}`, { x: 0.48, y: 0.34 + bit * 0.12 });
    nodes[`S${bit}`] = await placeAndLabel(page, `[data-testid="ide-design-board-output-ld${bit}"]`, `S${bit}`, { x: 0.88, y: 0.34 + bit * 0.12 });
  }
  nodes.Cout = await placeAndLabel(page, '[data-testid="ide-design-board-output-ld4"]', 'Cout', { x: 0.88, y: 0.80 });

  await assertNodeLabels(page, ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'Cin', 'FA0', 'FA1', 'FA2', 'FA3', 'S0', 'S1', 'S2', 'S3', 'Cout']);
  for (let bit = 0; bit < 4; bit += 1) {
    await connectPorts(page, nodes[`A${bit}`], 'out', nodes[`FA${bit}`], 'A');
    await connectPorts(page, nodes[`B${bit}`], 'out', nodes[`FA${bit}`], 'B');
    await connectPorts(page, nodes[`FA${bit}`], 'Sum', nodes[`S${bit}`], 'in');
  }
  await connectPorts(page, nodes.Cin, 'out', nodes.FA0, 'Cin');
  await connectPorts(page, nodes.FA0, 'Cout', nodes.FA1, 'Cin');
  await connectPorts(page, nodes.FA1, 'Cout', nodes.FA2, 'Cin');
  await connectPorts(page, nodes.FA2, 'Cout', nodes.FA3, 'Cin');
  await connectPorts(page, nodes.FA3, 'Cout', nodes.Cout, 'in');

  const circuit = await readCircuit(page);
  assert(circuit.connectionCount === 17, `${viewport.label}: 4-bit adder must have 17 wires, got ${circuit.connectionCount}`);
  record.phases.push({ phase: '4bit-design', nodes: circuit.nodeCount, connections: circuit.connectionCount });
  await fitCenterZoom(page);
  await captureProof(page, viewport, '4bit-design-complete', record);
}

async function proveFourBitVerify(page, baseUrl, viewport, record) {
  await openMode(page, baseUrl, 'verify', `blank-adder-authoring-depth-${viewport.label}-4bit`);
  const cases = await buildAdder4Cases(page);
  await authorInputCases(page, cases);
  await runObserveSaveAndAssertExpected(page, cases, viewport, '4bit');
  await runCompareAndExpect(page, viewport, '4bit', 'pass');
  record.phases.push({ phase: '4bit-verify', cases: cases.map((entry) => entry.name) });
  await captureProof(page, viewport, '4bit-verify-pass', record);
}

async function proveHardwareMapping(page, baseUrl, viewport, record) {
  await openMode(page, baseUrl, 'hardware', `blank-adder-authoring-depth-${viewport.label}`);
  const mapModeBtn = page.locator('[data-testid="ide-hw-mode-btn-map"]').first();
  if (await mapModeBtn.isVisible().catch(() => false)) {
    await mapModeBtn.click();
  }
  const rowIds = await readRequiredAdder4RowIds(page);
  for (const rowId of Object.values(rowIds)) {
    assert(await visible(page.locator(`[data-testid="ide-hw-map-row-${rowId}"]`).first()), `${viewport.label}: Hardware map row ${rowId} must be visible`);
  }

  await mapRowToAlias(page, rowIds.A1, 'SW0');
  await page.waitForFunction(
    (rowId) => /conflict/i.test(document.querySelector(`[data-testid="ide-hw-map-row-status-${rowId}"]`)?.textContent ?? ''),
    rowIds.A1,
    { timeout: 5000 }
  );
  await mapRowToAlias(page, rowIds.A1, 'SW1');
  await page.waitForFunction(
    (rowId) => !/conflict/i.test(document.querySelector(`[data-testid="ide-hw-map-row-status-${rowId}"]`)?.textContent ?? ''),
    rowIds.A1,
    { timeout: 5000 }
  );
  await mapRowToAlias(page, rowIds.Cout, 'LD5');
  await mapRowToAlias(page, rowIds.Cout, 'LD4');

  const mapping = await readMappingRows(page);
  const labelsToPins = {
    A0: 'SW0',
    A1: 'SW1',
    A2: 'SW2',
    A3: 'SW3',
    B0: 'SW4',
    B1: 'SW5',
    B2: 'SW6',
    B3: 'SW7',
    Cin: 'SW8',
    S0: 'LD0',
    S1: 'LD1',
    S2: 'LD2',
    S3: 'LD3',
    Cout: 'LD4',
  };
  for (const [label, pin] of Object.entries(labelsToPins)) {
    const row = Object.values(mapping).find((entry) => entry.label === label);
    assert(row?.pin === pin, `${viewport.label}: ${label} must map to ${pin}, got ${JSON.stringify(row)}`);
  }
  record.phases.push({ phase: 'hardware', mappedRows: Object.keys(mapping).length });
  await captureProof(page, viewport, 'hardware-final-mapping', record);
}

async function proveExportPackage(page, baseUrl, viewport, record) {
  await openMode(page, baseUrl, 'export', `blank-adder-authoring-depth-${viewport.label}`);
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });

  const previews = {};
  for (const artifactPath of ['README.txt', 'top.vhd', 'top.xdc', 'testbench.vhd']) {
    previews[artifactPath] = await readPreviewByPath(page, artifactPath);
    assert(previews[artifactPath].length > 0, `${viewport.label}: ${artifactPath} preview must not be empty`);
  }
  assert(/E0 package evidence only|Evidence level:\s*E0 export package only/i.test(previews['README.txt']), `${viewport.label}: README must state E0 boundary`);
  assert(/SW0|SW8|LD4|get_ports/i.test(previews['top.xdc']), `${viewport.label}: top.xdc preview must include mapped board pins`);

  const first = await downloadZip(page, `${viewport.label}-first`);
  const second = await downloadZip(page, `${viewport.label}-second`);
  assert(first.hash === second.hash, `${viewport.label}: repeated export hashes differ ${first.hash} vs ${second.hash}`);
  const zip = await JSZip.loadAsync(first.bytes);
  const paths = Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);
  for (const required of ['top.vhd', 'top.xdc', 'testbench.vhd', 'README.txt', 'project.rbproj.json']) {
    assert(paths.some((entry) => entry.toLowerCase().endsWith(required.toLowerCase())), `${viewport.label}: exported ZIP missing ${required}`);
  }
  const readmePath = paths.find((entry) => /(^|\/)README\.txt$/i.test(entry));
  const xdcPath = paths.find((entry) => /(^|\/)top\.xdc$/i.test(entry));
  const projectPath = paths.find((entry) => /(^|\/)project\.rbproj\.json$/i.test(entry));
  const readmeText = await zip.file(readmePath).async('string');
  const xdcText = await zip.file(xdcPath).async('string');
  const projectText = await zip.file(projectPath).async('string');
  assert(/E0 package evidence only|Evidence level:\s*E0 export package only/i.test(readmeText), `${viewport.label}: ZIP README must state E0 boundary`);
  assert(/SW0|SW8|LD4|get_ports/i.test(xdcText), `${viewport.label}: ZIP top.xdc must include final pin mapping`);
  assert(/A0|B3|Cin|S3|Cout|sw0|ld4/i.test(projectText), `${viewport.label}: project metadata must carry adder ports/mapping`);
  record.phases.push({ phase: 'export', zipPath: first.zipPath, hash: first.hash, files: paths.sort() });
  await captureProof(page, viewport, 'export-package', record);
}

async function buildPrimitiveCases(page) {
  const rows = await readIoRows(page);
  const ids = {
    A: requireRowIdByLabel(rows, 'A'),
    B: requireRowIdByLabel(rows, 'B'),
    Cin: requireRowIdByLabel(rows, 'Cin'),
    Sum: requireRowIdByLabel(rows, 'Sum'),
    Cout: requireRowIdByLabel(rows, 'Cout'),
  };
  const outputIds = { Sum: ids.Sum, Cout: ids.Cout };
  return [
    { name: '000', outputIds, inputs: { [ids.A]: 0, [ids.B]: 0, [ids.Cin]: 0 }, expected: { [ids.Sum]: 0, [ids.Cout]: 0 } },
    { name: '010', outputIds, inputs: { [ids.A]: 0, [ids.B]: 1, [ids.Cin]: 0 }, expected: { [ids.Sum]: 1, [ids.Cout]: 0 } },
    { name: '110', outputIds, inputs: { [ids.A]: 1, [ids.B]: 1, [ids.Cin]: 0 }, expected: { [ids.Sum]: 0, [ids.Cout]: 1 } },
    { name: '111', outputIds, inputs: { [ids.A]: 1, [ids.B]: 1, [ids.Cin]: 1 }, expected: { [ids.Sum]: 1, [ids.Cout]: 1 } },
  ];
}

async function buildAdder4Cases(page) {
  const rows = await readIoRows(page);
  const ids = await readRequiredAdder4RowIds(page, rows);
  return [
    {
      name: '0000+0000+0',
      inputs: { [ids.A0]: 0, [ids.A1]: 0, [ids.A2]: 0, [ids.A3]: 0, [ids.B0]: 0, [ids.B1]: 0, [ids.B2]: 0, [ids.B3]: 0, [ids.Cin]: 0 },
      expected: { [ids.S0]: 0, [ids.S1]: 0, [ids.S2]: 0, [ids.S3]: 0, [ids.Cout]: 0 },
    },
    {
      name: '0001+0001+0',
      inputs: { [ids.A0]: 1, [ids.A1]: 0, [ids.A2]: 0, [ids.A3]: 0, [ids.B0]: 1, [ids.B1]: 0, [ids.B2]: 0, [ids.B3]: 0, [ids.Cin]: 0 },
      expected: { [ids.S0]: 0, [ids.S1]: 1, [ids.S2]: 0, [ids.S3]: 0, [ids.Cout]: 0 },
    },
    {
      name: '1111+0001+0',
      inputs: { [ids.A0]: 1, [ids.A1]: 1, [ids.A2]: 1, [ids.A3]: 1, [ids.B0]: 1, [ids.B1]: 0, [ids.B2]: 0, [ids.B3]: 0, [ids.Cin]: 0 },
      expected: { [ids.S0]: 0, [ids.S1]: 0, [ids.S2]: 0, [ids.S3]: 0, [ids.Cout]: 1 },
    },
    {
      name: '1010+0101+0',
      inputs: { [ids.A0]: 0, [ids.A1]: 1, [ids.A2]: 0, [ids.A3]: 1, [ids.B0]: 1, [ids.B1]: 0, [ids.B2]: 1, [ids.B3]: 0, [ids.Cin]: 0 },
      expected: { [ids.S0]: 1, [ids.S1]: 1, [ids.S2]: 1, [ids.S3]: 1, [ids.Cout]: 0 },
    },
    {
      name: '0111+0000+1',
      inputs: { [ids.A0]: 1, [ids.A1]: 1, [ids.A2]: 1, [ids.A3]: 0, [ids.B0]: 0, [ids.B1]: 0, [ids.B2]: 0, [ids.B3]: 0, [ids.Cin]: 1 },
      expected: { [ids.S0]: 0, [ids.S1]: 0, [ids.S2]: 0, [ids.S3]: 1, [ids.Cout]: 0 },
    },
  ];
}

async function readRequiredAdder4RowIds(page, rowsInput = null) {
  const rows = rowsInput ?? await readIoRows(page);
  return Object.fromEntries(
    ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'Cin', 'S0', 'S1', 'S2', 'S3', 'Cout'].map((label) => [
      label,
      requireRowIdByLabel(rows, label),
    ])
  );
}

async function readIoRows(page) {
  return page.evaluate(() =>
    (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      pin: row.pin,
      nodeId: row.nodeId,
    }))
  );
}

function requireRowIdByLabel(rows, label) {
  const row = rows.find((entry) => entry.label === label);
  assert(row?.id, `missing IO row for label ${label}: ${JSON.stringify(rows)}`);
  return row.id;
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

async function renameProject(page, name, viewport) {
  const title = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  assert(await title.isVisible().catch(() => false), `${viewport.label}: topbar project title must be visible`);
  await title.dblclick();
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(name);
  await input.press('Enter');
  await page.waitForFunction((expected) => window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectName === expected, name, { timeout: 5000 });
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
    { timeout: 5000 }
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
    { timeout: 8000 }
  );
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
    { timeout: 5000 }
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
    await page.waitForFunction(() => !window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort, { timeout: 5000 });
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  }
}

async function clickPort(page, nodeId, portName) {
  const port = page.locator(`[data-node-id="${nodeId}"] [data-port-id="${portName}"]`).first();
  await port.waitFor({ state: 'visible', timeout: 8000 });
  const box = await port.boundingBox();
  assert(Boolean(box), `port ${nodeId}.${portName} must have a clickable box`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    const port = element?.closest?.('[data-port-id]');
    const node = element?.closest?.('[data-node-id]') ?? port?.closest?.('[data-node-id]');
    return {
      tagName: element?.tagName ?? null,
      testId: element?.getAttribute?.('data-testid') ?? null,
      portId: port?.getAttribute?.('data-port-id') ?? null,
      nodeId: node?.getAttribute?.('data-node-id') ?? null,
    };
  }, point);
  assert(
    hit.nodeId === nodeId && hit.portId === portName,
    `port hit-test missed ${nodeId}.${portName} at ${JSON.stringify(point)}: ${JSON.stringify(hit)}`
  );
  await page.mouse.click(point.x, point.y);
}

async function connectPorts(page, fromNodeId, fromPort, toNodeId, toPort) {
  const before = await readCircuit(page);
  await clickPort(page, fromNodeId, fromPort);
  assert(await activeWireStart(page), `clicking ${fromNodeId}.${fromPort} must start a wire`);
  await clickPort(page, toNodeId, toPort);
  await waitForConnectionCount(page, before.connectionCount + 1, `connect ${fromNodeId}.${fromPort}->${toNodeId}.${toPort}`);
  const connections = (await readCircuit(page)).connections;
  assert(
    connections.some((entry) => entry.fromNodeId === fromNodeId && entry.fromPort === fromPort && entry.toNodeId === toNodeId && entry.toPort === toPort),
    `expected wire ${fromNodeId}.${fromPort}->${toNodeId}.${toPort}`
  );
}

async function waitForConnectionCount(page, expected, label) {
  await page.waitForFunction(
    (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) === count,
    expected,
    { timeout: 8000 }
  );
  const actual = (await readCircuit(page)).connectionCount;
  assert(actual === expected, `${label}: expected ${expected} connections, got ${actual}`);
}

async function selectFirstWireByEndpoint(page, fromNodeId, toNodeId) {
  const selected = await page.evaluate(({ from, to }) => {
    const wire = Array.from(document.querySelectorAll('[data-wire-id]')).find((element) => {
      const id = element.getAttribute('data-wire-id') ?? '';
      return id.includes(from) && id.includes(to);
    });
    const wireId = wire?.getAttribute('data-wire-id') ?? null;
    if (wireId) {
      window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selectWire?.(wireId, false);
    }
    return wireId;
  }, { from: fromNodeId, to: toNodeId });
  assert(Boolean(selected), `expected selectable wire from ${fromNodeId} to ${toNodeId}`);
}

async function dragNode(page, nodeId, dx, dy) {
  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
  const box = await node.boundingBox();
  assert(Boolean(box), `node ${nodeId} must have a bounding box for drag`);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

async function moveNodeToCanvasFraction(page, nodeId, position) {
  const node = page.locator(`[data-node-id="${nodeId}"] .logic-node-body`).first();
  const canvas = page.locator('[data-testid="ide-design-live-canvas"]').first();
  const nodeBox = await node.boundingBox();
  const canvasBox = await canvas.boundingBox();
  assert(Boolean(nodeBox) && Boolean(canvasBox), `node ${nodeId} and canvas must be measurable for placement adjustment`);
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

async function setExpectedCells(page, cases) {
  for (let tick = 0; tick < cases.length; tick += 1) {
    for (const [fieldId, value] of Object.entries(cases[tick].expected)) {
      await setExpectedCell(page, fieldId, tick, value);
    }
  }
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

async function flipExpectedCell(page, fieldId, tick) {
  const current = await readCellValue(page, `ide-stimulus-expected-${fieldId}-t${tick}`);
  assert(current === 0 || current === 1, `expected ${fieldId} t${tick} to have a saved value before flip`);
  await setExpectedCell(page, fieldId, tick, current === 0 ? 1 : 0);
}

async function readCellValue(page, testId) {
  const title = await page.getByTestId(testId).first().getAttribute('title');
  if (/:\s*1\s*-\s*drag/i.test(title ?? '')) return 1;
  if (/:\s*0\s*-\s*drag/i.test(title ?? '')) return 0;
  return null;
}

async function readTickCount(page) {
  return page.locator('[data-testid^="ide-stimulus-cell-"][data-testid$="-t0"]').count().then(async () => {
    const ids = await page.locator('[data-testid^="ide-stimulus-cell-"]').evaluateAll((elements) =>
      Array.from(new Set(elements.map((element) => /-t(\d+)$/.exec(element.getAttribute('data-testid') ?? '')?.[1]).filter(Boolean))).map(Number)
    );
    return ids.length;
  });
}

async function runObserveSaveAndAssertExpected(page, cases, viewport, label) {
  await setVerifyRunMode(page, 'observe');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const savedSelector = await saveObservedOutputs(page);
  assert(savedSelector, `${viewport.label}: ${label} must allow saving observed outputs`);
  await page.waitForFunction(
    () => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? []).some((vector) => Object.keys(vector.expected ?? {}).length > 0),
    { timeout: 8000 }
  );
  await assertExpectedCells(page, cases, viewport, label);
}

async function assertExpectedCells(page, cases, viewport, label) {
  for (let tick = 0; tick < cases.length; tick += 1) {
    for (const [fieldId, value] of Object.entries(cases[tick].expected)) {
      const actual = await readCellValue(page, `ide-stimulus-expected-${fieldId}-t${tick}`);
      assert(actual === value, `${viewport.label}: ${label} case ${cases[tick].name} expected ${fieldId}=${value}, got ${actual}`);
    }
  }
}

async function runCompareAndExpect(page, viewport, label, expectation) {
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: ${label} Compare mode must be selectable`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const status = ((await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')) ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (expectation === 'pass') {
    assert(isVerifyPass(status), `${viewport.label}: ${label} Compare should PASS, got "${status}"`);
  } else {
    assert(isVerifyFail(status), `${viewport.label}: ${label} Compare should FAIL, got "${status}"`);
    const text = await page.locator('[data-testid="ide-mode-verify"]').first().textContent().catch(() => '');
    assert(/mismatch|differ|fail|expected/i.test(text ?? ''), `${viewport.label}: ${label} mismatch details must be inspectable`);
  }
}

async function mapRowToAlias(page, rowId, alias) {
  await clickVisible(page, `[data-testid="ide-hw-map-row-${rowId}"]`, `select map row ${rowId}`);
  const normalized = alias.toLowerCase().replace(/([a-z]+)(\d+)/, '$1-$2');
  const selectors = [
    `[data-testid="ide-hw-map-${normalized}-hit"]`,
    `[data-testid="ide-hw-map-${normalized}"]`,
    `[data-testid="ide-hw-resource-${alias.toLowerCase()}"]`,
  ];
  for (const selector of selectors) {
    const target = page.locator(selector).first();
    if (await target.isVisible().catch(() => false)) {
      await target.click();
      await page.waitForTimeout(180);
      return;
    }
  }
  throw new Error(`board alias ${alias} was not clickable for row ${rowId}`);
}

async function readPreviewByPath(page, artifactPath) {
  const fileTestId = `ide-export-file-${artifactPath.replace(/[^a-zA-Z0-9]+/g, '-')}`;
  const file = page.locator(`[data-testid="${fileTestId}"]`).first();
  if (await file.isVisible().catch(() => false)) {
    await file.click();
  } else {
    const tab = page.locator('[data-testid^="ide-export-artifact-tab-"]').filter({ hasText: artifactPath }).first();
    assert(await tab.isVisible().catch(() => false), `artifact row for ${artifactPath} must be visible`);
    await tab.click();
  }
  await page.waitForFunction(
    (expected) => (document.querySelector('[data-testid="ide-export-preview-path"]')?.textContent ?? '').trim() === expected,
    artifactPath,
    { timeout: 10000 }
  );
  return ((await page.locator('[data-testid="ide-export-preview-code"]').first().textContent().catch(() => '')) ?? '').trim();
}

async function downloadZip(page, label) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.locator('[data-testid="ide-export-package-download-v1"], [data-testid="ide-export-rebuild-btn"]').first().click(),
  ]);
  const failure = await download.failure();
  assert(!failure, `${label}: ZIP download failed: ${failure}`);
  const zipPath = path.join(ARTIFACT_ROOT, `blank-adder-${label}.zip`);
  await download.saveAs(zipPath);
  const bytes = await fs.readFile(zipPath);
  return { zipPath, bytes, hash: crypto.createHash('sha256').update(bytes).digest('hex') };
}

async function fitCenterZoom(page) {
  const toggle = page.locator('[data-testid="ide-design-view-tools-toggle"]').first();
  if (await toggle.isVisible().catch(() => false) && (await toggle.getAttribute('aria-expanded').catch(() => 'false')) !== 'true') {
    await toggle.click();
  }
  for (const selector of ['[data-testid="ide-design-zoom-preset-50"]', '[data-testid="ide-design-zoom-preset-fit"]', '[data-testid="ide-design-center-selection-canvas"]', '[data-testid="ide-design-zoom-preset-125"]']) {
    const button = page.locator(selector).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => null);
      await page.waitForTimeout(100);
    }
  }
}

async function setDesignZoomPreset(page, preset) {
  const toggle = page.locator('[data-testid="ide-design-view-tools-toggle"]').first();
  if (await toggle.isVisible().catch(() => false) && (await toggle.getAttribute('aria-expanded').catch(() => 'false')) !== 'true') {
    await toggle.click();
  }
  const button = page.locator(`[data-testid="ide-design-zoom-preset-${preset}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await page.waitForTimeout(180);
  }
  if (await toggle.isVisible().catch(() => false) && (await toggle.getAttribute('aria-expanded').catch(() => 'false')) === 'true') {
    await toggle.click();
    await page.waitForTimeout(120);
  }
}

async function clickVisible(page, selector, label) {
  const target = page.locator(selector).first();
  assert(await target.isVisible().catch(() => false), `${label}: ${selector} was not visible`);
  await target.scrollIntoViewIfNeeded().catch(() => null);
  await target.click();
}

async function activeWireStart(page) {
  return page.evaluate(() => Boolean(window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort));
}

async function readActiveWireState(page) {
  return page.evaluate(() => {
    const state = window.__RB_LOGIC_VIEW_STORE__?.getState?.();
    const start = state?.editingState?.wireStartPort;
    return {
      active: Boolean(start),
      interactionMode: state?.interactionMode ?? null,
      toolMode: state?.toolMode ?? null,
      wireStartPort: start ? { nodeId: start.nodeId, portName: start.portName ?? start.port ?? null } : null,
    };
  });
}

async function readNodeIds(page) {
  return page.evaluate(() => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? []).map((node) => node.id));
}

async function readCircuit(page) {
  return page.evaluate(() => {
    const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit ?? { nodes: [], connections: [] };
    const connections = (circuit.connections ?? []).map((entry) => {
      const fromNodeId = typeof entry.from === 'string' ? entry.from : entry.from?.nodeId;
      const toNodeId = typeof entry.to === 'string' ? entry.to : entry.to?.nodeId;
      const fromPort = typeof entry.from === 'string' ? entry.fromPort ?? entry.fromPin ?? 'out' : entry.from?.portName ?? entry.from?.port ?? 'out';
      const toPort = typeof entry.to === 'string' ? entry.toPort ?? entry.toPin ?? 'in' : entry.to?.portName ?? entry.to?.port ?? 'in';
      return { fromNodeId, fromPort, toNodeId, toPort };
    });
    const positionsFinite = (circuit.nodes ?? []).every((node) => {
      const x = node.position?.x ?? node.x;
      const y = node.position?.y ?? node.y;
      return Number.isFinite(x) && Number.isFinite(y);
    });
    return { nodeCount: circuit.nodes?.length ?? 0, connectionCount: connections.length, connections, positionsFinite };
  });
}

async function readMappingRows(page) {
  return page.evaluate(() => {
    const rows = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? [];
    return Object.fromEntries(rows.map((row) => [row.id, { pin: row.pin, label: row.label, nodeId: row.nodeId }]));
  });
}

async function assertNodeLabels(page, labels) {
  const actual = await page.evaluate(() => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? []).map((node) => node.label).filter(Boolean));
  for (const label of labels) {
    assert(actual.includes(label), `expected node label ${label}, got ${actual.join(', ')}`);
  }
}

async function captureProof(page, viewport, slug, record) {
  const screenshotPath = path.join(SCREENSHOT_ROOT, `${viewport.label}-${slug}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const snapshot = await page.evaluate(() => {
    const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      projectName: runtime?.projectName ?? null,
      nodes: runtime?.circuit?.nodes?.length ?? 0,
      connections: runtime?.circuit?.connections?.length ?? 0,
      rows: (runtime?.projectIoRows ?? []).map((row) => ({ id: row.id, label: row.label, pin: row.pin })),
      verifyStatus: document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      exportStatus: document.querySelector('[data-testid="ide-export-package-handoff-status"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    };
  }).catch(() => ({}));
  record.phases.push({ phase: `screenshot:${slug}`, screenshotPath, snapshot });
}
