#!/usr/bin/env node

/**
 * Export first-viewport artifact visibility gate.
 *
 * Contract:
 * 1) Ready-to-build Export keeps its readiness authority and generated files visible at classroom viewports.
 * 2) The directly visible file workspace exposes the core E0 artifacts students/professors inspect.
 * 3) Package files remain available without a disclosure or hidden drawer.
 * 4) The file browser and selected preview remain real; this gate does not change generated files or hardware proof claims.
 */

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

const SCREENSHOT_DIR = process.env.RB_EXPORT_FIRST_VIEWPORT_ARTIFACTS_SCREENSHOTS_DIR?.trim() || '';
const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
];
const REQUIRED_ARTIFACTS = [
  'README.txt',
  'top.vhd',
  'top.xdc',
  'testbench.vhd',
  'vivado_import.tcl',
];

await runIdeGate('IDE export first-viewport artifacts visible', async ({ page, baseUrl }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('rb-onboarding-v1-seen', '1');
  });

  const observations = [];
  const failures = [];

  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openReadyToBuildExport(page, baseUrl, viewport.label);
      await capture(page, viewport.label);

      const proofScope = await normalizedText(page.locator('[data-testid="ide-export-e0-boundary-summary"]').first());
      assert(
        /Browser E0/i.test(proofScope),
        `${viewport.label}: compact Export chrome must expose Browser E0, got ${proofScope || 'missing'}`
      );

      const inspector = page.locator('[data-testid="ide-export-package-inspector-v1"]').first();
      const packageFiles = page.locator('[data-testid="ide-export-package-files"]').first();
      const fileBrowser = page.locator('[data-testid="ide-export-file-browser"]').first();
      assert(await visible(inspector), `${viewport.label}: Export package inspector must be visible`);
      assert(await visible(packageFiles), `${viewport.label}: generated files workspace must be visible`);
      const reachability = await assertArtifactReachability(page, viewport.label);
      await fileBrowser.waitFor({ state: 'visible', timeout: 10000 });
      assert(await visible(fileBrowser), `${viewport.label}: package workspace must expose artifact files`);

      const stripText = await normalizedText(fileBrowser);
      for (const artifactName of REQUIRED_ARTIFACTS) {
        assert(
          stripText.toLowerCase().includes(artifactName.toLowerCase()),
          `${viewport.label}: package file browser must include ${artifactName}; got "${stripText}"`
        );
      }

      const artifactExplorer = page.locator('[data-testid="ide-export-selected-preview-v1"]').first();
      await artifactExplorer.scrollIntoViewIfNeeded();
      assert(await visible(artifactExplorer), `${viewport.label}: selected generated-file preview must render`);
      const surfaceText = await normalizedText(page.locator('[data-testid="ide-mode-export"]').first());
      assert(
        !/E1\s+(ready|passed|complete)|E2\s+(ready|passed|complete)|E3\s+(ready|passed|complete)|Vivado build passed|board observed/i.test(surfaceText),
        `${viewport.label}: Export browser view must not claim external Vivado/Basys3 proof`
      );

      observations.push({
        viewport: viewport.label,
        inspector: await readRect(page, '[data-testid="ide-export-package-inspector-v1"]'),
        disclosure: await readRect(page, '[data-testid="ide-export-package-files"]'),
        fileBrowser: await readRect(page, '[data-testid="ide-export-file-browser"]'),
        explorer: await readRect(page, '[data-testid="ide-export-selected-preview-v1"]'),
        reachability,
        text: stripText,
      });
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await writeObservations(observations);
  assert(failures.length === 0, `Export first-viewport artifact failures:\n${failures.join('\n')}`);
});

async function openReadyToBuildExport(page, baseUrl, viewportLabel) {
  await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=export-first-viewport-artifacts-${viewportLabel}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
  await loadStarterProject(page, { exactExampleId: 'logic-gates' });

  await page.locator('[data-testid="mode-button-verify"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-verify"]', { timeout: 10000 });
  await ensureVerifyVectorsReady(page);
  assert(await setVerifyRunMode(page, 'compare'), `${viewportLabel}: Verify Compare mode must be available`);
  await clickVerifyRun(page);
  await waitForVerifyResult(page, { timeout: 15000 });
  const verifyStatus = await normalizedText(page.locator('[data-testid="ide-verify-summary-status"]'));
  assert(isVerifyPass(verifyStatus), `${viewportLabel}: Export artifact visibility proof requires Compare PASS, got "${verifyStatus}"`);

  await page.locator('[data-testid="mode-button-export"]').first().click();
  await page.waitForSelector('[data-testid="ide-mode-export"]', { timeout: 10000 });
  await page.waitForSelector('[data-testid="ide-export-readiness-hero"]', { timeout: 10000 });
}

