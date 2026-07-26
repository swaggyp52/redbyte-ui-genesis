#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const MODES = [
  {
    id: 'project',
    focalSelectors: [
      '[data-testid="ide-project-command-center"]',
      '[data-testid="ide-project-workspace-grid"]',
      '[data-testid="ide-project-landing"]',
    ],
  },
  {
    id: 'design',
    focalSelectors: ['[data-testid="ide-design-live-canvas"]', '[data-testid="ide-design-canvas"]'],
  },
  {
    id: 'verify',
    requiresStarter: true,
    focalSelectors: [
      '[data-testid="ide-verify-no-circuit-task"]',
      '[data-testid="ide-verify-region-waveform"]',
      '[data-testid="ide-verify-workbench"]',
      '[data-testid="ide-verify-workstation-run-bar"]',
    ],
  },
  {
    id: 'hardware',
    focalSelectors: [
      '[data-testid="ide-hw-board-workspace"]',
      '[data-testid="ide-hw-map-board"]',
      '[data-testid="ide-hw-map-table"]',
    ],
  },
  {
    id: 'export',
    focalSelectors: [
      '[data-testid="ide-export-handoff-station"]',
      '[data-testid="ide-export-handoff-summary"]',
      '[data-testid="ide-export-panel"]',
    ],
  },
  {
    id: 'import',
    routeOnly: true,
    focalSelectors: [
      '[data-testid="ide-import-workbench"]',
      '[data-testid="ide-import-zip-dropzone"]',
    ],
  },
];

const SCREENSHOT_ROOT = process.env.RB_SIDE_DOCK_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_SIDE_DOCK_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE side dock affordance satisfied', async ({ page, baseUrl }) => {
  const failures = [];
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
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFreshStarterProject(page, baseUrl, viewport);

    for (const mode of MODES) {
      if (mode.requiresStarter === true) {
        await openFreshStarterProject(page, baseUrl, viewport);
      }
      await openMode(page, baseUrl, mode.id, mode.routeOnly === true);
      await capture(page, viewport, mode.id, 'initial');

      await checkSurface(failures, page, viewport, mode, async () => {
        await assertNoHorizontalOverflow(page, viewport, mode.id);
        await assertFocalWorkbenchVisible(page, viewport, mode);
        await assertStableSupportRegions(page, viewport, mode.id);
      });
    }
  }

  assert(
    consoleFindings.length === 0,
    `Side dock affordance emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
  assert(failures.length === 0, `Side dock affordance failures:\n${failures.join('\n')}`);
});

async function openFreshStarterProject(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=side-dock-affordance-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
}

async function openMode(page, baseUrl, mode, routeOnly) {
  if (mode === 'project' || routeOnly) {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&gate=side-dock-affordance-${mode}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    return;
  }

  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&gate=side-dock-affordance-${mode}`, {
      waitUntil: 'domcontentloaded',
    });
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(100);
}

