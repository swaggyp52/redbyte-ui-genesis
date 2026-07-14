#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, runIdeGate } from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'design-wiring-simplification',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const VIEWPORT = { label: '1366x768', width: 1366, height: 768 };

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE Design wiring simplification flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);
  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height });
  page.on('dialog', async (dialog) => dialog.accept().catch(() => null));

  const record = {
    gate: 'ide-design-wiring-simplification-flow',
    generatedAtIso: new Date().toISOString(),
    viewport: VIEWPORT.label,
    phases: [],
    browserProblems,
  };

  await startFreshDesign(page, baseUrl);
  await capture(page, '01-fresh-design.png');

  const nodes = await placeFullAdderParts(page);
  record.phases.push({ phase: 'parts-placed', nodes });
  await capture(page, '02-full-adder-parts.png');

  await proveInvalidTargetKeepsSource(page, nodes);
  record.phases.push({ phase: 'invalid-target-recovery' });
  await capture(page, '03-invalid-target-source-kept.png');

  await connectPorts(page, nodes.A, 'out', nodes.FA, 'A');
  await selectWireByEndpoint(page, nodes.A, nodes.FA);
  await page.waitForSelector('[data-testid="ide-design-context-delete-wire"]', { timeout: 10000 });
  await page.getByTestId('ide-design-context-delete-wire').click();
  await waitForConnectionCount(page, 0, 'delete selected temporary wire');
  record.phases.push({ phase: 'selected-wire-delete' });

  const wires = [
    [nodes.A, 'out', nodes.FA, 'A'],
    [nodes.B, 'out', nodes.FA, 'B'],
    [nodes.Cin, 'out', nodes.FA, 'Cin'],
    [nodes.FA, 'Sum', nodes.Sum, 'in'],
    [nodes.FA, 'Cout', nodes.Cout, 'in'],
  ];
  for (const wire of wires) {
    await connectPorts(page, ...wire);
  }
  await waitForConnectionCount(page, 5, 'complete FullAdder wiring');
  await capture(page, '04-full-adder-wired.png');

  const beforeMove = await readCircuit(page);
  await dragNode(page, nodes.FA, 42, 26);
  const afterMove = await readCircuit(page);
  assert(afterMove.connectionCount === beforeMove.connectionCount, `moving connected FullAdder changed wire count: ${JSON.stringify({ beforeMove, afterMove })}`);
  assert(afterMove.positionsFinite, 'moving connected FullAdder produced non-finite positions');
  record.phases.push({ phase: 'move-connected-node', connections: afterMove.connectionCount });

  await assertBuildHash(page, 'design wiring simplification final');
  await assertNoRootOverflow(page, 'design wiring simplification final');
  await capture(page, '05-moved-connected-full-adder.png');

  await writeFile(path.join(ARTIFACT_ROOT, 'design-wiring-simplification-flow.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function startFreshDesign(page, baseUrl) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=design-wiring-simplification-flow`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, 'design wiring simplification project');

  const fresh = page.locator('[data-testid="ide-project-build-fresh-primary"], [data-testid="ide-project-path-build-fresh"]').first();
  assert(await fresh.isVisible().catch(() => false), 'Build Fresh must be visible');
  await fresh.click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
  await revealDesignLibrary(page);
  await clickIfVisible(page, '[data-testid="ide-design-zoom-preset-50"]');
}

async function placeFullAdderParts(page) {
  return {
    A: await placeAndLabel(page, '[data-testid="ide-design-board-input-sw0"]', 'A', { x: 0.16, y: 0.36 }),
    B: await placeAndLabel(page, '[data-testid="ide-design-board-input-sw1"]', 'B', { x: 0.16, y: 0.52 }),
    Cin: await placeAndLabel(page, '[data-testid="ide-design-board-input-sw2"]', 'Cin', { x: 0.16, y: 0.68 }),
    FA: await placeAndLabel(page, '[data-testid="ide-design-palette-fulladder"]', 'FullAdder', { x: 0.52, y: 0.52 }),
    Sum: await placeAndLabel(page, '[data-testid="ide-design-board-output-ld0"]', 'Sum', { x: 0.84, y: 0.44 }),
    Cout: await placeAndLabel(page, '[data-testid="ide-design-board-output-ld1"]', 'Cout', { x: 0.84, y: 0.62 }),
  };
}

async function proveInvalidTargetKeepsSource(page, nodes) {
  const before = await readCircuit(page);
  await clickPort(page, nodes.A, 'out');
  await page.waitForFunction(() => Boolean(window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort), { timeout: 5000 });

  const portStates = await readWirePortStates(page, nodes);
  assert(
    portStates.fullAdderA === 'valid-target' && portStates.fullAdderB === 'valid-target' && portStates.fullAdderCin === 'valid-target',
    `FullAdder input ports must advertise valid targets after source selection: ${JSON.stringify(portStates)}`
  );
  assert(
    portStates.fullAdderSum === 'invalid-target' && portStates.fullAdderCout === 'invalid-target',
    `FullAdder output ports must advertise invalid targets after source selection: ${JSON.stringify(portStates)}`
  );

  await clickPort(page, nodes.B, 'out');
  await waitForConnectionCount(page, before.connectionCount, 'invalid output-to-output click');

  const active = await readActiveWireState(page);
  assert(active.active, `invalid target must keep source armed: ${JSON.stringify(active)}`);
  assert(active.wireStartPort?.nodeId === nodes.A && active.wireStartPort?.portName === 'out', `invalid target changed source: ${JSON.stringify(active)}`);

  const feedback = await text(page.getByTestId('ide-design-wire-feedback').first());
  assert(/Outputs cannot be wired directly/i.test(feedback), `invalid feedback must explain output-to-output: "${feedback}"`);
  assert(/Source kept/i.test(feedback), `invalid feedback must say source kept: "${feedback}"`);
  assert(/green target|Esc/i.test(feedback), `invalid feedback must explain recovery: "${feedback}"`);

  const cue = await text(page.getByTestId('ide-design-wire-cue').first());
  assert(/Source:\s*A out/i.test(cue), `wire cue must name the source, got "${cue}"`);
  assert(await page.getByTestId('ide-design-wire-cancel').isVisible().catch(() => false), 'Cancel wire button must be visible while source is armed');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort, { timeout: 5000 });
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
  await page.getByTestId('ide-design-label-edit-btn').click();
  const input = page.getByTestId('ide-design-label-input').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(label);
  await page.getByTestId('ide-design-label-save').click();
  await page.waitForFunction(
    ({ id, expected }) => {
      const node = (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? []).find((entry) => entry.id === id);
      return node?.label === expected;
    },
    { id: nodeId, expected: label },
    { timeout: 5000 },
  );
}

