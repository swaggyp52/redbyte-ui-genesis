#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  runIdeGate,
  saveObservedOutputs,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  assertVisibleRect,
  captureBrowserProblems,
  CLASSROOM_VIEWPORTS,
  installCleanStudentContext,
  openLogicGatesStarter,
  openMode,
  runComparePass,
} from './_workbenchReconstructionHarness.mjs';

const ARTIFACT_ROOT = path.join(process.cwd(), '.redbyte', 'product-immersion', 'live-eyes-product-steward');
const SCREENSHOT_DIR = path.join(ARTIFACT_ROOT, 'screenshots');
const INVALID_IMPORT_PATH = path.join(ARTIFACT_ROOT, 'not-a-redbyte-zip.txt');

await mkdir(SCREENSHOT_DIR, { recursive: true });
await writeFile(INVALID_IMPORT_PATH, 'This is not a ZIP archive.\n');

await runIdeGate('IDE live-eyes visual polish flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  await installCleanStudentContext(page);

  const record = {
    gate: 'ide-live-eyes-visual-polish-flow',
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

  await writeFile(path.join(ARTIFACT_ROOT, 'live-eyes-visual-polish-flow.json'), JSON.stringify(record, null, 2));
  assert(browserProblems.length === 0, `Browser console/page errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Live-eyes visual polish failures:\n${failures.join('\n')}`);
});

async function runViewport(page, baseUrl, viewport, record) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=live-eyes-visual-polish-${viewport.label}-fresh`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/Project`);
  await assertProjectFirstLook(page, viewport);
  await capture(page, viewport, '01-project-first-look');
  record.phases.push({ phase: 'project-first-look' });

  await page.getByTestId('ide-onboarding-skip').first().click().catch(() => null);
  await page.locator('[data-testid="ide-onboarding-overlay"]').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null);

  await openLogicGatesStarter(page, baseUrl, `live-eyes-visual-polish-${viewport.label}-starter`);
  await assertDesignLoaded(page, viewport);
  await capture(page, viewport, '02-design-starter');
  record.phases.push({ phase: 'design-starter' });

  await openMode(page, baseUrl, 'verify', `live-eyes-visual-polish-${viewport.label}`);
  await assertVerifyPassThenFail(page, viewport);
  await capture(page, viewport, '03-verify-fail-repair');
  record.phases.push({ phase: 'verify-pass-fail-repair' });

  await openMode(page, baseUrl, 'hardware', `live-eyes-visual-polish-${viewport.label}`);
  await assertHardwareMapPins(page, viewport);
  await capture(page, viewport, '04-hardware-map-pins');
  record.phases.push({ phase: 'hardware-map-pins' });

  await openMode(page, baseUrl, 'export', `live-eyes-visual-polish-${viewport.label}`);
  await assertExportWorksurface(page, viewport);
  await capture(page, viewport, '05-export-draft');
  record.phases.push({ phase: 'export-draft' });

  await openMode(page, baseUrl, 'import', `live-eyes-visual-polish-${viewport.label}`);
  await assertImportFirstLookAndError(page, viewport);
  await capture(page, viewport, '06-import-invalid-error');
  record.phases.push({ phase: 'import-first-look-invalid-error' });

  await assertNoRootOverflow(page, `${viewport.label}/live-eyes visual polish`);
}

