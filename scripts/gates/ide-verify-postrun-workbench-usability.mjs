#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { isVerifyFail, isVerifyPass, waitForVerifyResult } from './_verifyStatus.mjs';

const CURRENT_SHA = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();

const VIEWPORTS = [
  {
    label: '1366x768',
    width: 1366,
    height: 768,
    compact: false,
    minStimulusWidth: 500,
    minWaveformPreviewClippedHeight: 200,
    maxWaveformPreviewTopOffset: 300,
  },
  {
    label: '1440x900',
    width: 1440,
    height: 900,
    compact: false,
    minStimulusWidth: 530,
    minWaveformPreviewClippedHeight: 320,
    maxWaveformPreviewTopOffset: 300,
  },
  {
    label: '1093x614',
    width: 1093,
    height: 614,
    compact: true,
    minStimulusWidth: 760,
    minWaveformPreviewClippedHeight: 150,
    maxWaveformPreviewTopOffset: 300,
  },
];

const SCREENSHOT_ROOT = process.env.RB_VERIFY_POSTRUN_WORKBENCH_SCREENSHOTS_DIR
  ? path.resolve(process.env.RB_VERIFY_POSTRUN_WORKBENCH_SCREENSHOTS_DIR)
  : '';

await runIdeGate('IDE Verify post-run workbench remains usable', async ({ page, baseUrl }) => {
  const findings = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      findings.push({ type: 'console.error', text: message.text(), location: message.location() });
    }
  });
  page.on('pageerror', (error) => findings.push({ type: 'pageerror', text: error.message }));

  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const failures = [];
  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openLogicGatesVerify(page, baseUrl, viewport.label);
      await ensureVerifyVectorsReady(page);
      assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare checks must be selectable`);

      let status = await clickRunAndWaitForNewResult(page);
      assert(isVerifyPass(status), `${viewport.label}: initial Compare should PASS, got "${status}"`);
      await capture(page, viewport, '01-compare-pass');
      await assertPostRunWorkbench(page, viewport, 'PASS');

      await assertPostRunToggleKeepsWorkbenchAccessible(page, viewport);

      const target = await pickRenderedExpectedTarget(page);
      const wrongValue = target.value === 0 ? 1 : 0;
      await clickExpectedCellToValue(page, target, wrongValue);
      await assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare checks must remain selectable after edit`);

      status = await clickRunAndWaitForNewResult(page);
      assert(isVerifyFail(status), `${viewport.label}: wrong expected output should FAIL, got "${status}"`);
      await capture(page, viewport, '02-compare-fail');
      await assertPostRunWorkbench(page, viewport, 'FAIL');

      await clickExpectedCellToValue(page, target, target.value);
      await assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare checks must remain selectable after repair`);
      status = await clickRunAndWaitForNewResult(page);
      assert(isVerifyPass(status), `${viewport.label}: repaired expected output should PASS, got "${status}"`);
      await capture(page, viewport, '03-repair-pass');
      await assertPostRunWorkbench(page, viewport, 'REPAIR PASS');
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(findings.length === 0, `Verify post-run workbench emitted console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
  assert(failures.length === 0, `Verify post-run workbench failures:\n${failures.join('\n')}`);
});

async function openLogicGatesVerify(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=verify-postrun-workbench-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });
  await page.locator('[data-testid="mode-button-verify"]').click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 15000 });
}

