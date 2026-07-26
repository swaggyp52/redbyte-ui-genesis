#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyFail, waitForVerifyResult } from './_verifyStatus.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  CLASSROOM_VIEWPORTS,
  installCleanStudentContext,
  openMode,
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(
  process.cwd(),
  '.redbyte',
  'product-immersion',
  'verify-repair-ux-v2-flow',
);
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE Verify repair UX v2 flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-verify-repair-ux-v2-flow',
    generatedAtIso: new Date().toISOString(),
    viewports: [],
    browserProblems,
  };
  const failures = [];

  for (const viewport of CLASSROOM_VIEWPORTS) {
    const viewportRecord = { viewport: viewport.label, paths: [] };
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      viewportRecord.paths.push(await runPassStaleWrongExpected(page, baseUrl, viewport));
      viewportRecord.paths.push(await runWrongCircuitFlow(page, baseUrl, viewport));
      viewportRecord.paths.push(await runDisconnectedOutputFlow(page, baseUrl, viewport));
      record.viewports.push(viewportRecord);
    } catch (error) {
      viewportRecord.error = error instanceof Error ? (error.stack ?? error.message) : String(error);
      record.viewports.push(viewportRecord);
      failures.push(`${viewport.label}: ${viewportRecord.error}`);
    }
  }

  await writeFile(path.join(ARTIFACT_ROOT, 'verify-repair-ux-v2-flow.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Verify repair UX v2 failures:\n${failures.join('\n')}`);
});

