#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const SURFACES = [
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
      '[data-testid="ide-export-readiness-hero"]',
      '[data-testid="ide-export-package-inspector-v1"]',
      '[data-testid="ide-export-panel"]',
    ],
  },
];

const SCREENSHOT_ROOT = process.env.RB_OPEN_SIDE_PANEL_DENSITY_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_OPEN_SIDE_PANEL_DENSITY_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE open side panel density satisfied', async ({ page, baseUrl }) => {
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

    for (const surface of SURFACES) {
      await checkSurface(failures, page, viewport, surface);
    }
  }

  assert(
    consoleFindings.length === 0,
    `Open side panel density emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
  assert(failures.length === 0, `Open side panel density failures:\n${failures.join('\n')}`);
});

async function openFreshStarterProject(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=open-side-panel-density-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 }).catch(() => null);
}

async function checkSurface(failures, page, viewport, surface) {
  try {
    await openMode(page, viewport, surface.id);
    await assertNoHorizontalOverflow(page, viewport, surface.id);
    await assertFocalWorkbenchVisible(page, viewport, surface);
    await capture(page, viewport, surface.id, 'initial');

    await assertDirectDetailWorkspace(page, viewport, surface.id);
    await assertNoHorizontalOverflow(page, viewport, `${surface.id}/direct-detail`);
    await capture(page, viewport, surface.id, 'direct-detail');
  } catch (error) {
    failures.push(`${viewport.label}/${surface.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function openMode(page, viewport, mode) {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`${viewportBaseUrl(page)}/?mode=${mode}&e2e=1&gate=open-side-panel-density-${viewport.label}-${mode}`, {
      waitUntil: 'domcontentloaded',
    });
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
}

async function assertDirectDetailWorkspace(page, viewport, mode) {
  const selector = mode === 'hardware' ? '[data-testid="ide-hw-map-table"]' : '[data-testid="ide-export-package-files"]';
  const detail = page.locator(selector).first();
  await detail.waitFor({ state: 'attached', timeout: 10000 });
  await detail.scrollIntoViewIfNeeded();

  const state = await page.evaluate((detailSelector) => {
    const element = document.querySelector(detailSelector);
    if (!element) return { visible: false, width: 0, height: 0, textLength: 0, genericRailControls: -1 };
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const genericRailControls = [
      '[data-testid="ide-workbench-dock-toggle-right"]',
      '[data-testid="ide-workbench-dock-collapse-right"]',
    ].flatMap((selector) => Array.from(document.querySelectorAll(selector))).filter((control) => {
      const controlBounds = control.getBoundingClientRect();
      const controlStyle = window.getComputedStyle(control);
      return controlBounds.width > 1 && controlBounds.height > 1 && controlStyle.display !== 'none' && controlStyle.visibility !== 'hidden';
    }).length;
    return {
      visible: bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden',
      width: Math.round(bounds.width * 10) / 10,
      height: Math.round(bounds.height * 10) / 10,
      textLength: (element.textContent || '').replace(/\s+/g, ' ').trim().length,
      genericRailControls,
    };
  }, selector);

  assert(state.visible, `${mode}: direct detail workspace must be visible without a drawer`);
  assert(state.textLength >= 24, `${mode}: direct detail workspace must contain meaningful tools`);
  assert(
    state.width >= Math.min(720, viewport.width * 0.54),
    `${mode}: direct detail workspace is too narrow (${state.width}px)`
  );
  assert(state.height >= 160, `${mode}: direct detail workspace is too short (${state.height}px)`);
  assert(
    state.genericRailControls === 0,
    `${mode}: retired right-rail restore/collapse controls must stay absent (${state.genericRailControls} visible)`
  );
}

async function assertFocalWorkbenchVisible(page, viewport, surface) {
  const rect = await firstVisibleRect(page, surface.focalSelectors);
  assert(rect.visible, `${surface.id}: focal workbench object must be visible`);
  assert(
    rect.visibleWidth >= Math.min(640, viewport.width * 0.42),
    `${surface.id}: focal object is too narrow (${rect.visibleWidth}px)`
  );
  assert(
    rect.visibleHeight >= 180,
    `${surface.id}: focal object is too short or clipped (${rect.visibleHeight}px)`
  );
  assert(
    rect.top < viewport.height - 80,
    `${surface.id}: focal object starts below the useful first viewport (${rect.top}px)`
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

function viewportBaseUrl(page) {
  const url = new URL(page.url());
  return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
}
