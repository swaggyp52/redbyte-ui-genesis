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

const ARTIFACT_ROOT = path.join(process.cwd(), '.redbyte', 'product-immersion', 'professional-classroom-ui-flow');
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE professional classroom UI flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-professional-classroom-ui-flow',
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

  await writeFile(path.join(ARTIFACT_ROOT, 'professional-classroom-ui-flow.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Professional classroom UI failures:\n${failures.join('\n')}`);
});

async function runViewport(page, baseUrl, viewport, record) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=professional-classroom-${viewport.label}-project`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project`);
  await assertProjectFirstLaunch(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Project`);
  await capture(page, viewport, '01-project-first-launch');
  record.phases.push({ phase: 'project-first-launch' });

  await openMode(page, baseUrl, 'design', `professional-classroom-${viewport.label}-blank`);
  await assertBlankDesignProfessional(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Blank Design`);
  await capture(page, viewport, '02-design-blank');
  record.phases.push({ phase: 'design-blank' });

  await openMode(page, baseUrl, 'hardware', `professional-classroom-${viewport.label}-empty-hardware`);
  await assertHardwareEmptyProfessional(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Hardware empty`);
  await capture(page, viewport, '03-hardware-empty');
  record.phases.push({ phase: 'hardware-empty' });

  await openMode(page, baseUrl, 'export', `professional-classroom-${viewport.label}-blocked-export`);
  await assertExportBlockedProfessional(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Export blocked`);
  await capture(page, viewport, '04-export-blocked');
  record.phases.push({ phase: 'export-blocked' });

  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertStarterDesignProfessional(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Starter Design`);
  await capture(page, viewport, '05-design-starter');
  record.phases.push({ phase: 'design-starter' });

  await openMode(page, baseUrl, 'verify', `professional-classroom-${viewport.label}`);
  await assertVerifyProfessional(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Verify`);
  await capture(page, viewport, '06-verify-fail');
  record.phases.push({ phase: 'verify-fail' });

  await openMode(page, baseUrl, 'hardware', `professional-classroom-${viewport.label}`);
  await assertHardwareMappedProfessional(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Hardware mapped`);
  await capture(page, viewport, '07-hardware-mapped');
  record.phases.push({ phase: 'hardware-mapped' });

  await openMode(page, baseUrl, 'export', `professional-classroom-${viewport.label}`);
  await assertExportPackageProfessional(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Export package`);
  await capture(page, viewport, '08-export-package');
  record.phases.push({ phase: 'export-package' });

  await openMode(page, baseUrl, 'import', `professional-classroom-${viewport.label}`);
  await assertImportProfessional(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Import`);
  await capture(page, viewport, '09-import');
  record.phases.push({ phase: 'import' });
}

async function assertProjectFirstLaunch(page, viewport) {
  const projectText = await text(page.getByTestId('ide-project-command-center').first());
  assert(/Start a Lab/i.test(projectText), `${viewport.label}/Project must expose Start a Lab`);
  assert(/Build fresh/i.test(projectText), `${viewport.label}/Project must keep Build fresh available`);
  assert(/Open Starter/i.test(projectText), `${viewport.label}/Project must keep Open Starter available`);
  assert(/Import Project/i.test(projectText), `${viewport.label}/Project must keep Import Project available`);
  assert(/Open Existing/i.test(projectText), `${viewport.label}/Project must keep Open Existing available`);
  const importUtility = page.getByTestId('mode-button-import').first();
  await importUtility.waitFor({ state: 'visible', timeout: 10000 });
  assert(
    /\bImport\b/i.test((await importUtility.getAttribute('title')) ?? ''),
    `${viewport.label}/Import must remain available as the rail utility`,
  );
  assert(
    /\bide-mode-button--utility\b/.test((await importUtility.getAttribute('class')) ?? ''),
    `${viewport.label}/Import must not become a sixth product stage`,
  );

  const projectPrimaryCount = await page.locator('[data-testid="ide-project-primary-actions"] [data-product-priority="primary"]').count();
  assert(projectPrimaryCount === 1, `${viewport.label}/Project must have one body primary action, got ${projectPrimaryCount}`);
  const primaryText = await text(page.locator('[data-testid="ide-project-primary-actions"] [data-product-priority="primary"]').first());
  assert(/Start a Lab/i.test(primaryText), `${viewport.label}/Project primary must be Start a Lab, got "${primaryText}"`);

  const duplicateProductSpine = page.locator('[data-testid^="ide-product-spine-"]:visible');
  assert(
    (await duplicateProductSpine.count()) === 0,
    `${viewport.label}/Project must not restore the duplicate product-spine action authority`,
  );

  const summaryChipCount = await page.locator('[data-testid="ide-project-start-summary"] .ide-project-start-summary-chip').count();
  assert(summaryChipCount <= 4, `${viewport.label}/Project start summary has too many chips: ${summaryChipCount}`);
  const prominentProjectActions = await prominentActions(page, 'project');
  assert(
    prominentProjectActions.length <= 1,
    `${viewport.label}/Project has more than one prominent primary action: ${JSON.stringify(prominentProjectActions)}`,
  );
}

async function assertBlankDesignProfessional(page, viewport) {
  const empty = page.getByTestId('ide-design-empty-state').first();
  await empty.waitFor({ state: 'visible', timeout: 10000 });
  const emptyText = await text(empty);
  assert(/Add inputs and outputs, place a part, then wire ports/i.test(emptyText), `${viewport.label}/Blank Design must name the authoring steps, got "${emptyText}"`);

  const explainer = page.locator('[data-testid="ide-design-logical-io-explainer"]:visible').first();
  await explainer.waitFor({ state: 'visible', timeout: 10000 });
  const explainerText = await text(explainer);
  assert(/logical (I\/O|inputs and outputs|signals)/i.test(explainerText), `${viewport.label}/Design must explain logical I/O`);
  assert(/Basys3 (switches and LEDs later|resources and package pins)|board resource and package pin/i.test(explainerText), `${viewport.label}/Design must distinguish logical labels from board mapping`);

  const healthCountVisible = await page.locator('.ide-design-workspace-health-count').first().isVisible().catch(() => false);
  const healthStatusVisible = await page.locator('.ide-design-workspace-health-status').first().isVisible().catch(() => false);
  assert(!healthCountVisible && !healthStatusVisible, `${viewport.label}/Design must not expose raw health counters as dominant chrome`);
  const circuitHudVisible = await page.getByTestId('circuit-hud').first().isVisible().catch(() => false);
  assert(!circuitHudVisible, `${viewport.label}/Design must not expose the low-level circuit HUD in the classroom workbench`);
}

async function assertHardwareEmptyProfessional(page, viewport) {
  const hardwarePanel = page.getByTestId('ide-hardware-panel').first();
  await hardwarePanel.waitFor({ state: 'visible', timeout: 10000 });
  const panelText = await text(hardwarePanel);
  assert(/Add logical inputs and outputs in Design first/i.test(panelText), `${viewport.label}/Hardware empty state must route students to Design, got "${panelText}"`);
  assert(/Map Pins will list those signals here for Basys3 binding/i.test(panelText), `${viewport.label}/Hardware empty state must explain why the table is empty`);

  const recovery = page.locator('[data-testid="ide-hw-map-empty"]:visible').first();
  await recovery.waitFor({ state: 'visible', timeout: 10000 });
  assert(/No signals to map yet/i.test(await text(recovery)), `${viewport.label}/Hardware empty state must keep the no-signal recovery work object visible`);
  const openDesign = page.locator('[data-testid="ide-hardware-next-primary"]:visible').first();
  await openDesign.waitFor({ state: 'visible', timeout: 10000 });
  assert(/Open Design/i.test(await text(openDesign)), `${viewport.label}/Hardware empty recovery must offer Open Design`);
  assert(!(await openDesign.isDisabled()), `${viewport.label}/Hardware empty recovery Open Design action must be enabled`);

  const workspaceVisible = await page.getByTestId('ide-hw-board-workspace').first().isVisible().catch(() => false);
  const boardCanvasVisible = await page.locator('.ide-hw-board-canvas').first().isVisible().catch(() => false);
  const mapTableVisible = await page.getByTestId('ide-hw-map-table').first().isVisible().catch(() => false);
  assert(!workspaceVisible && !boardCanvasVisible && !mapTableVisible, `${viewport.label}/Hardware empty state must not make inactive board/table dominant`);
}

async function assertExportBlockedProfessional(page, viewport) {
  const empty = page.getByTestId('ide-export-blocked-empty-state').first();
  await empty.waitFor({ state: 'visible', timeout: 10000 });
  const emptyText = await text(empty);
  assert(/Cannot export yet/i.test(emptyText), `${viewport.label}/Export blocked state must name the readiness blocker`);
  assert(/Resolve in (Design|Verify|Map Pins)/i.test(emptyText), `${viewport.label}/Export blocked state must name the recovery owner`);
  assert(
    !/(handoff|export) package (is )?ready|ready to download/i.test(emptyText),
    `${viewport.label}/Export blocked state must avoid fake package-ready language`,
  );
  const reasonText = await text(empty.locator('p').first());
  assert(reasonText.length >= 12, `${viewport.label}/Export blocked state must explain why export is blocked`);

  const fileBrowserVisible = await page.getByTestId('ide-export-file-browser-v1').first().isVisible().catch(() => false);
  const downloadVisible = await page.getByTestId('ide-export-package-download-v1').first().isVisible().catch(() => false);
  assert(!fileBrowserVisible, `${viewport.label}/Export blocked state must not show generated file browser`);
  assert(!downloadVisible, `${viewport.label}/Export blocked state must not show Download package`);
  const prominentExportActions = await prominentActions(page, 'export');
  assert(
    prominentExportActions.length <= 1,
    `${viewport.label}/Export blocked state has competing primary actions: ${JSON.stringify(prominentExportActions)}`,
  );
}

async function assertStarterDesignProfessional(page, viewport) {
  const inputNodeId = await firstNodeId(page, ['INPUT', 'Switch']);
  assert(inputNodeId, `${viewport.label}/Design starter needs an input node`);
  await clickNode(page, inputNodeId);

  const signalModel = page.getByTestId('ide-design-selected-signal-model').first();
  await signalModel.waitFor({ state: 'visible', timeout: 10000 });
  const signalText = await text(signalModel);
  for (const expected of ['Label', 'Logical direction', 'Board resource', 'Package pin']) {
    assert(signalText.includes(expected), `${viewport.label}/Design selected signal model missing "${expected}": ${signalText}`);
  }

  const topText = await firstViewportText(page);
  assert(!/Runtime\s+Healthy\s+\d+\s+nodes\s+\d+\s+wires/i.test(topText), `${viewport.label}/Design first viewport still reads like a debug HUD`);
}

async function assertVerifyProfessional(page, viewport) {
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 15000 });
  const steps = page.getByTestId('ide-testbench-custom-flow-steps').first();
  await steps.waitFor({ state: 'visible', timeout: 10000 });
  const stepsText = await text(steps);
  for (const expected of ['Add or select input cases', 'Fill expected outputs', 'Run Compare', 'Fix expected values or inspect design']) {
    assert(stepsText.includes(expected), `${viewport.label}/Verify testbench steps missing "${expected}": ${stepsText}`);
  }

  const modeExplainer = await text(page.getByTestId('ide-vcb-mode-explainer').first());
  assert(/Observe:|Compare:/i.test(modeExplainer), `${viewport.label}/Verify must explain Observe vs Compare, got "${modeExplainer}"`);
  assert(/See what the circuit currently does|Compare the run/i.test(modeExplainer), `${viewport.label}/Verify mode copy must be student-facing`);

  await runComparePass(page);
  const { fieldId, tick } = await pickExpectedOutputCell(page);
  await flipExpectedCell(page, fieldId, tick);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}/Verify Compare mode must remain selectable after expected edit`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const failStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]').first());
  assert(isVerifyFail(failStatus), `${viewport.label}/Verify should enter Compare FAIL after expected edit, got "${failStatus}"`);

  const resultsSummary = page.getByTestId('ide-verify-results-summary').first();
  await resultsSummary.waitFor({ state: 'visible', timeout: 10000 });
  const resultsText = await text(resultsSummary);
  for (const guidance of ['Expected value is incorrect', 'Circuit logic is incorrect', 'Output is disconnected']) {
    assert(resultsText.includes(guidance), `${viewport.label}/Verify FAIL summary missing guidance "${guidance}"`);
  }
  const advancedFailure = page.getByTestId('ide-verify-advanced-failure').first();
  await advancedFailure.waitFor({ state: 'visible', timeout: 10000 });
  assert((await advancedFailure.getAttribute('open')) === null, `${viewport.label}/Verify advanced repair must begin collapsed`);
  await advancedFailure.locator('summary').click();

  const repairPanel = page.getByTestId('ide-verify-repair-panel').first();
  await repairPanel.waitFor({ state: 'visible', timeout: 10000 });
  const repairText = await text(repairPanel);
  assert(/Fix expected value|inspect design|Expected\/testbench repair|Design repair/i.test(repairText), `${viewport.label}/Verify repair panel must offer correction paths, got "${repairText}"`);
  assert(await hitTargetSize(page, `[data-testid="ide-stimulus-expected-${fieldId}-t${tick}"]`, 28), `${viewport.label}/Expected-output cell must remain a visible edit target`);
}

