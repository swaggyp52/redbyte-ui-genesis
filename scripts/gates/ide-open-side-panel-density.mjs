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
    if (surface.id === 'export') {
      await openGeneratedFiles(page, `${viewport.label}/export`);
    }
    await assertNoHorizontalOverflow(page, viewport, surface.id);
    await assertFocalWorkbenchVisible(page, viewport, surface);
    await capture(page, viewport, surface.id, 'initial');

    const toggle = page.locator('[data-testid="ide-workbench-dock-toggle-right"]').first();
    assert(await toggle.isVisible().catch(() => false), `${surface.id}: right inspector restore rail is missing`);
    await toggle.click();
    await page.waitForTimeout(160);
    await capture(page, viewport, surface.id, 'right-open');

    await assertNoHorizontalOverflow(page, viewport, `${surface.id}/right-open`);
    await assertFocalWorkbenchVisible(page, viewport, surface);
    await assertOpenRightDockIsProportional(page, viewport, surface.id);

    const collapse = page.locator('[data-testid="ide-workbench-dock-collapse-right"]').first();
    assert(await collapse.isVisible().catch(() => false), `${surface.id}: open inspector needs a visible collapse control`);
    await collapse.click();
    await page.waitForTimeout(120);

    assert(
      await page.locator('[data-testid="ide-workbench-dock-toggle-right"]').first().isVisible().catch(() => false),
      `${surface.id}: collapsing the open inspector must restore the right rail`
    );
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

async function assertOpenRightDockIsProportional(page, viewport, mode) {
  const state = await page.evaluate(() => {
    const dock = document.querySelector('[data-testid="ide-inspector"]');
    const workspace = document.querySelector('[data-testid="ide-mode-body"]');
    if (!dock || !workspace) return { visible: false };

    const dockBounds = dock.getBoundingClientRect();
    const workspaceBounds = workspace.getBoundingClientRect();
    const style = window.getComputedStyle(dock);
    const workspaceStyle = window.getComputedStyle(workspace);
    const main = workspace.parentElement;
    const mainBounds = main?.getBoundingClientRect();
    const mainStyle = main ? window.getComputedStyle(main) : null;
    const text = (dock.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      visible:
        dockBounds.width > 1 &&
        dockBounds.height > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden',
      dockLeft: Math.round(dockBounds.left * 10) / 10,
      dockTop: Math.round(dockBounds.top * 10) / 10,
      dockWidth: Math.round(dockBounds.width * 10) / 10,
      dockHeight: Math.round(dockBounds.height * 10) / 10,
      workspaceRight: Math.round(workspaceBounds.right * 10) / 10,
      workspaceTop: Math.round(workspaceBounds.top * 10) / 10,
      workspaceWidth: Math.round(workspaceBounds.width * 10) / 10,
      workspaceHeight: Math.round(workspaceBounds.height * 10) / 10,
      workspaceBoxSizing: workspaceStyle.boxSizing,
      workspaceComputedWidth: workspaceStyle.width,
      workspaceTransform: workspaceStyle.transform,
      workspaceMarginInline: `${workspaceStyle.marginLeft} / ${workspaceStyle.marginRight}`,
      workspacePaddingInline: `${workspaceStyle.paddingLeft} / ${workspaceStyle.paddingRight}`,
      workspaceOffsetWidth: workspace.offsetWidth,
      workspaceClientWidth: workspace.clientWidth,
      mainWidth: mainBounds ? Math.round(mainBounds.width * 10) / 10 : null,
      mainGridColumns: mainStyle?.gridTemplateColumns ?? null,
      dockViewportShare: Math.round((dockBounds.width / window.innerWidth) * 1000) / 10,
      dockHeightShare: Math.round((dockBounds.height / window.innerHeight) * 1000) / 10,
      textLength: text.length,
    };
  });

  assert(state.visible, `${mode}: open right inspector must be visible`);
  assert(state.textLength >= 24, `${mode}: open right inspector must contain meaningful tool content`);
  assert(
    state.dockWidth >= 180 && state.dockWidth <= 320,
    `${mode}: open right inspector width ${state.dockWidth}px is disproportionate; expected 180-320px`
  );
  assert(
    state.dockViewportShare <= 24,
    `${mode}: open right inspector consumes ${state.dockViewportShare}% of viewport width`
  );
  assert(
    state.dockHeightShare >= 68,
    `${mode}: open right inspector is acting like a short bottom drawer (${state.dockHeightShare}% viewport height)`
  );
  assert(
    Math.abs(state.dockTop - state.workspaceTop) <= 2,
    `${mode}: open right inspector should align with the workspace top (${JSON.stringify(state)})`
  );
  assert(
    state.dockLeft >= state.workspaceRight - 2,
    `${mode}: open right inspector should sit beside the workspace, not below it (${JSON.stringify(state)})`
  );
  assert(
    state.workspaceHeight >= Math.min(560, viewport.height * 0.72),
    `${mode}: opening inspector leaves only ${state.workspaceHeight}px of workspace height`
  );
  assert(
    state.workspaceWidth >= Math.min(760, viewport.width * 0.56),
    `${mode}: opening inspector leaves only ${state.workspaceWidth}px of workspace width`
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

async function openGeneratedFiles(page, label) {
  const details = page.locator('[data-testid="ide-export-package-files"]').first();
  await details.waitFor({ state: 'visible', timeout: 10000 });
  if ((await details.getAttribute('open')) === null) {
    await details.locator('summary').click();
  }
  assert((await details.getAttribute('open')) !== null, `${label}: Inspect generated files must expand`);
  await page.locator('[data-testid="ide-export-file-browser-v1"]').first().waitFor({ state: 'visible', timeout: 10000 });
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