async function assertProjectFirstLook(page, viewport) {
  await assertVisibleRect(page, ['[data-testid="ide-product-spine-project"]'], `${viewport.label}/Project spine`, {
    maxTop: 160,
    minWidth: Math.round(viewport.width * 0.70),
    minHeight: 70,
  });
  await assertVisibleRect(page, ['[data-testid="ide-project-command-center"]'], `${viewport.label}/Project command center`, {
    maxTop: viewport.height === 768 ? 430 : 470,
    minWidth: Math.round(viewport.width * 0.70),
    minHeight: viewport.height === 768 ? 230 : 300,
  });

  const orientation = page.locator('[data-testid="ide-onboarding-overlay"]').first();
  if (await visible(orientation)) {
    assert(
      (await orientation.getAttribute('data-onboarding-placement')) === 'integrated',
      `${viewport.label}: workflow orientation must be integrated, not a blocking overlay`
    );
    await assertNoOverlapSelectors(
      page,
      '[data-testid="ide-onboarding-overlay"]',
      ['[data-testid="ide-project-primary-actions"]', '[data-testid="ide-project-start-summary"]'],
      `${viewport.label}/Project orientation`
    );
  } else {
    assert(
      await visible(page.locator('[data-testid="ide-topbar-workflow-help-btn"]').first()),
      `${viewport.label}: dismissed workflow orientation must leave the Flow/help affordance available`
    );
  }

  for (const selector of [
    '[data-testid="ide-project-start-a-lab-primary"]',
    '[data-testid="ide-project-build-fresh-primary"]',
    '[data-testid="ide-project-open-starter-primary"]',
    '[data-testid="ide-project-import-primary"]',
  ]) {
    await assertHitTarget(page, selector, `${viewport.label}/Project action ${selector}`);
  }
}

async function assertDesignLoaded(page, viewport) {
  await assertTaskSpine(page, viewport, 'design', ['[data-testid="ide-design-workspace-header"]', '[data-testid="ide-design-canvas-wrap"]']);
  await assertVisibleRect(page, ['[data-testid="ide-design-workspace-header"]'], `${viewport.label}/Design workspace header`, {
    maxTop: 230,
    minWidth: Math.round(viewport.width * 0.48),
    minHeight: 30,
  });
  await assertVisibleRect(page, ['[data-testid="ide-design-canvas-wrap"]', '[data-testid="ide-design-live-canvas"]'], `${viewport.label}/Design canvas`, {
    maxTop: viewport.height === 768 ? 350 : 390,
    minWidth: Math.round(viewport.width * 0.42),
    minHeight: viewport.height === 768 ? 260 : 360,
  });
  await assertNoRootOverflow(page, `${viewport.label}/Design`);
}