async function revealDesignLibrary(page) {
  const palette = page.locator('[data-testid="ide-design-dock-palette"]').first();
  if (await palette.isVisible().catch(() => false)) return;
  const toggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"], [data-testid="ide-design-library-toggle"]').first();
  assert(await toggle.isVisible().catch(() => false), 'Design library toggle must be visible');
  await toggle.click();
  await page.waitForSelector('[data-testid="ide-design-dock-palette"]', { timeout: 10000 });
}

async function clickNode(page, nodeId) {
  const body = page.locator(`[data-node-id="${nodeId}"] .logic-node-body`).first();
  const box = await body.boundingBox();
  assert(Boolean(box), `node ${nodeId} must have a clickable box`);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
}

async function clickPort(page, nodeId, portName) {
  const port = page.locator(`[data-node-id="${nodeId}"] [data-port-id="${portName}"]`).first();
  await port.waitFor({ state: 'visible', timeout: 8000 });
  await port.click();
}

async function connectPorts(page, fromNodeId, fromPort, toNodeId, toPort) {
  const before = await readCircuit(page);
  await clickPort(page, fromNodeId, fromPort);
  await page.waitForFunction(() => Boolean(window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort), { timeout: 5000 });
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

async function selectWireByEndpoint(page, fromNodeId, toNodeId) {
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
  assert(Boolean(nodeBox) && Boolean(canvasBox), `node ${nodeId} and canvas must be measurable`);
  const start = { x: nodeBox.x + nodeBox.width / 2, y: nodeBox.y + nodeBox.height / 2 };
  const target = {
    x: canvasBox.x + canvasBox.width * position.x,
    y: canvasBox.y + canvasBox.height * position.y,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

async function readWirePortStates(page, nodes) {
  return page.evaluate((ids) => {
    const state = (nodeId, port) =>
      document
        .querySelector(`[data-node-id="${nodeId}"] [data-port-id="${port}"]`)
        ?.getAttribute('data-wire-port-state') ?? null;
    return {
      fullAdderA: state(ids.FA, 'A'),
      fullAdderB: state(ids.FA, 'B'),
      fullAdderCin: state(ids.FA, 'Cin'),
      fullAdderSum: state(ids.FA, 'Sum'),
      fullAdderCout: state(ids.FA, 'Cout'),
    };
  }, nodes);
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
    const positionsFinite = (circuit.nodes ?? []).every((node) => {
      const x = node.position?.x ?? node.x;
      const y = node.position?.y ?? node.y;
      return Number.isFinite(x) && Number.isFinite(y);
    });
    return {
      nodeCount: circuit.nodes?.length ?? 0,
      connectionCount: circuit.connections?.length ?? 0,
      positionsFinite,
    };
  });
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}

async function clickIfVisible(page, selector) {
  const target = page.locator(selector).first();
  if (!(await target.isVisible().catch(() => false))) return false;
  await target.click();
  return true;
}

async function capture(page, filename) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: true });
}
