#!/usr/bin/env node

import {
  assert,
  clickVerifyRun,
  ensureVerifyVectorsReady,
  loadStarterProject,
  runIdeGate,
  setVerifyRunMode,
} from './_gateHarness.mjs';
import { waitForVerifyResult } from './_verifyStatus.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];

await runIdeGate('IDE nested scroll regression guard satisfied', async ({ page, baseUrl }) => {
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
      await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=nested-scroll-regression-${viewport.label}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
      await loadStarterProject(page, { exactExampleId: 'logic-gates' });

      await openMode(page, baseUrl, viewport, 'design');
      await assertNoMainNestedTrap(page, viewport, 'design', {
        allowedSelectors: ['[data-testid="ide-left-dock"]', '[data-testid="ide-right-dock"]'],
        maxMainScrollerExtraY: 120,
      });

      await openMode(page, baseUrl, viewport, 'verify');
      await ensureVerifyVectorsReady(page);
      await assertVerifyPreRunScrollSpace(page, viewport);
      assert(await setVerifyRunMode(page, 'compare'), `${viewport.label}: Compare mode must be selectable`);
      await clickVerifyRun(page);
      await waitForVerifyResult(page, { timeout: 15000 });
      await assertVerifyPostRunScrollSpace(page, viewport);

      await openMode(page, baseUrl, viewport, 'hardware');
      await assertNoMainNestedTrap(page, viewport, 'hardware', {
        allowedSelectors: [],
        maxMainScrollerExtraY: 380,
      });

      await openMode(page, baseUrl, viewport, 'export');
      await assertNoRootHorizontalOverflow(page, viewport, 'export');

      await page.goto(`${baseUrl}/?mode=import&e2e=1&gate=nested-scroll-regression-${viewport.label}-import`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });
      await assertNoRootHorizontalOverflow(page, viewport, 'import');
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(findings.length === 0, `browser console/page errors: ${JSON.stringify(findings.slice(0, 8))}`);
  assert(failures.length === 0, `nested scroll regression failures:\n${failures.join('\n')}`);
});

async function openMode(page, baseUrl, viewport, mode) {
  const button = page.locator(`[data-testid="mode-button-${mode}"]`).first();
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  } else {
    await page.goto(`${baseUrl}/?mode=${mode}&e2e=1&gate=nested-scroll-regression-${viewport.label}-${mode}`, {
      waitUntil: 'domcontentloaded',
    });
  }
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(120);
}

async function assertVerifyPreRunScrollSpace(page, viewport) {
  const state = await page.evaluate(() => {
    const grid = document.querySelector('.ide-stimulus-grid-scroll');
    const stimulus = document.querySelector('[data-testid="ide-verify-region-stimulus"]');
    const gridRect = grid?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
    const stimulusRect = stimulus?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
    return {
      gridHeight: Math.round(gridRect.height),
      stimulusHeight: Math.round(stimulusRect.height),
      gridExtraX: grid ? Math.max(0, grid.scrollWidth - grid.clientWidth) : 9999,
      gridExtraY: grid ? Math.max(0, grid.scrollHeight - grid.clientHeight) : 9999,
      expectedCells: document.querySelectorAll('[data-testid^="ide-stimulus-expected-"]').length,
    };
  });
  assert(state.expectedCells >= 12, `${viewport.label}: Verify starter expected cells missing (${state.expectedCells})`);
  assert(state.gridExtraX <= 8, `${viewport.label}: Verify pre-run grid has horizontal mini-scroll (${state.gridExtraX}px)`);
  assert(
    state.gridHeight >= Math.min(210, viewport.height * 0.26),
    `${viewport.label}: Verify pre-run grid is too vertically cramped (${state.gridHeight}px)`
  );
  assert(
    state.gridExtraY <= 96,
    `${viewport.label}: Verify pre-run grid has a nested vertical scroll trap (${state.gridExtraY}px extra)`
  );
}

async function assertVerifyPostRunScrollSpace(page, viewport) {
  const state = await page.evaluate(() => {
    const waveform = document.querySelector('[data-testid="ide-verify-waveform-scroll"]');
    const waveformRect = waveform?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0);
    const grid = document.querySelector('.ide-stimulus-grid-scroll');
    return {
      waveformWidth: Math.round(waveformRect.width),
      waveformHeight: Math.round(waveformRect.height),
      waveformExtraX: waveform ? Math.max(0, waveform.scrollWidth - waveform.clientWidth) : 9999,
      gridExtraX: grid ? Math.max(0, grid.scrollWidth - grid.clientWidth) : 0,
    };
  });
  assert(state.waveformWidth >= viewport.width * 0.39, `${viewport.label}: Verify waveform scroller is too narrow (${state.waveformWidth}px)`);
  assert(state.waveformHeight >= viewport.height * 0.30, `${viewport.label}: Verify waveform scroller is too short (${state.waveformHeight}px)`);
  assert(state.waveformExtraX <= 8, `${viewport.label}: Verify waveform has horizontal mini-scroll (${state.waveformExtraX}px)`);
  assert(state.gridExtraX <= 8, `${viewport.label}: Verify repair grid has horizontal mini-scroll (${state.gridExtraX}px)`);
}

async function assertNoMainNestedTrap(page, viewport, mode, options) {
  await assertNoRootHorizontalOverflow(page, viewport, mode);
  const traps = await page.evaluate((input) => {
    const allowed = new Set(input.allowedSelectors);
    const isAllowed = (element) => {
      for (const selector of allowed) {
        if (element.matches(selector) || element.closest(selector)) return true;
      }
      return false;
    };
    const modeRoot = document.querySelector(`[data-testid="ide-mode-${input.mode}"]`);
    if (!modeRoot) return [{ reason: 'missing mode root' }];
    return Array.from(modeRoot.querySelectorAll('*'))
      .map((element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const overflowX = /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 8;
        const overflowY = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + input.maxMainScrollerExtraY;
        if ((!overflowX && !overflowY) || rect.width < 180 || rect.height < 120 || isAllowed(element)) return null;
        return {
          testId: element.getAttribute('data-testid'),
          className: typeof element.className === 'string' ? element.className.slice(0, 100) : '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          extraX: Math.max(0, element.scrollWidth - element.clientWidth),
          extraY: Math.max(0, element.scrollHeight - element.clientHeight),
        };
      })
      .filter(Boolean);
  }, { mode, ...options });

  assert(traps.length === 0, `${viewport.label}/${mode}: unexpected main nested scroll traps ${JSON.stringify(traps.slice(0, 6))}`);
}

async function assertNoRootHorizontalOverflow(page, viewport, label) {
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  assert(overflow <= 1, `${viewport.label}/${label}: root horizontal overflow ${overflow}px`);
}
