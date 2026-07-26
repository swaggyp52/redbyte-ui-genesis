#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assert, loadStarterProject, runIdeGate, visible } from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';

const ALL_VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '1366x768-equivalent-125pct', width: 1093, height: 614 },
];
const VIEWPORTS = process.env.RB_GATE_VIEWPORT
  ? ALL_VIEWPORTS.filter((viewport) => viewport.label === process.env.RB_GATE_VIEWPORT)
  : ALL_VIEWPORTS;
const STAGES = [
  { mode: 'project', label: 'Project' },
  { mode: 'design', label: 'Design' },
  { mode: 'verify', label: 'Verify' },
  { mode: 'hardware', label: 'Map Pins' },
  { mode: 'export', label: 'Export' },
];
const EVIDENCE_ROOT = resolve('.redbyte/product-immersion/unified-workbench-v3/after/gate');

assert(
  VIEWPORTS.length > 0,
  `Unknown RB_GATE_VIEWPORT "${process.env.RB_GATE_VIEWPORT}".`,
);

await mkdir(EVIDENCE_ROOT, { recursive: true });

await runIdeGate('IDE Unified Workbench v3 flow satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const records = [];
  const failures = [];

  await installCleanStudentContext(page);

  for (const viewport of VIEWPORTS) {
    try {
      records.push(await runViewport(page, baseUrl, viewport));
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
      await capture(page, viewport, 'failure').catch(() => null);
    }
  }

  await writeFile(
    resolve(EVIDENCE_ROOT, 'metrics.json'),
    `${JSON.stringify({
      gate: 'ide-unified-workbench-v3-flow',
      generatedAtIso: new Date().toISOString(),
      records,
      failures,
      browserProblems,
    }, null, 2)}\n`,
    'utf8',
  );

  assert(
    browserProblems.length === 0,
    `Unified Workbench v3 emitted browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`,
  );
  assert(failures.length === 0, `Unified Workbench v3 failures:\n${failures.join('\n')}`);
});

async function runViewport(page, baseUrl, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=unified-workbench-v3-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await assertBuildHash(page, `${viewport.label}/startup`);
  await assertSharedShell(page, viewport);
  const coldStart = await assertColdStartSurfaces(page, viewport);

  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  const surfaces = [];

  for (const stage of STAGES) {
    await openMode(page, stage.mode, viewport);
    await assertSharedShell(page, viewport);
    const surfaceObject = await assertSurfaceObject(page, viewport, stage.mode);
    const metrics = await collectSurfaceMetrics(page, stage.mode);
    assert(metrics.coreDetailsCount === 0, `${viewport.label}/${stage.label}: ${metrics.coreDetailsCount} core details controls remain`);
    assert(metrics.railToggleCount === 0, `${viewport.label}/${stage.label}: ${metrics.railToggleCount} floating rail controls remain`);
    assert(metrics.hideShowCount === 0, `${viewport.label}/${stage.label}: ${metrics.hideShowCount} Hide/Show controls remain`);
    assert(metrics.primaryCount <= 1, `${viewport.label}/${stage.label}: ${metrics.primaryCount} primary actions compete`);
    assert(metrics.undersizedRoutine.length === 0, `${viewport.label}/${stage.label}: undersized routine controls ${JSON.stringify(metrics.undersizedRoutine.slice(0, 8))}`);
    assert(metrics.undersizedPrimary.length === 0, `${viewport.label}/${stage.label}: undersized primary controls ${JSON.stringify(metrics.undersizedPrimary.slice(0, 8))}`);
    assert(metrics.undersizedText.length === 0, `${viewport.label}/${stage.label}: essential/support text below 13px ${JSON.stringify(metrics.undersizedText.slice(0, 8))}`);
    assert(metrics.undersizedEssentialText.length === 0, `${viewport.label}/${stage.label}: essential interaction text below 14px ${JSON.stringify(metrics.undersizedEssentialText.slice(0, 8))}`);
    surfaces.push({ mode: stage.mode, ...metrics, ...(surfaceObject ?? {}) });
    await assertNoRootOverflow(page, `${viewport.label}/${stage.label}`);
    await capture(page, viewport, stage.mode);
  }

  await page.getByTestId('mode-button-import').first().click();
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
  await assertSharedShell(page, viewport);
  const importSurfaceObject = await assertSurfaceObject(page, viewport, 'import');
  const importMetrics = await collectSurfaceMetrics(page, 'import');
  assert(importMetrics.coreDetailsCount === 0, `${viewport.label}/Import: core details controls remain`);
  assert(importMetrics.railToggleCount === 0, `${viewport.label}/Import: floating rail controls remain`);
  assert(importMetrics.hideShowCount === 0, `${viewport.label}/Import: Hide/Show controls remain`);
  assert(importMetrics.primaryCount <= 1, `${viewport.label}/Import: ${importMetrics.primaryCount} primary actions compete`);
  assert(importMetrics.undersizedRoutine.length === 0, `${viewport.label}/Import: undersized routine controls ${JSON.stringify(importMetrics.undersizedRoutine.slice(0, 8))}`);
  assert(importMetrics.undersizedPrimary.length === 0, `${viewport.label}/Import: undersized primary controls ${JSON.stringify(importMetrics.undersizedPrimary.slice(0, 8))}`);
  assert(importMetrics.undersizedText.length === 0, `${viewport.label}/Import: essential/support text below 13px ${JSON.stringify(importMetrics.undersizedText.slice(0, 8))}`);
  assert(importMetrics.undersizedEssentialText.length === 0, `${viewport.label}/Import: essential interaction text below 14px ${JSON.stringify(importMetrics.undersizedEssentialText.slice(0, 8))}`);
  surfaces.push({ mode: 'import', ...importMetrics, ...(importSurfaceObject ?? {}) });
  await assertNoRootOverflow(page, `${viewport.label}/Import`);
  await capture(page, viewport, 'import');

  return { viewport, coldStart, surfaces };
}