async function assertPostRunWorkbench(page, viewport, label) {
  if (viewport.compact) {
    await assertCompactStimulusFocus(page, viewport, label);
    await positionCompactWaveformControls(page);
  }
  const metrics = await page.evaluate(() => {
    const box = (selector) => {
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
    };
    const visibleHeight = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return 0;
      const rect = element.getBoundingClientRect();
      return Math.round(Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)));
    };
    const clippedVisibleHeight = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return 0;
      const rect = element.getBoundingClientRect();
      let top = Math.max(0, rect.top);
      let bottom = Math.min(window.innerHeight, rect.bottom);
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (!/(auto|scroll|hidden|clip)/.test(style.overflowY)) continue;
        const ancestorRect = ancestor.getBoundingClientRect();
        top = Math.max(top, ancestorRect.top);
        bottom = Math.min(bottom, ancestorRect.bottom);
      }
      return Math.round(Math.max(0, bottom - top));
    };
    const clippedControl = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      const computedStyle = getComputedStyle(element);
      let left = Math.max(0, rect.left);
      let right = Math.min(window.innerWidth, rect.right);
      let top = Math.max(0, rect.top);
      let bottom = Math.min(window.innerHeight, rect.bottom);
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        const ancestorRect = ancestor.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          left = Math.max(left, ancestorRect.left);
          right = Math.min(right, ancestorRect.right);
        }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
          top = Math.max(top, ancestorRect.top);
          bottom = Math.min(bottom, ancestorRect.bottom);
        }
      }
      const centerX = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
      const centerY = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));
      const centerHit = document.elementFromPoint(centerX, centerY);
      return {
        ...box(selector),
        fontSize: Number.parseFloat(computedStyle.fontSize || '0'),
        label: element.textContent?.trim() ?? '',
        clippedVisibleWidth: Math.round(Math.max(0, right - left)),
        clippedVisibleHeight: Math.round(Math.max(0, bottom - top)),
        centerHit: centerHit === element || element.contains(centerHit),
        centerHitTestId: centerHit?.getAttribute('data-testid') ?? '',
      };
    };
    const overlapArea = (leftSelector, rightSelector) => {
      const left = document.querySelector(leftSelector)?.getBoundingClientRect();
      const right = document.querySelector(rightSelector)?.getBoundingClientRect();
      if (!left || !right) return null;
      return Math.round(
        Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left)) *
        Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top))
      );
    };
    const rectContains = (parentSelector, childSelector) => {
      const parent = document.querySelector(parentSelector)?.getBoundingClientRect();
      const child = document.querySelector(childSelector)?.getBoundingClientRect();
      if (!parent || !child) return false;
      const tolerance = 1;
      return (
        child.left >= parent.left - tolerance &&
        child.right <= parent.right + tolerance &&
        child.top >= parent.top - tolerance &&
        child.bottom <= parent.bottom + tolerance
      );
    };
    const domContains = (parentSelector, childSelector) => {
      const parent = document.querySelector(parentSelector);
      const child = document.querySelector(childSelector);
      return Boolean(parent && child && parent.contains(child));
    };
    const root = document.querySelector('[data-testid="ide-root"]');
    const labGrid = document.querySelector('[data-testid="ide-verify-lab-grid"]');
    const gridScroll = document.querySelector('.ide-stimulus-grid-scroll');
    const waveform = box('[data-testid="ide-verify-region-waveform"]');
    const waveformPreview = box('[data-testid="ide-verify-waveform-preview"]');
    const statusText = document.querySelector('[data-testid="ide-verify-summary-status"]')?.textContent?.trim() ?? '';
    return {
      buildHash: document.querySelector('[data-testid="ide-top-bar"]')?.getAttribute('data-build-sha')?.trim() ?? '',
      viewportHeight: window.innerHeight,
      rootOverflowX: root ? Math.max(0, root.scrollWidth - root.clientWidth) : 0,
      documentOverflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      workspaceMode: labGrid?.getAttribute('data-workspace-mode') ?? '',
      phase: labGrid?.getAttribute('data-verify-workflow-phase') ?? '',
      stimulusLayout: labGrid?.getAttribute('data-stimulus-layout') ?? '',
      labGrid: box('[data-testid="ide-verify-lab-grid"]'),
      stimulus: box('[data-testid="ide-verify-region-stimulus"]'),
      waveform,
      waveformPreview,
      waveformPreviewCount: document.querySelectorAll('[data-testid="ide-verify-waveform-preview"]').length,
      waveformPreviewVisibleHeight: visibleHeight('[data-testid="ide-verify-waveform-preview"]'),
      waveformPreviewClippedHeight: clippedVisibleHeight('[data-testid="ide-verify-waveform-preview"]'),
      waveformPreviewTopOffset:
        waveform && waveformPreview ? Math.max(0, Math.round(waveformPreview.y - waveform.y)) : null,
      workbenchBody: box('[data-testid="ide-verify-workbench-body"]'),
      repairPanel: box('[data-testid="ide-verify-repair-panel"]'),
      repairDecision: box('[data-testid="ide-verify-repair-decision"]'),
      repairDecisionClippedHeight: clippedVisibleHeight('[data-testid="ide-verify-repair-decision"]'),
      gridScroll: gridScroll
        ? {
            ...box('.ide-stimulus-grid-scroll'),
            extraX: Math.max(0, gridScroll.scrollWidth - gridScroll.clientWidth),
            extraY: Math.max(0, gridScroll.scrollHeight - gridScroll.clientHeight),
          }
        : null,
      instrumentDeck: (() => {
        const deck = document.querySelector('.ide-verify-instrument-deck');
        if (!(deck instanceof HTMLElement)) return null;
        const style = getComputedStyle(deck);
        return {
          ...box('.ide-verify-instrument-deck'),
          overflowY: style.overflowY,
          maxScrollY: Math.max(0, deck.scrollHeight - deck.clientHeight),
        };
      })(),
      panelBody: (() => {
        const body = document.querySelector('.ide-verify-panel > .ide-panel-body');
        if (!(body instanceof HTMLElement)) return null;
        const style = getComputedStyle(body);
        return {
          ...box('.ide-verify-panel > .ide-panel-body'),
          overflowY: style.overflowY,
          maxScrollY: Math.max(0, body.scrollHeight - body.clientHeight),
        };
      })(),
      expectedCells: document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]').length,
      runVisible: Boolean(document.querySelector('[data-testid="ide-vcb-run"]')),
      waveformControls: {
        primary: clippedControl('[data-testid="ide-verify-waveform-primary"]'),
        transport: clippedControl('[data-testid="ide-verify-waveform-transport"]'),
        stepToggle: clippedControl('[data-testid="ide-verify-step-mode-toggle"]'),
        zoomAll: clippedControl('[data-testid="ide-verify-zoom-all"]'),
        tickScrubber: clippedControl('[data-testid="ide-verify-tick-scrubber"]'),
        stepToggleApplicable:
          Number(document.querySelector('[data-testid="ide-verify-tick-scrubber"]')?.getAttribute('max') ?? 0) > 0,
        domContainment: {
          primaryInBar: domContains(
            '[data-testid="ide-verify-waveform-bar"]',
            '[data-testid="ide-verify-waveform-primary"]'
          ),
          transportInPrimary: domContains(
            '[data-testid="ide-verify-waveform-primary"]',
            '[data-testid="ide-verify-waveform-transport"]'
          ),
          stepToggleInPrimary: domContains(
            '[data-testid="ide-verify-waveform-primary"]',
            '[data-testid="ide-verify-step-mode-toggle"]'
          ),
          zoomAllInTransport: domContains(
            '[data-testid="ide-verify-waveform-transport"]',
            '[data-testid="ide-verify-zoom-all"]'
          ),
          tickScrubberInTransport: domContains(
            '[data-testid="ide-verify-waveform-transport"]',
            '[data-testid="ide-verify-tick-scrubber"]'
          ),
          failNavOutsidePrimary:
            Boolean(document.querySelector('[data-testid="ide-verify-fail-nav"]')) &&
            !domContains(
              '[data-testid="ide-verify-waveform-primary"]',
              '[data-testid="ide-verify-fail-nav"]'
            ),
        },
        rectContainment: {
          primaryInBar: rectContains(
            '[data-testid="ide-verify-waveform-bar"]',
            '[data-testid="ide-verify-waveform-primary"]'
          ),
          transportInPrimary: rectContains(
            '[data-testid="ide-verify-waveform-primary"]',
            '[data-testid="ide-verify-waveform-transport"]'
          ),
          stepToggleInPrimary: rectContains(
            '[data-testid="ide-verify-waveform-primary"]',
            '[data-testid="ide-verify-step-mode-toggle"]'
          ),
          zoomAllInTransport: rectContains(
            '[data-testid="ide-verify-waveform-transport"]',
            '[data-testid="ide-verify-zoom-all"]'
          ),
          tickScrubberInTransport: rectContains(
            '[data-testid="ide-verify-waveform-transport"]',
            '[data-testid="ide-verify-tick-scrubber"]'
          ),
        },
        overlap: {
          primaryFailNav: overlapArea(
            '[data-testid="ide-verify-waveform-primary"]',
            '[data-testid="ide-verify-fail-nav"]'
          ),
          stepToggleTransport: overlapArea(
            '[data-testid="ide-verify-step-mode-toggle"]',
            '[data-testid="ide-verify-waveform-transport"]'
          ),
          zoomAllTickScrubber: overlapArea(
            '[data-testid="ide-verify-zoom-all"]',
            '[data-testid="ide-verify-tick-scrubber"]'
          ),
        },
        routineControls: [
          'ide-verify-step-mode-toggle',
          'ide-verify-zoom-all',
          'ide-verify-zoom-fail',
          'ide-verify-zoom-window',
          'ide-verify-zoom-out',
          'ide-verify-zoom-in',
          'ide-verify-zoom-fit',
          'ide-verify-density-small',
          'ide-verify-density-normal',
          'ide-verify-density-large',
          'ide-verify-set-cursor-a',
          'ide-verify-set-cursor-b',
          'ide-verify-jump-cursor-a',
          'ide-verify-jump-cursor-b',
          'ide-verify-clear-cursors',
          'ide-verify-fail-nav-first',
        ].map((testId) => ({
          testId,
          metrics: clippedControl(`[data-testid="${testId}"]`),
        })),
        transportLabels: Array.from(
          document.querySelectorAll(
            '.ide-verify-zoom-label, .ide-verify-waveform-tools-label, [data-testid="ide-verify-run-state"]',
          ),
        ).map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            testId: element.getAttribute('data-testid') ?? '',
            className: element.getAttribute('class') ?? '',
            label: element.textContent?.trim() ?? '',
            fontSize: Number.parseFloat(style.fontSize || '0'),
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              Number(style.opacity || 1) > 0,
          };
        }),
      },
      modeLabels: ['ide-vcb-observe-only', 'ide-vcb-use-saved-checks'].flatMap((testId) =>
        Array.from(document.querySelectorAll(`[data-testid="${testId}"]`)).map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          const text = element.textContent?.trim() ?? '';
          if (context) {
            context.font = style.font;
          }
          const textWidth = context ? context.measureText(text).width : element.scrollWidth;
          const inlinePadding = parseFloat(style.paddingLeft || '0') + parseFloat(style.paddingRight || '0');
          return {
            testId,
            text,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            requiredReadableWidth: Math.ceil(textWidth + inlinePadding + 8),
            whiteSpace: style.whiteSpace,
            visible:
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              Number(style.opacity || 1) > 0,
          };
        })
      ),
      firstFailingVisible: Boolean(document.querySelector('[data-testid="ide-verify-results-summary-open-fail"]')),
      statusText,
    };
  });

  assert(metrics.buildHash === CURRENT_SHA, `${viewport.label}/${label}: visible build hash ${metrics.buildHash || 'missing'} != ${CURRENT_SHA}`);
  assert(metrics.rootOverflowX <= 1 && metrics.documentOverflowX <= 1, `${viewport.label}/${label}: root/document overflow ${JSON.stringify(metrics)}`);
  assert(metrics.phase === 'post-run', `${viewport.label}/${label}: expected post-run phase, got "${metrics.phase}"`);
  assert(
    metrics.workspaceMode === (viewport.compact ? 'stimulus-focus' : 'split'),
    `${viewport.label}/${label}: expected ${viewport.compact ? 'compact stimulus-focus' : 'split'} workspace, got "${metrics.workspaceMode}"`,
  );
  assert(metrics.stimulusLayout === 'stable', `${viewport.label}/${label}: expected stable stimulus layout, got "${metrics.stimulusLayout}"`);
  assert(metrics.stimulus && metrics.waveform && metrics.labGrid, `${viewport.label}/${label}: missing Verify workbench regions ${JSON.stringify(metrics)}`);
  assert(
    metrics.stimulus.width >= viewport.minStimulusWidth,
    `${viewport.label}/${label}: post-run testbench lane too narrow (${metrics.stimulus.width}px < ${viewport.minStimulusWidth}px)`
  );
  assert(
    metrics.stimulus.width / metrics.labGrid.width >= (viewport.compact ? 0.92 : 0.46),
    `${viewport.label}/${label}: post-run testbench must own a usable ${viewport.compact ? 'compact row' : 'share'} (${metrics.stimulus.width}/${metrics.labGrid.width})`
  );
  assert(
    metrics.waveform.width >= (viewport.compact ? viewport.minStimulusWidth : 500),
    `${viewport.label}/${label}: waveform lane must remain usable (${metrics.waveform.width}px)`,
  );
  assert(metrics.workbenchBody?.width >= viewport.minStimulusWidth - 24, `${viewport.label}/${label}: workbench body too narrow ${JSON.stringify(metrics.workbenchBody)}`);
  assert(metrics.gridScroll?.width >= viewport.minStimulusWidth - 52, `${viewport.label}/${label}: stimulus grid too narrow ${JSON.stringify(metrics.gridScroll)}`);
  assert(metrics.gridScroll?.extraX <= 8, `${viewport.label}/${label}: post-run testbench should not create a horizontal mini-scroll trap ${JSON.stringify(metrics.gridScroll)}`);
  assert(metrics.expectedCells >= 12, `${viewport.label}/${label}: expected starter checks to remain visible/editable (${metrics.expectedCells})`);
  assert(metrics.runVisible, `${viewport.label}/${label}: Run/Update Compare action must remain visible`);
  assertModeLabelsFit(metrics.modeLabels, viewport, label);
  assertWaveformControlsUsable(metrics.waveformControls, viewport, label, {
    requireInitialHitability: label !== 'FAIL',
  });
  assert(metrics.waveformPreview, `${viewport.label}/${label}: missing waveform evidence preview ${JSON.stringify(metrics)}`);
  assert(metrics.waveformPreviewCount === 1, `${viewport.label}/${label}: expected exactly one waveform preview, got ${metrics.waveformPreviewCount}`);
  if (label === 'FAIL') {
    assert(
      metrics.repairPanel && metrics.repairDecision,
      `${viewport.label}/${label}: failure repair decision is unavailable ${JSON.stringify(metrics)}`,
    );
    if (!viewport.compact) {
      const visibleDecisionRatio =
        metrics.repairDecisionClippedHeight / Math.max(1, metrics.repairDecision.height);
      assert(
        visibleDecisionRatio >= 0.8,
        `${viewport.label}/${label}: less than 80% of the direct repair decision is initially readable (${metrics.repairDecisionClippedHeight}/${metrics.repairDecision.height}px)`,
      );
    }
    await assertFailureWaveformControlsReachable(page, viewport, label);
  } else {
    assert(
      metrics.waveformPreviewTopOffset <= viewport.maxWaveformPreviewTopOffset,
      `${viewport.label}/${label}: waveform evidence starts too low (${metrics.waveformPreviewTopOffset}px > ${viewport.maxWaveformPreviewTopOffset}px) ${JSON.stringify(metrics.waveformPreview)}`
    );
    assert(
      metrics.waveformPreviewClippedHeight >= viewport.minWaveformPreviewClippedHeight,
      `${viewport.label}/${label}: too little unclipped waveform evidence is visible (${metrics.waveformPreviewClippedHeight}px < ${viewport.minWaveformPreviewClippedHeight}px; viewport-only=${metrics.waveformPreviewVisibleHeight}px) ${JSON.stringify(metrics.waveformPreview)}`
    );
    assert(
      metrics.waveformPreviewClippedHeight / Math.max(1, metrics.waveformPreview.height) >= 0.6,
      `${viewport.label}/${label}: less than 60% of the waveform preview is initially readable (${metrics.waveformPreviewClippedHeight}/${metrics.waveformPreview.height})`,
    );
  }
  const deckScrollable = Boolean(
    metrics.instrumentDeck &&
    /(auto|scroll)/.test(metrics.instrumentDeck.overflowY) &&
    metrics.instrumentDeck.maxScrollY > 1
  );
  const panelBodyScrollable = Boolean(
    metrics.panelBody &&
    /(auto|scroll)/.test(metrics.panelBody.overflowY) &&
    metrics.panelBody.maxScrollY > 1
  );
  assert(
    !(deckScrollable && panelBodyScrollable),
    `${viewport.label}/${label}: panel body and instrument deck must not form nested vertical scroll authorities ${JSON.stringify({ panelBody: metrics.panelBody, instrumentDeck: metrics.instrumentDeck })}`,
  );
  if (viewport.compact) {
    assert(
      panelBodyScrollable && !deckScrollable,
      `${viewport.label}/${label}: compact stimulus-focus must use only the panel body for vertical scrolling ${JSON.stringify({ panelBody: metrics.panelBody, instrumentDeck: metrics.instrumentDeck })}`,
    );
  } else {
    assert(
      metrics.instrumentDeck && /(auto|scroll)/.test(metrics.instrumentDeck.overflowY),
      `${viewport.label}/${label}: the instrument deck is not the desktop vertical scroll authority ${JSON.stringify(metrics.instrumentDeck)}`,
    );
  }
  await assertLastWaveformLaneReachable(page, viewport, label);
  if (viewport.compact && label === 'FAIL') {
    await assertCompactRepairActionsReachable(page, viewport, label);
  }
  if (/need/i.test(metrics.statusText)) {
    assert(metrics.firstFailingVisible, `${viewport.label}/${label}: FAIL state should expose Open first failing check`);
  }
}