async function assertHardwareMappedProfessional(page, viewport) {
  const mappingModel = page.getByTestId('ide-hardware-signal-resource-pin-model').first();
  await mappingModel.waitFor({ state: 'visible', timeout: 10000 });
  const mappingText = await text(mappingModel);
  assert(/logical signal/i.test(mappingText), `${viewport.label}/Hardware must name logical signal`);
  assert(/Basys3 control/i.test(mappingText), `${viewport.label}/Hardware must name board resource`);
  assert(/package pin|constraints/i.test(mappingText), `${viewport.label}/Hardware must connect package pin to constraints`);
  assert(/does not prove board behavior/i.test(mappingText), `${viewport.label}/Hardware must not overclaim board observation`);

  const mapTableVisible = await page.getByTestId('ide-hw-map-table').first().isVisible().catch(() => false);
  const boardVisible = await page.getByTestId('ide-hw-board-workspace').first().isVisible().catch(() => false);
  assert(mapTableVisible && boardVisible, `${viewport.label}/Hardware mapped state must show table and board`);
}

async function assertExportPackageProfessional(page, viewport) {
  await page.waitForSelector('[data-testid="ide-export-panel"]', { timeout: 15000 });
  const state = await page.getByTestId('ide-export-package-inspector-v1').first().getAttribute('data-export-package-state');
  assert(state !== 'blocked', `${viewport.label}/Export package should no longer be the blank blocked state after starter load`);

  const packageFiles = page.getByTestId('ide-export-package-files').first();
  await packageFiles.waitFor({ state: 'visible', timeout: 10000 });
  assert(
    (await packageFiles.getAttribute('open')) !== null,
    `${viewport.label}/Export generated files must be open by default for direct package inspection`
  );
  const fileBrowser = page.getByTestId('ide-export-file-browser-v1').first();
  await fileBrowser.waitFor({ state: 'visible', timeout: 10000 });

  const readinessDetails = page.locator('.ide-export-package-readiness-details').first();
  await readinessDetails.waitFor({ state: 'visible', timeout: 10000 });
  assert((await readinessDetails.getAttribute('open')) === null, `${viewport.label}/Export readiness/submission evidence must begin collapsed`);
  await readinessDetails.locator(':scope > summary').click();
  const readinessChecklist = page.getByTestId('ide-export-handoff-checklist-v1').first();
  await readinessChecklist.waitFor({ state: 'visible', timeout: 10000 });
  const readinessText = await text(readinessChecklist);
  assert(/Pin mapping/i.test(readinessText), `${viewport.label}/Export readiness evidence must name pin mapping`);
  assert(/required ports|board I\/O|logical signal/i.test(readinessText), `${viewport.label}/Export readiness evidence must name signal/port context`);
  assert(/Basys3|board resource/i.test(readinessText), `${viewport.label}/Export readiness evidence must name the board/resource context`);
  assert(/\bpins?\b|package pin/i.test(readinessText), `${viewport.label}/Export readiness evidence must name pin context`);
  assert(/E0 boundary/i.test(readinessText) && /External Vivado\/Basys3 proof required/i.test(readinessText), `${viewport.label}/Export readiness evidence must preserve the E0 boundary`);

  const bodyText = await page.locator('body').textContent();
  assert(/E0|browser/i.test(bodyText ?? ''), `${viewport.label}/Export must keep browser-E0 proof boundary visible`);
  assert(!/\bE1\s+ready|\bE2\s+ready|\bE3\s+ready|board observed/i.test(bodyText ?? ''), `${viewport.label}/Export must not overclaim E1/E2/E3 or board observation`);
}

