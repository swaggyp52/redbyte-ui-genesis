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
      await assertCollapsedRail(page, 'left', { labelPattern: /\b(lib|library)\b/i });
      await assertCollapsedRail(page, 'right', { labelPattern: /\b(info|inspector)\b/i });
      await assertWorkObject(page, viewport, 'design canvas', ['[data-testid="ide-design-live-canvas"]'], {
        minVisibleWidth: Math.min(980, viewport.width * 0.72),
        minVisibleHeight: Math.min(390, viewport.height * 0.49),
        maxTop: viewport.height * 0.46,
      });
      await openRailAndAssertRecovery(page, viewport, 'design', 'left', async () => {
        await assertWorkObject(page, viewport, 'design canvas with Library open', ['[data-testid="ide-design-live-canvas"]'], {
          minVisibleWidth: Math.min(900, viewport.width * 0.64),
          minVisibleHeight: 320,
          maxTop: viewport.height * 0.5,
        });
      });
      await openRailAndAssertRecovery(page, viewport, 'design', 'right', async () => {
        await assertWorkObject(page, viewport, 'design canvas with Inspector open', ['[data-testid="ide-design-live-canvas"]'], {
          minVisibleWidth: Math.min(860, viewport.width * 0.6),
          minVisibleHeight: 320,
          maxTop: viewport.height * 0.5,
        });
      });
      await capture(page, viewport, 'design', 'collapsed');
    });

    await checkSurface(failures, page, viewport, 'verify', async () => {
      await openMode(page, baseUrl, viewport, 'verify');
      await assertNoHorizontalOverflow(page, viewport, 'verify');
      await assertCollapsedRail(page, 'left', { labelPattern: /\b(sig|signals)\b/i });
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
      await openRailAndAssertRecovery(page, viewport, 'verify', 'left', async () => {
        await assertVisiblePrimaryAction(page, viewport, 'Verify action with Signals open', [
          '[data-testid="ide-vcb-run"]',
          '[data-testid="ide-verify-run"]',
          '[data-testid="ide-verify-run-secondary"]',
          '[data-testid="ide-verify-empty-run"]',
          '[data-testid="ide-verify-stale-primary-rerun"]',
        ]);
        await assertWorkObject(
          page,
          viewport,
          'Verify testbench/workbench with Signals open',
          ['[data-testid="ide-verify-region-stimulus"]', '[data-testid="ide-verify-workbench"]'],
          {
            minVisibleWidth: Math.min(550, viewport.width * 0.38),
            minVisibleHeight: 240,
            maxTop: viewport.height * 0.54,
          }
        );
      });
      await capture(page, viewport, 'verify', 'collapsed');
    });

    await checkSurface(failures, page, viewport, 'hardware', async () => {
      await openMode(page, baseUrl, viewport, 'hardware');
      await assertNoHorizontalOverflow(page, viewport, 'hardware');
      await assertHardwareStartsAsWorkbench(page, viewport);
      await assertCollapsedRail(page, 'left', { labelPattern: /\b(map|pins)\b/i });
      await assertCollapsedRail(page, 'right', { labelPattern: /\b(info|inspector)\b/i });
      await assertHardwareWorkObject(page, viewport, 'initial');
      await openRailAndAssertRecovery(page, viewport, 'hardware', 'right', async () => {
        await assertOpenDockWidth(page, 'right', { min: 180, max: 260 });
        await assertHardwareWorkObject(page, viewport, 'right inspector open');
      });
      await openRailAndAssertRecovery(page, viewport, 'hardware', 'left', async () => {
        await assertOpenDockWidth(page, 'left', { min: 160, max: 220 });
        await assertHardwareWorkObject(page, viewport, 'Map guide open');
      });
      await capture(page, viewport, 'hardware', 'collapsed');
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
    `${viewport.label}/hardware: Map Pins support dock is open on entry; it must start collapsed so the board is the primary work object`
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
    ? Math.min(900, viewport.width * 0.66)
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
  assert(
    board.visibleWidth >= Math.min(520, viewport.width * 0.36) && board.visibleHeight >= 250,
    `hardware/${stateLabel}: board graphic is not meaningfully visible (${board.visibleWidth}x${board.visibleHeight})`
  );
}

async function assertCollapsedRail(page, side, options = {}) {
  const rail = await readRail(page, side);
  assert(rail.visible, `${side} support rail is missing or clipped`);
  assert(rail.width >= 36 && rail.width <= 52, `${side} support rail width ${rail.width}px is not targetable and compact`);
  assert(rail.tagName === 'BUTTON' && rail.focusable, `${side} support rail must be a focusable button`);
  assert(
    /\bshow\b/i.test(rail.text) || /\bshow\b/i.test(rail.ariaLabel ?? '') || /\bshow\b/i.test(rail.title ?? ''),
    `${side} support rail must clearly say it restores the dock (${JSON.stringify({
      text: rail.text,
      ariaLabel: rail.ariaLabel,
      title: rail.title,
    })})`
  );
  if (options.labelPattern) {
    assert(
      options.labelPattern.test(rail.text) || options.labelPattern.test(rail.ariaLabel ?? '') || options.labelPattern.test(rail.title ?? ''),
      `${side} support rail has the wrong label for this surface (${JSON.stringify({
        text: rail.text,
        ariaLabel: rail.ariaLabel,
        title: rail.title,
      })})`
    );
  }
  assert(
    rail.labelWithinRail && rail.hintWithinRail,
    `${side} support rail label/hint are clipped or overflowing (${JSON.stringify(rail)})`
  );
  assert(
    !/vertical/i.test(rail.labelWritingMode) && !/vertical/i.test(rail.hintWritingMode),
    `${side} support rail uses vertical text (${JSON.stringify(rail)})`
  );

  const focused = await page.locator(`[data-testid="${rail.testId}"]`).first().focus().then(() => true).catch(() => false);
  assert(focused, `${side} support rail must accept keyboard focus`);
}

async function openRailAndAssertRecovery(page, viewport, mode, side, callback) {
  const rail = page.locator(`[data-testid="ide-workbench-dock-toggle-${side}"]`).first();
  assert(await rail.isVisible().catch(() => false), `${mode}: ${side} restore rail must be visible before opening`);
  const beforeWorkspaceWidth = await readWorkspaceWidth(page);
  await rail.click();
  await page.waitForTimeout(140);
  await assertNoHorizontalOverflow(page, viewport, `${mode}/${side}-open`);
  await callback();
  await capture(page, viewport, mode, `${side}-open`);

  const collapse = page.locator(`[data-testid="ide-workbench-dock-collapse-${side}"]`).first();
  assert(await collapse.isVisible().catch(() => false), `${mode}: ${side} dock needs a visible collapse control`);
  await collapse.click();
  await page.waitForTimeout(140);

  const afterWorkspaceWidth = await readWorkspaceWidth(page);
  assert(
    afterWorkspaceWidth >= beforeWorkspaceWidth - 2,
    `${mode}: closing ${side} support dock must restore workbench width (${beforeWorkspaceWidth}px -> ${afterWorkspaceWidth}px)`
  );
  assert(
    await page.locator(`[data-testid="ide-workbench-dock-toggle-${side}"]`).first().isVisible().catch(() => false),
    `${mode}: closing ${side} support dock must restore the collapsed rail`
  );
}

async function assertOpenDockWidth(page, side, range) {
  const dockTestId = side === 'left' ? 'ide-left-dock' : 'ide-inspector';
  const state = await page.evaluate((testId) => {
    const element = document.querySelector(`[data-testid="${testId}"]`);
    if (!element) return { visible: false, width: 0, textLength: 0 };
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      visible: bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden',
      width: Math.round(bounds.width * 10) / 10,
      textLength: (element.textContent || '').replace(/\s+/g, ' ').trim().length,
    };
  }, dockTestId);
  assert(state.visible, `${side} dock did not open`);
  assert(state.textLength >= 12, `${side} dock opened without meaningful content`);
  assert(
    state.width >= range.min && state.width <= range.max,
    `${side} dock width ${state.width}px is outside ${range.min}-${range.max}px`
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

async function readWorkspaceWidth(page) {
  return page.evaluate(() => {
    const bounds = document.querySelector('[data-testid="ide-mode-body"]')?.getBoundingClientRect();
    return Math.round((bounds?.width ?? 0) * 10) / 10;
  });
}

async function readRail(page, side) {
  return page.evaluate((railSide) => {
    const element = document.querySelector(`[data-testid="ide-workbench-dock-toggle-${railSide}"]`);
    if (!element) return { visible: false, side: railSide };
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const label = element.querySelector('.ide-workbench-dock-toggle-rail-label');
    const hint = element.querySelector('.ide-workbench-dock-toggle-rail-hint');
    const labelBounds = label?.getBoundingClientRect();
    const hintBounds = hint?.getBoundingClientRect();
    const within = (inner) =>
      !inner ||
      (inner.left >= bounds.left - 1 &&
        inner.right <= bounds.right + 1 &&
        inner.top >= bounds.top - 1 &&
        inner.bottom <= bounds.bottom + 1);
    return {
      visible:
        bounds.width > 1 &&
        bounds.height > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        bounds.left >= -1 &&
        bounds.right <= window.innerWidth + 1,
      side: railSide,
      testId: `ide-workbench-dock-toggle-${railSide}`,
      tagName: element.tagName,
      focusable: !element.hasAttribute('disabled') && element.tabIndex >= 0,
      text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
      ariaLabel: element.getAttribute('aria-label'),
      title: element.getAttribute('title'),
      width: Math.round(bounds.width * 10) / 10,
      height: Math.round(bounds.height * 10) / 10,
      labelWithinRail: within(labelBounds),
      hintWithinRail: within(hintBounds),
      labelWritingMode: label ? window.getComputedStyle(label).writingMode : '',
      hintWritingMode: hint ? window.getComputedStyle(hint).writingMode : '',
    };
  }, side);
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