async function assertColdStartSurfaces(page, viewport) {
  await openMode(page, 'verify', viewport);
  await assertSharedShell(page, viewport);
  await page.waitForSelector('[data-testid="ide-verify-no-circuit-task"]', { timeout: 15000 });

  const verify = await page.evaluate(({ width, height }) => {
    const measure = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        fullyVisible: rect.left >= 0 && rect.top >= 0 && rect.right <= width && rect.bottom <= height,
        centerHit: hit === element || Boolean(hit && element.contains(hit)),
      };
    };
    return {
      body: measure('[data-testid="ide-mode-body"]'),
      workspace: measure('[data-testid="ide-verify-workspace"]'),
      task: measure('[data-testid="ide-verify-no-circuit-task"]'),
      actions: [
        'ide-verify-no-circuit-open-design',
        'ide-verify-no-circuit-load-starter',
        'ide-verify-no-circuit-import-recover',
      ].map((testId) => ({ testId, ...measure(`[data-testid="${testId}"]`) })),
      mainCount: document.querySelectorAll('main').length,
    };
  }, viewport);

  assert(verify.body && verify.workspace && verify.task, `${viewport.label}/Verify cold start: core workspace geometry is missing`);
  assert(verify.body.width >= viewport.width - 48, `${viewport.label}/Verify cold start: mode body collapsed to ${verify.body.width}px`);
  assert(verify.workspace.width >= verify.body.width - 48, `${viewport.label}/Verify cold start: workspace collapsed to ${verify.workspace.width}px inside ${verify.body.width}px`);
  assert(verify.task.fullyVisible, `${viewport.label}/Verify cold start: no-circuit task is clipped ${JSON.stringify(verify.task)}`);
  assert(verify.mainCount === 1, `${viewport.label}/Verify cold start: expected one main landmark, found ${verify.mainCount}`);
  for (const action of verify.actions) {
    const minimumHeight = action.testId === 'ide-verify-no-circuit-open-design' ? 40 : 36;
    assert(action.fullyVisible, `${viewport.label}/Verify cold start: ${action.testId} is clipped ${JSON.stringify(action)}`);
    assert(action.centerHit, `${viewport.label}/Verify cold start: ${action.testId} is pointer-blocked ${JSON.stringify(action)}`);
    assert(action.height >= minimumHeight - 0.5, `${viewport.label}/Verify cold start: ${action.testId} is below the ${minimumHeight}px target floor ${JSON.stringify(action)}`);
  }
  await assertNoRootOverflow(page, `${viewport.label}/Verify cold start`);
  await capture(page, viewport, 'verify-cold-start');

  await openMode(page, 'design', viewport);
  await assertSharedShell(page, viewport);
  await page.waitForSelector('[data-testid="ide-design-empty-state"]', { timeout: 15000 });
  const design = await page.evaluate(({ width, height }) => {
    const measure = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        fullyVisible: rect.left >= 0 && rect.top >= 0 && rect.right <= width && rect.bottom <= height,
        centerHit: hit === element || Boolean(hit && element.contains(hit)),
      };
    };
    const canvasRegion = document.querySelector('[data-testid="ide-design-live-canvas"] [role="region"]');
    return {
      controls: [
        'ide-design-zoom-reset',
        'ide-design-center-selection-canvas',
        'ide-design-tool-snap',
        'ide-design-empty-add-io',
        'ide-design-empty-add-and',
        'ide-design-empty-go-to-project',
      ].map((testId) => ({ testId, ...measure(`[data-testid="${testId}"]`) })),
      emptyState: measure('[data-testid="ide-design-empty-state"]'),
      canvasRegion: canvasRegion instanceof HTMLElement
        ? { role: canvasRegion.getAttribute('role'), label: canvasRegion.getAttribute('aria-label'), tabIndex: canvasRegion.tabIndex }
        : null,
      mainCount: document.querySelectorAll('main').length,
    };
  }, viewport);

  assert(design.emptyState?.fullyVisible, `${viewport.label}/Design cold start: onboarding actions are clipped ${JSON.stringify(design.emptyState)}`);
  assert(design.mainCount === 1, `${viewport.label}/Design cold start: expected one main landmark, found ${design.mainCount}`);
  assert(design.canvasRegion?.role === 'region', `${viewport.label}/Design cold start: focusable canvas has no region role`);
  assert(Boolean(design.canvasRegion?.label?.trim()), `${viewport.label}/Design cold start: focusable canvas has no accessible name`);
  assert(design.canvasRegion?.tabIndex === 0, `${viewport.label}/Design cold start: canvas is not keyboard-focusable`);
  for (const control of design.controls) {
    assert(control.fullyVisible, `${viewport.label}/Design cold start: ${control.testId} is clipped ${JSON.stringify(control)}`);
    assert(control.centerHit, `${viewport.label}/Design cold start: ${control.testId} is pointer-blocked ${JSON.stringify(control)}`);
    assert(control.height >= 35.5, `${viewport.label}/Design cold start: ${control.testId} is below the 36px routine target floor ${JSON.stringify(control)}`);
  }
  await assertNoRootOverflow(page, `${viewport.label}/Design cold start`);
  await capture(page, viewport, 'design-cold-start');

  await openMode(page, 'project', viewport);
  return { verify, design };
}

