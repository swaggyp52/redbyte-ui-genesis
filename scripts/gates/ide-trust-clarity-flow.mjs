#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  loadStarterProject,
  runIdeGate,
} from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  CLASSROOM_VIEWPORTS,
  installCleanStudentContext,
  openMode,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(process.cwd(), '.redbyte', 'product-immersion', 'trust-clarity-flow');
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE trust and clarity flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-trust-clarity-flow',
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

  await writeFile(path.join(ARTIFACT_ROOT, 'trust-clarity-flow.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Trust clarity failures:\n${failures.join('\n')}`);
});

async function runViewport(page, baseUrl, viewport, record) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=trust-clarity-${viewport.label}-project`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project`);
  await assertProjectClarity(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Project`);
  await capture(page, viewport, '01-project');
  record.phases.push({ phase: 'project' });

  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertDesignClarity(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Design`);
  await capture(page, viewport, '02-design');
  record.phases.push({ phase: 'design' });

  await openMode(page, baseUrl, 'verify', `trust-clarity-${viewport.label}`);
  await assertVerifyClarity(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Verify`);
  await capture(page, viewport, '03-verify');
  record.phases.push({ phase: 'verify' });

  await openMode(page, baseUrl, 'hardware', `trust-clarity-${viewport.label}`);
  await assertHardwareClarity(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Hardware`);
  await capture(page, viewport, '04-hardware');
  record.phases.push({ phase: 'hardware' });

  await openMode(page, baseUrl, 'export', `trust-clarity-${viewport.label}`);
  await assertExportClarity(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Export`);
  await capture(page, viewport, '05-export');
  record.phases.push({ phase: 'export' });

  await openMode(page, baseUrl, 'import', `trust-clarity-${viewport.label}`);
  await assertImportClarity(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Import`);
  await capture(page, viewport, '06-import');
  record.phases.push({ phase: 'import' });
}

async function assertProjectClarity(page, viewport) {
  const primaryCount = await page.locator('[data-testid="ide-project-primary-actions"] [data-product-priority="primary"]').count();
  assert(primaryCount === 1, `${viewport.label}/Project must expose one primary command, got ${primaryCount}`);

  const primary = page.locator('[data-testid="ide-project-primary-actions"] [data-product-priority="primary"]').first();
  assert(await primary.isVisible().catch(() => false), `${viewport.label}/Project primary command must be visible`);
  assert(/Start a Lab/i.test(await text(primary)), `${viewport.label}/Project primary command must be Start a Lab, got "${await text(primary)}"`);

  const secondaryCount = await page.locator('[data-testid="ide-project-primary-actions"] [data-product-priority="secondary"]').count();
  assert(secondaryCount >= 3, `${viewport.label}/Project must keep secondary paths available, got ${secondaryCount}`);

  const statusChipCount = await page.locator('[data-testid="ide-project-start-summary"] .ide-project-start-summary-chip').count();
  assert(statusChipCount <= 4, `${viewport.label}/Project start summary has too many chips: ${statusChipCount}`);
  assert(
    /Design\s*->\s*Verify\s*->\s*Map Pins\s*->\s*Export/i.test(await text(page.getByTestId('ide-project-start-summary'))),
    `${viewport.label}/Project must keep the workflow path readable`,
  );
}

async function assertDesignClarity(page, viewport) {
  const explainer = page.getByTestId('ide-design-logical-io-explainer').first();
  await explainer.waitFor({ state: 'visible', timeout: 10000 });
  const explainerText = await text(explainer);
  assert(/logical (I\/O|inputs and outputs)/i.test(explainerText), `${viewport.label}/Design must explain logical I/O, got "${explainerText}"`);
  assert(/Basys3 (switches and LEDs later|resources and package pins)|board resource and package pin/i.test(explainerText), `${viewport.label}/Design must distinguish mapping from labels, got "${explainerText}"`);

  const inputNodeId = await firstNodeId(page, ['INPUT', 'Switch']);
  assert(inputNodeId, `${viewport.label}/Design starter needs an input node to inspect`);
  await clickNode(page, inputNodeId);

  const signalModel = page.getByTestId('ide-design-selected-signal-model').first();
  await signalModel.waitFor({ state: 'visible', timeout: 10000 });
  const modelText = await text(signalModel);
  for (const expected of ['Label', 'Logical direction', 'Board resource', 'Package pin']) {
    assert(modelText.includes(expected), `${viewport.label}/Design selected signal model missing "${expected}": ${modelText}`);
  }
}