function assertWaveformControlsUsable(
  controls,
  viewport,
  label,
  { requireInitialHitability = true } = {},
) {
  assert(controls?.primary, `${viewport.label}/${label}: missing stable waveform primary row ${JSON.stringify(controls)}`);
  const required = [
    ['transport', controls?.transport],
    ['zoom-all', controls?.zoomAll],
    ['tick scrubber', controls?.tickScrubber],
  ];
  if (controls?.stepToggleApplicable) {
    required.push(['step toggle', controls?.stepToggle]);
  }
  for (const [name, metric] of required) {
    assert(metric, `${viewport.label}/${label}: missing waveform ${name} ${JSON.stringify(controls)}`);
    assert(metric.height > 0, `${viewport.label}/${label}: waveform ${name} has no rendered height ${JSON.stringify(metric)}`);
    if (name === 'tick scrubber') {
      assert(
        metric.height >= 35.5,
        `${viewport.label}/${label}: tick scrubber is below the 36px routine target floor ${JSON.stringify(metric)}`,
      );
    }
    if (requireInitialHitability) {
      assert(
        metric.clippedVisibleHeight >= Math.max(1, Math.floor(metric.height * 0.9)),
        `${viewport.label}/${label}: waveform ${name} is vertically clipped (${metric.clippedVisibleHeight}/${metric.height}px) ${JSON.stringify(metric)}`,
      );
      assert(
        metric.clippedVisibleWidth >= Math.max(1, Math.floor(metric.width * 0.9)),
        `${viewport.label}/${label}: waveform ${name} is horizontally clipped (${metric.clippedVisibleWidth}/${metric.width}px) ${JSON.stringify(metric)}`,
      );
      assert(
        metric.centerHit,
        `${viewport.label}/${label}: waveform ${name} center is not hit-testable (hit ${metric.centerHitTestId || 'unknown'}) ${JSON.stringify(metric)}`,
      );
    }
  }
  assert(
    controls.domContainment.primaryInBar && controls.rectContainment.primaryInBar,
    `${viewport.label}/${label}: waveform primary row is not contained by the waveform bar ${JSON.stringify(controls)}`,
  );
  assert(
    controls.domContainment.transportInPrimary && controls.rectContainment.transportInPrimary,
    `${viewport.label}/${label}: waveform transport is not contained by the primary row ${JSON.stringify(controls)}`,
  );
  assert(
    controls.domContainment.zoomAllInTransport && controls.rectContainment.zoomAllInTransport,
    `${viewport.label}/${label}: All ticks control is not contained by transport ${JSON.stringify(controls)}`,
  );
  assert(
    controls.domContainment.tickScrubberInTransport && controls.rectContainment.tickScrubberInTransport,
    `${viewport.label}/${label}: tick scrubber is not contained by transport ${JSON.stringify(controls)}`,
  );
  if (controls.stepToggleApplicable) {
    assert(
      controls.domContainment.stepToggleInPrimary && controls.rectContainment.stepToggleInPrimary,
      `${viewport.label}/${label}: step toggle is not contained by the primary row ${JSON.stringify(controls)}`,
    );
    assert(
      (controls.overlap.stepToggleTransport ?? Number.POSITIVE_INFINITY) <= 1,
      `${viewport.label}/${label}: step toggle overlaps waveform transport (${controls.overlap.stepToggleTransport}px^2) ${JSON.stringify(controls)}`,
    );
  }
  assert(
    controls.domContainment.failNavOutsidePrimary,
    `${viewport.label}/${label}: fail/meta navigation must remain a separate waveform row ${JSON.stringify(controls)}`,
  );
  assert(
    (controls.overlap.primaryFailNav ?? Number.POSITIVE_INFINITY) <= 1,
    `${viewport.label}/${label}: fail/meta navigation overlaps the waveform primary row (${controls.overlap.primaryFailNav}px^2) ${JSON.stringify(controls)}`,
  );
  assert(
    (controls.overlap.zoomAllTickScrubber ?? Number.POSITIVE_INFINITY) <= 1,
    `${viewport.label}/${label}: All ticks overlaps the tick scrubber (${controls.overlap.zoomAllTickScrubber}px^2) ${JSON.stringify(controls)}`,
  );
  if (viewport.label === '1366x768' || viewport.label === '1440x900') {
    const alwaysRequired = new Set([
      'ide-verify-step-mode-toggle',
      'ide-verify-zoom-all',
      'ide-verify-zoom-fail',
      'ide-verify-zoom-window',
      'ide-verify-zoom-out',
      'ide-verify-zoom-in',
      'ide-verify-zoom-fit',
      'ide-verify-density-small',
      'ide-verify-density-normal',
      'ide-verify-density-large',
      'ide-verify-set-cursor-a',
      'ide-verify-set-cursor-b',
      'ide-verify-jump-cursor-a',
      'ide-verify-jump-cursor-b',
      'ide-verify-clear-cursors',
    ]);
    if (label === 'FAIL') alwaysRequired.add('ide-verify-fail-nav-first');
    for (const control of controls.routineControls ?? []) {
      if (!alwaysRequired.has(control.testId)) continue;
      const metric = control.metrics;
      assert(metric, `${viewport.label}/${label}: missing required waveform transport control ${control.testId}`);
      assert(
        metric.width >= 36 && metric.height >= 36,
        `${viewport.label}/${label}: ${control.testId} is below the 36x36 transport floor ${JSON.stringify(metric)}`,
      );
      assert(
        metric.fontSize >= 13,
        `${viewport.label}/${label}: ${control.testId} label is below the 13px readability floor ${JSON.stringify(metric)}`,
      );
    }
    const visibleLabels = (controls.transportLabels ?? []).filter((transportLabel) => transportLabel.visible);
    assert(visibleLabels.length > 0, `${viewport.label}/${label}: waveform transport labels are unavailable`);
    for (const transportLabel of visibleLabels) {
      assert(
        transportLabel.fontSize >= 13,
        `${viewport.label}/${label}: waveform transport label is below 13px ${JSON.stringify(transportLabel)}`,
      );
    }
  }
}

