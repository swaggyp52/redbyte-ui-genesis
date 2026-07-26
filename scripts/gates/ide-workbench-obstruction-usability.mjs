#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const SCREENSHOT_ROOT = process.env.RB_WORKBENCH_OBSTRUCTION_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_WORKBENCH_OBSTRUCTION_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE workbench obstruction usability satisfied', async ({ page, baseUrl }) => {
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

    await checkSurface(failures, page, viewport, 'design', async () => {
      await openMode(page, baseUrl, viewport, 'design');
      await assertNoHorizontalOverflow(page, viewport, 'design');
      await assertNoRetiredRails(page, viewport, 'design');
      await assertStableDock(page, viewport, 'design', 'left', { min: 180, max: 240 });
      await assertStableDock(page, viewport, 'design', 'right', { min: 220, max: 300 });
      await assertWorkObject(page, viewport, 'design canvas', ['[data-testid="ide-design-live-canvas"]'], {
        minVisibleWidth: Math.min(820, viewport.width * 0.6),
        minVisibleHeight: Math.min(390, viewport.height * 0.49),
        maxTop: viewport.height * 0.46,
      });
      await capture(page, viewport, 'design', 'stable-support');
    });

    await checkSurface(failures, page, viewport, 'verify', async () => {
      await openMode(page, baseUrl, viewport, 'verify');
      await assertNoHorizontalOverflow(page, viewport, 'verify');
      await assertNoRetiredRails(page, viewport, 'verify');
      await assertStableDock(page, viewport, 'verify', 'left', { min: 160, max: 320 });
      await assertVisiblePrimaryAction(page, viewport, 'Verify primary compare action', [
        '[data-testid="ide-vcb-run"]',
        '[data-testid="ide-verify-run"]',
        '[data-testid="ide-verify-run-secondary"]',
        '[data-testid="ide-verify-empty-run"]',
        '[data-testid="ide-verify-stale-primary-rerun"]',
      ]);
      await assertWorkObject(
        page,
        viewport,
        'Verify testbench/workbench',
        ['[data-testid="ide-verify-region-stimulus"]', '[data-testid="ide-verify-workbench"]'],
        {
          minVisibleWidth: Math.min(610, viewport.width * 0.43),
          minVisibleHeight: 240,
          maxTop: viewport.height * 0.52,
        }
      );
      await capture(page, viewport, 'verify', 'stable-support');
    });

    await checkSurface(failures, page, viewport, 'hardware', async () => {
      await openMode(page, baseUrl, viewport, 'hardware');
      await assertNoHorizontalOverflow(page, viewport, 'hardware');
      await assertHardwareStartsAsWorkbench(page, viewport);
      await assertNoRetiredRails(page, viewport, 'hardware');
      await assertHardwareWorkObject(page, viewport, 'initial');
      await capture(page, viewport, 'hardware', 'direct-workbench');
    });
  }

  assert(
    consoleFindings.length === 0,
    `Workbench obstruction gate emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
  assert(failures.length === 0, `Workbench obstruction usability failures:\n${failures.join('\n')}`);
});

async function openFreshStarterProject(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=workbench-obstruction-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
}

async function openMode(page, baseUrl, viewport, mode) {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&gate=workbench-obstruction-${viewport.label}-${mode}`, {
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
    failures.push(`${viewport.label}/${mode}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function assertHardwareStartsAsWorkbench(page, viewport) {
  const state = await page.evaluate(() => {
    const leftDock = document.querySelector('[data-testid="ide-left-dock"]');
    const leftDockBounds = leftDock?.getBoundingClientRect();
    const leftDockStyle = leftDock ? window.getComputedStyle(leftDock) : null;
    return {
      leftDockVisible:
        !!leftDockBounds &&
        leftDockBounds.width > 1 &&
        leftDockBounds.height > 1 &&
        leftDockStyle?.display !== 'none' &&
        leftDockStyle?.visibility !== 'hidden',
    };
  });
  assert(
    !state.leftDockVisible,
    `${viewport.label}/hardware: Map Pins support dock is open on entry; it must start collapsed so the mapping table remains the primary work object`
  );
}

async function assertHardwareWorkObject(page, viewport, stateLabel) {
  const workspace = await readFirstVisibleRect(page, ['[data-testid="ide-hw-board-workspace"]']);
  const table = await readFirstVisibleRect(page, ['[data-testid="ide-hw-map-table"]']);
  const board = await readFirstVisibleRect(page, [
    '[data-testid="ide-hw-map-board"]',
    '[data-testid="ide-hw-board-workspace"] svg',
    '[data-hierarchy-focal="basys3-board-workbench"]',
  ]);
  const isOpenSupportState = /open/i.test(stateLabel);
  const minWorkspaceWidth = isOpenSupportState
    ? Math.min(880, viewport.width * 0.65)
    : Math.min(1000, viewport.width * 0.72);

  assert(workspace.visible, `hardware/${stateLabel}: board workspace is not visible`);
  assert(table.visible, `hardware/${stateLabel}: mapping table is not visible`);
  assert(board.visible, `hardware/${stateLabel}: Basys3 board view is not visible`);
  assert(
    workspace.visibleWidth >= minWorkspaceWidth,
    `hardware/${stateLabel}: board workspace is too narrow (${workspace.visibleWidth}px)`
  );
  assert(
    workspace.visibleHeight >= Math.min(420, viewport.height * 0.54),
    `hardware/${stateLabel}: board workspace is too short or clipped (${workspace.visibleHeight}px)`
  );
  assert(
    workspace.top <= Math.min(350, viewport.height * 0.46),
    `hardware/${stateLabel}: board workspace starts too low (${workspace.top}px)`
  );
  assert(
    table.visibleWidth >= 300 && table.visibleHeight >= 220,
    `hardware/${stateLabel}: mapping table is not meaningfully visible (${table.visibleWidth}x${table.visibleHeight})`
  );
  const minBoardWidth = Math.min(320, viewport.width * 0.23);
  assert(
    board.visibleWidth >= minBoardWidth && board.visibleHeight >= 250,
    `hardware/${stateLabel}: secondary board reference is not meaningfully visible (${board.visibleWidth}x${board.visibleHeight})`
  );
}

async function assertNoRetiredRails(page, viewport, mode) {
  const visibleCount = await page.evaluate(() =>
    [
      '[data-testid="ide-workbench-dock-toggle-left"]',
      '[data-testid="ide-workbench-dock-toggle-right"]',
      '[data-testid="ide-workbench-dock-collapse-left"]',
      '[data-testid="ide-workbench-dock-collapse-right"]',
      '[data-testid="ide-design-library-collapse"]',
    ].flatMap((selector) => Array.from(document.querySelectorAll(selector))).filter((element) => {
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
    }).length
  );
  assert(
    visibleCount === 0,
    `${viewport.label}/${mode}: retired Hide/Show rail controls obstruct the stable workbench (${visibleCount} visible)`
  );
}

async function assertStableDock(page, viewport, mode, side, range) {
  const testId = side === 'left' ? 'ide-left-dock' : 'ide-right-dock';
  const state = await page.evaluate((dockTestId) => {
    const element = document.querySelector(`[data-testid="${dockTestId}"]`);
    if (!element) return { visible: false, width: 0, textLength: 0 };
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      visible: bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden',
      width: Math.round(bounds.width * 10) / 10,
      textLength: (element.textContent || '').replace(/\s+/g, ' ').trim().length,
    };
  }, testId);
  assert(state.visible, `${viewport.label}/${mode}: stable ${side} support region is missing`);
  assert(state.textLength >= 12, `${viewport.label}/${mode}: stable ${side} support region has no meaningful tools`);
  assert(
    state.width >= range.min && state.width <= range.max,
    `${viewport.label}/${mode}: stable ${side} support width ${state.width}px is outside ${range.min}-${range.max}px`
  );
}

async function assertVisiblePrimaryAction(page, viewport, label, selectors) {
  const rect = await readFirstVisibleRect(page, selectors);
  assert(rect.visible, `${label} is not visible`);
  assert(rect.visibleWidth >= 64 && rect.visibleHeight >= 24, `${label} is too small (${rect.visibleWidth}x${rect.visibleHeight})`);
  assert(rect.top < viewport.height * 0.62, `${label} is too low in the first viewport (${rect.top}px)`);
}

async function assertWorkObject(page, viewport, label, selectors, thresholds) {
  const rect = await readFirstVisibleRect(page, selectors);
  assert(rect.visible, `${label} is not visible`);
  assert(rect.visibleWidth >= thresholds.minVisibleWidth, `${label} is too narrow (${rect.visibleWidth}px)`);
  assert(rect.visibleHeight >= thresholds.minVisibleHeight, `${label} is too short or clipped (${rect.visibleHeight}px)`);
  assert(rect.top <= thresholds.maxTop, `${label} starts too low (${rect.top}px)`);
}

async function assertNoHorizontalOverflow(page, viewport, label) {
  const overflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  assert(overflow <= 1, `${viewport.label}/${label}: horizontal root overflow ${overflow}px`);
}

async function readFirstVisibleRect(page, selectors) {
  return page.evaluate((candidateSelectors) => {
    const empty = () => ({
      selector: null,
      visible: false,
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      visibleWidth: 0,
      visibleHeight: 0,
    });
    const toRect = (element, selector) => {
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visibleLeft = Math.max(0, bounds.left);
      const visibleTop = Math.max(0, bounds.top);
      const visibleRight = Math.min(window.innerWidth, bounds.right);
      const visibleBottom = Math.min(window.innerHeight, bounds.bottom);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      return {
        selector,
        visible:
          bounds.width > 1 &&
          bounds.height > 1 &&
          visibleWidth > 1 &&
          visibleHeight > 1 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden',
        left: Math.round(bounds.left * 10) / 10,
        top: Math.round(bounds.top * 10) / 10,
        width: Math.round(bounds.width * 10) / 10,
        height: Math.round(bounds.height * 10) / 10,
        visibleWidth: Math.round(visibleWidth * 10) / 10,
        visibleHeight: Math.round(visibleHeight * 10) / 10,
      };
    };

    for (const selector of candidateSelectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const rect = toRect(element, selector);
      if (rect.visible) return rect;
    }
    return empty();
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