async function checkSurface(failures, page, viewport, mode, callback) {
  try {
    await callback();
  } catch (error) {
    failures.push(`${viewport.label}/${mode.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function assertStableSupportRegions(page, viewport, mode) {
  const state = await page.evaluate(() => {
    const region = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return { present: false, visible: false, width: 0, textLength: 0 };
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        present: true,
        visible: bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden',
        width: Math.round(bounds.width * 10) / 10,
        textLength: (element.textContent || '').replace(/\s+/g, ' ').trim().length,
      };
    };
    const visibleControlCount = (selectors) =>
      selectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
        }).length;

    return {
      leftDock: region('[data-testid="ide-left-dock"]'),
      rightDock: region('[data-testid="ide-right-dock"]'),
      designPalette: region('[data-testid="ide-design-dock-palette"]'),
      genericRailControls: visibleControlCount([
        '[data-testid="ide-workbench-dock-toggle-left"]',
        '[data-testid="ide-workbench-dock-toggle-right"]',
        '[data-testid="ide-workbench-dock-collapse-left"]',
        '[data-testid="ide-workbench-dock-collapse-right"]',
        '[data-testid="ide-design-library-collapse"]',
      ]),
    };
  });

  assert(
    state.genericRailControls === 0,
    `${viewport.label}/${mode}: retired dock Hide/Show rails must stay absent (${state.genericRailControls} visible)`
  );

  if (mode === 'design') {
    assert(state.leftDock.visible && state.designPalette.visible, `${viewport.label}: Design Library must remain directly available`);
    assert(
      state.leftDock.width >= 180 && state.leftDock.width <= 240,
      `${viewport.label}: Design Library must be readable but bounded (${state.leftDock.width}px)`
    );
    assert(state.designPalette.textLength >= 12, `${viewport.label}: Design Library must expose meaningful tools`);
    assert(state.rightDock.visible, `${viewport.label}: Design Inspector must remain directly available`);
    assert(
      state.rightDock.width >= 220 && state.rightDock.width <= 300,
      `${viewport.label}: Design Inspector must be useful without dominating the canvas (${state.rightDock.width}px)`
    );
    assert(state.rightDock.textLength >= 12, `${viewport.label}: Design Inspector must expose meaningful controls`);
  }

  if (mode === 'verify') {
    assert(state.leftDock.visible, `${viewport.label}: Verify Signals must remain directly available`);
    assert(
      state.leftDock.width >= 160 && state.leftDock.width <= 320,
      `${viewport.label}: Verify Signals must be readable but bounded (${state.leftDock.width}px)`
    );
    assert(state.leftDock.textLength >= 12, `${viewport.label}: Verify Signals must expose meaningful controls`);
  }
}

async function assertFocalWorkbenchVisible(page, viewport, mode) {
  const rect = await firstVisibleRect(page, mode.focalSelectors);
  assert(rect.visible, `${mode.id}: focal workbench object must be visible`);
  assert(
    rect.visibleWidth >= Math.min(480, viewport.width * 0.34),
    `${mode.id}: focal object is too narrow (${rect.visibleWidth}px)`
  );
  assert(
    rect.visibleHeight >= 80,
    `${mode.id}: focal object is too short or clipped (${rect.visibleHeight}px)`
  );
  assert(
    rect.top < viewport.height - 56,
    `${mode.id}: focal object starts below the useful first viewport (${rect.top}px)`
  );
}

async function assertNoHorizontalOverflow(page, viewport, label) {
  const overflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  assert(overflow <= 1, `${viewport.label}/${label}: horizontal root overflow ${overflow}px`);
}

async function firstVisibleRect(page, selectors) {
  return page.evaluate((candidateSelectors) => {
    const rectJson = (bounds, selector = null) => {
      const visibleLeft = Math.max(0, bounds.left);
      const visibleTop = Math.max(0, bounds.top);
      const visibleRight = Math.min(window.innerWidth, bounds.right);
      const visibleBottom = Math.min(window.innerHeight, bounds.bottom);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      return {
        selector,
        left: Math.round(bounds.left * 10) / 10,
        top: Math.round(bounds.top * 10) / 10,
        right: Math.round(bounds.right * 10) / 10,
        bottom: Math.round(bounds.bottom * 10) / 10,
        width: Math.round(bounds.width * 10) / 10,
        height: Math.round(bounds.height * 10) / 10,
        visibleWidth: Math.round(visibleWidth * 10) / 10,
        visibleHeight: Math.round(visibleHeight * 10) / 10,
        visible: bounds.width > 1 && bounds.height > 1 && visibleWidth > 1 && visibleHeight > 1,
      };
    };

    for (const selector of candidateSelectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const rect = rectJson(bounds, selector);
      if (rect.visible && style.display !== 'none' && style.visibility !== 'hidden') return rect;
    }
    return rectJson(new DOMRect(0, 0, 0, 0));
  }, selectors);
}

async function capture(page, viewport, mode, state) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${viewport.label}-${mode}-${state}.png`),
    fullPage: false,
  });
}
