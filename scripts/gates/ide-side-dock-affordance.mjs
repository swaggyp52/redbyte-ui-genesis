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
      '[data-testid="ide-import-start-shell"]',
      '[data-testid="ide-import-workspace"]',
      '[data-testid="ide-mode-import"]',
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
        await assertCollapsedRails(page, viewport, mode.id);
        await assertOpenCloseRecovery(page, viewport, mode.id);
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

async function assertCollapsedRails(page, viewport, mode) {
  if (mode === 'design') {
    const openLibrary = page.locator('[data-testid="ide-design-dock-palette"]').first();
    assert(await openLibrary.isVisible().catch(() => false), `${viewport.label}: Design Library must be open on entry`);
    const hideLibrary = page.locator('[data-testid="ide-design-library-collapse"]').first();
    assert(await hideLibrary.isVisible().catch(() => false), `${viewport.label}: open Design Library must expose Hide`);
    await hideLibrary.click();
    await page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first().waitFor({ state: 'visible', timeout: 5000 });
  }
  const rails = await readRailState(page);
  for (const rail of rails.filter((candidate) => candidate.visible)) {
    assert(
      rail.width <= 52,
      `${mode}: collapsed ${rail.side} dock rail consumes ${rail.width}px; expected <=52px`
    );
    assert(
      rail.width >= 36,
      `${mode}: collapsed ${rail.side} dock rail is too small to target (${rail.width}px)`
    );
    assert(
      rail.tagName === 'BUTTON' && rail.focusable,
      `${mode}: collapsed ${rail.side} dock rail must be a focusable button`
    );
    assert(
      /\bshow\b/i.test(rail.text) || /\bshow\b/i.test(rail.ariaLabel ?? '') || /\bshow\b/i.test(rail.title ?? ''),
      `${mode}: collapsed ${rail.side} dock rail must clearly say it restores the dock (${JSON.stringify({
        text: rail.text,
        ariaLabel: rail.ariaLabel,
        title: rail.title,
      })})`
    );
    assert(
      !isVerticalWritingMode(rail.labelWritingMode) && !isVerticalWritingMode(rail.hintWritingMode),
      `${mode}: collapsed ${rail.side} dock label uses awkward vertical text (${JSON.stringify({
        text: rail.text,
        labelWritingMode: rail.labelWritingMode,
        hintWritingMode: rail.hintWritingMode,
      })})`
    );
    assert(
      rail.labelVisibleWidth > 0 && rail.labelVisibleHeight > 0,
      `${mode}: collapsed ${rail.side} dock readable label is clipped`
    );
    assert(
      rail.labelWithinRail && rail.hintWithinRail,
      `${mode}: collapsed ${rail.side} dock label/hint must stay inside the rail button`
    );

    const focused = await focusRail(page, rail.testId);
    assert(focused, `${mode}: collapsed ${rail.side} dock rail must accept keyboard focus`);
  }

  if (mode === 'design') {
    assert(rails.some((rail) => rail.side === 'left' && rail.visible), `${viewport.label}: Design Library restore rail missing`);
    assert(
      rails.some((rail) => rail.side === 'right' && rail.visible),
      `${viewport.label}: Design Inspector restore rail missing`
    );
  }
  if (mode === 'verify') {
    assert(rails.some((rail) => rail.side === 'left' && rail.visible), `${viewport.label}: Verify Signals restore rail missing`);
  }
}

