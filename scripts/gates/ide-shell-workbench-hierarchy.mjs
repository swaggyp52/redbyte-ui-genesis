#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: 'classroom', width: 1366, height: 768 },
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'wide', width: 1920, height: 1080 },
];

const MODES = [
  {
    id: 'project',
    primary: ['[data-testid="ide-project-overview-document"]', '[data-testid="ide-project-panel"]'],
    support: [
      ['[data-testid="ide-project-professional-facts"]'],
      ['[data-testid="ide-project-explorer"]'],
    ],
  },
  {
    id: 'design',
    primary: ['[data-testid="ide-design-live-canvas"]'],
    support: [
      [
        '[data-testid="ide-design-palette-section-io"]',
        '[data-testid="ide-design-board-io-palette"]',
      ],
      [
        '[data-testid="ide-design-inspector-canvas-default"]',
        '[data-testid="ide-design-selection-inspector"]',
        '[data-testid="ide-design-inspector-selection-details"]',
        '[data-testid="ide-design-inspector-actions"]',
      ],
    ],
  },
  {
    id: 'verify',
    primary: ['[data-testid="ide-verify-lab-grid"]'],
    support: [
      ['[data-testid="ide-left-dock"]'],
      [
        '[data-testid="ide-verify-region-stimulus"]',
        '[data-testid="ide-verify-workspace-waveform"]',
        '[data-testid="ide-verify-waveform-placeholder"]',
      ],
    ],
  },
  {
    id: 'hardware',
    primary: ['[data-testid="ide-hw-map-table"]'],
    support: [
      ['[data-testid="ide-hw-selected-mapping-editor"]'],
      ['[data-testid="ide-hw-map-board"]'],
    ],
  },
  {
    id: 'export',
    primary: ['[data-testid="ide-export-package-files"]'],
    support: [
      ['[data-testid="ide-export-package-inspector-v1"]'],
      ['[data-testid="ide-export-upstream-readiness"]'],
    ],
  },
  {
    id: 'import',
    routeOnly: true,
    primary: ['[data-testid="ide-import-workbench"]'],
    support: [
      ['[data-testid="ide-import-horizontal-stepper"]'],
      ['[data-testid="ide-import-zip-dropzone"]'],
    ],
  },
];

