#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { assertBuildHash } from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '1366x768-equivalent-125pct', width: 1093, height: 614 },
];

const WORKFLOW = [
  { mode: 'project', label: 'Project' },
  { mode: 'design', label: 'Design' },
  { mode: 'verify', label: 'Verify' },
  { mode: 'hardware', label: 'Map Pins' },
  { mode: 'export', label: 'Export' },
];

const EVIDENCE_ROOT = resolve('.redbyte/product-immersion/professional-rebrand/after/gate');

await runIdeGate('IDE professional rebrand flow satisfied', async ({ page, baseUrl }) => {
  const browserErrors = [];
  const afterMetrics = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await mkdir(EVIDENCE_ROOT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/?mode=project&e2e=1&professionalRebrand=1`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);

    await assertBuildHash(page, `${viewport.label}/professional rebrand`);
    await assertProfessionalShell(page, viewport);
    afterMetrics.push({
      viewport: viewport.label,
      state: 'project-first-look',
      ...(await assertSurfaceBasics(page, viewport, 'project')),
    });
    await capture(page, viewport, 'project-first-look');

    await loadStarterProject(page, { exactExampleId: 'logic-gates' });

    for (const stage of WORKFLOW) {
      await activateMode(page, baseUrl, stage.mode);
      await assertProfessionalShell(page, viewport);
      afterMetrics.push({
        viewport: viewport.label,
        state: stage.mode,
        ...(await assertSurfaceBasics(page, viewport, stage.mode)),
      });
      await assertWorkObject(page, viewport, stage.mode);
      await capture(page, viewport, stage.mode);
    }

    await activateMode(page, baseUrl, 'import');
    await assertProfessionalShell(page, viewport);
    afterMetrics.push({
      viewport: viewport.label,
      state: 'import',
      ...(await assertSurfaceBasics(page, viewport, 'import')),
    });
    await assertWorkObject(page, viewport, 'import');
    await capture(page, viewport, 'import');
  }

  assert(
    browserErrors.length === 0,
    `Professional rebrand flow emitted browser errors: ${JSON.stringify(browserErrors.slice(0, 8))}`,
  );
  await writeFile(
    resolve(EVIDENCE_ROOT, 'metrics.json'),
    `${JSON.stringify({ capturedAt: new Date().toISOString(), browserErrors, surfaces: afterMetrics }, null, 2)}\n`,
    'utf8',
  );
});

async function activateMode(page, baseUrl, mode) {
  const marker = page.locator(`[data-testid="ide-mode-${mode}"]`).first();
  if (await marker.isVisible().catch(() => false)) return;

  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&professionalRebrand=1`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForTimeout(120);
}

async function assertProfessionalShell(page, viewport) {
  const shell = await page.evaluate(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!visible(element)) return null;
      const value = element.getBoundingClientRect();
      return { top: value.top, right: value.right, bottom: value.bottom, left: value.left, width: value.width, height: value.height };
    };
    const stageButtons = Array.from(document.querySelectorAll('[data-testid="ide-stage-nav"] .ide-stage-nav-button')).filter(visible);
    return {
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      root: rect('[data-testid="ide-root"]'),
      topBar: rect('[data-testid="ide-top-bar"]'),
      stageNav: rect('[data-testid="ide-stage-nav"]'),
      layout: rect('.ide-layout-shell'),
      workflowRailCount: document.querySelectorAll('[data-testid="ide-left-rail"], .ide-left-rail').length,
      proofRibbonCount: Array.from(document.querySelectorAll('[data-testid="ide-proof-ribbon"]')).filter(visible).length,
      statusBarCount: Array.from(document.querySelectorAll('[data-testid="ide-status-bar"]')).filter(visible).length,
      productSpineCount: Array.from(document.querySelectorAll('[data-testid^="ide-product-spine-"]')).filter(visible).length,
      stageLabels: stageButtons.map((button) => button.querySelector('.ide-stage-nav-label')?.textContent?.trim() ?? ''),
      importVisible: visible(document.querySelector('[data-testid="ide-top-bar"] [data-testid="mode-button-import"]')),
      importIsStep: Boolean(document.querySelector('[data-testid="ide-stage-nav"] [data-testid="mode-button-import"]')),
      scopeText: document.querySelector('[data-testid="ide-top-bar"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      topBarBackground: document.querySelector('[data-testid="ide-top-bar"]') instanceof HTMLElement
        ? getComputedStyle(document.querySelector('[data-testid="ide-top-bar"]')).backgroundImage
        : '',
    };
  });

  assert(shell.root && shell.topBar && shell.stageNav && shell.layout, `${viewport.label}: compact shell regions must be visible`);
  assert(shell.documentWidth <= viewport.width + 2, `${viewport.label}: root overflow ${shell.documentWidth} > ${viewport.width}`);
  assert(shell.workflowRailCount === 0, `${viewport.label}: obsolete workflow rail is still mounted`);
  assert(shell.proofRibbonCount === 0, `${viewport.label}: proof ribbon must not compete with the workflow rail`);
  assert(shell.statusBarCount === 0, `${viewport.label}: support footer must not repeat shell status`);
  assert(shell.productSpineCount === 0, `${viewport.label}: duplicate product-spine header is still visible`);
  assert(
    JSON.stringify(shell.stageLabels) === JSON.stringify(WORKFLOW.map((stage) => stage.label)),
    `${viewport.label}: expected one five-stage workflow authority, got ${JSON.stringify(shell.stageLabels)}`,
  );
  assert(shell.importVisible && !shell.importIsStep, `${viewport.label}: Import must be a visible utility, not workflow step 6`);
  for (const required of ['RedByte', 'Board', 'Save', 'Import', 'Help']) {
    assert(shell.scopeText.includes(required), `${viewport.label}: top product bar is missing ${required}`);
  }
  assert(shell.topBarBackground === 'none', `${viewport.label}: top bar must not use a decorative gradient`);
  assert(shell.stageNav.top >= shell.topBar.bottom - 2, `${viewport.label}: stage navigation must follow the top bar`);
  assert(shell.layout.top <= shell.stageNav.bottom + 2, `${viewport.label}: workbench must begin directly under stage navigation`);
}