async function assertFailureWaveformControlsReachable(page, viewport, label) {
  const authoritySelector = viewport.compact
    ? '.ide-verify-panel > .ide-panel-body'
    : '.ide-verify-instrument-deck';
  const reachability = await page.evaluate(async (scrollSelector) => {
    const authority = document.querySelector(scrollSelector);
    if (!(authority instanceof HTMLElement)) return null;
    const selectors = [
      '[data-testid="ide-verify-waveform-primary"]',
      '[data-testid="ide-verify-waveform-transport"]',
      '[data-testid="ide-verify-zoom-all"]',
      '[data-testid="ide-verify-tick-scrubber"]',
    ];
    if (Number(document.querySelector('[data-testid="ide-verify-tick-scrubber"]')?.getAttribute('max') ?? 0) > 0) {
      selectors.push('[data-testid="ide-verify-step-mode-toggle"]');
    }

    const startScrollTop = authority.scrollTop;
    const records = [];
    for (const selector of selectors) {
      const control = document.querySelector(selector);
      if (!(control instanceof HTMLElement)) {
        records.push({ selector, available: false });
        continue;
      }
      const authorityRect = authority.getBoundingClientRect();
      const before = control.getBoundingClientRect();
      authority.scrollTop = Math.max(
        0,
        Math.min(
          authority.scrollHeight - authority.clientHeight,
          authority.scrollTop + before.top - authorityRect.top - 8,
        ),
      );
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const currentAuthorityRect = authority.getBoundingClientRect();
      const rect = control.getBoundingClientRect();
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, currentAuthorityRect.bottom, window.innerHeight) -
          Math.max(rect.top, currentAuthorityRect.top, 0),
      );
      const centerHit = document.elementFromPoint(
        rect.left + rect.width / 2,
        Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2)),
      );
      records.push({
        selector,
        available: true,
        height: rect.height,
        visibleHeight,
        centerHit: centerHit === control || control.contains(centerHit),
        inAuthority: authority.contains(control),
      });
    }
    authority.scrollTop = startScrollTop;
    return {
      authoritySelector: scrollSelector,
      overflowY: getComputedStyle(authority).overflowY,
      maxScrollY: Math.max(0, authority.scrollHeight - authority.clientHeight),
      records,
    };
  }, authoritySelector);

  assert(reachability, `${viewport.label}/${label}: waveform scroll authority is unavailable`);
  assert(
    /(auto|scroll)/.test(reachability.overflowY) && reachability.maxScrollY > 1,
    `${viewport.label}/${label}: failure waveform controls have no usable scroll authority ${JSON.stringify(reachability)}`,
  );
  for (const record of reachability.records) {
    assert(record.available, `${viewport.label}/${label}: failure waveform control is missing ${record.selector}`);
    assert(record.inAuthority, `${viewport.label}/${label}: failure waveform control escaped ${reachability.authoritySelector} ${JSON.stringify(record)}`);
    assert(
      record.visibleHeight >= Math.max(1, Math.floor(record.height * 0.9)),
      `${viewport.label}/${label}: failure waveform control is not reachable ${JSON.stringify(record)}`,
    );
    assert(record.centerHit, `${viewport.label}/${label}: failure waveform control is not hit-testable ${JSON.stringify(record)}`);
  }
}

