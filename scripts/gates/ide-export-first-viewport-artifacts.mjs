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
  const browser = page.getByTestId('ide-export-file-browser');
  const testbench = page.getByTestId('ide-export-file-testbench-vhd');
  await browser.waitFor();
  const before = await browser.evaluate(element => ({
    clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop,
  }));
  // A compact file list that fits must not be forced to overflow merely to pass
  // this gate. If it does overflow, exercise its real wheel owner first.
  if (before.scrollHeight > before.clientHeight + 1) {
    const box = await browser.boundingBox();
    assert(box, label + ': generated file list must be measurable');
    await page.mouse.move(box.x + box.width / 2, Math.min(box.y + box.height / 2, page.viewportSize().height - 40));
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(100);
    const after = await browser.evaluate(element => element.scrollTop);
    assert(after > before.scrollTop, label + ': overflowing file list must respond to a real wheel gesture');
  }
  await testbench.click();
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="ide-export-preview-path"]')?.textContent?.trim() === 'testbench.vhd');
  const box = await testbench.boundingBox();
  const viewport = page.viewportSize();
  assert(box && viewport && box.x >= 0 && box.x + box.width <= viewport.width + 1
    && box.y >= 0 && box.y + box.height <= viewport.height + 1,
    label + ': testbench artifact must be fully visible and operable');
  assert((await page.getByTestId('ide-export-preview-code').innerText()).trim().length > 0,
    label + ': activating testbench must expose a non-empty generated preview');
  return { fileList: before, targetBox: box, selectedPath: 'testbench.vhd' };
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