async function assertSharedShell(page, viewport) {
  const shell = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const stageNav = document.querySelector('[data-testid="ide-stage-nav"]');
    const stages = Array.from(stageNav?.querySelectorAll('[data-testid^="mode-button-"]') ?? []);
    const shellRoots = [document.querySelector('[data-testid="ide-top-bar"]'), stageNav].filter(Boolean);
    const shellControls = shellRoots.flatMap((root) =>
      Array.from(root.querySelectorAll('button, [role="button"], a[href], input:not([type="hidden"]), select, textarea')),
    ).filter(isVisible);
    const shellText = shellRoots.flatMap((root) =>
      Array.from(root.querySelectorAll('button, a, label, small, span, strong')),
    ).filter((element) => {
      if (!isVisible(element) || element.closest('[aria-hidden="true"], svg')) return false;
      const readableText = element.textContent?.replace(/\s+/g, ' ').trim()
        || (element.matches('button, a, input, select, textarea')
          ? element.getAttribute('aria-label')?.trim() || element.getAttribute('placeholder')?.trim()
          : '')
        || '';
      return readableText.length > 0;
    });
    const essentialShellText = [...new Set([
      ...shellControls,
      ...stages.flatMap((stage) => Array.from(stage.querySelectorAll('.ide-stage-nav-label'))),
    ])].filter(isVisible);
    const describe = (element) => {
      const style = getComputedStyle(element);
      return {
        label: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 72) ?? '',
        testId: element.getAttribute('data-testid'),
        height: Number(element.getBoundingClientRect().height.toFixed(1)),
        cssHeight: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        flex: style.flex,
        fontSize: Number.parseFloat(style.fontSize),
      };
    };
    return {
      stageNavVisible: isVisible(stageNav),
      stageLabels: stages.map((entry) => entry.querySelector('.ide-stage-nav-label')?.textContent?.trim() ?? ''),
      workflowRailCount: document.querySelectorAll('[data-testid="ide-left-rail"], .ide-left-rail').length,
      onboardingCount: document.querySelectorAll('[data-testid="ide-onboarding-overlay"], .ide-onboarding-overlay').length,
      statusFooterCount: Array.from(document.querySelectorAll('[data-testid="ide-status-bar"]')).filter(isVisible).length,
      importInTopbar: Boolean(document.querySelector('[data-testid="ide-top-bar"] [data-testid="mode-button-import"]')),
      topbarText: document.querySelector('[data-testid="ide-top-bar"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      undersizedControls: shellControls.filter((control) => control.getBoundingClientRect().height < 35.5).map(describe),
      undersizedText: shellText.filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 12.9).map(describe),
      undersizedEssentialText: essentialShellText.filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 13.9).map(describe),
    };
  });

  assert(shell.stageNavVisible, `${viewport.label}: horizontal stage navigation is missing`);
  assert(
    JSON.stringify(shell.stageLabels) === JSON.stringify(STAGES.map((stage) => stage.label)),
    `${viewport.label}: stage order is ${JSON.stringify(shell.stageLabels)}`,
  );
  assert(shell.workflowRailCount === 0, `${viewport.label}: permanent workflow rail still exists`);
  assert(shell.onboardingCount === 0, `${viewport.label}: passive workflow orientation overlay still exists`);
  assert(shell.statusFooterCount === 0, `${viewport.label}: permanent footer status strip still exists`);
  assert(shell.importInTopbar, `${viewport.label}: Import is not a top-product-bar utility`);
  assert(shell.undersizedControls.length === 0, `${viewport.label}: shell controls below 36px ${JSON.stringify(shell.undersizedControls.slice(0, 8))}`);
  assert(shell.undersizedText.length === 0, `${viewport.label}: shell text below 13px ${JSON.stringify(shell.undersizedText.slice(0, 8))}`);
  assert(shell.undersizedEssentialText.length === 0, `${viewport.label}: essential shell text below 14px ${JSON.stringify(shell.undersizedEssentialText.slice(0, 8))}`);
  for (const label of ['RedByte', 'Board', 'Save', 'Import', 'Help']) {
    assert(shell.topbarText.includes(label), `${viewport.label}: top product bar is missing ${label}`);
  }
}