async function assertCompactStimulusFocus(page, viewport, label) {
  const metrics = await page.evaluate(async () => {
    const box = (selector) => {
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
      };
    };
    const body = document.querySelector('.ide-verify-panel > .ide-panel-body');
    const deck = document.querySelector('.ide-verify-instrument-deck');
    if (body instanceof HTMLElement) {
      body.scrollTop = 0;
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    const labGrid = document.querySelector('[data-testid="ide-verify-lab-grid"]');
    return {
      phase: labGrid?.getAttribute('data-verify-workflow-phase') ?? '',
      workspaceMode: labGrid?.getAttribute('data-workspace-mode') ?? '',
      labGrid: box('[data-testid="ide-verify-lab-grid"]'),
      stimulus: box('[data-testid="ide-verify-region-stimulus"]'),
      waveform: box('[data-testid="ide-verify-region-waveform"]'),
      expectedCells: document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]').length,
      panelBody: body instanceof HTMLElement
        ? {
            ...box('.ide-verify-panel > .ide-panel-body'),
            overflowY: getComputedStyle(body).overflowY,
            maxScrollY: Math.max(0, body.scrollHeight - body.clientHeight),
          }
        : null,
      instrumentDeck: deck instanceof HTMLElement
        ? {
            ...box('.ide-verify-instrument-deck'),
            overflowY: getComputedStyle(deck).overflowY,
            maxScrollY: Math.max(0, deck.scrollHeight - deck.clientHeight),
          }
        : null,
    };
  });

  assert(metrics.phase === 'post-run', `${viewport.label}/${label}: compact layout lost post-run phase ${JSON.stringify(metrics)}`);
  assert(
    metrics.workspaceMode === 'stimulus-focus',
    `${viewport.label}/${label}: compact post-run layout must prioritize stimulus ${JSON.stringify(metrics)}`,
  );
  assert(metrics.labGrid && metrics.stimulus && metrics.waveform, `${viewport.label}/${label}: compact workbench regions missing ${JSON.stringify(metrics)}`);
  assert(
    metrics.stimulus.width >= viewport.minStimulusWidth && metrics.stimulus.width / metrics.labGrid.width >= 0.92,
    `${viewport.label}/${label}: compact testbench does not own a full-width row ${JSON.stringify(metrics)}`,
  );
  assert(
    metrics.waveform.width >= viewport.minStimulusWidth && metrics.waveform.y >= metrics.stimulus.bottom - 1,
    `${viewport.label}/${label}: compact waveform must stack below the stimulus row ${JSON.stringify(metrics)}`,
  );
  assert(metrics.expectedCells >= 12, `${viewport.label}/${label}: compact stimulus focus lost editable checks (${metrics.expectedCells})`);
  assert(
    metrics.panelBody && /(auto|scroll)/.test(metrics.panelBody.overflowY) && metrics.panelBody.maxScrollY > 1,
    `${viewport.label}/${label}: compact panel body is not a usable vertical scroll authority ${JSON.stringify(metrics.panelBody)}`,
  );
  assert(
    !(
      metrics.instrumentDeck &&
      /(auto|scroll)/.test(metrics.instrumentDeck.overflowY) &&
      metrics.instrumentDeck.maxScrollY > 1
    ),
    `${viewport.label}/${label}: compact instrument deck must remain intrinsic instead of creating nested scroll ${JSON.stringify(metrics.instrumentDeck)}`,
  );
}

