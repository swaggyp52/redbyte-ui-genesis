#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import {
  assertBuildHash,
  captureBrowserProblems,
  openMode,
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';

const VIEWPORT = { label: '1366x768', width: 1366, height: 768 };
const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'testbench-preservation-after-design-edit',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE testbench preservation after Design edit satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await page.setViewportSize({ width: VIEWPORT.width, height: VIEWPORT.height });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=testbench-preservation-after-design-edit`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, 'testbench-preservation/startup');
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });

  await openMode(page, baseUrl, 'verify', 'testbench-preservation-author');
  console.log('  Phase 1: author and run the named testbench');
  await renameActiveTestbench(page, 'Student XOR Preservation');
  console.log('    renamed testbench');
  await authorWithoutChangingTruth(page);
  console.log('    touched expected truth without changing it');
  await runComparePass(page);
  await assertCurrentPass(page, 'initial authored Compare');
  const authored = await readDocumentState(page);
  assert(authored.name === 'Student XOR Preservation', `authored testbench name was not committed: ${JSON.stringify(authored)}`);
  assert(authored.expectedValues.flat().filter((value) => value === 1).length > 0, 'authored testbench must contain nonzero expected values');
  await capture(page, '01-authored-pass');

  await openMode(page, baseUrl, 'design', 'testbench-preservation-delete-wire');
  console.log('  Phase 2: delete the XOR output wire in Design');
  await fitCircuit(page);
  const connectionsBefore = await readConnectionCount(page);
  await selectWire(page, 'xor_node.out-ld2_node.in');
  const deleteWire = page.locator('[data-testid="ide-design-context-delete-wire"]').first();
  await deleteWire.waitFor({ state: 'visible', timeout: 5000 });
  await deleteWire.click();
  await waitForConnectionCount(page, connectionsBefore - 1, 'delete XOR to LD2 wire');
  await capture(page, '02-design-wire-deleted');

  await openMode(page, baseUrl, 'verify', 'testbench-preservation-invalidated');
  console.log('  Phase 3: verify authorship is preserved and evidence is invalidated');
  const invalidated = await readDocumentState(page);
  assertSameAuthoredDocument(authored, invalidated, 'after Design wire deletion');
  assert(!invalidated.hasCurrentRun, 'behavioral Design edit must clear current PASS/FAIL evidence');
  assert(invalidated.scenarioAuthority === 'stale', `expected stale provenance after Design edit, got ${invalidated.scenarioAuthority}`);
  await assertNoVisiblePass(page, 'after Design wire deletion');
  await capture(page, '03-invalidated-authorship-preserved');

  // Let the normal autosave path persist the invalidated project and its local
  // testbench sidecar, then prove a real reload restores the same document.
  await page.waitForTimeout(2200);
  const persistedBeforeReload = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('rb.ide.sessionMeta.v1') ?? 'null');
    const projectId = session?.projectId ?? null;
    const snapshot = projectId
      ? JSON.parse(localStorage.getItem(`rb.ide.project.v1:${projectId}`) ?? 'null')
      : null;
    const active = snapshot?.scenarios?.find((scenario) => scenario.id === snapshot.activeScenarioId);
    return {
      projectId,
      activeScenarioId: snapshot?.activeScenarioId ?? null,
      scenarioName: active?.name ?? null,
      scenarioCount: snapshot?.scenarios?.length ?? 0,
    };
  });
  console.log(`    persisted sidecar before reload: ${JSON.stringify(persistedBeforeReload)}`);
  assert(
    persistedBeforeReload.scenarioName === authored.name,
    `autosave did not persist authored scenario before reload: ${JSON.stringify(persistedBeforeReload)}`,
  );
  console.log('  Phase 4: reload the autosaved invalidated project');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
  const reloaded = await readDocumentState(page);
  assertSameAuthoredDocument(authored, reloaded, 'after autosave reload');
  assert(!reloaded.hasCurrentRun, 'reloaded invalidated project must not resurrect current PASS/FAIL evidence');
  await assertNoVisiblePass(page, 'after autosave reload');
  await capture(page, '04-reloaded-invalidated-document');

  await openMode(page, baseUrl, 'design', 'testbench-preservation-reconnect');
  console.log('  Phase 5: reconnect through normal canvas ports');
  await fitCircuit(page);
  await connectPorts(page, 'xor_node', 'out', 'ld2_node', 'in');
  await capture(page, '05-design-wire-reconnected');

  await openMode(page, baseUrl, 'verify', 'testbench-preservation-rerun');
  console.log('  Phase 6: rerun the same testbench');
  const repaired = await readDocumentState(page);
  assertSameAuthoredDocument(authored, repaired, 'after Design reconnect');
  await runComparePass(page);
  await assertCurrentPass(page, 'reconnected Compare');
  await capture(page, '06-reconnected-pass');

  await writeFile(
    path.join(ARTIFACT_ROOT, 'testbench-preservation-after-design-edit.json'),
    `${JSON.stringify({
      gate: 'ide-testbench-preservation-after-design-edit',
      generatedAtIso: new Date().toISOString(),
      viewport: VIEWPORT,
      authored,
      invalidated,
      reloaded,
      repaired,
      connectionsBefore,
      browserProblems,
    }, null, 2)}\n`,
    'utf8',
  );

  assert(browserProblems.length === 0, `browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
});