async function assertOpenCloseRecovery(page, viewport, mode) {
  const rails = (await readRailState(page)).filter((rail) => rail.visible);
  for (const rail of rails) {
    const before = await readWorkspaceWidth(page);
    const toggle = page.locator(`[data-testid="${rail.testId}"]`).first();
    await toggle.click();
    await page.waitForTimeout(120);
    await capture(page, viewport, mode, `${rail.side}-open`);

    const openState = await readOpenDockState(page, rail.side);
    assert(openState.visible, `${mode}: opening ${rail.side} dock must reveal readable support content`);
    assert(openState.width >= 120, `${mode}: opened ${rail.side} dock width ${openState.width}px is unreadable`);
    assert(openState.textLength >= 12, `${mode}: opened ${rail.side} dock should expose meaningful content`);
    await assertNoHorizontalOverflow(page, viewport, `${mode}/${rail.side}-open`);

    const collapse = page.locator(`[data-testid="ide-workbench-dock-collapse-${rail.side}"]`).first();
    assert(await collapse.isVisible().catch(() => false), `${mode}: opened ${rail.side} dock needs an obvious collapse control`);
    await collapse.click();
    await page.waitForTimeout(120);

    const after = await readWorkspaceWidth(page);
    assert(
      after >= before - 2,
      `${mode}: closing ${rail.side} dock should restore workbench width (${before}px -> ${after}px)`
    );
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

async function readWorkspaceWidth(page) {
  return page.evaluate(() => {
    const bounds = document.querySelector('[data-testid="ide-mode-body"]')?.getBoundingClientRect();
    return Math.round((bounds?.width ?? 0) * 10) / 10;
  });
}

async function readOpenDockState(page, side) {
  return page.evaluate((dockSide) => {
    const selector = dockSide === 'left' ? '[data-testid="ide-left-dock"]' : '[data-testid="ide-inspector"]';
    const element = document.querySelector(selector);
    if (!element) return { visible: false, width: 0, textLength: 0 };
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      visible: bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden',
      width: Math.round(bounds.width * 10) / 10,
      textLength: (element.textContent || '').replace(/\s+/g, ' ').trim().length,
    };
  }, side);
}

async function readRailState(page) {
  return page.evaluate(() => {
    const sides = [
      { side: 'left', testId: 'ide-workbench-dock-toggle-left' },
      { side: 'right', testId: 'ide-workbench-dock-toggle-right' },
    ];

    return sides.map(({ side, testId }) => {
      const rail = document.querySelector(`[data-testid="${testId}"]`);
      const label = rail?.querySelector('.ide-workbench-dock-toggle-rail-label') ?? null;
      const hint = rail?.querySelector('.ide-workbench-dock-toggle-rail-hint') ?? null;
      if (!rail) {
        return { side, testId, present: false, visible: false };
      }

      const bounds = rail.getBoundingClientRect();
      const labelBounds = label?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
      const hintBounds = hint?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
      const style = window.getComputedStyle(rail);
      const labelStyle = label ? window.getComputedStyle(label) : null;
      const hintStyle = hint ? window.getComputedStyle(hint) : null;
      const within = (childBounds) =>
        childBounds.left >= bounds.left - 1 &&
        childBounds.right <= bounds.right + 1 &&
        childBounds.top >= bounds.top - 1 &&
        childBounds.bottom <= bounds.bottom + 1;

      return {
        side,
        testId,
        present: true,
        visible: bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden',
        tagName: rail.tagName,
        focusable: typeof rail.focus === 'function' && !rail.hasAttribute('disabled'),
        text: (rail.textContent || '').replace(/\s+/g, ' ').trim(),
        ariaLabel: rail.getAttribute('aria-label'),
        title: rail.getAttribute('title'),
        width: Math.round(bounds.width * 10) / 10,
        height: Math.round(bounds.height * 10) / 10,
        writingMode: style.writingMode,
        labelWritingMode: labelStyle?.writingMode ?? '',
        hintWritingMode: hintStyle?.writingMode ?? '',
        labelVisibleWidth: Math.round(labelBounds.width * 10) / 10,
        labelVisibleHeight: Math.round(labelBounds.height * 10) / 10,
        labelWithinRail: label ? within(labelBounds) : false,
        hintWithinRail: hint ? within(hintBounds) : false,
      };
    });
  });
}

async function focusRail(page, testId) {
  return page.evaluate((railTestId) => {
    const rail = document.querySelector(`[data-testid="${railTestId}"]`);
    if (!(rail instanceof HTMLElement)) return false;
    rail.focus();
    return document.activeElement === rail;
  }, testId);
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

function isVerticalWritingMode(value) {
  return /vertical|sideways/i.test(value);
}