async function positionCompactWaveformControls(page) {
  await page.evaluate(async () => {
    const body = document.querySelector('.ide-verify-panel > .ide-panel-body');
    const primary = document.querySelector('[data-testid="ide-verify-waveform-primary"]');
    if (!(body instanceof HTMLElement) || !(primary instanceof HTMLElement)) return;
    const bodyRect = body.getBoundingClientRect();
    const primaryRect = primary.getBoundingClientRect();
    body.scrollTop = Math.max(0, body.scrollTop + primaryRect.top - bodyRect.top - 8);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function assertCompactRepairActionsReachable(page, viewport, label) {
  const actions = await page.evaluate(async () => {
    const body = document.querySelector('.ide-verify-panel > .ide-panel-body');
    const deck = document.querySelector('.ide-verify-instrument-deck');
    if (!(body instanceof HTMLElement) || !(deck instanceof HTMLElement)) return null;
    const startScrollTop = body.scrollTop;
    const selectors = [
      '[data-testid="ide-verify-repair-use-observed"]',
      '[data-testid="ide-verify-repair-open-design"]',
    ];
    const records = [];
    for (const selector of selectors) {
      const control = document.querySelector(selector);
      if (!(control instanceof HTMLElement)) {
        records.push({ selector, available: false });
        continue;
      }
      const bodyRect = body.getBoundingClientRect();
      const before = control.getBoundingClientRect();
      body.scrollTop = Math.max(0, body.scrollTop + before.top - bodyRect.top - 72);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const rect = control.getBoundingClientRect();
      const currentBodyRect = body.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, currentBodyRect.bottom) - Math.max(rect.top, currentBodyRect.top));
      const centerHit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      records.push({
        selector,
        available: true,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom },
        visibleHeight,
        centerHit: centerHit === control || control.contains(centerHit),
        inRepairPanel: Boolean(control.closest('[data-testid="ide-verify-repair-panel"]')),
      });
    }
    const result = {
      records,
      panelBody: {
        overflowY: getComputedStyle(body).overflowY,
        maxScrollY: Math.max(0, body.scrollHeight - body.clientHeight),
      },
      instrumentDeck: {
        overflowY: getComputedStyle(deck).overflowY,
        maxScrollY: Math.max(0, deck.scrollHeight - deck.clientHeight),
      },
    };
    body.scrollTop = startScrollTop;
    return result;
  });

  assert(actions, `${viewport.label}/${label}: compact repair scroll authorities unavailable`);
  assert(
    /(auto|scroll)/.test(actions.panelBody.overflowY) && actions.panelBody.maxScrollY > 1,
    `${viewport.label}/${label}: compact repair actions are not owned by panel-body scrolling ${JSON.stringify(actions)}`,
  );
  assert(
    !(/(auto|scroll)/.test(actions.instrumentDeck.overflowY) && actions.instrumentDeck.maxScrollY > 1),
    `${viewport.label}/${label}: compact repair actions are trapped in nested deck scrolling ${JSON.stringify(actions)}`,
  );
  for (const record of actions.records) {
    assert(record.available, `${viewport.label}/${label}: compact repair action missing ${record.selector} ${JSON.stringify(actions)}`);
    assert(record.inRepairPanel, `${viewport.label}/${label}: compact repair action escaped its repair panel ${JSON.stringify(record)}`);
    assert(
      record.visibleHeight >= Math.max(1, Math.floor(record.rect.height * 0.9)),
      `${viewport.label}/${label}: compact repair action remains clipped after outer scroll ${JSON.stringify(record)}`,
    );
    assert(record.centerHit, `${viewport.label}/${label}: compact repair action center is not hit-testable ${JSON.stringify(record)}`);
  }
}

