#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
} from './_gateHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

const SCREENSHOT_ROOT = process.env.RB_VERIFY_TESTBENCH_LAYOUT_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_TESTBENCH_LAYOUT_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Verify pre-run testbench owns usable layout', async ({ page, baseUrl }) => {
  const findings = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      findings.push({ type: message.type(), text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => {
    findings.push({ type: 'pageerror', text: error.message });
  });

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openLogicGatesVerify(page, baseUrl, viewport.label);
    await ensureVerifyVectorsReady(page);
    await page.waitForTimeout(150);

    const metrics = await readPreRunMetrics(page);
    await capture(page, viewport, 'prerun-testbench-layout');

    assert(
      /Simulation Studio.*Author a testbench.*run the circuit.*compare waveform evidence.*expected behavior/i.test(metrics.verifyJobText),
      `${viewport.label}: Verify must expose the v3 Simulation Studio job definition (${JSON.stringify(metrics.verifyJobText)})`
    );
    assert(metrics.rootOverflowX <= 1, `${viewport.label}: root must not horizontally overflow (${metrics.rootOverflowX}px)`);
    assert(metrics.expectedCells >= 12, `${viewport.label}: starter checks must expose all expected-output cells (${metrics.expectedCells})`);
    assert(metrics.runButtonVisible, `${viewport.label}: Run Compare must remain visible before the first run`);

    assert(
      metrics.workspaceMode === 'stimulus-focus',
      `${viewport.label}: pre-run Verify must be in stimulus-focus mode, got "${metrics.workspaceMode}"`
    );
    assert(
      metrics.phase === 'pre-run',
      `${viewport.label}: lab grid must expose pre-run phase for layout contracts, got "${metrics.phase}"`
    );
    assert(
      metrics.stimulusLayout === 'stable',
      `${viewport.label}: the v3 testbench editor must keep a stable stimulus layout, got "${metrics.stimulusLayout}"`
    );

    const requiredStimulusWidth = Math.min(860, metrics.labGrid.width * 0.68);
    assert(
      metrics.stimulus.width >= requiredStimulusWidth,
      `${viewport.label}: pre-run testbench must own the workspace (stimulus=${metrics.stimulus.width}, required>=${Math.round(requiredStimulusWidth)}, lab=${metrics.labGrid.width}, waveform=${metrics.waveform.width})`
    );
    assert(
      metrics.stimulus.width >= metrics.waveform.width,
      `${viewport.label}: pre-run waveform placeholder must not be wider than the testbench (stimulus=${metrics.stimulus.width}, waveform=${metrics.waveform.width})`
    );
    assert(
      metrics.gridScroll.width >= 720,
      `${viewport.label}: stimulus grid must have real desktop width before Run (width=${metrics.gridScroll.width})`
    );
    assert(
      metrics.gridScroll.extraX <= 8,
      `${viewport.label}: starter testbench must not need horizontal mini-scroll (extraX=${metrics.gridScroll.extraX}, client=${metrics.gridScroll.clientWidth}, scroll=${metrics.gridScroll.scrollWidth})`
    );
    assert(
      metrics.visibleCaseHeaders >= 4,
      `${viewport.label}: all four starter cases must be visible without horizontal scrolling (${metrics.visibleCaseHeaders}/4)`
    );
    assert(
      metrics.gridScroll.height >= 150,
      `${viewport.label}: stimulus grid must have enough vertical editing area before Run (height=${metrics.gridScroll.height})`
    );
  }

  assert(findings.length === 0, `Verify testbench layout emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
});

async function openLogicGatesVerify(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-testbench-usable-layout-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
}

async function readPreRunMetrics(page) {
  return page.evaluate(() => {
    function box(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    }

    const labGridElement = document.querySelector('[data-testid="ide-verify-lab-grid"]');
    const gridScrollElement = document.querySelector('.ide-stimulus-grid-scroll');
    const gridRect = gridScrollElement?.getBoundingClientRect();
    const caseHeaders = Array.from(document.querySelectorAll('.ide-stimulus-tick-header'));
    const visibleCaseHeaders = gridRect
      ? caseHeaders.filter((header) => {
          const rect = header.getBoundingClientRect();
          return rect.right <= gridRect.right + 1 && rect.left >= gridRect.left - 1;
        }).length
      : 0;
    const root = document.querySelector('[data-testid="ide-root"]');
    const gridScroll = box('.ide-stimulus-grid-scroll');

    const runButton = document.querySelector('[data-testid="ide-vcb-run"]');
    const runButtonRect = runButton?.getBoundingClientRect();

    return {
      verifyJobText:
        document.querySelector('[data-testid="ide-verify-context-header"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      phase: labGridElement?.getAttribute('data-verify-workflow-phase') ?? '',
      workspaceMode: labGridElement?.getAttribute('data-workspace-mode') ?? '',
      stimulusLayout: labGridElement?.getAttribute('data-stimulus-layout') ?? '',
      rootOverflowX: root ? Math.max(0, root.scrollWidth - root.clientWidth) : 0,
      labGrid: box('[data-testid="ide-verify-lab-grid"]'),
      stimulus: box('[data-testid="ide-verify-region-stimulus"]'),
      waveform: box('[data-testid="ide-verify-region-waveform"]'),
      gridScroll: {
        ...gridScroll,
        extraX: gridScroll ? Math.max(0, gridScroll.scrollWidth - gridScroll.clientWidth) : 9999,
      },
      expectedCells: document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]').length,
      visibleCaseHeaders,
      runButtonVisible: Boolean(
        runButton &&
          runButtonRect &&
          runButtonRect.width > 0 &&
          runButtonRect.height > 0 &&
          runButtonRect.bottom > 0 &&
          runButtonRect.top < window.innerHeight
      ),
    };
  });
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `verify-testbench-layout-${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