async function assertSurfaceBasics(page, viewport, mode) {
  const metrics = await page.evaluate((activeMode) => {
    const surface = document.querySelector(`[data-ide-mode-marker="${activeMode}"]`) ?? document.querySelector(`[data-testid="ide-mode-${activeMode}"]`);
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const unique = (elements) => Array.from(new Set(elements));
    const describeControl = (control) => {
      const style = getComputedStyle(control);
      const matchedMinHeightRules = [];
      const collectRules = (rules) => {
        for (const rule of Array.from(rules ?? [])) {
          if (rule instanceof CSSStyleRule) {
            if (rule.style.minHeight && control.matches(rule.selectorText)) {
              matchedMinHeightRules.push(`${rule.selectorText} { min-height: ${rule.style.minHeight}${rule.style.getPropertyPriority('min-height') ? ' !important' : ''} }`);
            }
          } else if ('cssRules' in rule) {
            collectRules(rule.cssRules);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          collectRules(sheet.cssRules);
        } catch {
          // All production gate styles are same-origin; ignore optional cross-origin sheets.
        }
      }
      return {
        label: control.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? '',
        testId: control.getAttribute('data-testid'),
        className: control.className,
        height: Number(control.getBoundingClientRect().height.toFixed(1)),
        computedMinHeight: style.minHeight,
        padding: style.padding,
        fontSize: style.fontSize,
        matchedMinHeightRules: matchedMinHeightRules.slice(-8),
      };
    };
    const primaries = surface
      ? unique(Array.from(surface.querySelectorAll('.ide-button-primary, [data-product-priority="primary"]'))).filter(visible)
      : [];
    const controls = surface
      ? Array.from(surface.querySelectorAll('button.ide-button, a.ide-button')).filter(visible)
      : [];
    const routineHeights = controls
      .filter((control) => !control.classList.contains('ide-button-primary'))
      .map((control) => control.getBoundingClientRect().height);
    const undersizedRoutineControls = controls
      .filter((control) => !control.classList.contains('ide-button-primary'))
      .filter((control) => control.getBoundingClientRect().height < 35.5)
      .map(describeControl);
    const primaryHeights = primaries.map((control) => control.getBoundingClientRect().height);
    const undersizedPrimaryControls = primaries
      .filter((control) => control.getBoundingClientRect().height < 39.5)
      .map(describeControl);
    const allControlHeights = controls.map((control) => control.getBoundingClientRect().height);
    const surfaceStyle = surface instanceof HTMLElement ? getComputedStyle(surface) : null;
    const chips = surface
      ? unique(Array.from(surface.querySelectorAll('.ide-status-pill, .ide-surface-command-chip, .ide-project-start-summary-chip, .ide-chip'))).filter(visible)
      : [];
    const borderedSurfaces = surface
      ? unique(Array.from(surface.querySelectorAll('.ide-panel, .ide-card, .ide-surface-panel, .ide-empty-state, .ide-blocked-state, .ide-readiness-hero'))).filter(visible)
      : [];
    const textSizes = surface
      ? Array.from(surface.querySelectorAll('p, li, td, th, label, button, a, input, select, textarea, span'))
          .filter((element) => visible(element) && (element.textContent?.trim() || element instanceof HTMLInputElement))
          .map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
          .filter((value) => Number.isFinite(value) && value > 0)
      : [];
    const focusSelectors = {
      project: ['[data-testid="ide-project-professional-overview"]', '.ide-project-start-card'],
      design: ['[data-testid="ide-design-live-canvas"]'],
      verify: ['[data-testid="ide-verify-authoring-path"]', '[data-testid="ide-verify-add-vector-form"]'],
      hardware: ['[data-testid="ide-hw-map-table"]'],
      export: ['[data-testid="ide-export-readiness-hero"]'],
    };
    const focus = (focusSelectors[activeMode] ?? [])
      .map((selector) => document.querySelector(selector))
      .find(visible);
    const focusRect = focus instanceof HTMLElement ? focus.getBoundingClientRect() : null;
    const primaryLabels = primaries.map((control) => control.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    return {
      exists: Boolean(surface && visible(surface)),
      primaryCount: primaries.length,
      primaryLabels,
      visibleControlCount: controls.length,
      chipCount: chips.length,
      nestedBorderedSurfaceCount: borderedSurfaces.length,
      routineMinimum: routineHeights.length ? Math.min(...routineHeights) : null,
      undersizedRoutineControls,
      primaryMinimum: primaryHeights.length ? Math.min(...primaryHeights) : null,
      undersizedPrimaryControls,
      clickTargetMinimum: allControlHeights.length ? Math.min(...allControlHeights) : null,
      bodyFontSize: surfaceStyle ? Number.parseFloat(surfaceStyle.fontSize) : 0,
      minimumVisibleTextSize: textSizes.length ? Math.min(...textSizes) : null,
      mainWorkObjectViewportPercent: focusRect
        ? Number(((focusRect.width * focusRect.height * 100) / (window.innerWidth * window.innerHeight)).toFixed(1))
        : null,
      commandHeaderCount: surface
        ? Array.from(surface.querySelectorAll('.ide-surface-command-strip, .ide-workbench-page-header')).filter(visible).length
        : 0,
    };
  }, mode);

  assert(metrics.exists, `${viewport.label}/${mode}: active surface is not visible`);
  assert(metrics.primaryCount <= 1, `${viewport.label}/${mode}: found ${metrics.primaryCount} competing primary actions`);
  assert(
    new Set(metrics.primaryLabels).size === metrics.primaryLabels.length,
    `${viewport.label}/${mode}: duplicate primary action labels ${JSON.stringify(metrics.primaryLabels)}`,
  );
  assert(metrics.bodyFontSize >= 14, `${viewport.label}/${mode}: body font ${metrics.bodyFontSize}px is below 14px`);
  assert(metrics.commandHeaderCount <= 1, `${viewport.label}/${mode}: found ${metrics.commandHeaderCount} page command headers`);
  if (metrics.routineMinimum !== null) {
    assert(
      metrics.routineMinimum >= 35.5,
      `${viewport.label}/${mode}: routine action is ${metrics.routineMinimum}px tall; undersized=${JSON.stringify(metrics.undersizedRoutineControls.slice(0, 8))}`,
    );
  }
  if (metrics.primaryMinimum !== null) {
    assert(
      metrics.primaryMinimum >= 39.5,
      `${viewport.label}/${mode}: primary action is ${metrics.primaryMinimum}px tall; undersized=${JSON.stringify(metrics.undersizedPrimaryControls.slice(0, 8))}`,
    );
  }
  return metrics;
}

async function assertWorkObject(page, viewport, mode) {
  if (mode === 'project') {
    await page.locator('[data-testid="ide-project-professional-overview"]').first().waitFor({ state: 'visible', timeout: 10000 });
    return;
  }

  if (mode === 'design') {
    const geometry = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const value = element.getBoundingClientRect();
        return value.width > 1 && value.height > 1
          ? { top: value.top, width: value.width, height: value.height }
          : null;
      };
      const left = rect('[data-testid="ide-left-dock"]');
      const canvas = rect('[data-testid="ide-design-live-canvas"]');
      const right = rect('[data-testid="ide-right-dock"]');
      const center = rect('[data-testid="ide-design-control-bar"]');
      return {
        left,
        canvas,
        right,
        center,
        policy: document.querySelector('[data-testid="ide-mode-design"]')?.getAttribute('data-support-dock-policy') ?? '',
        share: (canvas?.width ?? 0) / Math.max(1, (left?.width ?? 0) + (canvas?.width ?? 0) + (right?.width ?? 0)),
      };
    });
    assert(geometry.left && geometry.canvas && geometry.right && geometry.center, `${viewport.label}/Design: stable Library, canvas, and Inspector regions must be visible`);
    assert(geometry.policy === 'stable', `${viewport.label}/Design: support docks must use the stable v3 policy`);
    assert(geometry.left.width >= 180 && geometry.left.width <= 230, `${viewport.label}/Design: Library width ${geometry.left.width}px is unstable`);
    if (viewport.width >= 1200) {
      assert(geometry.right.width >= 210 && geometry.right.width <= 290, `${viewport.label}/Design: Inspector width ${geometry.right.width}px is unstable`);
      const minimumShare = viewport.width >= 1800 ? 0.7 : viewport.width >= 1440 ? 0.66 : 0.64;
      assert(geometry.share >= minimumShare, `${viewport.label}/Design: canvas share ${geometry.share.toFixed(3)} is not dominant`);
    } else {
      assert(geometry.right.top >= geometry.canvas.top + geometry.canvas.height - 8, `${viewport.label}/Design: responsive Inspector must follow the canvas`);
    }
    return;
  }

  if (mode === 'verify') {
    await page.locator('[data-testid="ide-testbench-documents"]').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="ide-verify-authoring-path"]').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-testid="ide-verify-add-vector-form"]').first().waitFor({ state: 'visible', timeout: 10000 });
    const runCount = await page.locator('[data-testid="ide-vcb-run"]:visible').count();
    assert(runCount === 1, `${viewport.label}/Verify: expected one Run authority, got ${runCount}`);
    return;
  }

  if (mode === 'hardware') {
    const table = page.locator('[data-testid="ide-hw-map-table"]').first();
    await table.waitFor({ state: 'visible', timeout: 10000 });
    return;
  }

  if (mode === 'export') {
    const hero = page.locator('[data-testid="ide-export-readiness-hero"]').first();
    await hero.waitFor({ state: 'visible', timeout: 10000 });
    const ordering = await page.evaluate(() => {
      const heroElement = document.querySelector('[data-testid="ide-export-readiness-hero"]');
      const browserElement = document.querySelector('[data-testid="ide-export-file-browser"]');
      const isVisible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      return {
        heroTop: isVisible(heroElement) ? heroElement.getBoundingClientRect().top : null,
        browserTop: isVisible(browserElement) ? browserElement.getBoundingClientRect().top : null,
        browserVisible: isVisible(browserElement),
      };
    });
    assert(ordering.browserVisible, `${viewport.label}/Export: v3 package file browser must remain inspectable in every package state`);
    assert(ordering.heroTop <= ordering.browserTop, `${viewport.label}/Export: readiness decision must precede file browsing`);
    const boundaryText = ((await page.getByTestId('ide-export-e0-boundary-summary').first().textContent()) ?? '').replace(/\s+/g, ' ');
    assert(
      /Browser E0.*Vivado build.*programming.*physical board behavior.*external/i.test(boundaryText),
      `${viewport.label}/Export: browser-only proof boundary is missing`,
    );
    return;
  }

  if (mode === 'import') {
    const stepper = page.getByTestId('ide-import-horizontal-stepper').first();
    await stepper.waitFor({ state: 'visible', timeout: 10000 });
    const steps = (await stepper.locator('li').allTextContents()).map((entry) => entry.replace(/\s+/g, ' ').trim());
    assert(
      steps.length === 3 && /upload/i.test(steps[0]) && /review/i.test(steps[1]) && /apply/i.test(steps[2]),
      `${viewport.label}/Import: expected horizontal Upload -> Review -> Apply authority, got ${JSON.stringify(steps)}`,
    );
    const workbenchText = ((await page.getByTestId('ide-import-workbench').first().textContent()) ?? '').replace(/\s+/g, ' ');
    assert(/without replacing current work early/i.test(workbenchText), `${viewport.label}/Import: no-early-replacement boundary is missing`);
  }
}

async function capture(page, viewport, phase) {
  const path = resolve(EVIDENCE_ROOT, `${viewport.label}-${phase}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
}
