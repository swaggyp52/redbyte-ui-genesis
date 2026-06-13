#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: 'classroom', width: 1366, height: 768 },
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'wide', width: 1920, height: 1080 },
];

const PRIMARY_MODES = ['project', 'design', 'verify', 'hardware', 'export'];

const FOCAL_SELECTORS = {
  project: [
    '[data-testid="ide-project-landing"]',
    '[data-testid="ide-project-panel"]',
    '[data-testid="ide-project-command-strip"]',
    '[data-testid="ide-project-workspace-grid"]',
    '[data-testid="ide-project-session"]',
    '[data-testid="ide-project-continue-cta"]',
    '[data-testid="ide-project-last-verify-status"]',
    '[data-testid="ide-project-overview"]',
  ],
  design: [
    '[data-testid="ide-design-live-canvas"]',
    '[data-testid="ide-design-canvas"]',
  ],
  verify: [
    '[data-testid="ide-verify-panel"]',
    '[data-testid="ide-verify-workbench"]',
    '[data-testid="ide-verify-lab-frame"]',
    '[data-testid="ide-verify-lab-grid"]',
    '[data-testid="ide-verify-three-panel"]',
    '[data-testid="ide-verify-testbench-summary"]',
    '[data-testid="ide-verify-workspace-waveform"]',
    '[data-testid="ide-verify-session-hero"]',
    '[data-testid="ide-stimulus-canvas"]',
    '[data-testid="ide-verify-workstation-run-bar"]',
  ],
  hardware: [
    '[data-testid="ide-hardware-panel"]',
    '[data-testid="ide-hw-map-table"]',
    '[data-testid="ide-hw-map-board"]',
  ],
  export: [
    '[data-testid="ide-export-panel"]',
    '[data-testid="ide-export-handoff-summary"]',
    '[data-testid="ide-export-rebuild-btn"]',
    '[data-testid="ide-export-generated-previews"]',
    '[data-testid="ide-export-artifact-preview"]',
  ],
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
  const state = await readShellModeState(page, mode);

  assert(state.currentMode === mode, `${viewport.label}/${mode}: expected active mode ${mode}, got ${state.currentMode}`);
  assert(
    state.scrollWidth <= state.clientWidth,
    `${viewport.label}/${mode}: horizontal overflow ${state.scrollWidth} > ${state.clientWidth}`
  );
  assert(state.topBar.visible, `${viewport.label}/${mode}: top bar missing`);
  assert(state.leftRail.visible, `${viewport.label}/${mode}: left rail missing`);
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
  assert(
    state.leftRail.right <= state.focal.left + 12 || mode === 'project',
    `${viewport.label}/${mode}: left rail appears to obscure focal object (${JSON.stringify({
      leftRail: state.leftRail,
      focal: state.focal,
    })})`
  );

  if (mode === 'design') {
    assert(state.designNodeCount >= 3, `${viewport.label}/design: rendered graph lost nodes (${state.designNodeCount})`);
    assert(state.designVisibleNodeCount >= 3, `${viewport.label}/design: graph nodes not visible (${state.designVisibleNodeCount})`);
  }
}

async function readShellModeState(page, mode) {
  return page.evaluate(
    ({ expectedMode, focalSelectors }) => {
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
        leftRail: rectJson(document.querySelector('[data-testid="ide-left-rail"]')?.getBoundingClientRect?.()),
        modeRoot: rectJson(document.querySelector(`[data-testid="ide-mode-${expectedMode}"]`)?.getBoundingClientRect?.()),
        focal: firstVisibleRect(focalSelectors),
        designNodeCount: nodes.length,
        designVisibleNodeCount: visibleNodes,
      };
    },
    { expectedMode: mode, focalSelectors: FOCAL_SELECTORS[mode] }
  );
}
