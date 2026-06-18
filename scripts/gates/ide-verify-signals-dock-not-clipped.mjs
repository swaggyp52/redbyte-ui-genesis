#!/usr/bin/env node

import { assert, ensureVerifyVectorsReady, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

await runIdeGate('IDE Verify signals dock is readable and not clipped', async ({ page, baseUrl }) => {
  const browserProblems = [];
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserProblems.push(`console.error: ${message.text()}`);
  });

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const failures = [];
  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openVerify(page, baseUrl, viewport.label);
      await ensureVerifyVectorsReady(page);
      await openSignalsDock(page, viewport.label);
      const metrics = await readDockMetrics(page);

      assert(metrics.rootOverflowX <= 1, `${viewport.label}: opening Verify Signals dock must not create root overflow ${metrics.rootOverflowX}px`);
      assert(metrics.dock.visible, `${viewport.label}: Verify Signals dock must be visible`);
      assert(metrics.dock.width >= 220, `${viewport.label}: Verify Signals dock is too narrow (${metrics.dock.width}px)`);
      assert(metrics.workspace.width >= 920, `${viewport.label}: Verify workspace should remain usable with Signals open (${metrics.workspace.width}px)`);
      assert(!metrics.header.clippedX, `${viewport.label}: Signals header is horizontally clipped ${JSON.stringify(metrics.header)}`);
      assert(!metrics.title.clippedX, `${viewport.label}: Signals title is horizontally clipped ${JSON.stringify(metrics.title)}`);
      assert(!metrics.count.clippedX, `${viewport.label}: Signals count chip is horizontally clipped ${JSON.stringify(metrics.count)}`);
      assert(!metrics.summary.clippedX, `${viewport.label}: Signals summary is horizontally clipped ${JSON.stringify(metrics.summary)}`);
      assert(metrics.collapseButton.visible, `${viewport.label}: Signals dock collapse control must remain visible`);
      assert(!metrics.collapseButton.clippedX, `${viewport.label}: Signals collapse control is horizontally clipped ${JSON.stringify(metrics.collapseButton)}`);
      assert(metrics.signalList.visible, `${viewport.label}: Signals list must remain visible`);
      assert(!metrics.signalList.clippedX, `${viewport.label}: Signals list is horizontally clipped ${JSON.stringify(metrics.signalList)}`);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Verify Signals dock browser errors:\n${browserProblems.join('\n')}`);
  assert(failures.length === 0, `Verify Signals dock failures:\n${failures.join('\n')}`);
});

async function openVerify(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-signals-dock-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'half-adder' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
}

async function openSignalsDock(page, label) {
  if (await page.locator('[data-testid="ide-left-dock"]').first().isVisible().catch(() => false)) return;
  const toggle = page.locator('[data-testid="ide-workbench-dock-toggle-left"]').first();
  assert(await toggle.isVisible().catch(() => false), `${label}: collapsed Signals rail toggle must be visible`);
  await toggle.click();
  await page.waitForSelector('[data-testid="ide-left-dock"]', { timeout: 5000 });
}

async function readDockMetrics(page) {
  return page.evaluate(() => {
    function rect(selector) {
      const element = document.querySelector(selector);
      if (!element) {
        return { visible: false, clippedX: true, clippedY: true, width: 0, height: 0, clientWidth: 0, scrollWidth: 0, clientHeight: 0, scrollHeight: 0 };
      }
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visible =
        bounds.width > 1 &&
        bounds.height > 1 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
      const clippedX = element.scrollWidth > element.clientWidth + 1;
      const clippedY = element.scrollHeight > element.clientHeight + 1;
      return {
        visible,
        clippedX,
        clippedY,
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    }

    return {
      rootOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      dock: rect('[data-testid="ide-left-dock"]'),
      workspace: rect('[data-testid="ide-mode-body"]'),
      header: rect('[data-testid="ide-verify-signal-rail-header"]'),
      title: rect('.ide-verify-signal-rail-title'),
      count: rect('[data-testid="ide-verify-signal-filter-state"]'),
      summary: rect('[data-testid="ide-verify-signal-rail-summary"]'),
      collapseButton: rect('[data-testid="ide-workbench-dock-collapse-left"]'),
      signalList: rect('[data-testid="ide-verify-signal-list"]'),
    };
  });
}
