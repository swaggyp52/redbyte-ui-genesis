#!/usr/bin/env node

import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';
import { assertBuildHash } from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const WORKFLOW_MODES = ['project', 'design', 'verify', 'hardware', 'export'];
const UTILITY_MODES = ['import'];
const MODES = [...WORKFLOW_MODES, ...UTILITY_MODES];

await runIdeGate('IDE shell navigation overhaul satisfied', async ({ page, baseUrl }) => {
  const findings = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      findings.push({ type: 'console.error', text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => findings.push({ type: 'pageerror', text: error.message }));

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const failures = [];
  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=shell-navigation-overhaul-${viewport.label}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
      await assertShellChrome(page, viewport, 'fresh-project');
      await loadStarterProject(page, { exactExampleId: 'logic-gates' });
      await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });

      const activation = viewport.label === '1440x900' ? 'keyboard' : 'click';
      for (const mode of MODES) {
        await activateMode(page, mode, activation);
        await assertModeReachableAndFocused(page, viewport, mode);
      }

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
      await assertModeReachableAndFocused(page, viewport, 'import');
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForSelector('[data-testid="ide-mode-export"], [data-testid="ide-mode-import"]', { timeout: 15000 });
      const modeAfterBack = await activeMode(page);
      assert(MODES.includes(modeAfterBack), `${viewport.label}: back navigation stranded on unknown mode "${modeAfterBack}"`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(findings.length === 0, `browser console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
  assert(failures.length === 0, `shell navigation overhaul failures:\n${failures.join('\n')}`);
});

async function activateMode(page, mode, activation = 'click') {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  assert(await button.isVisible().catch(() => false), `${mode}: navigation button must be visible`);
  if (activation === 'keyboard') {
    await button.focus();
    await page.keyboard.press('Enter');
  } else {
    await button.click();
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(120);
}

async function assertShellChrome(page, viewport, label) {
  await assertBuildHash(page, `${viewport.label}/${label}`);
  const state = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { visible: false, width: 0, height: 0, top: 0, bottom: 0 };
      const bounds = element.getBoundingClientRect();
      return {
        visible: bounds.width > 1 && bounds.height > 1,
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        top: Math.round(bounds.top),
        bottom: Math.round(bounds.bottom),
      };
    };
    return {
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      topbar: rect('[data-testid="ide-top-bar"]'),
      stageNav: rect('[data-testid="ide-stage-nav"]'),
      stageTrack: rect('[data-testid="ide-stage-nav"] .ide-stage-nav'),
      ribbon: rect('[data-testid="ide-proof-ribbon"]'),
      statusBar: rect('[data-testid="ide-status-bar"]'),
      layoutShell: rect('.ide-layout-shell'),
      retiredRailCount: document.querySelectorAll(
        '[data-testid="ide-left-rail"], [data-testid="ide-right-rail"], .ide-left-rail, .ide-right-rail'
      ).length,
      retiredToggleCount: document.querySelectorAll(
        '[data-testid^="ide-workbench-dock-toggle-"], [data-testid*="dock-collapse"], .ide-workbench-dock-toggle-rail'
      ).length,
      stageLabels: Array.from(document.querySelectorAll('[data-testid="ide-stage-nav"] .ide-stage-nav-label'))
        .filter((label) => label.getBoundingClientRect().width > 1 && label.getBoundingClientRect().height > 1)
        .map((label) => label.textContent?.trim() ?? ''),
      importIsUtility: (() => {
        const topbar = document.querySelector('[data-testid="ide-top-bar"]');
        const stageNav = document.querySelector('[data-testid="ide-stage-nav"]');
        const importButton = document.querySelector('[data-testid="mode-button-import"]');
        return Boolean(importButton && topbar?.contains(importButton) && !stageNav?.contains(importButton));
      })(),
      productSpineCount: Array.from(document.querySelectorAll('[data-testid^="ide-product-spine-"]'))
        .filter((element) => element.getBoundingClientRect().width > 1 && element.getBoundingClientRect().height > 1)
        .length,
      modeButtons: Array.from(document.querySelectorAll('[data-testid^="mode-button-"]')).map((button) => ({
        testId: button.getAttribute('data-testid'),
        visible: button.getBoundingClientRect().width > 1 && button.getBoundingClientRect().height > 1,
      })),
    };
  });

  assert(state.overflowX <= 1, `${viewport.label}/${label}: root horizontal overflow ${state.overflowX}px`);
  assert(state.topbar.visible && state.topbar.height <= 56, `${viewport.label}/${label}: top bar too tall/missing ${JSON.stringify(state.topbar)}`);
  assert(!state.ribbon.visible, `${viewport.label}/${label}: proof ribbon must be retired ${JSON.stringify(state.ribbon)}`);
  assert(!state.statusBar.visible, `${viewport.label}/${label}: duplicate support footer must be retired ${JSON.stringify(state.statusBar)}`);
  assert(state.productSpineCount === 0, `${viewport.label}/${label}: duplicate page product spine is still visible`);
  assert(
    state.stageNav.visible && state.stageNav.height >= 40 && state.stageNav.height <= 60,
    `${viewport.label}/${label}: horizontal stage navigation must be readable and bounded, got ${JSON.stringify(state.stageNav)}`
  );
  assert(
    state.stageTrack.visible && state.stageTrack.width >= 620 && state.stageTrack.width <= viewport.width,
    `${viewport.label}/${label}: five-stage track must be horizontally reachable, got ${JSON.stringify(state.stageTrack)}`
  );
  assert(state.retiredRailCount === 0, `${viewport.label}/${label}: retired workflow rail returned`);
  assert(state.retiredToggleCount === 0, `${viewport.label}/${label}: retired dock restore control returned`);
  assert(
    // Rounded bounding boxes can differ by a few pixels across the two classroom viewports.
    state.layoutShell.top >= state.stageNav.bottom - 4 && state.layoutShell.top <= state.stageNav.bottom + 4,
    `${viewport.label}/${label}: workbench must begin directly under stage navigation (${JSON.stringify({
      stageNav: state.stageNav,
      layoutShell: state.layoutShell,
    })})`
  );
  assert(
    JSON.stringify(state.stageLabels) === JSON.stringify(['Project', 'Design', 'Verify', 'Map Pins', 'Export']),
    `${viewport.label}/${label}: expected one five-stage workflow, got ${JSON.stringify(state.stageLabels)}`
  );
  assert(state.importIsUtility, `${viewport.label}/${label}: Import must be a separate utility, not step 6`);
  const visibleButtonIds = new Set(state.modeButtons.filter((button) => button.visible).map((button) => button.testId));
  const missingWorkflowButtons = WORKFLOW_MODES
    .map((mode) => `mode-button-${mode}`)
    .filter((testId) => !visibleButtonIds.has(testId));
  assert(
    missingWorkflowButtons.length === 0,
    `${viewport.label}/${label}: workflow navigation buttons not all reachable ${JSON.stringify({ missingWorkflowButtons, modeButtons: state.modeButtons })}`
  );
}

async function assertModeReachableAndFocused(page, viewport, mode) {
  await assertShellChrome(page, viewport, mode);
  const state = await page.evaluate((expectedMode) => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { visible: false, width: 0, height: 0, top: 0, left: 0 };
      const bounds = element.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(window.innerWidth, bounds.right) - Math.max(0, bounds.left));
      const visibleHeight = Math.max(0, Math.min(window.innerHeight, bounds.bottom) - Math.max(0, bounds.top));
      return {
        visible: bounds.width > 1 && bounds.height > 1 && visibleWidth > 1 && visibleHeight > 1,
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        top: Math.round(bounds.top),
        left: Math.round(bounds.left),
        visibleWidth: Math.round(visibleWidth),
        visibleHeight: Math.round(visibleHeight),
      };
    };
    const primarySelectors = {
      project: ['[data-testid="ide-project-professional-overview"]'],
      design: ['[data-testid="ide-design-live-canvas"]'],
      verify: ['[data-testid="ide-verify-lab-grid"]'],
      hardware: ['[data-testid="ide-hw-map-table"]'],
      export: ['[data-testid="ide-export-package-inspector-v1"]'],
      import: ['[data-testid="ide-import-workbench"]'],
    };
    let primary = { visible: false, width: 0, height: 0, top: 0, left: 0, visibleWidth: 0, visibleHeight: 0 };
    for (const selector of primarySelectors[expectedMode] ?? []) {
      primary = rect(selector);
      if (primary.visible) break;
    }
    return {
      activeMode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? '',
      primary,
      activeButtonVisible: Boolean(document.querySelector(`[data-testid="mode-button-${expectedMode}"][data-active="true"]`)),
    };
  }, mode);

  assert(state.activeMode === mode, `${viewport.label}/${mode}: active mode marker mismatch ${JSON.stringify(state)}`);
  assert(state.activeButtonVisible, `${viewport.label}/${mode}: active navigation state is not visible`);
  assert(state.primary.visible, `${viewport.label}/${mode}: primary work object missing ${JSON.stringify(state.primary)}`);
  assert(state.primary.top < viewport.height * 0.72, `${viewport.label}/${mode}: primary work object starts too low ${JSON.stringify(state.primary)}`);
}

async function activeMode(page) {
  return page.evaluate(() => document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? '');
}