async function assertVerifyPassThenFail(page, viewport) {
  await runComparePass(page);
  const passStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]').first());
  assert(isVerifyPass(passStatus), `${viewport.label}: Verify should reach Compare PASS before fail-state proof, got "${passStatus}"`);
  await assertTaskSpine(page, viewport, 'verify', ['[data-testid="ide-verify-panel"]', '[data-testid="ide-verify-workspace-waveform"]']);
  await assertVisibleRect(page, ['[data-testid="ide-verify-panel"]'], `${viewport.label}/Verify panel`, {
    maxTop: 260,
    minWidth: Math.round(viewport.width * 0.74),
    minHeight: viewport.height === 768 ? 420 : 560,
  });
  await assertVisibleRect(page, ['[data-testid="ide-verify-workspace-waveform"]'], `${viewport.label}/Verify PASS waveform`, {
    maxTop: viewport.height === 768 ? 470 : 520,
    minWidth: Math.round(viewport.width * 0.30),
    minHeight: 160,
  });

  const { fieldId, tick, original } = await pickExpectedOutputCell(page);
  await flipExpectedCell(page, fieldId, tick);
  assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must remain selectable after expected edit`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const failStatus = await text(page.locator('[data-testid="ide-verify-summary-status"]').first());
  assert(isVerifyFail(failStatus), `${viewport.label}: Verify should enter Compare FAIL after expected edit, got "${failStatus}"`);

  await assertVisibleRect(page, ['[data-testid="ide-verify-repair-panel"]'], `${viewport.label}/Verify repair panel`, {
    maxTop: viewport.height === 768 ? 420 : 470,
    minWidth: Math.round(viewport.width * 0.44),
    minHeight: 84,
  });
  await assertVisibleRect(page, ['[data-testid="ide-verify-waveform-preview"]'], `${viewport.label}/Verify FAIL waveform`, {
    maxTop: viewport.height === 768 ? 560 : 620,
    minWidth: Math.round(viewport.width * 0.28),
    minHeight: viewport.height === 768 ? 190 : 280,
  });
  await assertHitTarget(page, `[data-testid="ide-stimulus-expected-${fieldId}-t${tick}"]`, `${viewport.label}/expected-output cell`);
  for (const selector of [
    '[data-testid="ide-verify-repair-use-observed"]',
    '[data-testid="ide-verify-repair-use-observed-row"]',
    '[data-testid="ide-verify-repair-use-observed-all"]',
    '[data-testid="ide-verify-repair-rerun"]',
  ]) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      await assertHitTarget(page, selector, `${viewport.label}/Verify repair action ${selector}`);
    }
  }
  await assertNoOverlapSelectors(
    page,
    '[data-testid="ide-verify-repair-panel"]',
    ['[data-testid="ide-testbench-editor-workspace"]', '[data-testid="ide-verify-waveform-preview"]'],
    `${viewport.label}/Verify repair panel`
  );
  assert(original === 0 || original === 1, `${viewport.label}: original expected value must be concrete`);
}

async function assertHardwareMapPins(page, viewport) {
  await assertTaskSpine(page, viewport, 'hardware', ['[data-testid="ide-hardware-panel"]', '[data-testid="ide-hw-board-workspace"]']);
  await assertVisibleRect(page, ['[data-testid="ide-hw-map-table"]'], `${viewport.label}/Hardware mapping table`, {
    maxTop: viewport.height === 768 ? 430 : 500,
    minWidth: Math.round(viewport.width * 0.22),
    minHeight: 180,
  });
  await assertVisibleRect(page, ['[data-testid="ide-hw-map-board"]', '[data-testid="ide-hw-board-workspace"]'], `${viewport.label}/Hardware board workspace`, {
    maxTop: viewport.height === 768 ? 430 : 500,
    minWidth: Math.round(viewport.width * 0.34),
    minHeight: 170,
  });
  await assertHitTarget(
    page,
    '[data-testid="ide-product-spine-recovery-hardware"], [data-testid="ide-hardware-next-primary"], [data-testid="ide-hardware-guided-full-adder-continue-export"], [data-testid="ide-hw-map-dock-primary"], .ide-hardware-dep-step[title="Open Export"]',
    `${viewport.label}/Hardware next action`
  );
  await assertNoRootOverflow(page, `${viewport.label}/Hardware`);
}

async function assertExportWorksurface(page, viewport) {
  await assertTaskSpine(page, viewport, 'export', ['[data-testid="ide-export-panel"]', '[data-testid="ide-export-package-inspector-v1"]']);
  await assertVisibleRect(page, ['[data-testid="ide-export-confidence-station"]'], `${viewport.label}/Export confidence station`, {
    maxTop: viewport.height === 768 ? 430 : 470,
    minWidth: Math.round(viewport.width * 0.30),
    minHeight: 38,
  });
  await assertVisibleRect(page, ['[data-testid="ide-export-file-browser-v1"]'], `${viewport.label}/Export file browser`, {
    maxTop: viewport.height === 768 ? 520 : 590,
    minWidth: 220,
    minHeight: 180,
  });
  await assertVisibleRect(page, ['[data-testid="ide-export-selected-preview-v1"]'], `${viewport.label}/Export file preview`, {
    maxTop: viewport.height === 768 ? 520 : 590,
    minWidth: Math.round(viewport.width * 0.42),
    minHeight: 220,
  });
  await assertHitTarget(
    page,
    '[data-testid="ide-export-package-download-v1"], [data-testid="ide-export-package-build-v1"], [data-testid="ide-export-rebuild-btn"], [data-testid="ide-export-primary-handoff-cta"] button',
    `${viewport.label}/Export primary action`
  );
  const confidenceText = await text(page.locator('[data-testid="ide-export-confidence-station"]').first());
  assert(/not run|external|not observed|draft|E0/i.test(confidenceText), `${viewport.label}: Export confidence must preserve proof boundary, got "${confidenceText}"`);
  assert(!/Vivado build passed|Board behavior observed|E1 pass|E2 pass|E3 pass/i.test(confidenceText), `${viewport.label}: Export confidence must not overclaim E1/E2/E3`);
  await assertNoRootOverflow(page, `${viewport.label}/Export`);
}

async function assertImportFirstLookAndError(page, viewport) {
  await assertTaskSpine(page, viewport, 'import', ['[data-testid="ide-import-panel"]', '[data-testid="ide-import-start-hero"]']);
  await assertVisibleRect(page, ['[data-testid="ide-import-start-primary"]'], `${viewport.label}/Import primary upload`, {
    maxTop: viewport.height === 768 ? 430 : 470,
    minWidth: 140,
    minHeight: 32,
  });
  await assertVisibleRect(page, ['[data-testid="ide-import-start-secondary"]'], `${viewport.label}/Import Paste HDL`, {
    maxTop: viewport.height === 768 ? 500 : 540,
    minWidth: 90,
    minHeight: 28,
  });
  await assertHitTarget(page, '[data-testid="ide-import-start-primary"]', `${viewport.label}/Import primary action`);
  await assertHitTarget(page, '[data-testid="ide-import-start-secondary"]', `${viewport.label}/Import secondary action`);

  await page.locator('[data-testid="ide-import-zip-input"]').setInputFiles(INVALID_IMPORT_PATH);
  await page.waitForSelector('[data-testid="ide-import-zip-error"]', { timeout: 10000 });
  await assertVisibleRect(page, ['[data-testid="ide-import-zip-error"]'], `${viewport.label}/Import invalid ZIP error`, {
    maxTop: viewport.height === 768 ? 650 : 640,
    minWidth: Math.round(viewport.width * 0.35),
    minHeight: 36,
  });
  const errorText = await text(page.locator('[data-testid="ide-import-zip-error"]').first());
  assert(/zip|No files were changed|Could not open/i.test(errorText), `${viewport.label}: Import error must be actionable, got "${errorText}"`);
  await assertNoRootOverflow(page, `${viewport.label}/Import`);
}

async function assertTaskSpine(page, viewport, mode, protectedSelectors) {
  await page.waitForSelector(`[data-testid="ide-product-spine-${mode}"]`, { timeout: 15000 });
  const state = await page.evaluate((activeMode) => {
    const card = document.querySelector(`[data-testid="ide-product-spine-${activeMode}"]`);
    const root = card?.closest('.ide-product-spine');
    const details = document.querySelector(`[data-testid="ide-product-spine-details-${activeMode}"]`);
    const rect = card?.getBoundingClientRect();
    const rootStyle = root ? window.getComputedStyle(root) : null;
    return {
      position: rootStyle?.position ?? null,
      detailsOpen: details instanceof HTMLDetailsElement ? details.open : null,
      rect: rect
        ? {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        : null,
      text: card?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  }, mode);

  assert(state.rect, `${viewport.label}/${mode}: product spine missing`);
  assert(state.position !== 'absolute' && state.position !== 'fixed', `${viewport.label}/${mode}: task spine must not be overlay-positioned (${state.position})`);
  assert(state.detailsOpen === false, `${viewport.label}/${mode}: task-page details should be collapsed by default`);
  assert(state.rect.height <= 74, `${viewport.label}/${mode}: compact task spine too tall ${JSON.stringify(state.rect)}`);
  assert(/Details/i.test(state.text), `${viewport.label}/${mode}: compact task spine should expose Details affordance`);
  await assertNoOverlapSelectors(page, `[data-testid="ide-product-spine-${mode}"]`, protectedSelectors, `${viewport.label}/${mode} task spine`);
}

async function pickExpectedOutputCell(page) {
  let chosen = await readFirstExpectedCell(page);
  if (chosen?.original === 0 || chosen?.original === 1) return chosen;

  await setVerifyRunMode(page, 'observe');
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 20000 });
  const savedSelector = await saveObservedOutputs(page);
  assert(savedSelector, 'Verify must allow saving observed outputs before visual fail-state proof');
  await page.waitForFunction(
    () => (window.__RB_PROJECT_RUNTIME__?.getState?.()?.projectVectors ?? []).some((vector) => Object.keys(vector.expected ?? {}).length > 0),
    { timeout: 8000 }
  );
  chosen = await readFirstExpectedCell(page);
  assert(chosen?.original === 0 || chosen?.original === 1, `Could not find a saved expected-output cell after Observe: ${JSON.stringify(chosen)}`);
  return chosen;
}

async function readFirstExpectedCell(page) {
  const target = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]'));
    for (const cell of cells) {
      const testId = cell.getAttribute('data-testid') ?? '';
      const title = cell.getAttribute('title') ?? '';
      const match = /^ide-stimulus-expected-(.+)-t(\d+)$/.exec(testId);
      const value = /:\s*1\s*-\s*drag/i.test(title) ? 1 : /:\s*0\s*-\s*drag/i.test(title) ? 0 : null;
      if (match && (value === 0 || value === 1)) {
        return { fieldId: match[1], tick: Number(match[2]), original: value };
      }
    }
    return null;
  });
  if (!target) return null;
  const cell = page.locator(`[data-testid="ide-stimulus-expected-${target.fieldId}-t${target.tick}"]`).first();
  await cell.scrollIntoViewIfNeeded();
  return target;
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

async function assertNoOverlapSelectors(page, sourceSelector, targetSelectors, label) {
  const source = await readRect(page, sourceSelector);
  assert(source?.visible, `${label}: source ${sourceSelector} is not visible`);
  for (const targetSelector of targetSelectors) {
    const target = await readRect(page, targetSelector);
    if (!target?.visible) continue;
    assert(!boxesOverlap(source, target), `${label}: ${sourceSelector} overlaps ${targetSelector}; source=${describeRect(source)}, target=${describeRect(target)}`);
  }
}

async function assertHitTarget(page, selector, label) {
  const state = await page.evaluate((candidateSelector) => {
    const target = Array.from(document.querySelectorAll(candidateSelector)).find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const style = window.getComputedStyle(candidate);
      const visibleWidth = Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left));
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
      return (
        rect.width > 1 &&
        rect.height > 1 &&
        visibleWidth > 1 &&
        visibleHeight > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    });
    if (!target) return { ok: false, reason: 'missing-visible-match', matchCount: document.querySelectorAll(candidateSelector).length };
    const rect = target.getBoundingClientRect();
    const style = window.getComputedStyle(target);
    if (rect.width <= 1 || rect.height <= 1 || style.display === 'none' || style.visibility === 'hidden') {
      return { ok: false, reason: 'not-visible', rect: rectToObject(rect) };
    }
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      ok: Boolean(hit && (hit === target || target.contains(hit))),
      reason: hit ? 'hit-tested' : 'no-element-from-point',
      rect: rectToObject(rect),
      hitTag: hit?.tagName ?? null,
      hitTestId: hit?.getAttribute?.('data-testid') ?? null,
      hitClass: hit?.getAttribute?.('class') ?? null,
      hitText: hit?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? null,
    };

    function rectToObject(domRect) {
      return {
        top: Math.round(domRect.top),
        left: Math.round(domRect.left),
        width: Math.round(domRect.width),
        height: Math.round(domRect.height),
      };
    }
  }, selector);
  assert(state.ok, `${label}: primary target obstructed or missing ${selector}: ${JSON.stringify(state)}`);
}

async function readRect(page, selector) {
  return page.evaluate((candidateSelector) => {
    const element = document.querySelector(candidateSelector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const visibleWidth = Math.max(0, Math.min(window.innerWidth, rect.right) - Math.max(0, rect.left));
    const visibleHeight = Math.max(0, Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top));
    return {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      visibleWidth: Math.round(visibleWidth),
      visibleHeight: Math.round(visibleHeight),
      visible:
        rect.width > 1 &&
        rect.height > 1 &&
        visibleWidth > 1 &&
        visibleHeight > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden',
    };
  }, selector);
}

function boxesOverlap(first, second) {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

function describeRect(rect) {
  return `x=${rect.left} y=${rect.top} w=${rect.width} h=${rect.height}`;
}

async function capture(page, viewport, slug) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${viewport.label}-${slug}.png`),
    fullPage: false,
  });
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
