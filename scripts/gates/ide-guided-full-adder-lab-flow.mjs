#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  CLASSROOM_VIEWPORTS,
  installCleanStudentContext,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'guided-full-adder-lab-flow',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE guided Full Adder lab flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-guided-full-adder-lab-flow',
    generatedAtIso: new Date().toISOString(),
    viewports: [],
    browserProblems,
  };

  const failures = [];
  for (const viewport of CLASSROOM_VIEWPORTS) {
    const viewportRecord = { viewport: viewport.label, phases: [] };
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await runViewport(page, baseUrl, viewport, viewportRecord);
      record.viewports.push(viewportRecord);
    } catch (error) {
      viewportRecord.error = error instanceof Error ? error.message : String(error);
      record.viewports.push(viewportRecord);
      failures.push(`${viewport.label}: ${viewportRecord.error}`);
    }
  }

  await writeFile(
    path.join(ARTIFACT_ROOT, 'guided-full-adder-lab-flow.json'),
    JSON.stringify(record, null, 2),
  );

  assert(failures.length === 0, failures.join('\n'));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function runViewport(page, baseUrl, viewport, record) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=guided-full-adder-lab-flow-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project`);
  await assertNoRootOverflow(page, `${viewport.label}/Project`);

  await expectVisible(page, 'ide-project-guided-full-adder-lab', `${viewport.label}: Project lab card`);
  await page.getByTestId('ide-project-guided-full-adder-start').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await expectVisible(page, 'ide-design-guided-full-adder-checklist', `${viewport.label}: Design lab checklist`);

  await clickIfVisible(page, 'ide-design-guided-full-adder-add-input-a');
  await clickIfVisible(page, 'ide-design-guided-full-adder-add-input-b');
  await clickIfVisible(page, 'ide-design-guided-full-adder-add-input-cin');
  await clickIfVisible(page, 'ide-design-guided-full-adder-add-output-sum');
  await clickIfVisible(page, 'ide-design-guided-full-adder-add-output-cout');
  await clickIfVisible(page, 'ide-design-guided-full-adder-add-block');
  await waitForLabNodes(page);
  const wireTool = page.getByTestId('ide-design-tool-wire').first();
  if (await wireTool.isVisible().catch(() => false)) {
    await wireTool.click();
  }

  const nodes = await readLabNodes(page);
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
  await waitForConnectionCount(page, 5, `${viewport.label}: Full Adder lab wiring`);
  await waitForChecklistReady(page);
  record.phases.push({ phase: 'design', nodes, connections: 5 });
  await capture(page, viewport, '01-design-full-adder-wired');

  await page.getByTestId('ide-design-guided-full-adder-open-verify').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  await expectVisible(page, 'ide-verify-guided-full-adder-truth-table', `${viewport.label}: Verify lab truth table card`);
  await page.getByTestId('ide-verify-create-full-adder-truth-table').click();
  await waitForVectorCount(page, 8);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must be selectable`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const verifyStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]').first());
  assert(isVerifyPass(verifyStatus), `${viewport.label}: Full Adder truth table Compare should PASS, got "${verifyStatus}"`);
  record.phases.push({ phase: 'verify', vectors: 8, status: verifyStatus });
  await capture(page, viewport, '02-verify-full-adder-pass');

  await openMode(page, baseUrl, 'hardware', `guided-full-adder-lab-flow-${viewport.label}`);
  await expectVisible(page, 'ide-hardware-guided-full-adder-mapping', `${viewport.label}: Hardware lab mapping card`);
  await page.getByTestId('ide-hardware-guided-full-adder-map-missing').click();
  await waitForFullAdderPins(page);
  record.phases.push({ phase: 'hardware', mapped: ['A', 'B', 'Cin', 'Sum', 'Cout'] });
  await capture(page, viewport, '03-hardware-full-adder-mapped');

  await openMode(page, baseUrl, 'export', `guided-full-adder-lab-flow-${viewport.label}`);
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  await expectVisible(page, 'ide-export-guided-full-adder-summary', `${viewport.label}: Export lab summary`);
  const exportSummary = await text(page.getByTestId('ide-export-guided-full-adder-summary'));
  assert(/Full Adder/i.test(exportSummary), `${viewport.label}: Export summary must name the lab`);
  assert(/Browser E0|E0/i.test(exportSummary), `${viewport.label}: Export summary must preserve E0 boundary`);
  record.phases.push({ phase: 'export', summary: exportSummary.slice(0, 240) });
  await assertNoRootOverflow(page, `${viewport.label}/Export`);
  await capture(page, viewport, '04-export-full-adder-summary');
}

async function expectVisible(page, testId, label) {
  const locator = page.getByTestId(testId).first();
  if (await locator.isVisible().catch(() => false)) return;
  const debug = await page.evaluate((targetTestId) => {
    const matches = Array.from(document.querySelectorAll(`[data-testid="${targetTestId}"]`));
    return {
      count: matches.length,
      bodyText: document.body.textContent?.replace(/\s+/g, ' ').trim().slice(0, 800) ?? '',
      matches: matches.map((element) => {
        const box = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          tagName: element.tagName,
          text: element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          overflow: style.overflow,
          ancestors: (() => {
            const result = [];
            let current = element.parentElement;
            while (current && result.length < 6) {
              const currentBox = current.getBoundingClientRect();
              const currentStyle = window.getComputedStyle(current);
              result.push({
                tagName: current.tagName,
                className: current.getAttribute('class'),
                testId: current.getAttribute('data-testid'),
                box: {
                  x: currentBox.x,
                  y: currentBox.y,
                  width: currentBox.width,
                  height: currentBox.height,
                },
                display: currentStyle.display,
                visibility: currentStyle.visibility,
                overflow: currentStyle.overflow,
              });
              current = current.parentElement;
            }
            return result;
          })(),
        };
      }),
    };
  }, testId);
  assert(false, `${label}: ${testId} must be visible; debug=${JSON.stringify(debug)}`);
}

