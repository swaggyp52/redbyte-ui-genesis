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
    focalSelectors: [
      '[data-testid="ide-project-landing"]',
      '[data-testid="ide-project-command-strip"]',
      '[data-testid="ide-project-workspace-grid"]',
      '[data-testid="ide-project-continue-cta"]',
      '[data-testid="ide-project-overview"]',
    ],
  },
  {
    id: 'design',
    focalSelectors: [
      '[data-testid="ide-design-live-canvas"]',
      '[data-testid="ide-design-canvas"]',
    ],
  },
  {
    id: 'verify',
    focalSelectors: [
      '[data-testid="ide-verify-workbench"]',
      '[data-testid="ide-verify-panel"]',
      '[data-testid="ide-verify-workspace-waveform"]',
      '[data-testid="ide-verify-workstation-run-bar"]',
    ],
  },
  {
    id: 'hardware',
    focalSelectors: [
      '[data-testid="ide-hw-map-table"]',
      '[data-testid="ide-hw-map-board"]',
      '[data-testid="ide-hardware-panel"]',
    ],
  },
  {
    id: 'export',
    focalSelectors: [
      '[data-testid="ide-export-panel"]',
      '[data-testid="ide-export-handoff-summary"]',
      '[data-testid="ide-export-rebuild-btn"]',
      '[data-testid="ide-export-generated-previews"]',
    ],
  },
  {
    id: 'import',
    routeOnly: true,
    focalSelectors: [
      '[data-testid="ide-import-workspace"]',
      '[data-testid="ide-mode-import"]',
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
  const state = await readHierarchyState(page, mode.id, mode.focalSelectors);

  assert(state.currentMode === mode.id, `${viewport.label}/${mode.id}: expected mode ${mode.id}, got ${state.currentMode}`);
  assert(
    state.documentWidth <= viewport.width + 2,
    `${viewport.label}/${mode.id}: horizontal root overflow ${state.documentWidth} > ${viewport.width}`
  );
  assert(state.topBar.visible, `${viewport.label}/${mode.id}: top bar missing`);
  assert(state.leftRail.visible, `${viewport.label}/${mode.id}: left rail missing`);
  assert(state.layoutShell.visible, `${viewport.label}/${mode.id}: workbench shell missing`);
  assert(state.focal.visible, `${viewport.label}/${mode.id}: focal work object missing ${JSON.stringify(state.focal)}`);
  assert(!state.proofRibbon.visible, `${viewport.label}/${mode.id}: retired proof ribbon is still visible`);
  assert(!state.statusBar.visible, `${viewport.label}/${mode.id}: retired support footer is still visible`);
  assert(state.productSpineCount === 0, `${viewport.label}/${mode.id}: duplicate page product spine is visible`);
  assert(
    state.layoutShell.top <= state.topBar.bottom + 2,
    `${viewport.label}/${mode.id}: workbench shell must begin under the top bar (${JSON.stringify(state.layoutShell)})`
  );
  assert(
    state.layoutShell.top <= 58,
    `${viewport.label}/${mode.id}: workbench starts too low in first viewport (${state.layoutShell.top}px)`
  );
  assert(
    JSON.stringify(state.railStepLabels) === JSON.stringify(['Project', 'Design', 'Verify', 'Map Pins', 'Export']),
    `${viewport.label}/${mode.id}: rail must be the one five-stage authority, got ${JSON.stringify(state.railStepLabels)}`
  );
  assert(state.importIsUtility, `${viewport.label}/${mode.id}: Import must be a utility, not step 6`);
  assert(state.pageCommandHeaderCount <= 1, `${viewport.label}/${mode.id}: duplicate page command headers are visible`);
  assert(state.primaryActionCount <= 1, `${viewport.label}/${mode.id}: ${state.primaryActionCount} competing primary actions are visible`);
}

async function readHierarchyState(page, mode, focalSelectors) {
  return page.evaluate(
    ({ expectedMode, selectors }) => {
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
      const visible = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const surface = document.querySelector(`[data-ide-mode-marker="${expectedMode}"]`)
        ?? document.querySelector(`[data-testid="ide-mode-${expectedMode}"]`);

      return {
        currentMode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? expectedMode,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        topBar: rectJson(document.querySelector('[data-testid="ide-top-bar"]')?.getBoundingClientRect?.()),
        proofRibbon: rectJson(document.querySelector('[data-testid="ide-proof-ribbon"]')?.getBoundingClientRect?.()),
        leftRail: rectJson(document.querySelector('[data-testid="ide-left-rail"]')?.getBoundingClientRect?.()),
        statusBar: rectJson(document.querySelector('[data-testid="ide-status-bar"]')?.getBoundingClientRect?.()),
        layoutShell: rectJson(document.querySelector('.ide-layout-shell')?.getBoundingClientRect?.()),
        focal: firstVisibleRect(selectors),
        productSpineCount: Array.from(document.querySelectorAll('[data-testid^="ide-product-spine-"]')).filter(visible).length,
        railStepLabels: Array.from(document.querySelectorAll('.ide-mode-button--step .ide-mode-label'))
          .filter(visible)
          .map((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
        importIsUtility: Boolean(document.querySelector('[data-testid="mode-button-import"].ide-mode-button--utility')),
        pageCommandHeaderCount: surface
          ? Array.from(surface.querySelectorAll('.ide-surface-command-strip, .ide-workbench-page-header')).filter(visible).length
          : 0,
        primaryActionCount: surface
          ? Array.from(new Set(surface.querySelectorAll('.ide-button-primary, [data-product-priority="primary"]'))).filter(visible).length
          : 0,
      };
    },
    { expectedMode: mode, selectors: focalSelectors }
  );
}