async function assertLastWaveformLaneReachable(page, viewport, label) {
  const scrollSelector = viewport.compact
    ? '.ide-verify-panel > .ide-panel-body'
    : '.ide-verify-instrument-deck';
  const reachability = await page.evaluate(async (authoritySelector) => {
    const deck = document.querySelector(authoritySelector);
    const rows = Array.from(document.querySelectorAll('[data-testid^="ide-verify-waveform-row-"]'));
    const lastRow = rows.at(-1);
    if (!(deck instanceof HTMLElement) || !(lastRow instanceof SVGGraphicsElement)) {
      return { available: false, rowCount: rows.length };
    }
    const visibleAgainstDeck = () => {
      const deckRect = deck.getBoundingClientRect();
      const rowRect = lastRow.getBoundingClientRect();
      return {
        deckRect: { top: deckRect.top, bottom: deckRect.bottom, height: deckRect.height },
        rowRect: { top: rowRect.top, bottom: rowRect.bottom, height: rowRect.height },
        visibleHeight: Math.max(0, Math.min(deckRect.bottom, rowRect.bottom) - Math.max(deckRect.top, rowRect.top)),
      };
    };
    const startScrollTop = deck.scrollTop;
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const before = visibleAgainstDeck();
    const needed = Math.max(0, before.rowRect.bottom - before.deckRect.bottom + 8);
    deck.scrollTop = Math.min(deck.scrollHeight - deck.clientHeight, deck.scrollTop + needed);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const after = visibleAgainstDeck();
    const result = {
      available: true,
      rowCount: rows.length,
      rowTestId: lastRow.getAttribute('data-testid') ?? '',
      before,
      after,
      scrollTop: deck.scrollTop,
      maxScrollY: Math.max(0, deck.scrollHeight - deck.clientHeight),
      overflowY: getComputedStyle(deck).overflowY,
      authoritySelector,
    };
    deck.scrollTop = startScrollTop;
    return result;
  }, scrollSelector);
  assert(reachability.available, `${viewport.label}/${label}: waveform rows are unavailable ${JSON.stringify(reachability)}`);
  assert(
    reachability.after.visibleHeight >= Math.min(8, reachability.after.rowRect.height),
    `${viewport.label}/${label}: last waveform lane cannot be reached through the instrument deck ${JSON.stringify(reachability)}`,
  );
  if (reachability.before.visibleHeight < Math.min(8, reachability.before.rowRect.height)) {
    assert(
      reachability.scrollTop > 0 && reachability.maxScrollY > 0,
      `${viewport.label}/${label}: clipped last waveform lane did not produce a usable authority scroll ${JSON.stringify(reachability)}`,
    );
  }
}

