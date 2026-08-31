#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: 'classroom', width: 1366, height: 768 },
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'wide', width: 1920, height: 1080 },
];

const PRIMARY_MODES = ['project', 'design', 'verify', 'hardware', 'export'];

const MODE_REGIONS = {
  project: {
    primary: ['[data-testid="ide-project-professional-overview"]'],
    support: [
      ['[data-testid="ide-project-professional-facts"]'],
      ['[data-testid="ide-project-workspace-grid"]'],
    ],
  },
  design: {
    primary: ['[data-testid="ide-design-live-canvas"]'],
    support: [
      ['[data-testid="ide-design-dock-palette"]'],
      ['[data-testid="ide-design-toolbar"]'],
    ],
  },
  verify: {
    primary: ['[data-testid="ide-verify-lab-grid"]'],
    support: [
      ['[data-testid="ide-verify-signal-shelf"]'],
      ['[data-testid="ide-verify-region-stimulus"]', '[data-testid="ide-verify-no-circuit-task"]'],
    ],
  },
  hardware: {
    primary: ['[data-testid="ide-hw-map-table"]'],
    support: [
      ['[data-testid="ide-hw-selected-mapping-editor"]'],
      ['[data-testid="ide-hw-map-board"]'],
    ],
  },
  export: {
    primary: ['[data-testid="ide-export-package-inspector-v1"]'],
    support: [
      ['[data-testid="ide-export-upstream-readiness"]'],
      ['[data-testid="ide-export-package-files"]'],
    ],
  },
};

