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

const ARTIFACT_ROOT = path.join(process.cwd(), '.redbyte', 'product-immersion', 'professional-ui-burndown-v2-flow');
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');

await mkdir(SCREENSHOT_DIR, { recursive: true });

await runIdeGate('IDE professional UI burn-down v2 flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-professional-ui-burndown-v2-flow',
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

  await writeFile(path.join(ARTIFACT_ROOT, 'professional-ui-burndown-v2-flow.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Professional UI burn-down v2 failures:\n${failures.join('\n')}`);
});

async function runViewport(page, baseUrl, viewport, record) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=professional-ui-burndown-v2-${viewport.label}-project`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project`);

  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
  await assertDesignExplainer(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Design explainer`);
  await capture(page, viewport, '01-design-explainer');
  record.phases.push({ phase: 'design-explainer' });

  await openMode(page, baseUrl, 'verify', `professional-ui-burndown-v2-${viewport.label}-verify`);
  await runComparePass(page);
  await assertVerifyPassCurrent(page, viewport);
  await capture(page, viewport, '02-verify-pass');
  record.phases.push({ phase: 'verify-pass' });

  const { fieldId, tick } = await pickExpectedOutputCell(page);
  await flipExpectedCell(page, fieldId, tick);
  await assertVerifyStaleIsNotPass(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Verify stale`);
  await capture(page, viewport, '03-verify-stale');
  record.phases.push({ phase: 'verify-stale' });

  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}/Verify Compare mode must be selectable after stale edit`);
  const staleCompare = page.getByTestId('ide-verify-stale-keep-reference').first();
  if (await staleCompare.isVisible().catch(() => false)) {
    await staleCompare.click();
  } else {
    await clickVerifyRun(page);
  }
  await waitForVerifyResult(page, { timeout: 20000 });
  await assertVerifyFailRepairHierarchy(page, viewport, fieldId, tick);
  await assertNoRootOverflow(page, `${viewport.label}/Verify fail repair`);
  await capture(page, viewport, '04-verify-fail-repair');
  record.phases.push({ phase: 'verify-fail-repair' });

  await openMode(page, baseUrl, 'hardware', `professional-ui-burndown-v2-${viewport.label}-hardware`);
  await assertHardwareFailedCompareAction(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Hardware failed compare action`);
  await capture(page, viewport, '05-hardware-failed-compare');
  record.phases.push({ phase: 'hardware-failed-compare' });

  await openMode(page, baseUrl, 'export', `professional-ui-burndown-v2-${viewport.label}-export`);
  await assertExportDraftLooksDraft(page, viewport);
  await assertNoRootOverflow(page, `${viewport.label}/Export draft`);
  await capture(page, viewport, '06-export-draft');
  record.phases.push({ phase: 'export-draft' });
}

async function assertDesignExplainer(page, viewport) {
  const explainer = page.getByTestId('ide-design-logical-io-explainer').first();
  await explainer.waitFor({ state: 'visible', timeout: 10000 });
  const explainerText = await text(explainer);
  assert(/Add logical I\/O/i.test(explainerText), `${viewport.label}/Design must explain logical I/O, got "${explainerText}"`);
  assert(/Basys3 resources and package pins/i.test(explainerText), `${viewport.label}/Design must connect labels to Basys3 mapping, got "${explainerText}"`);
  const metrics = await explainer.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      scrollWidth: Math.round(element.scrollWidth),
      whiteSpace: style.whiteSpace,
      overflow: style.overflow,
    };
  });
  assert(metrics.whiteSpace !== 'nowrap', `${viewport.label}/Design explainer must wrap instead of clipping: ${JSON.stringify(metrics)}`);
  assert(metrics.scrollWidth <= metrics.width + 2, `${viewport.label}/Design explainer is horizontally clipped: ${JSON.stringify(metrics)}`);
}

async function assertVerifyPassCurrent(page, viewport) {
  const hero = page.getByTestId('ide-verify-pass-hero').first();
  await hero.waitFor({ state: 'visible', timeout: 10000 });
  const heroText = await text(hero);
  assert(/Checks passed/i.test(heroText), `${viewport.label}/Verify PASS must still be visible for current evidence, got "${heroText}"`);
  assert((await hero.getAttribute('data-stale')) !== 'true', `${viewport.label}/Current PASS hero must not be marked stale`);
}

