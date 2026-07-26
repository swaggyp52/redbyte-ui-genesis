#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
  visible,
} from './_gateHarness.mjs';
import { isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 },
];

const SCREENSHOT_ROOT = process.env.RB_WORKBENCH_SPACE_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_WORKBENCH_SPACE_SCREENSHOTS_DIR)
  : '';

const SPACE_BUDGETS = {
  // This is the accepted laptop floor. The separate 70% strategic target remains
  // intentionally unmet at the 1366 and 1440 viewports.
  designCanvasWidthRatio: 0.62,
  designCanvasHeightRatio: 0.52,
  verifyWaveformMinWidthRatio: 0.36,
  verifyWaveformMinHeightRatio: 0.30,
  hardwareFocalMinWidthRatio: 0.45,
  hardwareFocalMinHeightRatio: 0.28,
};

const metricsLog = [];

await runIdeGate('IDE workbench space utilization satisfied', async ({ page, baseUrl }) => {
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

  const failures = [];

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openFreshStarterProject(page, baseUrl, viewport);

    await checkSurface(failures, page, viewport, 'project', async () => {
      await openMode(page, 'project');
      await capture(page, viewport, 'project');
      await assertProjectSpace(page, viewport);
    });

    await checkSurface(failures, page, viewport, 'design', async () => {
      await openMode(page, 'design');
      await page.waitForSelector('[data-testid="ide-design-live-canvas"]', { timeout: 15000 });
      await page.waitForSelector('[data-node-id]', { timeout: 15000 });
      await capture(page, viewport, 'design');
      await assertDesignSpace(page, viewport);
      await assertDesignStableRegions(page, viewport);
    });

    await checkSurface(failures, page, viewport, 'verify-before-run', async () => {
      await openMode(page, 'verify');
      await ensureVerifyVectorsReady(page);
      await capture(page, viewport, 'verify-before-run');
      await assertVerifySpace(page, viewport, 'before run');
    });

    await checkSurface(failures, page, viewport, 'verify-pass-observation', async () => {
      assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must be selectable`);
      await clickVerifyRun(page);
      await waitForVerifyResult(page, { timeout: 15000 });
      const status = await normalizedText(page.locator('[data-testid="ide-verify-summary-status"]').first());
      assert(isVerifyPass(status), `${viewport.label}: Verify Compare should PASS, got "${status}"`);
      await capture(page, viewport, 'verify-pass-observation');
      await assertVerifySpace(page, viewport, 'PASS observation');
    });

    await checkSurface(failures, page, viewport, 'hardware', async () => {
      await openMode(page, 'hardware');
      await page.waitForSelector('[data-testid="ide-hw-board-workspace"]', { timeout: 15000 });
      await capture(page, viewport, 'hardware');
      await assertHardwareSpace(page, viewport);
    });

    await checkSurface(failures, page, viewport, 'export', async () => {
      await openMode(page, 'export');
      await page.waitForSelector('[data-testid="ide-export-package-inspector-v1"]', { timeout: 15000 });
      await capture(page, viewport, 'export');
      await assertExportSpace(page, viewport);
    });

    await checkSurface(failures, page, viewport, 'import', async () => {
      await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=workbench-space-${viewport.label}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
      await capture(page, viewport, 'import');
      await assertImportSpace(page, viewport);
    });
  }

  await writeMetrics();

  assert(
    consoleFindings.length === 0,
    `Workbench space gate emitted console/page errors: ${JSON.stringify(consoleFindings.slice(0, 8))}`
  );
  assert(failures.length === 0, `Workbench space utilization failures:\n${failures.join('\n')}`);
});

async function openFreshStarterProject(page, baseUrl, viewport) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=workbench-space-${viewport.label}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 15000 });
}

async function openMode(page, mode) {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`/?mode=${mode}&e2e=1`, { waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(100);
}

async function checkSurface(failures, page, viewport, surface, callback) {
  try {
    await callback();
  } catch (error) {
    failures.push(`${viewport.label}/${surface}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    const metrics = await readSurfaceMetrics(page).catch((error) => ({
      readError: error instanceof Error ? error.message : String(error),
    }));
    metricsLog.push({ viewport: viewport.label, surface, metrics });
  }
}

async function assertProjectSpace(page, viewport) {
  await assertNoHorizontalOverflow(page, viewport, 'Project');
  await assertVisiblePrimary(page, viewport, 'Project command center', [
    '[data-testid="ide-project-command-center"]',
    '[data-testid="ide-project-landing"]',
  ]);
  await assertActionInViewport(page, viewport, 'Project primary action', [
    '[data-testid="ide-project-command-strip-primary-cta"]',
    '[data-testid="ide-project-path-continue"]',
    '[data-testid="ide-project-build-fresh-primary"]',
  ]);
}

async function assertDesignSpace(page, viewport) {
  await assertNoHorizontalOverflow(page, viewport, 'Design');
  const metrics = await readSurfaceMetrics(page);
  const canvas = metrics.rects.designCanvas;
  assert(canvas.visible, `${viewport.label}: Design canvas must be visible`);
  assert(
    canvas.width >= viewport.width * SPACE_BUDGETS.designCanvasWidthRatio,
    `${viewport.label}: Design canvas is squeezed to ${canvas.width.toFixed(1)}px; expected at least ${Math.round(
      viewport.width * SPACE_BUDGETS.designCanvasWidthRatio
    )}px`
  );
  assert(
    canvas.visibleHeight >= viewport.height * SPACE_BUDGETS.designCanvasHeightRatio,
    `${viewport.label}: Design canvas visible height is ${canvas.visibleHeight.toFixed(1)}px; expected at least ${Math.round(
      viewport.height * SPACE_BUDGETS.designCanvasHeightRatio
    )}px`
  );
  assert(
    metrics.design.visibleNodeCount >= 3 && metrics.design.visibleWireCount >= 1,
    `${viewport.label}: Design canvas must keep the starter graph readable (${JSON.stringify(metrics.design)})`
  );
  assert(
    metrics.rects.leftDock.visible && metrics.rects.leftDock.width >= 180 && metrics.rects.leftDock.width <= 230,
    `${viewport.label}: Design Library must remain a stable 180-230px region (${metrics.rects.leftDock.width.toFixed(1)}px)`
  );
  assert(
    metrics.rects.rightDock.visible && metrics.rects.rightDock.width >= 210 && metrics.rects.rightDock.width <= 290,
    `${viewport.label}: Design Inspector must remain a stable 210-290px region (${metrics.rects.rightDock.width.toFixed(1)}px)`
  );
  const availableWidth = metrics.rects.leftDock.width + canvas.width + metrics.rects.rightDock.width;
  const availableShare = canvas.width / Math.max(1, availableWidth);
  const minimumAvailableShare = viewport.width >= 1800 ? 0.70 : viewport.width >= 1440 ? 0.66 : 0.64;
  assert(
    availableShare >= minimumAvailableShare,
    `${viewport.label}: Design canvas owns ${(availableShare * 100).toFixed(2)}% of the stable workbench; expected at least ${(minimumAvailableShare * 100).toFixed(0)}%`
  );
  assert(
    metrics.retiredDockControlCount === 0,
    `${viewport.label}: Design must not expose retired Hide/Show dock controls (${metrics.retiredDockControlCount})`
  );
}

async function assertDesignStableRegions(page, viewport) {
  assert(
    await visible(page.locator('[data-testid="ide-design-dock-palette"]').first()),
    `${viewport.label}: stable Design Library must expose the component palette`
  );
  assert(
    await visible(page.locator('[data-testid="ide-right-dock"]').first()),
    `${viewport.label}: stable Design Inspector must remain visible`
  );
}

async function assertVerifySpace(page, viewport, phase) {
  await assertNoHorizontalOverflow(page, viewport, `Verify ${phase}`);
  const metrics = await readSurfaceMetrics(page);
  if (phase === 'before run') {
    const stimulus = metrics.rects.verifyStimulus;
    const grid = metrics.rects.verifyGrid;
    assert(stimulus.visible, `${viewport.label}: Verify ${phase} testbench area must be visible`);
    assert(
      stimulus.width >= viewport.width * 0.58,
      `${viewport.label}: Verify ${phase} testbench width ${stimulus.width.toFixed(1)}px is below useful size`
    );
    assert(
      stimulus.visibleHeight >= viewport.height * 0.30,
      `${viewport.label}: Verify ${phase} testbench height ${stimulus.visibleHeight.toFixed(1)}px is below useful size`
    );
    assert(grid.visible, `${viewport.label}: Verify ${phase} stimulus grid must be visible`);
    assert(
      metrics.verify.gridExtraX <= 8,
      `${viewport.label}: Verify ${phase} stimulus grid needs horizontal mini-scroll (${metrics.verify.gridExtraX}px)`
    );
    assertStableVerifySignals(metrics, viewport, phase);
    return;
  }

  const waveform = metrics.rects.verifyWaveform;
  assert(waveform.visible, `${viewport.label}: Verify ${phase} waveform/evidence area must be visible`);
  assert(
    waveform.width >= viewport.width * SPACE_BUDGETS.verifyWaveformMinWidthRatio,
    `${viewport.label}: Verify ${phase} waveform width ${waveform.width.toFixed(1)}px is below useful size`
  );
  assert(
    waveform.visibleHeight >= viewport.height * SPACE_BUDGETS.verifyWaveformMinHeightRatio,
    `${viewport.label}: Verify ${phase} waveform height ${waveform.visibleHeight.toFixed(1)}px is below useful size`
  );
  assertStableVerifySignals(metrics, viewport, phase);
}

function assertStableVerifySignals(metrics, viewport, phase) {
  assert(
    metrics.rects.leftDock.visible && metrics.rects.verifySignals.visible,
    `${viewport.label}: Verify ${phase} must keep the stable Signals region visible`
  );
  assert(
    metrics.retiredDockControlCount === 0,
    `${viewport.label}: Verify ${phase} must not expose retired dock toggles (${metrics.retiredDockControlCount})`
  );
}

async function assertHardwareSpace(page, viewport) {
  await assertNoHorizontalOverflow(page, viewport, 'Hardware');
  const metrics = await readSurfaceMetrics(page);
  const table = metrics.rects.hardwareTable;
  const board = metrics.rects.hardwareBoard;
  assert(board.visible || table.visible, `${viewport.label}: Hardware board/table focal region must be visible`);
  const focal = table.visible ? table : board;
  assert(
    focal.width >= viewport.width * SPACE_BUDGETS.hardwareFocalMinWidthRatio,
    `${viewport.label}: Hardware focal width ${focal.width.toFixed(1)}px is below useful size`
  );
  assert(
    focal.visibleHeight >= viewport.height * SPACE_BUDGETS.hardwareFocalMinHeightRatio,
    `${viewport.label}: Hardware focal height ${focal.visibleHeight.toFixed(1)}px is below useful size`
  );
}

async function assertExportSpace(page, viewport) {
  await assertNoHorizontalOverflow(page, viewport, 'Export');
  await assertVisiblePrimary(page, viewport, 'Export handoff station', [
    '[data-testid="ide-export-package-inspector-v1"]',
    '[data-testid="ide-export-readiness-hero"]',
  ]);
  await assertActionInViewport(page, viewport, 'Export primary handoff action', [
    '[data-testid="ide-export-package-build-v1"]',
    '[data-testid="ide-export-package-download-v1"]',
    '[data-testid="ide-export-primary-actions"] button',
  ]);
}

async function assertImportSpace(page, viewport) {
  await assertNoHorizontalOverflow(page, viewport, 'Import');
  await assertVisiblePrimary(page, viewport, 'Import recovery workspace', [
    '[data-testid="ide-import-workbench"]',
  ]);
  await assertActionInViewport(page, viewport, 'Import primary action', [
    '[data-testid="ide-import-zip-browse"]',
  ]);
  assert(
    await visible(page.locator('[data-testid="ide-import-horizontal-stepper"]').first()),
    `${viewport.label}: Import must expose the Upload, Review, Apply stepper`
  );
}

async function assertVisiblePrimary(page, viewport, label, selectors) {
  const rect = await firstVisibleRect(page, selectors);
  assert(rect.visible, `${viewport.label}: ${label} must be visible`);
  assert(rect.top < viewport.height - 72, `${viewport.label}: ${label} starts below the useful first viewport`);
  assert(rect.visibleWidth >= Math.min(520, viewport.width * 0.42), `${viewport.label}: ${label} is too narrow`);
  assert(rect.visibleHeight >= 96, `${viewport.label}: ${label} is too short in the first viewport`);
}

async function assertActionInViewport(page, viewport, label, selectors) {
  const rect = await firstVisibleRect(page, selectors);
  assert(rect.visible, `${viewport.label}: ${label} must be visible`);
  assert(rect.top < viewport.height - 40, `${viewport.label}: ${label} starts below the useful first viewport`);
  assert(rect.visibleHeight >= 40, `${viewport.label}: ${label} is below the 40px primary-control floor`);
  assert(rect.visibleWidth >= 40, `${viewport.label}: ${label} is clipped horizontally`);
  const textMetrics = await page.evaluate((selector) => {
    const element = selector ? document.querySelector(selector) : null;
    return element ? { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth } : null;
  }, rect.selector);
  assert(
    textMetrics && textMetrics.scrollWidth <= textMetrics.clientWidth + 1,
    `${viewport.label}: ${label} text is clipped ${JSON.stringify(textMetrics)}`
  );
}

async function assertNoHorizontalOverflow(page, viewport, label) {
  const overflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
  );
  assert(overflow <= 1, `${viewport.label}: ${label} has horizontal overflow (${overflow}px)`);
}

async function firstVisibleRect(page, selectors) {
  return page.evaluate((candidateSelectors) => {
    const empty = rectJson(new DOMRect(0, 0, 0, 0));
    for (const selector of candidateSelectors) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const rect = visibleRect(element);
      if (rect.visible) {
        return { selector, ...rect };
      }
    }
    return { selector: null, ...empty };

    function visibleRect(element) {
      const rect = element.getBoundingClientRect();
      const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
      const visibleLeft = Math.max(viewport.left, rect.left);
      const visibleTop = Math.max(viewport.top, rect.top);
      const visibleRight = Math.min(viewport.right, rect.right);
      const visibleBottom = Math.min(viewport.bottom, rect.bottom);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      return {
        ...rectJson(rect),
        visibleWidth,
        visibleHeight,
        visible:
          rect.width > 1 &&
          rect.height > 1 &&
          visibleWidth > 1 &&
          visibleHeight > 1 &&
          window.getComputedStyle(element).visibility !== 'hidden',
      };
    }

    function rectJson(rect) {
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        visibleWidth: 0,
        visibleHeight: 0,
        visible: rect.width > 1 && rect.height > 1,
      };
    }
  }, selectors);
}

