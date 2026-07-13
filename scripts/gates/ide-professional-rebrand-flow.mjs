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
    const stageButtons = Array.from(document.querySelectorAll('.ide-mode-button--step')).filter(visible);
    return {
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      root: rect('[data-testid="ide-root"]'),
      topBar: rect('[data-testid="ide-top-bar"]'),
      leftRail: rect('[data-testid="ide-left-rail"]'),
      layout: rect('.ide-layout-shell'),
      proofRibbonCount: Array.from(document.querySelectorAll('[data-testid="ide-proof-ribbon"]')).filter(visible).length,
      statusBarCount: Array.from(document.querySelectorAll('[data-testid="ide-status-bar"]')).filter(visible).length,
      productSpineCount: Array.from(document.querySelectorAll('[data-testid^="ide-product-spine-"]')).filter(visible).length,
      stageLabels: stageButtons.map((button) => button.querySelector('.ide-mode-label')?.textContent?.trim() ?? ''),
      importVisible: visible(document.querySelector('[data-testid="mode-button-import"]')),
      importIsStep: document.querySelector('[data-testid="mode-button-import"]')?.classList.contains('ide-mode-button--step') ?? false,
      scopeText: document.querySelector('[data-testid="ide-top-bar"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      topBarBackground: document.querySelector('[data-testid="ide-top-bar"]') instanceof HTMLElement
        ? getComputedStyle(document.querySelector('[data-testid="ide-top-bar"]')).backgroundImage
        : '',
    };
  });

  assert(shell.root && shell.topBar && shell.leftRail && shell.layout, `${viewport.label}: compact shell regions must be visible`);
  assert(shell.documentWidth <= viewport.width + 2, `${viewport.label}: root overflow ${shell.documentWidth} > ${viewport.width}`);
  assert(shell.proofRibbonCount === 0, `${viewport.label}: proof ribbon must not compete with the workflow rail`);
  assert(shell.statusBarCount === 0, `${viewport.label}: support footer must not repeat shell status`);
  assert(shell.productSpineCount === 0, `${viewport.label}: duplicate product-spine header is still visible`);
  assert(
    JSON.stringify(shell.stageLabels) === JSON.stringify(WORKFLOW.map((stage) => stage.label)),
    `${viewport.label}: expected one five-stage workflow authority, got ${JSON.stringify(shell.stageLabels)}`,
  );
  assert(shell.importVisible && !shell.importIsStep, `${viewport.label}: Import must be a visible utility, not workflow step 6`);
  assert(/Browser E0/i.test(shell.scopeText), `${viewport.label}: top bar must state the Browser E0 scope`);
  assert(shell.topBarBackground === 'none', `${viewport.label}: top bar must not use a decorative gradient`);
  assert(shell.layout.top <= shell.topBar.bottom + 2, `${viewport.label}: workbench must begin directly under the top bar`);
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
      project: ['[data-testid="ide-project-command-center"]', '.ide-project-start-card'],
      design: ['[data-testid="ide-design-canvas"]'],
      verify: ['[data-testid="ide-verify-stimulus-workbench"]', '[data-testid="ide-verify-add-vector-form"]', '.ide-verify-testbench-card'],
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
    await page.locator('[data-testid="ide-project-command-center"]').first().waitFor({ state: 'visible', timeout: 10000 });
    return;
  }

  if (mode === 'design') {
    const geometry = await relativeGeometry(page, '[data-testid="ide-design-canvas"]', '[data-testid="ide-mode-design"]');
    assert(geometry, `${viewport.label}/Design: canvas must be visible`);
    assert(geometry.widthShare >= 0.5, `${viewport.label}/Design: canvas width share ${geometry.widthShare.toFixed(2)} is not dominant`);
    return;
  }

  if (mode === 'verify') {
    const testbench = page.locator('[data-testid="ide-verify-add-vector-form"]').first();
    await testbench.waitFor({ state: 'visible', timeout: 10000 });
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
      const browserElement = document.querySelector('[data-testid="ide-export-file-browser-v1"]');
      const blockedElement = document.querySelector('[data-testid="ide-export-blocked-empty-state"]');
      const isVisible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };
      return {
        heroTop: isVisible(heroElement) ? heroElement.getBoundingClientRect().top : null,
        browserTop: isVisible(browserElement) ? browserElement.getBoundingClientRect().top : null,
        browserVisible: isVisible(browserElement),
        blockedVisible: isVisible(blockedElement),
      };
    });
    if (ordering.blockedVisible) {
      assert(!ordering.browserVisible, `${viewport.label}/Export: blocked state must hide the package browser`);
    } else if (ordering.browserVisible) {
      assert(ordering.heroTop <= ordering.browserTop, `${viewport.label}/Export: readiness decision must precede file browsing`);
    }
    return;
  }

  if (mode === 'import') {
    const utilityCopy = page.getByTestId('ide-import-utility-copy').first();
    await utilityCopy.waitFor({ state: 'visible', timeout: 10000 });
    const utilityText = (await utilityCopy.textContent()) ?? '';
    assert(/Import is for recovery and restore/i.test(utilityText), `${viewport.label}/Import: utility boundary is missing`);
    assert(/never replaces current work until review and confirmation/i.test(utilityText), `${viewport.label}/Import: replacement boundary is missing`);
    const cancelCopy = page.getByTestId('ide-import-cancel-preserves-copy').first();
    await cancelCopy.waitFor({ state: 'visible', timeout: 10000 });
    const cancelText = (await cancelCopy.textContent()) ?? '';
    assert(/current project stays intact/i.test(cancelText), `${viewport.label}/Import: cancel preservation is missing`);
  }
}

async function relativeGeometry(page, childSelector, parentSelector) {
  return page.evaluate(({ childSelector: child, parentSelector: parent }) => {
    const childElement = document.querySelector(child);
    const parentElement = document.querySelector(parent);
    if (!(childElement instanceof HTMLElement) || !(parentElement instanceof HTMLElement)) return null;
    const childRect = childElement.getBoundingClientRect();
    const parentRect = parentElement.getBoundingClientRect();
    if (childRect.width <= 0 || childRect.height <= 0 || parentRect.width <= 0 || parentRect.height <= 0) return null;
    return {
      widthShare: childRect.width / parentRect.width,
      heightShare: childRect.height / parentRect.height,
    };
  }, { childSelector, parentSelector });
}

async function capture(page, viewport, phase) {
  const path = resolve(EVIDENCE_ROOT, `${viewport.label}-${phase}.png`);
  await page.screenshot({ path, fullPage: false, animations: 'disabled' });
}