async function assertArtifactReachability(page, label) {
  const scrollOwner = page.locator('[data-testid="ide-mode-body"]').first();
  const ownerBox = await scrollOwner.boundingBox();
  assert(ownerBox, `${label}: Export workspace must have a measurable scroll owner`);
  const initialScrollTop = await scrollOwner.evaluate((element) => element.scrollTop);
  await page.mouse.move(ownerBox.x + ownerBox.width / 2, ownerBox.y + Math.min(ownerBox.height / 2, 300));
  await page.mouse.wheel(0, 640);
  await page.waitForTimeout(80);
  const userScrollTop = await scrollOwner.evaluate((element) => element.scrollTop);

  const state = await page.evaluate(({ initialScrollTop, userScrollTop }) => {
    const scrollOwner = document.querySelector('[data-testid="ide-mode-body"]');
    const fileBrowser = document.querySelector('[data-testid="ide-export-file-browser"]');
    const testbench = document.querySelector('[data-testid="ide-export-file-testbench-vhd"]');
    if (
      !(scrollOwner instanceof HTMLElement) ||
      !(fileBrowser instanceof HTMLElement) ||
      !(testbench instanceof HTMLElement)
    ) {
      return null;
    }

    scrollOwner.scrollTop = scrollOwner.scrollHeight;
    fileBrowser.scrollTop = fileBrowser.scrollHeight;

    const ownerRect = scrollOwner.getBoundingClientRect();
    const targetRect = testbench.getBoundingClientRect();
    return {
      overflowY: getComputedStyle(scrollOwner).overflowY,
      clientHeight: scrollOwner.clientHeight,
      scrollHeight: scrollOwner.scrollHeight,
      initialScrollTop,
      userScrollTop,
      finalScrollTop: scrollOwner.scrollTop,
      fileBrowserScrollTop: fileBrowser.scrollTop,
      targetTop: Number(targetRect.top.toFixed(1)),
      targetBottom: Number(targetRect.bottom.toFixed(1)),
      ownerTop: Number(ownerRect.top.toFixed(1)),
      ownerBottom: Number(ownerRect.bottom.toFixed(1)),
      targetVisible:
        targetRect.width > 1 &&
        targetRect.height > 1 &&
        targetRect.top >= Math.max(0, ownerRect.top) - 1 &&
        targetRect.bottom <= Math.min(innerHeight, ownerRect.bottom) + 1,
    };
  }, { initialScrollTop, userScrollTop });

  assert(state, `${label}: Export scroll owner or testbench artifact is missing`);
  assert(
    /auto|scroll/.test(state.overflowY),
    `${label}: Export workspace must advertise student-scrollable overflow: ${JSON.stringify(state)}`
  );
  assert(
    state.scrollHeight > state.clientHeight + 1,
    `${label}: Export workspace must expose vertical overflow: ${JSON.stringify(state)}`
  );
  assert(
    state.userScrollTop > state.initialScrollTop,
    `${label}: Export workspace did not move after a real wheel gesture: ${JSON.stringify(state)}`
  );
  assert(
    state.targetVisible,
    `${label}: testbench.vhd is not reachable through the visible Export scroll containers: ${JSON.stringify(state)}`
  );
  return state;
}

async function capture(page, label) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `export-first-viewport-artifacts-${label}.png`),
    fullPage: false,
  });
}

async function writeObservations(observations) {
  if (!SCREENSHOT_DIR) return;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(SCREENSHOT_DIR, 'export-first-viewport-artifacts-observations.json'),
    JSON.stringify(observations, null, 2)
  );
}

async function readRect(page, selector) {
  return page.evaluate((targetSelector) => {
    const element = document.querySelector(targetSelector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      top: Number(rect.top.toFixed(1)),
      bottom: Number(rect.bottom.toFixed(1)),
      height: Number(rect.height.toFixed(1)),
      visibleHeight: Number((Math.min(window.innerHeight, rect.bottom) - Math.max(0, rect.top)).toFixed(1)),
    };
  }, selector);
}

async function normalizedText(locator) {
  return ((await locator.first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