async function assertImportProfessional(page, viewport) {
  const utilityCopy = page.getByTestId('ide-import-utility-copy').first();
  await utilityCopy.waitFor({ state: 'visible', timeout: 10000 });
  const utilityText = await text(utilityCopy);
  assert(/Import is for recovery and restore/i.test(utilityText), `${viewport.label}/Import must present itself as a utility, got "${utilityText}"`);
  assert(/never replaces current work until review and confirmation/i.test(utilityText), `${viewport.label}/Import must preserve current-work trust boundary`);

  const cancelCopy = page.getByTestId('ide-import-cancel-preserves-copy').first();
  await cancelCopy.waitFor({ state: 'visible', timeout: 10000 });
  const cancelText = await text(cancelCopy);
  assert(/current project stays intact/i.test(cancelText), `${viewport.label}/Import must say current project stays intact`);
  assert(/Cancel keeps current work/i.test(cancelText), `${viewport.label}/Import must name cancel preservation`);
}

async function pickExpectedOutputCell(page) {
  const cell = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]'));
    for (const element of candidates) {
      const valueText = (element.querySelector('.ide-stimulus-cell__value')?.textContent ?? element.textContent ?? '').trim();
      if (valueText === '0' || valueText === '1') {
        const match = element.getAttribute('data-testid')?.match(/^ide-stimulus-expected-(.+)-t(\d+)$/);
        if (match) return { fieldId: match[1], tick: Number(match[2]), original: Number(valueText) };
      }
    }
    return null;
  });
  assert(cell && (cell.original === 0 || cell.original === 1), 'Could not find a concrete expected-output cell to edit');
  return cell;
}