function assertModeLabelsFit(modeLabels, viewport, label) {
  const expectedLabels = new Map([
    ['ide-vcb-observe-only', { text: 'Observe' }],
    ['ide-vcb-use-saved-checks', { text: 'Compare checks' }],
  ]);
  for (const [testId, expected] of expectedLabels) {
    const metrics = modeLabels.filter((candidate) => candidate.testId === testId && candidate.visible);
    assert(metrics.length > 0, `${viewport.label}/${label}: missing visible Verify command deck label ${testId}`);
    for (const metric of metrics) {
      assert(metric.text === expected.text, `${viewport.label}/${label}: Verify command deck label ${testId} changed to "${metric.text}"`);
      assert(
        metric.width >= metric.requiredReadableWidth,
        `${viewport.label}/${label}: Verify command deck label "${expected.text}" is too narrow to read (${metric.width}px < ${metric.requiredReadableWidth}px) ${JSON.stringify(metric)}`
      );
      assert(
        metric.scrollWidth <= metric.clientWidth + 1,
        `${viewport.label}/${label}: Verify command deck label "${expected.text}" is clipped ${JSON.stringify(metric)}`
      );
      assert(
        metric.height >= 36,
        `${viewport.label}/${label}: Verify command deck label "${expected.text}" is below the 36px routine-control floor ${JSON.stringify(metric)}`
      );
      assert(
        metric.whiteSpace === 'nowrap',
        `${viewport.label}/${label}: Verify command deck label "${expected.text}" must remain visually nowrap ${JSON.stringify(metric)}`
      );
    }
  }
}

async function assertPostRunToggleKeepsWorkbenchAccessible(page, viewport) {
  const toggle = page.locator('[data-testid="ide-verify-workbench-toggle"]').first();
  assert(
    !(await toggle.isVisible().catch(() => false)),
    `${viewport.label}: stable testbench authoring must not expose a collapse toggle`,
  );
  await page.waitForSelector('[data-testid="ide-verify-workbench-body"]', { timeout: 5000 });
  assert(
    !(await page.locator('[data-testid="ide-verify-workbench-collapsed-strip"]').isVisible().catch(() => false)),
    `${viewport.label}: post-run workbench must keep the editable checks visible`,
  );
  assert(
    await page.locator('[data-testid="ide-verify-authoring-path"]:visible').first().isVisible().catch(() => false),
    `${viewport.label}: the testbench authoring path must remain visible after a run`,
  );
  await assertPostRunWorkbench(page, viewport, 'STABLE AUTHORING');
}

async function clickRunAndWaitForNewResult(page) {
  const previousReportHash = await page.evaluate(
    () => window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null
  );
  await clickVerifyRun(page);
  await page.waitForFunction(
    (previous) => {
      const nextHash = window.__RB_PROJECT_RUNTIME__?.getState?.()?.verifyLastRun?.reportHash ?? null;
      return Boolean(nextHash && nextHash !== previous);
    },
    previousReportHash,
    { timeout: 20000 }
  );
  await waitForVerifyResult(page, { timeout: 10000 });
  return ((await page.locator('[data-testid="ide-verify-summary-status"]').first().textContent().catch(() => '')) ?? '').trim();
}

async function pickRenderedExpectedTarget(page) {
  const cells = await page.locator('[data-testid^="ide-stimulus-expected-"]').evaluateAll((elements) =>
    elements.map((element) => {
      const testId = element.getAttribute('data-testid') || '';
      const title = element.getAttribute('title') || '';
      const match = /^ide-stimulus-expected-(.+)-t(\d+)$/.exec(testId);
      const parsedTitle = /:\s*(0|1|not set)\s*-\s*drag/i.exec(title);
      return {
        testId,
        signal: match?.[1] ?? '',
        tick: match?.[2] ? Number(match[2]) : -1,
        value: parsedTitle?.[1] === '1' ? 1 : parsedTitle?.[1] === '0' ? 0 : null,
        title,
      };
    })
  );
  const target = cells.find((cell) => cell.value === 0) ?? cells.find((cell) => cell.value === 1) ?? null;
  assert(target, `expected at least one rendered expected-output cell with a saved 0/1 value, saw ${JSON.stringify(cells.slice(0, 8))}`);
  return target;
}

function parseCellValueFromTitle(title) {
  const value = String(title ?? '');
  if (/:\s*1\s*-\s*drag/i.test(value)) return 1;
  if (/:\s*0\s*-\s*drag/i.test(value)) return 0;
  return null;
}

async function readRenderedCellValue(page, target) {
  const title = await page.getByTestId(target.testId).first().getAttribute('title');
  return parseCellValueFromTitle(title);
}

async function clickExpectedCellToValue(page, target, expectedValue) {
  const cell = page.getByTestId(target.testId).first();
  await cell.scrollIntoViewIfNeeded();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readRenderedCellValue(page, target);
    if (current === expectedValue) return;
    await cell.click();
    await page.waitForTimeout(150);
  }
  const current = await readRenderedCellValue(page, target);
  assert(current === expectedValue, `expected ${target.testId} to become ${expectedValue}, got ${current}`);
}

async function capture(page, viewport, name) {
  if (!SCREENSHOT_ROOT) return;
  await fs.mkdir(SCREENSHOT_ROOT, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_ROOT, `verify-postrun-workbench-${name}-${viewport.label}.png`),
    fullPage: false,
  });
}