async function renameActiveTestbench(page, name) {
  const rename = page.locator('[data-testid="ide-scenario-rename-btn"]').first();
  await rename.waitFor({ state: 'visible', timeout: 10000 });
  await rename.click();
  const input = page.locator('[data-testid="ide-scenario-rename-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(name);
  await input.press('Enter');
  await page.waitForFunction(
    (expected) => window.__RB_PROJECT_RUNTIME__?.getState?.()?.scenarios?.some(
      (scenario) => scenario.id === window.__RB_PROJECT_RUNTIME__?.getState?.()?.activeScenarioId && scenario.name === expected
    ),
    name,
    { timeout: 5000 },
  );
}

async function authorWithoutChangingTruth(page) {
  const cell = page.locator('[data-testid^="ide-stimulus-expected-"]').first();
  await cell.waitFor({ state: 'visible', timeout: 10000 });
  const testId = await cell.getAttribute('data-testid');
  const original = await cell.getAttribute('title');
  await cell.click();
  await page.waitForFunction(
    ({ id, title }) => document.querySelector(`[data-testid="${id}"]`)?.getAttribute('title') !== title,
    { id: testId, title: original },
    { timeout: 5000 },
  );
  const second = await cell.getAttribute('title');
  await cell.click();
  await page.waitForFunction(
    ({ id, title }) => document.querySelector(`[data-testid="${id}"]`)?.getAttribute('title') !== title,
    { id: testId, title: second },
    { timeout: 5000 },
  );
  await cell.click();
  await page.waitForFunction(
    ({ id, title }) => document.querySelector(`[data-testid="${id}"]`)?.getAttribute('title') === title,
    { id: testId, title: original },
    { timeout: 5000 },
  );
}

async function readDocumentState(page) {
  return page.evaluate(() => {
    const state = window.__RB_PROJECT_RUNTIME__?.getState?.();
    const scenario = state?.scenarios?.find((entry) => entry.id === state.activeScenarioId);
    return {
      id: scenario?.id ?? null,
      name: scenario?.name ?? null,
      version: scenario?.version ?? null,
      ticks: (scenario?.vectors ?? []).map((vector) => vector.tick),
      inputValues: (scenario?.vectors ?? []).map((vector) => Object.values(vector.inputs ?? {})),
      expectedValues: (scenario?.vectors ?? []).map((vector) => Object.values(vector.expected ?? {})),
      scenarioAuthority: state?.scenarioAuthority ?? null,
      hasCurrentRun: Boolean(state?.verifyLastRun),
      archivedRunCount: state?.verifyRunHistory?.length ?? 0,
    };
  });
}

function assertSameAuthoredDocument(expected, actual, label) {
  assert(actual.id === expected.id, `${label}: scenario id changed ${expected.id} -> ${actual.id}`);
  assert(actual.name === expected.name, `${label}: scenario name changed ${expected.name} -> ${actual.name}`);
  assert(actual.version === expected.version, `${label}: scenario version changed ${expected.version} -> ${actual.version}`);
  assert(JSON.stringify(actual.ticks) === JSON.stringify(expected.ticks), `${label}: ticks changed`);
  assert(JSON.stringify(actual.inputValues) === JSON.stringify(expected.inputValues), `${label}: stimulus values changed`);
  assert(JSON.stringify(actual.expectedValues) === JSON.stringify(expected.expectedValues), `${label}: expected values changed`);
}

async function assertCurrentPass(page, label) {
  const hero = page.locator('[data-testid="ide-verify-pass-hero"]').first();
  await hero.waitFor({ state: 'visible', timeout: 10000 });
  assert((await hero.getAttribute('data-stale')) !== 'true', `${label}: PASS is stale`);
}

async function assertNoVisiblePass(page, label) {
  assert(await page.locator('[data-testid="ide-verify-pass-hero"]').count() === 0, `${label}: old PASS hero is still visible`);
  const text = ((await page.locator('[data-testid="ide-verify-results-summary"]').first().textContent().catch(() => '')) ?? '').trim();
  assert(!/Checks passed/i.test(text), `${label}: old PASS text is still authoritative: ${text}`);
}

async function fitCircuit(page) {
  const fit = page.locator('[data-testid="ide-design-fit-circuit-canvas"]:visible').first();
  if (await fit.isVisible().catch(() => false)) {
    await fit.click();
    await page.waitForTimeout(180);
  }
}

async function selectWire(page, wireId) {
  const wire = page.locator(`[data-wire-id="${wireId}"]`).first();
  await wire.waitFor({ state: 'attached', timeout: 8000 });
  const hitPath = wire.locator('path').first();
  if (await hitPath.isVisible().catch(() => false)) {
    await hitPath.click({ force: true });
  } else {
    // The SVG group can be clipped by a classroom viewport even after Fit.
    // Dispatch the same bubbling click event its visible hit path owns; this
    // still exercises the normal Design selection and delete handlers.
    await wire.evaluate((element) => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }
  await page.waitForFunction(
    (id) => document.querySelector(`[data-wire-id="${id}"]`)?.getAttribute('data-wire-selected') === '1',
    wireId,
    { timeout: 5000 },
  );
}

async function connectPorts(page, fromNodeId, fromPort, toNodeId, toPort) {
  const before = await readConnectionCount(page);
  await clickPort(page, fromNodeId, fromPort);
  await page.waitForFunction(
    ({ nodeId, portName }) => {
      const start = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.editingState?.wireStartPort;
      return start?.nodeId === nodeId && start?.portName === portName;
    },
    { nodeId: fromNodeId, portName: fromPort },
    { timeout: 5000 },
  );
  await clickPort(page, toNodeId, toPort);
  await waitForConnectionCount(page, before + 1, `connect ${fromNodeId}.${fromPort} to ${toNodeId}.${toPort}`);
}

async function clickPort(page, nodeId, portName) {
  const port = page.locator(`[data-node-id="${nodeId}"] [data-port-id="${portName}"]`).first();
  await port.waitFor({ state: 'visible', timeout: 8000 });
  const box = await port.boundingBox();
  assert(Boolean(box), `port ${nodeId}.${portName} is not measurable`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    const portElement = element?.closest?.('[data-port-id]');
    const nodeElement = element?.closest?.('[data-node-id]') ?? portElement?.closest?.('[data-node-id]');
    return {
      nodeId: nodeElement?.getAttribute?.('data-node-id') ?? null,
      portName: portElement?.getAttribute?.('data-port-id') ?? null,
    };
  }, point);
  if (hit.nodeId === nodeId && hit.portName === portName) {
    await page.mouse.click(point.x, point.y);
    return;
  }
  // A wire preview can pan the logical canvas while the SVG port remains
  // mounted just beyond the viewport edge. Dispatch its ordinary bubbling
  // click so the same React port handler completes the normal wire gesture.
  await port.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function readConnectionCount(page) {
  return page.evaluate(() => window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0);
}

async function waitForConnectionCount(page, expected, label) {
  await page.waitForFunction(
    (count) => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.connections?.length ?? 0) === count,
    expected,
    { timeout: 8000 },
  );
  assert(await readConnectionCount(page) === expected, `${label}: connection count did not reach ${expected}`);
}

async function capture(page, name) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${VIEWPORT.label}-${name}.png`),
    fullPage: false,
  });
}