async function flipExpectedCell(page, fieldId, tick) {
  const selector = `[data-testid="ide-stimulus-expected-${fieldId}-t${tick}"]`;
  const before = await page.locator(selector).first().textContent();
  await page.locator(selector).first().click();
  await page.waitForFunction(
    ({ selector: cellSelector, beforeText }) => {
      const element = document.querySelector(cellSelector);
      const current = (element?.querySelector('.ide-stimulus-cell__value')?.textContent ?? element?.textContent ?? '').trim();
      return current.length > 0 && current !== (beforeText ?? '').trim();
    },
    { selector, beforeText: before },
    { timeout: 5000 },
  );
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

async function prominentActions(page, mode) {
  return page.evaluate((activeMode) => {
    const root = document.querySelector(`[data-ide-mode-marker="${activeMode}"]`) ?? document.body;
    return Array.from(root.querySelectorAll('button.ide-button-primary, button[data-product-priority="primary"], [role="button"].ide-button-primary, [data-product-priority="primary"][role="button"]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden' && !element.matches('[disabled], [aria-disabled="true"]');
      })
      .map((element) => ({
        testId: element.getAttribute('data-testid') ?? '',
        text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      }));
  }, mode);
}

async function hitTargetSize(page, selector, minSize) {
  return page.evaluate(
    ({ targetSelector, minimum }) => {
      const element = document.querySelector(targetSelector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width >= minimum && rect.height >= minimum && style.display !== 'none' && style.visibility !== 'hidden';
    },
    { targetSelector: selector, minimum: minSize },
  );
}

async function firstViewportText(page) {
  return page.evaluate(() =>
    Array.from(document.body.querySelectorAll('*'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 1 && rect.height > 1 && rect.top >= 0 && rect.top < window.innerHeight && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => element.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
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
