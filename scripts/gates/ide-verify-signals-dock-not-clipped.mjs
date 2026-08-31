#!/usr/bin/env node

import { assert, ensureVerifyVectorsReady, loadStarterProject, runIdeGate } from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

await runIdeGate('IDE Simulate signal shelf is readable and not clipped', async ({ page, baseUrl }) => {
  const browserProblems = [];
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') browserProblems.push(`console.error: ${message.text()}`);
  });

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const failures = [];
  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openVerify(page, baseUrl, viewport.label);
      await ensureVerifyVectorsReady(page);
      await page.waitForSelector('[data-testid="ide-verify-signal-shelf"]', { state: 'visible', timeout: 5000 });
      const metrics = await readShelfMetrics(page);

      assert(metrics.rootOverflowX <= 1, `${viewport.label}: Simulate signal shelf must not create root overflow ${metrics.rootOverflowX}px`);
      assert(metrics.genericLeftDockCount === 0, `${viewport.label}: Simulate must not recreate a separate Signals rail`);
      assert(metrics.shelf.visible, `${viewport.label}: Simulate signal shelf must be visible`);
      assert(
        metrics.shelf.width >= viewport.width * 0.8,
        `${viewport.label}: Simulate signal shelf must read as full-width workbench content (${metrics.shelf.width}px)`
      );
      assert(metrics.workspace.width >= viewport.width * 0.92, `${viewport.label}: Simulate workspace is unexpectedly narrow (${metrics.workspace.width}px)`);
      assert(!metrics.header.clippedX, `${viewport.label}: Signals shelf header is horizontally clipped ${JSON.stringify(metrics.header)}`);
      assert(metrics.titleText === 'Signals', `${viewport.label}: Signals shelf title is missing (${JSON.stringify(metrics.titleText)})`);
      assert(
        /^\d+ (?:relevant|visible|flagged)$/.test(metrics.countText),
        `${viewport.label}: Signals shelf must expose its current lane scope (${JSON.stringify(metrics.countText)})`
      );
      assert(metrics.retiredCollapseControlCount === 0, `${viewport.label}: retired Signals collapse controls must be absent`);
      assert(metrics.retiredRestoreControlCount === 0, `${viewport.label}: retired Signals restore controls must be absent`);
      assert(metrics.signalList.visible, `${viewport.label}: Signals shelf list must remain visible`);
      assert(metrics.signalListWithinShelfX, `${viewport.label}: Signals list must remain within the integrated shelf geometry`);
      assert(metrics.signalRowCount > 0, `${viewport.label}: Signals shelf must expose current circuit lanes`);
      assert(metrics.firstSignalRow.visible, `${viewport.label}: first current signal control must be visible`);
      assert(!metrics.firstSignalRow.clippedX, `${viewport.label}: first current signal control is horizontally clipped ${JSON.stringify(metrics.firstSignalRow)}`);

      await assertSignalSelection(page, viewport.label);
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Simulate signal shelf browser errors:\n${browserProblems.join('\n')}`);
  assert(failures.length === 0, `Simulate signal shelf failures:\n${failures.join('\n')}`);
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

async function assertSignalSelection(page, label) {
  const signals = page.locator('[data-testid^="ide-verify-shelf-signal-"]');
  const signalCount = await signals.count();
  assert(signalCount > 1, `${label}: signal shelf must expose more than one selectable circuit lane`);
  const firstSignal = signals.first();
  await firstSignal.click();
  assert(
    (await firstSignal.getAttribute('aria-pressed')) === 'true',
    `${label}: selecting the first signal must expose semantic active state`
  );

  const lastSignal = signals.last();
  await lastSignal.scrollIntoViewIfNeeded();
  await lastSignal.click();
  assert(
    (await lastSignal.getAttribute('aria-pressed')) === 'true',
    `${label}: the last signal must remain reachable and expose semantic active state`
  );
  assert(
    (await firstSignal.getAttribute('aria-pressed')) === 'false',
    `${label}: selecting the last signal must clear the previous semantic active state`
  );
  const [shelfBox, lastSignalBox] = await Promise.all([
    page.locator('[data-testid="ide-verify-signal-shelf"]').boundingBox(),
    lastSignal.boundingBox(),
  ]);
  assert(shelfBox && lastSignalBox, `${label}: selected last signal must have visible shelf geometry`);
  assert(
    lastSignalBox.x >= shelfBox.x - 1 && lastSignalBox.x + lastSignalBox.width <= shelfBox.x + shelfBox.width + 1,
    `${label}: selected last signal must scroll fully inside the integrated shelf`
  );
}

async function readShelfMetrics(page) {
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
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    }

    const shelf = rect('[data-testid="ide-verify-signal-shelf"]');
    const signalList = rect('[data-testid="ide-verify-signal-shelf-list"]');

    return {
      rootOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      genericLeftDockCount: document.querySelectorAll('[data-testid="ide-left-dock"]').length,
      shelf,
      workspace: rect('[data-testid="ide-mode-body"]'),
      header: rect('[data-testid="ide-verify-signal-shelf"] > header'),
      titleText: document.querySelector('[data-testid="ide-verify-signal-shelf"] > header span')?.textContent?.trim() ?? '',
      countText: document.querySelector('[data-testid="ide-verify-signal-shelf"] > header strong')?.textContent?.trim() ?? '',
      retiredCollapseControlCount: document.querySelectorAll(
        '[data-testid="ide-workbench-dock-collapse-left"], [data-testid="ide-verify-signal-rail-toggle"]'
      ).length,
      retiredRestoreControlCount: document.querySelectorAll('[data-testid="ide-workbench-dock-toggle-left"]').length,
      signalList,
      signalListWithinShelfX:
        shelf.visible && signalList.visible && signalList.left >= shelf.left - 1 && signalList.right <= shelf.right + 1,
      signalRowCount: document.querySelectorAll('[data-testid^="ide-verify-shelf-signal-"]').length,
      firstSignalRow: rect('[data-testid^="ide-verify-shelf-signal-"]'),
    };
  });
}