async function assertSurfaceObject(page, viewport, mode) {
  if (mode === 'project') {
    assert(await visible(page.getByTestId('ide-project-professional-overview').first()), `${viewport.label}/Project: engineering overview missing`);
    return null;
  }
  if (mode === 'design') {
    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const bounds = element.getBoundingClientRect();
        return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
      };
      const left = rect('[data-testid="ide-left-dock"]');
      const canvas = rect('[data-testid="ide-design-live-canvas"]');
      const right = rect('[data-testid="ide-right-dock"]');
      const center = rect('[data-testid="ide-design-control-bar"]');
      const main = document.querySelector('.ide-workbench-main');
      const rightElement = document.querySelector('[data-testid="ide-right-dock"]');
      return {
        left,
        canvas,
        right,
        center,
        grid: main instanceof HTMLElement
          ? {
              columns: getComputedStyle(main).gridTemplateColumns,
              rows: getComputedStyle(main).gridTemplateRows,
            }
          : null,
        rightGrid: rightElement instanceof HTMLElement
          ? {
              column: getComputedStyle(rightElement).gridColumn,
              row: getComputedStyle(rightElement).gridRow,
            }
          : null,
        share: (canvas?.width ?? 0) / Math.max(1, (left?.width ?? 0) + (canvas?.width ?? 0) + (right?.width ?? 0)),
      };
    });
    assert(geometry.left && geometry.canvas && geometry.right && geometry.center, `${viewport.label}/Design: one or more stable work regions are missing`);
    assert(geometry.left.width >= 180 && geometry.left.width <= 230, `${viewport.label}/Design: library width ${geometry.left.width}px is unstable`);
    if (viewport.width >= 1200) {
      assert(geometry.right.width >= 210 && geometry.right.width <= 290, `${viewport.label}/Design: inspector width ${geometry.right.width}px is unstable`);
      assert(Math.abs(geometry.left.top - geometry.center.top) <= 8, `${viewport.label}/Design: library is not aligned with the center workspace ${JSON.stringify(geometry)}`);
      assert(Math.abs(geometry.right.top - geometry.center.top) <= 8, `${viewport.label}/Design: inspector is not aligned with the center workspace ${JSON.stringify(geometry)}`);
      const minimumShare = viewport.width >= 1800 ? 0.70 : viewport.width >= 1440 ? 0.66 : 0.64;
      assert(geometry.share >= minimumShare, `${viewport.label}/Design: canvas share ${geometry.share.toFixed(3)} is not dominant`);
    } else {
      assert(
        geometry.canvas.width >= viewport.width - geometry.left.width - 90,
        `${viewport.label}/Design: responsive canvas leaves an unused support-rail column ${JSON.stringify(geometry)}`,
      );
      assert(geometry.right.width >= geometry.canvas.width * 0.85, `${viewport.label}/Design: responsive inspector is not a stable lower detail region ${JSON.stringify(geometry)}`);
      assert(geometry.right.top >= geometry.canvas.top + geometry.canvas.height - 8, `${viewport.label}/Design: responsive inspector does not follow the canvas ${JSON.stringify(geometry)}`);
    }
    return { geometry };
  }
  if (mode === 'verify') {
    assert(await visible(page.getByTestId('ide-verify-context-header').first()), `${viewport.label}/Verify: Simulation Studio header missing`);
    assert(await visible(page.getByTestId('ide-verify-authoring-path').first()), `${viewport.label}/Verify: combinational/sequential path missing`);
    assert(await visible(page.getByTestId('ide-verify-add-vector-form').first()), `${viewport.label}/Verify: testbench editor missing`);
    assert(await visible(page.getByTestId('ide-vcb-run').first()), `${viewport.label}/Verify: one stable Run control missing`);
    return null;
  }
  if (mode === 'hardware') {
    assert(await visible(page.getByTestId('ide-hw-map-table').first()), `${viewport.label}/Map Pins: assignment table missing`);
    assert(await visible(page.getByTestId('ide-hw-mapping-overview').first()), `${viewport.label}/Map Pins: progress header missing`);
    return null;
  }
  if (mode === 'export') {
    assert(await visible(page.getByTestId('ide-export-readiness-hero').first()), `${viewport.label}/Export: handoff decision missing`);
    return null;
  }
  if (mode === 'import') {
    assert(await visible(page.getByTestId('ide-import-horizontal-stepper').first()), `${viewport.label}/Import: Upload/Review/Apply stepper missing`);
  }
  return null;
}