async function assertVerifyStaleIsNotPass(page, viewport) {
  await page.waitForSelector('[data-testid="ide-verify-primary-status"]', { timeout: 10000 });
  const statusText = await text(page.getByTestId('ide-verify-primary-status').first());
  assert(/Checks changed/i.test(statusText), `${viewport.label}/Stale Verify must say checks changed, got "${statusText}"`);
  const hero = page.getByTestId('ide-verify-pass-hero').first();
  await hero.waitFor({ state: 'visible', timeout: 10000 });
  const heroText = await text(hero);
  assert((await hero.getAttribute('data-stale')) === 'true', `${viewport.label}/Stale run proof must be marked stale`);
  assert(/Checks changed - rerun Compare/i.test(heroText), `${viewport.label}/Stale run proof must not keep PASS as the dominant title, got "${heroText}"`);
  assert(!/Checks passed/i.test(heroText), `${viewport.label}/Stale run proof must not say Checks passed, got "${heroText}"`);
  const summaryHeadline = page.getByTestId('ide-verify-results-summary-headline').first();
  await summaryHeadline.waitFor({ state: 'visible', timeout: 10000 });
  const summaryText = await text(summaryHeadline);
  assert(/Checks changed/i.test(summaryText), `${viewport.label}/Stale results summary must say checks changed, got "${summaryText}"`);
  assert(!/^PASS\b|All checks aligned/i.test(summaryText), `${viewport.label}/Stale results summary must not keep the old PASS headline, got "${summaryText}"`);
  const waveformState = await page.getByTestId('ide-verify-workspace-waveform').first().getAttribute('data-state');
  assert(waveformState === 'stale', `${viewport.label}/Stale waveform state must be stale, got ${waveformState}`);
}

async function assertVerifyFailRepairHierarchy(page, viewport, fieldId, tick) {
  const failStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]').first());
  assert(isVerifyFail(failStatus), `${viewport.label}/Verify should enter Compare FAIL after expected edit, got "${failStatus}"`);
  const repair = page.getByTestId('ide-verify-repair-panel').first();
  await repair.waitFor({ state: 'visible', timeout: 10000 });
  const repairText = await text(repair);
  assert(/Compare failed/i.test(repairText), `${viewport.label}/Repair panel must name Compare failed`);
  assert(/Expected/i.test(repairText) && /Observed/i.test(repairText), `${viewport.label}/Repair panel must keep expected and observed readable`);
  assert(/Use observed only when the circuit behavior is correct/i.test(repairText), `${viewport.label}/Repair panel must preserve observed-value warning`);
  const rowClass = await page.getByTestId('ide-verify-repair-use-observed-row').first().getAttribute('class').catch(() => '');
  const allClass = await page.getByTestId('ide-verify-repair-use-observed-all').first().getAttribute('class').catch(() => '');
  assert(!/\bide-button-primary\b/.test(rowClass ?? ''), `${viewport.label}/Use observed row must not be a primary action`);
  assert(!/\bide-button-primary\b/.test(allClass ?? ''), `${viewport.label}/Use all observed must not be a primary action`);
  const editedCell = page.getByTestId(`ide-stimulus-expected-${fieldId}-t${tick}`).first();
  await editedCell.waitFor({ state: 'visible', timeout: 10000 });
}

async function assertHardwareFailedCompareAction(page, viewport) {
  const spinePrimary = page.getByTestId('ide-product-spine-primary-hardware').first();
  await spinePrimary.waitFor({ state: 'visible', timeout: 10000 });
  const primaryText = await text(spinePrimary);
  assert(/Verify/i.test(primaryText), `${viewport.label}/Hardware primary should return to Verify after failed Compare, got "${primaryText}"`);
  assert(!/Open Board Check/i.test(primaryText), `${viewport.label}/Hardware must not promote Board Check after failed Compare`);
  const commandPrimary = page.getByTestId('ide-hardware-next-primary').first();
  if (await commandPrimary.isVisible().catch(() => false)) {
    const commandText = await text(commandPrimary);
    assert(/Verify/i.test(commandText), `${viewport.label}/Hardware command strip should return to Verify, got "${commandText}"`);
    assert(!/Open Board Check/i.test(commandText), `${viewport.label}/Hardware command strip must not promote Board Check after failed Compare`);
  }
  const model = page.getByTestId('ide-hardware-signal-resource-pin-model').first();
  await model.waitFor({ state: 'visible', timeout: 10000 });
  assert(/does not prove board behavior/i.test(await text(model)), `${viewport.label}/Hardware must keep board-observation boundary visible`);
}

async function assertExportDraftLooksDraft(page, viewport) {
  const inspector = page.getByTestId('ide-export-package-inspector-v1').first();
  await inspector.waitFor({ state: 'visible', timeout: 10000 });
  const state = await inspector.getAttribute('data-export-package-state');
  assert(state === 'draft', `${viewport.label}/Export after failed Verify should be draft, got ${state}`);
  const inspectorText = await text(inspector);
  assert(/Draft handoff files/i.test(inspectorText), `${viewport.label}/Export draft must lead with draft files`);
  const artifactStatuses = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid^="ide-export-artifact-status-"], [data-testid^="ide-export-file-status-"]'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim()),
  );
  assert(artifactStatuses.length > 0, `${viewport.label}/Export draft should expose artifact statuses`);
  const readyStatuses = artifactStatuses.filter((value) => /^Ready$/i.test(value));
  assert(readyStatuses.length === 0, `${viewport.label}/Draft Export must not show green Ready artifact chips: ${readyStatuses.join(', ')}`);
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

async function capture(page, viewport, name) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${viewport.label}-${name}.png`),
    fullPage: false,
  });
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