await runIdeGate('IDE shell workbench hierarchy satisfied', async ({ page, baseUrl }) => {
  const consoleFindings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' || /\b(?:NaN|Infinity|-Infinity)\b/.test(text)) {
      consoleFindings.push({ type: message.type(), text, location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    consoleFindings.push({ type: 'pageerror', text: error.message });
  });

  await page.addInitScript(() => {
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });
  await page.goto(`${baseUrl}/?mode=project&e2e=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-root"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(200);

    for (const mode of MODES) {
      await activateMode(page, baseUrl, mode.id, mode.routeOnly === true);
      await assertShellHierarchy(page, viewport, mode);
    }
  }

  assert(
    consoleFindings.length === 0,
    `Shell hierarchy emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function activateMode(page, baseUrl, mode, routeOnly) {
  if (mode === 'project' || routeOnly) {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    return;
  }

  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (!(await button.isVisible().catch(() => false))) {
    await page.goto(`${baseUrl}/?mode=project&e2e=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  }
  await page.locator(`[data-testid="mode-button-${mode}"]`).click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForTimeout(150);
}

async function assertShellHierarchy(page, viewport, mode) {
  if (mode.id === 'design') await selectFirstDesignNode(page);
  const state = await readHierarchyState(page, mode);

  assert(state.currentMode === mode.id, `${viewport.label}/${mode.id}: expected mode ${mode.id}, got ${state.currentMode}`);
  assert(
    state.documentWidth <= viewport.width + 2,
    `${viewport.label}/${mode.id}: horizontal root overflow ${state.documentWidth} > ${viewport.width}`
  );
  assert(state.topBar.visible, `${viewport.label}/${mode.id}: top bar missing`);
  assert(state.stageNav.visible, `${viewport.label}/${mode.id}: stage navigation missing`);
  assert(state.layoutShell.visible, `${viewport.label}/${mode.id}: workbench shell missing`);
  assert(state.mainCount === 1, `${viewport.label}/${mode.id}: expected one main landmark, got ${state.mainCount}`);
  assert(state.retiredRailCount === 0, `${viewport.label}/${mode.id}: retired workflow rail returned`);
  assert(state.retiredToggleCount === 0, `${viewport.label}/${mode.id}: retired dock toggle returned`);
  assert(
    state.focal.visible && state.focal.width > 180 && state.focal.height > 80,
    `${viewport.label}/${mode.id}: focal work object missing/collapsed ${JSON.stringify(state.focal)}`
  );
  state.support.forEach((region, index) => {
    assert(
      region.visible && region.width > 120 && region.height > 48,
      `${viewport.label}/${mode.id}: direct support region ${index + 1} missing/collapsed ${JSON.stringify(region)}`
    );
  });
  assert(!state.proofRibbon.visible, `${viewport.label}/${mode.id}: retired proof ribbon is still visible`);
  assert(
    state.statusBar.visible && state.statusBar.height <= 28,
    `${viewport.label}/${mode.id}: shared status bar must remain visible and compact ${JSON.stringify(state.statusBar)}`
  );
  assert(state.productSpineCount === 0, `${viewport.label}/${mode.id}: duplicate page product spine is visible`);
  assert(
    state.layoutShell.top >= state.topBar.bottom - 2 && state.layoutShell.top <= state.topBar.bottom + 40,
    `${viewport.label}/${mode.id}: workbench shell must begin under the top bar, with at most the document tab strip between (${JSON.stringify({
      topBar: state.topBar,
      layoutShell: state.layoutShell,
    })})`
  );
  assert(
    state.layoutShell.top <= 112,
    `${viewport.label}/${mode.id}: workbench starts too low in first viewport (${state.layoutShell.top}px)`
  );
  assert(
    JSON.stringify(state.stageLabels) === JSON.stringify(['project', 'design', 'verify', 'hardware', 'export']),
    `${viewport.label}/${mode.id}: stage navigation must be the one five-stage authority, got ${JSON.stringify(state.stageLabels)}`
  );
  assert(state.importIsUtility, `${viewport.label}/${mode.id}: Import must be a utility, not step 6`);
  assert(state.pageCommandHeaderCount <= 1, `${viewport.label}/${mode.id}: duplicate page command headers are visible`);
  assert(state.primaryActionCount <= 1, `${viewport.label}/${mode.id}: ${state.primaryActionCount} competing primary actions are visible`);
}


// The Design inspector dock is contextual: it opens with a selection. Click the first schematic
// node's body with a real pointer (synthetic events carry no pointer id), then wait for the inspector.
async function selectFirstDesignNode(page) {
  const node = page.locator('[data-node-id]').first();
  await node.waitFor({ state: 'visible', timeout: 10000 });
  const body = node.locator('.rb-sym-body, rect, path').first();
  const box = (await body.boundingBox().catch(() => null)) ?? (await node.boundingBox());
  assert(box, 'schematic node must have a bounding box to select');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('[data-testid="ide-design-selection-inspector"]', { timeout: 10000 });
}
async function readHierarchyState(page, mode) {
  return page.evaluate(
    ({ expectedMode, regions }) => {
      const rectJson = (rect) => rect
        ? {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
          }
        : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, visible: false };
      const firstVisibleRect = (candidateSelectors) => {
        for (const selector of candidateSelectors) {
          const element = document.querySelector(selector);
          if (!element) continue;
          const rect = element.getBoundingClientRect();
          if (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.right > 0 &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.top < window.innerHeight
          ) {
            return { selector, ...rectJson(rect) };
          }
        }
        return { selector: null, ...rectJson(null) };
      };
      const firstRenderedRect = (candidateSelectors) => {
        for (const selector of candidateSelectors) {
          const element = document.querySelector(selector);
          if (!element) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { selector, ...rectJson(rect) };
          }
        }
        return { selector: null, ...rectJson(null) };
      };
      const visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const surface = document.querySelector(`[data-ide-mode-marker="${expectedMode}"]`)
        ?? document.querySelector(`[data-testid="ide-mode-${expectedMode}"]`);
      const topBar = document.querySelector('[data-testid="ide-top-bar"]');
      const stageNav = document.querySelector('[data-testid="ide-workspace-rail"]');
      const importButton = document.querySelector('[data-testid="mode-button-import"]');

      return {
        currentMode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? expectedMode,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        topBar: rectJson(topBar?.getBoundingClientRect?.()),
        stageNav: rectJson(stageNav?.getBoundingClientRect?.()),
        mainCount: document.querySelectorAll('main').length,
        retiredRailCount: document.querySelectorAll(
          '[data-testid="ide-left-rail"], [data-testid="ide-right-rail"], .ide-left-rail, .ide-right-rail'
        ).length,
        retiredToggleCount: document.querySelectorAll(
          '[data-testid^="ide-workbench-dock-toggle-"], [data-testid*="dock-collapse"], .ide-workbench-dock-toggle-rail'
        ).length,
        proofRibbon: rectJson(document.querySelector('[data-testid="ide-proof-ribbon"]')?.getBoundingClientRect?.()),
        statusBar: rectJson(document.querySelector('[data-testid="ide-status-bar"]')?.getBoundingClientRect?.()),
        layoutShell: rectJson(document.querySelector('.ide-workbench-shell')?.getBoundingClientRect?.()),
        focal: firstVisibleRect(regions.primary),
        support: regions.support.map((selectors) => firstRenderedRect(selectors)),
        productSpineCount: Array.from(document.querySelectorAll('[data-testid^="ide-product-spine-"]')).filter(visible).length,
        stageLabels: Array.from(document.querySelectorAll('[data-testid="ide-workspace-rail"] button[data-stage]'))
          .filter(visible)
          .map((element) => element.getAttribute('data-stage') ?? ''),
        importIsUtility: Boolean(importButton && importButton.classList.contains('wb-rail-btn--utility') && !importButton.closest('[role="tablist"]')),
        pageCommandHeaderCount: surface
          ? Array.from(surface.querySelectorAll('.ide-surface-command-strip, .ide-workbench-page-header')).filter(visible).length
          : 0,
        primaryActionCount: surface
          ? Array.from(new Set(surface.querySelectorAll('.ide-button-primary, [data-product-priority="primary"]'))).filter(visible).length
          : 0,
      };
    },
    { expectedMode: mode.id, regions: { primary: mode.primary, support: mode.support } }
  );
}