await runIdeGate('IDE shell layout integrity satisfied', async ({ page, baseUrl }) => {
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
    await page.waitForTimeout(250);

    for (const mode of PRIMARY_MODES) {
      await page.locator(`[data-testid="mode-button-${mode}"]`).click();
      await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
      await page.waitForTimeout(150);
      await assertShellModeIntegrity(page, viewport, mode);
    }
  }

  assert(
    consoleFindings.length === 0,
    `Shell layout emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
});

async function assertShellModeIntegrity(page, viewport, mode) {
  if (mode === 'design') {
    await clearDesignSelection(page);
  }
  const state = await readShellModeState(page, mode);

  assert(state.currentMode === mode, `${viewport.label}/${mode}: expected active mode ${mode}, got ${state.currentMode}`);
  assert(
    state.scrollWidth <= state.clientWidth,
    `${viewport.label}/${mode}: horizontal overflow ${state.scrollWidth} > ${state.clientWidth}`
  );
  assert(state.topBar.visible, `${viewport.label}/${mode}: top bar missing`);
  assert(state.stageNav.visible, `${viewport.label}/${mode}: stage navigation missing`);
  assert(state.mainCount === 1, `${viewport.label}/${mode}: expected one main landmark, got ${state.mainCount}`);
  assert(state.retiredRailCount === 0, `${viewport.label}/${mode}: retired workflow rail returned`);
  assert(state.retiredToggleCount === 0, `${viewport.label}/${mode}: retired dock toggle returned`);
  assert(state.contextualDockViolationCount === 0, `${viewport.label}/${mode}: empty or retired support dock returned`);
  assert(
    state.modeRoot.visible && state.modeRoot.width > 240 && state.modeRoot.height > 180,
    `${viewport.label}/${mode}: mode root collapsed ${JSON.stringify(state.modeRoot)}`
  );
  assert(
    state.focal.visible && state.focal.width > 180 && state.focal.height > 80,
    `${viewport.label}/${mode}: primary focal object missing/collapsed ${JSON.stringify(state.focal)}`
  );
  assert(
    state.focal.left < viewport.width && state.focal.top < viewport.height,
    `${viewport.label}/${mode}: primary focal object starts outside first viewport ${JSON.stringify(state.focal)}`
  );
  state.support.forEach((region, index) => {
    assert(
      region.visible && region.width > 120 && region.height > 48,
      `${viewport.label}/${mode}: direct support region ${index + 1} missing/collapsed ${JSON.stringify(region)}`
    );
  });

  if (mode === 'design') {
    assert(state.designNodeCount >= 3, `${viewport.label}/design: rendered graph lost nodes (${state.designNodeCount})`);
    assert(state.designVisibleNodeCount >= 3, `${viewport.label}/design: graph nodes not visible (${state.designVisibleNodeCount})`);
  }
}

async function clearDesignSelection(page) {
  const canvas = await page.locator('[data-testid="ide-design-live-canvas"]').first().boundingBox();
  assert(canvas, 'Design canvas must be visible before clearing contextual selection');
  await page.mouse.click(canvas.x + 12, canvas.y + 12);
  await page.waitForFunction(() => {
    const selection = window.__RB_LOGIC_VIEW_STORE__?.getState?.()?.selection;
    return (selection?.nodes?.size ?? 0) === 0 && (selection?.wires?.size ?? 0) === 0;
  });
}

async function readShellModeState(page, mode) {
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
      const firstVisibleRect = (selectors) => {
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        const viewportHeight = window.innerHeight;
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (!element) continue;
          const rect = element.getBoundingClientRect();
          const intersectsViewport =
            rect.width > 0 &&
            rect.height > 0 &&
            rect.right > 0 &&
            rect.bottom > 0 &&
            rect.left < viewportWidth &&
            rect.top < viewportHeight;
          if (intersectsViewport) {
            return { selector, ...rectJson(rect) };
          }
        }
        return { selector: null, ...rectJson(null) };
      };
      const firstRenderedRect = (selectors) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (!element) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return { selector, ...rectJson(rect) };
          }
        }
        return { selector: null, ...rectJson(null) };
      };
      const intersects = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
      const canvas = document.querySelector('[data-testid="ide-design-live-canvas"]');
      const canvasRect = canvas?.getBoundingClientRect();
      const nodes = Array.from(document.querySelectorAll('[data-node-id]'));
      const visibleNodes = canvasRect
        ? nodes.filter((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width > 4 && rect.height > 4 && intersects(rect, canvasRect);
          }).length
        : 0;

      return {
        currentMode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        topBar: rectJson(document.querySelector('[data-testid="ide-top-bar"]')?.getBoundingClientRect?.()),
        stageNav: rectJson(document.querySelector('[data-testid="ide-stage-nav"]')?.getBoundingClientRect?.()),
        mainCount: document.querySelectorAll('main').length,
        retiredRailCount: document.querySelectorAll(
          '[data-testid="ide-left-rail"], [data-testid="ide-right-rail"], .ide-left-rail, .ide-right-rail'
        ).length,
        retiredToggleCount: document.querySelectorAll(
          '[data-testid^="ide-workbench-dock-toggle-"], [data-testid*="dock-collapse"], .ide-workbench-dock-toggle-rail'
        ).length,
        contextualDockViolationCount: (() => {
          if (expectedMode === 'verify') {
            return document.querySelectorAll('[data-testid="ide-left-dock"]').length;
          }
          if (expectedMode !== 'design') return 0;
          const dock = document.querySelector('[data-testid="ide-right-dock"]');
          if (!dock) return 0;
          const contextualContent = dock.querySelector(
            '[data-testid="ide-design-selection-inspector"], ' +
            '[data-testid="ide-design-multiselect-summary"], ' +
            '[data-testid="ide-design-focus-inspector"], ' +
            '[data-testid="ide-design-context-inspector"]'
          );
          const idleDefault = dock.querySelector('[data-testid="ide-design-inspector-canvas-default"]');
          return contextualContent && !idleDefault ? 0 : 1;
        })(),
        modeRoot: rectJson(document.querySelector(`[data-testid="ide-mode-${expectedMode}"]`)?.getBoundingClientRect?.()),
        focal: firstVisibleRect(regions.primary),
        support: regions.support.map((selectors) => firstRenderedRect(selectors)),
        designNodeCount: nodes.length,
        designVisibleNodeCount: visibleNodes,
      };
    },
    { expectedMode: mode, regions: MODE_REGIONS[mode] }
  );
}