async function readSurfaceMetrics(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return rectJson(new DOMRect(0, 0, 0, 0), false);
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visible = bounds.width > 1 && bounds.height > 1 && style.display !== 'none' && style.visibility !== 'hidden';
      return rectJson(bounds, visible);
    };
    const visibleRect = (element) => {
      const bounds = element.getBoundingClientRect();
      const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
      const visibleLeft = Math.max(viewport.left, bounds.left);
      const visibleTop = Math.max(viewport.top, bounds.top);
      const visibleRight = Math.min(viewport.right, bounds.right);
      const visibleBottom = Math.min(viewport.bottom, bounds.bottom);
      return {
        visibleWidth: Math.max(0, visibleRight - visibleLeft),
        visibleHeight: Math.max(0, visibleBottom - visibleTop),
      };
    };
    const rectJson = (bounds, visible) => {
      const clipped = visibleRect({ getBoundingClientRect: () => bounds });
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
        visibleWidth: clipped.visibleWidth,
        visibleHeight: clipped.visibleHeight,
        visible,
      };
    };
    const intersects = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    const designCanvasElement = document.querySelector('[data-testid="ide-design-live-canvas"]');
    const designCanvasRect = designCanvasElement?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
    const viewportRect = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const designNodes = Array.from(document.querySelectorAll('[data-node-id]'));
    const designWires = Array.from(document.querySelectorAll('[data-wire-id]'));

    return {
      mode: document.querySelector('[data-ide-mode-marker]')?.getAttribute('data-ide-mode-marker') ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      rects: {
        shell: rect('[data-ide-mode-marker]'),
        workspace: rect('[data-testid="ide-mode-body"]'),
        leftDock: rect('[data-testid="ide-left-dock"]'),
        rightDock: rect('[data-testid="ide-right-dock"]'),
        designCanvas: rect('[data-testid="ide-design-live-canvas"]'),
        verifyStimulus: rect('[data-testid="ide-verify-region-stimulus"]'),
        verifyGrid: rect('.ide-stimulus-grid-scroll'),
        verifySignals: rect('[data-testid="ide-verify-left-dock"]'),
        verifyWaveform: rect(
          '[data-testid="ide-verify-region-waveform"], [data-testid="ide-verify-waveform-preview"], [data-testid="ide-verify-waveform-svg"]'
        ),
        hardwareBoard: rect('[data-testid="ide-hw-board-workspace"], [data-testid="ide-hw-map-board"]'),
        hardwareTable: rect('[data-testid="ide-hw-map-table"]'),
      },
      design: {
        nodeCount: designNodes.length,
        wireCount: designWires.length,
        visibleNodeCount: designNodes.filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 4 && bounds.height > 4 && intersects(bounds, designCanvasRect) && intersects(bounds, viewportRect);
        }).length,
        visibleWireCount: designWires.filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 1 && bounds.height > 1 && intersects(bounds, designCanvasRect) && intersects(bounds, viewportRect);
        }).length,
      },
      verify: {
        gridExtraX: (() => {
          const element = document.querySelector('.ide-stimulus-grid-scroll');
          return element ? Math.max(0, element.scrollWidth - element.clientWidth) : 9999;
        })(),
      },
      retiredDockControlCount: document.querySelectorAll(
        '[data-testid*="dock-toggle"], [data-testid*="dock-collapse"], [data-testid="ide-design-library-collapse"]'
      ).length,
    };
  });
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `${name}-${viewport.label}.png`),
    fullPage: false,
  });
}

async function writeMetrics() {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await fs.writeFile(path.join(SCREENSHOT_ROOT, 'metrics.json'), JSON.stringify(metricsLog, null, 2));
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
