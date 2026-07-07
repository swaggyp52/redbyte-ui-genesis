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

const ARTIFACT_ROOT = path.join(process.cwd(), '.redbyte', 'product-immersion', 'professional-ui-burndown-flow');
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE professional UI burn-down flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-professional-ui-burndown-flow',
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

  await writeFile(path.join(ARTIFACT_ROOT, 'professional-ui-burndown-flow.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Professional UI burn-down failures:\n${failures.join('\n')}`);
});

async function runViewport(page, baseUrl, viewport, record) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=professional-ui-burndown-${viewport.label}-project`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project`);
  await assertProjectFirstLaunch(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Project first launch`);
  await capture(page, viewport, '01-project-first-launch');
  record.phases.push({ phase: 'project-first-launch' });

  await openMode(page, baseUrl, 'hardware', `professional-ui-burndown-${viewport.label}-empty-hardware`);
  await assertHardwareNoSignal(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Hardware no signal`);
  await capture(page, viewport, '02-hardware-no-signal');
  record.phases.push({ phase: 'hardware-no-signal' });

  await openMode(page, baseUrl, 'export', `professional-ui-burndown-${viewport.label}-blocked-export`);
  await assertExportBlocked(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Export blocked`);
  await capture(page, viewport, '03-export-blocked');
  record.phases.push({ phase: 'export-blocked' });

  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertDesignLoaded(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Design loaded`);
  await capture(page, viewport, '04-design-loaded');
  record.phases.push({ phase: 'design-loaded' });

  await openMode(page, baseUrl, 'project', `professional-ui-burndown-${viewport.label}-loaded-project`);
  await assertProjectLoaded(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Project loaded`);
  await capture(page, viewport, '05-project-loaded');
  record.phases.push({ phase: 'project-loaded' });

  await openMode(page, baseUrl, 'verify', `professional-ui-burndown-${viewport.label}-verify`);
  await assertVerifyPreRun(page, viewport);
  await runComparePass(page);
  const { fieldId, tick } = await pickExpectedOutputCell(page);
  await flipExpectedCell(page, fieldId, tick);
  await assertVerifyStale(page, viewport);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}/Verify Compare mode must remain selectable`);
  const staleCompare = page.getByTestId('ide-verify-stale-keep-reference').first();
  if (await staleCompare.isVisible().catch(() => false)) {
    await staleCompare.click();
  } else {
    await clickVerifyRun(page);
  }
  await waitForVerifyResult(page, { timeout: 20000 });
  await assertVerifyFailRepair(page, viewport, fieldId, tick);
  await assertNoRootOverflow(page, `${viewport.label}/Verify repair`);
  await capture(page, viewport, '06-verify-repair');
  record.phases.push({ phase: 'verify-repair' });

  await openMode(page, baseUrl, 'hardware', `professional-ui-burndown-${viewport.label}-mapped-hardware`);
  await assertHardwareMapped(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Hardware mapped`);
  await capture(page, viewport, '07-hardware-mapped');
  record.phases.push({ phase: 'hardware-mapped' });

  await openMode(page, baseUrl, 'export', `professional-ui-burndown-${viewport.label}-draft-export`);
  await assertExportDraft(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Export draft`);
  await capture(page, viewport, '08-export-draft');
  record.phases.push({ phase: 'export-draft' });

  await openMode(page, baseUrl, 'import', `professional-ui-burndown-${viewport.label}-import`);
  await assertImportUtility(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Import`);
  await capture(page, viewport, '09-import');
  record.phases.push({ phase: 'import' });
}

async function assertProjectFirstLaunch(page, viewport) {
  const primaryCount = await visiblePrimaryCount(page, 'project');
  assert(primaryCount <= 1, `${viewport.label}/Project first launch has duplicate primary actions: ${primaryCount}`);
  const startPrimary = page.getByTestId('ide-project-start-a-lab-primary').first();
  await startPrimary.waitFor({ state: 'visible', timeout: 10000 });
  assert(/Start a Lab/i.test(await text(startPrimary)), `${viewport.label}/Project first primary must be Start a Lab`);
}

async function assertHardwareNoSignal(page, viewport) {
  const panel = page.getByTestId('ide-hardware-panel').first();
  await panel.waitFor({ state: 'visible', timeout: 10000 });
  const panelText = await text(panel);
  assert(/Add logical inputs and outputs in Design first/i.test(panelText), `${viewport.label}/Hardware empty must route to Design`);
  const boardCanvasVisible = await page.locator('.ide-hw-board-canvas').first().isVisible().catch(() => false);
  const tableVisible = await page.getByTestId('ide-hw-map-table').first().isVisible().catch(() => false);
  const plannerVisible = await page.locator('.ide-hw-board-planner-summary').first().isVisible().catch(() => false);
  assert(!boardCanvasVisible && !tableVisible && !plannerVisible, `${viewport.label}/Hardware no-signal must not make board internals dominant`);
}

async function assertExportBlocked(page, viewport) {
  const blocked = page.getByTestId('ide-export-blocked-empty-state').first();
  await blocked.waitFor({ state: 'visible', timeout: 10000 });
  const fileBrowserVisible = await page.getByTestId('ide-export-file-browser-v1').first().isVisible().catch(() => false);
  const downloadVisible = await page.getByTestId('ide-export-package-download-v1').first().isVisible().catch(() => false);
  assert(!fileBrowserVisible, `${viewport.label}/Export blocked must not show a file browser`);
  assert(!downloadVisible, `${viewport.label}/Export blocked must not show Download package`);
}

async function assertDesignLoaded(page, viewport) {
  const designPrimaryCount = await visiblePrimaryCount(page, 'design');
  assert(designPrimaryCount <= 1, `${viewport.label}/Design has duplicate primary actions: ${designPrimaryCount}`);
  const command = page.getByTestId('ide-design-command-strip-primary-cta').first();
  await command.waitFor({ state: 'visible', timeout: 10000 });
  assert(await hasClass(page, '[data-testid="ide-design-command-strip-primary-cta"]', 'ide-button-secondary'), `${viewport.label}/Design body Open Verify must be secondary`);
  const starterRoutes = await page.getByTestId('ide-design-starter-go-to-verify').count();
  if (starterRoutes > 0) {
    assert(await hasClass(page, '[data-testid="ide-design-starter-go-to-verify"]', 'ide-button-ghost'), `${viewport.label}/Design starter Verify route must be ghost weight`);
  }
}

async function assertProjectLoaded(page, viewport) {
  const spinePrimary = page.getByTestId('ide-product-spine-primary-project').first();
  await spinePrimary.waitFor({ state: 'visible', timeout: 10000 });
  const spineTag = await spinePrimary.evaluate((element) => element.tagName.toLowerCase());
  assert(spineTag !== 'button', `${viewport.label}/Project loaded spine must be read-only context`);
  const commandPrimary = page.getByTestId('ide-project-command-strip-primary-cta').first();
  await commandPrimary.waitFor({ state: 'visible', timeout: 10000 });
  assert(/Continue to/i.test(await text(commandPrimary)), `${viewport.label}/Project command strip remains the Continue authority`);
  const continueTile = page.getByTestId('ide-project-path-continue').first();
  const continueClass = await continueTile.getAttribute('class', { timeoutMs: 5000 });
  assert(!/\bis-primary\b/.test(continueClass ?? ''), `${viewport.label}/Project secondary Continue tile must not be primary`);
}

async function assertVerifyPreRun(page, viewport) {
  await page.waitForSelector('[data-testid="ide-verify-panel"]', { timeout: 15000 });
  const steps = page.getByTestId('ide-testbench-custom-flow-steps').first();
  await steps.waitFor({ state: 'visible', timeout: 10000 });
  const expectedCells = await readExpectedOutputCells(page);
  assert(expectedCells.some((cell) => cell.visibleText === '0' || cell.visibleText === '1'), `${viewport.label}/Verify expected cells must be visible before run`);
  const gridRect = await rect(page, '[data-testid="ide-verify-add-vector-form"]');
  assert(gridRect && gridRect.top < viewport.height * 0.58, `${viewport.label}/Verify testbench grid starts too low: ${JSON.stringify(gridRect)}`);
}

async function assertVerifyStale(page, viewport) {
  await page.waitForFunction(
    () => {
      const status = document.querySelector('[data-testid="ide-verify-primary-status"]');
      return Boolean(status && /Checks changed|Rerun Compare|PASS\/FAIL/i.test(status.textContent ?? ''));
    },
    { timeout: 10000 },
  );
  const staleText = await text(page.locator('[data-testid="ide-verify-primary-status"]').first());
  assert(/Checks changed/i.test(staleText), `${viewport.label}/Verify stale copy must use calm checks-changed wording, got "${staleText}"`);
  const staleAction = page.getByTestId('ide-verify-stale-keep-reference').first();
  const rerunAction = page.getByTestId('ide-verify-primary-status-rerun').first();
  const action = (await staleAction.isVisible().catch(() => false)) ? staleAction : rerunAction;
  await action.waitFor({ state: 'visible', timeout: 10000 });
  const calloutRect = await rect(page, '[data-testid="ide-verify-primary-status-callout"]');
  assert(calloutRect && calloutRect.height <= 150, `${viewport.label}/Verify stale callout is too tall: ${JSON.stringify(calloutRect)}`);
  assert(/Rerun (saved checks|Compare)/i.test(await text(action)), `${viewport.label}/Verify stale primary action should be concise`);
}

async function assertVerifyFailRepair(page, viewport, fieldId, tick) {
  const failStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]').first());
  assert(isVerifyFail(failStatus), `${viewport.label}/Verify should enter Compare FAIL after expected edit, got "${failStatus}"`);
  const repair = page.getByTestId('ide-verify-repair-panel').first();
  await repair.waitFor({ state: 'visible', timeout: 10000 });
  const observedMetrics = await targetMetrics(page, '[data-testid="ide-verify-repair-use-observed"]');
  assert(await hitTargetSize(page, '[data-testid="ide-verify-repair-use-observed"]', 34), `${viewport.label}/Use observed cell must be a readable hit target: ${JSON.stringify(observedMetrics)}`);
  const editedMetrics = await targetMetrics(page, `[data-testid="ide-stimulus-expected-${fieldId}-t${tick}"]`);
  assert(await hitTargetSize(page, `[data-testid="ide-stimulus-expected-${fieldId}-t${tick}"]`, 28), `${viewport.label}/Edited expected-output cell must remain visible: ${JSON.stringify(editedMetrics)}`);
}

async function assertHardwareMapped(page, viewport) {
  const model = page.getByTestId('ide-hardware-signal-resource-pin-model').first();
  await model.waitFor({ state: 'visible', timeout: 10000 });
  const modelText = await text(model);
  assert(/logical signal/i.test(modelText), `${viewport.label}/Hardware must name logical signal`);
  assert(/Basys3 control/i.test(modelText), `${viewport.label}/Hardware must name Basys3 control`);
  assert(/does not prove board behavior/i.test(modelText), `${viewport.label}/Hardware must not overclaim board observation`);
}

async function assertExportDraft(page, viewport) {
  const inspector = page.getByTestId('ide-export-package-inspector-v1').first();
  await inspector.waitFor({ state: 'visible', timeout: 10000 });
  const state = await inspector.getAttribute('data-export-package-state', { timeoutMs: 5000 });
  assert(state === 'draft', `${viewport.label}/Export after failed Verify should be draft, got ${state}`);
  assert((await text(inspector)).includes('Draft handoff files'), `${viewport.label}/Export draft should label files as draft`);
  assert(await hasClass(page, '[data-testid="ide-export-package-download-v1"]', 'ide-button-secondary'), `${viewport.label}/Draft Export download must not be primary`);
  const primaryCount = await visiblePrimaryCount(page, 'export');
  assert(primaryCount <= 1, `${viewport.label}/Export draft has duplicate primary actions: ${primaryCount}`);
}

async function assertImportUtility(page, viewport) {
  const copy = page.getByTestId('ide-import-utility-copy').first();
  await copy.waitFor({ state: 'visible', timeout: 10000 });
  assert(/Import is for recovery and restore/i.test(await text(copy)), `${viewport.label}/Import must remain a recovery utility`);
  const cancel = page.getByTestId('ide-import-cancel-preserves-copy').first();
  await cancel.waitFor({ state: 'visible', timeout: 10000 });
  assert(/Cancel keeps current work/i.test(await text(cancel)), `${viewport.label}/Import must preserve cancel boundary`);
}

async function visiblePrimaryCount(page, mode) {
  return page.evaluate((activeMode) => {
    const root = document.querySelector(`[data-ide-mode-marker="${activeMode}"]`) ?? document.body;
    return Array.from(root.querySelectorAll('button.ide-button-primary, button[data-product-priority="primary"], [role="button"].ide-button-primary, [data-product-priority="primary"][role="button"]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden' && !element.matches('[disabled], [aria-disabled="true"]');
      }).length;
  }, mode);
}

async function hasClass(page, selector, className) {
  return page.evaluate(
    ({ targetSelector, targetClass }) => document.querySelector(targetSelector)?.classList.contains(targetClass) ?? false,
    { targetSelector: selector, targetClass: className },
  );
}

async function rect(page, selector) {
  return page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    return {
      top: Math.round(box.top),
      left: Math.round(box.left),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }, selector);
}

async function hitTargetSize(page, selector, minSize) {
  return page.evaluate(
    ({ targetSelector, minimum }) => {
      return Array.from(document.querySelectorAll(targetSelector)).some((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width >= minimum &&
          rect.height >= minimum &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.pointerEvents !== 'none'
        );
      });
    },
    { targetSelector: selector, minimum: minSize },
  );
}

async function targetMetrics(page, selector) {
  return page.evaluate((targetSelector) =>
    Array.from(document.querySelectorAll(targetSelector)).map((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        display: style.display,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
        disabled: element.matches('[disabled], [aria-disabled="true"]'),
      };
    }),
  selector);
}

async function pickExpectedOutputCell(page) {
  const cell = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]'));
    for (const element of candidates) {
      const valueText = (element.querySelector('.ide-stimulus-cell__value')?.textContent ?? element.textContent ?? '').trim();
      const title = element.getAttribute('title') ?? '';
      const titleValue = /:\s*1\s*-\s*drag/i.test(title) ? 1 : /:\s*0\s*-\s*drag/i.test(title) ? 0 : null;
      if (valueText === '0' || valueText === '1' || titleValue === 0 || titleValue === 1) {
        const match = element.getAttribute('data-testid')?.match(/^ide-stimulus-expected-(.+)-t(\d+)$/);
        if (match) return { fieldId: match[1], tick: Number(match[2]), original: titleValue ?? Number(valueText) };
      }
    }
    return null;
  });
  assert(cell && (cell.original === 0 || cell.original === 1), 'Could not find a concrete expected-output cell to edit');
  return cell;
}

async function flipExpectedCell(page, fieldId, tick) {
  const testId = `ide-stimulus-expected-${fieldId}-t${tick}`;
  const before = await readCellValue(page, testId);
  assert(before === 0 || before === 1, `expected ${testId} to have a saved value before flip, got ${before}`);
  const cell = page.getByTestId(testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readCellValue(page, testId);
    if (current !== before && (current === 0 || current === 1)) return;
    await cell.click();
    await page.waitForTimeout(100);
  }
  const after = await readCellValue(page, testId);
  assert(after !== before && (after === 0 || after === 1), `expected ${testId} to flip from ${before}, got ${after}`);
}

async function readCellValue(page, testId) {
  const title = await page.getByTestId(testId).first().getAttribute('title').catch(() => '');
  if (/:\s*1\s*-\s*drag/i.test(title ?? '')) return 1;
  if (/:\s*0\s*-\s*drag/i.test(title ?? '')) return 0;
  return null;
}

async function readExpectedOutputCells(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]'))
      .slice(0, 12)
      .map((cell) => ({
        testId: cell.getAttribute('data-testid') ?? '',
        visibleText: (cell.querySelector('.ide-stimulus-cell__value')?.textContent ?? cell.textContent ?? '').trim(),
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