async function runPassStaleWrongExpected(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-repair-ux-v2-pass-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project`);
  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

  await openMode(page, baseUrl, 'verify', `verify-repair-ux-v2-pass-${viewport.label}`);
  await page.waitForSelector('[data-testid="ide-testbench-documents"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-verify-authoring-path"]', { timeout: 10000 });
  const documentText = await text(page.getByTestId('ide-testbench-documents').first());
  const authoringPath = await text(page.getByTestId('ide-verify-authoring-path').first());
  const stimulusSummary = await text(page.getByTestId('ide-verify-stimulus-summary').first());
  assert(/Testbench documents/i.test(documentText), `${viewport.label}/Verify must expose explicit testbench documents`);
  assert(/Combinational case table/i.test(authoringPath), `${viewport.label}/Verify must identify the active authoring model`);
  assert(/drives inputs/i.test(stimulusSummary), `${viewport.label}/Verify must explain stimulus inputs`);
  assert(/expected cells.*Compare check/i.test(stimulusSummary), `${viewport.label}/Verify must explain how expected outputs become Compare checks`);

  await runComparePass(page);
  await assertPassAuthority(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/PASS authority`);
  await capture(page, viewport, '01-pass-authority');

  const { fieldId, tick, original } = await pickExpectedOutputCell(page);
  await flipExpectedCell(page, fieldId, tick);
  await assertStaleAuthority(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/stale expected edit`);
  await capture(page, viewport, '02-stale-expected-edit');

  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}/Compare mode must be available after stale edit`);
  const staleRerun = page.getByTestId('ide-verify-stale-keep-reference').first();
  if (await staleRerun.isVisible().catch(() => false)) {
    await staleRerun.click();
  } else {
    await clickVerifyRun(page);
  }
  await waitForVerifyResult(page, { timeout: 20000 });
  await assertRepairDecisionPanel(page, viewport, 'wrong expected-output');
  const repairReachability = await assertObservedRepairReachability(page, viewport, fieldId, tick, original);
  await assertStaleAuthority(page, viewport);
  await runCompare(page, `${viewport.label}/repaired expected-output`, 'pass');
  await assertPassAuthority(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/wrong expected-output repair`);
  await capture(page, viewport, '03-wrong-expected-repair');

  return {
    path: 'A/B/C PASS stale wrong expected-output repaired by observed evidence',
    editedCell: { fieldId, tick, original },
    repairReachability,
  };
}

async function runWrongCircuitFlow(page, baseUrl, viewport) {
  await startBlankProject(page, baseUrl, `verify-repair-ux-v2-wrong-circuit-${viewport.label}`, `Wrong circuit ${viewport.label}`);
  await revealDesignLibrary(page);
  await setDesignZoomPreset(page, '50');
  await buildTwoInputCircuit(page, 'OR', 'XOR_OUT');
  await assertNoRootOverflow(page, `${viewport.label}/wrong circuit design`);

  await openMode(page, baseUrl, 'verify', `verify-repair-ux-v2-wrong-circuit-${viewport.label}`);
  const cases = await buildXorCases(page, 'XOR_OUT');
  await authorInputCases(page, cases);
  await authorExpectedCases(page, cases);
  await runCompare(page, 'wrong OR circuit', 'fail');
  await assertRepairDecisionPanel(page, viewport, 'wrong circuit');
  const panel = page.getByTestId('ide-verify-repair-panel').first();
  const category = await panel.getAttribute('data-category');
  const primaryLane = await panel.getAttribute('data-repair-primary-lane');
  assert(
    category === 'design-output-wrong' || category === 'possible-wrong-gate-or-wire',
    `${viewport.label}/wrong circuit diagnosis must stay design-oriented, got ${category}`,
  );
  assert(primaryLane === 'design', `${viewport.label}/wrong circuit should make design lane primary, got ${primaryLane}`);
  await capture(page, viewport, '04-wrong-circuit-repair');

  await page.getByTestId('ide-verify-repair-open-design').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="ide-design-debug-context-banner"]', { timeout: 10000 });
  const designText = await text(page.getByTestId('ide-design-debug-context-banner').first());
  assert(/XOR_OUT/i.test(designText), `${viewport.label}/Design handoff must name failed output, got "${designText}"`);
  assert(/Driver|No direct driver|Focus driver/i.test(designText), `${viewport.label}/Design handoff must expose driver context, got "${designText}"`);
  await capture(page, viewport, '05-wrong-circuit-design-handoff');

  return { path: 'D wrong circuit', category, primaryLane };
}

async function runDisconnectedOutputFlow(page, baseUrl, viewport) {
  await startBlankProject(page, baseUrl, `verify-repair-ux-v2-disconnected-${viewport.label}`, `Disconnected ${viewport.label}`);
  await revealDesignLibrary(page);
  await setDesignZoomPreset(page, '50');
  await placeAndLabel(page, '[data-testid="ide-design-board-input-sw0"]', 'A', { x: 0.18, y: 0.44 });
  await placeAndLabel(page, '[data-testid="ide-design-board-output-ld0"]', 'OUT', { x: 0.78, y: 0.44 });
  await assertNoRootOverflow(page, `${viewport.label}/disconnected output design`);

  await openMode(page, baseUrl, 'verify', `verify-repair-ux-v2-disconnected-${viewport.label}`);
  const rows = await readIoRows(page);
  const inputId = requireRowIdByLabel(rows, 'A');
  const outputId = requireRowIdByLabel(rows, 'OUT');
  const cases = [
    { inputs: { [inputId]: 0 }, expected: { [outputId]: 0 }, outputId },
    { inputs: { [inputId]: 1 }, expected: { [outputId]: 1 }, outputId },
  ];
  await authorInputCases(page, cases);
  await authorExpectedCases(page, cases);
  await runCompare(page, 'disconnected output', 'blocked');

  await openFailureDetails(page, `${viewport.label}/disconnected output`);
  const panel = page.getByTestId('ide-verify-structural-recovery-panel').first();
  await panel.waitFor({ state: 'visible', timeout: 10000 });
  const structuralText = await text(panel);
  assert(/OUT/i.test(structuralText), `${viewport.label}/structural recovery must name OUT, got "${structuralText}"`);
  assert(/not driven|connect a driver/i.test(structuralText), `${viewport.label}/structural recovery must say the output is not driven, got "${structuralText}"`);
  assert(/not an expected-output mismatch/i.test(structuralText), `${viewport.label}/structural recovery must not look like normal Compare mismatch, got "${structuralText}"`);
  const resultAuthority = page.getByTestId('ide-verify-results-summary').first();
  await resultAuthority.waitFor({ state: 'visible', timeout: 10000 });
  const commandSummary = await text(resultAuthority);
  assert(
    /does not match|cannot verify|output/i.test(commandSummary),
    `${viewport.label}/latest-run authority must describe the structural failure, got "${commandSummary}"`,
  );
  assert(!/0\/0 match/i.test(`${structuralText} ${commandSummary}`), `${viewport.label}/structural recovery must not lead with 0/0 match`);
  assert(await page.getByTestId('ide-verify-structural-open-design').isVisible().catch(() => false), `${viewport.label}/structural recovery must expose Open Design`);
  await assertNoRootOverflow(page, `${viewport.label}/disconnected output recovery`);
  await capture(page, viewport, '06-disconnected-output-recovery');

  return { path: 'E disconnected output', structuralText, commandSummary };
}

async function assertPassAuthority(page, viewport) {
  const passHero = page.getByTestId('ide-verify-pass-hero');
  const passCount = await passHero.count();
  assert(passCount === 1, `${viewport.label}/PASS should have exactly one latest-run authority, got ${passCount}`);
  const hero = passHero.first();
  await hero.waitFor({ state: 'visible', timeout: 10000 });
  assert((await hero.getAttribute('data-stale')) !== 'true', `${viewport.label}/PASS authority must be current`);
  const heroText = await text(hero);
  assert(/Checks passed|PASS|Checks aligned/i.test(heroText), `${viewport.label}/PASS authority must be readable, got "${heroText}"`);
  const repairCount = await page.locator('[data-testid="ide-verify-repair-panel"], [data-testid="ide-verify-structural-recovery-panel"]').count();
  assert(repairCount === 0, `${viewport.label}/PASS should not show repair panels, got ${repairCount}`);
}

async function assertStaleAuthority(page, viewport) {
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ide-verify-results-summary"]')?.getAttribute('data-kind') === 'stale',
    undefined,
    { timeout: 10000 },
  );
  const summary = page.getByTestId('ide-verify-results-summary').first();
  await summary.waitFor({ state: 'visible', timeout: 10000 });
  assert((await summary.getAttribute('data-kind')) === 'stale', `${viewport.label}/latest-run authority must be marked stale`);
  const summaryText = await text(summary);
  assert(/Checks changed/i.test(summaryText), `${viewport.label}/stale state must say checks changed, got "${summaryText}"`);
  assert(/Rerun Compare/i.test(summaryText), `${viewport.label}/stale authority must ask for Compare rerun, got "${summaryText}"`);
  assert(!/Checks passed/i.test(summaryText), `${viewport.label}/stale authority must not keep Checks passed as title, got "${summaryText}"`);
  assert(await page.getByTestId('ide-verify-pass-hero').count() === 0, `${viewport.label}/stale state must replace the old PASS hero`);
}

async function assertRepairDecisionPanel(page, viewport, label) {
  const resultSummary = page.getByTestId('ide-verify-results-summary').first();
  await resultSummary.waitFor({ state: 'visible', timeout: 10000 });
  assert((await resultSummary.getAttribute('data-kind')) === 'fail', `${viewport.label}/${label}: visible result authority must be FAIL`);
  const guidanceText = await text(page.getByTestId('ide-verify-results-guidance').first());
  assert(/Expected value is incorrect/i.test(guidanceText), `${viewport.label}/${label}: visible FAIL guidance must mention expected values`);
  assert(/Circuit logic is incorrect/i.test(guidanceText), `${viewport.label}/${label}: visible FAIL guidance must mention circuit logic`);
  assert(/Output is disconnected/i.test(guidanceText), `${viewport.label}/${label}: visible FAIL guidance must mention disconnected outputs`);
  await openFailureDetails(page, `${viewport.label}/${label}`);
  const panel = page.getByTestId('ide-verify-repair-panel').first();
  await panel.waitFor({ state: 'visible', timeout: 10000 });
  const panelText = await text(panel);
  assert(/Compare failed/i.test(panelText), `${viewport.label}/${label}: panel must name Compare failed, got "${panelText}"`);
  assert(/Is the expected output wrong, or is the circuit wrong/i.test(panelText), `${viewport.label}/${label}: panel must ask the repair decision, got "${panelText}"`);
  assert(/Fix expected output/i.test(panelText), `${viewport.label}/${label}: expected-output lane missing, got "${panelText}"`);
  assert(/Use observed only when the circuit behavior is correct/i.test(panelText), `${viewport.label}/${label}: expected lane must guard Use observed, got "${panelText}"`);
  assert(/Fix circuit or design/i.test(panelText), `${viewport.label}/${label}: design lane missing, got "${panelText}"`);
  assert(/Inspect Design/i.test(panelText), `${viewport.label}/${label}: design lane must expose Inspect Design, got "${panelText}"`);
  assert(/disconnected or missing driver/i.test(panelText), `${viewport.label}/${label}: design lane must mention driver checks, got "${panelText}"`);
  for (const testId of [
    'ide-verify-repair-edit-expected',
    'ide-verify-repair-use-observed',
    'ide-verify-repair-open-design',
    'ide-verify-repair-rerun',
  ]) {
    assert(await page.getByTestId(testId).first().isVisible().catch(() => false), `${viewport.label}/${label}: ${testId} must be visible`);
  }
}

async function assertObservedRepairReachability(page, viewport, fieldId, tick, expectedObservedValue) {
  const testId = 'ide-verify-repair-use-observed';
  const button = page.getByTestId(testId).first();
  const panel = page.getByTestId('ide-verify-repair-panel').first();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  assert(await button.isEnabled(), `${viewport.label}/wrong expected-output: Use observed must be enabled`);
  await button.scrollIntoViewIfNeeded();

  const hitTest = await button.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hit = document.elementFromPoint(center.x, center.y);
    return {
      width: rect.width,
      height: rect.height,
      center,
      hitTestId: hit?.getAttribute?.('data-testid') ?? null,
      reachesButton: hit === element || Boolean(hit && element.contains(hit)),
    };
  });
  assert(hitTest.width >= 36 && hitTest.height >= 32, `${viewport.label}/wrong expected-output: Use observed hit target is too small`);
  assert(
    hitTest.reachesButton,
    `${viewport.label}/wrong expected-output: Use observed center is intercepted by ${hitTest.hitTestId ?? 'an unlabelled element'}`,
  );
  await button.click({ trial: true });

  const panelGeometry = await panel.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    scrollLeft: element.scrollLeft,
  }));
  assert(
    panelGeometry.scrollWidth <= panelGeometry.clientWidth,
    `${viewport.label}/wrong expected-output: repair panel overflows horizontally (${panelGeometry.scrollWidth}/${panelGeometry.clientWidth})`,
  );
  assert(panelGeometry.scrollLeft === 0, `${viewport.label}/wrong expected-output: repair panel has horizontal scroll offset`);
  await assertNoRootOverflow(page, `${viewport.label}/Use observed reachability`);

  await button.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const focusedTestId = await page.evaluate(() => document.activeElement?.getAttribute?.('data-testid') ?? null);
  assert(focusedTestId === testId, `${viewport.label}/wrong expected-output: Tab must return focus to Use observed, got ${focusedTestId}`);
  await page.keyboard.press('Enter');
  const cellTestId = `ide-stimulus-expected-${fieldId}-t${tick}`;
  let repairedValue = await readCellValue(page, cellTestId);
  for (let attempt = 0; attempt < 30 && repairedValue !== expectedObservedValue; attempt += 1) {
    await page.waitForTimeout(100);
    repairedValue = await readCellValue(page, cellTestId);
  }
  const activationState = await page.evaluate((targetTestId) => ({
    activeTestId: document.activeElement?.getAttribute?.('data-testid') ?? null,
    panelPresent: Boolean(document.querySelector('[data-testid="ide-verify-repair-panel"]')),
    resultsKind: document.querySelector('[data-testid="ide-verify-results-summary"]')?.getAttribute('data-kind') ?? null,
    cellTitle: document.querySelector(`[data-testid="${targetTestId}"]`)?.getAttribute('title') ?? null,
  }), cellTestId);
  assert(
    repairedValue === expectedObservedValue,
    `${viewport.label}/wrong expected-output: Enter did not apply observed value ${expectedObservedValue}; got ${repairedValue}; state=${JSON.stringify(activationState)}`,
  );

  return { hitTest, panelGeometry, focusedTestId, activation: 'Enter', activationState, repairedValue };
}

async function openFailureDetails(page, label) {
  const failureRepair = page.getByTestId('ide-verify-advanced-failure').first();
  await failureRepair.waitFor({ state: 'visible', timeout: 10000 });
  assert(
    (await failureRepair.evaluate((element) => element.tagName.toLowerCase())) === 'section',
    `${label}: failure repair must be an always-visible section`,
  );
  assert(
    !(await failureRepair.locator('summary').isVisible().catch(() => false)),
    `${label}: failure repair must not hide behind a disclosure`,
  );
}

async function startBlankProject(page, baseUrl, gateLabel, projectName) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=${gateLabel}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${gateLabel}/Project startup`);
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
  await fitCenterZoom(page);
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
  await waitForVerifyResult(page, { timeout: 10000 });
  const statusText = await text(page.getByTestId('ide-verify-summary-status').first());
  if (expectation === 'pass') {
    assert(/PASS|Compare PASS|Checks aligned/i.test(statusText), `${label}: Compare should PASS, got "${statusText}"`);
  } else if (expectation === 'fail') {
    assert(isVerifyFail(statusText), `${label}: Compare should FAIL, got "${statusText}"`);
  } else {
    assert(
      /DESIGN BLOCKED|CANNOT VERIFY|INCONCLUSIVE/i.test(statusText),
      `${label}: structural preflight should block Compare without reporting FAIL, got "${statusText}"`,
    );
    assert(!isVerifyFail(statusText), `${label}: structural preflight must remain distinct from Compare FAIL`);
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

async function pickExpectedOutputCell(page) {
  const cell = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]'));
    for (const element of candidates) {
      const title = element.getAttribute('title') ?? '';
      const titleValue = /:\s*1\s*-\s*drag/i.test(title) ? 1 : /:\s*0\s*-\s*drag/i.test(title) ? 0 : null;
      if (titleValue === 0 || titleValue === 1) {
        const match = element.getAttribute('data-testid')?.match(/^ide-stimulus-expected-(.+)-t(\d+)$/);
        if (match) return { fieldId: match[1], tick: Number(match[2]), original: titleValue };
      }
    }
    return null;
  });
  assert(cell && (cell.original === 0 || cell.original === 1), 'Could not find a saved expected-output cell to edit');
  return cell;
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
  if (/:\s*not set\s*-\s*drag/i.test(title ?? '')) return null;
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
  if (await port.isVisible().catch(() => false)) {
    const box = await port.boundingBox();
    if (!box) throw new Error(`port ${nodeId}.${portName} has no clickable box`);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    return;
  }

  const clusters = page.locator(`[data-node-id="${nodeId}"] [data-port-cluster]`);
  for (let index = 0; index < await clusters.count(); index += 1) {
    const cluster = clusters.nth(index);
    const portIds = ((await cluster.getAttribute('data-port-ids')) ?? '').split(/\s+/);
    if (!portIds.includes(portName)) continue;
    await cluster.click();
    const choice = page
      .locator(`[data-testid="logic-port-picker-choice-${nodeId}-${portName}"]`)
      .first();
    await choice.waitFor({ state: 'visible', timeout: 5000 });
    await choice.click();
    return;
  }

  throw new Error(`port ${nodeId}.${portName} was not visible as a direct target or dense-picker choice`);
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
      direction: row.direction,
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

async function renameProject(page, name) {
  const title = page.locator('[data-testid="ide-topbar-project-rename"]').first();
  if (!(await title.isVisible().catch(() => false))) return;
  await title.dblclick();
  const input = page.locator('[data-testid="ide-topbar-project-name-input"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.fill(name);
  await input.press('Enter');
}

async function setDesignZoomPreset(page, preset) {
  if (preset !== '50') return;
  const reset = page.locator('[data-testid="ide-design-zoom-reset"]:visible').first();
  const zoomOut = page.locator('[data-testid="ide-design-zoom-out"]:visible').first();
  await reset.waitFor({ state: 'visible', timeout: 5000 });
  await zoomOut.waitFor({ state: 'visible', timeout: 5000 });
  await reset.click();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await zoomOut.click();
  }
  await page.waitForTimeout(120);
}

async function fitCenterZoom(page) {
  const button = page.locator('[data-testid="ide-design-fit-circuit-canvas"]:visible').first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
    await page.waitForTimeout(160);
  }
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