async function assertVerifyClarity(page, viewport) {
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 15000 });
  const steps = page.getByTestId('ide-testbench-custom-flow-steps').first();
  await steps.waitFor({ state: 'visible', timeout: 10000 });
  const stepsText = await text(steps);
  for (const expected of ['Add or select input cases', 'Fill expected outputs', 'Run Compare', 'Fix expected values or inspect design']) {
    assert(stepsText.includes(expected), `${viewport.label}/Verify testbench steps missing "${expected}": ${stepsText}`);
  }

  const modeExplainer = await text(page.getByTestId('ide-vcb-mode-explainer').first());
  assert(/Observe:|Compare:/i.test(modeExplainer), `${viewport.label}/Verify must explain Observe/Compare, got "${modeExplainer}"`);

  const conceptExpectations = [
    ['ide-testbench-section-inputs', /One input combination to try|Drive input signals/i],
    ['ide-testbench-section-expected', /What your circuit should produce|blank expected cell/i],
    ['ide-testbench-section-observed', /What RedByte simulated|observed values/i],
    ['ide-testbench-section-status', /Compare|Observe/i],
  ];
  for (const [testId, pattern] of conceptExpectations) {
    const content = await text(page.getByTestId(testId).first());
    assert(pattern.test(content), `${viewport.label}/Verify ${testId} copy mismatch: "${content}"`);
  }

  const expectedCells = await readExpectedOutputCells(page);
  assert(expectedCells.some((cell) => cell.visibleText === '0' || cell.visibleText === '1'), `${viewport.label}/Verify expected-output values must be visibly editable 0/1 cells: ${JSON.stringify(expectedCells.slice(0, 6))}`);
}

async function assertHardwareClarity(page, viewport) {
  const mappingModel = page.getByTestId('ide-hardware-signal-resource-pin-model').first();
  await mappingModel.waitFor({ state: 'visible', timeout: 10000 });
  const mappingText = await text(mappingModel);
  assert(/logical signal/i.test(mappingText), `${viewport.label}/Hardware must name logical signal, got "${mappingText}"`);
  assert(/Basys3 control/i.test(mappingText), `${viewport.label}/Hardware must name Basys3 control, got "${mappingText}"`);
  assert(/constraints|package/i.test(mappingText), `${viewport.label}/Hardware must name export constraints/package, got "${mappingText}"`);
  assert(/does not prove board behavior/i.test(mappingText), `${viewport.label}/Hardware must not overclaim board behavior, got "${mappingText}"`);
}

async function assertExportClarity(page, viewport) {
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  const pinSummary = page.getByTestId('ide-export-signal-resource-pin-summary').first();
  await pinSummary.waitFor({ state: 'visible', timeout: 10000 });
  assert(/Signal\s*->\s*Board resource\s*->\s*Package pin/i.test(await text(pinSummary)), `${viewport.label}/Export must show signal/resource/pin summary`);

  const bodyText = await page.locator('body').textContent();
  assert(/E0|browser/i.test(bodyText ?? ''), `${viewport.label}/Export must keep the browser-E0 proof boundary visible`);
  assert(!/\bE1\s+ready|\bE2\s+ready|\bE3\s+ready|board observed/i.test(bodyText ?? ''), `${viewport.label}/Export must not overclaim E1/E2/E3 or board observation`);
}

async function assertImportClarity(page, viewport) {
  const cancelCopy = page.getByTestId('ide-import-cancel-preserves-copy').first();
  await cancelCopy.waitFor({ state: 'visible', timeout: 10000 });
  const content = await text(cancelCopy);
  assert(/current project stays intact/i.test(content), `${viewport.label}/Import must say current work is preserved, got "${content}"`);
  assert(/Cancel keeps current work/i.test(content), `${viewport.label}/Import must name cancel preservation, got "${content}"`);
  assert(/failed imports do not change files/i.test(content), `${viewport.label}/Import must make failure non-destructive, got "${content}"`);
}

async function firstNodeId(page, nodeTypes) {
  return page.evaluate((types) => {
    const nodes = window.__RB_PROJECT_RUNTIME__?.getState?.()?.circuit?.nodes ?? [];
    return nodes.find((node) => types.includes(node.type))?.id ?? null;
  }, nodeTypes);
}

async function clickNode(page, nodeId) {
  const body = page.locator(`[data-node-id="${nodeId}"] .logic-node-body`).first();
  const box = await body.boundingBox();
  assert(Boolean(box), `node ${nodeId} must have a clickable body`);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
}

async function readExpectedOutputCells(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]'))
      .slice(0, 12)
      .map((cell) => ({
        testId: cell.getAttribute('data-testid') ?? '',
        visibleText: (cell.querySelector('.ide-stimulus-cell__value')?.textContent ?? cell.textContent ?? '').trim(),
        title: cell.getAttribute('title') ?? '',
      })),
  );
}

async function capture(page, viewport, name) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${viewport.label}-${name}.png`),
    fullPage: false,
  });
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