async function clickIfVisible(page, testId) {
  const locator = page.getByTestId(testId).first();
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
  }
}

async function waitForLabNodes(page) {
  await page.waitForFunction(() => {
    const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit;
    if (!circuit) return false;
    const labels = new Set((circuit.nodes ?? []).map((node) => String(node.label ?? node.id).toLowerCase()));
    const hasFullAdder = (circuit.nodes ?? []).some((node) => String(node.type).toLowerCase() === 'fulladder');
    return ['a', 'b', 'cin', 'sum', 'cout'].every((label) => labels.has(label)) && hasFullAdder;
  }, undefined, { timeout: 10000 });
}

async function readLabNodes(page) {
  return page.evaluate(() => {
    const circuit = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit;
    const nodes = circuit?.nodes ?? [];
    const byLabel = (label) => {
      const normalized = label.toLowerCase();
      const node = nodes.find((entry) => String(entry.label ?? entry.id).toLowerCase() === normalized);
      if (!node) throw new Error(`Missing lab node ${label}`);
      return node.id;
    };
    const fullAdder = nodes.find((entry) => String(entry.type).toLowerCase() === 'fulladder');
    if (!fullAdder) throw new Error('Missing FullAdder node');
    return {
      A: byLabel('A'),
      B: byLabel('B'),
      Cin: byLabel('Cin'),
      Sum: byLabel('Sum'),
      Cout: byLabel('Cout'),
      FA: fullAdder.id,
    };
  });
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
  const before = await readConnectionCount(page);
  await clickPort(page, fromNodeId, fromPort);
  assert(await activeWireStart(page), `clicking ${fromNodeId}.${fromPort} must start a wire`);
  await clickPort(page, toNodeId, toPort);
  await waitForConnectionCount(page, before + 1, `connect ${fromNodeId}.${fromPort}->${toNodeId}.${toPort}`);
}

async function readConnectionCount(page) {
  return page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0);
}

function activeWireStart(page) {
  return page.evaluate(() => Boolean(window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort));
}

async function waitForConnectionCount(page, expected, label) {
  try {
    await page.waitForFunction(
      (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) === count,
      expected,
      { timeout: 8000 },
    );
  } catch (error) {
    const debug = await page.evaluate(() => {
      const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
      const logicView = window.__RB_LOGIC_VIEW_STORE__?.getState?.();
      return {
        activeWire: logicView?.editingState?.wireStartPort ?? null,
        toolMode: logicView?.toolMode ?? null,
        connections: runtime?.circuit?.connections ?? [],
      };
    });
    throw new Error(`${label}: timed out waiting for ${expected} connections; debug=${JSON.stringify(debug)}`);
  }
  const actual = await readConnectionCount(page);
  assert(actual === expected, `${label}: expected ${expected} connections, got ${actual}`);
}

async function waitForChecklistReady(page) {
  try {
    await page.waitForFunction(() => {
      const root = document.querySelector('[data-testid="ide-design-guided-full-adder-checklist"]');
      if (!root) return false;
      const checks = Array.from(root.querySelectorAll('.ide-guided-lab-check'));
      return checks.length >= 5 && checks.every((entry) => entry.classList.contains('is-complete'));
    }, undefined, { timeout: 10000 });
  } catch (error) {
    const debug = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="ide-design-guided-full-adder-checklist"]');
      const checks = Array.from(root?.querySelectorAll('.ide-guided-lab-check') ?? []);
      return {
        checklistText: root?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        checks: checks.map((entry) => entry.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
        connections: window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections ?? [],
      };
    });
    throw new Error(`Full Adder lab checklist did not reach ready state; debug=${JSON.stringify(debug)}`);
  }
}

async function waitForVectorCount(page, expected) {
  await page.waitForFunction(
    (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors?.length ?? 0) === count,
    expected,
    { timeout: 10000 },
  );
}

async function waitForFullAdderPins(page) {
  try {
    await page.waitForFunction(() => {
      const rows = window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectIoRows ?? [];
      const expected = { A: 'SW0', B: 'SW1', Cin: 'SW2', Sum: 'LD0', Cout: 'LD1' };
      return Object.entries(expected).every(([label, pin]) => {
        const row = rows.find((entry) => String(entry.label).toLowerCase() === label.toLowerCase());
        return row && String(row.pin).toUpperCase() === pin;
      });
    }, undefined, { timeout: 10000 });
  } catch (error) {
    const debug = await page.evaluate(() => {
      const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
      const card = document.querySelector('[data-testid="ide-hardware-guided-full-adder-mapping"]');
      return {
        cardText: card?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        rows: runtime?.projectIoRows ?? [],
        hardwareMappingV2: runtime?.hardwareMappingV2 ?? null,
      };
    });
    throw new Error(`Full Adder suggested pins did not apply; debug=${JSON.stringify(debug)}`);
  }
}

async function capture(page, viewport, slug) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${viewport.label}-${slug}.png`),
    fullPage: true,
  });
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