async function collectSurfaceMetrics(page, mode) {
  return page.evaluate((activeMode) => {
    const root = document.querySelector(`[data-testid="ide-mode-${activeMode}"]`);
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const controls = Array.from(
      root?.querySelectorAll('button, [role="button"], a[href], input:not([type="hidden"]), select, textarea') ?? [],
    ).filter(isVisible);
    const hideShow = controls.filter((control) => /^(hide|show)(\s|$)/i.test(control.textContent?.trim() ?? ''));
    const routine = controls.filter((control) => !control.matches('.ide-button-primary, [data-product-priority="primary"]'));
    const primaries = controls.filter((control) => control.matches('.ide-button-primary, [data-product-priority="primary"]'));
    const textNodes = Array.from(root?.querySelectorAll('p, li, td, th, dt, dd, label, button, a, input, select, textarea, small, span, strong, summary') ?? []).filter((element) => {
      if (!isVisible(element)) return false;
      if (element.closest('[aria-hidden="true"], svg')) return false;
      const readableText = element.textContent?.replace(/\s+/g, ' ').trim()
        || (element.matches('button, a, input, select, textarea')
          ? element.getAttribute('aria-label')?.trim() || element.getAttribute('placeholder')?.trim()
          : '')
        || '';
      return readableText.length > 0;
    });
    const textBearingControls = controls.filter((control) =>
      !(control instanceof HTMLInputElement && ['checkbox', 'radio', 'range', 'color'].includes(control.type)),
    );
    const essentialTextNodes = [...new Set([
      ...textBearingControls,
      ...Array.from(root?.querySelectorAll('label, [data-product-priority="primary"]') ?? []),
    ])].filter(isVisible);
    const pillNodes = Array.from(root?.querySelectorAll('.ide-status-pill, .ide-chip, [class*="-pill"]') ?? []).filter(isVisible);
    const bordered = Array.from(root?.querySelectorAll('.ide-panel, .ide-card, .ide-surface-panel, .ide-callout, .ide-empty-state, .ide-blocked-state') ?? []).filter(isVisible);
    const passive = Array.from(root?.querySelectorAll('.ide-chip, [class*="-chip"], [class*="-badge"], [class*="-pill"]') ?? []).filter(isVisible);
    const describe = (element) => ({
      label: (element.textContent?.replace(/\s+/g, ' ').trim()
        || element.getAttribute('aria-label')?.trim()
        || element.getAttribute('placeholder')?.trim()
        || '').slice(0, 72),
      testId: element.getAttribute('data-testid'),
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute('type'),
      className: typeof element.className === 'string' ? element.className.slice(0, 120) : '',
      height: Number(element.getBoundingClientRect().height.toFixed(1)),
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
    });
    const targetHeight = (control) => {
      if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type)) {
        const label = control.closest('label');
        if (label && isVisible(label)) return label.getBoundingClientRect().height;
      }
      return control.getBoundingClientRect().height;
    };
    return {
      coreDetailsCount: root?.querySelectorAll('details, summary').length ?? 0,
      railToggleCount: root?.querySelectorAll('[class*="dock-toggle-rail"], [data-testid*="dock-toggle"], [data-testid*="dock-collapse"]').length ?? 0,
      hideShowCount: hideShow.length,
      primaryCount: primaries.length,
      visibleControlCount: controls.length,
      pillCount: pillNodes.length,
      borderedContainerCount: bordered.length,
      passiveFragmentCount: passive.length,
      undersizedRoutine: routine.filter((control) => targetHeight(control) < 35.5).map(describe),
      undersizedPrimary: primaries.filter((control) => targetHeight(control) < 39.5).map(describe),
      undersizedText: textNodes.filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 12.9).map(describe),
      undersizedEssentialText: essentialTextNodes.filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 13.9).map(describe),
    };
  }, mode);
}

async function openMode(page, mode, viewport) {
  const marker = page.getByTestId(`ide-mode-${mode}`).first();
  if (await visible(marker)) return;
  const button = page.getByTestId(`mode-button-${mode}`).first();
  assert(await visible(button), `${viewport.label}/${mode}: stage control missing`);
  await button.click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForTimeout(100);
}

async function capture(page, viewport, phase) {
  await page.screenshot({
    path: resolve(EVIDENCE_ROOT, `${viewport.label}-${phase}.png`),
    fullPage: false,
    animations: 'disabled',
  });
}
